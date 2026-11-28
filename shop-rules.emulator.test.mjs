// Shop/chair rules (inside the unpublished v16 file). Needs the Firestore emulator on 127.0.0.1:8092.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,getDoc} from 'firebase/firestore';
const rules=readFileSync(new URL('./firestore.v16.proposed.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-shops',firestore:{host:'127.0.0.1',port:8092,rules}});
let n=0;const ok=async(p,m)=>{try{await assertSucceeds(p);n++;}catch(e){console.error('FAIL (should work):',m,e.message.slice(0,200));process.exitCode=1;}};
const no=async(p,m)=>{try{await assertFails(p);n++;}catch(e){console.error('FAIL (should be denied):',m);process.exitCode=1;}};
await env.clearFirestore();
const setup=async on=>env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();const S=(p,id,d)=>setDoc(doc(db,p,id),d);
  await S('settings','app',{shopsEnabled:on,servicesEnabled:true});
  await S('users','sup',{role:'ADMIN',adminRole:'SUPER'});
  const m=(id,o,t='حلاقة رجالي')=>S('merchants',id,{id,ownerId:o,activityType:t,status:'ACTIVE'});
  await m('shopM','shopOwner');await m('b1','barber1');await m('b2','barber2');await m('shop2','owner2');await m('store','storeOwner','سوبرماركت');
  await S('shops','shopM',{merchantId:'shopM',code:'ST-AAAAAA',status:'ACTIVE'});
  await S('shops','shop2',{merchantId:'shop2',code:'ST-BBBBBB',status:'DISABLED'});
  await S('shopChairs','b2',{barberId:'b2',shopId:'shopM',code:'ST-AAAAAA',name:'b2',status:'PENDING',requestedAt:1});});
await setup(true);
const U=id=>env.authenticatedContext(id).firestore();
// shops
await ok(setDoc(doc(U('shopOwner'),'shops','shopM'),{merchantId:'shopM',code:'ST-AAAAAA',status:'DISABLED',updatedAt:2}),'owner toggles status');
await no(setDoc(doc(U('shopOwner'),'shops','shopM'),{merchantId:'shopM',code:'ST-ZZZZZZ',status:'ACTIVE',updatedAt:2}),'owner changes code');
await ok(setDoc(doc(U('owner2'),'shops','shop2'),{merchantId:'shop2',code:'ST-BBBBBB',status:'ACTIVE',updatedAt:2}),'other owner own');
await no(setDoc(doc(U('barber1'),'shops','shopM'),{merchantId:'shopM',code:'ST-AAAAAA',status:'ACTIVE',updatedAt:2}),'non-owner writes shop');
await no(setDoc(doc(U('storeOwner'),'shops','store'),{merchantId:'store',code:'ST-CCCCCC',status:'ACTIVE',updatedAt:2}),'non-service merchant');
await no(setDoc(doc(U('shopOwner'),'shops','shopM'),{merchantId:'shopM',code:'ST-AAAAAA',status:'ACTIVE',updatedAt:2,price:5}),'extra key');
await ok(getDoc(doc(U('barber1'),'shops','shopM')),'signed in reads');
// join request
await setup(true);
const req=(c,extra={})=>({barberId:'b1',shopId:'shopM',code:c,name:'b1',status:'PENDING',requestedAt:1,...extra});
await ok(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-AAAAAA')),'barber requests with right code');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-WRONG1')),'wrong code');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-AAAAAA',{status:'ACTIVE'})),'self-approve');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-BBBBBB',{shopId:'shop2'})),'disabled shop');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-AAAAAA',{shopId:'b1'})),'join self');
await no(setDoc(doc(U('barber2'),'shopChairs','b1'),req('ST-AAAAAA')),'request for someone else');
await no(setDoc(doc(U('storeOwner'),'shopChairs','store'),{barberId:'store',shopId:'shopM',code:'ST-AAAAAA',name:'s',status:'PENDING',requestedAt:1}),'non-service');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-AAAAAA',{extra:1})),'extra key');
// approval
await ok(updateDoc(doc(U('shopOwner'),'shopChairs','b2'),{status:'ACTIVE',decidedAt:5}),'owner approves');
await no(updateDoc(doc(U('barber2'),'shopChairs','b2'),{status:'ACTIVE',decidedAt:5}),'barber approves himself');
await no(updateDoc(doc(U('owner2'),'shopChairs','b2'),{status:'ACTIVE',decidedAt:5}),'other shop owner approves');
await no(updateDoc(doc(U('shopOwner'),'shopChairs','b2'),{shopId:'shop2'}),'owner moves chair');
await no(updateDoc(doc(U('shopOwner'),'shopChairs','b2'),{status:'ACTIVE',name:'x'}),'owner edits name');
// removal
await no(deleteDoc(doc(U('barber1'),'shopChairs','b2')),'other barber deletes');
await ok(deleteDoc(doc(U('barber2'),'shopChairs','b2')),'barber leaves');
await setup(true);
await ok(deleteDoc(doc(U('shopOwner'),'shopChairs','b2')),'owner removes');
// services
await ok(setDoc(doc(U('barber1'),'serviceItems','b1'),{merchantId:'b1',items:[{name:'قص',minutes:30}],updatedAt:1}),'barber saves services');
await no(setDoc(doc(U('barber2'),'serviceItems','b1'),{merchantId:'b1',items:[],updatedAt:1}),'other writes services');
await no(setDoc(doc(U('barber1'),'serviceItems','b1'),{merchantId:'b1',items:Array.from({length:13},()=>({name:'a',minutes:10})),updatedAt:1}),'too many');
await no(setDoc(doc(U('barber1'),'serviceItems','b1'),{merchantId:'b1',items:[],updatedAt:1,x:1}),'extra key');
await ok(getDoc(doc(U('barber2'),'serviceItems','b1')),'read');
// switch off
await setup(false);
await no(setDoc(doc(U('barber1'),'serviceItems','b1'),{merchantId:'b1',items:[],updatedAt:1}),'off: services');
await no(setDoc(doc(U('barber1'),'shopChairs','b1'),req('ST-AAAAAA')),'off: request');
await no(setDoc(doc(U('shopOwner'),'shops','shopM'),{merchantId:'shopM',code:'ST-AAAAAA',status:'ACTIVE',updatedAt:2}),'off: shop');
console.log('passed',n);
await env.cleanup();
