import { DEFAULT_GUILD_CONFIG, GuildConfig } from "../types.js";
import { kvGet, kvSet } from "./storage.js";

function configKey(guildId: string): string {
  return `guild-config:${guildId}`;
}

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const stored = await kvGet<GuildConfig>(configKey(guildId));
  if (stored) return stored;

  // Seed from env-var defaults on first use.
  const seeded: GuildConfig = {
    guildId,
    ...DEFAULT_GUILD_CONFIG,
    language: (process.env.DEFAULT_LANGUAGE as GuildConfig["language"]) ?? "ar",
    welcomeChannelId: process.env.DEFAULT_WELCOME_CHANNEL_ID || null,
    modLogChannelId: process.env.DEFAULT_MOD_LOG_CHANNEL_ID || null,
  };
  return seeded;
}

export async function saveGuildConfig(config: GuildConfig): Promise<void> {
  await kvSet(configKey(config.guildId), config);
}

export async function updateGuildConfig(
  guildId: string,
  patch: Partial<GuildConfig>
): Promise<GuildConfig> {
  const current = await getGuildConfig(guildId);
  const updated: GuildConfig = {
    ...current,
    ...patch,
    moderation: { ...current.moderation, ...(patch.moderation ?? {}) },
    commandPermissions: { ...current.commandPermissions, ...(patch.commandPermissions ?? {}) },
  };
  await saveGuildConfig(updated);
  return updated;
}
