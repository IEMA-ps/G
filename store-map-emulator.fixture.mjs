import {createRequire} from 'node:module';
const require=createRequire(new URL('./tests/auth-emulator/package.json',import.meta.url));
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,getDoc}=require('firebase/firestore');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const proposed of [false,true]){
 const env=await initializeTestEnvironment({projectId:'demo-store-map',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL(proposed?'./firestore.store-map.proposed.rules':'./tests/auth-emulator/published.rules',import.meta.url),'utf8')}});
 try{
  const merchant={id:'m',ownerId:'owner',businessName:'store',description:'',address:'address',phone:'01012345678',whatsappNumber:'01012345678',status:'ACTIVE',subscriptionModel:'MERCHANT_V2',subPlanType:'PROFILE',subEndsAt:Date.now()+86400000,latitude:30,longitude:31};
  await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'users','owner'),{role:'MERCHANT',merchantId:'m'});await setDoc(doc(db,'users','other'),{role:'CUSTOMER'});await setDoc(doc(db,'merchants','m'),merchant);});
  const db=env.authenticatedContext('owner').firestore(),ref=doc(db,'merchants','m');
  const patch={googleMapsUrl:'https://maps.app.goo.gl/ExamplePin',latitude:null,longitude:null};
  if(!proposed){await assertFails(updateDoc(ref,patch));console.log('PASS baseline supplied rules block new map-link field, update required');continue;}
  await assertSucceeds(updateDoc(ref,patch));const actual=(await getDoc(ref)).data();assert.equal(actual.googleMapsUrl,patch.googleMapsUrl);
  await assertFails(updateDoc(doc(env.authenticatedContext('other').firestore(),'merchants','m'),{googleMapsUrl:'https://maps.app.goo.gl/Other'}));
  await assertFails(updateDoc(ref,{googleMapsUrl:'javascript:alert(1)'}));await assertFails(updateDoc(ref,{googleMapsUrl:'https://evil.test/'}));await assertFails(updateDoc(ref,{subPlanType:'ORDERING'}));
  const publicData=Object.fromEntries(['id','businessName','description','address','phone','whatsappNumber','latitude','longitude','googleMapsUrl','status','subEndsAt','subPlanType'].map(k=>[k,actual[k]]));publicData.publishedAt=Date.now();
  await assertSucceeds(setDoc(doc(db,'publicMerchantProfiles','m'),publicData));
  await assertFails(setDoc(doc(db,'publicMerchantProfiles','m'),{...publicData,googleMapsUrl:'https://maps.app.goo.gl/Different'}));
  console.log('PASS proposed: owner map update/public projection, other-owner/scheme/plan/forged-public blocked');
 }finally{await env.cleanup()}
}
