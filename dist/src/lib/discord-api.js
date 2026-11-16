const API_BASE = "https://discord.com/api/v10";
function botHeaders() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token)
        throw new Error("DISCORD_BOT_TOKEN is not set");
    return {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
    };
}
async function discordFetch(path, init) {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...botHeaders(), ...init?.headers } });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Discord API ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
    }
    return res;
}
export async function sendChannelMessage(channelId, payload) {
    await discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
export async function editOriginalInteractionResponse(applicationId, interactionToken, payload) {
    await fetch(`${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}
export async function getRecentMessages(channelId, limit) {
    const res = await discordFetch(`/channels/${channelId}/messages?limit=${limit}`);
    return res.json();
}
export async function bulkDeleteMessages(channelId, messageIds) {
    // Discord's bulk-delete endpoint only accepts 2-100 IDs, and refuses
    // messages older than 14 days. Single-message fallback is intentionally
    // NOT implemented here to keep /clear fast and predictable — if fewer
    // than 2 messages matched, the caller should skip the call.
    await discordFetch(`/channels/${channelId}/messages/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ messages: messageIds }),
    });
}
export async function getGuild(guildId) {
    const res = await discordFetch(`/guilds/${guildId}?with_counts=true`);
    return res.json();
}
