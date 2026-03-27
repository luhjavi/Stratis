const robloxApi = require("./robloxApi");
const profileCache = require("./profileCache");
const rolimonsApi = require("./rolimonsApi");

async function getFullUserProfile(query) {
  const user = await robloxApi.resolveUser(query);
  if (!user?.id) return null;
  return getFullUserProfileById(user.id, false);
}

function isValidRolimonsStats(rs) {
  if (!rs || typeof rs !== "object") return false;
  return Number.isFinite(Number(rs.rap)) && Number.isFinite(Number(rs.value));
}

async function getFullUserProfileById(userId, forceRefresh = false) {
  const key = String(userId);
  if (!forceRefresh) {
    const cached = await profileCache.getProfile(key);
    if (cached) {
      const freshAvatar = await getFreshAvatars(key);
      const [presence, emailVerified, rolimonsStats] = await Promise.all([
        robloxApi.getPresence(key).catch(() => null),
        robloxApi.getOwnEmailStatusIfSameUser(key).catch(() => null),
        isValidRolimonsStats(cached.rolimonsStats)
          ? Promise.resolve(cached.rolimonsStats)
          : rolimonsApi.getPlayerStats(key).catch(() => null)
      ]);
      const presenceGame = await robloxApi.resolvePresenceGame(presence).catch(() => null);
      const merged = {
        ...cached,
        ...freshAvatar,
        presence,
        presenceGame,
        emailVerified: emailVerified !== null ? emailVerified : cached.emailVerified,
        rolimonsStats: rolimonsStats || cached.rolimonsStats,
        fromCache: true
      };
      if (!isValidRolimonsStats(cached.rolimonsStats) && merged.rolimonsStats) {
        await profileCache.setProfile(key, merged);
      }
      return merged;
    }
  }

  const user = await robloxApi.resolveUser(key);
  if (!user?.id) return null;

  const [avatarData, friendCounts, groups, places, socialLinks, currentlyWearing, presence, emailVerified, canViewInventory, badges] =
    await Promise.all([
    getFreshAvatars(user.id),
    robloxApi.getFriendCounts(user.id),
    robloxApi.getUserGroups(user.id).catch(() => []),
    robloxApi.getUserPlaces(user.id).catch(() => []),
    robloxApi.getUserSocialLinks(user.id).catch(() => []),
    robloxApi.getCurrentlyWearing(user.id).catch(() => null),
    robloxApi.getPresence(user.id).catch(() => null),
    robloxApi.getOwnEmailStatusIfSameUser(user.id).catch(() => null),
    robloxApi.getCanViewInventory(user.id).catch(() => null),
    robloxApi.getUserBadges(user.id).catch(() => [])
  ]);

  const wearingAssetIds = currentlyWearing?.assetIds || [];
  const wearingAssetDetails = await robloxApi.getAssetDetails(wearingAssetIds).catch(() => []);
  const presenceGame = await robloxApi.resolvePresenceGame(presence).catch(() => null);

  const totalVisits = places.reduce((sum, place) => sum + (place.placeVisits || 0), 0);

  const normalizedSocialLinks = (socialLinks || [])
    .map((s) => ({ title: s.title || s.type || "Social", type: s.type || "social", url: s.url }))
    .filter((s) => s.url);
  const rolimonsStats = await rolimonsApi.getPlayerStats(user.id).catch(() => null);

  const profile = {
    user,
    ...avatarData,
    friendCounts,
    groups,
    places,
    totalVisits,
    socialLinks: normalizedSocialLinks,
    currentlyWearing,
    wearingAssetDetails,
    presence,
    presenceGame,
    emailVerified,
    canViewInventory,
    badges,
    rolimonsStats,
    fromCache: false
  };
  await profileCache.setProfile(user.id, profile);
  return profile;
}

async function getFreshAvatars(userId) {
  const cached = await profileCache.getAvatar(userId);
  if (cached) return cached;
  const [avatarUrl, avatarBustUrl, avatarFullBodyUrl] = await Promise.all([
    robloxApi.getAvatarHeadshot(userId).catch(() => null),
    robloxApi.getAvatarBust(userId).catch(() => null),
    robloxApi.getAvatarFullBody(userId).catch(() => null)
  ]);
  const payload = { avatarUrl, avatarBustUrl, avatarFullBodyUrl };
  await profileCache.setAvatar(userId, payload);
  return payload;
}

module.exports = {
  getFullUserProfile,
  getFullUserProfileById
};
