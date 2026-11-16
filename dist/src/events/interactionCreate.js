import { Events } from "discord.js";
import { client } from "../client.js";
import { dispatchCommand } from "../commands/handlers.js";
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const raw = {
        id: interaction.id,
        token: interaction.token,
        application_id: interaction.applicationId,
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        user: { id: interaction.user.id, username: interaction.user.username },
        member: interaction.inGuild()
            ? {
                user: { id: interaction.user.id, username: interaction.user.username },
                permissions: interaction.memberPermissions?.bitfield.toString(),
            }
            : undefined,
        data: {
            name: interaction.commandName,
            options: interaction.options.data.map((o) => ({
                name: o.name,
                type: o.type,
                value: o.value,
                options: o.options,
            })),
        },
    };
    try {
        await interaction.deferReply();
        const res = await dispatchCommand(raw);
        await interaction.editReply({
            content: res?.content ?? undefined,
            embeds: res?.embeds ?? undefined,
        });
    }
    catch (e) {
        console.error("[CMD ERROR]", e);
        await interaction
            .editReply({ content: "وقع مشكل فهاد الأمر، عاود جرب." })
            .catch(() => { });
    }
});
