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
