'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');
const {onDocumentWritten,onDocumentCreated}=require('firebase-functions/v2/firestore');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {setGlobalOptions}=require('firebase-functions/v2');
const {randomBytes,createHash}=require('node:crypto');
initializeApp();
const db=getFirestore();
setGlobalOptions({region:'europe-west1',maxInstances:2,memory:'256MiB',timeoutSeconds:60});
const secured={enforceAppCheck:true};
const cleanId=x=>typeof x==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(x)?x:null;
const validCode=x=>typeof x==='string' && /^[A-Z0-9-]{4,64}$/.test(x)?x:null;
async function marketer(request){
  if(!request.auth) throw new HttpsError('unauthenticated','سجّل دخولك أولًا');
  const snap=await db.doc(`users/${request.auth.uid}`).get();
  if(!snap.exists || snap.data().role!=='MARKETER') throw new HttpsError('permission-denied','الأداة للمسوّقين فقط');
  return {uid:request.auth.uid,profile:snap.data()};
}
const publicAlias=profile=>'مسوّق '+String(profile.referralCode||'').slice(-6);

// Idempotent and role-preserving. No client needs permission to promote itself or change its code.
exports.ensureMarketerDefaults=onDocumentWritten('users/{uid}',async event=>{
  const uid=event.params.uid;
  await db.runTransaction(async tx=>{
    const ref=db.doc(`users/${uid}`),snap=await tx.get(ref);
    if(!snap.exists || snap.data().role!=='MARKETER'){
      tx.delete(db.doc(`marketerPublicStats/${uid}`));
      return;
    }
    const user=snap.data(),patch={};
    if(user.referralCode && !validCode(user.referralCode)) throw new Error('Invalid legacy marketer code requires administrator review');
    const code=validCode(user.referralCode) || ('MK-'+randomBytes(8).toString('hex').toUpperCase());
    const registry=db.doc(`marketerCodes/${code}`),existing=await tx.get(registry);
    if(existing.exists && existing.data().uid!==uid) throw new Error('Duplicate marketer code requires administrator review');
    if(!user.referralCode) patch.referralCode=code;
    if(user.loyaltyPoints===undefined) patch.loyaltyPoints=0;
    if(!existing.exists) tx.create(registry,{uid,createdAt:FieldValue.serverTimestamp()});
    if(user.leaderboardOptIn!==true) tx.delete(db.doc(`marketerPublicStats/${uid}`));
    if(Object.keys(patch).length) tx.update(ref,patch);
  });
});

// Count browser sessions approximately. No IP, email, phone or contact list is collected.
// App Check reduces automated abuse but cannot prove that a visit is a unique person.
exports.trackMarketerVisit=onCall(secured,async request=>{
  const code=validCode(request.data?.code),visitId=request.data?.visitId;
  if(!code || typeof visitId!=='string' || !/^[0-9a-f-]{36}$/i.test(visitId)) throw new HttpsError('invalid-argument','رابط غير صحيح');
  const registry=await db.doc(`marketerCodes/${code}`).get();
  if(!registry.exists) return {recorded:false};
  const uid=registry.data().uid;
  const user=await db.doc(`users/${uid}`).get();
  if(!user.exists || user.data().role!=='MARKETER' || user.data().referralCode!==code) return {recorded:false};
  const id=createHash('sha256').update(code+':'+visitId).digest('hex');
  await db.runTransaction(async tx=>{
    const ref=db.doc(`marketerVisits/${id}`),old=await tx.get(ref);
    if(old.exists) return;
    tx.create(ref,{marketerId:uid,createdAt:FieldValue.serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+30*86400000)});
    tx.set(db.doc(`marketerMetrics/${uid}`),{visits:FieldValue.increment(1)},{merge:true});
  });
  return {recorded:true};
});

exports.syncMarketerStores=onDocumentWritten('merchants/{merchantId}',async event=>{
  const mid=event.params.merchantId;
  const before=event.data.before.exists?event.data.before.data():{};
  const after=event.data.after.exists?event.data.after.data():{};
  const ids=[...new Set([cleanId(before.marketerId),cleanId(after.marketerId)].filter(Boolean))];
  for(const uid of ids){
    await db.runTransaction(async tx=>{
      const mref=db.doc(`merchants/${mid}`),ref=db.doc(`marketerMetrics/${uid}/stores/${mid}`),uref=db.doc(`users/${uid}`);
      // Read current state, rather than trusting delivery order of trigger events.
      const [ms,old,us]=await Promise.all([tx.get(mref),tx.get(ref),tx.get(uref)]);
      const current=ms.exists?ms.data():{};
      const linked=current.marketerId===uid?1:0,active=linked && current.status==='ACTIVE'?1:0;
      const previous=old.exists?old.data():{linked:0,active:0};
      const dl=linked-(previous.linked||0),da=active-(previous.active||0);
      const metricsRef=db.doc(`marketerMetrics/${uid}`),metrics=await tx.get(metricsRef);
      const nextActive=Math.max(0,(metrics.data()?.activeStores||0)+da);
      const inbox=db.doc(`marketerInbox/${uid}/items/approved_${mid}`),notice=await tx.get(inbox);
      if(dl || da){
        tx.set(ref,{linked,active,updatedAt:FieldValue.serverTimestamp()});
        tx.set(metricsRef,{linkedStores:FieldValue.increment(dl),activeStores:FieldValue.increment(da),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      }
      const publicRef=db.doc(`marketerPublicStats/${uid}`);
      // A demotion or privacy opt-out can race this trigger; read role and opt-in in the same transaction.
      if(us.exists && us.data().role==='MARKETER' && us.data().leaderboardOptIn===true){
        tx.set(publicRef,{alias:publicAlias(us.data()),activeStores:nextActive});
      }else tx.delete(publicRef);
      if(active && !notice.exists){
        tx.create(inbox,{title:'محلك اتوافق عليه 🎉',body:`تم اعتماد «${String(current.businessName||'المحل').slice(0,100)}». تابع أداءه من محلاتي.`,createdAt:FieldValue.serverTimestamp()});
      }
    });
  }
});

exports.notifyMarketerFirstOrder=onDocumentCreated('subOrders/{orderId}',async event=>{
  const order=event.data.data(),mid=cleanId(order.merchantId);
  if(!mid) return;
  await db.runTransaction(async tx=>{
    const ms=await tx.get(db.doc(`merchants/${mid}`));
    if(!ms.exists) return;
    const m=ms.data(),uid=cleanId(m.marketerId);if(!uid) return;
    const us=await tx.get(db.doc(`users/${uid}`));
    if(!us.exists || us.data().role!=='MARKETER') return;
    const ref=db.doc(`marketerInbox/${uid}/items/first_order_${mid}`),old=await tx.get(ref);
    const first=await tx.get(db.collection('subOrders').where('merchantId','==',mid).orderBy('createdAt','asc').orderBy('__name__','asc').limit(1));
    if(first.empty || first.docs[0].id!==event.params.orderId) return;
    if(!old.exists) tx.create(ref,{title:'أول طلب لمحلك 👏',body:`وصل أول طلب لـ«${String(m.businessName||'المحل').slice(0,100)}». احتساب العمولة يفضل حسب قواعد المنصة وحالة التسليم.`,createdAt:FieldValue.serverTimestamp()});
  });
});

exports.setMarketerLeaderboardVisibility=onCall(secured,async request=>{
  const {uid}=await marketer(request);
  if(typeof request.data?.visible!=='boolean') throw new HttpsError('invalid-argument','قيمة غير صحيحة');
  await db.runTransaction(async tx=>{
    const userRef=db.doc(`users/${uid}`),user=await tx.get(userRef);
    const metrics=await tx.get(db.doc(`marketerMetrics/${uid}`));
    if(!user.exists || user.data().role!=='MARKETER') throw new HttpsError('permission-denied','غير مسموح');
    tx.update(userRef,{leaderboardOptIn:request.data.visible});
    const ref=db.doc(`marketerPublicStats/${uid}`);
    if(request.data.visible) tx.set(ref,{alias:publicAlias(user.data()),activeStores:metrics.data()?.activeStores||0});
    else tx.delete(ref);
  });
  return {saved:true};
});
exports.getMarketerToolsData=onCall(secured,async request=>{
  const {uid,profile}=await marketer(request);
  const [metrics,inbox,leaders]=await Promise.all([
    db.doc(`marketerMetrics/${uid}`).get(),
    db.collection(`marketerInbox/${uid}/items`).orderBy('createdAt','desc').limit(20).get(),
    db.collection('marketerPublicStats').orderBy('activeStores','desc').limit(20).get()
  ]);
  return {metrics:{visits:metrics.data()?.visits||0,linkedStores:metrics.data()?.linkedStores||0},optIn:profile.leaderboardOptIn===true,
    notifications:inbox.docs.map(d=>({title:d.data().title,body:d.data().body})),
    leaderboard:leaders.docs.map(d=>({alias:d.data().alias,activeStores:d.data().activeStores||0}))};
});
