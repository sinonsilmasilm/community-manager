import { askAI, checkAiStatus } from "../lib/ai.js";
import { canManageMessages, canModerate, isAdministrator } from "../lib/permissions.js";
import { getGuildConfig } from "../lib/config.js";
import { getWarnings, recordWarning } from "../lib/moderation.js";
import { bulkDeleteMessages, getGuild, getRecentMessages, sendChannelMessage } from "../lib/discord-api.js";
import { embed, moderationAlertEmbed, SUCCESS_COLOR, WARNING_COLOR } from "../lib/embeds.js";
import { isRateLimited } from "../lib/rateLimit.js";
function optionValue(interaction, name) {
    return interaction.data?.options?.find((o) => o.name === name)?.value;
}
function callerTag(interaction) {
    const user = interaction.member?.user ?? interaction.user;
    return user?.global_name || user?.username || "someone";
}
function callerId(interaction) {
    return (interaction.member?.user ?? interaction.user)?.id ?? "unknown";
}
async function handleAsk(interaction) {
    const question = optionValue(interaction, "question") ?? "";
    if (isRateLimited(`ask:${callerId(interaction)}`, 6, 60)) {
        return { content: "⏳ You're asking a bit fast — please wait a moment before asking again." };
    }
    try {
        const answer = await askAI([{ role: "user", content: question }]);
        return { content: answer.slice(0, 1900) };
    }
    catch (err) {
        console.error("[ask] AI error:", err);
        return { content: "⚠️ The AI assistant is temporarily unavailable. Please try again shortly." };
    }
}
function handleHelp() {
    return {
        embeds: [
            embed({
                title: "🤖 Community Manager — Commands",
                description: [
                    "**/ask** `question` — Ask the AI assistant anything.",
                    "**/help** — Show this message.",
                    "**/rules** — Display the server rules.",
                    "**/serverinfo** — Server statistics.",
                    "**/userinfo** `[user]` — Member information.",
                    "**/announce** `message [channel]` — Post an announcement *(admin)*.",
                    "**/clear** `amount` — Bulk-delete recent messages *(moderator)*.",
                    "**/mod warn|warnings** — Moderation tools *(moderator)*.",
                    "**/ai-status** — Check AI service health.",
                ].join("\n"),
            }),
        ],
    };
}
async function handleRules(interaction) {
    const guildId = interaction.guild_id;
    if (!guildId)
        return { content: "This command only works inside a server." };
    const config = await getGuildConfig(guildId);
    return {
        embeds: [
            embed({
                title: "📜 Server Rules",
                description: config.welcomeMessage /* reuse custom text slots if admin hasn't set dedicated rules text */ ??
                    "No custom rules have been configured yet. An administrator can set them from the dashboard.",
            }),
        ],
    };
}
async function handleServerInfo(interaction) {
    const guildId = interaction.guild_id;
    if (!guildId)
        return { content: "This command only works inside a server." };
    try {
        const guild = await getGuild(guildId);
        return {
            embeds: [
                embed({
                    title: `ℹ️ ${guild.name}`,
                    fields: [
                        { name: "Members (approx.)", value: String(guild.approximate_member_count ?? "unknown"), inline: true },
                        { name: "Boosts", value: String(guild.premium_subscription_count ?? 0), inline: true },
                    ],
                    description: guild.description ?? undefined,
                }),
            ],
        };
    }
    catch (err) {
        console.error("[serverinfo] error:", err);
        return { content: "⚠️ Could not fetch server info right now." };
    }
}
async function handleUserInfo(interaction) {
    const targetId = optionValue(interaction, "user") ?? callerId(interaction);
    const isSelf = targetId === callerId(interaction);
    return {
        embeds: [
            embed({
                title: `👤 ${isSelf ? callerTag(interaction) : `<@${targetId}>`}`,
                description: `<@${targetId}>`,
                fields: [{ name: "User ID", value: targetId, inline: true }],
            }),
        ],
    };
}
async function handleAnnounce(interaction) {
    if (!isAdministrator(interaction)) {
        return { content: "🚫 Only administrators can use /announce." };
    }
    const message = optionValue(interaction, "message") ?? "";
    const targetChannel = optionValue(interaction, "channel") ?? interaction.channel_id;
    if (!targetChannel)
        return { content: "⚠️ Could not determine a channel to post in." };
    try {
        await sendChannelMessage(targetChannel, {
            embeds: [embed({ title: "📢 Announcement", description: message, color: SUCCESS_COLOR })],
        });
        return { content: `✅ Announcement posted in <#${targetChannel}>.` };
    }
    catch (err) {
        console.error("[announce] error:", err);
        return { content: "⚠️ Failed to post the announcement. Check the bot's permissions in that channel." };
    }
}
async function handleClear(interaction) {
    if (!canManageMessages(interaction)) {
        return { content: "🚫 You need the Manage Messages permission to use /clear." };
    }
    const amount = optionValue(interaction, "amount") ?? 0;
    const channelId = interaction.channel_id;
    if (!channelId)
        return { content: "⚠️ Could not determine the channel." };
    if (amount < 2) {
        return { content: "⚠️ Please choose an amount of 2 or more (Discord's bulk-delete needs at least 2 messages)." };
    }
    try {
        const messages = await getRecentMessages(channelId, amount);
        if (messages.length < 2) {
            return { content: "⚠️ Not enough recent messages to delete." };
        }
        await bulkDeleteMessages(channelId, messages.map((m) => m.id));
        return { content: `🧹 Deleted ${messages.length} message(s). Note: Discord only bulk-deletes messages younger than 14 days.` };
    }
    catch (err) {
        console.error("[clear] error:", err);
        return { content: "⚠️ Failed to delete messages. Check the bot's Manage Messages permission in this channel." };
    }
}
async function handleMod(interaction) {
    if (!canModerate(interaction)) {
        return { content: "🚫 You need moderator permissions to use /mod." };
    }
    const sub = interaction.data?.options?.[0];
    const guildId = interaction.guild_id;
    if (!guildId || !sub)
        return { content: "⚠️ Invalid command usage." };
    const subOptions = sub.options ?? [];
    const getSubOpt = (name) => subOptions.find((o) => o.name === name)?.value;
    if (sub.name === "warn") {
        const targetUser = getSubOpt("user");
        const reason = getSubOpt("reason") ?? "No reason given";
        if (!targetUser)
            return { content: "⚠️ Missing target user." };
        const count = await recordWarning({
            guildId,
            userId: targetUser,
            reason,
            moderatorId: callerId(interaction),
            timestamp: Date.now(),
        });
        const alertChannel = interaction.channel_id;
        if (alertChannel) {
            await sendChannelMessage(alertChannel, {
                embeds: [
                    moderationAlertEmbed({
                        userTag: `<@${targetUser}>`,
                        reason: `Manually warned by <@${callerId(interaction)}>: ${reason}`,
                        channelMention: `<#${alertChannel}>`,
                    }),
                ],
            }).catch(() => undefined);
        }
        return {
            content: `⚠️ <@${targetUser}> has been warned (${count} total warning${count === 1 ? "" : "s"}). Reason: ${reason}`,
        };
    }
    if (sub.name === "warnings") {
        const targetUser = getSubOpt("user");
        if (!targetUser)
            return { content: "⚠️ Missing target user." };
        const warnings = await getWarnings(guildId, targetUser);
        if (warnings.length === 0)
            return { content: `<@${targetUser}> has no recorded warnings.` };
        const list = warnings
            .slice(-10)
            .map((w, i) => `${i + 1}. ${new Date(w.timestamp).toISOString().slice(0, 10)} — ${w.reason} (by <@${w.moderatorId}>)`)
            .join("\n");
        return {
            embeds: [embed({ title: `⚠️ Warnings for user`, description: list, color: WARNING_COLOR })],
            content: `<@${targetUser}> has ${warnings.length} total warning(s).`,
        };
    }
    return { content: "⚠️ Unknown /mod subcommand." };
}
async function handleAiStatus() {
    const status = await checkAiStatus();
    return {
        embeds: [
            embed({
                title: "🧠 AI Service Status",
                color: status.reachable ? SUCCESS_COLOR : WARNING_COLOR,
                fields: [
                    { name: "Model", value: status.model, inline: true },
                    { name: "Reachable", value: status.reachable ? "✅ Yes" : "❌ No", inline: true },
                    { name: "Auth configured", value: status.configured ? "✅ Yes" : "⚠️ Using platform default", inline: true },
                    ...(status.error ? [{ name: "Last error", value: status.error.slice(0, 500) }] : []),
                ],
            }),
        ],
    };
}
export async function dispatchCommand(interaction) {
    const name = interaction.data?.name;
    switch (name) {
        case "ask":
            return handleAsk(interaction);
        case "help":
            return handleHelp();
        case "rules":
            return handleRules(interaction);
        case "serverinfo":
            return handleServerInfo(interaction);
        case "userinfo":
            return handleUserInfo(interaction);
        case "announce":
            return handleAnnounce(interaction);
        case "clear":
            return handleClear(interaction);
        case "mod":
            return handleMod(interaction);
        case "ai-status":
            return handleAiStatus();
        default:
            return { content: `Unknown command: ${name}` };
    }
}
