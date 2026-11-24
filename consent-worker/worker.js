// Cloudflare Worker: سجل موافقة الشروط (إثبات) لـ«على بابك».
// بيسجل في D1 صف واحد لا يتعدل ولا يتمسح: المستخدم، إصدار الشروط، بصمة SHA-256 لنص الشروط
// اللي كان معروض فعلًا، وقت السيرفر، وعنوان الـ IP. (مفيش بيانات تانية، عشان تطابق نص الشروط.) مفيش أسرار: التوثيق بتوكن Firebase ID العام (RS256).
//
// المتغيرات (wrangler.toml [vars]): FIREBASE_PROJECT_ID, TERMS_URL, ALLOWED_ORIGINS
// D1 binding: DB (انظر schema.sql)

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const METHODS = new Set(['email', 'google']);
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}(\.\d+)?$/;
const TERMS_VERSION_IN_PAGE = /الإصدار\s*(\d{4}-\d{2}-\d{2}(?:\.\d+)?)/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let jwksCache = {keys: null, expiresAt: 0};
async function getJwks(fetchImpl) {
  if (jwksCache.keys && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error('jwks fetch failed');
  const data = await res.json();
  const m = (res.headers.get('cache-control') || '').match(/max-age=(\d+)/);
  jwksCache = {keys: data.keys || [], expiresAt: Date.now() + (m ? Math.min(Number(m[1]), 21600) : 3600) * 1000};
  return jwksCache.keys;
}

export async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
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

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// بصمة الصفحة المنشورة فعلًا + إصدارها المكتوب جواها (السيرفر هو المرجع، مش المتصفح).
async function currentTerms(env, fetchImpl) {
  const res = await fetchImpl(env.TERMS_URL || 'https://3alababk.com/terms.html', {cf: {cacheTtl: 60}});
  if (!res.ok) throw new Error('terms fetch failed');
  const bytes = new Uint8Array(await res.arrayBuffer());
  const match = new TextDecoder().decode(bytes).match(TERMS_VERSION_IN_PAGE);
  if (!match) throw new Error('terms version not found');
  return {version: match[1], sha256: await sha256Hex(bytes)};
}

export async function handle(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now || (() => new Date());
  if (request.method !== 'POST') return json({error: 'method'}, 405);
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  if (origin && !allowed.includes(origin)) return json({error: 'origin'}, 403);

  const auth = request.headers.get('authorization') || '';
  let uid;
  try { uid = await verifyFirebaseIdToken(auth.startsWith('Bearer ') ? auth.slice(7) : '', env.FIREBASE_PROJECT_ID || 'ala-babk', fetchImpl); }
  catch { return json({error: 'auth'}, 401); }

  let body;
  try { body = await request.json(); } catch { return json({error: 'body'}, 400); }
  const version = body && body.version, method = body && body.method;
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version) || !METHODS.has(method)) return json({error: 'body'}, 400);

  let terms;
  try { terms = await currentTerms(env, fetchImpl); } catch { return json({error: 'terms-unavailable'}, 502); }
  if (terms.version !== version) return json({error: 'version-mismatch', current: terms.version}, 409);

  const h = request.headers;
  const ip = h.get('cf-connecting-ip') || null;
  // INSERT OR IGNORE + UNIQUE(uid, terms_version): إعادة المحاولة آمنة ومفيش تكرار.
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO terms_consents (uid, terms_version, terms_sha256, method, accepted_at, ip) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(uid, terms.version, terms.sha256, method, now().toISOString(), ip).run();
  return json({ok: true, recorded: (result?.meta?.changes ?? 0) > 0});
}

export default {fetch: (request, env) => handle(request, env)};
