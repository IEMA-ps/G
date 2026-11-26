import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,runTransaction,increment} from 'firebase/firestore';
import * as OrderTx from './order-points-tx.js';
const api={doc,runTransaction,increment};
const env=await initializeTestEnvironment({projectId:'demo-points',firestore:{host:'127.0.0.1',port:8092,rules:readFileSync(new URL('./points-emulator.open.rules',import.meta.url),'utf8')}});
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();const get=async(p,id)=>(await getDoc(doc(db,p,id))).data();
  const opt={earnRate:0.1,loyaltyEnabled:true,bonusPoints:50};
  await setDoc(doc(db,'users','cust'),{loyaltyPoints:0});await setDoc(doc(db,'users','ref'),{loyaltyPoints:5});
  await setDoc(doc(db,'referrals','cust'),{status:'PENDING',referrerId:'ref'});
  await setDoc(doc(db,'subOrders','S1'),{status:'OUT_FOR_DELIVERY',subtotal:200,customerId:'cust'});
  // two simultaneous deliveries (merchant + courier) pay once
  const r=await Promise.all([OrderTx.deliverSubOrder(api,db,{id:'S1'},{status:'DELIVERED'},opt),OrderTx.deliverSubOrder(api,db,{id:'S1'},{status:'DELIVERED'},opt)]);
  eq(r.filter(x=>x.awarded).length,1,'exactly one award');
  eq((await get('users','cust')).loyaltyPoints,20+50,'20 points + 50 referral bonus, once');
  eq((await get('users','ref')).loyaltyPoints,55);
  eq((await get('referrals','cust')).status,'REWARDED');
  eq((await get('subOrders','S1')).pointsAwarded,true);
  // repeating later pays nothing
  const again=await OrderTx.deliverSubOrder(api,db,{id:'S1'},{status:'DELIVERED'},opt);
  eq(again.awarded,false);eq((await get('users','cust')).loyaltyPoints,70);
  // second order: points only, no bonus (referral already rewarded)
  await setDoc(doc(db,'subOrders','S2'),{status:'OUT_FOR_DELIVERY',subtotal:100,customerId:'cust'});
  const r2=await OrderTx.deliverSubOrder(api,db,{id:'S2'},{status:'DELIVERED'},opt);
  eq([r2.pointsEarned,r2.bonus],[10,0]);eq((await get('users','cust')).loyaltyPoints,80);
  // loyalty disabled: status changes, no points
  await setDoc(doc(db,'subOrders','S3'),{status:'OUT_FOR_DELIVERY',subtotal:100,customerId:'cust'});
  await OrderTx.deliverSubOrder(api,db,{id:'S3'},{status:'DELIVERED'},{...opt,loyaltyEnabled:false});
  eq((await get('users','cust')).loyaltyPoints,80);eq((await get('subOrders','S3')).status,'DELIVERED');
  // missing order: error, no write
  await assert.rejects(OrderTx.deliverSubOrder(api,db,{id:'NOPE'},{status:'DELIVERED'},opt));n++;
 });
 console.log(`points emulator: ${n} checks passed`);
}finally{await env.cleanup()}
