import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const I=await import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('./marketer-insights.js',import.meta.url),'utf8')).toString('base64'));
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
const D=86400000, now=Date.UTC(2026,10,25,12,0,0); // 25 Nov 2026
eq(I.monthKey(now),'2026-11');eq(I.monthKey(Date.UTC(2026,10,30,22,30)),'2026-12','22:30 UTC on 30 Nov is already 1 Dec in Cairo');
eq(I.monthKey(0),'');eq(I.prevMonthKey('2026-01'),'2025-12');eq(I.prevMonthKey('2026-11'),'2026-10');
const ms=[{id:'a',status:'ACTIVE',registeredAt:now-2*D,subEndsAt:now+3*D},{id:'b',status:'ACTIVE',registeredAt:Date.UTC(2026,9,10),subEndsAt:now-5*D},{id:'c',status:'ACTIVE'},{id:'d',status:'PENDING',registeredAt:now-4*D},{id:'e',status:'SUSPENDED'},{id:'f',status:'ACTIVE',subEndsAt:now+30*D}];
const att=I.needsAttention(ms,now);
eq(att.map(x=>x.m.id+':'+x.kind),['b:EXPIRED','a:EXPIRING','c:NO_SUB','d:PENDING']);
eq(att[0].days,5);eq(att[1].days,3);eq(att[3].days,4);
const subs=[{merchantId:'a',status:'DELIVERED',subtotal:100,deliveredAt:now-D},{merchantId:'a',status:'DELIVERED',subtotal:50.5,createdAt:Date.UTC(2026,10,2)},{merchantId:'b',status:'DELIVERED',subtotal:70,deliveredAt:{toMillis:()=>Date.UTC(2026,9,20)}},{merchantId:'a',status:'PREPARING',subtotal:999,createdAt:now},{merchantId:'zzz',status:'DELIVERED',subtotal:500,createdAt:now}];
eq(I.monthSummary(ms,subs,now),{cur:{orders:2,gross:150.5,newStores:2},prev:{orders:1,gross:70,newStores:1}},'only his stores, only delivered');
eq(I.filterByStatus(ms,'ACTIVE').length,4);eq(I.filterByStatus(ms,'ALL').length,6);eq(I.filterByStatus(null,'ACTIVE'),[]);
eq(I.change(150,100),50);eq(I.change(5,0),null);eq(I.change(50,100),-50);
console.log('marketer-insights tests ok',n);
