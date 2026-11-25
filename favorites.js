// Favorites helpers. Pure, no network. A favorite is just an id string (store id or product id).
const clean = a => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.length > 0 && x.length <= 80);

// Union of two id lists, keeps order (first list first), no duplicates, capped.
export function mergeIds(a, b, cap = 200){
  return [...new Set([...clean(a), ...clean(b)])].slice(0, cap);
}
// Same ids, order ignored.
export function sameIds(a, b){
  const x = new Set(clean(a)), y = new Set(clean(b));
  return x.size === y.size && [...x].every(i => y.has(i));
}
// Returns {list, added}. Adding puts the id first so the newest favorite shows first.
export function toggleId(list, id){
  const cur = clean(list);
  return cur.includes(id) ? {list: cur.filter(i => i !== id), added: false} : {list: [id, ...cur].slice(0, 200), added: true};
}
