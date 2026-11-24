import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./order-money.js',import.meta.url),'utf8');
const M=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let checks=0;const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const pct50={isActive:true,type:'PERCENT',value:50};
// the bug from the review: 50% on 1000 then cart drops to 100
check(M.priceOrder({subtotal:1000,fee:20,coupon:pct50,pointsWanted:0,availablePoints:0,rate:1}).couponDiscount,500);
const small=M.priceOrder({subtotal:100,fee:20,coupon:pct50,pointsWanted:0,availablePoints:0,rate:1});
check(small.couponDiscount,50); check(small.total,70);
// points are capped to what is left, so total never reaches zero by overspend
const p=M.priceOrder({subtotal:100,fee:20,coupon:pct50,pointsWanted:500,availablePoints:500,rate:1});
check(p.points,70); check(p.total,0); check(p.discount,120);
// cannot spend more points than the balance, no negatives
check(M.pointsFor(50,10,1,1000),10); check(M.pointsFor(-5,10,1,1000),0); check(M.pointsFor(5,10,0,1000),0);
// min order: coupon stops applying when cart falls below it
const min={isActive:true,type:'FIXED',value:100,minOrderAmount:500};
check(M.priceOrder({subtotal:300,fee:0,coupon:min,pointsWanted:0,availablePoints:0,rate:1}).couponOk,false);
check(M.priceOrder({subtotal:300,fee:0,coupon:min,pointsWanted:0,availablePoints:0,rate:1}).couponDiscount,0);
// fixed coupon never exceeds subtotal
check(M.couponCheck({isActive:true,type:'FIXED',value:900},100).discount,100);
// exhausted / expired / inactive / missing
check(M.couponCheck({isActive:true,type:'FIXED',value:1,maxUses:3,usedCount:3},10).ok,false);
check(M.couponCheck({isActive:true,type:'FIXED',value:1,expiresAt:1},10,5).ok,false);
check(M.couponCheck({isActive:false,type:'FIXED',value:1},10).ok,false);
check(M.couponCheck(null,10).ok,false);
// restore
const subs=(a,b)=>[{id:'A',status:a},{id:'B',status:b}];
const order={couponCode:'SAVE',pointsRedeemed:40};
const sa={id:'A',status:'SENT_TO_MERCHANT',items:[{productId:'p1',quantity:2},{productId:'p2',quantity:1}]};
let r=M.planRestore(sa,subs('SENT_TO_MERCHANT','SENT_TO_MERCHANT'),order);
check(r.stock,[{productId:'p1',qty:2},{productId:'p2',qty:1}]); check(r.restoreDiscount,false);
r=M.planRestore(sa,subs('SENT_TO_MERCHANT','REJECTED'),order);
check(r.restoreDiscount,true); check(r.coupon,'SAVE'); check(r.points,40);
r=M.planRestore(sa,[{id:'A',status:'SENT_TO_MERCHANT'},{id:'B',status:'REJECTED',discountRestored:true}],order);
check(r.restoreDiscount,false);
// no double restore
check(M.planRestore({...sa,restocked:true},subs('X','X'),order).stock,[]);
check(M.planRestore({...sa,status:'CANCELLED'},subs('X','X'),order).stock,[]);
check(M.planRestore({...sa,status:'DELIVERED'},subs('X','X'),order).stock,[]);
check(M.planRestore(sa,[{id:'A'}],{}).restoreDiscount,false);
console.log(`order-money: ${checks} checks passed`);
