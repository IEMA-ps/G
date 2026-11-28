// تنبيهات انتهاء الاشتراك في الـ Worker. التشغيل من جذر الريبو: node worker/expiry.test.mjs
import assert from 'node:assert/strict';
import worker, {_internals} from './worker.js';
class FakeKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list({prefix = ''} = {}) { return {keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({name})), list_complete: true}; }
}
const DAY = 86400000, E = Date.UTC(2026, 11, 10, 12); // 14:00 القاهرة
const sent = [], pushes = [];
_internals.verifyFirebaseIdToken = async t => ({'t-admin': 'u-admin', 't-m': 'u-m'}[t] || (() => { throw new Error('bad'); })());
const docs = new Map([['users/u-admin', {role: 'ADMIN'}], ['users/u-m', {role: 'MERCHANT', merchantId: 'm1'}],
  ['merchants/m1', {businessName: 'مطعم النور', subEndsAt: E, marketerId: 'mk1'}], ['merchants/m2', {businessName: 'بدون اشتراك'}]]);
_internals.fsGetDoc = async (env, token, path) => (token === 't-admin' || path.startsWith('users/')) ? (docs.get(path) || null) : null;
_internals.tgSend = async (env, chatId, text) => { sent.push({chatId, text}); return true; };
_internals.pushFanOut = async (env, keys, title) => { pushes.push({keys, title}); return {pushed: 0}; };
const env = {TG_LINKS: new FakeKV(), FIREBASE_PROJECT_ID: 'ala-babk'};
const post = (token, body) => worker.fetch(new Request('https://w.test/expiry/sync', {method: 'POST', headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json'}, body: JSON.stringify(body)}), env, {});
// صلاحيات: غير الأدمن 403، من غير توكن 401، جسم غلط 400
assert.equal((await post('t-m', {merchantIds: ['m1']})).status, 403);
assert.equal((await post('bad', {merchantIds: ['m1']})).status, 401);
assert.equal((await post('t-admin', {merchantIds: []})).status, 400);
assert.equal((await post('t-admin', {merchantIds: ['../x', 5]})).status, 400);
let r = await (await post('t-admin', {merchantIds: ['m1', 'm2', 'nope']})).json();
assert.deepEqual([r.stored, r.cleared, r.skipped], [1, 1, 1]);
const mirror = JSON.parse(env.TG_LINKS.m.get('exp:m1'));
assert.equal(mirror.endsAt, E); assert.equal(mirror.marketerId, 'mk1'); assert.equal(env.TG_LINKS.m.has('exp:m2'), false);
await env.TG_LINKS.put('m:m1', 'chat-m'); await env.TG_LINKS.put('uid:mk1', JSON.stringify({chatId: 'chat-mk', role: 'MARKETER'}));
const run = t => _internals.runExpiryCron(env, t);
// قبل 8 أيام: مفيش
await run(E - 8 * DAY); assert.equal(sent.length, 0);
// 7 أيام: تنبيه تاجر واحد، ومرة تانية في نفس المرحلة مفيش تكرار
await run(E - 6 * DAY - 3600e3); assert.equal(sent.length, 1); assert.equal(sent[0].chatId, 'chat-m'); assert.match(sent[0].text, /7 أيام/);
await run(E - 6 * DAY - 1800e3); assert.equal(sent.length, 1);
await run(E - 2 * DAY - 3600e3); assert.equal(sent.length, 2); assert.match(sent[1].text, /3 أيام/);
await run(E - 3 * 3600e3); assert.equal(sent.length, 3); assert.match(sent[2].text, /بكرة/);
await run(E + 1000); assert.equal(sent.length, 4); assert.match(sent[3].text, /متجرك مخفي/);
// الليل (3 الفجر القاهرة) مفيش إرسال
await run(Date.UTC(2026, 11, 13, 1)); assert.equal(sent.length, 4);
// المسوّق: +3 أيام ثم +10 أيام
await run(E + 3 * DAY + 3600e3); assert.equal(sent.length, 5); assert.equal(sent[4].chatId, 'chat-mk'); assert.match(sent[4].text, /مطعم النور/);
await run(E + 3.2 * DAY); assert.equal(sent.length, 5);
await run(E + 10 * DAY + 3600e3); assert.equal(sent.length, 6); assert.match(sent[5].text, /10 أيام/);
assert.ok(pushes.some(p => p.keys[0] === 'uid:mk1') && pushes.some(p => p.keys[0] === 'm:m1'));
// تجديد: تاريخ انتهاء جديد = العدّاد يبدأ من الأول، ومفيش تنبيه مسوّق للتجديد
docs.set('merchants/m1', {businessName: 'مطعم النور', subEndsAt: E + 90 * DAY, marketerId: 'mk1'});
await post('t-admin', {merchantIds: ['m1']});
assert.deepEqual(JSON.parse(env.TG_LINKS.m.get('exp:m1')).sent, {});
const n = sent.length; await run(E + 10 * DAY + 7200e3); assert.equal(sent.length, n);
await run(E + 90 * DAY - 6 * DAY); assert.equal(sent.length, n + 1);
// متأخرين في المزامنة (اشتراك قريب الانتهاء): تنبيه واحد بس مش كل المراحل
docs.set('merchants/m3', {businessName: 'ج', subEndsAt: E + 20 * DAY, marketerId: null}); await post('t-admin', {merchantIds: ['m3']}); await env.TG_LINKS.put('m:m3', 'chat-3');
const k = sent.length; await run(E + 20 * DAY - 3 * 3600e3); assert.equal(sent.filter(s => s.chatId === 'chat-3').length, 1); assert.equal(sent.length, k + 1);
await run(E + 20 * DAY - 2 * 3600e3); assert.equal(sent.length, k + 1);
// مفيش مسوّق = مفيش تنبيه مسوّق
await run(E + 24 * DAY); assert.equal(sent.filter(s => s.chatId === 'chat-mk').length, 2);
console.log('PASS expiry worker: admin-only sync, merchant 7/3/1/lapse once each, marketer +3/+10, night quiet, renewal resets, late sync single alert');
