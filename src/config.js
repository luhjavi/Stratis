require("dotenv").config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
    invitePermissions: process.env.BOT_INVITE_PERMISSIONS || "274878221376"
  },
  mongo: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/stratis"
  },
  roblox: {
    cookie: process.env.ROBLOX_COOKIE || null
  },
  bloxlink: {
    token: process.env.BLOXLINK_API_TOKEN || null
  },
  bot: {
    searchCooldownMs: 15000,
    embedColor: 0x111318
  }
};
