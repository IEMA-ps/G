import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,runTransaction,writeBatch} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {assignMemberRole,createMemberRecord}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../../member-roles.js',import.meta.url))).toString('base64'));
const env=await initializeTestEnvironment({projectId:'demo-member-roles',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('published.rules',import.meta.url),'utf8')}});
try{
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const [id,data] of Object.entries({super:{role:'ADMIN',adminRole:'SUPER'},staff:{role:'ADMIN',adminRole:'STAFF'},customer:{role:'CUSTOMER',merchantId:null,deliveryAgentId:null},courierCustomer:{role:'CUSTOMER',merchantId:null,deliveryAgentId:null},other:{role:'CUSTOMER',merchantId:null,deliveryAgentId:null},takenCustomer:{role:'CUSTOMER',merchantId:null,deliveryAgentId:null}}))await setDoc(doc(db,'users',id),data);
  await setDoc(doc(db,'merchants','m'),{id:'m',businessName:'Test',ownerId:null,status:'PENDING'});
  await setDoc(doc(db,'merchants','taken'),{id:'taken',ownerId:'other'});
  await setDoc(doc(db,'deliveryAgents','a'),{id:'a',name:'Test',ownerId:null,status:'ACTIVE'});
 });
 const db=env.authenticatedContext('super').firestore();
 await assignMemberRole({db,doc,runTransaction,actorId:'super',userId:'customer',recordId:'m',role:'MERCHANT'});
 assert.equal((await getDoc(doc(db,'users','customer'))).data().merchantId,'m');assert.equal((await getDoc(doc(db,'merchants','m'))).data().ownerId,'customer');
 console.log('PASS SUPER merchant assignment commits both links');
 await assignMemberRole({db,doc,runTransaction,actorId:'super',userId:'courierCustomer',recordId:'a',role:'DELIVERY'});
 assert.equal((await getDoc(doc(db,'users','courierCustomer'))).data().deliveryAgentId,'a');assert.equal((await getDoc(doc(db,'deliveryAgents','a'))).data().ownerId,'courierCustomer');console.log('PASS SUPER courier assignment commits both links');
 await assert.rejects(assignMemberRole({db,doc,runTransaction,actorId:'super',userId:'takenCustomer',recordId:'taken',role:'MERCHANT'}),/record-unavailable/);
 assert.equal((await getDoc(doc(db,'users','takenCustomer'))).data().role,'CUSTOMER');console.log('PASS owned record cannot be reassigned and customer unchanged');
 for(const id of ['staff','other']){
  const denied=env.authenticatedContext(id).firestore();
  await assert.rejects(assignMemberRole({db:denied,doc,runTransaction,actorId:id,userId:'other',recordId:'m',role:'MERCHANT'}),/super-required/);
  const batch=writeBatch(denied);batch.update(doc(denied,'users','other'),{role:'MERCHANT',merchantId:'m'});batch.update(doc(denied,'merchants','m'),{ownerId:'other'});await assertFails(batch.commit());
 }
 assert.equal((await getDoc(doc(db,'users','other'))).data().role,'CUSTOMER');assert.equal((await getDoc(doc(db,'merchants','m'))).data().ownerId,'customer');console.log('PASS staff/customer direct bypass blocked and no partial write');

 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();for(const id of ['newMerchant','newCourier','deniedNew'])await setDoc(doc(d,'users',id),{role:'CUSTOMER',merchantId:null,deliveryAgentId:null});await setDoc(doc(d,'settings','app'),{merchantPlansV2:true});});
 const input={name:'WhatsApp chosen store',phone:'01012345678',activity:'Grocery',address:'Test area',vehicle:'Bike'};
 await createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'newMerchant',recordId:'new_m',role:'MERCHANT',input,now:123});
 const created=(await getDoc(doc(db,'merchants','new_m'))).data();assert.equal(created.businessName,input.name);assert.equal(created.ownerId,'newMerchant');assert.equal(created.status,'PENDING');assert.equal(created.subPlanType,null);assert.equal(created.subscriptionModel,'MERCHANT_V2');assert.equal((await getDoc(doc(db,'users','newMerchant'))).data().merchantId,'new_m');console.log('PASS atomic new merchant creation and user link, PENDING without subscription');
 await createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'newCourier',recordId:'new_a',role:'DELIVERY',input,now:123});
 const agent=(await getDoc(doc(db,'deliveryAgents','new_a'))).data();assert.equal(agent.status,'PENDING');assert.equal(agent.merchantId,undefined);assert.equal((await getDoc(doc(db,'users','newCourier'))).data().merchantId,null);console.log('PASS independent courier creation, no store link');
 await assert.rejects(createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'newMerchant',recordId:'duplicate_m',role:'MERCHANT',input,now:123}),/customer-required/);assert.equal((await getDoc(doc(db,'merchants','duplicate_m'))).exists(),false);
 await assert.rejects(createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'deniedNew',recordId:'new_m',role:'MERCHANT',input,now:123}),/record-already-exists/);
 await assert.rejects(createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'deniedNew',recordId:'invalid',role:'MERCHANT',input:{...input,name:''},now:123}),/invalid-contact/);assert.equal((await getDoc(doc(db,'merchants','invalid'))).exists(),false);assert.equal((await getDoc(doc(db,'users','deniedNew'))).data().role,'CUSTOMER');
 for(const id of ['staff','other']){const bad=env.authenticatedContext(id).firestore();await assert.rejects(createMemberRecord({db:bad,doc,runTransaction,actorId:id,userId:'deniedNew',recordId:'blocked_'+id,role:'MERCHANT',input,now:123}),/super-required/);const b=writeBatch(bad);b.set(doc(bad,'merchants','blocked_'+id),{id:'blocked_'+id,ownerId:'deniedNew',status:'PENDING'});b.update(doc(bad,'users','deniedNew'),{role:'MERCHANT',merchantId:'blocked_'+id});await assertFails(b.commit());}
 console.log('PASS duplicate/retry/invalid input and staff/customer bypass rejected, no partial data');
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'users','attributed'),{role:'CUSTOMER',merchantId:null,deliveryAgentId:null});await setDoc(doc(d,'users','mk'),{role:'MARKETER',referralCode:'MK-REVIEW',firstName:'Review'});});
 await createMemberRecord({db,doc,runTransaction,actorId:'super',userId:'attributed',recordId:'attributed_m',role:'MERCHANT',input:{...input,marketerCode:'MK-REVIEW',marketerId:'mk'},now:234});
 const attributed=(await getDoc(doc(db,'merchants','attributed_m'))).data();assert.equal(attributed.marketerId,'mk');assert.equal(attributed.status,'PENDING');assert.equal(attributed.subEndsAt,undefined);console.log('PASS reviewed marketer attribution commits with new store and owner, no subscription');
}finally{await env.cleanup()}
