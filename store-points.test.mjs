import assert from 'node:assert/strict';
import * as SP from './store-points.js';
import * as Tx from './order-points-tx.js';
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
// config: invalid or incomplete means OFF
eq(SP.config(null).on,false);
eq(SP.config({on:true,egpPerPoint:0,pointValue:1}).on,false);
eq(SP.config({on:true,egpPerPoint:10,pointValue:-1}).on,false);
eq(SP.config({on:false,egpPerPoint:10,pointValue:1}).on,false);
eq(SP.config({on:true,egpPerPoint:'10',pointValue:'0.5'}),{on:true,egpPerPoint:10,pointValue:0.5});
eq(SP.config({on:true,egpPerPoint:1e9,pointValue:1}).on,false);
// earned: whole points only
eq(SP.earned(199,SP.config({on:true,egpPerPoint:10,pointValue:1})),19);
eq(SP.earned(9,SP.config({on:true,egpPerPoint:10,pointValue:1})),0);
eq(SP.earned(500,SP.config({on:false,egpPerPoint:10,pointValue:1})),0);
eq(SP.cashbackPercent({egpPerPoint:10,pointValue:0.5}),5);
eq(SP.fromForm({on:true,egpPerPoint:'',pointValue:''}).error!==undefined,true);
eq(SP.fromForm({on:false,egpPerPoint:'',pointValue:''}).value.on,false);
// deliverSubOrder with an in-memory fake of the Firestore functions
function fake(data){
  const path=(db,...p)=>p.join('/');
  const inc=v=>({__inc:v});
  const apply=(old,patch)=>{const o={...(old||{})};for(const [k,v]of Object.entries(patch))o[k]=v&&v.__inc!==undefined?(o[k]||0)+v.__inc:v;return o;};
  const api={doc:path,increment:inc,runTransaction:async(db,fn)=>{
    const writes=[];let wrote=false;
    const tx={get:async p=>{assert.equal(wrote,false,'read after write: '+p);return{exists:()=>p in data,data:()=>data[p]};},
      update:(p,v)=>{wrote=true;assert.ok(p in data,'update of missing doc '+p);writes.push(()=>data[p]=apply(data[p],v));},
      set:(p,v,o)=>{wrote=true;writes.push(()=>data[p]=apply(o&&o.merge?data[p]:{},v));}};
    const r=await fn(tx);writes.forEach(w=>w());return r;}};
  return api;
}
const base=()=>({'users/c':{loyaltyPoints:5},'merchants/m1':{businessName:'حلويات',storePoints:{on:true,egpPerPoint:10,pointValue:1}},
  'merchants/m2':{businessName:'بدون نقط'},'subOrders/S1':{status:'OUT',subtotal:195,customerId:'c',merchantId:'m1'},
  'subOrders/S2':{status:'OUT',subtotal:100,customerId:'c',merchantId:'m2'}});
{ // flag on, store on: points go to the store balance, global balance untouched
  const d=base();const r=await Tx.deliverSubOrder(fake(d),null,{id:'S1'},{status:'DELIVERED'},{earnRate:0.1,storePointsOn:true,nowMs:1});
  eq([r.pointsEarned,r.storeId],[19,'m1']);eq(d['users/c/storePoints/m1'].points,19);eq(d['users/c/storePoints/m1'].storeName,'حلويات');eq(d['users/c'].loyaltyPoints,5);
  // delivering again pays nothing
  const r2=await Tx.deliverSubOrder(fake(d),null,{id:'S1'},{status:'DELIVERED'},{storePointsOn:true});
  eq(r2.awarded,false);eq(d['users/c/storePoints/m1'].points,19);}
{ // flag on, store without points: nothing at all (global earning is replaced)
  const d=base();const r=await Tx.deliverSubOrder(fake(d),null,{id:'S2'},{status:'DELIVERED'},{earnRate:0.1,storePointsOn:true});
  eq(r.pointsEarned,0);eq(d['users/c'].loyaltyPoints,5);eq('users/c/storePoints/m2' in d,false);}
{ // flag off: old behaviour exactly
  const d=base();const r=await Tx.deliverSubOrder(fake(d),null,{id:'S1'},{status:'DELIVERED'},{earnRate:0.1});
  eq(r.pointsEarned,19);eq(d['users/c'].loyaltyPoints,24);eq('users/c/storePoints/m1' in d,false);}
console.log(`store-points: ${n} checks passed`);
