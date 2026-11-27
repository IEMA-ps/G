// Cloudflare Worker: بوت إشعارات تليجرام لـ«على بابك».
// مفيش أي وصول لـ Firestore من هنا: التطبيق بيبعت نص الإشعار جاهز، والـ Worker بس بيربط
// الحسابات بتليجرام (KV) ويبعت الرسايل عن طريق Bot API.
//
// المتغيرات (wrangler.toml [vars]): BOT_USERNAME, FIREBASE_PROJECT_ID
// الأسرار (wrangler secret put): BOT_TOKEN, WEBHOOK_SECRET (APP_SECRET اتلغى: كان ظاهر في كود الموقع. كل المسارات دلوقتي بتوكن Firebase والدور بيتحدد من Firestore)
// KV binding: TG_LINKS

const TG_API = 'https://api.telegram.org';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CODE_TTL_SECONDS = 900; // كود الربط صالح 15 دقيقة
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NOTIFY_KEYS = 10, MAX_TEXT = 3500;
const KEY_PATTERN = /^(m:|a:)[A-Za-z0-9_\-]{1,64}$/;

const ALLOWED_ORIGINS = new Set(['https://3alababk.com', 'https://www.3alababk.com', 'https://3alababk.pages.dev']);
const corsBase = {
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'vary': 'Origin'
};
function corsFor(request) {
  const origin = request.headers.get('origin') || '';
  const ok = ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.3alababk\.pages\.dev$/.test(origin);
  return ok ? {...corsBase, 'access-control-allow-origin': origin} : corsBase;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8'}});
}

// ---------- تليجرام ----------
// بيرجع {ok, blocked}: blocked = البوت اتحظر من المستخدم (403) — لازم يتشال من القوائم.
async function tgSend(env, chatId, text, fetchImpl = fetch) {
  const res = await fetchImpl(`${TG_API}/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true})
  });
  const data = await res.json().catch(() => ({}));
  return {ok: res.ok && data.ok === true, blocked: res.status === 403};
}

function tgOk(r) { return r === true || (r && r.ok === true); }
function tgBlocked(r) { return !!(r && r.blocked === true); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- توثيق ربط الحساب: توكن Firebase ID (RS256 من جوجل، بدون مكتبات) ----------
function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let jwksCache = {keys: null, expiresAt: 0};
async function getJwks(fetchImpl = fetch) {
  if (jwksCache.keys && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error('jwks fetch failed');
  const data = await res.json();
  const cc = res.headers.get('cache-control') || '';
  const m = cc.match(/max-age=(\d+)/);
  const maxAge = m ? Math.min(Number(m[1]), 21600) : 3600;
  jwksCache = {keys: data.keys || [], expiresAt: Date.now() + maxAge * 1000};
  return jwksCache.keys;
}

async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad header');
  const jwk = (await getJwks(fetchImpl)).find(k => k.kid === header.kid);
  if (!jwk) { jwksCache = {keys: null, expiresAt: 0}; throw new Error('unknown kid'); }
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('bad signature');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (payload.aud !== projectId) throw new Error('bad aud');
  if (!(payload.exp > nowSeconds) || !(payload.iat <= nowSeconds)) throw new Error('expired');
  if (!payload.sub) throw new Error('no sub');
  return payload.sub;
}

async function authedCtx(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    const uid = await internals.verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID || 'ala-babk');
    return uid ? {uid, token} : null;
  } catch {
    return null;
  }
}
async function authedUid(request, env) {
  const c = await authedCtx(request, env);
  return c ? c.uid : null;
}

// ---------- قراءة Firestore بتوكن المستخدم نفسه ----------
// الـ Worker مالوش حساب خدمة. بنقرا مستند بتوكن المتصل، فقواعد Firestore هي اللي بتقرر يقدر يشوفه ولا لأ،
// والدور (ADMIN/MERCHANT/...) بييجي من users/{uid} (المستخدم نفسه ميقدرش يعدّله: القواعد بتمنعه).
function fsValue(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  return undefined;
}
const FS_PATH = /^[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*$/;
async function fsGetDoc(env, token, path, fetchImpl = fetch) {
  if (!FS_PATH.test(path)) return null;
  const project = env.FIREBASE_PROJECT_ID || 'ala-babk';
  const res = await fetchImpl(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}`, {
    headers: {authorization: 'Bearer ' + token}
  });
  if (!res.ok) return null; // 404 (مفيش) أو 403 (القواعد منعت): الاتنين = مفيش صلاحية
  const data = await res.json().catch(() => null);
  if (!data || !data.fields) return null;
  const out = {};
  for (const [k, v] of Object.entries(data.fields)) { const x = fsValue(v); if (x !== undefined) out[k] = x; }
  return out;
}
// {uid, token, role, merchantId, deliveryAgentId} أو null لو المستخدم ملوش ملف في users.
async function loadCaller(env, ctx) {
  const doc = await internals.fsGetDoc(env, ctx.token, 'users/' + ctx.uid);
  if (!doc) return null;
  return {
    uid: ctx.uid, token: ctx.token,
    role: typeof doc.role === 'string' ? doc.role : '',
    merchantId: typeof doc.merchantId === 'string' && doc.merchantId ? doc.merchantId : null,
    deliveryAgentId: typeof doc.deliveryAgentId === 'string' && doc.deliveryAgentId ? doc.deliveryAgentId : null
  };
}
async function requireCaller(request, env) {
  const ctx = await authedCtx(request, env);
  if (!ctx) return {err: json({error: 'unauthorized'}, 401)};
  const caller = await loadCaller(env, ctx);
  if (!caller) return {err: json({error: 'forbidden'}, 403)};
  return {caller};
}
// المتصل يقدر يستهدف المفتاح ده؟ أدمن: role:ADMIN بس. تاجر: m:<merchantId بتاعه>. مندوب: a:<agentId بتاعه>.
function ownsKey(caller, k) {
  if (k === ADMIN_LIST_KEY) return caller.role === 'ADMIN';
  if (k.startsWith('m:')) return caller.merchantId === k.slice(2);
  if (k.startsWith('a:')) return caller.deliveryAgentId === k.slice(2);
  return false;
}
// حد أقصى بسيط للطلبات (نافذة ثابتة في KV): تقريبي لأن KV مش لحظي، بس بيوقف الإغراق.
async function rateLimit(env, name, id, max, windowSec) {
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${name}:${id}:${bucket}`;
  const n = Number(await env.TG_LINKS.get(key)) || 0;
  if (n >= max) return false;
  await env.TG_LINKS.put(key, String(n + 1), {expirationTtl: Math.max(60, windowSec * 2)});
  return true;
}

// ---------- توقيت القاهرة (الحجوزات بتتسجل بتاريخ وساعة القاهرة) ----------
const _cairoFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
function cairoParts(ms) {
  return Object.fromEntries(_cairoFmt.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
}
// epoch لميعاد (تاريخ + ساعة) بتوقيت القاهرة — بتصحح الفرق بين +2 و+3 حسب التوقيت الصيفي
function cairoToEpoch(date, time) {
  const guess = Date.parse(`${date}T${time}:00+02:00`);
  const p = cairoParts(guess);
  const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return guess + (Date.parse(`${date}T${time}:00Z`) - shown);
}
function fmtTimeAr(hm) { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; }

// ---------- مفاتيح KV ----------
const codeKey = code => 'code:' + code;
const uidKey = uid => 'uid:' + uid;
const chatKey = chatId => 'chat:' + chatId;
const ADMIN_LIST_KEY = 'role:ADMIN';
const ROLES = ['CUSTOMER', 'MERCHANT', 'DELIVERY', 'MARKETER', 'ADMIN'];
const roleListKey = role => 'role:' + role;

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function roleChatIds(env, role) {
  const raw = await env.TG_LINKS.get(roleListKey(role));
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
const adminChatIds = env => roleChatIds(env, 'ADMIN');

async function addToRoleList(env, role, chatId) {
  const ids = await roleChatIds(env, role);
  if (!ids.includes(chatId)) { ids.push(chatId); await env.TG_LINKS.put(roleListKey(role), JSON.stringify(ids)); }
}

async function removeFromRoleList(env, role, chatId) {
  const ids = (await roleChatIds(env, role)).filter(id => id !== chatId);
  await env.TG_LINKS.put(roleListKey(role), JSON.stringify(ids));
}

// شطب شات من كل حتة: سجل المستخدم، مفاتيح التاجر/المندوب، قوائم الأدوار، والمفتاح العكسي.
async function removeChatEverywhere(env, chatId) {
  const uid = await env.TG_LINKS.get(chatKey(chatId));
  const ops = [env.TG_LINKS.delete(chatKey(chatId))];
  if (uid) {
    const raw = await env.TG_LINKS.get(uidKey(uid));
    let link = {};
    try { link = JSON.parse(raw || '{}'); } catch {}
    ops.push(env.TG_LINKS.delete(uidKey(uid)));
    if (link.merchantId) ops.push(env.TG_LINKS.delete('m:' + link.merchantId));
    if (link.deliveryAgentId) ops.push(env.TG_LINKS.delete('a:' + link.deliveryAgentId));
    const role = link.role || (link.admin ? 'ADMIN' : link.merchantId ? 'MERCHANT' : link.deliveryAgentId ? 'DELIVERY' : null);
    if (role) ops.push(removeFromRoleList(env, role, chatId));
  } else {
    for (const role of ROLES) ops.push(removeFromRoleList(env, role, chatId));
  }
  await Promise.all(ops);
}

// ---------- تذكيرات الحجوزات الموقوتة (كرون) ----------
// الـ Worker مالوش وصول لـ Firestore (مبدأ ثابت في التصميم): التطبيق بيعمل مرآة لبيانات الحجز
// اللي التذكيرات محتاجاها في KV عن طريق /reminders/sync، والكرون بيقرأ المرآة دي بس.
// التاجر بيتحكم في كل نوع تذكير من التطبيق، والتفضيلات بتتخزن هنا في prefs:<merchantId>.
const REM_PREFIX = 'rem:';
const PREFS_PREFIX = 'prefs:';
const REM_STATUSES = new Set(['PENDING', 'ACCEPTED']); // أي حالة تانية = امسح المرآة
const REM_WINDOW_MIN = [45, 75]; // الكرون كل 10 دقايق، فالميعاد يدخل النافذة مرة واحدة
const UNANSWERED_AFTER_MS = 2 * 3600 * 1000;
const SUMMARY_HOUR = 20; // ملخص حجوزات بكرة الساعة 8 مساءً بتوقيت القاهرة
const REM_ID = /^[A-Za-z0-9_\-]{1,120}$/;
const REM_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REM_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// ساعة ملخص بكرة اللي التاجر اختارها (12 الضهر لـ11 بالليل بتوقيت القاهرة)، وغير كده الافتراضي.
export function summaryHourFor(prefs) {
  const h = prefs && prefs.summaryHour;
  return Number.isInteger(h) && h >= 12 && h <= 23 ? h : SUMMARY_HOUR;
}
const DEFAULT_PREFS = {reminder1h: true, unanswered2h: true, tomorrowSummary: true};

async function getPrefs(env, merchantId) {
  const raw = await env.TG_LINKS.get(PREFS_PREFIX + merchantId);
  if (!raw) return DEFAULT_PREFS;
  try { return {...DEFAULT_PREFS, ...JSON.parse(raw)}; } catch { return DEFAULT_PREFS; }
}

// مرآة حجز/حجوزات من التطبيق: PENDING/ACCEPTED بتتخزن، غير كده (إلغاء/رفض/انتهاء) بتمسح.
// الأمان: لازم توكن Firebase. وبنقرا مستند الحجز من Firestore بتوكن المتصل (القواعد بتسمح بس للعميل صاحب الحجز
// أو صاحب المتجر أو الأدمن)، وبنخزن بيانات المستند نفسه مش اللي العميل بعته. فمحدش يقدر يزوّر مرآة حجز مش بتاعه.
async function handleReminderSync(request, env) {
  const ctx = await authedCtx(request, env);
  if (!ctx) return json({error: 'unauthorized'}, 401);
  if (!(await rateLimit(env, 'rsync', ctx.uid, 60, 600))) return json({error: 'too many requests'}, 429);
  const body = await request.json().catch(() => null);
  const input = body && Array.isArray(body.bookings) ? body.bookings.slice(0, 20) : null;
  if (!input || !input.length) return json({error: 'bad request'}, 400);
  let stored = 0, deleted = 0, skipped = 0;
  const list = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !REM_ID.test(raw.id)) { skipped++; continue; }
    const doc = await internals.fsGetDoc(env, ctx.token, 'bookings/' + raw.id);
    if (!doc) { skipped++; continue; }
    list.push({id: raw.id, merchantId: doc.merchantId, customerName: doc.customerName, date: doc.date, time: doc.time, status: doc.status,
      createdAt: typeof doc.createdAt === 'number' && isFinite(doc.createdAt) ? doc.createdAt : (typeof raw.createdAt === 'number' ? raw.createdAt : NaN)});
  }
  for (const b of list) {
    const okShape = b && typeof b === 'object'
      && typeof b.id === 'string' && REM_ID.test(b.id)
      && typeof b.merchantId === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(b.merchantId)
      && typeof b.date === 'string' && REM_DATE.test(b.date)
      && typeof b.time === 'string' && REM_TIME.test(b.time)
      && typeof b.status === 'string'
      && typeof b.createdAt === 'number' && isFinite(b.createdAt);
    if (!okShape) { skipped++; continue; }
    const key = REM_PREFIX + b.id;
    if (!REM_STATUSES.has(b.status)) {
      await env.TG_LINKS.delete(key); deleted++; continue;
    }
    // احتفظ بعلامات الإرسال السابقة لو الحجز متزامن قبل كده
    let prev = {};
    try { prev = JSON.parse(await env.TG_LINKS.get(key) || '{}'); } catch {}
    const expiry = Math.max(cairoToEpoch(b.date, b.time) + 26 * 3600 * 1000, b.createdAt + 3 * 24 * 3600 * 1000);
    const entry = {
      merchantId: b.merchantId,
      customerName: String(b.customerName || '').slice(0, 200),
      date: b.date, time: b.time, status: b.status,
      createdAt: b.createdAt, exp: expiry,
      remindedAt: typeof prev.remindedAt === 'number' ? prev.remindedAt : null,
      alertedAt: typeof prev.alertedAt === 'number' ? prev.alertedAt : null,
      summaryFor: typeof prev.summaryFor === 'string' ? prev.summaryFor : null
    };
    const ttl = Math.max(3600, Math.floor((expiry - Date.now()) / 1000));
    await env.TG_LINKS.put(key, JSON.stringify(entry), {expirationTtl: ttl});
    stored++;
  }
  return json({ok: true, stored, deleted, skipped});
}

// تفضيلات التذكير لكل مقدم خدمة — التطبيق بيبعتها لما التاجر يغيّر المفاتيح. الافتراضي: الكل شغال.
// الأمان: توكن Firebase، والمتصل لازم يكون أدمن أو صاحب المتجر ده.
async function handleReminderPrefs(request, env) {
  const r = await requireCaller(request, env);
  if (r.err) return r.err;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.merchantId !== 'string' || !/^[A-Za-z0-9_\-]{1,64}$/.test(body.merchantId)) return json({error: 'bad request'}, 400);
  if (!(await rateLimit(env, 'rprefs', r.caller.uid, 30, 600))) return json({error: 'too many requests'}, 429);
  let allowed = r.caller.role === 'ADMIN' || r.caller.merchantId === body.merchantId;
  if (!allowed) {
    const m = await internals.fsGetDoc(env, r.caller.token, 'merchants/' + body.merchantId);
    allowed = !!(m && m.ownerId === r.caller.uid);
  }
  if (!allowed) return json({error: 'forbidden'}, 403);
  const prefs = await getPrefs(env, body.merchantId);
  let touched = false;
  if (body.summaryHour !== undefined) {
    if (!Number.isInteger(body.summaryHour) || body.summaryHour < 12 || body.summaryHour > 23) return json({error: 'bad request'}, 400);
    prefs.summaryHour = body.summaryHour; touched = true;
  }
  for (const k of ['reminder1h', 'unanswered2h', 'tomorrowSummary']) {
    if (typeof body[k] === 'boolean') { prefs[k] = body[k]; touched = true; }
  }
  if (!touched) return json({error: 'bad request'}, 400);
  await env.TG_LINKS.put(PREFS_PREFIX + body.merchantId, JSON.stringify(prefs));
  return json({ok: true, prefs});
}

async function sendToMerchant(env, merchantId, text) {
  const chatId = await env.TG_LINKS.get('m:' + merchantId);
  if (!chatId) return false;
  const r = await internals.tgSend(env, chatId, text);
  if (tgBlocked(r)) await internals.removeChatEverywhere(env, chatId);
  return tgOk(r);
}

// جسم الكرون: بيتنفذ كل 10 دقايق. بيفحص مرايا الحجوزات ويبعت:
// 1) تذكير قبل الميعاد المقبول بساعة (مرة واحدة).
// 2) تنبيه بحجز مستني رد من ساعتين — رسالة واحدة مجمعة لكل مقدم خدمة (الحجز الأسبوعي متعملش سبام).
// 3) ملخص مواعيد بكرة المقبولة، الساعة 8 مساءً بتوقيت القاهرة (مرة واحدة في اليوم).
async function runCron(env, now = Date.now()) {
  const keys = [];
  let cursor;
  do {
    const res = await env.TG_LINKS.list(cursor ? {prefix: REM_PREFIX, cursor} : {prefix: REM_PREFIX});
    for (const k of res.keys || []) keys.push(k.name);
    cursor = res.list_complete === false ? res.cursor : null;
  } while (cursor);

  const p = cairoParts(now);
  const today = `${p.year}-${p.month}-${p.day}`;
  const tomorrowD = new Date(Date.parse(today + 'T12:00:00Z'));
  tomorrowD.setUTCDate(tomorrowD.getUTCDate() + 1);
  const tomorrow = tomorrowD.toISOString().slice(0, 10);

  const pendingByMerchant = new Map(), tomorrowByMerchant = new Map();
  const saves = [];
  const save = e => saves.push(env.TG_LINKS.put(REM_PREFIX + e.id, JSON.stringify(e), {expirationTtl: Math.max(3600, Math.floor(((e.exp || (now + 26 * 3600 * 1000)) - now) / 1000))}));
  let reminders = 0, alerts = 0, summaries = 0;

  for (const key of keys) {
    let e;
    try { e = JSON.parse(await env.TG_LINKS.get(key) || 'null'); } catch { e = null; }
    if (!e || !e.merchantId) continue;
    e.id = key.slice(REM_PREFIX.length);
    const prefs = await getPrefs(env, e.merchantId);
    const startsAt = cairoToEpoch(e.date, e.time);

    if (e.status === 'ACCEPTED' && !e.remindedAt && prefs.reminder1h !== false) {
      const mins = (startsAt - now) / 60000;
      if (mins >= REM_WINDOW_MIN[0] && mins <= REM_WINDOW_MIN[1]) {
        const dayWord = e.date === today ? 'النهارده' : (e.date === tomorrow ? 'بكرة' : 'يوم ' + e.date);
        if (await sendToMerchant(env, e.merchantId, `⏰ تذكير بميعاد\n\nعندك ميعاد مع ${e.customerName || 'العميل'} ${dayWord} الساعة ${fmtTimeAr(e.time)} — فاضل عليه حوالي ساعة.`)) {
          e.remindedAt = now; save(e); reminders++;
        }
      }
    }

    // الحجز اللي ميعاده فات خلاص مش محتاج تنبيه «مستني ردك»
    if (e.status === 'PENDING' && !e.alertedAt && now - e.createdAt >= UNANSWERED_AFTER_MS && startsAt > now && prefs.unanswered2h !== false) {
      if (!pendingByMerchant.has(e.merchantId)) pendingByMerchant.set(e.merchantId, []);
      pendingByMerchant.get(e.merchantId).push(e);
    }

    if (Number(p.hour) === summaryHourFor(prefs) && e.status === 'ACCEPTED' && e.date === tomorrow && e.summaryFor !== tomorrow && prefs.tomorrowSummary !== false) {
      if (!tomorrowByMerchant.has(e.merchantId)) tomorrowByMerchant.set(e.merchantId, []);
      tomorrowByMerchant.get(e.merchantId).push(e);
    }
  }

  for (const [mid, list] of pendingByMerchant) {
    list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const f = list[0];
    const text = list.length === 1
      ? `⏳ حجز مستني ردك\n\n${f.customerName || 'عميل'} طلب ميعاد يوم ${f.date} الساعة ${fmtTimeAr(f.time)} ومستني ردك من أكتر من ساعتين.\nادخل التطبيق واقبل أو ارفض عشان العميل ميمشيش.`
      : `⏳ عندك ${list.length} حجوزات مستنية ردك من أكتر من ساعتين.\n\nأقربها: ${f.customerName || 'عميل'} يوم ${f.date} الساعة ${fmtTimeAr(f.time)}.\nادخل التطبيق ورد عليهم عشان العملاء ميمشوش.`;
    if (await sendToMerchant(env, mid, text)) {
      for (const e of list) { e.alertedAt = now; save(e); }
      alerts += list.length;
    }
  }

  for (const [mid, list] of tomorrowByMerchant) {
    list.sort((a, b) => a.time.localeCompare(b.time));
    const lines = list.slice(0, 5).map(x => `• ${fmtTimeAr(x.time)} — ${x.customerName || 'عميل'}`);
    if (list.length > 5) lines.push(`… و ${list.length - 5} كمان`);
    const text = `📋 ملخص حجوزات بكرة (${tomorrow})\n\nعندك ${list.length} مواعيد مقبولة:\n${lines.join('\n')}`;
    if (await sendToMerchant(env, mid, text)) {
      for (const e of list) { e.summaryFor = tomorrow; save(e); }
      summaries++;
    }
  }

  await Promise.all(saves);
  return {scanned: keys.length, reminders, alerts, summaries};
}

// ---------- Web Push (VAPID + RFC 8291) ----------
// إشعارات متصفح لنفس مفاتيح /notify: التطبيق بيسجل اشتراكات البوش، و/notify بيبعت تليجرام وبوش مع بعض.
// مفتاح VAPID بيتولد أول مرة وبيتخزن في KV — مفيش أسرار جديدة ولا خطوات كونسول على إسلام.
const VAPID_KEY = 'vapid:keys';
const VAPID_SUBJECT = 'https://3alababk.com';
const PUSH_SUB_PREFIX = 'push:sub:';   // push:sub:<hash> -> {endpoint, keys, uid, selectors, createdAt}
const PUSH_IDX_PREFIX = 'push:idx:';   // push:idx:<selector> -> [hash,...] — selector = مفاتيح /notify + uid:<uid>
const PUSH_MAX_SELECTORS = 10, PUSH_MAX_PER_SELECTOR = 50;
const B64URL_RE = /^[A-Za-z0-9_\-]+=*$/;
const UID_KEY_RE = /^uid:[A-Za-z0-9_\-]{1,128}$/;

function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const str = String(s);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concatBytes(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

// مفتاح VAPID: بيتولد مرة واحدة (ECDSA P-256) وبيتخزن كامل في KV؛ اللي بيطلع بره هو المفتاح العام بس.
async function getVapid(env) {
  const raw = await env.TG_LINKS.get(VAPID_KEY);
  if (raw) { try { const v = JSON.parse(raw); if (v && v.jwkPriv && v.pub) return v; } catch {} }
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign']);
  const jwkPriv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const rec = {jwkPriv, pub: b64urlEncode(pubRaw)};
  await env.TG_LINKS.put(VAPID_KEY, JSON.stringify(rec));
  return rec;
}

async function vapidJwt(vapid, endpoint) {
  const enc = new TextEncoder();
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({typ: 'JWT', alg: 'ES256'})));
  const payload = b64urlEncode(enc.encode(JSON.stringify({aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: VAPID_SUBJECT})));
  const key = await crypto.subtle.importKey('jwk', vapid.jwkPriv, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, enc.encode(header + '.' + payload)));
  return `${header}.${payload}.${b64urlEncode(sig)}`;
}

// تشفير الرسالة RFC 8291 (aes128gcm): ECDH مع مفتاح المتصفح + auth secret، سجل واحد أخير (فاصل 0x02).
async function encryptPushPayload(sub, data) {
  const enc = new TextEncoder();
  const uaPub = b64urlDecode(sub.keys.p256dh);
  const authSecret = b64urlDecode(sub.keys.auth);
  const asPair = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asPair.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, {name: 'ECDH', namedCurve: 'P-256'}, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: uaKey}, asPair.privateKey, 256));
  const keyInfo = concatBytes(enc.encode('WebPush: info\0'), uaPub, asPub);
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const ikm = await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = (await hmacSha256(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmacSha256(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, {name: 'AES-GCM'}, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce}, aesKey, concatBytes(data, new Uint8Array([2]))));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatBytes(salt, rs, new Uint8Array([asPub.length]), asPub, ciphertext);
}

async function pushSendOnce(env, vapid, sub, payload, fetchImpl = fetch) {
  const jwt = await vapidJwt(vapid, sub.endpoint);
  const body = await encryptPushPayload(sub, new TextEncoder().encode(payload));
  const res = await fetchImpl(sub.endpoint, {
    method: 'POST',
    headers: {
      'authorization': `vapid t=${jwt}, k=${vapid.pub}`,
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'ttl': '3600'
    },
    body
  });
  // 404/410 = الاشتراك مات — لازم يتشال
  return {ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410};
}

async function pushHash(endpoint) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return b64urlEncode(d).slice(0, 32);
}
async function pushIdxGet(env, selector) {
  const raw = await env.TG_LINKS.get(PUSH_IDX_PREFIX + selector);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function pushIdxAdd(env, selector, hash) {
  const list = await pushIdxGet(env, selector);
  if (list.includes(hash)) return;
  list.push(hash);
  if (list.length > PUSH_MAX_PER_SELECTOR) list.shift();
  await env.TG_LINKS.put(PUSH_IDX_PREFIX + selector, JSON.stringify(list));
}
async function pushIdxRemove(env, selector, hash) {
  const list = await pushIdxGet(env, selector);
  const next = list.filter(h => h !== hash);
  if (next.length !== list.length) await env.TG_LINKS.put(PUSH_IDX_PREFIX + selector, JSON.stringify(next));
}
async function removePushSub(env, hash) {
  let sub = null;
  try { sub = JSON.parse(await env.TG_LINKS.get(PUSH_SUB_PREFIX + hash) || 'null'); } catch {}
  const ops = [env.TG_LINKS.delete(PUSH_SUB_PREFIX + hash)];
  if (sub) for (const sel of sub.selectors || []) ops.push(pushIdxRemove(env, sel, hash));
  await Promise.all(ops);
}

async function handlePushKey(_request, env) {
  const v = await getVapid(env);
  return json({key: v.pub});
}

async function handlePushSubscribe(request, env) {
  const r = await requireCaller(request, env);
  if (r.err) return r.err;
  const uid = r.caller.uid;
  if (!(await rateLimit(env, 'psub', uid, 20, 600))) return json({error: 'too many requests'}, 429);
  const body = await request.json().catch(() => null);
  const s = body && body.subscription;
  const valid = s && typeof s.endpoint === 'string' && s.endpoint.length <= 1024 && s.endpoint.startsWith('https://')
    && s.keys && typeof s.keys.p256dh === 'string' && B64URL_RE.test(s.keys.p256dh) && s.keys.p256dh.length <= 256
    && typeof s.keys.auth === 'string' && B64URL_RE.test(s.keys.auth) && s.keys.auth.length <= 64;
  if (!valid) return json({error: 'bad request'}, 400);
  const selectors = (Array.isArray(body.keys) ? body.keys : [])
    .filter(k => typeof k === 'string' && (k === ADMIN_LIST_KEY || KEY_PATTERN.test(k)) && ownsKey(r.caller, k))
    .slice(0, PUSH_MAX_SELECTORS);
  const uidSel = 'uid:' + uid;
  if (!selectors.includes(uidSel)) selectors.push(uidSel);
  const hash = await pushHash(s.endpoint);
  const record = {endpoint: s.endpoint, keys: {p256dh: s.keys.p256dh, auth: s.keys.auth}, uid, selectors, createdAt: Date.now()};
  const ops = [env.TG_LINKS.put(PUSH_SUB_PREFIX + hash, JSON.stringify(record))];
  for (const sel of selectors) ops.push(pushIdxAdd(env, sel, hash));
  await Promise.all(ops);
  return json({ok: true});
}

async function handlePushUnsubscribe(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const body = await request.json().catch(() => null);
  const endpoint = body && (typeof body.endpoint === 'string' ? body.endpoint : (body.subscription && body.subscription.endpoint));
  if (typeof endpoint !== 'string' || !endpoint) return json({error: 'bad request'}, 400);
  await removePushSub(env, await pushHash(endpoint));
  return json({ok: true});
}

// بعت بوش لكل الاشتراكات المسجلة تحت مفاتيح الإشعار. الفشل العابر بيتجاهل، والميت (404/410) بيتشال.
async function pushFanOut(env, keys, title, message) {
  const hashes = new Set();
  for (const k of keys) (await pushIdxGet(env, k)).forEach(h => hashes.add(h));
  if (!hashes.size) return {pushed: 0, gone: 0};
  const vapid = await getVapid(env);
  const payload = JSON.stringify({title: String(title || '').slice(0, 200), body: String(message || '').slice(0, 3000)});
  let pushed = 0, gone = 0;
  await Promise.all([...hashes].map(async h => {
    let sub = null;
    try { sub = JSON.parse(await env.TG_LINKS.get(PUSH_SUB_PREFIX + h) || 'null'); } catch {}
    if (!sub || !sub.endpoint) return;
    let r;
    try { r = await internals.pushSendOnce(env, vapid, sub, payload); } catch { return; }
    if (r && r.ok) pushed++;
    else if (r && r.gone) { gone++; await removePushSub(env, h); }
  }));
  return {pushed, gone};
}

// ---------- تذكير السلة المتروكة ----------
// التطبيق بيبعت ملخص السلة (بتوكن Firebase) بعد كل تغيير. الكرون بيبعت بوش واحد بس لو السلة ساكتة ساعتين.
// ملخص صغير بس (عدد، إجمالي، أول 3 أسماء)، مش السلة كاملة. بيتمسح لما السلة تفضى أو الطلب يتأكد، وبيتشال لوحده بعد 3 أيام.
const CART_PREFIX = 'cart:';
const CART_IDLE_MS = 2 * 3600 * 1000;
const CART_MAX_AGE_MS = 30 * 3600 * 1000;
const CART_TTL_SECONDS = 3 * 86400;
async function handleCartSync(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  let body;
  try { body = await request.json(); } catch { return json({error: 'bad json'}, 400); }
  const count = Math.floor(Number(body && body.count) || 0);
  if (count <= 0) { await env.TG_LINKS.delete(CART_PREFIX + uid); return json({ok: true, cleared: true}); }
  const titles = (Array.isArray(body.titles) ? body.titles : []).slice(0, 3).map(t => String(t || '').slice(0, 40)).filter(Boolean);
  const total = Math.max(0, Math.round((Number(body.total) || 0) * 100) / 100);
  let prev = {};
  try { prev = JSON.parse(await env.TG_LINKS.get(CART_PREFIX + uid) || '{}'); } catch {}
  // لو التذكير اتبعت لنفس السلة قبل كده ما نبعتش تاني، وبعد ما السلة تفضى وتتملي من جديد بيبدأ من الأول.
  const entry = {uid, count: Math.min(count, 999), total, titles, updatedAt: Date.now(), sentAt: prev.sentAt || 0};
  await env.TG_LINKS.put(CART_PREFIX + uid, JSON.stringify(entry), {expirationTtl: CART_TTL_SECONDS});
  return json({ok: true});
}
function cartMessage(e) {
  const names = (e.titles || []).join('، ');
  const more = e.count > (e.titles || []).length ? ' وغيرهم' : '';
  return {title: 'سلتك لسه مستنياك 🛒', body: `عندك ${e.count} ${e.count === 1 ? 'منتج' : 'منتجات'} في السلة${names ? ' (' + names + more + ')' : ''}${e.total ? ' بإجمالي ' + e.total + ' ج.م' : ''}. كمّل طلبك قبل ما ينفذ.`};
}
// مفيش تذكير بالليل: من 9 الصبح لـ 10 بالليل بتوقيت القاهرة بس.
function cartHourOk(now) { const h = Number(cairoParts(now).hour); return h >= 9 && h < 22; }
async function runCartCron(env, now = Date.now()) {
  if (!cartHourOk(now)) return {sent: 0};
  const keys = [];
  let cursor;
  do {
    const res = await env.TG_LINKS.list(cursor ? {prefix: CART_PREFIX, cursor} : {prefix: CART_PREFIX});
    for (const k of res.keys || []) keys.push(k.name);
    cursor = res.list_complete === false ? res.cursor : null;
  } while (cursor);
  let sent = 0;
  for (const key of keys) {
    let e = null;
    try { e = JSON.parse(await env.TG_LINKS.get(key) || 'null'); } catch {}
    if (!e || e.sentAt) continue;
    const age = now - (e.updatedAt || 0);
    if (age < CART_IDLE_MS) continue;
    if (age > CART_MAX_AGE_MS) { await env.TG_LINKS.delete(key); continue; }
    // نعلّم قبل الإرسال عشان الفشل ما يكررش التذكير
    e.sentAt = now;
    await env.TG_LINKS.put(key, JSON.stringify(e), {expirationTtl: CART_TTL_SECONDS});
    const m = cartMessage(e);
    const r = await internals.pushFanOut(env, ['uid:' + e.uid], m.title, m.body);
    if (r && r.pushed > 0) sent++;
  }
  return {sent};
}

// ---------- المسارات ----------
// الدور بييجي من users/{uid} في Firestore (بتوكن المتصل)، مش من اللي العميل بعته. أي طلب لدور مش بتاعه = 403.
async function handleLinkStart(request, env) {
  const r = await requireCaller(request, env);
  if (r.err) return r.err;
  const c = r.caller;
  if (!(await rateLimit(env, 'lstart', c.uid, 10, 600))) return json({error: 'too many requests'}, 429);
  const body = await request.json().catch(() => ({}));
  const idOk = v => typeof v === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(v);
  const link = {uid: c.uid, merchantId: null, deliveryAgentId: null, admin: false, customer: false, marketer: false};
  if (body.admin === true) { if (c.role !== 'ADMIN') return json({error: 'forbidden'}, 403); link.admin = true; }
  if (idOk(body.merchantId)) { if (c.merchantId !== body.merchantId) return json({error: 'forbidden'}, 403); link.merchantId = body.merchantId; }
  if (idOk(body.deliveryAgentId)) { if (c.deliveryAgentId !== body.deliveryAgentId) return json({error: 'forbidden'}, 403); link.deliveryAgentId = body.deliveryAgentId; }
  if (body.marketer === true) { if (c.role !== 'MARKETER') return json({error: 'forbidden'}, 403); link.marketer = true; }
  if (body.customer === true) link.customer = true; // أي مستخدم له ملف: بيستقبل إشعارات حسابه هو بس
  link.role = link.admin ? 'ADMIN' : link.merchantId ? 'MERCHANT' : link.deliveryAgentId ? 'DELIVERY' : link.customer ? 'CUSTOMER' : link.marketer ? 'MARKETER' : null;
  if (!link.role) return json({error: 'bad request'}, 400);
  const code = newCode();
  await env.TG_LINKS.put(codeKey(code), JSON.stringify(link), {expirationTtl: CODE_TTL_SECONDS});
  return json({url: `https://t.me/${env.BOT_USERNAME}?start=${code}`});
}

async function handleLinkStatus(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const raw = await env.TG_LINKS.get(uidKey(uid));
  return json({linked: !!raw});
}

async function handleLinkStop(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const raw = await env.TG_LINKS.get(uidKey(uid));
  if (raw) {
    let link = {};
    try { link = JSON.parse(raw); } catch {}
    if (link.chatId) await internals.removeChatEverywhere(env, link.chatId);
    else {
      const ops = [env.TG_LINKS.delete(uidKey(uid))];
      if (link.merchantId) ops.push(env.TG_LINKS.delete('m:' + link.merchantId));
      if (link.deliveryAgentId) ops.push(env.TG_LINKS.delete('a:' + link.deliveryAgentId));
      await Promise.all(ops);
    }
  }
  return json({linked: false});
}

// الأمان: لازم توكن Firebase لمستخدم له ملف في users، وحد أقصى للطلبات (العادي 30 كل 10 دقايق، الأدمن 300).
// ملاحظة: مستخدم مسجل لسه يقدر يبعت إشعار لتاجر أو للأدمن (لأن العميل بيبلّغهم بالطلب الجديد)، بس بمعدل محدود ومعروف هويته.
async function handleNotify(request, env) {
  const r = await requireCaller(request, env);
  if (r.err) return r.err;
  if (!(await rateLimit(env, 'notify', r.caller.uid, r.caller.role === 'ADMIN' ? 300 : 30, 600))) return json({error: 'too many requests'}, 429);
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.keys)) return json({error: 'bad request'}, 400);
  const keys = body.keys.filter(k => typeof k === 'string' && (k === ADMIN_LIST_KEY || KEY_PATTERN.test(k))).slice(0, MAX_NOTIFY_KEYS);
  const text = (String(body.title || '') + '\n\n' + String(body.message || '')).trim().slice(0, MAX_TEXT);
  if (!keys.length || !text) return json({error: 'bad request'}, 400);
  const chatIds = new Set();
  for (const k of keys) {
    if (k === ADMIN_LIST_KEY) { (await adminChatIds(env)).forEach(id => chatIds.add(id)); continue; }
    const chatId = await env.TG_LINKS.get(k);
    if (chatId) chatIds.add(chatId);
  }
  let sent = 0;
  for (const chatId of chatIds) {
    const r = await internals.tgSend(env, chatId, text);
    if (tgOk(r)) sent++;
    else if (tgBlocked(r)) await internals.removeChatEverywhere(env, chatId);
  }
  // بوش المتصفح لنفس المفاتيح — من غير ما يأثر على رد التليجرام
  let pushed = 0;
  try { pushed = (await internals.pushFanOut(env, keys, body.title, body.message)).pushed; } catch {}
  return json({sent, pushed});
}

async function handleWebhook(request, env) {
  if ((request.headers.get('x-telegram-bot-api-secret-token') || '') !== env.WEBHOOK_SECRET) return json({ok: false}, 401);
  const update = await request.json().catch(() => null);
  const msg = update && update.message;
  if (!msg || !msg.chat || !msg.text) return json({ok: true});
  const chatId = String(msg.chat.id);
  const parts = msg.text.trim().split(/\s+/);
  if (parts[0] === '/stop') {
    const linkedUid = await env.TG_LINKS.get(chatKey(chatId));
    if (linkedUid) {
      await internals.removeChatEverywhere(env, chatId);
      await internals.tgSend(env, chatId, 'اتلغى الاشتراك ✅\nمش هتوصلك إشعارات من «على بابك» هنا تاني. تقدر ترجع تربط حسابك من التطبيق في أي وقت.');
    } else {
      await internals.tgSend(env, chatId, 'حسابك مش مربوط أصلًا. لو حبيت تشترك، اربط حسابك من تطبيق «على بابك».');
    }
    return json({ok: true});
  }
  if (parts[0] !== '/start') return json({ok: true});
  const code = parts[1] || '';
  if (!code) {
    await internals.tgSend(env, chatId, 'أهلًا 👋 ده بوت إشعارات «على بابك».\nعشان تربط حسابك، افتح التطبيق واضغط «إشعارات الطلبات على تليجرام» من صفحة حسابك.');
    return json({ok: true});
  }
  const raw = await env.TG_LINKS.get(codeKey(code));
  if (!raw) {
    await internals.tgSend(env, chatId, 'لينك الربط ده خلصت مدته أو اتستخدم. ارجع للتطبيق واطلب ربط جديد.');
    return json({ok: true});
  }
  let link;
  try { link = JSON.parse(raw); } catch { return json({ok: true}); }
  const record = {chatId, merchantId: link.merchantId, deliveryAgentId: link.deliveryAgentId, admin: link.admin === true, role: link.role || null};
  const ops = [
    env.TG_LINKS.put(uidKey(link.uid), JSON.stringify(record)),
    env.TG_LINKS.put(chatKey(chatId), link.uid),
    env.TG_LINKS.delete(codeKey(code))
  ];
  if (link.merchantId) ops.push(env.TG_LINKS.put('m:' + link.merchantId, chatId));
  if (link.deliveryAgentId) ops.push(env.TG_LINKS.put('a:' + link.deliveryAgentId, chatId));
  if (record.role) ops.push(addToRoleList(env, record.role, chatId));
  await Promise.all(ops);
  await internals.tgSend(env, chatId, 'تم الربط ✅\nحسابك في «على بابك» اتربط بتليجرام، وهتوصلك الإشعارات هنا فورًا.\nلو حبيت توقف الإشعارات في أي وقت، ابعت /stop هنا.');
  return json({ok: true});
}

// إعداد الـ webhook عند تليجرام — مرة واحدة بعد النشر. محمي بتوكن Firebase لأدمن.
async function handleSetupWebhook(request, env) {
  const r = await requireCaller(request, env);
  if (r.err) return r.err;
  if (r.caller.role !== 'ADMIN') return json({error: 'forbidden'}, 403);
  const origin = new URL(request.url).origin;
  const res = await fetch(`${TG_API}/bot${env.BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({url: origin + '/tg/webhook', secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message']})
  });
  const data = await res.json().catch(() => ({}));
  return json({ok: res.ok && data.ok === true, telegram: data});
}

// بث رسالة من الأدمن. محمي: لازم المتصل يكون أدمن مربوط.
// وضعين: audience بدور (تليجرام بس، زي ما هي من غير تغيير)، أو keys قائمة 'uid:<uid>' (حد أقصى 100)
// وبعدين بيتجاهل audience — التطبيق بيحل بيها «كل التجار» و«المقدمين» و«شخص واحد» لقائمة uid من عنده.
// في وضع keys: تليجرام من سجل الربط uid:<uid> + بوش المتصفح من فهرس uid:<uid>، وبيرجع total = عدد
// الـ uids اللي ليها ربط تليجرام أو اشتراك بوش.
// تليجرام بيحدّ ~30 رسالة/ثانية — بنبعت بالتتابع مع مهلة 34ms بين كل رسالة.
async function handleBroadcast(request, env) {
  const rc = await requireCaller(request, env);
  if (rc.err) return rc.err;
  // الدور الحالي من Firestore (لو اتشال من الأدمن يتمنع فورًا) + لازم يكون مربوط كأدمن.
  if (rc.caller.role !== 'ADMIN') return json({error: 'forbidden'}, 403);
  if (!(await rateLimit(env, 'bcast', rc.caller.uid, 20, 600))) return json({error: 'too many requests'}, 429);
  const uid = rc.caller.uid;
  const rawLink = await env.TG_LINKS.get(uidKey(uid));
  let link = {};
  try { link = JSON.parse(rawLink || '{}'); } catch {}
  if (link.role !== 'ADMIN' && link.admin !== true) return json({error: 'forbidden'}, 403);
  const body = await request.json().catch(() => null);
  if (!body) return json({error: 'bad request'}, 400);
  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  if (!text) return json({error: 'bad request'}, 400);

  // وضع المفاتيح الصريحة: uid بس، تحقق صارم — قائمة فاضية أو أي مفتاح غلط أو أكتر من 100 = 400
  if (Array.isArray(body.keys)) {
    if (!body.keys.length || body.keys.length > 100) return json({error: 'bad request'}, 400);
    const keys = body.keys;
    for (const k of keys) if (typeof k !== 'string' || !UID_KEY_RE.test(k)) return json({error: 'bad request'}, 400);
    const uids = [...new Set(keys.map(k => k.slice(4)))];

    const chatIds = new Set();
    const linkedUids = new Set(), pushUids = new Set();
    for (const u of uids) {
      let rec = {};
      try { rec = JSON.parse(await env.TG_LINKS.get(uidKey(u)) || '{}'); } catch {}
      if (rec.chatId) { chatIds.add(rec.chatId); linkedUids.add(u); }
      if ((await pushIdxGet(env, 'uid:' + u)).length) pushUids.add(u);
    }
    const total = new Set([...linkedUids, ...pushUids]).size;

    let sent = 0, blocked = 0, failed = 0;
    for (const chatId of chatIds) {
      const r = await internals.tgSend(env, chatId, text);
      if (tgOk(r)) sent++;
      else if (tgBlocked(r)) { blocked++; await internals.removeChatEverywhere(env, chatId); }
      else failed++;
      if (chatIds.size > 1) await sleep(34);
    }

    let pushed = 0;
    try { pushed = (await internals.pushFanOut(env, uids.map(u => 'uid:' + u), 'على بابك', text)).pushed; } catch {}

    return json({ok: true, total, sent, pushed, blocked, failed});
  }

  // وضع الجمهور بالدور: زي ما هو من غير تغيير
  const audience = String(body.audience || 'ALL').toUpperCase();
  const roles = audience === 'ALL' ? ROLES : (ROLES.includes(audience) ? [audience] : null);
  if (!roles) return json({error: 'bad request'}, 400);
  const chatIds = new Set();
  for (const role of roles) (await roleChatIds(env, role)).forEach(id => chatIds.add(id));
  let sent = 0, blocked = 0, failed = 0;
  for (const chatId of chatIds) {
    const r = await internals.tgSend(env, chatId, text);
    if (tgOk(r)) sent++;
    else if (tgBlocked(r)) { blocked++; await internals.removeChatEverywhere(env, chatId); }
    else failed++;
    if (chatIds.size > 1) await sleep(34);
  }
  return json({ok: true, total: chatIds.size, sent, blocked, failed});
}

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204});
  if (url.pathname === '/health') return json({ok: true});
  if (url.pathname === '/tg/webhook' && request.method === 'POST') return handleWebhook(request, env);
  if (url.pathname === '/tg/setup-webhook' && request.method === 'POST') return handleSetupWebhook(request, env);
  if (url.pathname === '/link/start' && request.method === 'POST') return handleLinkStart(request, env);
  if (url.pathname === '/link/status' && request.method === 'GET') return handleLinkStatus(request, env);
  if (url.pathname === '/link/stop' && request.method === 'POST') return handleLinkStop(request, env);
  if (url.pathname === '/notify' && request.method === 'POST') return handleNotify(request, env);
  if (url.pathname === '/push/key' && request.method === 'GET') return handlePushKey(request, env);
  if (url.pathname === '/push/subscribe' && request.method === 'POST') return handlePushSubscribe(request, env);
  if (url.pathname === '/push/unsubscribe' && request.method === 'POST') return handlePushUnsubscribe(request, env);
  if (url.pathname === '/reminders/sync' && request.method === 'POST') return handleReminderSync(request, env);
  if (url.pathname === '/reminders/prefs' && request.method === 'POST') return handleReminderPrefs(request, env);
  if (url.pathname === '/cart/sync' && request.method === 'POST') return handleCartSync(request, env);
  if (url.pathname === '/broadcast' && request.method === 'POST') return handleBroadcast(request, env);
  return json({error: 'not found'}, 404);
}

// للاختبار المحلي: نقدر نستبدل التحقق والإرسال ببدائل وهمية.
const internals = {fsGetDoc, runCartCron, cartMessage, summaryHourFor, verifyFirebaseIdToken, tgSend, removeChatEverywhere, runCron, cairoToEpoch, fmtTimeAr, getVapid, vapidJwt, encryptPushPayload, pushSendOnce, pushFanOut, pushHash};
export const _internals = internals;

export default {
  async fetch(request, env, _ctx) {
    try {
      const res = await route(request, env);
      for (const [k, v] of Object.entries(corsFor(request))) res.headers.set(k, v);
      return res;
    } catch (e) {
      return json({error: 'internal'}, 500);
    }
  },
  // كرون كل 10 دقايق — شوف runCron فوق
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(internals.runCron(env));
    ctx.waitUntil(internals.runCartCron(env));
  }
};
