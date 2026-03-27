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
  if (!first) {
    return resolveUserByPreviousUsername(query);
  }

  const userRes = await robloxFetch(`https://users.roblox.com/v1/users/${first.id}`);
  if (!userRes.ok) return null;
  return userRes.json();
}

async function searchUsers(keyword, limit = 25) {
  const response = await robloxFetch(
    `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function resolveUserByPreviousUsername(query) {
  const candidates = await searchUsers(query, 25);
  if (!candidates.length) return null;

  const normalized = query.trim().toLowerCase();
  for (const candidate of candidates) {
    const history = await getUsernameHistory(candidate.id).catch(() => []);
    const matched = history.some((u) => String(u.name).toLowerCase() === normalized);
    if (matched) {
      const userRes = await robloxFetch(`https://users.roblox.com/v1/users/${candidate.id}`);
      if (userRes.ok) return userRes.json();
    }
  }
  return null;
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

async function getAvatarBust(userId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${userId}&size=420x420&format=Png&isCircular=false`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.imageUrl || null;
}

async function getAvatarFullBody(userId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
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

async function getCanViewInventory(userId) {
  const response = await robloxFetch(`https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`);
  if (!response.ok) return null;
  const json = await response.json();
  if (typeof json?.canView === "boolean") return json.canView;
  if (typeof json === "boolean") return json;
  return null;
}

async function getUserBadges(userId) {
  const response = await robloxFetch(
    `https://badges.roblox.com/v1/users/${userId}/badges?limit=10&sortOrder=Desc`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
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

async function getCurrentlyWearing(userId) {
  const response = await robloxFetch(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
  if (!response.ok) return null;
  return response.json();
}

async function getPresence(userId) {
  const response = await robloxFetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    body: JSON.stringify({ userIds: [Number(userId)] })
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json?.userPresences?.[0] || null;
}

async function getUniverseDetails(universeId) {
  if (!universeId) return null;
  const response = await robloxFetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0] || null;
}

/** Resolve experience name / universe when presence only exposes placeId. */
async function getPlaceDetails(placeIds) {
  const ids = (Array.isArray(placeIds) ? placeIds : [placeIds])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (!ids.length) return [];
  const response = await robloxFetch(
    `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${ids.join(",")}`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function resolvePresenceGame(presence) {
  if (!presence) return null;
  if (presence.universeId) {
    return getUniverseDetails(presence.universeId);
  }
  if (presence.placeId) {
    const places = await getPlaceDetails([presence.placeId]);
    const place = places[0];
    if (!place) return null;
    if (place.universeId) {
      return getUniverseDetails(place.universeId);
    }
    if (place.name) {
      return { id: place.universeId || null, name: place.name };
    }
  }
  return null;
}

async function getAssetDetails(assetIds) {
  if (!assetIds?.length) return [];
  const ids = assetIds.slice(0, 120).map((id) => Number(id)).filter((id) => Number.isFinite(id));

  // Primary bulk endpoint.
  const response = await robloxFetch("https://catalog.roblox.com/v1/catalog/items/details", {
    method: "POST",
    body: JSON.stringify({
      items: ids.map((id) => ({ itemType: "Asset", id }))
    })
  });

  if (response.ok) {
    const json = await response.json();
    const data = json?.data || [];
    if (data.length) return data;
  }

  // Fallback per-asset lookup if bulk endpoint is unavailable for this context.
  const details = await Promise.all(
    ids.map(async (id) => {
      const info = await getAssetInfo(id).catch(() => null);
      if (!info) return null;
      return { id, name: info.name || String(id) };
    })
  );
  return details.filter(Boolean);
}

async function getAuthenticatedUser() {
  const response = await robloxFetch("https://users.roblox.com/v1/users/authenticated");
  if (!response.ok) return null;
  return response.json();
}

async function getOwnEmailStatusIfSameUser(userId) {
  if (!config.roblox.cookie) return null;
  const me = await getAuthenticatedUser();
  if (!me?.id || Number(me.id) !== Number(userId)) return null;
  const response = await robloxFetch("https://accountsettings.roblox.com/v1/email");
  if (!response.ok) return null;
  const json = await response.json();
  return Boolean(json?.verified);
}

/** Roblox status page on Status.io (from status.roblox.com page source). */
const ROBLOX_STATUS_IO_PAGE_ID = "59db90dbcdeb2f04dadcf16d";

const STATUS_FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "StratisBot/1.0 (+https://github.com; Discord bot)"
};

function flattenStatusIoComponents(statusList) {
  const out = [];
  for (const cat of statusList || []) {
    const subs = cat.containers || [];
    if (subs.length) {
      for (const c of subs) {
        out.push({ name: `${cat.name} · ${c.name}`, status: c.status });
      }
    } else {
      out.push({ name: cat.name, status: cat.status });
    }
  }
  return out;
}

/** Grouped sections matching status.roblox.com (User / Player / Creator). */
function buildStatusIoCategories(statusList) {
  const categories = [];
  for (const cat of statusList || []) {
    const subs = cat.containers || [];
    if (subs.length) {
      categories.push({
        name: cat.name,
        items: subs.map((c) => ({ name: c.name, status: c.status }))
      });
    } else {
      categories.push({
        name: cat.name,
        items: [{ name: cat.name, status: cat.status }]
      });
    }
  }
  return categories;
}

async function getRobloxStatus() {
  // Primary: Status.io JSON API (reliable; Roblox retired /v1/summary).
  try {
    const res = await fetch(`https://api.status.io/1.0/status/${ROBLOX_STATUS_IO_PAGE_ID}`, {
      headers: STATUS_FETCH_HEADERS
    });
    if (res.ok) {
      const data = await res.json();
      const result = data?.result;
      const top = result?.status;
      if (Array.isArray(top) && top.length) {
        const overall = result.status_overall?.status || "Unknown";
        const updated = result.status_overall?.updated || "";
        return {
          source: "status-io",
          overall,
          updated,
          statusCode: result.status_overall?.status_code,
          components: flattenStatusIoComponents(top),
          categories: buildStatusIoCategories(top)
        };
      }
    }
  } catch {
    // try fallbacks
  }

  try {
    const response = await robloxFetch("https://status.roblox.com/v1/summary");
    if (response.ok) {
      const json = await response.json();
      if (json && typeof json === "object") return json;
    }
  } catch {
    // try HTML
  }

  try {
    const htmlRes = await fetch("https://status.roblox.com/", { headers: STATUS_FETCH_HEADERS });
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();

    const overallMatch = html.match(/id="statusbar_text">([^<]+)</i);
    const updatedMatch = html.match(/id="updated_ago">([^<]+)</i);
    const incidentCount = (html.match(/class="row incident"/g) || []).length;

    return {
      source: "html-fallback",
      overall: overallMatch?.[1]?.trim() || "Unknown",
      updated: updatedMatch?.[1]?.trim() || "Unknown",
      incidentCount
    };
  } catch {
    return null;
  }
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

function extractTemplateAssetId(text) {
  const raw = String(text || "");
  const patterns = [
    /asset\/\?id=(\d+)/i,
    /assetId=(\d+)/i,
    /rbxassetid:\/\/(\d+)/i
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return Number(m[1]);
  }
  return null;
}

async function getClassicClothingTemplateId(clothingAssetId) {
  const id = Number(clothingAssetId);
  if (!Number.isFinite(id)) return null;

  const endpoints = [
    `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
    `https://www.roblox.com/asset/?id=${id}`
  ];

  for (const url of endpoints) {
    const response = await robloxFetch(url).catch(() => null);
    if (!response?.ok) continue;
    const arr = await response.arrayBuffer().catch(() => null);
    if (!arr) continue;
    const text = Buffer.from(arr).toString("utf8");
    const templateId = extractTemplateAssetId(text);
    if (templateId) return templateId;
  }
  return null;
}

async function getAssetImageBuffer(assetId) {
  const id = Number(assetId);
  if (!Number.isFinite(id)) return null;

  // For classic template images, use asset delivery directly.
  // Thumbnail fallback is intentionally avoided to prevent generic placeholder icons.
  const direct = await robloxFetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`).catch(() => null);
  if (!direct?.ok) return null;
  const contentType = String(direct.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) return null;
  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "png";
  const arr = await direct.arrayBuffer().catch(() => null);
  if (!arr) return null;
  return { buffer: Buffer.from(arr), extension: ext };
}

async function getAssetThumbnail(assetId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png&isCircular=false`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.imageUrl || null;
}

async function getGroupIcon(groupId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.imageUrl || null;
}

async function getGroupBanner(groupId) {
  // Roblox does not expose a stable public banner endpoint for groups.
  // Keep this as null until an official public endpoint becomes available.
  void groupId;
  return null;
}

async function getGameVotes(universeId) {
  const response = await robloxFetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`);
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0] || null;
}

async function getGameIcon(universeId) {
  const response = await robloxFetch(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
  );
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data?.[0]?.imageUrl || null;
}

async function searchCatalogItemsByKeyword(keyword, limit = 10) {
  if (!keyword?.trim()) return [];
  const response = await robloxFetch(
    `https://catalog.roblox.com/v1/search/items/details?Keyword=${encodeURIComponent(
      keyword.trim()
    )}&Category=All&Limit=${limit}&SortType=3`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return json?.data || [];
}

async function getRolimonsItemDetails() {
  const response = await fetch("https://www.rolimons.com/itemapi/itemdetails");
  if (!response.ok) return null;
  return response.json();
}

function getRolimonsValueForAsset(itemApiPayload, assetId) {
  const entry = itemApiPayload?.items?.[String(assetId)];
  if (!entry) return null;
  return {
    rap: Number.isFinite(Number(entry[2])) && Number(entry[2]) >= 0 ? Number(entry[2]) : null,
    value: Number.isFinite(Number(entry[3])) && Number(entry[3]) >= 0 ? Number(entry[3]) : null,
    demand: entry[4] ?? null,
    trend: entry[5] ?? null
  };
}

module.exports = {
  resolveUser,
  searchUsersAutocomplete,
  getAvatarHeadshot,
  getAvatarBust,
  getAvatarFullBody,
  getUsernameHistory,
  getFriendCounts,
  getCanViewInventory,
  getUserBadges,
  getUserGroups,
  getUserPlaces,
  getUserSocialLinks,
  getCurrentlyWearing,
  getPresence,
  getUniverseDetails,
  getPlaceDetails,
  resolvePresenceGame,
  getAssetDetails,
  getOwnEmailStatusIfSameUser,
  getRobloxStatus,
  resolveGroup,
  resolveGame,
  getAssetInfo,
  getAssetThumbnail,
  getGroupIcon,
  getGroupBanner,
  getGameVotes,
  getGameIcon,
  getClassicClothingTemplateId,
  getAssetImageBuffer,
  searchCatalogItemsByKeyword,
  getRolimonsItemDetails,
  getRolimonsValueForAsset
};
