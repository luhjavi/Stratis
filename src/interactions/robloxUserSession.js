const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require("discord.js");
const { baseEmbed } = require("../constants/embed");
const robloxAggregator = require("../services/robloxAggregator");
const config = require("../config");
const { formatCompactNumber } = require("../utils/numberFormat");

const SESSION_TIMEOUT_MS = 30 * 1000;
const sessions = new Map();
const timers = new Map();

function presenceText(profile) {
  const p = profile.presence;
  if (!p) return `${config.emojis.offline} Offline`;
  if (p.userPresenceType === 2) {
    const gameName =
      profile.presenceGame?.name || p.lastLocation || (p.placeId ? `Experience (place ${p.placeId})` : null);
    return `${config.emojis.playing} Playing ${gameName || "a game"}`;
  }
  if (p.userPresenceType === 3) {
    return `${config.emojis.studio} Roblox Studio ${profile.presenceGame?.name || p.lastLocation || ""}`.trim();
  }
  if (p.userPresenceType === 1) return `${config.emojis.online} Online`;
  return `${config.emojis.offline} Offline`;
}

function emailVerifiedLabel(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not verifiable";
}

function formatRolimonsNumber(rs) {
  if (!rs || !Number.isFinite(Number(rs.rap)) || !Number.isFinite(Number(rs.value))) {
    return { rap: "Unavailable", value: "Unavailable" };
  }
  return {
    rap: formatCompactNumber(Number(rs.rap)),
    value: formatCompactNumber(Number(rs.value))
  };
}

function truncateText(value, max) {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function chunk(items, size) {
  if (!items?.length) return [];
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildViewEmbed(state) {
  const profile = state.profile;
  const { user } = profile;
  const status = presenceText(profile);

  const embed = baseEmbed()
    .setTitle(`${user.displayName} (@${user.name})`)
    .setURL(`https://www.roblox.com/users/${user.id}/profile`)
    .setAuthor({
      name: status
    })
    .setFooter({
      text: `View: ${state.view} | Source: \`${state.sourceText}\` | Cache: ${profile.fromCache ? "Cached" : "Live Fetch"}`
    });

  if (state.view === "profile") {
    const premium = config.emojis.premium ? ` ${config.emojis.premium}` : "";
    const badgesCount = profile.badges?.length || 0;
    const badgesDisplay = `${config.emojis.friendshipBadge ? `${config.emojis.friendshipBadge} ` : ""}${formatCompactNumber(
      badgesCount
    )}`;
    const universeId = profile.presenceGame?.id || profile.presenceGame?.universeId;
    const rm = formatRolimonsNumber(profile.rolimonsStats);
    const lastKnownGame =
      profile.presenceGame?.name && universeId
        ? `[${profile.presenceGame.name}](https://www.roblox.com/games/${universeId})`
        : profile.presenceGame?.name
          ? profile.presenceGame.name
          : "None";
    const lastOnline = profile.presence?.lastOnline
      ? new Date(profile.presence.lastOnline).toLocaleString()
      : "Unknown";

    embed
      .setDescription(
        [
          `${user.name} (@${user.name})${premium}`.trim(),
          `${formatCompactNumber(profile.friendCounts.friends)} Friends | ${formatCompactNumber(profile.friendCounts.followers)} Followers | ${formatCompactNumber(profile.friendCounts.following)} Following`,
          truncateText(user.description ? user.description : "No profile description.", 300)
        ].join("\n")
      )
      .addFields(
        {
          name: "ID",
          value: `\`${user.id}\``,
          inline: true
        },
        {
          name: "Email Verified",
          value: `\`${emailVerifiedLabel(profile.emailVerified)}\``,
          inline: true
        },
        {
          name: "Inventory",
          value: `\`${profile.canViewInventory === null ? "Unknown" : profile.canViewInventory ? "Public" : "Private"}\``,
          inline: true
        },
        {
          name: "RAP",
          value: `\`${rm.rap}\``,
          inline: true
        },
        {
          name: "Value",
          value: `\`${rm.value}\``,
          inline: true
        },
        {
          name: "Visits",
          value: `\`${formatCompactNumber(profile.totalVisits)}\``,
          inline: true
        },
        {
          name: "Created",
          value: `\`${new Date(user.created).toLocaleString()}\``,
          inline: true
        },
        {
          name: "Last Online",
          value: `\`${lastOnline}\``,
          inline: true
        },
        {
          name: "Badges",
          value: badgesDisplay,
          inline: true
        },
        {
          name: "Last Known Game",
          value: lastKnownGame,
          inline: false
        },
        {
          name: "Account Status",
          value: `\`${user.isBanned ? "Terminated / Banned" : "Active"}\``,
          inline: true
        },
        {
          name: "Rolimon's",
          value: profile.rolimonsStats
            ? `[Profile](${profile.rolimonsStats.profileUrl}) | [Trade Ads](${profile.rolimonsStats.tradeAdsUrl})`
            : "Unavailable",
          inline: false
        }
      );
    if (profile.avatarUrl) embed.setThumbnail(profile.avatarUrl);
    return embed;
  }

  if (state.view === "avatar") {
    embed.setDescription(`[Roblox Profile](https://www.roblox.com/users/${user.id}/profile)`);
    if (profile.avatarBustUrl) embed.setThumbnail(profile.avatarBustUrl);
    if (profile.avatarFullBodyUrl) embed.setImage(profile.avatarFullBodyUrl);
    return embed;
  }

  if (state.view === "groups") {
    const pages = chunk(profile.groups, 1);
    const page = Math.min(state.groupPage, Math.max(0, pages.length - 1));
    const item = pages[page]?.[0];
    if (!item) {
      embed.setDescription("No groups found.");
      return embed;
    }
    embed
      .setTitle(`${user.name}'s Joined Groups (${profile.groups.length})`)
      .setDescription(
        [
          `**[${item.group.name}](https://www.roblox.com/groups/${item.group.id})**`,
          `Role: ${item.role.name}`,
          `Role ID: ${item.role.id}`,
          `Group ID: ${item.group.id}`
        ].join("\n")
      )
      .setFooter({ text: `Groups ${page + 1}/${pages.length}` });
    return embed;
  }

  if (state.view === "games") {
    const pages = chunk(profile.places, 1);
    const page = Math.min(state.gamePage, Math.max(0, pages.length - 1));
    const item = pages[page]?.[0];
    if (!item) {
      embed.setDescription("No created games found.");
      return embed;
    }
    embed
      .setTitle(`${user.name}'s Created Games (${profile.places.length})`)
      .setDescription(
        [
          `**[${item.name}](https://www.roblox.com/games/${item.rootPlace?.id || item.id})**`,
          `Universe ID: ${item.id}`,
          `Root Place ID: ${item.rootPlace?.id || "Unknown"}`,
          `Visits: ${item.placeVisits || 0}`
        ].join("\n")
      )
      .setFooter({ text: `Games ${page + 1}/${pages.length}` });
    return embed;
  }

  if (state.view === "wearing") {
    const wearing = profile.currentlyWearing;
    const assetIds = wearing?.assetIds || [];
    const itemLinks = profile.wearingAssetDetails?.length
      ? profile.wearingAssetDetails
          .map((item) => `[${item.name || item.id}](https://www.roblox.com/catalog/${item.id})`)
          .join(", ")
      : "No public outfit data.";
    embed
      .setTitle(`${user.name}'s Currently Wearing`)
      .setDescription(
        [
          `Assets: ${assetIds.length}`,
          truncateText(itemLinks, 3500)
        ].join("\n")
      );
    if (profile.avatarBustUrl) embed.setThumbnail(profile.avatarBustUrl);
    return embed;
  }

  embed.setDescription("Unknown view");
  return embed;
}

function buildComponents(state, disabled = false) {
  const select = new StringSelectMenuBuilder()
    .setCustomId("rbxu:menu")
    .setPlaceholder("Select view")
    .setDisabled(disabled)
    .addOptions(
      { label: "User Profile", value: "profile", default: state.view === "profile" },
      { label: "Avatar", value: "avatar", default: state.view === "avatar" },
      { label: "Groups", value: "groups", default: state.view === "groups" },
      { label: "Games", value: "games", default: state.view === "games" },
      { label: "Currently Wearing", value: "wearing", default: state.view === "wearing" }
    );

  const row1 = new ActionRowBuilder().addComponents(select);
  const row2 = new ActionRowBuilder();
  if (state.view === "groups" || state.view === "games") {
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId("rbxu:prev")
        .setLabel("Prev")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId("rbxu:next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }

  row2.addComponents(
    new ButtonBuilder()
      .setCustomId("rbxu:refresh")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );

  return [row1, row2];
}

async function disableSession(messageId) {
  const state = sessions.get(messageId);
  if (!state) return;
  sessions.delete(messageId);
  timers.delete(messageId);
  await state.message.edit({
    embeds: [buildViewEmbed(state)],
    components: buildComponents(state, true)
  });
}

function bumpSessionTimer(messageId) {
  const old = timers.get(messageId);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    disableSession(messageId).catch(() => null);
  }, SESSION_TIMEOUT_MS);
  timers.set(messageId, timer);
}

async function startSession(interaction, profile, sourceText) {
  const state = {
    ownerId: interaction.user.id,
    userId: String(profile.user.id),
    sourceText,
    profile,
    view: "profile",
    groupPage: 0,
    gamePage: 0,
    message: null
  };

  const message = await interaction.editReply({
    embeds: [buildViewEmbed(state)],
    components: buildComponents(state, false),
    fetchReply: true
  });
  state.message = message;
  sessions.set(message.id, state);
  bumpSessionTimer(message.id);
}

function movePage(state, direction) {
  if (state.view === "groups") {
    const max = Math.max(0, chunk(state.profile.groups, 1).length - 1);
    state.groupPage = Math.max(0, Math.min(max, state.groupPage + direction));
  }
  if (state.view === "games") {
    const max = Math.max(0, chunk(state.profile.places, 1).length - 1);
    state.gamePage = Math.max(0, Math.min(max, state.gamePage + direction));
  }
}

async function handleComponent(interaction) {
  if (!interaction.customId.startsWith("rbxu:")) return false;
  const messageId = interaction.message.id;
  const state = sessions.get(messageId);
  if (!state) {
    await interaction.reply({
      embeds: [baseEmbed().setTitle("Expired").setDescription("This panel expired. Run the command again.")],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.user.id !== state.ownerId) {
    await interaction.reply({
      embeds: [baseEmbed().setTitle("Not your panel").setDescription("Only the command author can control this panel.")],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    state.view = interaction.values[0];
  } else if (interaction.customId === "rbxu:prev") {
    movePage(state, -1);
  } else if (interaction.customId === "rbxu:next") {
    movePage(state, 1);
  } else if (interaction.customId === "rbxu:refresh") {
    state.profile = await robloxAggregator.getFullUserProfileById(state.userId, true);
  }

  bumpSessionTimer(messageId);
  await interaction.update({
    embeds: [buildViewEmbed(state)],
    components: buildComponents(state, false)
  });
  return true;
}

module.exports = {
  startSession,
  handleComponent
};
