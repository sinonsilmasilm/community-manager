import "dotenv/config";
import { client } from "./client.js";
import "./events/guildMemberAdd.js";
import "./events/interactionCreate.js";
import "./events/messageCommands.js";
const token = process.env.DISCORD_TOKEN || process.env.TOKEN || process.env.BOT_TOKEN;
if (!token) {
    console.error("[BOT] Token missing! Put it in .env as DISCORD_TOKEN=...");
    process.exit(1);
}
client.once("clientReady", () => {
    console.log(`[BOT] Logged in as ${client.user?.tag}`);
});
client.login(token);
