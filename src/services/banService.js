const mongoose = require("mongoose");
const BotBan = require("../database/models/BotBan");

async function addBan(scope, targetId, createdBy = null, reason = "") {
  if (!targetId) return null;
  if (mongoose.connection.readyState !== 1) return null;
  return BotBan.findOneAndUpdate(
    { scope, targetId: String(targetId) },
    { $set: { createdBy: createdBy ? String(createdBy) : null, reason: reason || "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).catch(() => null);
}

async function removeBan(scope, targetId) {
  if (!targetId) return false;
  if (mongoose.connection.readyState !== 1) return false;
  const res = await BotBan.deleteOne({ scope, targetId: String(targetId) }).catch(() => null);
  return Boolean(res?.deletedCount);
}

async function isUserBanned(userId) {
  if (!userId || mongoose.connection.readyState !== 1) return false;
  const row = await BotBan.findOne({ scope: "user", targetId: String(userId) }).lean().catch(() => null);
  return Boolean(row);
}

async function isServerBanned(guildId) {
  if (!guildId || mongoose.connection.readyState !== 1) return false;
  const row = await BotBan.findOne({ scope: "server", targetId: String(guildId) }).lean().catch(() => null);
  return Boolean(row);
}

module.exports = { addBan, removeBan, isUserBanned, isServerBanned };
