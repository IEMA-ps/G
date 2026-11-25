// Cloudflare Worker: بوت إشعارات تليجرام لـ«على بابك».
// مفيش أي وصول لـ Firestore من هنا: التطبيق بيبعت نص الإشعار جاهز، والـ Worker بس بيربط
// الحسابات بتليجرام (KV) ويبعت الرسايل عن طريق Bot API.
//
// المتغيرات (wrangler.toml [vars]): BOT_USERNAME, FIREBASE_PROJECT_ID
// الأسرار (wrangler secret put): BOT_TOKEN, APP_SECRET, WEBHOOK_SECRET
// KV binding: TG_LINKS

const TG_API = 'https://api.telegram.org';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CODE_TTL_SECONDS = 900; // كود الربط صالح 15 دقيقة
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NOTIFY_KEYS = 10, MAX_TEXT = 3500;
const KEY_PATTERN = /^(m:|a:)[A-Za-z0-9_\-]{1,64}$/;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-app-secret'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', ...cors}});
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

async function authedUid(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    return await internals.verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID || 'ala-babk');
  } catch {
    return null;
  }
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
const DEFAULT_PREFS = {reminder1h: true, unanswered2h: true, tomorrowSummary: true};

async function getPrefs(env, merchantId) {
  const raw = await env.TG_LINKS.get(PREFS_PREFIX + merchantId);
  if (!raw) return DEFAULT_PREFS;
  try { return {...DEFAULT_PREFS, ...JSON.parse(raw)}; } catch { return DEFAULT_PREFS; }
}

// مرآة حجز/حجوزات من التطبيق: PENDING/ACCEPTED بتتخزن، غير كده (إلغاء/رفض/انتهاء) بتمسح.
async function handleReminderSync(request, env) {
  if ((request.headers.get('x-app-secret') || '') !== env.APP_SECRET) return json({error: 'unauthorized'}, 401);
  const body = await request.json().catch(() => null);
  const list = body && Array.isArray(body.bookings) ? body.bookings.slice(0, 100) : null;
  if (!list || !list.length) return json({error: 'bad request'}, 400);
  let stored = 0, deleted = 0, skipped = 0;
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
async function handleReminderPrefs(request, env) {
  if ((request.headers.get('x-app-secret') || '') !== env.APP_SECRET) return json({error: 'unauthorized'}, 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.merchantId !== 'string' || !/^[A-Za-z0-9_\-]{1,64}$/.test(body.merchantId)) return json({error: 'bad request'}, 400);
  const prefs = await getPrefs(env, body.merchantId);
  let touched = false;
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
  const inSummaryWindow = Number(p.hour) === SUMMARY_HOUR;

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

    if (inSummaryWindow && e.status === 'ACCEPTED' && e.date === tomorrow && e.summaryFor !== tomorrow && prefs.tomorrowSummary !== false) {
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

// ---------- المسارات ----------
async function handleLinkStart(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const body = await request.json().catch(() => ({}));
  const link = {
    uid,
    merchantId: typeof body.merchantId === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(body.merchantId) ? body.merchantId : null,
    deliveryAgentId: typeof body.deliveryAgentId === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(body.deliveryAgentId) ? body.deliveryAgentId : null,
    admin: body.admin === true,
    customer: body.customer === true,
    marketer: body.marketer === true
  };
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

async function handleNotify(request, env) {
  if ((request.headers.get('x-app-secret') || '') !== env.APP_SECRET) return json({error: 'unauthorized'}, 401);
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
  return json({sent});
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

// إعداد الـ webhook عند تليجرام — مرة واحدة بعد النشر. محمي بـ APP_SECRET.
async function handleSetupWebhook(request, env) {
  if ((request.headers.get('x-app-secret') || '') !== env.APP_SECRET) return json({error: 'unauthorized'}, 401);
  const origin = new URL(request.url).origin;
  const res = await fetch(`${TG_API}/bot${env.BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({url: origin + '/tg/webhook', secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message']})
  });
  const data = await res.json().catch(() => ({}));
  return json({ok: res.ok && data.ok === true, telegram: data});
}

// بث رسالة من الأدمن لكل المربوطين أو لدور معيّن. محمي: لازم المتصل يكون أدمن مربوط.
// تليجرام بيحدّ ~30 رسالة/ثانية — بنبعت بالتتابع مع مهلة 34ms بين كل رسالة.
async function handleBroadcast(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const rawLink = await env.TG_LINKS.get(uidKey(uid));
  let link = {};
  try { link = JSON.parse(rawLink || '{}'); } catch {}
  if (link.role !== 'ADMIN' && link.admin !== true) return json({error: 'forbidden'}, 403);
  const body = await request.json().catch(() => null);
  if (!body) return json({error: 'bad request'}, 400);
  const audience = String(body.audience || 'ALL').toUpperCase();
  const roles = audience === 'ALL' ? ROLES : (ROLES.includes(audience) ? [audience] : null);
  if (!roles) return json({error: 'bad request'}, 400);
  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  if (!text) return json({error: 'bad request'}, 400);
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
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (url.pathname === '/health') return json({ok: true});
  if (url.pathname === '/tg/webhook' && request.method === 'POST') return handleWebhook(request, env);
  if (url.pathname === '/tg/setup-webhook' && request.method === 'POST') return handleSetupWebhook(request, env);
  if (url.pathname === '/link/start' && request.method === 'POST') return handleLinkStart(request, env);
  if (url.pathname === '/link/status' && request.method === 'GET') return handleLinkStatus(request, env);
  if (url.pathname === '/link/stop' && request.method === 'POST') return handleLinkStop(request, env);
  if (url.pathname === '/notify' && request.method === 'POST') return handleNotify(request, env);
  if (url.pathname === '/reminders/sync' && request.method === 'POST') return handleReminderSync(request, env);
  if (url.pathname === '/reminders/prefs' && request.method === 'POST') return handleReminderPrefs(request, env);
  if (url.pathname === '/broadcast' && request.method === 'POST') return handleBroadcast(request, env);
  return json({error: 'not found'}, 404);
}

// للاختبار المحلي: نقدر نستبدل التحقق والإرسال ببدائل وهمية.
const internals = {verifyFirebaseIdToken, tgSend, removeChatEverywhere, runCron, cairoToEpoch, fmtTimeAr};
export const _internals = internals;

export default {
  async fetch(request, env, _ctx) {
    try {
      return await route(request, env);
    } catch (e) {
      return json({error: 'internal'}, 500);
    }
  },
  // كرون كل 10 دقايق — شوف runCron فوق
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(internals.runCron(env));
  }
};
