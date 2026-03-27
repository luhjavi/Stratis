const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../constants/embed");

module.exports = {
  data: new SlashCommandBuilder().setName("privacy").setDescription("View Stratis privacy policy"),
  async execute(interaction) {
    return interaction.reply({
      embeds: [
        baseEmbed()
          .setTitle("Stratis Privacy Policy")
          .setDescription(
            [
              "Stratis processes command inputs to provide bot functionality.",
              "Temporary cache data may be stored (memory/MongoDB) and expires automatically.",
              "Server/user IDs may be stored for moderation and abuse prevention.",
              "No credential secrets are collected from end users via commands.",
              "By using the bot, you consent to this operational data usage."
            ].join("\n")
          )
      ]
    });
  }
};
