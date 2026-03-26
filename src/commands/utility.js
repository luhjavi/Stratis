const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { baseEmbed } = require("../constants/embed");

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
      return interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle("Pong")
            .setDescription(`Gateway ping: **${interaction.client.ws.ping}ms**`)
        ],
        ephemeral: true
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
        ephemeral: true
      });
    }

    if (sub === "invitebot") {
      const link = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&permissions=${config.discord.invitePermissions}&scope=bot%20applications.commands`;
      return interaction.reply({
        embeds: [baseEmbed().setTitle("Invite Stratis").setDescription(`[Click here to invite the bot](${link})`)],
        ephemeral: true
      });
    }
  }
};
