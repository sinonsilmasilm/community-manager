import { AuditLogEvent, EmbedBuilder, Events, } from "discord.js";
export function registerModLogs(client) {
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            const logs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 5,
            });
            const entry = logs.entries.find(item => item.target?.id === member.id &&
                Date.now() - item.createdTimestamp < 10_000);
            const channel = member.guild.channels.cache.find(c => c.name === "mod-logs" && c.isTextBased());
            if (!channel || !channel.isTextBased())
                return;
            const embed = new EmbedBuilder()
                .setColor("#E67E22")
                .setTitle("Member Left")
                .setDescription(`Member: ${member.user.tag}\n` +
                `Kick detected: ${entry ? "Yes" : "Not confirmed"}`)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            console.error("[MOD LOGS]", error);
        }
    });
}
