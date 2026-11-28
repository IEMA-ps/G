// sw.js: ملفات ?v= بتتخدم من الكاش فورًا، والصفحة والملفات من غير ?v= فاضلة network-first.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./sw.js',import.meta.url),'utf8');
const store=new Map(),fetched=[];let handler;let offline=false;
const cache={match:async r=>store.get(typeof r==='string'?r:r.url),put:async(r,res)=>{store.set(typeof r==='string'?r:r.url,res);},addAll:async()=>{}};
const self_={location:{origin:'https://x.test'},addEventListener:(t,f)=>{if(t==='fetch')handler=f;},skipWaiting(){},clients:{claim(){}}};
globalThis.self=self_;globalThis.caches={open:async()=>cache,match:async r=>store.get(r.url),keys:async()=>[],delete:async()=>{}};
globalThis.fetch=async(r)=>{fetched.push(r.url);if(offline)throw new Error('off');return {ok:true,body:'net:'+r.url,clone(){return this;}};};
globalThis.Request=class{constructor(u){this.url=u;}};
new Function(src)();
const run=async(path,mode='cors')=>{let p;const waits=[];handler({request:{url:'https://x.test'+path,method:'GET',mode},respondWith:x=>{p=x;},waitUntil:x=>waits.push(x)});const res=p?await p:null;await Promise.all(waits);return res;};
// أول مرة: من الشبكة وبتتخزن
let r=await run('/store-types.js?v=types-5');assert.equal(r.body,'net:https://x.test/store-types.js?v=types-5');assert.ok(store.has('https://x.test/store-types.js?v=types-5'));
// تاني مرة: من الكاش، والتحديث في الخلفية
fetched.length=0;store.set('https://x.test/store-types.js?v=types-5',{ok:true,body:'cached'});
r=await run('/store-types.js?v=types-5');assert.equal(r.body,'cached');assert.equal(fetched.length,1);
// أوفلاين: من الكاش برضه
assert.equal(store.get('https://x.test/store-types.js?v=types-5').body,'net:https://x.test/store-types.js?v=types-5');store.set('https://x.test/store-types.js?v=types-5',{ok:true,body:'cached'});
offline=true;r=await run('/store-types.js?v=types-5');assert.equal(r.body,'cached');offline=false;
// نسخة تانية (?v= اتغيرت): من الشبكة
r=await run('/store-types.js?v=types-6');assert.equal(r.body,'net:https://x.test/store-types.js?v=types-6');
// من غير ?v=: network-first (من الشبكة حتى لو في كاش)
store.set('https://x.test/doorman.js',{ok:true,body:'old'});r=await run('/doorman.js');assert.equal(r.body,'net:https://x.test/doorman.js');
// الصفحة نفسها network-first
store.set('/index.html',{ok:true,body:'oldhtml'});r=await run('/','navigate');assert.equal(r.body,'net:https://x.test/');
// ملف مش في SHELL: مفيش تدخل
assert.equal(await run('/nope.js?v=1'),null);
// الصيغة الغريبة في ?v= مش بتدخل في الكاش-أولًا
fetched.length=0;store.set('https://x.test/store-types.js?v=a&b=1',{ok:true,body:'c'});r=await run('/store-types.js?v=a&b=1');assert.equal(r.body,'net:https://x.test/store-types.js?v=a&b=1');
console.log('sw-versioned tests passed');
