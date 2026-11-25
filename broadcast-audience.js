// Admin broadcast targets. Keys are 'uid:<firebase uid>', which the Worker maps to the user's Telegram chat and push subscriptions.
export const AUDIENCES = [
  {id:'MERCHANTS', label:'كل التجار'},
  {id:'COURIERS', label:'كل المناديب'},
  {id:'PROVIDERS', label:'كل مقدمي الخدمة'},
  {id:'MARKETERS', label:'كل المسوقين'},
  {id:'ONE', label:'واحد معين'}
];
export const CHUNK = 100;
const OUT = new Set(['BLOCKED', 'SUSPENDED', 'DELETED', 'REJECTED']);
const live = u => u && typeof u._id === 'string' && u._id && !OUT.has(String(u.status || '').toUpperCase());
export const fullName = u => ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.email || u._id;
const ROLE_AR = {MERCHANT: 'تاجر', DELIVERY: 'مندوب', MARKETER: 'مسوق', CUSTOMER: 'عميل', ADMIN: 'أدمن'};
// `isProvider(merchantRecord)` says whether a merchant is a service provider.
export function resolve(audience, {users = [], merchants = [], isProvider = () => false, personId = ''} = {}) {
  const byId = new Map(merchants.map(m => [m.id, m]));
  let list;
  if (audience === 'COURIERS') list = users.filter(u => live(u) && u.role === 'DELIVERY');
  else if (audience === 'MARKETERS') list = users.filter(u => live(u) && u.role === 'MARKETER');
  else if (audience === 'MERCHANTS' || audience === 'PROVIDERS') {
    const want = audience === 'PROVIDERS';
    list = users.filter(u => live(u) && u.role === 'MERCHANT' && u.merchantId && byId.has(u.merchantId) && !!isProvider(byId.get(u.merchantId)) === want);
  } else if (audience === 'ONE') list = users.filter(u => live(u) && u._id === personId);
  else list = [];
  return {keys: [...new Set(list.map(u => 'uid:' + u._id))], names: list.map(fullName)};
}
export const chunk = (keys, n = CHUNK) => { const out = []; for (let i = 0; i < keys.length; i += n) out.push(keys.slice(i, i + n)); return out; };
export const personLabel = u => `${fullName(u)} · ${ROLE_AR[u.role] || u.role || ''}${u.phone ? ' · ' + u.phone : ''}`;
export const labelOf = id => (AUDIENCES.find(a => a.id === id) || {}).label || id;
// Merges the Worker's per-chunk replies into one result.
export function sumResults(parts) {
  const t = {ok: parts.length > 0 && parts.every(p => p && p.ok === true), total: 0, sent: 0, pushed: 0, blocked: 0, failed: 0};
  for (const p of parts) if (p) for (const k of ['total', 'sent', 'pushed', 'blocked', 'failed']) t[k] += Number(p[k]) || 0;
  return t;
}
