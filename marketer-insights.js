// Marketer dashboard insights. Pure, no network. Works only on data the marketer screen already loads
// (his merchants and their delivered sub orders). Months are Cairo calendar months.
const DAY = 86400000;
export const toMs = v => {
  if(v == null) return 0;
  if(typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if(typeof v.toMillis === 'function') return v.toMillis() || 0;
  if(typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};
export function monthKey(ms){
  if(!ms) return '';
  const p = new Intl.DateTimeFormat('en-US', {timeZone:'Africa/Cairo', year:'numeric', month:'2-digit'}).formatToParts(new Date(ms));
  const g = t => (p.find(x => x.type === t) || {}).value;
  return g('year') + '-' + g('month');
}
export function prevMonthKey(key){
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
}
const money = n => Math.round((Number(n) || 0) * 100) / 100;

// This month vs last month: delivered orders and sales of his stores, and new stores he registered.
export function monthSummary(merchants, subOrders, now = Date.now()){
  const cur = monthKey(now), prev = prevMonthKey(cur);
  const mine = new Set((merchants || []).map(m => m.id));
  const out = {cur: {orders: 0, gross: 0, newStores: 0}, prev: {orders: 0, gross: 0, newStores: 0}};
  for(const s of subOrders || []){
    if(!s || s.status !== 'DELIVERED' || !mine.has(s.merchantId)) continue;
    const k = monthKey(toMs(s.deliveredAt) || toMs(s.createdAt));
    const b = k === cur ? out.cur : k === prev ? out.prev : null;
    if(b){ b.orders++; b.gross += Number(s.subtotal) || 0; }
  }
  for(const m of merchants || []){
    const k = monthKey(toMs(m.marketerSince) || toMs(m.registeredAt));
    if(k === cur) out.cur.newStores++; else if(k === prev) out.prev.newStores++;
  }
  out.cur.gross = money(out.cur.gross); out.prev.gross = money(out.prev.gross);
  return out;
}
// Stores that need a follow-up, most urgent first: EXPIRED, EXPIRING (within `soonDays`), NO_SUB (active, never subscribed), PENDING.
export function needsAttention(merchants, now = Date.now(), soonDays = 7){
  const rank = {EXPIRED: 0, EXPIRING: 1, NO_SUB: 2, PENDING: 3};
  const out = [];
  for(const m of merchants || []){
    if(!m) continue;
    if(m.status === 'PENDING'){ out.push({m, kind: 'PENDING', days: Math.max(0, Math.floor((now - (toMs(m.registeredAt) || now)) / DAY))}); continue; }
    if(m.status !== 'ACTIVE') continue;
    const end = toMs(m.subEndsAt);
    if(!end) out.push({m, kind: 'NO_SUB', days: 0});
    else if(end < now) out.push({m, kind: 'EXPIRED', days: Math.floor((now - end) / DAY)});
    else if(end - now <= soonDays * DAY) out.push({m, kind: 'EXPIRING', days: Math.ceil((end - now) / DAY)});
  }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.days - a.days);
}
export function filterByStatus(merchants, key){
  const list = Array.isArray(merchants) ? merchants : [];
  return !key || key === 'ALL' ? list : list.filter(m => m && m.status === key);
}
// Percent change text helper: null when there is nothing to compare with.
export function change(curV, prevV){
  if(!prevV) return null;
  return Math.round((curV - prevV) / prevV * 100);
}
