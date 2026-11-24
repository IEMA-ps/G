// Offline visual check of the REAL checkout/cart functions from index.html with fake data. No Firebase, no writes.
// Run from repo root: SCREENSHOT_DIR=/tmp node money-ui.browser.test.mjs
import {chromium} from 'playwright-core';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const src=readFileSync('index.html','utf8');
function take(start){ // function text up to its matching closing brace
  const i=src.indexOf(start); assert.ok(i>=0,start); let d=0,j=src.indexOf('{',src.indexOf(')',i)+0);
  for(let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(d===0) return src.slice(i,k+1);} }
}
const fns=['function cartLines(){','function cartTotal(){','function refreshDiscounts(){','window.setCartQty = (pid, qty)=>{','function renderCheckout(){','function renderCart(){']
  .map(take).join('\n');
const style=src.match(/<style>([\s\S]*?)<\/style>/)[1];
const page_html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><div id="appRoot"><main id="mainContent" style="padding:14px;max-width:760px;margin:auto"></main></div><script type="module">
import * as OrderMoney from '/order-money.js';
window.OrderMoney=OrderMoney;
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
const fmtMoney=n=>(Math.round((n||0)*100)/100).toLocaleString('ar-EG')+' ج.م';
const roundMoney=n=>Math.round((n||0)*100)/100;
const effPrice=p=>p.price; const getProduct=id=>S.products.find(p=>p.id===id); const getMerchant=id=>({id,businessName:'متجر الاختبار'});
const saveCart=()=>{}; const renderShell=()=>{}; const UI={toast:m=>{window.toasts.push(m)}}; window.toasts=[];
const cartMerchantCount=()=>1; const emptyState=(a,b)=>b; const paymentLabel=()=>'كاش عند الاستلام';
const PAYMENT_METHODS=[{id:'COD',label:'كاش عند الاستلام',enabled:true}];
const S=window.S={settings:{defaultDeliveryFee:20,loyaltyRedeemValue:1,loyaltyEnabled:true},profile:{loyaltyPoints:0},
 products:[{id:'big',title:'طقم أواني طهي',price:900,merchantId:'m',stock:9},{id:'small',title:'منظف أطباق',price:100,merchantId:'m',stock:9}],
 cart:[{productId:'big',quantity:1},{productId:'small',quantity:1}],myAddresses:[{_id:'a',label:'المنزل',isDefault:true,fullAddressText:'الشيخ زايد'}],appliedCoupon:null,appliedPoints:null,tab:'checkout'};
${fns}
window.renderMain=()=>{document.getElementById('mainContent').innerHTML=S.tab==='cart'?renderCart():renderCheckout();};
window.renderMain();
</script></body></html>`;
import {createServer} from 'node:http'; import {join,extname} from 'node:path';
const server=createServer((req,res)=>{const u=req.url.split('?')[0];if(u==='/'){res.setHeader('Content-Type','text/html');return res.end(page_html);}
 try{const b=readFileSync(join(process.cwd(),u));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css'})[extname(u)]||'application/octet-stream');res.end(b);}catch{res.writeHead(404);res.end();}}).listen(8192,'127.0.0.1');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const dir=process.env.SCREENSHOT_DIR||'/tmp';const errors=[];
try{
 for(const [w,h,tag] of [[390,844,'390'],[1280,900,'1280']]){
  const page=await browser.newPage({viewport:{width:w,height:h}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8192/');await page.waitForFunction(()=>typeof window.renderMain==='function');
  // 50% coupon (min 0) + 500 points on a 1000 cart, as if applied at checkout
  await page.evaluate(()=>{S.profile.loyaltyPoints=500;S.appliedCoupon={code:'SAVE50',discount:500,def:{isActive:true,type:'PERCENT',value:50,minOrderAmount:0}};S.appliedPoints={points:500,discount:500};renderMain();});
  const before=await page.locator('.summary-row.total').last().innerText();
  await page.screenshot({path:`${dir}/money-before-${tag}.png`,fullPage:true});
  // customer goes back to the cart and removes the big product
  await page.evaluate(()=>{setCartQty('big',0);S.tab='checkout';renderMain();});
  const after=await page.locator('.summary-row.total').last().innerText();
  const state=await page.evaluate(()=>({c:S.appliedCoupon&&S.appliedCoupon.discount,p:S.appliedPoints&&S.appliedPoints.points,toasts:window.toasts}));
  await page.screenshot({path:`${dir}/money-after-${tag}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),w,'overflow '+w);
  console.log(tag,'before:',before.replace(/\s+/g,' '),'| after:',after.replace(/\s+/g,' '),JSON.stringify(state));
  // coupon is now 50% of 100 = 50, points capped to what is left (70) -> total 0 but never from a stale 500 discount
  assert.equal(state.c,50);assert.equal(state.p,70);
  assert.ok(await page.locator('text=خصم الكوبون').count()===1);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS money UI: discounts recomputed from the current cart at 390px and 1280px');
}finally{await browser.close();server.close();}
