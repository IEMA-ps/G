import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,runTransaction,increment} from 'firebase/firestore';
import * as OrderTx from './order-tx.js';
const api={doc,runTransaction,increment};
const env=await initializeTestEnvironment({projectId:'demo-order-money',firestore:{host:'127.0.0.1',port:8091,rules:readFileSync(new URL('./money-emulator.open.rules',import.meta.url),'utf8')}});
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
const get=async(db,p,id)=>(await getDoc(doc(db,p,id))).data();
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const seed=async()=>{
   await setDoc(doc(db,'products','p1'),{stock:48});await setDoc(doc(db,'products','p2'),{stock:10});
   await setDoc(doc(db,'coupons','SAVE'),{isActive:true,type:'PERCENT',value:50,usedCount:5,maxUses:100});
   await setDoc(doc(db,'users','c1'),{loyaltyPoints:10});
   await setDoc(doc(db,'orders','O1'),{customerId:'c1',couponCode:'SAVE',pointsRedeemed:40,subOrderIds:['A','B']});
   await setDoc(doc(db,'subOrders','A'),{parentOrderId:'O1',status:'SENT_TO_MERCHANT',items:[{productId:'p1',quantity:2}]});
   await setDoc(doc(db,'subOrders','B'),{parentOrderId:'O1',status:'SENT_TO_MERCHANT',items:[{productId:'p2',quantity:3}]});
  };
  await seed();
  // 1) reject first sub order: stock back, coupon and points NOT yet (B still alive)
  await OrderTx.cancelSubOrderWithRestore(api,db,{id:'A',parentOrderId:'O1'},{status:'REJECTED',cancelReason:'x'});
  eq((await get(db,'products','p1')).stock,50,'p1 restocked');
  eq((await get(db,'products','p2')).stock,10);
  eq((await get(db,'coupons','SAVE')).usedCount,5);
  eq((await get(db,'users','c1')).loyaltyPoints,10);
  eq((await get(db,'subOrders','A')).restocked,true);
  // 2) repeating the same cancel does nothing (no double restock)
  await OrderTx.cancelSubOrderWithRestore(api,db,{id:'A',parentOrderId:'O1'},{status:'REJECTED'});
  eq((await get(db,'products','p1')).stock,50,'no double restock');
  // 3) cancel the last one: stock, coupon use, points all back once
  await OrderTx.cancelSubOrderWithRestore(api,db,{id:'B',parentOrderId:'O1'},{status:'CANCELLED',cancelReason:'y'});
  eq((await get(db,'products','p2')).stock,13);
  eq((await get(db,'coupons','SAVE')).usedCount,4);
  eq((await get(db,'users','c1')).loyaltyPoints,50);
  await OrderTx.cancelSubOrderWithRestore(api,db,{id:'B',parentOrderId:'O1'},{status:'CANCELLED'});
  eq((await get(db,'users','c1')).loyaltyPoints,50,'no double points');
  eq((await get(db,'coupons','SAVE')).usedCount,4);
  // 4) delivered orders are not restocked
  await setDoc(doc(db,'orders','O2'),{customerId:'c1',subOrderIds:['D']});
  await setDoc(doc(db,'subOrders','D'),{parentOrderId:'O2',status:'DELIVERED',items:[{productId:'p1',quantity:5}]});
  await OrderTx.cancelSubOrderWithRestore(api,db,{id:'D',parentOrderId:'O2'},{status:'CANCELLED'});
  eq((await get(db,'products','p1')).stock,50,'delivered not restocked');
  // 5) pricing inside the transaction uses the fresh coupon and balance
  const price=(o)=>runTransaction(db,tx=>OrderTx.priceInTx(api,db,tx,{uid:'c1',rate:1,fee:20,...o}));
  let r=await price({coupon:{code:'SAVE'},wantedPoints:0,subtotal:100});
  eq([r.couponDiscount,r.total],[50,70],'coupon follows the current cart total');
  r=await price({coupon:{code:'SAVE'},wantedPoints:50,subtotal:100});
  eq([r.points,r.total],[50,20]);
  await assert.rejects(price({coupon:null,wantedPoints:500,subtotal:100}),/النقاط/);n++;
  await setDoc(doc(db,'coupons','USED'),{isActive:true,type:'FIXED',value:5,usedCount:3,maxUses:3});
  await assert.rejects(price({coupon:{code:'USED'},wantedPoints:0,subtotal:100}),/الكوبون/);n++;
  await assert.rejects(price({coupon:{code:'GONE'},wantedPoints:0,subtotal:100}),/الكوبون/);n++;
 });
 console.log(`money emulator: ${n} checks passed`);
}finally{await env.cleanup()}
