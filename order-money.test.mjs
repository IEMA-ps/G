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
console.log(`order-money: ${checks} checks passed`);
