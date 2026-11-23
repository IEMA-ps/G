import {createRequire} from 'node:module';const require=createRequire(new URL('./tests/auth-emulator/package.json',import.meta.url));
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');const {doc,setDoc,updateDoc,getDoc}=require('firebase/firestore');import {readFileSync} from 'node:fs';
for(const proposed of [false,true]){
const env=await initializeTestEnvironment({projectId:'demo-store-types',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL(proposed?'./firestore.store-types.proposed.rules':'./firestore.store-map.proposed.rules',import.meta.url),'utf8')}});
try{
 const merchant={id:'m',ownerId:'owner',businessName:'store',description:'',address:'address',phone:'01012345678',whatsappNumber:'01012345678',status:'ACTIVE',subscriptionModel:'MERCHANT_V2',subPlanType:'PROFILE',subEndsAt:Date.now()+86400000,activityType:'سوبر ماركت'};
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'users','owner'),{role:'MERCHANT',merchantId:'m'});await setDoc(doc(db,'users','other'),{role:'CUSTOMER'});await setDoc(doc(db,'merchants','m'),merchant)});
 const db=env.authenticatedContext('owner').firestore(),ref=doc(db,'merchants','m');
 if(!proposed){await assertFails(updateDoc(ref,{activityType:'عطور'}));console.log('PASS confirmed map-link rules baseline rejects owner activity change');continue;}
 await assertSucceeds(updateDoc(ref,{activityType:'عطور'}));await assertSucceeds(updateDoc(ref,{activityType:'مخبز بلدي'}));
 await assertFails(updateDoc(doc(env.authenticatedContext('other').firestore(),'merchants','m'),{activityType:'مطاعم'}));await assertFails(updateDoc(ref,{subPlanType:'ORDERING'}));await assertFails(updateDoc(ref,{ownerId:'other'}));
 const m=(await getDoc(ref)).data(),projection=Object.fromEntries(['id','businessName','description','address','phone','whatsappNumber','activityType','status','subEndsAt','subPlanType'].map(k=>[k,m[k]]));projection.publishedAt=Date.now();await assertSucceeds(setDoc(doc(db,'publicMerchantProfiles','m'),projection));await assertFails(setDoc(doc(db,'publicMerchantProfiles','m'),{...projection,activityType:'مزور'}));
 console.log('PASS proposed owner type edit/custom + public projection; other-user, plan, ownership and forged public activity denied');
}finally{await env.cleanup()}}
