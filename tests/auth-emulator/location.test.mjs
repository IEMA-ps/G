import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const env=await initializeTestEnvironment({projectId:'demo-location-pref',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('./published.rules',import.meta.url),'utf8')}});
try{
 const uid='LocationTest',db=env.authenticatedContext(uid,{email:'location@example.test',email_verified:true}).firestore();
 const user={id:uid,firstName:'تجربة',lastName:'موقع',phone:'01012345678',email:'location@example.test',role:'CUSTOMER',merchantId:null,deliveryAgentId:null,referralCode:'MK-'+uid.toUpperCase(),loyaltyPoints:0,createdAt:123};
 await assertSucceeds(setDoc(doc(db,'users',uid),user));
 await assertSucceeds(updateDoc(doc(db,'users',uid),{preferredLocation:{governorate:'الجيزة',area:'الدقي'}}));
 assert.equal((await getDoc(doc(db,'users',uid))).data().preferredLocation.area,'الدقي');
 const other=env.authenticatedContext('other').firestore();await assertFails(updateDoc(doc(other,'users',uid),{preferredLocation:{governorate:'القاهرة',area:'مدينة نصر'}}));
 await assertFails(updateDoc(doc(db,'users',uid),{role:'ADMIN'}));
 console.log('PASS exact create-user schema then self preference update; other-user location update and self-promotion blocked by supplied published.rules fixture');
}finally{await env.cleanup()}
