import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';
const require=createRequire(new URL('./catalog-emulator.package.json',import.meta.url));const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');const {doc,setDoc,getDocs,getDoc,collection,updateDoc,deleteDoc}=require('firebase/firestore');
const env=await initializeTestEnvironment({projectId:'demo-admin-report',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.admin-report.proposed.rules','utf8')}});let assertions=0;
const ok=async p=>{await assertSucceeds(p);assertions++;},no=async p=>{await assertFails(p);assertions++;};
try{await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [id,role,adminRole]of [['main','ADMIN','SUPER'],['staff','ADMIN','STAFF'],['customer','CUSTOMER',''],['marketer','MARKETER','']])await setDoc(doc(db,'users',id),{role,adminRole});await setDoc(doc(db,'settings','app'),{marketerProgramEnabled:false});await setDoc(doc(db,'signupAttributions','customer'),{id:'customer',referrerId:'marketer',code:'MK-TEST'});});
const db=id=>env.authenticatedContext(id).firestore();
await ok(getDocs(collection(db('main'),'signupAttributions')));await ok(getDoc(doc(db('main'),'signupAttributions','customer')));
for(const id of ['staff','customer','marketer'])await no(getDocs(collection(db(id),'signupAttributions')));
await no(getDocs(collection(env.unauthenticatedContext().firestore(),'signupAttributions')));
await no(updateDoc(doc(db('main'),'signupAttributions','customer'),{referrerId:'other'}));await no(deleteDoc(doc(db('main'),'signupAttributions','customer')));await no(setDoc(doc(db('main'),'signupAttributions','new'),{id:'new',referrerId:'main',code:'X'}));
await ok(getDocs(collection(db('staff'),'users')));await no(updateDoc(doc(db('staff'),'settings','app'),{marketerProgramEnabled:true}));
console.log(`PASS ${assertions} emulator assertions: main-admin reads while incentive switch OFF; staff/customer/marketer/anonymous denied; immutable records and sensitive settings stay locked.`);
}finally{await env.cleanup();}
