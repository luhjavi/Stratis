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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.commands = new Collection();

async function getRequestCount() {
  const doc = await RequestStat.findOne({ key: "totalRequests" });
  return doc?.count || 0;
}

function getUserCountSafe() {
  return client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
}

async function rotatePresence() {
  const cycles = [
    async () => `Serving ${client.guilds.cache.size} servers`,
    async () => `Watching ${getUserCountSafe()} users`,
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

client.once("ready", async () => {
  logger.info(`Logged in as ${client.user.tag}`);
  await rotatePresence();
});

client.on("interactionCreate", handleInteraction);

async function bootstrap() {
  if (!config.discord.token) throw new Error("Missing DISCORD_TOKEN in environment.");
  await connectMongo();
  await client.login(config.discord.token);
}

bootstrap().catch((err) => {
  logger.error("Boot failed", err);
  process.exit(1);
});
