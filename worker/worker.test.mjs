// اختبار محلي للـ Worker بدون شبكة: KV وهمي + بدائل للتحقق والإرسال.
// التشغيل من جذر الريبو: node worker/worker.test.mjs
import assert from 'node:assert/strict';
import worker, {_internals} from './worker.js';

class FakeKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list({prefix = '', cursor} = {}) {
    const all = [...this.m.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? all.indexOf(cursor) + 1 : 0;
    const page = all.slice(start, start + 2); // صفحة صغيرة عشان نختبر الترقيم
    const done = start + page.length >= all.length;
    return {keys: page.map(name => ({name})), list_complete: done, cursor: done ? undefined : page.at(-1)};
  }
}

const sentMessages = [];
_internals.verifyFirebaseIdToken = async token => {
  if (token === 'good-uid-1') return 'uid-1';
  if (token === 'good-uid-2') return 'uid-2';
  if (token === 'good-uid-admin') return 'uid-admin';
  throw new Error('bad token');
};
_internals.tgSend = async (env, chatId, text) => { sentMessages.push({chatId, text}); return true; };

const env = {
  TG_LINKS: new FakeKV(),
  BOT_TOKEN: 'TEST',
  BOT_USERNAME: 'AlaBabkTestBot',
  APP_SECRET: 's3cr3t',
  WEBHOOK_SECRET: 'whsec',
  FIREBASE_PROJECT_ID: 'ala-babk'
};

const call = (path, {method = 'GET', headers = {}, body} = {}) =>
  worker.fetch(new Request('https://worker.test' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }), env, {});

const auth = uid => ({authorization: 'Bearer ' + uid, 'content-type': 'application/json'});

// 1) health
{
  const res = await call('/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
}

// 2) الرفض بدون توكن
{
  const res = await call('/link/start', {method: 'POST', headers: {'content-type': 'application/json'}, body: {merchantId: 'm1'}});
  assert.equal(res.status, 401);
}

// 3) مسار ربط تاجر كامل: start → webhook /start → notify
let linkUrl;
{
  const res = await call('/link/start', {method: 'POST', headers: auth('good-uid-1'), body: {merchantId: 'm1'}});
  assert.equal(res.status, 200);
  linkUrl = (await res.json()).url;
  assert.ok(linkUrl.startsWith('https://t.me/AlaBabkTestBot?start='));
  const code = linkUrl.split('start=')[1];
  assert.equal(code.length, 8);

  // الحالة قبل الضغط على Start: غير مربوط
  assert.equal((await (await call('/link/status', {headers: auth('good-uid-1')})).json()).linked, false);

  // webhook بدون السر مترفض
  const badHook = await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json'}, body: {message: {chat: {id: 555}, text: '/start ' + code}}});
  assert.equal(badHook.status, 401);

  // webhook بالسر: يتم الربط ويرد برسالة تأكيد
  const hook = await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 555}, text: '/start ' + code}}});
  assert.equal(hook.status, 200);
  assert.equal(sentMessages.at(-1).chatId, '555');
  assert.ok(sentMessages.at(-1).text.includes('تم الربط'));

  assert.equal((await (await call('/link/status', {headers: auth('good-uid-1')})).json()).linked, true);

  // الكود اتستخدم ومش شغال تاني
  const reuse = await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 999}, text: '/start ' + code}}});
  assert.equal(reuse.status, 200);
  assert.ok(sentMessages.at(-1).text.includes('خلصت مدته'));

  // إشعار للتاجر m1 يوصل للشات 555
  const before = sentMessages.length;
  const nres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:m1'], title: 'طلب جديد', message: 'رقم الطلب: #ORD-1'}});
  assert.equal((await nres.json()).sent, 1);
  assert.equal(sentMessages.length, before + 1);
  assert.equal(sentMessages.at(-1).chatId, '555');
  assert.ok(sentMessages.at(-1).text.includes('ORD-1'));
}

// 3ب) رجعي: معرّفات التطبيق الحقيقية (merch_/agent_ + UUID = 42 حرف) لازم تتقبل في الربط والإشعار
{
  const merchId = 'merch_3f6b2a1c-9d4e-4f8a-b7c6-5d4e3f2a1b09'; // 42 حرف — الشكل الفعلي في الإنتاج
  const agentId = 'agent_0a1b2c3d-4e5f-4678-89ab-cdef01234567';
  assert.equal(merchId.length, 42);
  const res = await call('/link/start', {method: 'POST', headers: auth('good-uid-2'), body: {merchantId: merchId}});
  assert.equal(res.status, 200);
  const code = (await res.json()).url.split('start=')[1];
  await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 556}, text: '/start ' + code}}});
  const nres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:' + merchId], title: 't', message: 'm'}});
  assert.equal((await nres.json()).sent, 1);
  assert.equal(sentMessages.at(-1).chatId, '556');
  await call('/link/stop', {method: 'POST', headers: auth('good-uid-2')});
  // ومندوب بنفس طول المعرّف
  const ares = await call('/link/start', {method: 'POST', headers: auth('good-uid-2'), body: {deliveryAgentId: agentId}});
  assert.equal(ares.status, 200);
  await call('/link/stop', {method: 'POST', headers: auth('good-uid-2')});
}

// 4) /notify بدون السر مترفض، وبمفاتيح غير معروفة يرجع 0
{
  assert.equal((await call('/notify', {method: 'POST', headers: {'content-type': 'application/json'}, body: {keys: ['m:m1'], title: 't', message: 'm'}})).status, 401);
  assert.equal((await (await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:unknown'], title: 't', message: 'm'}})).json()).sent, 0);
  // مفاتيح مش مطابقة للشكل بتتجاهل
  assert.equal((await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['x:hack', 'uid:1'], title: 't', message: 'm'}})).status, 400);
}

// 5) ربط أدمن وإشعار role:ADMIN
{
  const res = await call('/link/start', {method: 'POST', headers: auth('good-uid-admin'), body: {admin: true}});
  const code = (await res.json()).url.split('start=')[1];
  await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 777}, text: '/start ' + code}}});
  const before = sentMessages.length;
  const nres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['role:ADMIN'], title: 'طلب جديد 🔔', message: 'تم استلام طلب جديد'}});
  assert.equal((await nres.json()).sent, 1);
  assert.equal(sentMessages.length, before + 1);
  assert.equal(sentMessages.at(-1).chatId, '777');
}

// 6) إلغاء الربط بيمسح المفاتيح
{
  const res = await call('/link/stop', {method: 'POST', headers: auth('good-uid-1')});
  assert.equal((await res.json()).linked, false);
  const before = sentMessages.length;
  const nres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:m1'], title: 't', message: 'm'}});
  assert.equal((await nres.json()).sent, 0);
  assert.equal(sentMessages.length, before);
}

// 7) /start من غير كود يرد برسالة ترحيب
{
  const before = sentMessages.length;
  await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 321}, text: '/start'}}});
  assert.ok(sentMessages.at(-1).text.includes('بوت إشعارات'));
  assert.equal(sentMessages.length, before + 1);
}

// 8) /broadcast: ممنوع لغير الأدمن، وبيبعت للأدوار المطلوبة فقط
{
  // غير مربوط أصلًا
  assert.equal((await call('/broadcast', {method: 'POST', headers: auth('good-uid-1'), body: {audience: 'ALL', text: 'خبر'}})).status, 403);
  // الأدمن مربوط من اختبار 5 (شات 777)
  const before = sentMessages.length;
  const res = await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'ADMIN', text: 'إعلان للأدمن'}});
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.total, 1);
  assert.equal(data.sent, 1);
  assert.equal(sentMessages.at(-1).chatId, '777');
  assert.ok(sentMessages.at(-1).text.includes('إعلان للأدمن'));
  // audience غلط أو نص فاضي
  assert.equal((await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'NOPE', text: 'x'}})).status, 400);
  assert.equal((await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'ALL', text: '  '}})).status, 400);
  // دور فاضي: total 0 من غير إرسال
  const emptyRes = await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'CUSTOMER', text: 'خبر'}});
  assert.equal((await emptyRes.json()).total, 0);
  assert.equal(sentMessages.length, before + 1);
}

// 9) المستخدم اللي حظر البوت بيتشال من القوائم أثناء البث
{
  // اربط عميل على شات 888
  const res = await call('/link/start', {method: 'POST', headers: auth('good-uid-1'), body: {customer: true}});
  const code = (await res.json()).url.split('start=')[1];
  await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 888}, text: '/start ' + code}}});
  // خلّي الإرسال لـ 888 يرجع blocked
  const origSend = _internals.tgSend;
  _internals.tgSend = async (env, chatId, text) => chatId === '888' ? {ok: false, blocked: true} : (sentMessages.push({chatId, text}), {ok: true});
  const bres = await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'ALL', text: 'خبر للكل'}});
  const bdata = await bres.json();
  _internals.tgSend = origSend;
  assert.equal(bdata.blocked, 1);
  // الشات 888 اتشال: بث تاني ميوصلوش
  const again = await call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body: {audience: 'CUSTOMER', text: 'خبر'}});
  assert.equal((await again.json()).total, 0);
}

// 10) تذكيرات الحجوزات الموقوتة: /reminders/sync + /reminders/prefs + الكرون
// توقيت ثابت: 15 يونيو 2026 10:00 UTC = 13:00 القاهرة (توقيت صيفي +3)
{
  const NOW = Date.parse('2026-06-15T10:00:00Z');
  const TODAY = '2026-06-15', TOMORROW = '2026-06-16';
  const sec = {'content-type': 'application/json', 'x-app-secret': 's3cr3t'};

  // اربط تاجر mrem على شات 900
  const res = await call('/link/start', {method: 'POST', headers: auth('good-uid-2'), body: {merchantId: 'mrem'}});
  const code = (await res.json()).url.split('start=')[1];
  await call('/tg/webhook', {method: 'POST', headers: {'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'whsec'}, body: {message: {chat: {id: 900}, text: '/start ' + code}}});

  // الحراسات: بدون السر 401، جسم غلط 400
  assert.equal((await call('/reminders/sync', {method: 'POST', headers: {'content-type': 'application/json'}, body: {bookings: [{id: 'x'}]}})).status, 401);
  assert.equal((await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: []}})).status, 400);
  assert.equal((await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem'}})).status, 400);

  // مزامنة: حجز مقبول ميعاده بعد ساعة + حجز معلق من 3 ساعات + حجز تالف الشكل
  const bk = (id, status, date, time, createdAt) => ({id, merchantId: 'mrem', customerName: 'أحمد', date, time, status, createdAt});
  const sync = await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: [
    bk('mrem_2026-06-15_1400', 'ACCEPTED', TODAY, '14:00', NOW - 5 * 3600e3),  // الميعاد بعد 60 دقيقة بالظبط
    bk('mrem_2026-06-15_2000', 'ACCEPTED', TODAY, '20:00', NOW - 5 * 3600e3),  // بعد 7 ساعات — بره النافذة
    bk('mrem_2026-06-16_0930', 'PENDING', TOMORROW, '09:30', NOW - 3 * 3600e3), // معلق من 3 ساعات
    bk('mrem_2026-06-16_1130', 'PENDING', TOMORROW, '11:30', NOW - 3 * 3600e3), // معلق تاني لنفس التاجر
    {id: 'bad'},                                                               // شكل تالف يتخطى
  ]}});
  assert.deepEqual(await sync.json(), {ok: true, stored: 4, deleted: 0, skipped: 1});

  // أول جولة كرون: تذكير واحد (14:00) + تنبيه مجمع واحد للحجزين المعلقين
  let before = sentMessages.length;
  let r = await _internals.runCron(env, NOW);
  assert.equal(r.scanned, 4);
  assert.equal(r.reminders, 1);
  assert.equal(r.alerts, 2); // حجزين في رسالة واحدة
  assert.equal(sentMessages.length, before + 2);
  assert.equal(sentMessages[before].chatId, '900');
  assert.ok(sentMessages[before].text.includes('تذكير') && sentMessages[before].text.includes('2:00 م') && sentMessages[before].text.includes('النهارده'));
  assert.ok(sentMessages[before + 1].text.includes('2 حجوزات') && sentMessages[before + 1].text.includes('أحمد'));

  // جولة تانية بعد 10 دقايق: مفيش تكرار
  before = sentMessages.length;
  r = await _internals.runCron(env, NOW + 10 * 60e3);
  assert.equal(r.reminders, 0);
  assert.equal(r.alerts, 0);
  assert.equal(sentMessages.length, before);

  // قبول الحجزين المعلقين: مزامنة بالحالة الجديدة تحتفظ بعلامة التنبيه
  await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: [
    bk('mrem_2026-06-16_0930', 'ACCEPTED', TOMORROW, '09:30', NOW - 3 * 3600e3),
    bk('mrem_2026-06-16_1130', 'ACCEPTED', TOMORROW, '11:30', NOW - 3 * 3600e3),
  ]}});

  // إلغاء حجز 20:00: المزامنة بحالة CANCELLED بتمسح المرآة
  const del = await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: [bk('mrem_2026-06-15_2000', 'CANCELLED', TODAY, '20:00', NOW - 5 * 3600e3)]}});
  assert.equal((await del.json()).deleted, 1);

  // الساعة 8 مساءً القاهرة (17:05 UTC): ملخص بكرة فيه الحجزين المقبولين، مرة واحدة بس
  const EVENING = Date.parse('2026-06-15T17:05:00Z');
  before = sentMessages.length;
  r = await _internals.runCron(env, EVENING);
  assert.equal(r.summaries, 1);
  assert.ok(sentMessages.at(-1).text.includes('ملخص') && sentMessages.at(-1).text.includes('9:30 ص') && sentMessages.at(-1).text.includes('11:30 ص'));
  r = await _internals.runCron(env, EVENING + 10 * 60e3);
  assert.equal(r.summaries, 0);

  // ساعة ملخص بكرة: 12..23 فقط، والافتراضي 8 مساءً
  assert.equal((await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', summaryHour: 5}})).status, 400);
  assert.equal((await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', summaryHour: 18.5}})).status, 400);
  const sh = await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', summaryHour: 18}});
  assert.equal((await sh.json()).prefs.summaryHour, 18);
  assert.equal(_internals.summaryHourFor({summaryHour: 18}), 18);
  assert.equal(_internals.summaryHourFor({}), 20);
  assert.equal(_internals.summaryHourFor({summaryHour: 3}), 20);
  await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', summaryHour: 20}});

  // تفضيلات: قفل التذكير قبل الميعاد
  const pr = await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', reminder1h: false}});
  assert.equal((await pr.json()).prefs.reminder1h, false);
  await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: [bk('mrem_2026-06-16_0900', 'ACCEPTED', TOMORROW, '09:00', NOW)]}});
  // 09:00 القاهرة = 06:00 UTC. الساعة 04:50 UTC الميعاد بعد 50 دقيقة — جوه النافذة، كان هيتبعت لولا التفضيل
  before = sentMessages.length;
  r = await _internals.runCron(env, Date.parse('2026-06-16T04:50:00Z'));
  assert.equal(r.reminders, 0);
  assert.equal(sentMessages.length, before);
  // ارجع شغّله: أول جولة بعد كده تبعت
  await call('/reminders/prefs', {method: 'POST', headers: sec, body: {merchantId: 'mrem', reminder1h: true}});
  r = await _internals.runCron(env, Date.parse('2026-06-16T04:55:00Z'));
  assert.equal(r.reminders, 1);
  assert.ok(sentMessages.at(-1).text.includes('9:00 ص'));

  // تاجر مش مربوط: مفيش إرسال ومفيش كسر
  await call('/reminders/sync', {method: 'POST', headers: sec, body: {bookings: [
    {id: 'mxx_2026-06-15_1500', merchantId: 'mxx', customerName: 'سامي', date: TODAY, time: '15:00', status: 'ACCEPTED', createdAt: NOW - 3600e3},
  ]}});
  before = sentMessages.length;
  await _internals.runCron(env, NOW + 60 * 60e3); // 14:00 القاهرة — ميعاد mxx بعد ساعة
  assert.equal(sentMessages.length, before);
}

// 11) Web Push: مفتاح VAPID، الاشتراكات، fan-out في /notify، تنظيف الميت، وفك تشفير RFC 8291
{
  const b64u = buf => Buffer.from(buf).toString('base64url');
  const b64uDec = s => new Uint8Array(Buffer.from(s, 'base64url'));
  const cat = (...as) => { const o = new Uint8Array(as.reduce((n, a) => n + a.length, 0)); let off = 0; for (const a of as) { o.set(a, off); off += a.length; } return o; };
  const hmac = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']), d));

  // المفتاح العام: ثابت عبر النداءات، 65 بايت
  const k1 = await (await call('/push/key')).json();
  const k2 = await (await call('/push/key')).json();
  assert.equal(k1.key, k2.key);
  assert.equal(b64uDec(k1.key).length, 65);
  assert.equal(b64uDec(k1.key)[0], 4); // نقطة غير مضغوطة

  // الحراسات
  assert.equal((await call('/push/subscribe', {method: 'POST', headers: {'content-type': 'application/json'}, body: {subscription: {}}})).status, 401);
  const sub1 = {endpoint: 'https://push.example/sub/AAA', keys: {p256dh: b64u(crypto.getRandomValues(new Uint8Array(65))), auth: b64u(crypto.getRandomValues(new Uint8Array(16)))}};
  assert.equal((await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-1'), body: {subscription: {endpoint: 'http://insecure/x', keys: sub1.keys}}})).status, 400);
  assert.equal((await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-1'), body: {subscription: {endpoint: sub1.endpoint}}})).status, 400);

  // اشتراك سليم بمفتاح m:m1 + إضافة uid تلقائية، وإعادة الاشتراك متكررش
  assert.equal((await (await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-1'), body: {subscription: sub1, keys: ['m:m1', 'x:bad']}})).json()).ok, true);
  await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-1'), body: {subscription: sub1, keys: ['m:m1']}});
  const h1 = await _internals.pushHash(sub1.endpoint);
  assert.deepEqual(JSON.parse(await env.TG_LINKS.get('push:idx:m:m1')), [h1]);
  assert.deepEqual(JSON.parse(await env.TG_LINKS.get('push:idx:uid:uid-1')), [h1]);

  // /notify بيبعت بوش جنب التليجرام، وال payload JSON فيه title/body
  const pushCalls = [];
  const origPush = _internals.pushSendOnce;
  _internals.pushSendOnce = async (e, v, sub, payload) => { pushCalls.push({endpoint: sub.endpoint, payload}); return {ok: true}; };
  const nres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:m1'], title: 'طلب جديد', message: 'تفاصيل'}});
  const ndata = await nres.json();
  assert.equal(ndata.sent, 0); // ربط تليجرام بتاع m1 اتشال في اختبار 6 — البوش شغال لوحده
  assert.equal(ndata.pushed, 1);
  assert.equal(pushCalls.length, 1);
  assert.equal(pushCalls[0].endpoint, sub1.endpoint);
  assert.deepEqual(JSON.parse(pushCalls[0].payload), {title: 'طلب جديد', body: 'تفاصيل'});

  // اشتراك ميت (404/410) بيتشال من الفهارس
  _internals.pushSendOnce = async () => ({ok: false, gone: true});
  const gres = await call('/notify', {method: 'POST', headers: {'content-type': 'application/json', 'x-app-secret': 's3cr3t'}, body: {keys: ['m:m1'], title: 't', message: 'm'}});
  assert.equal((await gres.json()).pushed, 0);
  assert.equal(await env.TG_LINKS.get('push:idx:m:m1'), '[]');
  assert.equal(await env.TG_LINKS.get('push:sub:' + h1), null);

  // unsubscribe بيمسح الاشتراك
  await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-1'), body: {subscription: sub1, keys: ['m:m1']}});
  assert.equal((await call('/push/unsubscribe', {method: 'POST', headers: auth('good-uid-1'), body: {endpoint: sub1.endpoint}})).status, 200);
  assert.equal(await env.TG_LINKS.get('push:sub:' + h1), null);
  assert.equal(await env.TG_LINKS.get('push:idx:m:m1'), '[]');

  // تشفير حقيقي: متصفح وهمي بمفتاح ECDH، ونفك التشفير في الاختبار (RFC 8291)
  _internals.pushSendOnce = origPush;
  const uaPair = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', uaPair.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const subReal = {endpoint: 'https://push.example/sub/REAL', keys: {p256dh: b64u(uaPub), auth: b64u(authSecret)}};
  const vapid = await _internals.getVapid(env);
  let captured;
  const fakeFetch = async (url, init) => { captured = {url, init}; return {status: 201}; };
  const payload = JSON.stringify({title: 'عنوان', body: 'نص'});
  const r = await _internals.pushSendOnce(env, vapid, subReal, payload, fakeFetch);
  assert.equal(r.ok, true);
  assert.equal(captured.url, subReal.endpoint);
  assert.equal(captured.init.headers['content-encoding'], 'aes128gcm');
  assert.equal(captured.init.headers['ttl'], '3600');

  // هيدر VAPID: JWT صحيح التوقيع وk = المفتاح العام
  const m = captured.init.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m, 'authorization header');
  assert.equal(m[2], vapid.pub);
  const [h64, p64, s64] = m[1].split('.');
  const claims = JSON.parse(Buffer.from(p64, 'base64url').toString());
  assert.equal(claims.aud, 'https://push.example');
  assert.equal(claims.sub, 'https://3alababk.com');
  const vKey = await crypto.subtle.importKey('raw', b64uDec(vapid.pub), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
  assert.equal(await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, vKey, b64uDec(s64), new TextEncoder().encode(h64 + '.' + p64)), true);

  // فك التشفير: نفس خطوات RFC 8291 من ناحية المتصفح
  const raw = new Uint8Array(captured.init.body);
  const salt = raw.slice(0, 16);
  const idlen = raw[20];
  const asPub = raw.slice(21, 21 + idlen);
  const cipher = raw.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, {name: 'ECDH', namedCurve: 'P-256'}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: asKey}, uaPair.privateKey, 256));
  const keyInfo = cat(new TextEncoder().encode('WebPush: info\0'), uaPub, asPub);
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, cat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, new TextEncoder().encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, new TextEncoder().encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv: nonce}, await crypto.subtle.importKey('raw', cek, {name: 'AES-GCM'}, false, ['decrypt']), cipher));
  assert.equal(plain.at(-1), 2); // فاصل السجل الأخير
  assert.equal(new TextDecoder().decode(plain.slice(0, -1)), payload);
}

// 12) بث الأدمن بمفاتيح uid: تليجرام + بوش، تحقق صارم، ووضع audience زي ما هو
{
  const bc = body => call('/broadcast', {method: 'POST', headers: auth('good-uid-admin'), body});

  // ممنوع لغير الأدمن حتى مع keys
  assert.equal((await call('/broadcast', {method: 'POST', headers: auth('good-uid-2'), body: {keys: ['uid:uid-2'], text: 'x'}})).status, 403);

  // أي مفتاح مش uid: صالح = 400، وأكتر من 100 = 400
  assert.equal((await bc({keys: ['m:m1'], text: 'x'})).status, 400);
  assert.equal((await bc({keys: ['uid:ok', 'uid:bad key'], text: 'x'})).status, 400);
  assert.equal((await bc({keys: Array.from({length: 101}, (_, i) => 'uid:u' + i), text: 'x'})).status, 400);
  assert.equal((await bc({keys: [], text: 'x'})).status, 400);

  // uid مش مربوط ومش مشترك بوش: ميتحسبش خالص
  let r = await (await bc({keys: ['uid:nobody'], text: 'خبر'})).json();
  assert.deepEqual(r, {ok: true, total: 0, sent: 0, pushed: 0, blocked: 0, failed: 0});

  // uid-2 مربوط تليجرام (شات 900 من اختبار 10) + اشتراك بوش
  const sub2 = {endpoint: 'https://push.example/sub/BBB', keys: {p256dh: Buffer.from(crypto.getRandomValues(new Uint8Array(65))).toString('base64url'), auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')}};
  await call('/push/subscribe', {method: 'POST', headers: auth('good-uid-2'), body: {subscription: sub2}});

  const pushCalls = [];
  const origPush2 = _internals.pushSendOnce;
  _internals.pushSendOnce = async (e, v, sub, payload) => { pushCalls.push({endpoint: sub.endpoint, payload}); return {ok: true}; };

  // بث لـ uid-2 (مكرر) + uid مش موجود: يوصل تليجرام وبوش، total بيعد uid-2 مرة واحدة
  const before = sentMessages.length;
  r = await (await bc({keys: ['uid:uid-2', 'uid:uid-2', 'uid:nobody'], text: 'رسالة إدارية'})).json();
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  assert.equal(r.sent, 1);
  assert.equal(r.pushed, 1);
  assert.equal(sentMessages.length, before + 1);
  assert.equal(sentMessages.at(-1).chatId, '900');
  assert.ok(sentMessages.at(-1).text.includes('رسالة إدارية'));
  assert.equal(pushCalls.length, 1);
  assert.equal(pushCalls[0].endpoint, sub2.endpoint);
  assert.deepEqual(JSON.parse(pushCalls[0].payload), {title: 'على بابك', body: 'رسالة إدارية'});

  // اشتراك بوش ميت أثناء البث بيتشال
  _internals.pushSendOnce = async () => ({ok: false, gone: true});
  r = await (await bc({keys: ['uid:uid-2'], text: 'خبر'})).json();
  assert.equal(r.pushed, 0);
  assert.equal(await env.TG_LINKS.get('push:idx:uid:uid-2'), '[]');
  _internals.pushSendOnce = origPush2;

  // وضع audience زي ما هو بالظبط: مفيش pushed في الرد، والتليجرام شغال
  r = await (await bc({audience: 'ADMIN', text: 'إعلان'})).json();
  assert.equal(r.sent, 1);
  assert.equal(r.pushed, undefined);
  assert.ok(sentMessages.at(-1).text.includes('إعلان'));
}

console.log('PASS worker: health, auth 401, full link flow, one-time code, merchant notify, admin list, notify guards, unlink, /start help. broadcast guards/roles, blocked cleanup. reminders sync/prefs/cron (1h reminder, 2h aggregated alert, tomorrow summary, prefs off, unlinked merchant). web push (vapid key, subscribe guards/dedupe/uid selector, notify fan-out payload, gone cleanup, unsubscribe, RFC 8291 decrypt roundtrip + VAPID JWT signature). uid-keys broadcast (admin-only, strict 400s, 101 cap, unlinked not counted, telegram+push, dedupe, gone cleanup, audience unchanged). messages sent:', sentMessages.length);
