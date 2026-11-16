// Discord application command definitions.
// Registered via scripts/register-commands.ts.
// default_member_permissions is a stringified permission bitfield that hides
// the command from members who lack it (Discord-native enforcement) — the
// handler ALSO re-checks permissions server-side, since client-side command
// visibility is only a convenience, never a security boundary on its own.

const PERMS = {
  ADMINISTRATOR: "8",
  MANAGE_MESSAGES: "8192",
  MODERATE_MEMBERS: "1099511627776",
};

export const commandDefinitions = [
  {
    name: "ask",
    description: "Ask the AI assistant a question / اسأل المساعد الذكي",
    options: [
      {
        name: "question",
        description: "Your question",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "help",
    description: "Show available commands / عرض الأوامر المتاحة",
  },
  {
    name: "rules",
    description: "Display the server rules / عرض قوانين السيرفر",
  },
  {
    name: "serverinfo",
    description: "Show information about this server",
  },
  {
    name: "userinfo",
    description: "Show information about a member",
    options: [
      {
        name: "user",
        description: "The member to look up (defaults to you)",
        type: 6, // USER
        required: false,
      },
    ],
  },
  {
    name: "announce",
    description: "Post an announcement (administrators only)",
    default_member_permissions: PERMS.ADMINISTRATOR,
    options: [
      {
        name: "message",
        description: "Announcement text",
        type: 3,
        required: true,
      },
      {
        name: "channel",
        description: "Channel to post in (defaults to current channel)",
        type: 7, // CHANNEL
        required: false,
      },
    ],
  },
  {
    name: "clear",
    description: "Delete a number of recent messages (moderators only)",
    default_member_permissions: PERMS.MANAGE_MESSAGES,
    options: [
      {
        name: "amount",
        description: "How many messages to delete (1-100)",
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ],
  },
  {
    name: "mod",
    description: "Moderation tools (moderators only)",
    default_member_permissions: PERMS.MODERATE_MEMBERS,
    options: [
      {
        name: "warn",
        description: "Issue a warning to a member",
        type: 1, // SUB_COMMAND
        options: [
          { name: "user", description: "Member to warn", type: 6, required: true },
          { name: "reason", description: "Reason for the warning", type: 3, required: true },
        ],
      },
      {
        name: "warnings",
        description: "List a member's warnings",
        type: 1,
        options: [{ name: "user", description: "Member to check", type: 6, required: true }],
      },
    ],
  },
  {
    name: "ai-status",
    description: "Show AI service status",
  },
] as const;
