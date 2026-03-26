const config = require("../config");

async function robloxFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (config.roblox.cookie) {
    headers.Cookie = `.ROBLOSECURITY=${config.roblox.cookie}`;
  }

  const response = await fetch(url, { ...options, headers });
  return response;
}

async function resolveUser(query) {
  if (/^\d+$/.test(query)) {
    const userRes = await robloxFetch(`https://users.roblox.com/v1/users/${query}`);
    if (!userRes.ok) return null;
    return userRes.json();
  }

  const response = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: JSON.stringify({
      usernames: [query],
      excludeBannedUsers: false
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  const first = data?.data?.[0];
  if (!first) return null;

  const userRes = await robloxFetch(`https://users.roblox.com/v1/users/${first.id}`);
  if (!userRes.ok) return null;
  return userRes.json();
}

async function searchUsersAutocomplete(prefix) {
  if (!prefix || prefix.length < 2) return [];
  const response = await robloxFetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: JSON.stringify({
      usernames: [prefix],
      excludeBannedUsers: false
    })
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data?.data || [];
}

async function getAvatarHeadshot(userId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.imageUrl || null;
}

async function getUsernameHistory(userId) {
  const response = await robloxFetch(
    `https://users.roblox.com/v1/users/${userId}/username-history?limit=10&sortOrder=Desc`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function getFriendCounts(userId) {
  const [friends, followers, following] = await Promise.all([
    robloxFetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    robloxFetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
    robloxFetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`)
  ]);

  const [fJson, frJson, fgJson] = await Promise.all([friends.json(), followers.json(), following.json()]);
  return {
    friends: fJson?.count ?? 0,
    followers: frJson?.count ?? 0,
    following: fgJson?.count ?? 0
  };
}

async function getUserGroups(userId) {
  const response = await robloxFetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function getUserPlaces(userId) {
  const response = await robloxFetch(
    `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=10&sortOrder=Asc`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function getUserSocialLinks(userId) {
  const response = await robloxFetch(`https://users.roblox.com/v1/users/${userId}/social-links`);
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function getRobloxStatus() {
  const response = await robloxFetch("https://status.roblox.com/v1/summary");
  if (!response.ok) return null;
  return response.json();
}

async function resolveGroup(query) {
  if (/^\d+$/.test(query)) {
    const response = await robloxFetch(`https://groups.roblox.com/v1/groups/${query}`);
    if (!response.ok) return null;
    return response.json();
  }

  const lookup = await robloxFetch(
    `https://groups.roblox.com/v1/groups/search/lookup?groupName=${encodeURIComponent(query)}`
  );
  if (!lookup.ok) return null;
  const data = await lookup.json();
  const first = data?.data?.[0];
  if (!first?.id) return null;

  const groupRes = await robloxFetch(`https://groups.roblox.com/v1/groups/${first.id}`);
  if (!groupRes.ok) return null;
  return groupRes.json();
}

async function resolveGame(query) {
  if (/^\d+$/.test(query)) {
    const response = await robloxFetch(`https://games.roblox.com/v1/games?universeIds=${query}`);
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data?.[0] || null;
  }

  const response = await robloxFetch(
    `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(
      query
    )}&model.maxRows=1`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.games?.[0] || null;
}

async function getAssetInfo(assetId) {
  const response = await robloxFetch(`https://economy.roblox.com/v2/assets/${assetId}/details`);
  if (!response.ok) return null;
  return response.json();
}

module.exports = {
  resolveUser,
  searchUsersAutocomplete,
  getAvatarHeadshot,
  getUsernameHistory,
  getFriendCounts,
  getUserGroups,
  getUserPlaces,
  getUserSocialLinks,
  getRobloxStatus,
  resolveGroup,
  resolveGame,
  getAssetInfo
};
