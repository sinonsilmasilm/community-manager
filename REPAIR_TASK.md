# Community Manager - إصلاح شامل

أنت Senior TypeScript وNode.js وDiscord.js Developer.

أريد إصلاح مشروع Community Manager الحالي دون حذف أي ملفات أو وظائف.

المشاكل الحالية:
- البوت موجود في Discord لكنه لا يستجيب.
- الأمر /ai-status يعرض The application did not respond.
- نحتاج فحص اتصال Discord Gateway.
- نحتاج مراجعة إعدادات Vercel.

افحص الملفات التالية:
- src/gateway/bot.ts
- src/lib/config.ts
- src/commands/handlers.ts
- src/commands/definitions.ts
- package.json
- vercel.json

المهام:

1. إصلاح Discord Interactions.
2. إصلاح Slash Commands.
3. إصلاح الأمر /ai-status.
4. معالجة deferReply وeditReply.
5. منع تنفيذ Interaction مرتين.
6. إصلاح اتصال Discord Gateway.
7. معالجة أخطاء الاتصال وإعادة الاتصال.
8. مراجعة Environment Variables.
9. فحص توافق Vercel مع تشغيل Gateway.
10. فصل تشغيل البوت عن لوحة التحكم إذا تطلبت البنية ذلك.
11. الحفاظ على نظام الترحيب والحماية والإشراف والرتب.
12. إصلاح جميع أخطاء TypeScript.

قبل التعديل:
- افحص المشروع بالكامل.
- أنشئ نسخة احتياطية.
- لا تحذف أي ملفات أو إعدادات.
- لا تكشف Bot Token أو الأسرار.

بعد التعديل:
- نفذ npm run build.
- اختبر تشغيل Gateway.
- اختبر تسجيل Slash Commands.
- اختبر /ai-status.
- اعرض الملفات المعدلة.
- اعرض نتائج الاختبارات الفعلية.
- لا تدّعِ نجاح اختبار لم يتم تنفيذه.

نفذ الإصلاحات داخل المشروع الحالي، ولا تكتفِ بتقديم شرح أو اقتراحات.
