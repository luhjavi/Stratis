const robloxApi = require("./robloxApi");

async function getFullUserProfile(query) {
  const user = await robloxApi.resolveUser(query);
  if (!user?.id) return null;

  const [avatarUrl, usernameHistory, friendCounts, groups, places, socialLinks] = await Promise.all([
    robloxApi.getAvatarHeadshot(user.id),
    robloxApi.getUsernameHistory(user.id),
    robloxApi.getFriendCounts(user.id),
    robloxApi.getUserGroups(user.id),
    robloxApi.getUserPlaces(user.id),
    robloxApi.getUserSocialLinks(user.id)
  ]);

  return {
    user,
    avatarUrl,
    usernameHistory,
    friendCounts,
    groups,
    places,
    socialLinks
  };
}

module.exports = {
  getFullUserProfile
};
