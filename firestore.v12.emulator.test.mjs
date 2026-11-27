// Rules v12 test. Run: firebase emulators:exec --only firestore (port 8092) then node this file.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,collection,query,where,writeBatch,runTransaction,increment,addDoc} from 'firebase/firestore';
const rules=readFileSync(new URL('./firestore.v12.proposed.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-v12',firestore:{host:'127.0.0.1',port:8092,rules}});
let n=0;const ok=async(p,m)=>{try{await assertSucceeds(p);n++;}catch(e){console.error('FAIL (should work):',m,e.message.slice(0,200));process.exitCode=1;}};
const no=async(p,m)=>{try{await assertFails(p);n++;}catch(e){console.error('FAIL (should be denied):',m);process.exitCode=1;}};
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();const S=(p,id,d)=>setDoc(doc(db,p,id),d);
  await S('settings','app',{autoApproveOrders:true});
  await S('users','admin',{role:'ADMIN',adminRole:'SUPER'});
  await S('users','cust1',{role:'CUSTOMER',loyaltyPoints:100});await S('users','cust2',{role:'CUSTOMER'});
  await S('users','merch1',{role:'MERCHANT',merchantId:'m1'});await S('users','merch2',{role:'MERCHANT',merchantId:'m2'});
  await S('merchants','m1',{ownerId:'merch1',status:'ACTIVE',rating:4.8,ratingCount:2,ratingSum:9.6});
  await S('products','p1',{merchantId:'m1',price:10,stock:20,soldCount:1});
  await S('coupons','SAVE',{isActive:true,type:'FIXED',value:5,maxUses:3,usedCount:1});
  await S('coupons','FULL',{isActive:true,maxUses:1,usedCount:1});
  await S('subOrders','SD',{id:'SD',parentOrderId:'OD',merchantId:'m1',customerId:'cust1',status:'DELIVERED',discountRestored:false});
  await S('orders','OD',{customerId:'cust1',couponCode:'SAVE',subOrderIds:['SD']});
  await S('subOrders','SX',{id:'SX',parentOrderId:'OX',merchantId:'m1',customerId:'cust2',status:'DELIVERED'});
  await S('notifications','n1',{targetType:'CUSTOMER',targetId:'cust1',title:'a',message:'b',isRead:false,createdAt:1});
  await S('notifications','n2',{targetType:'MERCHANT',targetId:'m1',title:'a',message:'b',isRead:false,createdAt:1});
  await S('notifications','n3',{targetType:'ADMIN',targetId:'x',title:'a',message:'b',isRead:false,createdAt:1});
  await S('subOrders','SD2',{id:'SD2',parentOrderId:'O',merchantId:'m1',customerId:'cust1',status:'DELIVERED'});
  await S('subOrders','SP',{id:'SP',parentOrderId:'O',merchantId:'m1',customerId:'cust1',status:'PREPARING'});
  await S('ratings','rate_SD',{id:'rate_SD',subOrderId:'SD',customerId:'cust1',merchantId:'m1',merchantRating:5,createdAt:1});
});
const _c={};const as=u=>_c[u]||(_c[u]=env.authenticatedContext(u).firestore());
// ---- notifications
const nq=(d,t,id)=>getDocs(query(collection(d,'notifications'),where('targetType','==',t),where('targetId','==',id)));
await ok(nq(as('cust1'),'CUSTOMER','cust1'),'customer reads own notifs');
await no(nq(as('cust2'),'CUSTOMER','cust1'),'customer reads other notifs');
await ok(nq(as('merch1'),'MERCHANT','m1'),'merchant reads own notifs');
await no(nq(as('merch2'),'MERCHANT','m1'),'merchant reads other store notifs');
await ok(getDocs(query(collection(as('admin'),'notifications'),where('targetType','==','ADMIN'))),'admin reads admin notifs');
await no(getDocs(query(collection(as('cust1'),'notifications'),where('targetType','==','ADMIN'))),'customer reads admin notifs');
const push=(d,t,id)=>addDoc(collection(d,'notifications'),{targetType:t,targetId:id,title:'x',message:'y',relatedOrderId:null,isRead:false,createdAt:Date.now()});
await ok(push(as('cust1'),'MERCHANT','m1'),'customer notifies merchant');
await ok(push(as('merch1'),'CUSTOMER','cust1'),'merchant notifies customer');
await no(addDoc(collection(as('cust1'),'notifications'),{targetType:'ADMIN',targetId:'x',title:'x',message:'y',isRead:true,createdAt:1}),'create already-read');
await no(addDoc(collection(as('cust1'),'notifications'),{targetType:'ADMIN',targetId:'x',title:'x',message:'y',isRead:false,createdAt:1,extra:1}),'extra key');
await no(addDoc(collection(as('cust1'),'notifications'),{targetType:'ADMIN',targetId:'x',title:'x'.repeat(500),message:'y',isRead:false,createdAt:1}),'huge title');
await ok(updateDoc(doc(as('cust1'),'notifications','n1'),{isRead:true}),'mark own read');
await no(updateDoc(doc(as('cust2'),'notifications','n1'),{isRead:true}),'mark other read');
await no(updateDoc(doc(as('cust1'),'notifications','n1'),{message:'hack'}),'edit message');
await no(deleteDoc(doc(as('cust2'),'notifications','n1')),'delete other notif');
await ok(deleteDoc(doc(as('cust1'),'notifications','n1')),'delete own notif');
// ---- ratings
const rate=(d,sub,over={})=>setDoc(doc(d,'ratings','rate_'+sub),{id:'rate_'+sub,subOrderId:sub,parentOrderId:'O',customerId:'cust1',merchantId:'m1',merchantRating:4,agentId:null,agentRating:null,productRatings:[{productId:'p1',rating:5}],comment:'ok',createdAt:Date.now(),...over});
await ok(rate(as('cust1'),'SD2'),'rate delivered own sub');
await no(rate(as('cust1'),'SD2'),'rate twice (update by customer)');
await no(rate(as('cust1'),'SP'),'rate before delivery');
await no(rate(as('cust1'),'SX'),'rate someone else sub');
await no(rate(as('cust2'),'SD'),'impersonate customer');
await no(rate(as('cust1'),'SD2',{merchantRating:50}),'rating 50');
await ok(getDoc(doc(as('cust1'),'ratings','rate_SD')),'customer reads own rating');
await no(getDoc(doc(as('cust2'),'ratings','rate_SD')),'other customer reads rating');
await ok(getDocs(query(collection(as('merch1'),'ratings'),where('merchantId','==','m1'))),'merchant lists own ratings');
await no(getDocs(query(collection(as('merch2'),'ratings'),where('merchantId','==','m1'))),'other merchant lists ratings');
await ok(updateDoc(doc(as('merch1'),'ratings','rate_SD'),{merchantReply:'شكرا',merchantReplyAt:1}),'merchant replies');
await no(updateDoc(doc(as('merch2'),'ratings','rate_SD'),{merchantReply:'x',merchantReplyAt:1}),'wrong merchant replies');
await no(updateDoc(doc(as('merch1'),'ratings','rate_SD'),{merchantRating:1}),'merchant edits stars');
// ---- rating bumps
await ok(updateDoc(doc(as('cust1'),'merchants','m1'),{ratingCount:3,ratingSum:14.6,rating:4.9}),'bump merchant rating');
await no(updateDoc(doc(as('cust1'),'merchants','m1'),{ratingCount:3,ratingSum:99,rating:5}),'bump sum too high');
await no(updateDoc(doc(as('cust1'),'merchants','m1'),{ratingCount:50,ratingSum:200,rating:4}),'bump count jump');
await no(updateDoc(doc(as('cust1'),'merchants','m1'),{totalOrdersCount:999}),'totalOrdersCount');
// ---- stock
await ok(updateDoc(doc(as('cust1'),'products','p1'),{stock:increment(-3)}),'stock decrement');
await ok(updateDoc(doc(as('cust1'),'products','p1'),{stock:increment(3)}),'stock restore');
await no(updateDoc(doc(as('cust1'),'products','p1'),{stock:-5}),'negative stock');
await no(updateDoc(doc(as('cust1'),'products','p1'),{stock:100000}),'huge stock');
await no(updateDoc(doc(as('cust1'),'products','p1'),{price:1}),'price change');
// ---- coupons
const cpn=(u,code,orderId,extra={})=>runTransaction(as(u),async tx=>{
  tx.set(doc(as(u),'orders',orderId),{id:orderId,customerId:u,subtotal:20,deliveryFee:5,discount:5,couponCode:code,pointsRedeemed:0,subOrderIds:['S_'+orderId],...extra});
  tx.set(doc(as(u),'subOrders','S_'+orderId),{id:'S_'+orderId,parentOrderId:orderId,merchantId:'m1',customerId:u,subtotal:20,status:'PENDING_ADMIN'});
  tx.update(doc(as(u),'coupons',code),{usedCount:increment(1),lastOrderId:orderId});
});
await ok(cpn('cust1','SAVE','OA'),'order with coupon counted');
await no(cpn('cust1','SAVE','OB',{subtotal:99}),'order subtotal mismatch');
await no(cpn('cust1','FULL','OC'),'coupon at max uses');
await no(updateDoc(doc(as('cust1'),'coupons','SAVE'),{usedCount:increment(1)}),'bare +1');
await no(updateDoc(doc(as('cust1'),'coupons','SAVE'),{usedCount:increment(1),lastOrderId:'NOPE'}),'+1 with fake order');
await no(updateDoc(doc(as('cust1'),'coupons','SAVE'),{usedCount:0}),'reset usedCount');
await no(updateDoc(doc(as('cust1'),'coupons','SAVE'),{usedCount:increment(-1)}),'bare -1');
await no(setDoc(doc(as('cust1'),'orders','OE'),{id:'OE',customerId:'cust1',subtotal:20,deliveryFee:0,discount:5,couponCode:'SAVE',subOrderIds:['S_OE']}),'order claims coupon without counting');
// restore
await ok(runTransaction(as('cust1'),async tx=>{tx.update(doc(as('cust1'),'subOrders','SD'),{status:'CANCELLED',discountRestored:true,restocked:true});tx.update(doc(as('cust1'),'coupons','SAVE'),{usedCount:increment(-1),lastRestoreSub:'SD'});}),'cancel restores coupon');
await no(updateDoc(doc(as('cust1'),'coupons','SAVE'),{usedCount:increment(-1),lastRestoreSub:'SD'}),'restore twice / without tx');
// ---- orders without coupon + points + totals
const ord=(id,over={},sub={})=>runTransaction(as('cust1'),async tx=>{tx.set(doc(as('cust1'),'orders',id),{id,customerId:'cust1',subtotal:30,deliveryFee:5,discount:0,couponCode:null,pointsRedeemed:0,subOrderIds:['A_'+id,'B_'+id],...over});
  tx.set(doc(as('cust1'),'subOrders','A_'+id),{id:'A_'+id,parentOrderId:id,merchantId:'m1',customerId:'cust1',subtotal:10,status:'PENDING_ADMIN',...sub});
  tx.set(doc(as('cust1'),'subOrders','B_'+id),{id:'B_'+id,parentOrderId:id,merchantId:'m1',customerId:'cust1',subtotal:20,status:'PENDING_ADMIN'});
  if(over._pts)tx.update(doc(as('cust1'),'users','cust1'),{loyaltyPoints:increment(-over._pts)});});
await ok(ord('P1'),'two-store order consistent');
await ok(ord('P2',{subtotal:30},{subtotal:8,subtotalGross:10}),'store points gross used');
await no(ord('P3',{subtotal:5}),'order subtotal lower than parts');
await no(ord('P4',{discount:500}),'discount bigger than order');
await no(ord('P5',{deliveryFee:-10}),'negative fee');
await no(ord('P6',{pointsRedeemed:10}),'points claimed but not deducted');
await ok(runTransaction(as('cust1'),async tx=>{tx.set(doc(as('cust1'),'orders','P7'),{id:'P7',customerId:'cust1',subtotal:10,deliveryFee:5,discount:2,couponCode:null,pointsRedeemed:10,subOrderIds:['A_P7']});
  tx.set(doc(as('cust1'),'subOrders','A_P7'),{id:'A_P7',parentOrderId:'P7',merchantId:'m1',customerId:'cust1',subtotal:10,status:'PENDING_ADMIN'});
  tx.update(doc(as('cust1'),'users','cust1'),{loyaltyPoints:increment(-10)});}),'points redeemed and deducted');
console.log('passed',n);
await env.cleanup();
