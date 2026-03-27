# Stratis
Replacement Bot for axotl#0066, now stratis#0066

## Commands

### Roblox

| Command | Parameters | Description |
| --- | --- | --- |
| `/roblox userfromroblox` | `query` (username or user ID) | Fetch a full interactive Roblox user profile with multiple views. |
| `/roblox status` | None | Show Roblox platform status grouped by service area. |
| `/roblox groupinfo` | `query` (group name or ID) | Show Roblox group info with icon and linked owner. |
| `/roblox gameinfo` | `query` (game name or universe ID) | Show game details (visits, favorites, ratio, server size, dates, creator). |
| `/roblox assetinfo` | `id` (asset ID) | Show marketplace-focused asset details with thumbnail and creator link. |
| `/roblox iteminfo` | `query` (item name or item ID) | Lookup marketplace items (UGC/clothing/accessories/etc.) with trade, price, RAP/value when available. |

### Utility

| Command | Parameters | Description |
| --- | --- | --- |
| `/utility ping` | None | Show API, gateway, shard, database latency, uptime, and memory. |
| `/utility shard` | None | Show shard ID, shard count, and guild count for this shard. |
| `/utility invitebot` | None | Return the bot invite link with configured permissions. |

### Media

| Command | Parameters | Description |
| --- | --- | --- |
| `/media overlay` | `image1`, `image2`, `opacity` (optional, default `50`) | Overlay two images together using selected opacity on the top image. |
| `/media caption` | `image`, `caption` | Add a caption strip to an image. |
| `/media imagetogif` | `image` | Convert an image to GIF format. |
| `/media invert` | `image` | Invert image colors. |
| `/media monochrome` | `image` | Convert image to black-and-white (grayscale). |
| `/media resize` | `image`, `percentage` | Resize an image by a percentage scale (1-500). |

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
