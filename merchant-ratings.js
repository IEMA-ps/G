// Merchant ratings view helpers. Pure, no network.
// A rating doc: {id, merchantId, merchantRating 1..5, comment, productRatings[], createdAt, merchantReply?, merchantReplyAt?}
export const MAX_REPLY = 300;

export function validRatings(list){
  return (Array.isArray(list) ? list : []).filter(r => r && Number.isFinite(Number(r.merchantRating)) && r.merchantRating >= 1 && r.merchantRating <= 5);
}
// Newest first.
export function sortRatings(list){
  return [...validRatings(list)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export function summarize(list){
  const rs = validRatings(list);
  const dist = {1:0, 2:0, 3:0, 4:0, 5:0};
  let sum = 0;
  for(const r of rs){ const v = Math.round(r.merchantRating); dist[v]++; sum += r.merchantRating; }
  return {count: rs.length, avg: rs.length ? Math.round(sum / rs.length * 10) / 10 : 0, dist, waitingReply: rs.filter(r => !r.merchantReply).length};
}
// Returns the cleaned reply text, or null when empty / too long.
export function cleanReply(text){
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return t && t.length <= MAX_REPLY ? t : null;
}
