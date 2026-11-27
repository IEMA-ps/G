import * as StorePoints from './store-points.js';
// Order transactions. The Firestore functions are passed in (api) so the same code runs in the page and in the emulator tests.

// Mark a sub order DELIVERED and give loyalty points (and the first-order referral bonus, to the inviter only) exactly once.
// Everything is read and written in one transaction, so two taps at the same time cannot pay twice.
// Returns {awarded:boolean, pointsEarned, bonus, referrerId}.
// storePointsOn: per-store points replace the global ones. The merchant's own settings (merchants/{id}.storePoints) are read inside the transaction.
export async function deliverSubOrder(api, db, s, extra, {earnRate=0, loyaltyEnabled=true, bonusPoints=0, storePointsOn=false, nowMs=Date.now()}={}){
  const {doc, runTransaction, increment} = api;
  return runTransaction(db, async (tx)=>{
    const subRef = doc(db,'subOrders', s.id);
    const subSnap = await tx.get(subRef);
    if(!subSnap.exists()) throw new Error('الطلب غير موجود');
    const sub = subSnap.data();
    const first = sub.status!=='DELIVERED' && !sub.pointsAwarded;
    const merchSnap = first && storePointsOn && sub.merchantId ? await tx.get(doc(db,'merchants', sub.merchantId)) : null;
    const spCfg = StorePoints.config(merchSnap && merchSnap.exists() ? merchSnap.data().storePoints : null);
    const storeEarned = merchSnap ? StorePoints.earned(sub.subtotal, spCfg) : 0;
    const pointsEarned = storePointsOn ? 0 : (first && loyaltyEnabled ? Math.floor((sub.subtotal||0)*earnRate) : 0);
    const refRef = first ? doc(db,'referrals', sub.customerId) : null;
    const refSnap = refRef ? await tx.get(refRef) : null;
    const reward = !!(refSnap && refSnap.exists() && refSnap.data().status==='PENDING' && bonusPoints>0);
    // all reads done, now writes
    tx.update(subRef, first ? {...extra, pointsAwarded:true} : extra);
    if(pointsEarned>0) tx.update(doc(db,'users', sub.customerId), { loyaltyPoints: increment(pointsEarned) });
    if(storeEarned>0) tx.set(doc(db,'users', sub.customerId,'storePoints', sub.merchantId), { points: increment(storeEarned), storeName: String((merchSnap.data().businessName)||'').slice(0,100), updatedAt: nowMs }, {merge:true});
    let referrerId = null;
    if(refSnap && refSnap.exists() && refSnap.data().status==='PENDING'){
      referrerId = refSnap.data().referrerId;
      if(reward){
        tx.update(doc(db,'users', referrerId), { loyaltyPoints: increment(bonusPoints) });
      }
      tx.update(refRef, { status:'REWARDED', rewardedAt: nowMs });
    }
    return {awarded:first, pointsEarned: pointsEarned || storeEarned, storeId: storeEarned>0 ? sub.merchantId : null, bonus: reward?bonusPoints:0, referrerId: reward?referrerId:null};
  });
}
