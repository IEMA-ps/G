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

console.log('PASS worker: health, auth 401, full link flow, one-time code, merchant notify, admin list, notify guards, unlink, /start help. broadcast guards/roles, blocked cleanup. reminders sync/prefs/cron (1h reminder, 2h aggregated alert, tomorrow summary, prefs off, unlinked merchant). messages sent:', sentMessages.length);
