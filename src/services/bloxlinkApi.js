const config = require("../config");

async function getLinkedRobloxFromDiscord(discordId) {
  if (!config.bloxlink.token) return null;

  const response = await fetch(
    `https://api.blox.link/v4/public/guilds/0/discord-to-roblox/${encodeURIComponent(discordId)}`,
    {
      headers: {
        Authorization: config.bloxlink.token
      }
    }
  );

  if (!response.ok) return null;
  const json = await response.json();
  return json?.robloxID ? String(json.robloxID) : null;
}

module.exports = { getLinkedRobloxFromDiscord };
