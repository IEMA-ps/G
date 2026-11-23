# بوت إشعارات تليجرام — على بابك

Worker على Cloudflare بيبعت إشعار تليجرام فوري:
- **للأدمن** لما طلب جديد يتعمل.
- **للتاجر** لما الأدمن يرسله الطلب (نفس لحظة إشعار التطبيق الحالي — مفيش إشعار للتاجر عند إنشاء الطلب).
- **للمندوب** لما يتسندله طلب توصيل.

التكلفة: صفر (Workers المجاني 100 ألف طلب/يوم، KV المجاني يكفي، Bot API مجاني). مفيش أي تغيير في قواعد Firestore: الـ Worker مش بيقرأ ولا بيكتب في القاعدة خالص.

## الربط محمي بإيه؟
- ربط الحساب (`/link/start` و`/link/status` و`/link/stop`) محمي بتوكن Firebase ID بتاع المستخدم نفسه — الـ Worker بيتحقق من التوقيع بمفاتيح جوجل العامة، فمحدش يقدر يربط حساب غيره.
- `/notify` محمي بسر مشترك `APP_SECRET` بين التطبيق والـ Worker (ظاهر في سورس الواجهة زي أي كود عميل — بيقلل العبث العشوائي، وأسوأ تأثير ممكن هو إشعار مزعج مش تسريب بيانات).
- `/tg/webhook` محمي بـ `WEBHOOK_SECRET` (تليجرام بيبعته في هيدر مع كل تحديث).

## خطوات النشر (بعد موافقة إسلام)

المتطلبات: Node.js 18+ و`npm i -g wrangler`، وتسجيل دخول `wrangler login` بحساب Cloudflare بتاع الموقع.

1. **إنشاء KV namespace** وحط الـ id في `wrangler.toml`:
   ```
   wrangler kv namespace create TG_LINKS
   ```
2. **اسم البوت**: حط اسم البوت اللي اتعمل من BotFather في `BOT_USERNAME` في `wrangler.toml`.
3. **الأسرار**:
   ```
   wrangler secret put BOT_TOKEN       # التوكن من BotFather (من الخزنة)
   wrangler secret put APP_SECRET      # نفس قيمة APP_SECRET في telegram-notify.js
   wrangler secret put WEBHOOK_SECRET  # نص عشوائي طويل
   ```
4. **نشر**:
   ```
   wrangler deploy
   ```
   خد رابط الـ Worker (مثل `https://ala-babk-tg-notify.<sub>.workers.dev`) وحطه في `WORKER_URL` في `telegram-notify.js`.
5. **تفعيل الـ webhook** (مرة واحدة):
   ```
   curl -X POST https://<worker-url>/tg/setup-webhook -H "x-app-secret: <APP_SECRET>"
   ```
   المفروض يرجع `{"ok":true,...}`.

## اختبار محلي
من جذر الريبو:
```
node worker/worker.test.mjs
```
بيشغّل الـ Worker محليًا بـ KV وهمي وبيغطي: مسار الربط كامل، الأكواد الغلط، إلغاء الربط، صلاحيات `/notify`، وإشعار الأدمن.
