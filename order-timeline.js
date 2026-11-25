// Customer order tracking helpers. Pure, no network.
// Times come from fields the app already writes (createdAt, merchantContactedAt, deliveredAt) plus statusTimes.<STATUS> (ms)
// that merchants and couriers add when the tracking switch is on. Missing time = null (never invented).
export const toMs = v => {
  if(v == null) return null;
  if(typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if(typeof v.toMillis === 'function'){ const n = v.toMillis(); return Number.isFinite(n) && n > 0 ? n : null; }
  if(typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
};
export function stepTime(sub, key){
  if(!sub) return null;
  const st = sub.statusTimes && typeof sub.statusTimes === 'object' ? toMs(sub.statusTimes[key]) : null;
  if(key === 'PENDING_ADMIN') return toMs(sub.createdAt);
  if(key === 'SENT_TO_MERCHANT') return toMs(sub.merchantContactedAt) || st;
  if(key === 'DELIVERED') return toMs(sub.deliveredAt) || st;
  return st;
}
// Dial-safe phone for tel: links. Keeps digits and a leading +. Returns '' when it does not look like a phone.
export function dialPhone(p){
  const s = String(p == null ? '' : p).trim();
  const d = s.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /^\+?\d{8,15}$/.test(d) ? d : '';
}
// Courier block data for the customer, or null when no courier is assigned.
export function courierInfo(sub){
  if(!sub || !sub.deliveryAgentName) return null;
  return {name: String(sub.deliveryAgentName), phone: dialPhone(sub.deliveryAgentPhone)};
}
