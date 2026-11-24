// Order money rules. Pure helpers: no network, authentication, or database writes.
export const roundMoney = n => Math.round((Number(n)||0)*100)/100;
export const TERMINAL_BAD = ['REJECTED','CANCELLED'];

// Coupon discount for the CURRENT cart subtotal. Returns 0 when the coupon cannot apply.
export function couponCheck(c, subtotal, now=Date.now()){
  if(!c) return {ok:false, reason:'كود الكوبون غير صحيح'};
  if(!c.isActive) return {ok:false, reason:'هذا الكوبون متوقف حاليًا'};
  if(c.expiresAt && c.expiresAt < now) return {ok:false, reason:'انتهت صلاحية هذا الكوبون'};
  if(c.maxUses && (c.usedCount||0) >= c.maxUses) return {ok:false, reason:'تم استنفاد عدد مرات استخدام هذا الكوبون'};
  if(c.minOrderAmount && subtotal < c.minOrderAmount) return {ok:false, reason:`هذا الكوبون يتطلب حد أدنى ${c.minOrderAmount} للسلة`, minOrderAmount:c.minOrderAmount};
  const raw = c.type==='PERCENT' ? roundMoney(subtotal*c.value/100) : Math.min(Number(c.value)||0, subtotal);
  return {ok:true, discount: Math.max(0, Math.min(raw, subtotal))};
}

// Points that can be used on what is left after coupon. Never negative, never above balance.
export function pointsFor(requested, available, rate, remaining){
  if(!rate || rate<=0) return 0;
  const cap = Math.floor(Math.max(0, remaining)/rate);
  return Math.max(0, Math.min(Math.floor(requested||0), Math.floor(available||0), cap));
}

// Recompute every discount from the current cart. coupon = coupon document (+code), pointsWanted = number.
// Used on every cart change and again inside the order transaction.
export function priceOrder({subtotal, fee, coupon, pointsWanted, availablePoints, rate, now=Date.now()}){
  let couponDiscount = 0, couponOk = false, couponReason = null;
  if(coupon){
    const r = couponCheck(coupon, subtotal, now);
    couponOk = r.ok; couponDiscount = r.ok ? r.discount : 0; couponReason = r.ok ? null : r.reason;
  }
  const remaining = Math.max(0, subtotal + fee - couponDiscount);
  const points = pointsFor(pointsWanted, availablePoints, rate, remaining);
  const pointsDiscount = roundMoney(points*(rate||0));
  const discount = roundMoney(couponDiscount + pointsDiscount);
  const total = Math.max(0, roundMoney(subtotal + fee - discount));
  return {couponOk, couponReason, couponDiscount, points, pointsDiscount, discount, total};
}

// What to give back when a sub order is rejected or cancelled.
// sub: the sub order being cancelled (state BEFORE this change). siblings: all sub orders of the parent
// order, INCLUDING sub, with their current statuses. order: the parent order.
// Returns {stock:[{productId,qty}], restoreDiscount:bool, coupon, points}.
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
