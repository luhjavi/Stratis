const CachedPayload = require("../database/models/CachedPayload");
const mongoose = require("mongoose");
const CACHE_VERSION = "v3";

const PROFILE_TTL_MS = 2 * 60 * 1000;
const AVATAR_TTL_MS = 20 * 1000;

const mem = new Map();

function memGet(key) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    mem.delete(key);
    return null;
  }
  return entry.payload;
}

function memSet(key, payload, ttlMs) {
  mem.set(key, { payload, expiresAt: Date.now() + ttlMs });
}

async function getByKey(key) {
  const hot = memGet(key);
  if (hot) return hot;
  if (mongoose.connection.readyState !== 1) return null;
  const doc = await CachedPayload.findOne({ key, expiresAt: { $gt: new Date() } }).lean().catch(() => null);
  if (!doc?.payload) return null;
  const ttlMs = new Date(doc.expiresAt).getTime() - Date.now();
  if (ttlMs > 0) memSet(key, doc.payload, ttlMs);
  return doc.payload;
}

async function setByKey(key, payload, ttlMs) {
  const expiresAt = new Date(Date.now() + ttlMs);
  memSet(key, payload, ttlMs);
  if (mongoose.connection.readyState !== 1) return;
  await CachedPayload.findOneAndUpdate(
    { key },
    { $set: { payload, expiresAt } },
    { upsert: true, setDefaultsOnInsert: true }
  ).catch(() => null);
}

async function getProfile(userId) {
  return getByKey(`${CACHE_VERSION}:profile:${String(userId)}`);
}

async function setProfile(userId, value) {
  return setByKey(`${CACHE_VERSION}:profile:${String(userId)}`, value, PROFILE_TTL_MS);
}

async function getAvatar(userId) {
  return getByKey(`${CACHE_VERSION}:avatar:${String(userId)}`);
}

async function setAvatar(userId, value) {
  return setByKey(`${CACHE_VERSION}:avatar:${String(userId)}`, value, AVATAR_TTL_MS);
}

module.exports = { getProfile, setProfile, getAvatar, setAvatar };
