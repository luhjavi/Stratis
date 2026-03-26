const { REST, Routes } = require("discord.js");
const config = require("../src/config");
const { commands } = require("../src/commands");

async function run() {
  if (!config.discord.token || !config.discord.clientId) {
    throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID.");
  }

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const body = commands.map((c) => c.data.toJSON());

  if (config.discord.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body });
    console.log(`Deployed ${body.length} guild command(s).`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
  console.log(`Deployed ${body.length} global command(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
