import * as fs from "node:fs";
import { Client, GatewayIntentBits, ChannelType } from "discord.js";
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) {
      const k = m[1] as string;
      const v = (m[2] as string).replace(/^"|"$/g, "").trim();
      process.env[k] = v;
    }
  }
} catch {}
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  const guild = client.guilds.cache.first() as any;
  if (!guild) { console.log("NO GUILD"); process.exit(1); }
  console.log("Guild:", guild.name);
  const catInfo = await guild.channels.create({ name: "📌 ・ معلومات", type: ChannelType.GuildCategory });
  const catText = await guild.channels.create({ name: "💬 ・ القنوات النصية", type: ChannelType.GuildCategory });
  const catVoice = await guild.channels.create({ name: "🔊 ・ القنوات الصوتية", type: ChannelType.GuildCategory });
  const catAdmin = await guild.channels.create({ name: "🛡️ ・ الإدارة", type: ChannelType.GuildCategory });
  const byName = (n: string) => guild.channels.cache.find((c: any) => c.name === n);
  const moves: Array<[string, string, string]> = [
    ["rules", "📜・القوانين", catInfo.id],
    ["moderator-only", "🛡️・المشرفين", catAdmin.id],
    ["general", "💬・عام", catText.id],
    ["hhh", "🎮・دردشة", catText.id],
    ["music", "🎵・موسيقى", catVoice.id],
    ["kick", "🎙️・غرفة صوتية 1", catVoice.id],
    ["المنتدى", "🎙️・المنتدى", catVoice.id],
  ];
  for (const [oldName, newName, parent] of moves) {
    const ch = byName(oldName);
    if (ch) { await ch.edit({ name: newName, parent }); console.log("moved:", oldName); }
  }
  let i = 1;
  for (const [, ch] of guild.channels.cache.filter((c: any) => c.name === "منصة")) {
    await (ch as any).edit({ name: "🎧・منصة " + i, parent: catVoice.id }); i++;
  }
  const general = byName("💬・عام");
  if (general && general.type === ChannelType.GuildText) await general.edit({ topic: "💬 قناة عامة للجميع — تعاملو باحترام!" });
  const rules = byName("📜・القوانين");
  if (rules && rules.type === ChannelType.GuildText) await rules.edit({ topic: "📜 قوانين السيرفر — قراها قبل ما تكتب!" });
  const roles: Array<[string, string]> = [
    ["👑 ・ المدير", "#E74C3C"],
    ["🛡️ ・ مشرف", "#3498DB"],
    ["⭐ ・ عضو نشيط", "#2ECC71"],
    ["🌱 ・ عضو جديد", "#95A5A6"],
  ];
  for (const [name, color] of roles) {
    if (!guild.roles.cache.find((r: any) => r.name === name)) {
      await guild.roles.create({ name, color: color as any });
      console.log("role:", name);
    }
  }
  console.log("DONE ✨ السيرفر تجمّل!");
  process.exit(0);
});
client.login(process.env.DISCORD_BOT_TOKEN);
