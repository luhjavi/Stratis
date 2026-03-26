const { EmbedBuilder } = require("discord.js");
const config = require("../config");

function baseEmbed() {
  return new EmbedBuilder().setColor(config.bot.embedColor).setTimestamp();
}

module.exports = {
  baseEmbed
};
