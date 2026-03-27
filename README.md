# Stratis
Search for Roblox Profiles and connected accounts.

## Features included now

- Slash commands with category roots:
  - `/roblox userfromroblox <query>`
  - `/roblox status`
  - `/roblox groupinfo <query>`
  - `/roblox gameinfo <query>`
  - `/roblox assetinfo <id>`
  - `/utility ping`
  - `/utility shard`
  - `/utility invitebot`
- 15-second user cooldown for Roblox search commands.
- Minimal dark embed style.
- Presence rotation: servers, users, total handled requests.
- MongoDB persistence for request count.
- Sharding manager support for scale.
- Optional Bloxlink API integration for Discord -> Roblox linking.
- Interactive user result panel with view switcher and navigation controls.
- Panel auto-disables after 30 seconds of idle time.
- Profile cache with TTL and fast avatar thumbnail refresh caching.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in tokens and IDs.
3. Install dependencies:

```bash
npm install
```

4. Deploy slash commands:

```bash
npm run deploy:commands
```

5. Start bot (sharded):

```bash
npm start
```

For local debugging without sharding:

```bash
npm run start:single
```

## Notes

- For free hosting, use local MongoDB Community Edition or MongoDB Atlas free tier.
- Some Roblox endpoints may change or rate limit; service functions are organized to be easy to extend.
- "Terminated" accounts are represented from Roblox account data where available (for example, banned state).
- Command sync behavior on startup:
  - `npm start`: syncs slash commands to all guilds the bot is currently in.
  - `npm run start:single`: syncs slash commands only to `DISCORD_GUILD_ID` for testing.
