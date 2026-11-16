export const serverTemplate = {
    categories: [
        {
            name: "📌・INFORMATION",
            channels: [
                "welcome",
                "rules",
                "announcements",
            ],
        },
        {
            name: "🌍・COMMUNITY",
            channels: [
                "general",
                "introductions",
                "media",
                "suggestions",
            ],
        },
        {
            name: "🎮・GAMING",
            channels: [
                "gaming-chat",
                "events",
            ],
        },
        {
            name: "🆘・SUPPORT",
            channels: [
                "help",
                "tickets",
            ],
        },
        {
            name: "🛡️・STAFF",
            channels: [
                "staff-chat",
                "mod-logs",
                "reports",
            ],
        },
    ],
    roles: [
        "Owner",
        "Admin",
        "Moderator",
        "VIP",
        "Member",
        "Muted",
    ],
    welcome: {
        enabled: true,
        title: "Welcome to our Community!",
        message: "مرحباً بك في مجتمعنا! اقرأ القوانين وشاركنا.",
    },
    security: {
        antiSpam: true,
        antiRaid: true,
        linkProtection: true,
        moderationLogs: true,
    },
};
