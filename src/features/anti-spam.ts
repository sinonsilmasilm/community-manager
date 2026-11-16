
import {
  Events,
  type Client,
  type Message,
} from "discord.js";

const messageHistory = new Map<string, number[]>();
const warnedUsers = new Set<string>();

const MAX_MESSAGES = 6;
const WINDOW_MS = 5000;
const TIMEOUT_MS = 60_000;

export function registerAntiSpam(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (!message.guild || message.author.bot) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();

    const timestamps = (
      messageHistory.get(key) || []
    ).filter(time => now - time < WINDOW_MS);

    timestamps.push(now);
    messageHistory.set(key, timestamps);

    if (timestamps.length <= MAX_MESSAGES) return;

    try {
      if (!message.member?.moderatable) return;

      await message.member.timeout(
        TIMEOUT_MS,
        "Community Manager: anti-spam protection"
      );

      if (!warnedUsers.has(key)) {
        warnedUsers.add(key);

        if (!("send" in message.channel)) return;
        await message.channel.send({
          content:
            `⚠️ تم إيقاف الرسائل المزعجة مؤقتاً من ${message.author}.`,
          allowedMentions: { users: [] },
        });
      }

    } catch (error) {
      console.error("[ANTI-SPAM]", error);
    } finally {
      messageHistory.delete(key);
    }
  });
}
