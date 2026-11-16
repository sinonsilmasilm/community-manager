import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGuildConfig, updateGuildConfig } from "../src/lib/config.js";
import { checkAiStatus } from "../src/lib/ai.js";
import { isPersistent } from "../src/lib/storage.js";
import { GuildConfig } from "../src/types.js";

function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expected) return false; // dashboard is disabled until a token is set
  const header = req.headers.authorization;
  return header === `Bearer ${expected}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Basic CORS for the static dashboard page hosted alongside this function.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized. Set ADMIN_DASHBOARD_TOKEN and send it as a Bearer token." });
    return;
  }

  const guildId = (req.query.guildId as string) || "";
  if (!guildId) {
    res.status(400).json({ error: "guildId query parameter is required" });
    return;
  }

  if (req.method === "GET") {
    const [config, aiStatus] = await Promise.all([getGuildConfig(guildId), checkAiStatus()]);
    res.status(200).json({ config, aiStatus, persistent: isPersistent });
    return;
  }

  if (req.method === "POST") {
    let body: Partial<GuildConfig>;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    const updated = await updateGuildConfig(guildId, body);
    res.status(200).json({ config: updated });
    return;
  }

  res.status(405).send("Method Not Allowed");
}
