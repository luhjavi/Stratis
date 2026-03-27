require("dotenv").config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
    invitePermissions: process.env.BOT_INVITE_PERMISSIONS || "274878221376",
    staffGuildId: process.env.STAFF_GUILD_ID || "1194334267275227247",
    staffRoleId: process.env.STAFF_ROLE_ID || "1227814787350790207",
    guildLogChannelId: process.env.GUILD_LOG_CHANNEL_ID || "1227814932062539807",
    evalUserId: process.env.AUTH_EVAL_USER_ID || "178341103139946497"
  },
  mongo: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/stratis"
  },
  roblox: {
    cookie: process.env.ROBLOX_COOKIE || null
  },
  bot: {
    searchCooldownMs: 15000,
    embedColor: 0x111318,
    userBanMessage:
      process.env.BAN_USER_MESSAGE || "You are banned from using this bot. If you believe this is a mistake, contact support.",
    serverBanMessage:
      process.env.BAN_SERVER_MESSAGE ||
      "This server is banned from using this bot. If you believe this is a mistake, contact support."
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
