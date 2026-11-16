import { ChannelType, EmbedBuilder, Events, } from "discord.js";
import { client } from "../client.js";
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        if (member.user.bot)
            return;
        const welcomeChannel = member.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText &&
            channel.topic === "COMMUNITY_MANAGER_WELCOME");
        if (!welcomeChannel) {
            console.log("[WELCOME] Welcome channel not found");
            return;
        }
        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🎉 Welcome to our Community!")
            .setDescription(`مرحباً بك **${member.displayName}**!\n\n` +
            `نحن سعداء لانضمامك إلى **${member.guild.name}**.\n` +
            "يرجى قراءة القوانين والمشاركة معنا.")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields({ name: "👤 Member", value: member.user.username, inline: true }, { name: "📊 Member Number", value: `${member.guild.memberCount}`, inline: true })
            .setFooter({ text: "Community Manager • Welcome System" })
            .setTimestamp();
        await welcomeChannel.send({
            content: `مرحباً ${member}! 👋`,
            embeds: [embed],
            allowedMentions: { users: [member.id] },
        });
    }
    catch (error) {
        console.error("[WELCOME ERROR]", error);
    }
});
