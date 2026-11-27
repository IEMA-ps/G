// Abandoned-cart reminder, client side. Sends a small summary of the cart to the Worker after changes.
// The Worker sends one push if the cart sits idle for 2 hours. Pure helpers, network passed in.
export function summarize(lines, price){
  const ls = (lines || []).filter(l => l && l.product && l.quantity > 0);
  return {
    count: ls.reduce((a, l) => a + l.quantity, 0),
    total: Math.round(ls.reduce((a, l) => a + (Number(price(l.product)) || 0) * l.quantity, 0) * 100) / 100,
    titles: ls.slice(0, 3).map(l => String(l.product.title || '').slice(0, 40))
  };
}
// Waits 3 seconds after the last change, then sends. Returns a function to call on every cart change.
export function makeScheduler({send, delayMs = 3000, setT = setTimeout, clearT = clearTimeout}){
  let h = null;
  return summary => { if(h) clearT(h); h = setT(() => { h = null; send(summary); }, delayMs); };
}
export async function post({summary, token, workerUrl, fetchImpl}){
  const res = await fetchImpl(workerUrl + '/cart/sync', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token}, body: JSON.stringify(summary)});
  return res.ok;
}
