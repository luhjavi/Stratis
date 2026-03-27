const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { baseEmbed } = require("../constants/embed");
const { canRunSearch } = require("../utils/cooldown");
const RequestStat = require("../database/models/RequestStat");
const robloxApi = require("../services/robloxApi");
const robloxAggregator = require("../services/robloxAggregator");
const { startSession } = require("../interactions/robloxUserSession");
const { formatCompactNumber } = require("../utils/numberFormat");
const { getCommandCache, setCommandCache } = require("../services/profileCache");

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

const MARKETPLACE_ALLOWED_ASSET_TYPES = new Set([
  2, // T-Shirt
  8, // Hat
  11, // Shirt
  12, // Pants
  17, // Head
  18, // Face
  19, // Gear
  24, // Animation
  41, // Hair Accessory
  42, // Face Accessory
  43, // Neck Accessory
  44, // Shoulder Accessory
  45, // Front Accessory
  46, // Back Accessory
  47, // Waist Accessory
  61, // Emote
  64, // Dynamic Head
  65, // Eyebrow Accessory
  66, // Eyelash Accessory
  67, // Mood Animation
  68, // Dynamic Face
  69, // Ear Accessory
  70 // Misc wearable types
]);

function toIsoTimestamp(value) {
  const t = Date.parse(String(value || ""));
  if (!Number.isFinite(t)) return String(value || "Unknown");
  return new Date(t).toISOString().slice(0, 19) + "Z";
}

function cacheAuthorText(source, fromCache, fetchedAt) {
  void fetchedAt;
  return `Source: ${source} | Cache: ${fromCache ? "Cached" : "Live Fetch"}`;
}

function assetCreatorLabel(asset) {
  const creator = asset?.Creator || asset?.creator;
  if (!creator) return "Unknown";
  const name = creator.Name || creator.name || "Unknown";
  const type = creator.CreatorType || creator.creatorType || "User";
  const targetId = creator.CreatorTargetId || creator.creatorTargetId || creator.Id || creator.id;
  if (!targetId) return name;
  if (String(type).toLowerCase() === "group") {
    return `[${name}](https://www.roblox.com/groups/${targetId})`;
  }
  return `[${name}](https://www.roblox.com/users/${targetId}/profile)`;
}

function gameCreatorLabel(game) {
  const creator = game?.creator;
  if (!creator) return "Unknown";
  const name = creator.name || "Unknown";
  const id = creator.id;
  if (!id) return name;
  if (String(creator.type).toLowerCase() === "group") {
    return `[${name}](https://www.roblox.com/groups/${id})`;
  }
  return `[${name}](https://www.roblox.com/users/${id}/profile)`;
}

function isMarketplaceAsset(asset) {
  const typeId = Number(asset?.AssetTypeId ?? asset?.assetTypeId ?? asset?.assetType);
  if (!Number.isFinite(typeId)) return false;
  return MARKETPLACE_ALLOWED_ASSET_TYPES.has(typeId);
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
    )
    .addSubcommand((sub) =>
      sub
        .setName("iteminfo")
        .setDescription("Get Roblox marketplace item information by name or ID")
        .addStringOption((opt) => opt.setName("query").setDescription("Item name or item ID").setRequired(true))
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
      const cacheKey = `groupinfo:${query.trim().toLowerCase()}`;
      let cached = await getCommandCache(cacheKey);
      let fromCache = Boolean(cached);
      if (!cached) {
        const group = await robloxApi.resolveGroup(query);
        if (!group) {
          return interaction.editReply({
            embeds: [baseEmbed().setTitle("Not found").setDescription("Group was not found.")]
          });
        }
        const [iconUrl, bannerUrl] = await Promise.all([
          robloxApi.getGroupIcon(group.id),
          robloxApi.getGroupBanner(group.id)
        ]);
        cached = {
          source: "Roblox APIs",
          fetchedAt: Date.now(),
          group,
          iconUrl,
          bannerUrl
        };
        await setCommandCache(cacheKey, cached, 5 * 60 * 1000);
      }

      const group = cached.group;
      if (!group) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Group was not found.")]
        });
      }

      const owner = group.owner?.userId
        ? `[${group.owner?.username || "Unknown"}](https://www.roblox.com/users/${group.owner.userId}/profile)`
        : (group.owner?.username || "Unknown");

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(group.name)
            .setURL(`https://www.roblox.com/groups/${group.id}`)
            .setDescription(group.description || "No description.")
            .setFooter({ text: cacheAuthorText(cached.source || "Roblox APIs", fromCache, cached.fetchedAt) })
            .setThumbnail(cached.iconUrl || null)
            .setImage(cached.bannerUrl || null)
            .addFields(
              { name: "Group ID", value: String(group.id), inline: true },
              { name: "Owner", value: owner, inline: true },
              { name: "Members", value: formatCompactNumber(group.memberCount || 0), inline: true },
              { name: "Created", value: toIsoTimestamp(group.created), inline: true }
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
      const [votes, iconUrl, placeDetails] = await Promise.all([
        universeId ? robloxApi.getGameVotes(universeId) : Promise.resolve(null),
        universeId ? robloxApi.getGameIcon(universeId) : Promise.resolve(null),
        game.rootPlaceId ? robloxApi.getPlaceDetails([game.rootPlaceId]).catch(() => []) : Promise.resolve([])
      ]);
      const place = placeDetails?.[0] || null;
      const up = Number(votes?.upVotes || 0);
      const down = Number(votes?.downVotes || 0);
      const totalVotes = up + down;
      const likeRatio = totalVotes > 0 ? `${((up / totalVotes) * 100).toFixed(1)}%` : "Unknown";
      const supportedDevices = Array.isArray(place?.supportedDevices)
        ? place.supportedDevices.join(", ")
        : (Array.isArray(game?.supportedDevices) ? game.supportedDevices.join(", ") : "Not publicly exposed");
      const vcSupport =
        typeof place?.voiceChatEnabled === "boolean"
          ? (place.voiceChatEnabled ? "Yes" : "No")
          : (typeof game?.voiceChatEnabled === "boolean" ? (game.voiceChatEnabled ? "Yes" : "No") : "Unknown");

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(title)
            .setURL(universeId ? `https://www.roblox.com/games/${universeId}` : "https://www.roblox.com/discover")
            .setDescription(game.description || "No description available.")
            .setThumbnail(iconUrl || null)
            .addFields(
              { name: "Universe ID", value: String(universeId || "Unknown"), inline: true },
              { name: "Creator", value: gameCreatorLabel(game), inline: true },
              { name: "Visits", value: formatCompactNumber(game.visits || game.placeVisits || 0), inline: true },
              { name: "Favorites", value: formatCompactNumber(game.favoritedCount || 0), inline: true },
              { name: "Likes / Dislikes", value: `${formatCompactNumber(up)} / ${formatCompactNumber(down)}`, inline: true },
              { name: "Like Ratio", value: likeRatio, inline: true },
              { name: "VC Support", value: vcSupport, inline: true },
              { name: "Server Size", value: String(game.maxPlayers || "Unknown"), inline: true },
              { name: "Supported Devices", value: supportedDevices, inline: true },
              { name: "Created", value: toIsoTimestamp(game.created), inline: true },
              { name: "Updated", value: toIsoTimestamp(game.updated), inline: true }
            )
        ]
      });
    }

    if (sub === "assetinfo") {
      await interaction.deferReply();
      const id = interaction.options.getString("id", true).trim();
      const cacheKey = `assetinfo:${id}`;
      let cached = await getCommandCache(cacheKey);
      let fromCache = Boolean(cached);
      if (!cached) {
        const asset = await robloxApi.getAssetInfo(id);
        const thumbnailUrl = asset ? await robloxApi.getAssetThumbnail(asset.AssetId || id) : null;
        cached = {
          source: "Roblox APIs",
          fetchedAt: Date.now(),
          asset,
          thumbnailUrl
        };
        if (asset) {
          await setCommandCache(cacheKey, cached, 5 * 60 * 1000);
        }
      }
      const asset = cached.asset;
      if (!asset) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Asset was not found.")]
        });
      }
      if (!isMarketplaceAsset(asset)) {
        return interaction.editReply({
          embeds: [
            baseEmbed()
              .setTitle("Unsupported Asset Type")
              .setDescription(
                "This command is now filtered to marketplace wearable/clothing/accessory-style items. Use `/roblox iteminfo` for broader item lookups."
              )
          ]
        });
      }

      const assetId = asset.AssetId || asset.id || id;
      const isTradeable =
        Boolean(asset.IsLimited) ||
        Boolean(asset.IsLimitedUnique) ||
        Boolean(asset.CollectiblesItemDetails?.IsLimited);
      const price =
        asset.PriceInRobux ?? asset.CollectiblesItemDetails?.CollectibleLowestResalePrice ?? "Offsale";
      const creatorLabel = assetCreatorLabel(asset);

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(asset.Name || asset.name || `Asset ${id}`)
            .setURL(`https://www.roblox.com/catalog/${assetId}`)
            .setDescription(asset.Description || asset.description || "No description.")
            .setFooter({ text: cacheAuthorText(cached.source || "Roblox APIs", fromCache, cached.fetchedAt) })
            .setThumbnail(cached.thumbnailUrl || null)
            .addFields(
              { name: "Asset ID", value: String(assetId), inline: true },
              { name: "Type ID", value: String(asset.AssetTypeId ?? asset.assetTypeId ?? "Unknown"), inline: true },
              { name: "Creator / Publisher", value: creatorLabel, inline: true },
              { name: "Tradeable", value: isTradeable ? "Yes" : "No", inline: true },
              { name: "Price", value: String(price), inline: true },
              { name: "Created", value: toIsoTimestamp(asset.Created), inline: true },
              { name: "Updated", value: toIsoTimestamp(asset.Updated), inline: true }
            )
        ]
      });
    }

    if (sub === "iteminfo") {
      await interaction.deferReply();
      const query = interaction.options.getString("query", true).trim();
      const cacheKey = `iteminfo:${query.toLowerCase()}`;
      let cached = await getCommandCache(cacheKey);
      let fromCache = Boolean(cached);

      if (!cached) {
        let asset = null;
        let source = "Roblox APIs";

        if (/^\d+$/.test(query)) {
          asset = await robloxApi.getAssetInfo(query);
        } else {
          const results = await robloxApi.searchCatalogItemsByKeyword(query, 10);
          const firstAsset = results.find((x) => String(x.itemType).toLowerCase() === "asset") || results[0];
          if (firstAsset?.id) {
            asset = await robloxApi.getAssetInfo(firstAsset.id);
          }
        }

        if (!asset) {
          return interaction.editReply({
            embeds: [baseEmbed().setTitle("Not found").setDescription("No marketplace item matched that query.")]
          });
        }

        const assetId = asset.AssetId || asset.id;
        const [thumbnailUrl, rolimonsItemData] = await Promise.all([
          robloxApi.getAssetThumbnail(assetId),
          robloxApi.getRolimonsItemDetails().catch(() => null)
        ]);
        const rolimons = robloxApi.getRolimonsValueForAsset(rolimonsItemData, assetId);
        if (rolimons) source = "Roblox APIs + Rolimons";

        cached = {
          source,
          fetchedAt: Date.now(),
          asset,
          thumbnailUrl,
          rolimons
        };
        await setCommandCache(cacheKey, cached, 5 * 60 * 1000);
      }

      const asset = cached.asset;
      const assetId = asset.AssetId || asset.id;
      const itemUrl = `https://www.roblox.com/catalog/${assetId}`;
      const creatorLabel = assetCreatorLabel(asset);
      const isTradeable =
        Boolean(asset.IsLimited) ||
        Boolean(asset.IsLimitedUnique) ||
        Boolean(asset.CollectiblesItemDetails?.IsLimited);
      const copies = asset.CollectiblesItemDetails?.TotalQuantity ?? asset.Remaining ?? null;
      const price =
        asset.PriceInRobux ??
        asset.CollectiblesItemDetails?.CollectibleLowestResalePrice ??
        asset.LowestPrice ??
        "Offsale";
      const rapLabel =
        Number.isFinite(cached?.rolimons?.rap) ? formatCompactNumber(cached.rolimons.rap) : "Unavailable";
      const valueLabel =
        Number.isFinite(cached?.rolimons?.value) ? formatCompactNumber(cached.rolimons.value) : "Unavailable";

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(asset.Name || asset.name || `Item ${assetId}`)
            .setURL(itemUrl)
            .setDescription((asset.Description || asset.description || "No description.").slice(0, 1000))
            .setFooter({ text: cacheAuthorText(cached.source || "Roblox APIs", fromCache, cached.fetchedAt) })
            .setThumbnail(cached.thumbnailUrl || null)
            .addFields(
              { name: "Item", value: `[Open in Marketplace](${itemUrl})`, inline: true },
              { name: "Item ID", value: String(assetId), inline: true },
              { name: "Type ID", value: String(asset.AssetTypeId ?? asset.assetTypeId ?? "Unknown"), inline: true },
              { name: "Creator / Publisher", value: creatorLabel, inline: true },
              { name: "Tradeable", value: isTradeable ? "Yes" : "No", inline: true },
              { name: "Price", value: String(price), inline: true },
              { name: "RAP", value: rapLabel, inline: true },
              { name: "Rolimon Value", value: valueLabel, inline: true },
              { name: "Copies", value: copies == null ? "Unknown" : formatCompactNumber(copies), inline: true },
              { name: "Created", value: toIsoTimestamp(asset.Created), inline: true },
              { name: "Updated", value: toIsoTimestamp(asset.Updated), inline: true }
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
