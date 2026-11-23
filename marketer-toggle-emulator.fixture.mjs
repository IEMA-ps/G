import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';import {doc,setDoc,getDoc,runTransaction}from'firebase/firestore';import{readFileSync}from'node:fs';import assert from'node:assert/strict';
const env=await initializeTestEnvironment({projectId:'demo-marketer-toggle',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('./firestore.marketer-personal.proposed.rules',import.meta.url),'utf8')}});
try{await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [id,role,adminRole]of[['main','ADMIN','SUPER'],['staff','ADMIN','STAFF'],['customer','CUSTOMER',null],['marketer','MARKETER',null],['merchant','MERCHANT',null],['delivery','DELIVERY',null]])await setDoc(doc(db,'users',id),{role,adminRole});await setDoc(doc(db,'settings','app'),{marketerOfferEnabled:false,useBackend:false,other:'preserved'});});
 const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
 const toggle=(d,value)=>runTransaction(d,async tx=>{const ref=doc(d,'settings','app');await tx.get(ref);tx.update(ref,{marketerProgramEnabled:value});});
 for(const uid of ['staff','customer','marketer','merchant','delivery',null]){await assertFails(toggle(db(uid),true));await assertFails(setDoc(doc(db(uid),'settings','new'),{marketerProgramEnabled:true}));}
 const main=db('main');await assertSucceeds(toggle(main,true));let settings=(await getDoc(doc(main,'settings','app'))).data();assert.deepEqual(settings,{marketerOfferEnabled:false,useBackend:false,other:'preserved',marketerProgramEnabled:true});
 for(const uid of ['staff','customer','marketer','merchant','delivery',null])await assertFails(toggle(db(uid),false));
 await assertSucceeds(toggle(main,false));assert.equal((await getDoc(doc(main,'settings','app'))).data().marketerProgramEnabled,false);
 console.log('PASS staged rules: main-only ON/OFF transactions; staff, customer, marketer, merchant, delivery and anonymous direct/create bypass denied; unrelated flags preserved');
}finally{await env.cleanup();}
