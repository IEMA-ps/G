# سجل موافقة الشروط — على بابك

Worker مجاني على Cloudflare + قاعدة D1 (إضافة فقط). بيسجّل إثبات إن المستخدم وافق على الشروط، من السيرفر مش من المتصفح.

## بيتسجل إيه
`uid` (من توكن Firebase الموقّع)، إصدار الشروط، بصمة SHA-256 لصفحة `terms.html` المنشورة وقت الموافقة (السيرفر بيجيبها بنفسه)، وقت السيرفر UTC، عنوان IP، وطريقة التسجيل (email/google).
- لو إصدار الشروط اللي بعته المتصفح غير الإصدار المنشور فعلًا، الطلب بيترفض (409).
- صف واحد لكل (مستخدم، إصدار): إعادة المحاولة آمنة.
- `schema.sql` فيه تريجرات بتمنع أي UPDATE أو DELETE.

## النشر (بعد موافقة إسلام، مرة واحدة)
1. `wrangler d1 create ala-babk-consent` وانسخ الـ `database_id` في `wrangler.toml`.
2. `wrangler d1 execute ala-babk-consent --remote --file=schema.sql`
3. `wrangler deploy` (من مجلد `consent-worker`). مفيش أسرار.
4. الـ route على `3alababk.com/api/consent` و`www` (الدومين لازم يكون في نفس حساب Cloudflare).
5. نشر نسخة الموقع الجديدة (`terms-consent.js` + `index.html`). قبل نشر الـ Worker، الطلب بيفشل بصمت وبيتسجل بس `termsConsent` في Firestore زي ما هو.

## قراءة السجل
`wrangler d1 execute ala-babk-consent --remote --command "SELECT * FROM terms_consents WHERE uid='...'"`

## الاختبار
`node --test worker.test.mjs` (Node 20+)

## حدود
- ده إثبات قوي على إن الحساب وافق على إصدار معين في وقت معين من عنوان IP معين، مش حكم قانوني. مراجعة محامي للنص والإشعار بجمع الـ IP (قانون ١٥١ لسنة ٢٠٢٠) لسه مطلوبة.
- التسجيل best-effort: لو الـ Worker وقع لحظة التسجيل، مفيش إعادة محاولة تلقائية.
- D1 الأساسي بيحمي من التعديل عبر التريجرات، لكن صاحب الحساب على Cloudflare يقدر يمسح الجدول أو القاعدة كلها. خد نسخة (`wrangler d1 export`) دورية لو محتاج حماية أقوى.

## كشف التسجيلات الناقصة
التسجيل بيفشل بصمت لو الـ Worker وقع (التسجيل في التطبيق بيكمل عادي). أبسط كشف: قارن العدد.
`wrangler d1 execute ala-babk-consent --remote --command "SELECT COUNT(*) FROM terms_consents WHERE terms_version='2026-11-24.2'"`
مع عدد الحسابات الجديدة من Firebase Authentication من تاريخ النشر. الفرق = موافقات ناقصة. (لحسابات Google اللي ألغت الشروط مفيش حساب أصلًا.)
