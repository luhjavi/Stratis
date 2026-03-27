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
  bot: {
    searchCooldownMs: 15000,
    embedColor: 0x111318
  },
  emojis: {
    premium: process.env.EMOJI_PREMIUM || "",
    friendshipBadge: process.env.EMOJI_FRIENDSHIP_BADGE || "",
    online: process.env.EMOJI_ONLINE || "🟢",
    offline: process.env.EMOJI_OFFLINE || "⚫",
    studio: process.env.EMOJI_STUDIO || "🛠️",
    playing: process.env.EMOJI_PLAYING || "🎮"
  }
};
