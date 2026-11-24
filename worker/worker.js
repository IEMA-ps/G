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
  if (url.pathname === '/broadcast' && request.method === 'POST') return handleBroadcast(request, env);
  return json({error: 'not found'}, 404);
}

// للاختبار المحلي: نقدر نستبدل التحقق والإرسال ببدائل وهمية.
const internals = {verifyFirebaseIdToken, tgSend, removeChatEverywhere};
export const _internals = internals;

export default {
  async fetch(request, env, _ctx) {
    try {
      return await route(request, env);
    } catch (e) {
      return json({error: 'internal'}, 500);
    }
  }
};
