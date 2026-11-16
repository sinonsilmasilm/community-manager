// Registers (or updates) all slash commands with Discord.
//
// Usage:
//   npm run register-commands            # global (takes up to ~1h to propagate)
//   npm run register-commands:guild       # instant, scoped to DISCORD_DEV_GUILD_ID (for dev/testing)
//
// Requires DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN in your environment
// (loaded from .env if you run this with a tool like `dotenv-cli`, or export
// them in your shell first).
import { commandDefinitions } from "../src/commands/definitions.js";
const appId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.argv.includes("--guild") ? process.env.DISCORD_DEV_GUILD_ID : undefined;
if (!appId || !token) {
    console.error("Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in environment.");
    process.exit(1);
}
if (process.argv.includes("--guild") && !guildId) {
    console.error("--guild was passed but DISCORD_DEV_GUILD_ID is not set.");
    process.exit(1);
}
const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;
async function main() {
    console.log(`Registering ${commandDefinitions.length} commands ${guildId ? `to guild ${guildId}` : "globally"}...`);
    const res = await fetch(url, {
        method: "PUT", // PUT replaces the entire command set atomically
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commandDefinitions),
    });
    if (!res.ok) {
        const body = await res.text();
        console.error(`Registration failed: ${res.status}\n${body}`);
        process.exit(1);
    }
    const data = (await res.json());
    console.log(`✅ Registered: ${data.map((c) => c.name).join(", ")}`);
    if (!guildId) {
        console.log("Note: global commands can take up to 1 hour to appear everywhere. Use --guild for instant testing.");
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
