// Vanilla JS — no build step, so this dashboard works as plain static files
// served by Vercel with zero extra tooling.

const I18N = {
  ar: {
    connect_title: "الاتصال",
    guild_id_label: "معرّف السيرفر (Guild ID)",
    token_label: "رمز لوحة التحكم (Admin Token)",
    connect_btn: "اتصال",
    welcome_section: "إعدادات الترحيب",
    welcome_channel: "قناة الترحيب (Channel ID)",
    welcome_msg: "رسالة الترحيب المخصصة",
    auto_role: "الرتبة التلقائية (Role ID)",
    mod_section: "إعدادات الإشراف",
    mod_log_channel: "قناة سجلات الإشراف (Channel ID)",
    spam_enabled: "تفعيل كشف السبام",
    spam_threshold: "عدد الرسائل",
    spam_window: "خلال (ثواني)",
    repeat_threshold: "تكرار الرسالة نفسها",
    mention_threshold: "حد الإشارات (Mentions)",
    link_filter: "تفعيل فلترة الروابط",
    allowed_domains: "النطاقات المسموحة (مفصولة بفاصلة)",
    banned_words: "الكلمات الممنوعة (مفصولة بفاصلة)",
    warn_threshold: "عدد التحذيرات قبل التصعيد",
    save_btn: "حفظ التغييرات",
    footer_note:
      'هذه اللوحة تتحكم في إعدادات الترحيب والإشراف المخزّنة في قاعدة البيانات. ميزات مثل كشف السبام الفعلي والترحيب التلقائي تتطلب تشغيل "Gateway Worker" (راجع README).',
  },
  en: {
    connect_title: "Connect",
    guild_id_label: "Server (Guild) ID",
    token_label: "Admin Dashboard Token",
    connect_btn: "Connect",
    welcome_section: "Welcome Settings",
    welcome_channel: "Welcome Channel ID",
    welcome_msg: "Custom Welcome Message",
    auto_role: "Auto-assigned Role ID",
    mod_section: "Moderation Settings",
    mod_log_channel: "Mod Log Channel ID",
    spam_enabled: "Enable spam detection",
    spam_threshold: "Message count",
    spam_window: "Within (seconds)",
    repeat_threshold: "Repeated identical messages",
    mention_threshold: "Mention abuse threshold",
    link_filter: "Enable link filtering",
    allowed_domains: "Allowed domains (comma-separated)",
    banned_words: "Banned words (comma-separated)",
    warn_threshold: "Warnings before escalation",
    save_btn: "Save Changes",
    footer_note:
      'This dashboard controls welcome/moderation settings stored in the database. Live features like real-time spam detection and auto-welcome require the "Gateway Worker" process to be running (see README).',
  },
};

let currentLang = "ar";

function applyI18n() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (I18N[currentLang][key]) el.textContent = I18N[currentLang][key];
  });
  document.getElementById("langToggle").textContent = currentLang === "ar" ? "English" : "العربية";
}

document.getElementById("langToggle").addEventListener("click", () => {
  currentLang = currentLang === "ar" ? "en" : "ar";
  applyI18n();
});

let authToken = "";
let guildId = "";

function apiBase() {
  return "/api/dashboard-api";
}

async function loadConfig() {
  const res = await fetch(`${apiBase()}?guildId=${encodeURIComponent(guildId)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function saveConfig(patch) {
  const res = await fetch(`${apiBase()}?guildId=${encodeURIComponent(guildId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function fillForm(config) {
  document.getElementById("welcomeChannelId").value = config.welcomeChannelId || "";
  document.getElementById("welcomeMessage").value = config.welcomeMessage || "";
  document.getElementById("autoRoleId").value = config.autoRoleId || "";
  document.getElementById("modLogChannelId").value = config.modLogChannelId || "";
  document.getElementById("spamEnabled").checked = Boolean(config.moderation.spamEnabled);
  document.getElementById("spamMessageThreshold").value = config.moderation.spamMessageThreshold;
  document.getElementById("spamWindowSeconds").value = config.moderation.spamWindowSeconds;
  document.getElementById("repeatedMessageThreshold").value = config.moderation.repeatedMessageThreshold;
  document.getElementById("mentionAbuseThreshold").value = config.moderation.mentionAbuseThreshold;
  document.getElementById("linkFilterEnabled").checked = Boolean(config.moderation.linkFilterEnabled);
  document.getElementById("allowedLinkDomains").value = (config.moderation.allowedLinkDomains || []).join(", ");
  document.getElementById("bannedWords").value = (config.moderation.bannedWords || []).join(", ");
  document.getElementById("warnThreshold").value = config.moderation.warnThreshold;
}

function readForm() {
  return {
    welcomeChannelId: document.getElementById("welcomeChannelId").value.trim() || null,
    welcomeMessage: document.getElementById("welcomeMessage").value.trim() || null,
    autoRoleId: document.getElementById("autoRoleId").value.trim() || null,
    modLogChannelId: document.getElementById("modLogChannelId").value.trim() || null,
    moderation: {
      spamEnabled: document.getElementById("spamEnabled").checked,
      spamMessageThreshold: Number(document.getElementById("spamMessageThreshold").value) || 1,
      spamWindowSeconds: Number(document.getElementById("spamWindowSeconds").value) || 1,
      repeatedMessageThreshold: Number(document.getElementById("repeatedMessageThreshold").value) || 1,
      mentionAbuseThreshold: Number(document.getElementById("mentionAbuseThreshold").value) || 1,
      linkFilterEnabled: document.getElementById("linkFilterEnabled").checked,
      allowedLinkDomains: document
        .getElementById("allowedLinkDomains")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      bannedWords: document
        .getElementById("bannedWords")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      warnThreshold: Number(document.getElementById("warnThreshold").value) || 1,
    },
  };
}

document.getElementById("connectBtn").addEventListener("click", async () => {
  const errorEl = document.getElementById("authError");
  errorEl.textContent = "";
  guildId = document.getElementById("guildIdInput").value.trim();
  authToken = document.getElementById("tokenInput").value.trim();
  if (!guildId || !authToken) {
    errorEl.textContent = currentLang === "ar" ? "الرجاء إدخال كل الحقول" : "Please fill in all fields";
    return;
  }
  try {
    const data = await loadConfig();
    fillForm(data.config);
    document.getElementById("aiStatusBadge").textContent = `AI: ${data.aiStatus.reachable ? "✅" : "❌"} ${data.aiStatus.model}`;
    document.getElementById("persistBadge").textContent = `Storage: ${data.persistent ? "✅ persistent" : "⚠️ in-memory only"}`;
    document.getElementById("authCard").classList.add("hidden");
    document.getElementById("dashCard").classList.remove("hidden");
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("saveStatus");
  statusEl.textContent = currentLang === "ar" ? "جارٍ الحفظ..." : "Saving...";
  try {
    await saveConfig(readForm());
    statusEl.textContent = currentLang === "ar" ? "✅ تم الحفظ" : "✅ Saved";
    setTimeout(() => (statusEl.textContent = ""), 2500);
  } catch (err) {
    statusEl.textContent = `⚠️ ${err.message}`;
  }
});

applyI18n();
