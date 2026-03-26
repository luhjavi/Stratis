const config = require("../config");

const searchCooldowns = new Map();

function canRunSearch(userId) {
  const now = Date.now();
  const last = searchCooldowns.get(userId) || 0;
  const remaining = config.bot.searchCooldownMs - (now - last);

  if (remaining > 0) {
    return { ok: false, remainingMs: remaining };
  }

  searchCooldowns.set(userId, now);
  return { ok: true, remainingMs: 0 };
}

module.exports = { canRunSearch };
