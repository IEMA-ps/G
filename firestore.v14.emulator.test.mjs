// Rules v14 test (MARKETER notifications). Needs the Firestore emulator on 127.0.0.1:8092.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc} from 'firebase/firestore';
const rules=readFileSync(new URL('./firestore.v14.proposed.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-v14',firestore:{host:'127.0.0.1',port:8092,rules}});
let n=0;const ok=async(p,m)=>{try{await assertSucceeds(p);n++;}catch(e){console.error('FAIL (should work):',m,e.message.slice(0,200));process.exitCode=1;}};
const no=async(p,m)=>{try{await assertFails(p);n++;}catch(e){console.error('FAIL (should be denied):',m);process.exitCode=1;}};
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();const S=(p,id,d)=>setDoc(doc(db,p,id),d);
  await S('users','mk1',{role:'MARKETER'});await S('users','mk2',{role:'MARKETER'});await S('users','t1',{role:'MERCHANT',merchantId:'m1'});
  await S('notifications','other',{targetType:'MARKETER',targetId:'mk2',title:'x',message:'y',relatedOrderId:null,isRead:false,createdAt:1});});
const mk=env.authenticatedContext('mk1').firestore(),t1=env.authenticatedContext('t1').firestore();
const note=(tt,tid)=>({targetType:tt,targetId:tid,title:'اشتراك أحد تجارك انتهى',message:'م',relatedOrderId:null,isRead:false,createdAt:5});
await ok(setDoc(doc(mk,'notifications','exp-m1-1-m3'),note('MARKETER','mk1')),'marketer creates own alert (deterministic id)');
await ok(getDoc(doc(mk,'notifications','exp-m1-1-m3')),'marketer reads own');
await no(getDoc(doc(mk,'notifications','other')),'marketer reads another marketer');
await no(getDoc(doc(t1,'notifications','exp-m1-1-m3')),'merchant reads marketer alert');
// تكرار الكتابة بنفس المعرّف (createdAt مختلف) = مرفوض، فمفيش تنبيه مكرر
await no(setDoc(doc(mk,'notifications','exp-m1-1-m3'),{...note('MARKETER','mk1'),createdAt:99}),'duplicate write with new createdAt');
await ok(updateDoc(doc(mk,'notifications','exp-m1-1-m3'),{isRead:true}),'mark read');
await no(updateDoc(doc(mk,'notifications','exp-m1-1-m3'),{title:'غيرت'}),'edit title');
await ok(setDoc(doc(t1,'notifications','exp-m1-2-d7'),note('MERCHANT','m1')),'merchant alert to own store still works');
await no(setDoc(doc(mk,'notifications','bad1'),{...note('SUPERUSER','mk1')}),'unknown target type');
await no(setDoc(doc(mk,'notifications','bad2'),{...note('MARKETER','mk1'),extra:1}),'extra field');
console.log('passed',n);
await env.cleanup();
