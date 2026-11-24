// Offline review page from the real UI functions with fake data. No Firebase SDK, login or writes.
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('index.html','utf8');
const take=(start,end)=>{const a=source.indexOf(start);if(a<0)throw new Error('missing '+start);const b=source.indexOf(end,a);if(b<0)throw new Error('missing '+end);return source.slice(a,b)};
const fns=[
 take('function cartMerchantCount(){','function renderCart(){').replace(/function cartMerchantCount[\s\S]*?\n(?=function cartDeliveryQuote)/,'function cartMerchantCount(){ return new Set(cartLines().map(l=>l.product.merchantId)).size; }\n'),
 take('function renderCart(){','function renderCheckout(){'),
 take('function renderCheckout(){','window.applyLoyaltyPoints'),
 take('function renderOrderDetail(){','/* ================= CUSTOMER: PROFILE'),
 take('function renderDeliveryDashboard(){','function deliveryTaskCard(s){')
].join('\n');
const style=source.match(/<style>([\s\S]*?)<\/style>/)[1];
writeFileSync('multi-store-review.html',`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة الطلب من أكتر من متجر</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><link rel="stylesheet" href="brand.css"><style>${style}</style></head>
<body><div id="appRoot"><div id="appShell"><div id="topbar"></div><div id="mainContent"></div><div id="bottomNav"></div></div><div id="modalRoot" class="hidden"><div id="modalSheet"></div></div></div>
<script type="module">
import * as DeliveryBatch from './delivery-batch.js';
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtMoney=n=>(Math.round((n||0)*100)/100).toLocaleString('ar-EG')+' ج.م',fmtDate=()=>'٢٤ نوفمبر - ٠٥:١٠ م',roundMoney=n=>Math.round((n||0)*100)/100,effPrice=p=>p.price,cleanPhone=p=>p,waLink=(p,m)=>'https://wa.me/'+p,
 emptyState=(i,t,s)=>'<div class="empty-state"><i class="fa-solid '+i+'"></i><h4>'+esc(t)+'</h4><p>'+esc(s)+'</p></div>';
const CUSTOMER_TRACK_STEPS=[['PENDING_ADMIN','تم استلام الطلب'],['SENT_TO_MERCHANT','تمت مراجعة الطلب'],['ACCEPTED','تم إرسال الطلب للتنفيذ'],['PREPARING','جاري التجهيز'],['OUT_FOR_DELIVERY','خرج للتوصيل'],['DELIVERED','تم التسليم']];
const ORDER_STATUS={OUT_FOR_DELIVERY:{label:'جاري التوصيل'},REJECTED:{label:'مرفوض'},CANCELLED:{label:'ملغي'}};
const paymentLabel=()=>'الدفع نقدًا عند الاستلام';
const q=new URLSearchParams(location.search),view=q.get('v')||'cart';
const merchants=[{id:'m1',businessName:'سوبر ماركت النور',minOrderAmount:0},{id:'m2',businessName:'صيدلية الشفاء'},{id:'m3',businessName:'مخبز الفرن البلدي'}];
const prods={p1:{id:'p1',title:'أرز مصري ١ كجم',price:48,merchantId:'m1'},p2:{id:'p2',title:'زيت عباد الشمس',price:95,merchantId:'m1'},p3:{id:'p3',title:'فيتامين سي',price:120,merchantId:'m2'},p4:{id:'p4',title:'عيش بلدي ٢٠ رغيف',price:30,merchantId:'m3'}};
const S=window.S={role:view==='courier'?'delivery':'customer',tab:view,settings:{defaultDeliveryFee:25,multiStoreDeliveryDiscountPercent:30,loyaltyEnabled:false},merchants,allMerchants:merchants,
 cart:[{productId:'p1',quantity:2},{productId:'p2',quantity:1},{productId:'p3',quantity:1},{productId:'p4',quantity:1}],products:Object.values(prods),
 myAddresses:[{_id:'a1',label:'البيت',fullAddressText:'الجيزة، الدقي، ١٢ شارع التحرير',isDefault:true}],profile:{loyaltyPoints:0},appliedCoupon:null,appliedPoints:null,paymentMethod:'COD',
 myAgent:{name:'علي المندوب',status:'ACTIVE',phone:'01000000000',rating:4.8,ratingCount:12},viewOrderId:'ORD-DEMO',myRatings:[]};
const getProduct=id=>prods[id],getMerchant=id=>merchants.find(m=>m.id===id);
const flashActive=()=>false;
const cartLines=()=>S.cart.map(c=>({...c,product:getProduct(c.productId)})).filter(l=>l.product);
const cartTotal=()=>cartLines().reduce((a,l)=>a+effPrice(l.product)*l.quantity,0);
const PAYMENT_METHODS=[{id:'COD',label:'الدفع نقدًا عند الاستلام',enabled:true}];
window.go=()=>{};window.UI={toast(){},openModal(){},closeModal(){}};
const pt=(id,o,mid,x={})=>({id,parentOrderId:o,merchantId:mid,merchantName:merchants.find(m=>m.id===mid).businessName,merchantAddress:'شارع الهرم، الجيزة',merchantMapUrl:'https://www.google.com/maps',merchantWhatsapp:'01011111111',status:'OUT_FOR_DELIVERY',subtotal:150,batchFlow:true,orderStoreCount:3,orderDeliveryFee:52.5,orderDiscount:0,customerName:'منى أحمد',customerPhone:'01234567890',deliveryAddress:'الجيزة، الدقي، ١٢ شارع التحرير',createdAt:1,deliveryAgentName:'علي المندوب',...x});
S.myAgentSubOrders=[pt('s1','ORD-DEMO','m1',{pickedUpAt:1,subtotal:191}),pt('s2','ORD-DEMO','m2',{subtotal:120}),pt('s3','ORD-DEMO','m3',{subtotal:30}),pt('s4','ORD-7','m2',{orderStoreCount:1,orderDeliveryFee:25,subtotal:210,customerName:'خالد سمير',deliveryAddress:'الجيزة، المهندسين، ٥ شارع جامعة الدول'})];
S.myOrders=[{id:'ORD-DEMO',createdAt:1,deliveryAddress:'الجيزة، الدقي، ١٢ شارع التحرير',subtotal:341,deliveryFee:52.5,deliveryFeeGross:75,deliveryDiscountPercent:30,deliveryDiscount:22.5,discount:0,total:393.5,merchantCount:3}];
S.mySubOrders=S.myAgentSubOrders.filter(s=>s.parentOrderId==='ORD-DEMO').map(s=>({...s,items:[{productTitle:'منتج',price:s.subtotal,quantity:1}]}));
${fns}
document.body.dataset.role=S.role;
document.getElementById('topbar').innerHTML='<div class="tb-title">'+({cart:'السلة',checkout:'إتمام الطلب',courier:'مهام التوصيل',track:'تفاصيل الطلب'}[view])+'</div>';
document.getElementById('mainContent').innerHTML=({cart:renderCart,checkout:renderCheckout,courier:renderDeliveryDashboard,track:renderOrderDetail})[view]();
</script></body></html>`);
console.log('Generated multi-store review from real render functions, fake data.');
