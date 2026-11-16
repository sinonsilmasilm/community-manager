// ── Gateway Worker ───────────────────────────────────────────────────────
// This is the ONE part of Community Manager that needs a persistent process
// (it holds a long-lived WebSocket connection to Discord). It intentionally
// does NOT run as a Vercel serverless function — the project brief explicitly
// calls that out as unsafe/unsupported. Run this instead on:
//   • Railway / Fly.io / Render (free tiers exist, just `npm run gateway`)
//   • A small always-on VPS with pm2 (`pm2 start npm -- run gateway`)
//   • Termux on your Android phone + pm2/tmux, if you want zero extra cost
//     while testing (see README's Android-friendly setup guide)
//
// Responsibilities:
//   • Welcome messages + optional auto-role on member join
//   • Real-time moderation: spam rate, repeated messages, mention abuse,
//     banned words, unapproved links → alerts moderators, never auto-bans
//
// Slash commands (/ask, /clear, /mod, etc.) do NOT run here — those are
// handled entirely by api/interactions.ts on Vercel.

import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import { getGuildConfig } from "../lib/config.js";
import { evaluateMessage, recordWarning } from "../lib/moderation.js";
import { welcomeEmbed, moderationAlertEmbed } from "../lib/embeds.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("[gateway] DISCORD_BOT_TOKEN is not set — cannot start.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // required for welcome messages / auto-role
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // required to inspect message text for moderation
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[gateway] Logged in as ${c.user.tag}. Watching ${c.guilds.cache.size} guild(s).`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const config = await getGuildConfig(member.guild.id);
    if (!config.welcomeChannelId) return;

    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const e = welcomeEmbed({
      username: member.user.username,
      guildName: member.guild.name,
      memberCount: member.guild.memberCount,
      customMessage: config.welcomeMessage,
    });
    await channel.send({ embeds: [e as never] });

    if (config.autoRoleId) {
      await member.roles.add(config.autoRoleId).catch((err) => {
        console.error(`[gateway] Failed to assign auto-role in guild ${member.guild.id}:`, err);
      });
    }
  } catch (err) {
    console.error("[gateway] GuildMemberAdd handler error:", err);
  }
});

// Debounces repeated alerts for the same user+reason within a short window
// so one burst of spam produces one alert, not twenty.
const recentAlerts = new Map<string, number>();
function shouldAlert(key: string, cooldownMs = 30_000): boolean {
  const now = Date.now();
  const last = recentAlerts.get(key) ?? 0;
  if (now - last < cooldownMs) return false;
  recentAlerts.set(key, now);
  return true;
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    const config = await getGuildConfig(message.guild.id);
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const flags = evaluateMessage(config, message.guild.id, message.author.id, message.content, mentionCount);
    if (flags.length === 0) return;

    // Never auto-punish on a flag — only ever notify moderators and log a
    // warning record so a human can review and decide (per project spec:
    // "Never permanently ban or punish members solely based on uncertain
    // AI classifications. Require clear rules and configurable thresholds.")
    const reasonSummary = flags.map((f) => f.detail).join("; ");
    await recordWarning({
      guildId: message.guild.id,
      userId: message.author.id,
      reason: `Auto-flagged: ${reasonSummary}`,
      moderatorId: "AUTO",
      timestamp: Date.now(),
    });

    const alertKey = `${message.guild.id}:${message.author.id}:${flags[0]?.reason}`;
    if (config.modLogChannelId && shouldAlert(alertKey)) {
      const logChannel = await message.guild.channels.fetch(config.modLogChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [
            moderationAlertEmbed({
              userTag: `${message.author.tag} (<@${message.author.id}>)`,
              reason: reasonSummary,
              channelMention: `<#${message.channel.id}>`,
              excerpt: message.content,
            }) as never,
          ],
        });
      }
    }
  } catch (err) {
    console.error("[gateway] MessageCreate handler error:", err);
  }
});

client.login(token).catch((err) => {
  console.error("[gateway] Failed to log in:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("[gateway] Shutting down...");
  client.destroy();
  process.exit(0);
});
