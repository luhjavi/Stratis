const config = require("../config");

function isBotOwner(userId) {
  if (!userId) return false;
  return String(userId) === String(config.discord.evalUserId);
}

module.exports = { isBotOwner };
