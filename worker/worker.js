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
const KEY_PATTERN = /^(m:|a:)[A-Za-z0-9_\-]{1,40}$/;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-app-secret'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', ...cors}});
}

// ---------- تليجرام ----------
async function tgSend(env, chatId, text, fetchImpl = fetch) {
  const res = await fetchImpl(`${TG_API}/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true})
  });
  const data = await res.json().catch(() => ({}));
  return res.ok && data.ok === true;
}

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
const ADMIN_LIST_KEY = 'role:ADMIN';

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function adminChatIds(env) {
  const raw = await env.TG_LINKS.get(ADMIN_LIST_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// ---------- المسارات ----------
async function handleLinkStart(request, env) {
  const uid = await authedUid(request, env);
  if (!uid) return json({error: 'unauthorized'}, 401);
  const body = await request.json().catch(() => ({}));
  const link = {
    uid,
    merchantId: typeof body.merchantId === 'string' && /^[A-Za-z0-9_\-]{1,40}$/.test(body.merchantId) ? body.merchantId : null,
    deliveryAgentId: typeof body.deliveryAgentId === 'string' && /^[A-Za-z0-9_\-]{1,40}$/.test(body.deliveryAgentId) ? body.deliveryAgentId : null,
    admin: body.admin === true
  };
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
    const ops = [env.TG_LINKS.delete(uidKey(uid))];
    if (link.merchantId) ops.push(env.TG_LINKS.delete('m:' + link.merchantId));
    if (link.deliveryAgentId) ops.push(env.TG_LINKS.delete('a:' + link.deliveryAgentId));
    if (link.admin) {
      const admins = (await adminChatIds(env)).filter(id => id !== link.chatId);
      ops.push(env.TG_LINKS.put(ADMIN_LIST_KEY, JSON.stringify(admins)));
    }
    await Promise.all(ops);
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
  for (const chatId of chatIds) { if (await internals.tgSend(env, chatId, text)) sent++; }
  return json({sent});
}

async function handleWebhook(request, env) {
  if ((request.headers.get('x-telegram-bot-api-secret-token') || '') !== env.WEBHOOK_SECRET) return json({ok: false}, 401);
  const update = await request.json().catch(() => null);
  const msg = update && update.message;
  if (!msg || !msg.chat || !msg.text) return json({ok: true});
  const chatId = String(msg.chat.id);
  const parts = msg.text.trim().split(/\s+/);
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
  const record = {chatId, merchantId: link.merchantId, deliveryAgentId: link.deliveryAgentId, admin: link.admin === true};
  const ops = [
    env.TG_LINKS.put(uidKey(link.uid), JSON.stringify(record)),
    env.TG_LINKS.delete(codeKey(code))
  ];
  if (link.merchantId) ops.push(env.TG_LINKS.put('m:' + link.merchantId, chatId));
  if (link.deliveryAgentId) ops.push(env.TG_LINKS.put('a:' + link.deliveryAgentId, chatId));
  if (record.admin) {
    const admins = await adminChatIds(env);
    if (!admins.includes(chatId)) { admins.push(chatId); ops.push(env.TG_LINKS.put(ADMIN_LIST_KEY, JSON.stringify(admins))); }
  }
  await Promise.all(ops);
  await internals.tgSend(env, chatId, 'تم الربط ✅\nحسابك في «على بابك» اتربط بتليجرام، وهتوصلك إشعارات الطلبات الجديدة هنا فورًا.');
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
  return json({error: 'not found'}, 404);
}

// للاختبار المحلي: نقدر نستبدل التحقق والإرسال ببدائل وهمية.
const internals = {verifyFirebaseIdToken, tgSend};
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
