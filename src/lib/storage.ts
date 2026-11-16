// Thin persistence layer. If Vercel KV / Upstash Redis REST credentials are
// present (KV_REST_API_URL + KV_REST_API_TOKEN), config and warnings persist
// there. Otherwise the bot falls back to an in-memory Map, which is fine for
// local testing but will NOT survive a serverless cold start or a gateway
// worker restart. For real deployments, set up a free Upstash Redis database
// and paste its REST URL/token into .env — no code changes needed.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const memoryStore = new Map<string, string>();

async function kvFetch(path: string, init?: RequestInit): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  const res = await fetch(`${KV_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`KV request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (KV_URL && KV_TOKEN) {
    try {
      const data = (await kvFetch(`/get/${encodeURIComponent(key)}`)) as { result: string | null };
      return data.result ? (JSON.parse(data.result) as T) : null;
    } catch (err) {
      console.error("[storage] KV get failed, falling back to memory:", err);
    }
  }
  const raw = memoryStore.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  if (KV_URL && KV_TOKEN) {
    try {
      await kvFetch(`/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serialized),
      });
      return;
    } catch (err) {
      console.error("[storage] KV set failed, falling back to memory:", err);
    }
  }
  memoryStore.set(key, serialized);
}

export async function kvListPush<T>(key: string, value: T, maxLength = 100): Promise<void> {
  const existing = (await kvGet<T[]>(key)) ?? [];
  existing.push(value);
  while (existing.length > maxLength) existing.shift();
  await kvSet(key, existing);
}

export const isPersistent = Boolean(KV_URL && KV_TOKEN);
