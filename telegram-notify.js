// إشعارات الطلبات على تليجرام عبر Cloudflare Worker خاص بـ«على بابك».
// موديول خفيف: دوال نقية + نداءات شبكة بسيطة. مفيش أي وصول لـ Firebase Firestore من هنا.
// ملاحظة أمنية: APP_SECRET ظاهر في سورس الصفحة زي باقي كود الواجهة، فهو بس بيقلل العبث العشوائي
// في endpoint الإشعارات (تأثيره إشعار مزعج، مش بيانات). ربط الحساب نفسه محمي بتوكن Firebase ID الحقيقي.

export const WORKER_URL = 'https://ala-babk-tg-notify.iemasam89.workers.dev';
// نفس القيمة المتحطوطة في الـ Worker كسر APP_SECRET (قيمة واجهة مش سر حقيقي — شوف التعليق فوق).
export const APP_SECRET = '64e91e0c81d615163ab84f1ea8058f59b50a685f312b1d79';

export const ADMIN_KEY = 'role:ADMIN';
export const merchantKey = merchantId => 'm:' + merchantId;
export const agentKey = agentId => 'a:' + agentId;

const MAX_TITLE = 200, MAX_MESSAGE = 3000;

async function post(path, body, {token, fetchImpl} = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = {'content-type': 'application/json', 'x-app-secret': APP_SECRET};
  if (token) headers['authorization'] = 'Bearer ' + token;
  const res = await doFetch(WORKER_URL + path, {method: 'POST', headers, body: JSON.stringify(body || {})});
  if (!res.ok) throw new Error('telegram worker http ' + res.status);
  return res.json();
}

async function get(path, {token, fetchImpl} = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = {};
  if (token) headers['authorization'] = 'Bearer ' + token;
  const res = await doFetch(WORKER_URL + path, {headers});
  if (!res.ok) throw new Error('telegram worker http ' + res.status);
  return res.json();
}

// إرسال إشعار تليجرام (fire-and-forget): أي فشل بيتسجل في الكونسول بس، من غير ما يأثر على مسار الطلب.
export function send(keys, title, message, fetchImpl) {
  const cleanKeys = (keys || []).filter(k => typeof k === 'string' && k.length > 0).slice(0, 10);
  if (!cleanKeys.length) return Promise.resolve(false);
  const body = {
    keys: cleanKeys,
    title: String(title || '').slice(0, MAX_TITLE),
    message: String(message || '').slice(0, MAX_MESSAGE)
  };
  return post('/notify', body, {fetchImpl})
    .then(r => !!(r && r.sent > 0))
    .catch(e => { console.warn('telegram notify failed', e); return false; });
}

// بدء ربط تليجرام: يرجع رابط t.me فيه كود ربط مؤقت (15 دقيقة). يتطلب توكن Firebase ID للمستخدم الحالي.
export function linkStart({token, merchantId, deliveryAgentId, admin, customer, marketer}, fetchImpl) {
  return post('/link/start', {
    merchantId: merchantId || null,
    deliveryAgentId: deliveryAgentId || null,
    admin: admin === true,
    customer: customer === true,
    marketer: marketer === true
  }, {token, fetchImpl});
}

export function linkStatus(token, fetchImpl) {
  return get('/link/status', {token, fetchImpl});
}

export function linkStop(token, fetchImpl) {
  return post('/link/stop', {}, {token, fetchImpl});
}

// محتوى مودال الربط لكل حالة — دالة نقية عشان تتختبر وتتعاين في صفحة المعاينة.
export function linkModalHTML(state) {
  if (state === 'loading')
    return '<p style="text-align:center;color:var(--ink-soft);font-size:13px;padding:18px 0"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل…</p>';
  if (state === 'unavailable')
    return '<p class="hint-box" style="padding:12px;margin:0">خدمة إشعارات تليجرام لسه بتتجهز. جرّب تاني بعد شوية.</p>';
  if (state === 'linked')
    return `<p class="hint-box" style="padding:12px;margin:0 0 14px">حسابك متصل ✅ — إشعارات الطلبات الجديدة بتوصلك على تليجرام فورًا.</p>
      <button class="btn btn-danger" onclick="unlinkTelegram()"><i class="fa-solid fa-link-slash"></i> إلغاء الربط</button>`;
  if (state === 'pending')
    return `<p style="font-size:13px;line-height:1.9;margin:0 0 14px">فتحنالك البوت على تليجرام في نافذة جديدة. اضغط <b>Start / ابدأ</b> جوه الشات عشان يتم الربط، وبعدين ارجع هنا واضغط الزرار اللي تحت.</p>
      <button class="btn btn-primary" onclick="checkTelegramLink()"><i class="fa-solid fa-rotate"></i> خلّصت الربط — تأكد</button>`;
  return `<p style="font-size:13px;line-height:1.9;margin:0 0 14px">اربط حسابك ببوت «على بابك» على تليجرام، وهيوصلك إشعار فوري بكل طلب جديد يخصك، في شات البوت.</p>
    <button class="btn btn-primary" onclick="startTelegramLink()"><i class="fa-brands fa-telegram"></i> ربط تليجرام</button>`;
}

// ---------- بث الأدمن ----------
// الجماهير المتاحة للبث: الكل أو دور واحد. الإرسال بيتم من الـ Worker للمربوطين فقط (~30 رسالة/ثانية).
export const BROADCAST_AUDIENCES = [
  {id: 'ALL', label: 'كل المربوطين'},
  {id: 'CUSTOMER', label: 'العملاء'},
  {id: 'MERCHANT', label: 'التجار'},
  {id: 'DELIVERY', label: 'مناديب التوصيل'},
  {id: 'MARKETER', label: 'المسوّقين'},
  {id: 'ADMIN', label: 'الأدمن'}
];

export function audienceLabel(id) {
  const a = BROADCAST_AUDIENCES.find(x => x.id === id);
  return a ? a.label : String(id || '');
}

const escHtml = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// إرسال البث. يتطلب توكن Firebase ID لأدمن مربوط تليجرام. بيرجع {ok,total,sent,blocked,failed}.
export function broadcast(audience, text, token, fetchImpl) {
  return post('/broadcast', {audience, text: String(text || '').slice(0, MAX_MESSAGE)}, {token, fetchImpl});
}

// معاينة النص بالظبط قبل الإرسال — موافقة الأدمن على النص النهائي شرط للبث.
export function broadcastPreviewHTML(audience, text) {
  return `<p style="font-size:13px;line-height:1.9;margin:0 0 10px">الرسالة دي هتتبعت كما هي بالظبط لـ: <b>${escHtml(audienceLabel(audience))}</b> (المربوطين على تليجرام فقط)</p>
    <div class="hint-box" style="padding:12px;margin:0 0 14px;white-space:pre-wrap;line-height:1.9">${escHtml(text)}</div>
    <div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="sendTelegramBroadcast()"><i class="fa-solid fa-paper-plane"></i> إرسال البث</button><button class="btn btn-ghost" onclick="UI.closeModal()">إلغاء</button></div>`;
}

export function broadcastResultHTML(r) {
  if (!r || r.ok !== true) return '<p class="hint-box" style="padding:12px;margin:0">حصلت مشكلة أثناء الإرسال. جرّب تاني بعد شوية.</p>';
  return `<p class="hint-box" style="padding:12px;margin:0">تم البث ✅ — وصلت لـ ${r.sent || 0} من ${r.total || 0}${r.blocked ? `، واتشال ${r.blocked} كانوا وقفين البوت` : ''}${r.failed ? `، وتعذر الإرسال لـ ${r.failed}` : ''}.</p>`;
}
