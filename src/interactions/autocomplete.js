const robloxApi = require("../services/robloxApi");

async function handleAutocomplete(interaction) {
  if (interaction.commandName !== "roblox") return;
  if (interaction.options.getSubcommand() !== "userfromroblox") return;

  const focused = interaction.options.getFocused().trim();
  const results = await robloxApi.searchUsersAutocomplete(focused);

  const mapped = results.slice(0, 25).map((r) => ({
    name: `${r.name} (${r.id})`,
    value: String(r.name)
  }));

  await interaction.respond(mapped);
}

module.exports = {
  handleAutocomplete
};
