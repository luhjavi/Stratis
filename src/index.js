const {
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Partials
} = require("discord.js");
const config = require("./config");
const { connectMongo } = require("./database/connect");
const RequestStat = require("./database/models/RequestStat");
const { handleInteraction } = require("./interactions/handleInteraction");
const logger = require("./utils/logger");
const { syncCommands } = require("./services/commandSync");
const { baseEmbed } = require("./constants/embed");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.commands = new Collection();

async function getRequestCount() {
  try {
    const doc = await RequestStat.findOne({ key: "totalRequests" });
    return doc?.count || 0;
  } catch {
    return 0;
  }
}

function getUserCountSafe() {
  return client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
}

async function rotatePresence() {
  const cycles = [
    async () => `Serving ${client.guilds.cache.size} servers`,
    async () => `Handled ${await getRequestCount()} requests`
  ];
  let index = 0;

  setInterval(async () => {
    try {
      const text = await cycles[index % cycles.length]();
      client.user.setPresence({
        activities: [{ name: text, type: ActivityType.Watching }],
        status: "dnd"
      });
      index += 1;
    } catch (err) {
      logger.warn("Presence rotation failed", err);
    }
  }, 15000);
}

client.once("clientReady", async () => {
  logger.info(`Logged in as ${client.user.tag}`);
  const singleGuildOnly = process.argv.includes("--single-guild");
  await syncCommands(client, { singleGuildOnly });
  await rotatePresence();
});

async function sendGuildLifecycleEmbed(guild, type) {
  if (!guild) return;
  const logGuild = await client.guilds.fetch(config.discord.staffGuildId).catch(() => null);
  if (!logGuild) return;
  const channel = await logGuild.channels.fetch(config.discord.guildLogChannelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const ownerId = guild.ownerId || "undefined";
  const humanCount = Math.max(0, (guild.memberCount || 0) - (guild.members?.me?.user?.bot ? 1 : 0));
  const icon = guild.iconURL({ size: 256 }) || null;
  const title = type === "join" ? "Bot joined a guild." : "Bot left a guild.";
  const nowUnix = Math.floor(Date.now() / 1000);

  const embed = baseEmbed()
    .setTitle(title)
    .setDescription(
      [
        `**${guild.name}**`,
        `${guild.channels?.cache?.size || 0} total channels`,
        `${guild.channels?.cache?.filter((c) => c?.type === 0).size || 0} Text Channels`,
        `${guild.channels?.cache?.filter((c) => c?.type === 2).size || 0} voice channels`,
        "",
        `❯ Owner`,
        `${ownerId}`,
        `❯ Total USERS`,
        `${humanCount}`,
        "",
        `🌍 ID: ${guild.id} • <t:${nowUnix}:f>`
      ].join("\n")
    )
    .setThumbnail(icon);

  await channel.send({ embeds: [embed] }).catch(() => null);
}

client.on("guildCreate", (guild) => {
  sendGuildLifecycleEmbed(guild, "join").catch(() => null);
});

client.on("guildDelete", (guild) => {
  sendGuildLifecycleEmbed(guild, "leave").catch(() => null);
});

client.on("interactionCreate", handleInteraction);

async function bootstrap() {
  if (!config.discord.token) throw new Error("Missing DISCORD_TOKEN in environment.");
  try {
    await connectMongo();
    logger.info("MongoDB connected");
  } catch (err) {
    logger.warn("MongoDB unavailable, running without persistence", err?.message || err);
  }
  await client.login(config.discord.token);
}

bootstrap().catch((err) => {
  logger.error("Boot failed", err);
  process.exit(1);
});
