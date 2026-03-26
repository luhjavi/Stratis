const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../constants/embed");
const { canRunSearch } = require("../utils/cooldown");
const RequestStat = require("../database/models/RequestStat");
const robloxApi = require("../services/robloxApi");
const robloxAggregator = require("../services/robloxAggregator");
const bloxlinkApi = require("../services/bloxlinkApi");

async function incrementRequests() {
  await RequestStat.findOneAndUpdate({ key: "totalRequests" }, { $inc: { count: 1 } }, { upsert: true });
}

function listOrFallback(items, mapper, fallback = "None") {
  if (!items?.length) return fallback;
  return items.map(mapper).slice(0, 10).join("\n");
}

function buildUserEmbed(profile, sourceText) {
  const { user, avatarUrl, usernameHistory, friendCounts, groups, places, socialLinks } = profile;
  const embed = baseEmbed()
    .setTitle(`${user.displayName} (@${user.name})`)
    .setURL(`https://www.roblox.com/users/${user.id}/profile`)
    .setDescription(
      [
        `**Account ID:** ${user.id}`,
        `**Created:** ${new Date(user.created).toLocaleString()}`,
        `**Source:** ${sourceText}`,
        `**Status:** ${user.isBanned ? "Terminated / Banned" : "Active"}`
      ].join("\n")
    )
    .addFields(
      {
        name: "Names",
        value: [
          `Current Username: \`${user.name}\``,
          `Display Name: \`${user.displayName}\``,
          `Previous: ${listOrFallback(usernameHistory, (x) => `\`${x.name}\``)}`
        ].join("\n"),
        inline: false
      },
      {
        name: "Social Graph",
        value: `Friends: **${friendCounts.friends}**\nFollowers: **${friendCounts.followers}**\nFollowing: **${friendCounts.following}**`,
        inline: true
      },
      {
        name: "Groups / Rank",
        value: listOrFallback(
          groups,
          (g) => `[${g.group.name}](https://www.roblox.com/groups/${g.group.id}) - ${g.role.name}`
        ),
        inline: true
      },
      {
        name: "Created Places",
        value: listOrFallback(
          places,
          (p) => `[${p.name}](https://www.roblox.com/games/${p.rootPlace?.id || p.id})`
        ),
        inline: false
      },
      {
        name: "Connected Social Links",
        value: listOrFallback(socialLinks, (s) => `[${s.title || s.type}](${s.url})`),
        inline: false
      }
    );

  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
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
    .addSubcommand((sub) =>
      sub
        .setName("userfromdiscord")
        .setDescription("Search by Discord user and linked Roblox account")
        .addStringOption((opt) =>
          opt.setName("discord").setDescription("Discord username or ID / snowflake").setRequired(true)
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

    if (sub === "userfromroblox" || sub === "userfromdiscord") {
      const check = canRunSearch(interaction.user.id);
      if (!check.ok) {
        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle("Cooldown")
              .setDescription(`Please wait **${Math.ceil(check.remainingMs / 1000)}s** before searching again.`)
          ],
          ephemeral: true
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
      return interaction.editReply({ embeds: [buildUserEmbed(profile, "Roblox query")] });
    }

    if (sub === "userfromdiscord") {
      await interaction.deferReply();
      const discordInput = interaction.options.getString("discord", true).trim();
      const extracted = discordInput.replace(/[<@!>]/g, "");
      const linkedRobloxId = await bloxlinkApi.getLinkedRobloxFromDiscord(extracted);

      if (!linkedRobloxId) {
        return interaction.editReply({
          embeds: [
            baseEmbed()
              .setTitle("No linked Roblox account found")
              .setDescription("Could not resolve this Discord account through Bloxlink.")
          ]
        });
      }

      const profile = await robloxAggregator.getFullUserProfile(linkedRobloxId);
      if (!profile) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("Linked Roblox account could not be resolved.")]
        });
      }

      await incrementRequests();
      return interaction.editReply({
        embeds: [buildUserEmbed(profile, `Discord lookup (${discordInput})`)]
      });
    }

    if (sub === "status") {
      await interaction.deferReply();
      const status = await robloxApi.getRobloxStatus();
      if (!status) {
        return interaction.editReply({
          embeds: [baseEmbed().setTitle("Unavailable").setDescription("Unable to fetch Roblox status right now.")]
        });
      }

      const value = (status?.components || [])
        .slice(0, 12)
        .map((c) => `- **${c.name}**: ${c.status}`)
        .join("\n");

      await incrementRequests();
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle("Roblox Status")
            .setURL("https://status.roblox.com")
            .setDescription(value || "No component data available.")
        ]
      });
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
              { name: "Members", value: String(group.memberCount || 0), inline: true }
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
              { name: "Visits", value: String(game.visits || game.placeVisits || 0), inline: true }
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
      ephemeral: true
    });
  }
};
