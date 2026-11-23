import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';
const require=createRequire(new URL('./catalog-emulator.package.json',import.meta.url));const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');const {doc,setDoc,updateDoc,getDoc,getDocs,collection,query,where}=require('firebase/firestore');
import {offerData} from './shared-catalog.js';
const env=await initializeTestEnvironment({projectId:'demo-shared-catalog',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.shared-catalog.proposed.rules','utf8')}});
let passed=0;async function ok(p){await assertSucceeds(p);passed++}async function no(p){await assertFails(p);passed++}
const base={sku:'rice-1',title:'أرز أبيض',description:'',unit:'كيلو',barcode:'',categoryId:'c',source:'Supplier',rightsConfirmed:true,isActive:true,version:1,updatedAt:1,updatedBy:'admin'};
try{
await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [id,data] of Object.entries({admin:{role:'ADMIN'},staff:{role:'ADMIN',adminRole:'STAFF'},owner:{role:'MERCHANT',merchantId:'m'},other:{role:'MERCHANT',merchantId:'n'},customer:{role:'CUSTOMER'}}))await setDoc(doc(db,'users',id),data);await setDoc(doc(db,'settings','app'),{subsEnforced:false});await setDoc(doc(db,'categories','c'),{isActive:true});for(const [id,uid] of [['m','owner'],['n','other']])await setDoc(doc(db,'merchants',id),{id,ownerId:uid,status:'ACTIVE'});});
const db=id=>env.authenticatedContext(id).firestore(),ref=(id,path)=>doc(db(id),...path.split('/'));
await ok(setDoc(ref('admin','catalogProducts/rice-1'),base));
await no(setDoc(ref('staff','catalogProducts/rice-2'),{...base,sku:'rice-2',updatedBy:'staff'}));
await no(setDoc(ref('owner','catalogProducts/rice-2'),{...base,sku:'rice-2',updatedBy:'owner'}));
await no(setDoc(ref('admin','catalogProducts/bad'),{...base,sku:'bad',rightsConfirmed:false}));
await no(getDoc(ref('customer','catalogProducts/rice-1')));
await no(getDoc(doc(env.unauthenticatedContext().firestore(),'catalogProducts','rice-1')));
await ok(getDocs(query(collection(db('owner'),'catalogProducts'),where('isActive','==',true))));
await no(getDocs(collection(db('owner'),'catalogProducts')));
const offer=offerData(base,'m',22,4),path='products/'+offer.id;
await ok(setDoc(ref('owner',path),offer));
await no(setDoc(ref('other',path),{...offer,price:25}));
await no(setDoc(ref('owner','products/duplicate'),{...offer,id:'duplicate'}));
await no(updateDoc(ref('owner',path),{merchantId:'n'}));
await no(updateDoc(ref('owner',path),{catalogId:'other'}));
await no(updateDoc(ref('owner',path),{price:-10}));
await no(updateDoc(ref('owner',path),{price:2.001}));
await no(updateDoc(ref('customer',path),{price:1}));
await ok(updateDoc(ref('owner',path),{price:25.25,stock:8,isActive:false}));
await ok(updateDoc(ref('admin','catalogProducts/rice-1'),{isActive:false,version:2}));
await no(setDoc(ref('other','products/catalog_n_rice-1'),{...offer,id:'catalog_n_rice-1',merchantId:'n'}));
await no(getDoc(ref('owner','catalogProducts/rice-1')));
await ok(updateDoc(ref('owner',path),{price:26,isActive:true}));
await no(updateDoc(ref('admin','catalogProducts/rice-1'),{version:2}));
console.log(`PASS ${passed} emulator permission assertions. Existing legacy stock-only writes are not changed by this feature.`);
}finally{await env.cleanup();}
