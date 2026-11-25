// Reject/cancel of a sub order with give-back, in one transaction. The Firestore functions are passed in (api)
// so the same code runs in the page and in the emulator tests.
export const TERMINAL_BAD = ['REJECTED','CANCELLED'];

// What to give back when a sub order is rejected or cancelled.
// sub: the sub order being cancelled (state BEFORE this change). siblings: all sub orders of the parent order,
// INCLUDING sub. order: the parent order. Returns {stock:[{productId,qty}], restoreDiscount, coupon, points}.
export function planRestore(sub, siblings, order){
  const out = {stock:[], restoreDiscount:false, coupon:null, points:0};
  if(!sub || sub.restocked || TERMINAL_BAD.includes(sub.status) || sub.status==='DELIVERED') return out;
  out.stock = (sub.items||[]).filter(i=>i.productId && i.quantity>0).map(i=>({productId:i.productId, qty:i.quantity}));
  const allGone = (siblings||[]).every(s => s.id===sub.id || TERMINAL_BAD.includes(s.status));
  const already = (siblings||[]).some(s => s.discountRestored);
  if(allGone && !already && order){
    const coupon = order.couponCode || null, points = Number(order.pointsRedeemed)||0;
    if(coupon || points>0){ out.restoreDiscount = true; out.coupon = coupon; out.points = points; }
  }
  return out;
}

// Status change + stock back (+ coupon use and points back once the last sub order of the order is gone), once.
// opts.onlyFrom: list of statuses the sub order must still be in (checked inside the transaction).
export async function cancelSubOrderWithRestore(api, db, s, extra, opts={}){
  const {doc, runTransaction, increment} = api;
  await runTransaction(db, async (tx)=>{
    const subRef = doc(db,'subOrders', s.id);
    const orderRef = doc(db,'orders', s.parentOrderId);
    const [subSnap, orderSnap] = await Promise.all([tx.get(subRef), tx.get(orderRef)]);
    if(!subSnap.exists()) throw new Error('الطلب غير موجود');
    const sub = {id:s.id, ...subSnap.data()};
    if(opts.onlyFrom && !opts.onlyFrom.includes(sub.status)) throw new Error('الطلب اتحرك لمرحلة جديدة ومينفعش يتلغى دلوقتي');
    const order = orderSnap.exists() ? orderSnap.data() : null;
    const sibIds = (order && order.subOrderIds) || [s.id];
    const sibSnaps = await Promise.all(sibIds.map(id=> id===s.id ? subSnap : tx.get(doc(db,'subOrders', id))));
    const siblings = sibSnaps.filter(d=>d.exists()).map(d=>({id:d.id, ...d.data()}));
    const plan = planRestore(sub, siblings, order);
    const prodSnaps = await Promise.all(plan.stock.map(r=>tx.get(doc(db,'products', r.productId))));
    const couponRef = plan.restoreDiscount && plan.coupon ? doc(db,'coupons', plan.coupon) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;
    // all reads done, now writes
    const patch = {...extra};
    if(plan.stock.length) patch.restocked = true;
    if(plan.restoreDiscount) patch.discountRestored = true;
    tx.update(subRef, patch);
    plan.stock.forEach((r,i)=>{ if(prodSnaps[i].exists()) tx.update(doc(db,'products', r.productId), { stock: increment(r.qty) }); });
    if(plan.restoreDiscount){
      if(couponSnap && couponSnap.exists() && (couponSnap.data().usedCount||0)>0) tx.update(couponRef, { usedCount: increment(-1) });
      if(plan.points>0 && order) tx.update(doc(db,'users', order.customerId), { loyaltyPoints: increment(plan.points) });
    }
  });
}
