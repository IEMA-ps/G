import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const m=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('delivery-batch.js')).toString('base64'));
// fee = sum of store fees minus the setting percent, only for 2+ stores
assert.deepEqual(m.deliveryQuote(1,25,30),{storeCount:1,baseFee:25,gross:25,percent:0,discount:0,net:25});
assert.deepEqual(m.deliveryQuote(2,25,30),{storeCount:2,baseFee:25,gross:50,percent:30,discount:15,net:35});
assert.equal(m.deliveryQuote(3,25,30).net,52.5);assert.equal(m.deliveryQuote(3,25,30).discount,22.5);
assert.equal(m.deliveryQuote(2,25,undefined).percent,30,'default 30 when setting missing');
assert.equal(m.deliveryQuote(2,25,0).net,50);assert.equal(m.deliveryQuote(2,25,50).net,25);assert.equal(m.deliveryQuote(2,25,500).net,0);assert.equal(m.deliveryQuote(2,25,-5).net,50);
assert.equal(m.deliveryQuote(0,25,30).net,0);assert.equal(m.deliveryQuote(2,0,30).net,0);
assert.equal(m.deliveryQuote(2,33.33,30).net,46.66);
// max 3 stores
assert.equal(m.canAddStore(['a','b'],'c'),true);assert.equal(m.canAddStore(['a','b','c'],'d'),false);assert.equal(m.canAddStore(['a','b','c'],'b'),true);
// courier trip: pickups grouped per store, deliveries per order, collect = goods + fee - discount, delivery gated by pickup
const S=(id,o,mid,x={})=>({id,parentOrderId:o,merchantId:mid,merchantName:'Store '+mid,status:'OUT_FOR_DELIVERY',subtotal:100,batchFlow:true,orderStoreCount:2,orderDeliveryFee:35,orderDiscount:10,customerName:'C'+o,deliveryAddress:'addr '+o,...x});
let t=m.courierTrip([S('1','O1','A'),S('2','O1','B'),S('3','O2','A',{orderStoreCount:1,orderDeliveryFee:25,orderDiscount:0}),S('4','O3','A',{status:'DELIVERED'})]);
assert.equal(t.pickups.length,2);assert.equal(t.pickups.find(p=>p.merchantId==='A').parts.length,2,'two orders from the same store = one pickup stop');
assert.equal(t.deliveries.length,2);assert.equal(t.stopCount,4);
const d1=t.deliveries.find(d=>d.orderId==='O1');assert.equal(d1.goods,200);assert.equal(d1.collect,225);assert.equal(d1.ready,false);assert.equal(d1.pendingPickups,2);assert.equal(d1.missingParts,0);
assert.equal(t.deliveries.find(d=>d.orderId==='O2').collect,125);
t=m.courierTrip([S('1','O1','A',{pickedUpAt:1}),S('2','O1','B',{pickedUpAt:2})]);assert.equal(t.pickups.length,0);assert.equal(t.deliveries[0].ready,true);
t=m.courierTrip([S('1','O1','A',{pickedUpAt:1})]);assert.equal(t.deliveries[0].missingParts,1,'warn when a sibling part is not assigned to this courier');
t=m.courierTrip([S('9','OL','A',{batchFlow:undefined,orderStoreCount:undefined,orderDeliveryFee:undefined,orderDiscount:undefined})]);assert.equal(t.pickups.length,0);assert.equal(t.deliveries[0].ready,true,'legacy sub-order needs no pickup step');
// wiring in index.html
const h=readFileSync('index.html','utf8');
assert.ok(!h.includes('defaultDeliveryFee * '),'no per-store fee multiplication left');
assert.equal((h.match(/cartDeliveryQuote\(/g)||[]).length>=5,true);
for(const k of ['multiStoreDeliveryDiscountPercent','setMultiStoreDiscount','deliveryDiscount:quote.discount','batchFlow:true','markPickedUp','markTripDelivered','delivery-discount-row','canAddStore'])assert.ok(h.includes(k),k);
assert.ok(readFileSync('sw.js','utf8').includes('/delivery-batch.js'));
console.log('PASS fee quote (sum minus setting %), store cap, trip grouping/batching, collect amount, pickup gating, legacy sub-orders, wiring');
