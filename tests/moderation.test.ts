import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMessage } from "../src/lib/moderation.js";
import { DEFAULT_GUILD_CONFIG, GuildConfig } from "../src/types.js";

function cfg(overrides: Partial<GuildConfig["moderation"]> = {}): GuildConfig {
  return {
    guildId: "test-guild",
    ...DEFAULT_GUILD_CONFIG,
    moderation: { ...DEFAULT_GUILD_CONFIG.moderation, ...overrides },
  };
}

test("flags mention abuse when threshold exceeded", () => {
  const config = cfg({ mentionAbuseThreshold: 3 });
  const flags = evaluateMessage(config, "g1", "u1", "hey everyone", 5);
  assert.ok(flags.some((f) => f.reason === "mention_abuse"));
});

test("does not flag normal single mentions", () => {
  const config = cfg({ mentionAbuseThreshold: 3 });
  const flags = evaluateMessage(config, "g1", "u2", "hi there", 1);
  assert.equal(flags.length, 0);
});

test("flags banned words case-insensitively", () => {
  const config = cfg({ bannedWords: ["forbidden"] });
  const flags = evaluateMessage(config, "g1", "u3", "this is FORBIDDEN content", 0);
  assert.ok(flags.some((f) => f.reason === "banned_word"));
});

test("flags unapproved links but allows whitelisted domains", () => {
  const config = cfg({ linkFilterEnabled: true, allowedLinkDomains: ["youtube.com"] });
  const flaggedResult = evaluateMessage(config, "g1", "u4", "check http://scam-site.ru/x", 0);
  assert.ok(flaggedResult.some((f) => f.reason === "unapproved_link"));

  const allowedResult = evaluateMessage(config, "g1", "u5", "check https://youtube.com/watch?v=1", 0);
  assert.ok(!allowedResult.some((f) => f.reason === "unapproved_link"));
});

test("flags rapid repeated identical messages", () => {
  const config = cfg({ repeatedMessageThreshold: 3, spamMessageThreshold: 999 });
  evaluateMessage(config, "g2", "u6", "buy now", 0);
  evaluateMessage(config, "g2", "u6", "buy now", 0);
  const flags = evaluateMessage(config, "g2", "u6", "buy now", 0);
  assert.ok(flags.some((f) => f.reason === "repeated_message"));
});
