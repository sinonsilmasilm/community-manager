const API_BASE = "https://discord.com/api/v10";

function botHeaders(): Record<string, string> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

async function discordFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...botHeaders(), ...init?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord API ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res;
}

export async function sendChannelMessage(
  channelId: string,
  payload: { content?: string; embeds?: unknown[] }
): Promise<void> {
  await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function editOriginalInteractionResponse(
  applicationId: string,
  interactionToken: string,
  payload: { content?: string; embeds?: unknown[] }
): Promise<void> {
  await fetch(`${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getRecentMessages(channelId: string, limit: number): Promise<Array<{ id: string }>> {
  const res = await discordFetch(`/channels/${channelId}/messages?limit=${limit}`);
  return res.json() as Promise<Array<{ id: string }>>;
}

export async function bulkDeleteMessages(channelId: string, messageIds: string[]): Promise<void> {
  // Discord's bulk-delete endpoint only accepts 2-100 IDs, and refuses
  // messages older than 14 days. Single-message fallback is intentionally
  // NOT implemented here to keep /clear fast and predictable — if fewer
  // than 2 messages matched, the caller should skip the call.
  await discordFetch(`/channels/${channelId}/messages/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ messages: messageIds }),
  });
}

export async function getGuild(guildId: string): Promise<{
  name: string;
  approximate_member_count?: number;
  owner_id?: string;
  premium_subscription_count?: number;
  description?: string | null;
}> {
  const res = await discordFetch(`/guilds/${guildId}?with_counts=true`);
  return res.json() as Promise<{
    name: string;
    approximate_member_count?: number;
    owner_id?: string;
    premium_subscription_count?: number;
    description?: string | null;
  }>;
}
