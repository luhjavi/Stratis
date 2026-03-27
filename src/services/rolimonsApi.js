function extractBalancedJsonObject(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && /\s/.test(html[i])) i += 1;
  if (html[i] !== "{") return null;
  let depth = 0;
  const start = i;
  let inString = false;
  let stringQuote = null;
  let escape = false;
  for (; i < html.length; i += 1) {
    const c = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === stringQuote) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringQuote = c;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const jsonStr = html.slice(start, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractJsonVariableSmall(html, variableName) {
  const regex = new RegExp(`var\\s+${variableName}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
  const match = html.match(regex);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractJsonVariable(html, variableName) {
  if (variableName === "item_list") {
    return extractBalancedJsonObject(html, `var ${variableName} = `);
  }
  return extractJsonVariableSmall(html, variableName);
}

function computeRolimonsStats(itemList, scannedAssets, ugcAssetsRaw, tradeAdCount) {
  let rap = 0;
  let value = 0;
  let collectibles = 0;

  const ownedIds = Object.keys(scannedAssets || {});
  collectibles += ownedIds.length;
  for (const id of ownedIds) {
    const item = itemList?.[id];
    if (!item) continue;
    const itemRap = Number(item[2] || 0);
    const itemValue = Number(item[3] || item[5] || 0);
    rap += itemRap;
    value += itemValue || itemRap;
  }

  const ugcIds = Object.keys(ugcAssetsRaw || {});
  collectibles += ugcIds.length;
  for (const id of ugcIds) {
    const ugc = ugcAssetsRaw[id];
    if (!ugc) continue;
    const ugcRap = Number(ugc[2] || 0);
    rap += ugcRap;
    value += ugcRap;
  }

  return {
    rap,
    value,
    collectibles,
    tradeAdsCreated: Number(tradeAdCount || 0)
  };
}

async function getPlayerStats(robloxUserId) {
  const response = await fetch(`https://www.rolimons.com/player/${encodeURIComponent(robloxUserId)}?view=api`);
  if (!response.ok) return null;
  const html = await response.text();

  const playerDetails = extractJsonVariable(html, "player_details_data");
  const scannedAssets = extractJsonVariable(html, "scanned_player_assets");
  const ugcAssetsRaw = extractJsonVariable(html, "player_ugc_assets_raw");
  const itemList = extractJsonVariable(html, "item_list");

  if (!playerDetails) return null;
  const computed = computeRolimonsStats(itemList, scannedAssets, ugcAssetsRaw, playerDetails.trade_ad_count);

  return {
    rap: Number(computed.rap) || 0,
    value: Number(computed.value) || 0,
    collectibles: computed.collectibles,
    tradeAdsCreated: computed.tradeAdsCreated,
    profileUrl: `https://www.rolimons.com/player/${robloxUserId}`,
    tradeAdsUrl: `https://www.rolimons.com/playertrades/${robloxUserId}`
  };
}

module.exports = {
  getPlayerStats
};
