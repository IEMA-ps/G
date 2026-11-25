// Monthly marketer contest. Pure, no network.
// A store counts for a marketer in the month of its FIRST approved paid subscription (approved by the admin, price > 0).
// Free and renewal subscriptions do not count again. Months are Cairo calendar months. Prizes are paid by hand.
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
// merchantId -> {marketerId, at} for the earliest approved paid subscription that has a marketer.
export function firstPaid(subs){
  const first = {};
  for(const s of subs || []){
    if(!s || s.status !== 'APPROVED' || !(Number(s.price) > 0) || !s.merchantId) continue;
    const at = toMs(s.approvedAt);
    if(!at) continue;
    if(!first[s.merchantId] || at < first[s.merchantId].at) first[s.merchantId] = {marketerId: s.marketerId || '', at};
  }
  return first;
}
// [{marketerId, count, lastAt}] for a month, best first. Ties go to whoever reached the count first.
export function standings(subs, month){
  const by = {};
  for(const [mid, f] of Object.entries(firstPaid(subs))){
    if(!f.marketerId || monthKey(f.at) !== month) continue;
    const r = by[f.marketerId] || (by[f.marketerId] = {marketerId: f.marketerId, count: 0, lastAt: 0});
    r.count++; r.lastAt = Math.max(r.lastAt, f.at);
  }
  return Object.values(by).sort((a, b) => b.count - a.count || a.lastAt - b.lastAt);
}
export function ownCount(subs, marketerId, month){
  const r = standings(subs, month).find(x => x.marketerId === marketerId);
  return r ? r.count : 0;
}
// What the admin publishes: first names only (no phones, no ids), top N.
export function publishPayload({subs, users, month, prize, top = 10, now = Date.now()}){
  const name = id => { const u = (users || []).find(x => x && (x._id === id || x.id === id)); return String((u && u.firstName) || 'مسوّق').slice(0, 30); };
  return {
    month, prize: String(prize || '').trim().slice(0, 200), publishedAt: now,
    standings: standings(subs, month).slice(0, top).map((r, i) => ({rank: i + 1, name: name(r.marketerId), count: r.count}))
  };
}
// Marketer-side view of what was published: only for the current month.
export function visibleContest(settings, month){
  const c = settings && settings.marketerContest;
  if(!c || c.month !== month || !Array.isArray(c.standings)) return null;
  return {prize: String(c.prize || ''), standings: c.standings, publishedAt: c.publishedAt || 0};
}
