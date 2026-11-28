// Doorman rules (inside the unpublished v16 file). Needs the Firestore emulator on 127.0.0.1:8092.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,getDoc,getDocs,collection,query,where,writeBatch} from 'firebase/firestore';
const rules=readFileSync(new URL('./firestore.v16.proposed.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-doorman',firestore:{host:'127.0.0.1',port:8092,rules}});
let n=0;const ok=async(p,m)=>{try{await assertSucceeds(p);n++;}catch(e){console.error('FAIL (should work):',m,e.message.slice(0,200));process.exitCode=1;}};
const no=async(p,m)=>{try{await assertFails(p);n++;}catch(e){console.error('FAIL (should be denied):',m);process.exitCode=1;}};
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();const S=(p,id,d)=>setDoc(doc(db,p,id),d);
  await S('users','sup',{role:'ADMIN',adminRole:'SUPER'});await S('users','stf',{role:'ADMIN',adminRole:'STAFF'});
  await S('users','dm',{role:'CUSTOMER',firstName:'bawab',doormanId:'AAAAAA'});await S('users','dm2',{role:'CUSTOMER',firstName:'bawab2',doormanId:'BBBBBB'});
  await S('users','r1',{role:'CUSTOMER',firstName:'r1'});await S('users','r2',{role:'CUSTOMER',firstName:'r2'});await S('users','r3',{role:'CUSTOMER',firstName:'r3'});
  await S('doormen','AAAAAA',{id:'AAAAAA',ownerId:'dm',name:'bawab',status:'ACTIVE'});
  await S('doormen','BBBBBB',{id:'BBBBBB',ownerId:'dm2',name:'bawab2',status:'ACTIVE'});
  await S('doormen','CCCCCC',{id:'CCCCCC',ownerId:'x',name:'off',status:'DISABLED'});
  await S('doormanResidents','r2',{residentId:'r2',doormanId:'AAAAAA',name:'r2',building:'1'});
  await S('doormanResidents','r3',{residentId:'r3',doormanId:'BBBBBB',name:'r3',building:'2'});});
const U=id=>env.authenticatedContext(id).firestore();
// admin assigns
await ok(setDoc(doc(U('sup'),'doormen','DDDDDD'),{id:'DDDDDD',ownerId:'r1',name:'n',status:'ACTIVE'}),'super creates doorman');
await no(setDoc(doc(U('stf'),'doormen','EEEEEE'),{id:'EEEEEE',ownerId:'r1',name:'n',status:'ACTIVE'}),'staff creates doorman');
await no(setDoc(doc(U('r1'),'doormen','FFFFFF'),{id:'FFFFFF',ownerId:'r1',name:'n',status:'ACTIVE'}),'user makes himself doorman');
await ok(updateDoc(doc(U('sup'),'users','r1'),{doormanId:'DDDDDD'}),'super sets users.doormanId');
await no(updateDoc(doc(U('stf'),'users','r3'),{doormanId:'AAAAAA'}),'staff sets doormanId');
await no(updateDoc(doc(U('r3'),'users','r3'),{doormanId:'AAAAAA'}),'user sets own doormanId');
await ok(setDoc(doc(U('sup'),'referralCodes','BW-DDDDDD'),{uid:'r1'}),'super mirrors code');
// resident binding
const bind=(uid,did,extra={})=>{const db=U(uid);const b=writeBatch(db);b.set(doc(db,'doormanResidents',uid),{residentId:uid,doormanId:did,name:uid,phone:'',building:'',floor:'',apt:'',createdAt:1,...extra});b.update(doc(db,'users',uid),{boundDoormanId:did});return b.commit();};
await ok(bind('r1','AAAAAA'),'resident binds to active doorman in one batch');
await no(bind('r1','BBBBBB'),'cannot rebind (already bound)') ;
await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await setDoc(doc(d,'users','r4'),{role:'CUSTOMER'});});
await no(bind('r4','CCCCCC'),'bind to disabled doorman');
await no(bind('r4','ZZZZZZ'),'bind to missing doorman');
await no(bind('dm','AAAAAA'),'doorman binds to himself');
await no(updateDoc(doc(U('r4'),'users','r4'),{boundDoormanId:'AAAAAA'}),'bind without resident doc');
await no(bind('r4','AAAAAA',{extra:1}),'extra field in resident doc');
await ok(bind('r4','AAAAAA'),'second resident binds to the same doorman (many residents)');
await no(setDoc(doc(U('r4'),'doormanResidents','r1'),{residentId:'r1',doormanId:'AAAAAA',name:'x'}),'write resident doc for someone else');
// reads
await ok(getDoc(doc(U('r1'),'doormanResidents','r1')),'resident reads own');
await no(getDoc(doc(U('r1'),'doormanResidents','r2')),'resident reads another resident');
await ok(getDoc(doc(U('dm'),'doormanResidents','r2')),'doorman reads his resident');
await no(getDoc(doc(U('dm'),'doormanResidents','r3')),'doorman reads another doorman resident');
await ok(getDoc(doc(U('sup'),'doormanResidents','r3')),'admin reads');
await ok(getDocs(query(collection(U('dm'),'doormanResidents'),where('doormanId','==','AAAAAA'))),'doorman lists his residents (query)');
await no(getDocs(query(collection(U('r1'),'doormanResidents'),where('doormanId','==','AAAAAA'))),'resident lists residents');
await no(getDocs(query(collection(U('dm'),'doormanResidents'),where('doormanId','==','BBBBBB'))),'doorman lists another doorman residents');
await no(getDocs(collection(U('dm'),'doormanResidents')),'doorman lists all');
// resident edits
await ok(updateDoc(doc(U('r2'),'doormanResidents','r2'),{building:'7',floor:'3',apt:'9'}),'resident edits own location');
await no(updateDoc(doc(U('r2'),'doormanResidents','r2'),{doormanId:'BBBBBB'}),'resident switches doorman');
await no(updateDoc(doc(U('dm'),'doormanResidents','r2'),{building:'8'}),'doorman edits resident doc');
await no(deleteDoc(doc(U('r2'),'doormanResidents','r2')),'resident deletes own');
await ok(deleteDoc(doc(U('sup'),'doormanResidents','r2')),'super deletes');
console.log('passed',n);
await env.cleanup();
