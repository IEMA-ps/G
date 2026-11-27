// Reject/cancel of a sub order with give-back, in one transaction. The Firestore functions are passed in (api)
// so the same code runs in the page and in the emulator tests.
import * as OrderMoney from './order-money.js';
export const TERMINAL_BAD = ['REJECTED','CANCELLED'];

// What to give back when a sub order is rejected or cancelled.
// sub: the sub order being cancelled (state BEFORE this change). siblings: all sub orders of the parent order,
// INCLUDING sub. order: the parent order. Returns {stock:[{productId,qty}], restoreDiscount, coupon, points}.
export function planRestore(sub, siblings, order){
  const out = {stock:[], restoreDiscount:false, coupon:null, points:0, pointsField:'loyaltyPoints', storePoints:0};
  if(!sub || sub.restocked || TERMINAL_BAD.includes(sub.status) || sub.status==='DELIVERED') return out;
  // Store points are paid by that store only, so they go back with this sub order alone.
  if(Number(sub.storePointsRedeemed)>0 && !sub.storePointsRestored) out.storePoints = Math.floor(Number(sub.storePointsRedeemed));
  out.stock = (sub.items||[]).filter(i=>i.productId && i.quantity>0).map(i=>({productId:i.productId, qty:i.quantity}));
  const allGone = (siblings||[]).every(s => s.id===sub.id || TERMINAL_BAD.includes(s.status));
  const already = (siblings||[]).some(s => s.discountRestored);
  if(allGone && !already && order){
    const coupon = order.couponCode || null, points = Number(order.pointsRedeemed)||0;
    if(coupon || points>0){ out.restoreDiscount = true; out.coupon = coupon; out.points = points; out.pointsField = order.pointsField==='inviteCredit' ? 'inviteCredit' : 'loyaltyPoints'; }
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
    const spRef = plan.storePoints>0 && sub.merchantId && sub.customerId ? doc(db,'users', sub.customerId,'storePoints', sub.merchantId) : null;
    const spSnap = spRef ? await tx.get(spRef) : null;
    // all reads done, now writes
    const patch = {...extra};
    if(spRef) patch.storePointsRestored = true;
    if(plan.stock.length) patch.restocked = true;
    if(plan.restoreDiscount) patch.discountRestored = true;
    tx.update(subRef, patch);
    if(spRef) tx.set(spRef, { points: ((spSnap.exists()?spSnap.data().points:0)||0) + plan.storePoints, restoredFor: s.id, updatedAt: Date.now() }, {merge:true});
    plan.stock.forEach((r,i)=>{ if(prodSnaps[i].exists()) tx.update(doc(db,'products', r.productId), { stock: increment(r.qty) }); });
    if(plan.restoreDiscount){
      if(couponSnap && couponSnap.exists() && (couponSnap.data().usedCount||0)>0) tx.update(couponRef, { usedCount: increment(-1), lastRestoreSub: s.id });
      if(plan.points>0 && order) tx.update(doc(db,'users', order.customerId), { [plan.pointsField]: increment(plan.points) });
    }
  });
}

// Runs INSIDE the checkout transaction, before any write: reads the coupon and the points balance fresh
// and prices the order from the current cart. Throws if the coupon or points no longer fit.
export async function priceInTx(api, db, tx, {coupon, wantedPoints, uid, subtotal, fee, rate, now, field='loyaltyPoints'}){
  const {doc} = api;
  const couponSnap = coupon ? await tx.get(doc(db,'coupons', coupon.code)) : null;
  const userSnap = wantedPoints>0 ? await tx.get(doc(db,'users', uid)) : null;
  const priced = OrderMoney.priceOrder({subtotal, fee, coupon: couponSnap&&couponSnap.exists()?couponSnap.data():null,
    pointsWanted:wantedPoints, availablePoints: userSnap&&userSnap.exists()?(userSnap.data()[field]||0):0, rate, now});
  if(coupon && !priced.couponOk) throw new Error('الكوبون لم يعد صالحًا: '+priced.couponReason+'، أزله وحاول تاني');
  if(wantedPoints>0 && priced.points<wantedPoints) throw new Error('رصيد النقاط أو إجمالي الطلب اتغيّر، أعد تطبيق النقاط وحاول تاني');
  return priced;
}
