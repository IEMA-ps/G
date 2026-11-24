import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from './worker.js';

const enc = new TextEncoder();
const b64 = b => Buffer.from(b).toString('base64url');
const {publicKey, privateKey} = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
const jwk = {...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256'};
async function token(over = {}, key = privateKey) {
  const t = Math.floor(Date.now() / 1000);
  const h = b64(enc.encode(JSON.stringify({alg: 'RS256', kid: 'k1'})));
  const p = b64(enc.encode(JSON.stringify({iss: 'https://securetoken.google.com/ala-babk', aud: 'ala-babk', sub: 'uid1', iat: t - 5, exp: t + 3000, ...over})));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(h + '.' + p));
  return `${h}.${p}.${b64(s)}`;
}
const TERMS = '<p>نسخة · الإصدار 2026-11-24.2</p>';
const fetchMock = async url => String(url).includes('terms')
  ? new Response(TERMS) : new Response(JSON.stringify({keys: [jwk]}), {headers: {'cache-control': 'max-age=100'}});
function db() {
  const rows = [];
  return {rows, prepare: () => ({bind: (...a) => ({run: async () => {
    if (rows.some(r => r[0] === a[0] && r[1] === a[1])) return {meta: {changes: 0}};
    rows.push(a); return {meta: {changes: 1}};
  }})})};
}
const env = () => ({DB: db(), ALLOWED_ORIGINS: 'https://3alababk.com', FIREBASE_PROJECT_ID: 'ala-babk'});
const req = async (body, {tok, origin = 'https://3alababk.com', method = 'POST'} = {}) => new Request('https://3alababk.com/api/consent', {
  method, headers: {authorization: 'Bearer ' + (tok ?? await token()), origin, 'cf-connecting-ip': '203.0.113.9', 'cf-ipcountry': 'EG', 'user-agent': 'UA'},
  body: method === 'POST' ? JSON.stringify(body) : undefined
});
const deps = {fetch: fetchMock, now: () => new Date('2026-11-24T10:00:00Z')};
const good = {version: '2026-11-24.2', method: 'email'};

test('records uid, version, server hash, server time, ip', async () => {
  const e = env();
  const res = await handle(await req(good), e, deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {ok: true, recorded: true});
  const [uid, ver, sha, method, at, ip, ...extra] = e.DB.rows[0];
  const expected = Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode(TERMS))).toString('hex');
  assert.deepEqual([uid, ver, sha, method, at, ip], ['uid1', '2026-11-24.2', expected, 'email', '2026-11-24T10:00:00.000Z', '203.0.113.9']);
  assert.deepEqual(extra, []);
});
test('retry is idempotent', async () => {
  const e = env();
  await handle(await req(good), e, deps);
  const res = await handle(await req(good), e, deps);
  assert.deepEqual(await res.json(), {ok: true, recorded: false});
  assert.equal(e.DB.rows.length, 1);
});
test('rejects bad token, wrong key, expired, wrong project', async () => {
  const other = (await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign'])).privateKey;
  for (const tok of ['x.y.z', '', await token({}, other), await token({exp: 1}), await token({aud: 'other'})]) {
    const e = env();
    const res = await handle(await req(good, {tok}), e, deps);
    assert.equal(res.status, 401); assert.equal(e.DB.rows.length, 0);
  }
});
test('rejects foreign origin and non-POST', async () => {
  assert.equal((await handle(await req(good, {origin: 'https://evil.example'}), env(), deps)).status, 403);
  assert.equal((await handle(await req(null, {method: 'GET'}), env(), deps)).status, 405);
});
test('rejects bad body and version mismatch with server terms', async () => {
  for (const b of [{}, {version: 'x', method: 'email'}, {version: '2026-11-24.2', method: 'sms'}]) {
    assert.equal((await handle(await req(b), env(), deps)).status, 400);
  }
  const e = env();
  const res = await handle(await req({version: '2026-01-01', method: 'email'}), e, deps);
  assert.equal(res.status, 409); assert.equal(e.DB.rows.length, 0);
});
test('old terms version (without .2) is rejected as mismatch', async () => {
  const e = env();
  const res = await handle(await req({version: '2026-11-24', method: 'email'}), e, deps);
  assert.equal(res.status, 409); assert.equal(e.DB.rows.length, 0);
});
test('terms page unavailable -> 502, nothing stored', async () => {
  const e = env();
  const res = await handle(await req(good), e, {...deps, fetch: async url => String(url).includes('terms') ? new Response('', {status: 500}) : fetchMock(url)});
  assert.equal(res.status, 502); assert.equal(e.DB.rows.length, 0);
});
