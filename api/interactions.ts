import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { verifyDiscordRequest } from "../src/lib/discord-verify.js";
import { dispatchCommand } from "../src/commands/handlers.js";
import { editOriginalInteractionResponse } from "../src/lib/discord-api.js";
import { DiscordInteraction } from "../src/types.js";

// Discord interaction types/response-types (subset we use).
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
const ResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;

// Vercel's Node runtime parses JSON bodies automatically, but Discord's
// signature check needs the EXACT raw bytes — so we disable the automatic
// body parser and read/verify the raw body ourselves.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[interactions] DISCORD_PUBLIC_KEY is not configured");
    res.status(500).send("Server misconfigured");
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-signature-ed25519"] as string | undefined;
  const timestamp = req.headers["x-signature-timestamp"] as string | undefined;

  const valid = verifyDiscordRequest(publicKey, signature, timestamp, rawBody);
  if (!valid) {
    res.status(401).send("Invalid request signature");
    return;
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === InteractionType.PING) {
    res.status(200).json({ type: ResponseType.PONG });
    return;
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // ACK immediately (Discord requires a response within 3 seconds), then
    // do the real work in the background and PATCH the response in once
    // it's ready. waitUntil keeps the function alive after we respond.
    res.status(200).json({ type: ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

    const applicationId = process.env.DISCORD_APPLICATION_ID;
    waitUntil(
      (async () => {
        try {
          const result = await dispatchCommand(interaction);
          if (applicationId) {
            await editOriginalInteractionResponse(applicationId, interaction.token, result);
          }
        } catch (err) {
          console.error("[interactions] command handling failed:", err);
          if (applicationId) {
            await editOriginalInteractionResponse(applicationId, interaction.token, {
              content: "⚠️ Something went wrong handling that command.",
            }).catch(() => undefined);
          }
        }
      })()
    );
    return;
  }

  res.status(400).send("Unhandled interaction type");
}
