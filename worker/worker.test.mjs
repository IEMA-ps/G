// اختبار محلي للـ Worker بدون شبكة: KV وهمي + بدائل للتحقق والإرسال.
// التشغيل من جذر الريبو: node worker/worker.test.mjs
import assert from 'node:assert/strict';
import worker, {_internals} from './worker.js';

class FakeKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
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

console.log('PASS worker: health, auth 401, full link flow, one-time code, merchant notify, admin list, notify guards, unlink, /start help. broadcast guards/roles, blocked cleanup. messages sent:', sentMessages.length);
