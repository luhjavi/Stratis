const { MessageFlags } = require("discord.js");
const { commands } = require("../commands");
const { baseEmbed } = require("../constants/embed");
const { handleAutocomplete } = require("./autocomplete");
const { handleComponent } = require("./robloxUserSession");
const authCommand = require("../commands/auth");
const config = require("../config");
const { isUserBanned, isServerBanned } = require("../services/banService");

const commandMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

async function handleInteraction(interaction) {
  if (interaction.isMessageComponent()) {
    const handled = await handleComponent(interaction).catch(() => false);
    if (handled) return;
    const authHandled = await authCommand.handleComponent?.(interaction).catch(() => false);
    if (authHandled) return;
  }

  if (interaction.isAutocomplete()) {
    try {
      await handleAutocomplete(interaction);
    } catch (err) {
      // Ignore already-acked/expired autocomplete interactions to avoid crashing the client.
      if (err?.code === 40060 || err?.code === 10062) return;
      if (!interaction.responded) {
        await interaction.respond([]).catch(() => null);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  const userBanned = await isUserBanned(interaction.user?.id);
  const serverBanned = await isServerBanned(interaction.guildId);
  if (userBanned || serverBanned) {
    const msg = userBanned ? config.bot.userBanMessage : config.bot.serverBanMessage;
    return interaction.reply({
      embeds: [baseEmbed().setTitle("Access denied").setDescription(msg)],
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    const payload = {
      embeds: [baseEmbed().setTitle("Error").setDescription("Something went wrong while running this command.")],
      flags: MessageFlags.Ephemeral
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
