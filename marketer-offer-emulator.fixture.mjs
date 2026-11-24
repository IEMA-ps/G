import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';
const require=createRequire(new URL('./catalog-emulator.package.json',import.meta.url));const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');const {doc,setDoc,updateDoc}=require('firebase/firestore');
const env=await initializeTestEnvironment({projectId:'demo-marketer-offer',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.marketer-offer.proposed.rules','utf8')}});let n=0;
const ok=async p=>{try{await assertSucceeds(p);}catch(e){console.log('OK-FAIL at assertion',n+1);throw e;}n++;},no=async p=>{await assertFails(p);n++;};
const db=id=>env.authenticatedContext(id).firestore();
const plan=(kind,months,price)=>({name:kind==='ORDERING'?'باقة الطلبات':'الصفحة التعريفية',kind,months,price,model:'MERCHANT_V2',termsVersion:1,orderCommissionPercent:kind==='ORDERING'?2:0,active:true});
const setup=async(settings,merchant={})=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
 await setDoc(doc(d,'users','main'),{role:'ADMIN',adminRole:'SUPER'});await setDoc(doc(d,'users','staff'),{role:'ADMIN',adminRole:'STAFF'});await setDoc(doc(d,'users','own'),{role:'MERCHANT',merchantId:'m1'});
 await setDoc(doc(d,'settings','app'),settings);
 await setDoc(doc(d,'plans','ordering_3m_v2'),plan('ORDERING',3,400));await setDoc(doc(d,'plans','ordering_6m_v2'),plan('ORDERING',6,800));await setDoc(doc(d,'plans','profile_6m_v2'),plan('PROFILE',6,500));
 await setDoc(doc(d,'merchants','m1'),{ownerId:'own',marketerId:'mk',subscriptionModel:'MERCHANT_V2',status:'ACTIVE',...merchant});});};
const sub=(o={})=>({id:'s1',merchantId:'m1',merchantName:'x',planId:'ordering_3m_v2',planName:'باقة الطلبات',price:250,months:3,model:'MERCHANT_V2',kind:'ORDERING',termsVersion:1,orderCommissionPercent:2,reference:'T1',status:'PENDING',createdAt:1,offerId:'MARKETER_ORDERING_TRIAL',listPrice:400,...o});
const put=(o,id='s1')=>setDoc(doc(db('own'),'subscriptions',id),o);
try{
 await setup({marketerOffer2Enabled:true});
 await ok(put(sub()));
 await no(put(sub({price:200})));await no(put(sub({price:300})));
 await no(put(sub({planId:'ordering_6m_v2',months:6,listPrice:800})));
 await no(put(sub({marketerBonus:250})));await no(put(sub({marketerAmount:100})));await no(put(sub({marketerId:'mk'})));
 await no(put(sub({listPrice:100})));
 await no(put(sub({offerId:'MARKETER_PROFILE_6M',planId:'profile_6m_v2',kind:'PROFILE',planName:'الصفحة التعريفية',months:6,price:300,listPrice:500,orderCommissionPercent:0})),);
 await no(setDoc(doc(db('staff'),'subscriptions','sx'),sub({id:'sx',marketerBonus:250})));
 await ok(setDoc(doc(db('main'),'subscriptions','sx'),sub({id:'sx',status:'APPROVED',marketerId:'mk',marketerAmount:100,marketerBonus:250})));
 await no(updateDoc(doc(db('own'),'subscriptions','s1'),{marketerBonus:250}));
 await ok(updateDoc(doc(db('main'),'subscriptions','s1'),{status:'APPROVED',marketerBonus:250}));
 await ok(setDoc(doc(db('main'),'settings','app'),{marketerOffer2Enabled:true,offer2Fee:250,offer2Months:3,marketerFlatAmount:100,marketerBonusAmount:250,marketerBonusTarget:10}));
 await no(setDoc(doc(db('staff'),'settings','app'),{marketerOffer2Enabled:true}));await no(setDoc(doc(db('own'),'settings','app'),{marketerBonusAmount:9999}));
 // configured fee/months follow settings
 await setup({marketerOffer2Enabled:true,offer2Fee:300,offer2Months:6});
 await ok(put(sub({planId:'ordering_6m_v2',months:6,price:300,listPrice:800})));await no(put(sub()));
 // offer off by default
 await setup({});await no(put(sub()));
 // one use per merchant, and merchant needs a marketer
 await setup({marketerOffer2Enabled:true},{marketerOfferUsed:true});await no(put(sub()));
 await setup({marketerOffer2Enabled:true},{marketerId:null});await no(put(sub()));
 // old offer: inactive by default, works when enabled, blocked while the new one is on
 const old=sub({offerId:'MARKETER_PROFILE_6M',planId:'profile_6m_v2',kind:'PROFILE',planName:'الصفحة التعريفية',months:6,price:300,listPrice:500,orderCommissionPercent:0});
 await setup({});await no(put(old));
 await setup({marketerOfferEnabled:true});await ok(put(old));await no(put({...old,price:250}));
 await setup({marketerOfferEnabled:true,marketerOffer2Enabled:true});await no(put(old));
 // normal list-price subscriptions are unaffected
 await setup({marketerOffer2Enabled:true});
 const {offerId,listPrice,...plain}=sub({price:400});await ok(put(plain));await no(put({...plain,price:250}));
 console.log(`PASS ${n} emulator assertions: new offer price/plan/months follow settings, default off, one use, bonus and amounts only by main admin, old offer inactive and exclusive.`);
}finally{await env.cleanup();}
