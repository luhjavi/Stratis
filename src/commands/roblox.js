const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { baseEmbed } = require("../constants/embed");
const { canRunSearch } = require("../utils/cooldown");
const RequestStat = require("../database/models/RequestStat");
const robloxApi = require("../services/robloxApi");
const robloxAggregator = require("../services/robloxAggregator");
const { startSession } = require("../interactions/robloxUserSession");
const { formatCompactNumber } = require("../utils/numberFormat");

async function incrementRequests() {
  try {
    await RequestStat.findOneAndUpdate({ key: "totalRequests" }, { $inc: { count: 1 } }, { upsert: true });
  } catch {
    // Mongo can be unavailable in local test mode; command flow should still succeed.
  }
}

/** Match the green status bar on status.roblox.com (Operational = 100 on Status.io). */
const STATUS_COLOR_OK = 0x27ae60;
const STATUS_COLOR_WARN = 0xf39c12;
const STATUS_COLOR_BAD = 0xe74c3c;

function statusEmbedColor(payload) {
  const code = payload?.statusCode;
  if (code === 100 || String(payload?.overall || "").toLowerCase() === "operational") {
    return STATUS_COLOR_OK;
  }
  if (code === 300 || code === 200 || code === 250) return STATUS_COLOR_WARN;
  if (typeof code === "number" && code >= 400) return STATUS_COLOR_BAD;
  return STATUS_COLOR_WARN;
}

function headlineFromOverall(overall) {
  if (!overall) return "Roblox status";
  if (String(overall).toLowerCase() === "operational") return "All Systems Operational";
  return overall;
}

function statusEmojiFor(statusText) {
  const t = String(statusText || "").toLowerCase();
  // Down / outage (red circle)
  if (
    t.includes("major outage") ||
    t.includes("outage") ||
    t.includes("unavailable") ||
    t.includes("offline") ||
    /\bdown\b/.test(t)
  ) {
    return "🔴";
  }
  // Degraded / partial / maintenance (warning)
  if (
    t.includes("degraded") ||
    t.includes("partial") ||
    t.includes("limited") ||
    t.includes("maintenance") ||
    t.includes("performance")
  ) {
    return "⚠️";
  }
  // Up / healthy (check mark)
  if (t.includes("operational") || t.includes("healthy") || /\bup\b/.test(t) || t === "ok") {
    return "✅";
  }
  return "⚪";
}

function formatCategoryLines(items) {
  const max = Math.max(8, ...items.map((i) => i.name.length));
  return items.map((i) => `${i.name.padEnd(max)}  ${statusEmojiFor(i.status)} ${i.status}`);
}

function monospaceFieldValue(lines) {
  const body = lines.join("\n");
  let wrapped = `\`\`\`\n${body}\n\`\`\``;
  if (wrapped.length <= 1024) return wrapped;
  let acc = [];
  for (const line of lines) {
    const next = `\`\`\`\n${[...acc, line].join("\n")}\n\`\`\``;
    if (next.length > 1024) break;
    acc.push(line);
  }
  if (!acc.length) acc = [lines[0].slice(0, Math.min(lines[0].length, 980))];
  return `\`\`\`\n${acc.join("\n")}\n…\n\`\`\``;
}

/** When only flat `components` exist (legacy API), rebuild User / Player / Creator groups. */
function categoriesFromFlatComponents(components) {
  const map = new Map();
  const sep = " · ";
  for (const c of components || []) {
    const idx = c.name.indexOf(sep);
    if (idx === -1) {
      if (!map.has("Other")) map.set("Other", []);
      map.get("Other").push({ name: c.name, status: c.status });
    } else {
      const cat = c.name.slice(0, idx);
      const name = c.name.slice(idx + sep.length);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ name, status: c.status });
    }
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Roblox intelligence commands")
    .addSubcommand((sub) =>
      sub
        .setName("userfromroblox")
        .setDescription("Search by Roblox username or ID")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Roblox username or user ID")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Get Roblox platform status"))
    .addSubcommand((sub) =>
      sub
        .setName("groupinfo")
        .setDescription("Get Roblox group information")
        .addStringOption((opt) => opt.setName("query").setDescription("Group name or ID").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("gameinfo")
        .setDescription("Get Roblox game information")
        .addStringOption((opt) => opt.setName("query").setDescription("Game name or universe ID").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("assetinfo")
        .setDescription("Get Roblox asset information")
        .addStringOption((opt) => opt.setName("id").setDescription("Asset ID").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "userfromroblox") {
      const check = canRunSearch(interaction.user.id);
      if (!check.ok) {
        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle("Cooldown")
              .setDescription(`Please wait **${Math.ceil(check.remainingMs / 1000)}s** before searching again.`)
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (sub === "userfromroblox") {
      await interaction.deferReply();
      const query = interaction.options.getString("query", true).trim();
      const profile = await robloxAggregator.getFullUserProfile(query);
      if (!profile) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Could not find a Roblox account for that query.")]
        });
      }
      await incrementRequests();
      await startSession(interaction, profile, "Roblox query");
      return;
    }

    if (sub === "status") {
      await interaction.deferReply();
      const status = await robloxApi.getRobloxStatus();
      if (!status) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Unavailable").setDescription("Unable to fetch Roblox status right now.")]
        });
      }

      let updatedLine = "";
      if (status?.updated) {
        const t = Date.parse(status.updated);
        updatedLine = Number.isFinite(t)
          ? `Updated <t:${Math.floor(t / 1000)}:R>`
          : `Updated ${status.updated}`;
      }

      const categories =
        status.categories?.length ? status.categories : categoriesFromFlatComponents(status.components || []);

      const embed = baseEmbed()
        .setColor(statusEmbedColor(status))
        .setTitle("Roblox Status")
        .setURL("https://status.roblox.com");

      if (categories.length) {
        const headline = headlineFromOverall(status.overall);
        embed.setDescription(
          [`**${headline}**`, updatedLine ? `_${updatedLine}_` : null].filter(Boolean).join("\n")
        );
        for (const cat of categories.slice(0, 25)) {
          if (!cat.items?.length) continue;
          embed.addFields({
            name: `▾ ${cat.name}`,
            value: monospaceFieldValue(formatCategoryLines(cat.items)),
            inline: false
          });
        }
      } else {
        const lines = [
          status?.overall ? `**${headlineFromOverall(status.overall)}**` : null,
          updatedLine ? `_${updatedLine}_` : null,
          Number.isFinite(status?.incidentCount) ? `Incidents on page: **${status.incidentCount}**` : null
        ].filter(Boolean);
        embed.setDescription(lines.join("\n") || "No status data available.");
      }

      await incrementRequests();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "groupinfo") {
      await interaction.deferReply();
      const query = interaction.options.getString("query", true);
      const group = await robloxApi.resolveGroup(query);
      if (!group) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Group was not found.")]
        });
      }

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(group.name)
            .setURL(`https://www.roblox.com/groups/${group.id}`)
            .setDescription(group.description || "No description.")
            .addFields(
              { name: "Group ID", value: String(group.id), inline: true },
              { name: "Owner", value: group.owner?.username || "Unknown", inline: true },
              { name: "Members", value: formatCompactNumber(group.memberCount || 0), inline: true }
            )
        ]
      });
    }

    if (sub === "gameinfo") {
      await interaction.deferReply();
      const query = interaction.options.getString("query", true);
      const game = await robloxApi.resolveGame(query);
      if (!game) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Game was not found.")]
        });
      }

      const title = game.name || game.title || "Unknown";
      const universeId = game.id || game.universeId;
      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(title)
            .setURL(universeId ? `https://www.roblox.com/games/${universeId}` : "https://www.roblox.com/discover")
            .setDescription(game.description || "No description available.")
            .addFields(
              { name: "Universe ID", value: String(universeId || "Unknown"), inline: true },
              { name: "Creator", value: game.creatorName || game.creator?.name || "Unknown", inline: true },
              { name: "Visits", value: formatCompactNumber(game.visits || game.placeVisits || 0), inline: true }
            )
        ]
      });
    }

    if (sub === "assetinfo") {
      await interaction.deferReply();
      const id = interaction.options.getString("id", true).trim();
      const asset = await robloxApi.getAssetInfo(id);
      if (!asset) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Asset was not found.")]
        });
      }

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(asset.name || `Asset ${id}`)
            .setURL(`https://www.roblox.com/catalog/${id}`)
            .setDescription(asset.description || "No description.")
            .addFields(
              { name: "Asset ID", value: String(asset.id || id), inline: true },
              { name: "Creator", value: asset.creator?.name || "Unknown", inline: true },
              { name: "Price", value: String(asset.priceInRobux ?? "Offsale"), inline: true }
            )
        ]
      });
    }

    return interaction.reply({
      embeds: [baseEmbed().setTitle("Unknown subcommand").setDescription("This subcommand is not implemented.")],
      flags: MessageFlags.Ephemeral
    });
  }
};
