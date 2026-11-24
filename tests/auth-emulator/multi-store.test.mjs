import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,serverTimestamp,writeBatch} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const mk=(file)=>initializeTestEnvironment({projectId:'demo-multi-store',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL(file,import.meta.url),'utf8')}});
const merchant=(id,owner)=>({id,ownerId:owner,businessName:id,status:'ACTIVE',subscriptionModel:'MERCHANT_V2',subPlanType:'ORDERING',subEndsAt:Date.now()+86400000,subOrderCommissionPercent:2,subTermsVersion:1});
const sub=(id,extra={})=>({id,parentOrderId:'ORD-1',merchantId:id.endsWith('1')?'m1':'m2',customerId:'cust',subtotal:100,status:'OUT_FOR_DELIVERY',deliveryAgentId:'a1',deliveryAgentName:'Ali',deliveryAgentPhone:'0100',commissionModel:'MERCHANT_V2',commissionTermsVersion:1,commissionPayer:'MERCHANT',commissionPercent:2,commissionBase:100,commissionAmount:2,commissionBasis:'GOODS_AFTER_MERCHANT_DISCOUNTS_EXCLUDES_DELIVERY',batchFlow:true,orderStoreCount:2,orderDeliveryFee:35,orderDiscount:0,...extra});
async function seed(env){await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
 await setDoc(doc(d,'settings','app'),{subsEnforced:true});
 for(const [u,x] of Object.entries({cust:{role:'CUSTOMER'},c1:{role:'DELIVERY',deliveryAgentId:'a1'},c2:{role:'DELIVERY',deliveryAgentId:'a2'},o1:{role:'MERCHANT',merchantId:'m1'},o2:{role:'MERCHANT',merchantId:'m2'},admin:{role:'ADMIN',adminRole:'SUPER'}}))await setDoc(doc(d,'users',u),x);
 await setDoc(doc(d,'merchants','m1'),merchant('m1','o1'));await setDoc(doc(d,'merchants','m2'),merchant('m2','o2'));
 await setDoc(doc(d,'deliveryAgents','a1'),{id:'a1',name:'Ali',phone:'0100',ownerId:'c1',status:'ACTIVE'});await setDoc(doc(d,'deliveryAgents','a2'),{id:'a2',name:'Omar',phone:'0200',ownerId:'c2',status:'ACTIVE'});
 await setDoc(doc(d,'subOrders','S1'),sub('S1'));await setDoc(doc(d,'subOrders','S2'),sub('S2'));
 await setDoc(doc(d,'subOrders','L1'),sub('L1',{batchFlow:false,orderStoreCount:null}));});}
// baseline: the currently published rules do not let a courier record a pickup
{const env=await mk('published.rules');try{await seed(env);await assertFails(updateDoc(doc(env.authenticatedContext('c1').firestore(),'subOrders','S1'),{pickedUpAt:serverTimestamp()}));console.log('PASS baseline: published rules reject pickedUpAt (rules update needed)');}finally{await env.cleanup()}}
{const env=await mk('../../firestore.multi-store.proposed.rules');try{await seed(env);
 const c1=env.authenticatedContext('c1').firestore(),c2=env.authenticatedContext('c2').firestore(),cust=env.authenticatedContext('cust').firestore(),o1=env.authenticatedContext('o1').firestore(),adm=env.authenticatedContext('admin').firestore();
 // creation of a multi-store order: both sub-orders carry the new fields
 const b=writeBatch(cust);b.set(doc(cust,'orders','ORD-9'),{id:'ORD-9',customerId:'cust',subtotal:200,deliveryFee:35,deliveryFeeGross:50,deliveryDiscountPercent:30,deliveryDiscount:15,total:235,merchantCount:2,status:'PENDING_ADMIN'});
 b.set(doc(cust,'subOrders','SUB-ORD-9-1'),sub('SUB-ORD-9-1',{id:'SUB-ORD-9-1',parentOrderId:'ORD-9',status:'PENDING_ADMIN',merchantId:'m1',deliveryAgentId:null,deliveryAgentName:null,deliveryAgentPhone:null,merchantAddress:'x'}));
 b.set(doc(cust,'subOrders','SUB-ORD-9-2'),sub('SUB-ORD-9-2',{id:'SUB-ORD-9-2',parentOrderId:'ORD-9',status:'PENDING_ADMIN',merchantId:'m2',deliveryAgentId:null,deliveryAgentName:null,deliveryAgentPhone:null}));
 await assertSucceeds(b.commit());console.log('PASS customer creates 2-store order with new fields');
 const ref=(db,id)=>doc(db,'subOrders',id);
 await assertFails(updateDoc(ref(c2,'S1'),{pickedUpAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(cust,'S1'),{pickedUpAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(o1,'S1'),{pickedUpAt:serverTimestamp()}));
 await assertFails(updateDoc(ref(c1,'S1'),{pickedUpAt:123}));
 await assertFails(updateDoc(ref(c1,'S1'),{pickedUpAt:serverTimestamp(),subtotal:1}));
 console.log('PASS other courier, customer, store owner, forged time and extra fields cannot record pickup');
 await assertFails(updateDoc(ref(c1,'S1'),{status:'DELIVERED',deliveredAt:serverTimestamp()}));console.log('PASS delivery blocked before pickup');
 await assertSucceeds(updateDoc(ref(c1,'S1'),{pickedUpAt:serverTimestamp()}));await assertFails(updateDoc(ref(c1,'S1'),{pickedUpAt:serverTimestamp()}));console.log('PASS assigned courier records pickup once');
 await assertFails(updateDoc(ref(c2,'S1'),{status:'DELIVERED',deliveredAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(ref(c1,'S1'),{status:'DELIVERED',deliveredAt:serverTimestamp()}));console.log('PASS delivery after pickup, only by the assigned courier');
 await assertSucceeds(updateDoc(ref(c1,'L1'),{status:'DELIVERED',deliveredAt:serverTimestamp()}));console.log('PASS legacy sub-order (no batchFlow) still delivers without pickup');
 await assertSucceeds(updateDoc(ref(adm,'S2'),{status:'CANCELLED',cancelledAt:Date.now(),cancelReason:'x'}));console.log('PASS admin cancel unaffected');
 assert.ok((await getDoc(ref(c1,'S1'))).data().pickedUpAt);
}finally{await env.cleanup()}}
