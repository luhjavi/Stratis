const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const { baseEmbed } = require("../constants/embed");
const { addBan, removeBan } = require("../services/banService");
const { isBotOwner } = require("../utils/authz");

function hasStaffRole(member) {
  return Boolean(member?.roles?.cache?.has(config.discord.staffRoleId));
}

function ensureAuthAllowed(interaction) {
  if (interaction.guildId !== config.discord.staffGuildId) {
    return "This command category is only available in the staff server.";
  }
  if (!hasStaffRole(interaction.member) && !isBotOwner(interaction.user?.id)) {
    return "You do not have permission to use this command.";
  }
  return null;
}

const listServerSessions = new Map();
const LIST_PAGE_SIZE = 5;

function buildListServerEmbed(page, totalPages, lines) {
  return baseEmbed()
    .setTitle(`Connected Servers (${page + 1}/${totalPages})`)
    .setDescription(lines.join("\n\n").slice(0, 3900) || "No guilds.");
}

function buildPagerRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("auth:listservers:prev")
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("auth:listservers:next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auth")
    .setDescription("Stratis Staff Commands")
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("leaveserver")
        .setDescription("Force the bot to leave a server")
        .addStringOption((opt) => opt.setName("serverid").setDescription("Target server ID").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("eval")
        .setDescription("Evaluate JavaScript code")
        .addStringOption((opt) => opt.setName("code").setDescription("Code to evaluate").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("listservers").setDescription("List servers the bot is currently in"))
    .addSubcommand((sub) =>
      sub
        .setName("banuser")
        .setDescription("Ban a user from using the bot")
        .addStringOption((opt) => opt.setName("userid").setDescription("Discord user ID").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("banserver")
        .setDescription("Ban a server from using the bot")
        .addStringOption((opt) => opt.setName("serverid").setDescription("Discord server ID").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unbanuser")
        .setDescription("Unban a user from using the bot")
        .addStringOption((opt) => opt.setName("userid").setDescription("Discord user ID").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unbanserver")
        .setDescription("Unban a server from using the bot")
        .addStringOption((opt) => opt.setName("serverid").setDescription("Discord server ID").setRequired(true))
    ),

  async execute(interaction) {
    const deny = ensureAuthAllowed(interaction);
    if (deny) {
      return interaction.reply({
        embeds: [baseEmbed().setTitle("Unauthorized").setDescription(deny)],
        flags: MessageFlags.Ephemeral
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "leaveserver") {
      const serverId = interaction.options.getString("serverid", true).trim();
      const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
      if (!guild) {
        return interaction.reply({
          embeds: [baseEmbed().setTitle("Not found").setDescription("I am not in that server.")],
          flags: MessageFlags.Ephemeral
        });
      }
      const name = guild.name;
      await guild.leave().catch(() => null);
      return interaction.reply({
        embeds: [baseEmbed().setTitle("Left server").setDescription(`Left **${name}** (\`${serverId}\`).`)],
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === "eval") {
      if (!isBotOwner(interaction.user.id)) {
        return interaction.reply({
          embeds: [baseEmbed().setTitle("Unauthorized").setDescription("Only the configured eval user can run this.")],
          flags: MessageFlags.Ephemeral
        });
      }
      const code = interaction.options.getString("code", true);
      try {
        // Intentionally restricted by Discord permissions + fixed user ID.
        const result = await eval(`(async()=>{${code}\n})()`);
        const text = String(result === undefined ? "undefined" : result).slice(0, 1900);
        return interaction.reply({
          embeds: [baseEmbed().setTitle("Eval result").setDescription("```js\n" + text + "\n```")],
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        return interaction.reply({
          embeds: [baseEmbed().setTitle("Eval error").setDescription("```js\n" + String(err).slice(0, 1900) + "\n```")],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (sub === "listservers") {
      const lines = await Promise.all(
        interaction.client.guilds.cache.map(async (g) => {
          const ownerId = g.ownerId || (await g.fetchOwner().then((o) => o.id).catch(() => null));
          const joinedUnix = g.joinedTimestamp ? Math.floor(g.joinedTimestamp / 1000) : null;
          const createdUnix = g.createdTimestamp ? Math.floor(g.createdTimestamp / 1000) : null;
          return [
            `**${g.name}**`,
            `ID: \`${g.id}\``,
            `Owner: ${ownerId ? `<@${ownerId}>` : "Unknown"}`,
            `Members: **${g.memberCount || 0}**`,
            `Joined: ${joinedUnix ? `<t:${joinedUnix}:F>` : "Unknown"}`,
            `Created: ${createdUnix ? `<t:${createdUnix}:F>` : "Unknown"}`
          ].join("\n");
        })
      );
      const pages = [];
      for (let i = 0; i < lines.length; i += LIST_PAGE_SIZE) {
        pages.push(lines.slice(i, i + LIST_PAGE_SIZE));
      }
      if (!pages.length) pages.push(["No guilds."]);
      const totalPages = pages.length;
      const page = 0;

      const msg = await interaction.reply({
        embeds: [buildListServerEmbed(page, totalPages, pages[page])],
        components: [buildPagerRow(page, totalPages)],
        flags: MessageFlags.Ephemeral,
        fetchReply: true
      });

      listServerSessions.set(msg.id, {
        userId: interaction.user.id,
        page: 0,
        totalPages,
        pages
      });
      setTimeout(() => listServerSessions.delete(msg.id), 10 * 60 * 1000);
      return;
    }

    if (sub === "banuser") {
      const userId = interaction.options.getString("userid", true).trim();
      const reason = interaction.options.getString("reason") || "";
      await addBan("user", userId, interaction.user.id, reason);
      return interaction.reply({
        embeds: [baseEmbed().setTitle("User banned").setDescription(`User \`${userId}\` is now blocked from bot usage.`)],
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === "banserver") {
      const serverId = interaction.options.getString("serverid", true).trim();
      const reason = interaction.options.getString("reason") || "";
      await addBan("server", serverId, interaction.user.id, reason);
      return interaction.reply({
        embeds: [
          baseEmbed().setTitle("Server banned").setDescription(`Server \`${serverId}\` is now blocked from bot usage.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === "unbanuser") {
      const userId = interaction.options.getString("userid", true).trim();
      const removed = await removeBan("user", userId);
      return interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle(removed ? "User unbanned" : "No ban found")
            .setDescription(removed ? `User \`${userId}\` can now use the bot.` : `User \`${userId}\` was not banned.`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === "unbanserver") {
      const serverId = interaction.options.getString("serverid", true).trim();
      const removed = await removeBan("server", serverId);
      return interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle(removed ? "Server unbanned" : "No ban found")
            .setDescription(
              removed ? `Server \`${serverId}\` can now use the bot.` : `Server \`${serverId}\` was not banned.`
            )
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

async function handleComponent(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("auth:listservers:")) return false;

  const session = listServerSessions.get(interaction.message.id);
  if (!session) {
    await interaction.reply({
      embeds: [baseEmbed().setTitle("Expired").setDescription("This list session has expired.")],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
  if (interaction.user.id !== session.userId) {
    await interaction.reply({
      embeds: [baseEmbed().setTitle("Unauthorized").setDescription("Only the command invoker can flip pages.")],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.customId.endsWith(":prev")) {
    session.page = Math.max(0, session.page - 1);
  } else if (interaction.customId.endsWith(":next")) {
    session.page = Math.min(session.totalPages - 1, session.page + 1);
  }

  await interaction.update({
    embeds: [buildListServerEmbed(session.page, session.totalPages, session.pages[session.page])],
    components: [buildPagerRow(session.page, session.totalPages)]
  });
  return true;
}

module.exports.handleComponent = handleComponent;
