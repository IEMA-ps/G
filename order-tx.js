// Order transactions. The Firestore functions are passed in (api) so the same code runs in the page and in the emulator tests.
import * as OrderMoney from './order-money.js';

// Runs INSIDE the checkout transaction, before any write: reads the coupon and the points balance fresh
// and prices the order from the current cart. Throws if the coupon or points no longer fit.
export async function priceInTx(api, db, tx, {coupon, wantedPoints, uid, subtotal, fee, rate, now}){
  const {doc} = api;
  const couponSnap = coupon ? await tx.get(doc(db,'coupons', coupon.code)) : null;
  const userSnap = wantedPoints>0 ? await tx.get(doc(db,'users', uid)) : null;
  const priced = OrderMoney.priceOrder({subtotal, fee, coupon: couponSnap&&couponSnap.exists()?couponSnap.data():null,
    pointsWanted:wantedPoints, availablePoints: userSnap&&userSnap.exists()?(userSnap.data().loyaltyPoints||0):0, rate, now});
  if(coupon && !priced.couponOk) throw new Error('الكوبون لم يعد صالحًا: '+priced.couponReason+'، أزله وحاول تاني');
  if(wantedPoints>0 && priced.points<wantedPoints) throw new Error('رصيد النقاط أو إجمالي الطلب اتغيّر، أعد تطبيق النقاط وحاول تاني');
  return priced;
}

// Reject/cancel a sub order: status change + stock back (+ coupon use and points back after the last sub order), once.
export async function cancelSubOrderWithRestore(api, db, s, extra){
  const {doc, runTransaction, increment} = api;
  await runTransaction(db, async (tx)=>{
    const subRef = doc(db,'subOrders', s.id);
    const orderRef = doc(db,'orders', s.parentOrderId);
    const [subSnap, orderSnap] = await Promise.all([tx.get(subRef), tx.get(orderRef)]);
    if(!subSnap.exists()) throw new Error('الطلب غير موجود');
    const sub = {id:s.id, ...subSnap.data()};
    const order = orderSnap.exists() ? orderSnap.data() : null;
    const sibIds = (order && order.subOrderIds) || [s.id];
    const sibSnaps = await Promise.all(sibIds.map(id=> id===s.id ? subSnap : tx.get(doc(db,'subOrders', id))));
    const siblings = sibSnaps.filter(d=>d.exists()).map(d=>({id:d.id, ...d.data()}));
    const plan = OrderMoney.planRestore(sub, siblings, order);
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
