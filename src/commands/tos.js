const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../constants/embed");

module.exports = {
  data: new SlashCommandBuilder().setName("tos").setDescription("View Stratis terms of service"),
  async execute(interaction) {
    return interaction.reply({
      embeds: [
        baseEmbed()
          .setTitle("Stratis Terms of Service")
          .setDescription(
            [
              "Use Stratis responsibly and follow Discord/Roblox terms.",
              "Do not abuse, spam, or attempt to disrupt bot services.",
              "Do not use the bot for harassment, fraud, or malicious automation.",
              "Violation of these terms may result in user or server bans from bot usage."
            ].join("\n")
          )
      ]
    });
  }
};
