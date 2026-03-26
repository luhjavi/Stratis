const { commands } = require("../commands");
const { baseEmbed } = require("../constants/embed");
const { handleAutocomplete } = require("./autocomplete");

const commandMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    try {
      await handleAutocomplete(interaction);
    } catch {
      if (!interaction.responded) await interaction.respond([]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    const payload = {
      embeds: [baseEmbed().setTitle("Error").setDescription("Something went wrong while running this command.")],
      ephemeral: true
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
    console.error(err);
  }
}

module.exports = { handleInteraction };
