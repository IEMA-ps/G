import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,runTransaction,writeBatch} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {assignMemberRole}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../../member-roles.js',import.meta.url))).toString('base64'));
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
}finally{await env.cleanup()}
