import * as fs from "node:fs";
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder, Partials } from "discord.js";
try {
    for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) {
            const k = m[1];
            const v = m[2].replace(/^"|"$/g, "").trim();
            process.env[k] = v;
        }
    }
}
catch { }
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions],
    partials: [Partials.Message, Partials.Reaction],
});
async function ensureCat(guild, names, newName) {
    let c = guild.channels.cache.find((x) => names.includes(x.name));
    if (c) {
        if (c.name !== newName)
            await c.edit({ name: newName });
        return c;
    }
    return guild.channels.create({ name: newName, type: ChannelType.GuildCategory });
}
async function ensure(guild, names, newName, type, parent) {
    let c = guild.channels.cache.find((x) => names.includes(x.name));
    if (c) {
        await c.edit({ name: newName, parent });
        return c;
    }
    return guild.channels.create({ name: newName, type, parent });
}
async function setup(guild) {
    const catWelcome = await ensureCat(guild, [], "📬 ・ الاستقبال");
    const catPublic = await ensureCat(guild, [], "💬 ・ PUBLIC");
    const catRoles = await ensureCat(guild, [], "🎮 ・ ROLES & LEVELS");
    const catVoice = await ensureCat(guild, [], "🔊 ・ ROOM DYALEK");
    const catVip = await ensureCat(guild, [], "⭐ ・ VIP");
    const catAdmin = await ensureCat(guild, [], "🛡️ ・ الإدارة");
    const T = ChannelType.GuildText, V = ChannelType.GuildVoice;
    await ensure(guild, ["moderator-only", "🛡️・المشرفين"], "🛡️・المشرفين", T, catAdmin.id);
    await ensure(guild, ["rules", "📜・القوانين"], "⛔・Community-Rules", T, catWelcome.id);
    await ensure(guild, [], "📣・Announcement", T, catWelcome.id);
    await ensure(guild, [], "📥・Welcome", T, catWelcome.id);
    await ensure(guild, [], "🚀・Boosters", T, catWelcome.id);
    await ensure(guild, ["general", "💬・عام"], "💬・PUBLIC I", T, catPublic.id);
    await ensure(guild, ["hhh", "🎮・دردشة"], "💬・PUBLIC II", T, catPublic.id);
    await ensure(guild, [], "😂・Memes", T, catPublic.id);
    await ensure(guild, [], "🎁・Giveaway", T, catPublic.id);
    await ensure(guild, [], "🔍・Take-Roles", T, catRoles.id);
    await ensure(guild, [], "✅・Role-Tag", T, catRoles.id);
    await ensure(guild, [], "📈・levels-xp", T, catRoles.id);
    await ensure(guild, [], "➕・9AD ROOM DYALEK", V, catVoice.id);
    await ensure(guild, ["music", "🎵・موسيقى"], "🎵・Music", V, catVoice.id);
    await ensure(guild, ["kick", "🎙️・غرفة صوتية 1"], "🎙️・PUBLIC VC I", V, catVoice.id);
    await ensure(guild, ["المنتدى", "🎙️・المنتدى"], "🎙️・PUBLIC VC II", V, catVoice.id);
    await ensure(guild, ["منصة", "🎧・منصة 1", "🎧・منصة 2"], "⭐・VIP I", V, catVip.id);
    await ensure(guild, [], "⭐・VIP II", V, catVip.id);
    await ensure(guild, [], "⭐・VIP III", V, catVip.id);
    const roles = [
        ["👑 ・ المدير", "#E74C3C"],
        ["🛡️ ・ مشرف", "#3498DB"],
        ["⭐ ・ عضو نشيط", "#2ECC71"],
        ["🌱 ・ عضو جديد", "#95A5A6"],
    ];
    for (const [name, color] of roles) {
        if (!guild.roles.cache.find((r) => r.name === name))
            await guild.roles.create({ name, color: color });
    }
}
client.once("clientReady", async () => {
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.log("NO GUILD");
        process.exit(1);
    }
    await setup(guild);
    if (!guild.roles.cache.find((r) => r.name === "✅ ・ عضو"))
        await guild.roles.create({ name: "✅ ・ عضو", color: "#2ECC71" });
    const ch = guild.channels.cache.find((c) => c.name.toLowerCase().includes("role-tag") && c.isTextBased());
    if (ch) {
        const msgs = await ch.messages.fetch({ limit: 10 }).catch(() => null);
        let mine = msgs ? msgs.find((m) => m.author.id === client.user.id && m.embeds.length > 0) : null;
        if (!mine)
            mine = await ch.send({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🎽 خد الرول ديالك!").setDescription("برك على ✅ تحت هاد الرسالة باش تاخد رول **✅ ・ عضو** ودخل للقنوات كاملة!")] });
        await mine.react("✅").catch(() => { });
        console.log("REACTION ROLE READY ✅");
    }
    console.log("SETUP DONE ✨ — الترحيب والرول التلقائي خدامين دابا");
});
client.on("guildMemberAdd", async (member) => {
    const guild = member.guild;
    const role = guild.roles.cache.find((r) => r.name.includes("عضو جديد"));
    if (role)
        await member.roles.add(role).catch(() => { });
    const ch = guild.channels.cache.find((c) => c.name.toLowerCase().includes("welcome") && c.isTextBased());
    if (ch) {
        const emb = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🎉 مرحبا بيك فـ " + guild.name + "!")
            .setDescription("اهلا " + member.toString() + " ! نورتنا 🌟\n⛔ قرا القوانين فـ ⛔・Community-Rules\n🎙️ دخل للصوتيات وتهضر معانا!")
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: "عضو رقم " + guild.memberCount });
        await ch.send({ embeds: [emb] }).catch(() => { });
    }
});
client.on("messageReactionAdd", async (reaction, user) => {
    try {
        if (reaction.partial)
            await reaction.fetch();
        if (user.bot)
            return;
        if (reaction.emoji.name !== "✅")
            return;
        const msg = reaction.message;
        if (!msg.guild)
            return;
        if (!msg.channel || !String(msg.channel.name).toLowerCase().includes("role-tag"))
            return;
        if (!msg.author || msg.author.id !== client.user.id)
            return;
        const member = await msg.guild.members.fetch(user.id);
        const role = msg.guild.roles.cache.find((r) => r.name === "✅ ・ عضو");
        if (role)
            await member.roles.add(role);
        console.log("ROLE GIVEN:", user.tag);
    }
    catch (e) { }
});
client.login(process.env.DISCORD_BOT_TOKEN);
