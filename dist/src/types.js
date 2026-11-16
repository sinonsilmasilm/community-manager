// Shared types used across the bot (HTTP command handling + gateway worker).
export const DEFAULT_GUILD_CONFIG = {
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
