const { REST, Routes } = require("discord.js");
const config = require("../config");
const { commands } = require("../commands");
const logger = require("../utils/logger");

async function syncCommands(client, options = {}) {
  const singleGuildOnly = Boolean(options.singleGuildOnly);
  if (!config.discord.token || !config.discord.clientId) return;

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const all = commands.map((c) => c.data.toJSON());

  // Always clear global commands so removed/legacy commands disappear everywhere.
  // This project uses guild-scoped commands for immediate updates.
  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: [] });
  logger.info("Cleared global application commands");

  if (singleGuildOnly) {
    if (!config.discord.guildId) {
      logger.warn("SINGLE_GUILD_ONLY enabled but DISCORD_GUILD_ID is missing");
      return;
    }
    const body = all.filter((cmd) => cmd.name !== "auth" || config.discord.guildId === config.discord.staffGuildId);
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body });
    logger.info(`Synced ${body.length} command(s) to test guild ${config.discord.guildId}`);
    return;
  }

  const guildIds = [...client.guilds.cache.keys()];
  for (const guildId of guildIds) {
    try {
      const body = all.filter((cmd) => cmd.name !== "auth" || guildId === config.discord.staffGuildId);
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guildId), { body });
    } catch (err) {
      logger.warn(`Failed command sync for guild ${guildId}`, err?.message || err);
    }
  }
  logger.info(`Synced commands across ${guildIds.length} guild(s)`);
}

module.exports = { syncCommands };
