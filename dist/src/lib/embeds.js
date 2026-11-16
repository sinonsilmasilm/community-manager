// Minimal embed-object builders (plain JSON, no discord.js EmbedBuilder
// dependency needed on the HTTP-interactions side — keeps that function
// lightweight for serverless cold starts).
export const BRAND_COLOR = 0x5865f2; // Discord blurple; change to match your server
export const WARNING_COLOR = 0xf2a65a;
export const DANGER_COLOR = 0xed4245;
export const SUCCESS_COLOR = 0x57f287;
export function embed(opts) {
    return {
        color: BRAND_COLOR,
        timestamp: new Date().toISOString(),
        ...opts,
    };
}
export function welcomeEmbed(params) {
    const { username, guildName, memberCount, rulesChannelMention, customMessage } = params;
    return embed({
        title: `👋 Welcome, ${username}!`,
        description: customMessage ??
            `Glad to have you in **${guildName}**! You're member #${memberCount}.` +
                (rulesChannelMention ? ` Please check ${rulesChannelMention} to get started.` : ""),
        color: SUCCESS_COLOR,
    });
}
export function moderationAlertEmbed(params) {
    return embed({
        title: "🚨 Moderation Alert",
        color: DANGER_COLOR,
        fields: [
            { name: "User", value: params.userTag, inline: true },
            { name: "Channel", value: params.channelMention, inline: true },
            { name: "Reason", value: params.reason, inline: false },
            ...(params.excerpt ? [{ name: "Message", value: params.excerpt.slice(0, 500), inline: false }] : []),
        ],
    });
}
