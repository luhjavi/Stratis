const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const mongoose = require("mongoose");
const config = require("../config");
const { baseEmbed } = require("../constants/embed");

function latencyEmoji(ms) {
  if (ms === null || ms === undefined) return "⚠️";
  if (ms < 150) return "🟢";
  if (ms < 300) return "🟡";
  return "⚠️";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("utility")
    .setDescription("Utility commands")
    .addSubcommand((sub) => sub.setName("ping").setDescription("Check bot latency"))
    .addSubcommand((sub) => sub.setName("shard").setDescription("Get shard and cluster info"))
    .addSubcommand((sub) => sub.setName("invitebot").setDescription("Get bot invite URL")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "ping") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const apiLatency = Date.now() - interaction.createdTimestamp;
      const gatewayPing = interaction.client.ws.ping;
      const uptimeMs = Math.floor(process.uptime() * 1000);
      const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const shardLatency = interaction.guild?.shardId !== undefined ? gatewayPing : null;

      let dbLatency = null;
      try {
        const dbStart = Date.now();
        if (mongoose.connection?.db) {
          await mongoose.connection.db.admin().ping();
          dbLatency = Date.now() - dbStart;
        }
      } catch {
        dbLatency = null;
      }

      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle("Latency Metrics")
            .addFields(
              {
                name: "Discord API Latency",
                value: `${latencyEmoji(apiLatency)} **${apiLatency}ms**`,
                inline: true
              },
              {
                name: "Gateway Ping",
                value: `${latencyEmoji(gatewayPing)} **${gatewayPing}ms**`,
                inline: true
              },
              {
                name: "Shard Latency",
                value:
                  shardLatency === null
                    ? "⚠️ **Unavailable**"
                    : `${latencyEmoji(shardLatency)} **${shardLatency}ms**`,
                inline: true
              },
              {
                name: "Database Ping",
                value:
                  dbLatency === null
                    ? "⚠️ **Unavailable**"
                    : `${latencyEmoji(dbLatency)} **${dbLatency}ms**`,
                inline: true
              },
              {
                name: "Process Uptime",
                value: `**${Math.floor(uptimeMs / 1000)}s**`,
                inline: true
              },
              {
                name: "Memory Usage",
                value: `**${memoryMb} MB RSS**`,
                inline: true
              }
            )
        ]
      });
    }

    if (sub === "shard") {
      const shardId = interaction.guild ? interaction.guild.shardId : 0;
      return interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle("Shard Info")
            .setDescription(
              [
                `Shard ID: **${shardId}**`,
                `Shard Count: **${interaction.client.shard?.count || 1}**`,
                `Guilds (this shard): **${interaction.client.guilds.cache.size}**`
              ].join("\n")
            )
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (sub === "invitebot") {
      const link = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=${config.discord.invitePermissions}&scope=bot%20applications.commands`;
      return interaction.reply({
        embeds: [baseEmbed().setTitle("Invite Stratis").setDescription(`[Click here to invite the bot](${link})`)],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
