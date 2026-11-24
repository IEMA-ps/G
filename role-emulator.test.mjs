// Role-by-role run of the REAL app against the Firebase emulators (Auth + Firestore, repo copy of the published rules).
// Never touches production: the app only connects to emulators on localhost with ?emulator=1.
// Run: SCREENSHOT_DIR=/tmp/shots firebase emulators:exec --config role-emulator.firebase.json --only auth,firestore --project ala-babk 'node role-emulator.test.mjs'
import {chromium} from 'playwright-core';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc} from 'firebase/firestore';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {extname,join} from 'node:path';
import assert from 'node:assert/strict';
const AP=9199, FP=8180, PORT=8195, DIR=process.env.SCREENSHOT_DIR||'/tmp', DOMAIN='users.alababak.app', PASS='Test1234pass';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);let f=join(process.cwd(),p);
 if(p==='/'||!existsSync(f)||statSync(f).isDirectory()) f=join(process.cwd(),'index.html');
 res.setHeader('Content-Type',types[extname(f)]||'application/octet-stream');res.end(readFileSync(f));}).listen(PORT,'127.0.0.1');
const signUp=async name=>{const r=await fetch(`http://127.0.0.1:${AP}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${name}@${DOMAIN}`,password:PASS,returnSecureToken:true})});const j=await r.json();assert.ok(j.localId,JSON.stringify(j));return j.localId;};
const names=['rcustomer','rmerchant','rcourier','rmarketer','radmin'];
const uids={};for(const n of names) uids[n]=await signUp(n);
const env=await initializeTestEnvironment({projectId:'ala-babk',firestore:{host:'127.0.0.1',port:FP,rules:readFileSync('role-emulator.published.rules','utf8')}});
const now=Date.now(),year=365*86400000;
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();const put=(p,id,d)=>setDoc(doc(db,p,id),d);
 const user=(n,role,extra={})=>put('users',uids[n],{id:uids[n],firstName:'اختبار',lastName:n,phone:'01000000000',email:`${n}@${DOMAIN}`,role,referralCode:'MK-'+uids[n].toUpperCase(),loyaltyPoints:0,createdAt:now,...extra});
 await put('settings','app',{appNameArabic:'على بابك',defaultDeliveryFee:20,platformCommissionPercent:10,loyaltyEnabled:true,loyaltyRedeemValue:1,loyaltyEarnRate:0.1,referralBonusPoints:50,subsEnforced:false});
 await put('categories','c1',{id:'c1',name:'سوبر ماركت',iconEmoji:'🛒',isActive:true,sortOrder:1});
 await put('merchants','m1',{id:'m1',businessName:'متجر الاختبار',status:'ACTIVE',ownerId:uids.rmerchant,whatsappNumber:'01000000001',subscriptionModel:'MERCHANT_V2',subPlanType:'ORDERING',subEndsAt:now+year,governorate:'الجيزة',area:'الشيخ زايد',createdAt:now});
 await put('products','p1',{id:'p1',merchantId:'m1',categoryId:'c1',title:'منتج اختبار ١',price:100,stock:10,isActive:true,description:'وصف',createdAt:now});
 await put('products','p2',{id:'p2',merchantId:'m1',categoryId:'c1',title:'منتج اختبار ٢',price:50,stock:10,isActive:true,description:'وصف',createdAt:now});
 await put('deliveryAgents','d1',{id:'d1',name:'مندوب اختبار',phone:'01000000002',ownerId:uids.rcourier,isActive:true,status:'ACTIVE',createdAt:now});
 await user('rcustomer','CUSTOMER');await user('rmerchant','MERCHANT',{merchantId:'m1'});await user('rcourier','DELIVERY',{deliveryAgentId:'d1'});
 await user('rmarketer','MARKETER');await user('radmin','ADMIN',{adminRole:'SUPER'});
});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const report=[];let failed=0;
const noise=/favicon|fonts\.g|google-analytics|googletagmanager|ERR_|net::|Failed to load resource/i;
try{
 for(const [name,role] of [['rcustomer','customer'],['rmerchant','merchant'],['rcourier','delivery'],['rmarketer','marketer'],['radmin','admin']]){
  for(const [w,h] of [[390,844],[1280,900]]){
   const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();const errs=[];
   page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'&&!noise.test(m.text()))errs.push('console: '+m.text())});
   await page.goto(`http://127.0.0.1:${PORT}/login?emulator=1&authPort=${AP}&fsPort=${FP}`);
   await page.waitForSelector('#loginEmail',{state:'visible',timeout:20000});
   await page.fill('#loginEmail',name);await page.fill('#loginPassword',PASS);await page.click('#loginBtn');
   let ok=true;try{await page.waitForFunction(r=>window.S&&window.S.role===r&&document.querySelector('#mainContent')&&document.querySelector('#mainContent').innerText.trim().length>20,role,{timeout:15000});}catch(e){ok=false;}
   await page.waitForTimeout(1500);
   await page.screenshot({path:`${DIR}/role-${role}-${w}.png`});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   const row={role,w,loggedIn:ok,overflow,errors:errs};report.push(row);if(!ok||errs.length) failed++;
   console.log(JSON.stringify(row));await ctx.close();
  }
 }
}finally{await browser.close();server.close();await env.cleanup();}
console.log(failed?`FAIL ${failed} role/viewport runs had problems`:'PASS all roles signed in with no console errors');
process.exit(failed?1:0);
