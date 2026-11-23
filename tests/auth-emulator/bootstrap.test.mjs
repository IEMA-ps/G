import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,runTransaction,setDoc} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
const {googleProfile}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../../auth-policy.js',import.meta.url))).toString('base64'));
const env=await initializeTestEnvironment({projectId:'demo-google-auth',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('./published.rules',import.meta.url),'utf8')}});
try{
 const uid='GoogleUserMixedCase12',db=env.authenticatedContext(uid,{email:'google@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 const p=googleProfile({uid,displayName:'اسم اختبار',email:'google@example.test'},{referralCode:'MK-'+uid.toUpperCase(),loyaltyPoints:0},123);
 console.log('PROFILE',JSON.stringify(p));
 await assertSucceeds(getDoc(doc(db,'users',uid)));console.log('PASS missing profile read');
 await assertSucceeds(runTransaction(db,async tx=>{const r=doc(db,'users',uid);const snap=await tx.get(r);if(!snap.exists())tx.set(r,p)}));console.log('PASS exact Google bootstrap transaction with published rules');
 await assertFails(setDoc(doc(db,'users',uid),{...p,role:'ADMIN'}));console.log('PASS self-promotion blocked');
}finally{await env.cleanup()}
