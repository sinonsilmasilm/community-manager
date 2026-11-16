import { kvGet, kvListPush } from "./storage.js";
// Per-process memory of recent activity, keyed by `${guildId}:${userId}`.
// This only needs to live for the duration of the gateway worker process.
const activityMap = new Map();
function getActivity(key) {
    let a = activityMap.get(key);
    if (!a) {
        a = { recentTimestamps: [], lastMessages: [] };
        activityMap.set(key, a);
    }
    return a;
}
/**
 * Evaluates a single message against configurable moderation rules.
 * Returns a list of flags (possibly empty). Multiple flags can fire at once.
 * This function NEVER decides punishment — callers must apply the server's
 * configured, human-reviewable escalation policy (warn → notify mods →
 * human decides on timeout/kick/ban). See /mod command and warnThreshold.
 */
export function evaluateMessage(config, guildId, userId, content, mentionCount) {
    const flags = [];
    const mod = config.moderation;
    const key = `${guildId}:${userId}`;
    const activity = getActivity(key);
    const now = Date.now();
    if (mod.spamEnabled) {
        activity.recentTimestamps.push(now);
        const windowMs = mod.spamWindowSeconds * 1000;
        activity.recentTimestamps = activity.recentTimestamps.filter((t) => now - t <= windowMs);
        if (activity.recentTimestamps.length > mod.spamMessageThreshold) {
            flags.push({
                reason: "spam_rate",
                detail: `${activity.recentTimestamps.length} messages in ${mod.spamWindowSeconds}s`,
            });
        }
        activity.lastMessages.push(content.trim().toLowerCase());
        if (activity.lastMessages.length > mod.repeatedMessageThreshold) {
            activity.lastMessages.shift();
        }
        if (activity.lastMessages.length === mod.repeatedMessageThreshold &&
            activity.lastMessages.every((m) => m === activity.lastMessages[0] && m.length > 0)) {
            flags.push({
                reason: "repeated_message",
                detail: `Same message repeated ${mod.repeatedMessageThreshold}x`,
            });
        }
    }
    if (mentionCount >= mod.mentionAbuseThreshold) {
        flags.push({ reason: "mention_abuse", detail: `${mentionCount} mentions in one message` });
    }
    const lowerContent = content.toLowerCase();
    for (const word of mod.bannedWords) {
        if (word && lowerContent.includes(word.toLowerCase())) {
            flags.push({ reason: "banned_word", detail: `Contains filtered term` });
            break;
        }
    }
    if (mod.linkFilterEnabled) {
        const urls = content.match(/https?:\/\/([^\s/]+)/gi) || [];
        for (const url of urls) {
            const domainMatch = url.match(/https?:\/\/([^\s/]+)/i);
            const domain = domainMatch?.[1]?.toLowerCase().replace(/^www\./, "");
            if (domain && !mod.allowedLinkDomains.some((d) => domain.endsWith(d.toLowerCase()))) {
                flags.push({ reason: "unapproved_link", detail: `Link to unapproved domain: ${domain}` });
                break;
            }
        }
    }
    return flags;
}
export async function recordWarning(warning) {
    const key = `warnings:${warning.guildId}:${warning.userId}`;
    await kvListPush(key, warning, 200);
    const all = (await kvGet(key)) ?? [];
    return all.length;
}
export async function getWarnings(guildId, userId) {
    return (await kvGet(`warnings:${guildId}:${userId}`)) ?? [];
}
