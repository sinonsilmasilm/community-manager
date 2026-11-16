// Shared types used across the bot (HTTP command handling + gateway worker).

export interface GuildConfig {
  guildId: string;
  language: "ar" | "en" | "fr" | "darija";
  welcomeChannelId: string | null;
  modLogChannelId: string | null;
  welcomeMessage: string | null;
  autoRoleId: string | null;
  moderation: {
    spamEnabled: boolean;
    spamMessageThreshold: number; // messages
    spamWindowSeconds: number; // within this many seconds
    repeatedMessageThreshold: number; // identical consecutive messages
    mentionAbuseThreshold: number; // mentions in one message
    linkFilterEnabled: boolean;
    allowedLinkDomains: string[];
    bannedWords: string[];
    warnThreshold: number; // warnings before escalation (manual mod action, not auto-ban)
  };
  commandPermissions: Record<string, string[]>; // commandName -> role IDs allowed (empty = default Discord perms)
}

export const DEFAULT_GUILD_CONFIG: Omit<GuildConfig, "guildId"> = {
  language: "ar",
  welcomeChannelId: null,
  modLogChannelId: null,
  welcomeMessage: null,
  autoRoleId: null,
  moderation: {
    spamEnabled: true,
    spamMessageThreshold: 6,
    spamWindowSeconds: 8,
    repeatedMessageThreshold: 3,
    mentionAbuseThreshold: 6,
    linkFilterEnabled: false,
    allowedLinkDomains: [],
    bannedWords: [],
    warnThreshold: 3,
  },
  commandPermissions: {},
};

export interface WarningRecord {
  guildId: string;
  userId: string;
  reason: string;
  moderatorId: string; // "AUTO" for automated flags
  timestamp: number;
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  data?: {
    id: string;
    name: string;
    options?: Array<{ name: string; type: number; value?: string | number | boolean }>;
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: { id: string; username: string; global_name?: string };
    roles: string[];
    permissions: string;
  };
  user?: { id: string; username: string; global_name?: string };
  token: string;
}
