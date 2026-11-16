import { DiscordInteraction } from "../types.js";

// Discord permission bitflags we care about (subset).
// Full list: https://discord.com/developers/docs/topics/permissions
const PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_MESSAGES: 1n << 13n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MODERATE_MEMBERS: 1n << 40n, // timeout members
} as const;

function hasPermission(permissionsField: string | undefined, flag: bigint): boolean {
  if (!permissionsField) return false;
  try {
    const perms = BigInt(permissionsField);
    return (perms & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR || (perms & flag) === flag;
  } catch {
    return false;
  }
}

function isEnvAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.BOT_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export function isAdministrator(interaction: DiscordInteraction): boolean {
  const userId = interaction.member?.user.id ?? interaction.user?.id;
  return hasPermission(interaction.member?.permissions, PERMISSIONS.ADMINISTRATOR) || isEnvAdmin(userId);
}

export function canManageMessages(interaction: DiscordInteraction): boolean {
  return (
    isAdministrator(interaction) ||
    hasPermission(interaction.member?.permissions, PERMISSIONS.MANAGE_MESSAGES)
  );
}

export function canModerate(interaction: DiscordInteraction): boolean {
  return (
    isAdministrator(interaction) ||
    hasPermission(interaction.member?.permissions, PERMISSIONS.MODERATE_MEMBERS) ||
    hasPermission(interaction.member?.permissions, PERMISSIONS.KICK_MEMBERS) ||
    hasPermission(interaction.member?.permissions, PERMISSIONS.BAN_MEMBERS)
  );
}

export function canManageGuild(interaction: DiscordInteraction): boolean {
  return isAdministrator(interaction) || hasPermission(interaction.member?.permissions, PERMISSIONS.MANAGE_GUILD);
}
