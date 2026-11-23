// اختبارات موديول إشعارات تليجرام (واجهة العميل) — بدون شبكة، fetch وهمي.
import assert from 'node:assert/strict';
import {WORKER_URL, APP_SECRET, ADMIN_KEY, merchantKey, agentKey, send, linkStart, linkStatus, linkStop, linkModalHTML} from './telegram-notify.js';

// مفاتيح الاستهداف
assert.equal(ADMIN_KEY, 'role:ADMIN');
assert.equal(merchantKey('abc123'), 'm:abc123');
assert.equal(agentKey('xyz'), 'a:xyz');

// send: بيبعت POST بالشكل الصحيح وبيرجع true لو اتبعت
{
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({url, opts}); return {ok: true, json: async () => ({sent: 1})}; };
  const ok = await send(['m:m1', ADMIN_KEY], 'طلب جديد 🔔', 'تم استلام طلب جديد من أحمد', fetchImpl);
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WORKER_URL + '/notify');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['x-app-secret'], APP_SECRET);
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(body.keys, ['m:m1', 'role:ADMIN']);
  assert.equal(body.title, 'طلب جديد 🔔');
}

// send: فشل الشبكة مبيرميش خطأ — بيرجع false وبيبلغ الكونسول بس
{
  const fetchImpl = async () => { throw new Error('network down'); };
  const ok = await send(['m:m1'], 't', 'm', fetchImpl);
  assert.equal(ok, false);
  // مفاتيح فاضية → مفيش نداء أصلًا
  const calls = [];
  await send([], 't', 'm', async (...a) => { calls.push(a); });
  assert.equal(calls.length, 0);
}

// send: قص النصوص الطويلة
{
  let body;
  const fetchImpl = async (url, opts) => { body = JSON.parse(opts.body); return {ok: true, json: async () => ({sent: 0})}; };
  await send(['a:a1'], 'x'.repeat(500), 'y'.repeat(5000), fetchImpl);
  assert.equal(body.title.length, 200);
  assert.equal(body.message.length, 3000);
}

// linkStart: بيبعت التوكن والمعرّفات وبيرجع الرابط
{
  let seen;
  const fetchImpl = async (url, opts) => { seen = {url, opts}; return {ok: true, json: async () => ({url: 'https://t.me/bot?start=CODE'})}; };
  const r = await linkStart({token: 'tok123', merchantId: 'm9', admin: false}, fetchImpl);
  assert.equal(r.url, 'https://t.me/bot?start=CODE');
  assert.equal(seen.opts.headers['authorization'], 'Bearer tok123');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.merchantId, 'm9');
  assert.equal(body.deliveryAgentId, null);
  assert.equal(body.admin, false);
}

// linkStatus / linkStop
{
  const fetchImpl = async (url, opts) => ({ok: true, json: async () => ({linked: true})});
  assert.equal((await linkStatus('tok', fetchImpl)).linked, true);
  assert.equal((await linkStop('tok', fetchImpl)).linked, true);
}

// linkModalHTML: الحالات الأربع
{
  assert.ok(linkModalHTML('loading').includes('جاري التحميل'));
  assert.ok(linkModalHTML('unavailable').includes('لسه بتتجهز'));
  assert.ok(linkModalHTML('linked').includes('متصل'));
  assert.ok(linkModalHTML('linked').includes('إلغاء الربط'));
  assert.ok(linkModalHTML('pending').includes('Start'));
  assert.ok(linkModalHTML('unlinked').includes('ربط تليجرام'));
  // الحالة الافتراضية (غير مربوط)
  assert.ok(linkModalHTML().includes('ربط تليجرام'));
}

console.log('PASS telegram-notify: keys, send payload/guards/truncation, link calls, modal states.');
