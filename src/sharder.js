const { ShardingManager } = require("discord.js");
const config = require("./config");

if (!config.discord.token) {
  throw new Error("Missing DISCORD_TOKEN in environment.");
}

const manager = new ShardingManager("./src/index.js", {
  token: config.discord.token,
  totalShards: "auto"
});

manager.on("shardCreate", (shard) => {
  console.log(`[SHARD] Spawned shard ${shard.id}`);
});

manager.spawn();
