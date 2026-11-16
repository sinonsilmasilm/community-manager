import { DEFAULT_GUILD_CONFIG } from "../types.js";
import { kvGet, kvSet } from "./storage.js";
function configKey(guildId) {
    return `guild-config:${guildId}`;
}
export async function getGuildConfig(guildId) {
    const stored = await kvGet(configKey(guildId));
    if (stored)
        return stored;
    // Seed from env-var defaults on first use.
    const seeded = {
        guildId,
        ...DEFAULT_GUILD_CONFIG,
        language: process.env.DEFAULT_LANGUAGE ?? "ar",
        welcomeChannelId: process.env.DEFAULT_WELCOME_CHANNEL_ID || null,
        modLogChannelId: process.env.DEFAULT_MOD_LOG_CHANNEL_ID || null,
    };
    return seeded;
}
export async function saveGuildConfig(config) {
    await kvSet(configKey(config.guildId), config);
}
export async function updateGuildConfig(guildId, patch) {
    const current = await getGuildConfig(guildId);
    const updated = {
        ...current,
        ...patch,
        moderation: { ...current.moderation, ...(patch.moderation ?? {}) },
        commandPermissions: { ...current.commandPermissions, ...(patch.commandPermissions ?? {}) },
    };
    await saveGuildConfig(updated);
    return updated;
}
