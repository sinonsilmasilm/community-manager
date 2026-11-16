import { Events, MessageType } from "discord.js";
import { client } from "../client.js";
import { dispatchCommand } from "../commands/handlers.js";

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.type !== MessageType.Default) return;
  const content = message.content.trim();
  if (!content.startsWith("/")) return;

  const [cmd, ...rest] = content.slice(1).split(/\s+/);
  const name = (cmd || "").toLowerCase();
  if (!["ask", "help", "rules", "serverinfo", "ai-status"].includes(name)) return;

  console.log(`[TEXT CMD] ${name} - ${message.author.username}`);
  const args = rest.join(" ");
  const raw: any = {
    id: message.id,
    guild_id: message.guildId,
    channel_id: message.channelId,
    user: { id: message.author.id, username: message.author.username },
    member: message.member
      ? {
          user: { id: message.author.id, username: message.author.username },
          permissions: message.member.permissions?.bitfield.toString(),
        }
      : undefined,
    data: {
      name,
      options: name === "ask" ? [{ name: "question", type: 3, value: args }] : [],
    },
  };

  try {
    const res: any = await dispatchCommand(raw);
    await message.reply({
      content: res?.content ?? undefined,
      embeds: res?.embeds ?? undefined,
    });
  } catch (e) {
    console.error("[TEXT CMD ERROR]", e);
    await message.reply("وقع مشكل فهاد الأمر، عاود جرب.").catch(() => {});
  }
});
