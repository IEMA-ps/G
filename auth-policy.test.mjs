import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const policy = await import('data:text/javascript;base64,'+Buffer.from(readFileSync('auth-policy.js')).toString('base64'));
const {needsEmailVerification:n,googleProfile:g,googleError:e}=policy;
const start='2026-12-01T00:00:00Z';
const old={email:'old@example.test',metadata:{creationTime:'2026-11-01T00:00:00Z'}};
const fresh={email:'new@example.test',metadata:{creationTime:'2026-12-02T00:00:00Z'}};
assert.equal(n(old,start),false); assert.equal(n(fresh,start),true);
assert.equal(n(fresh),false); assert.equal(n({...fresh,emailVerified:true},start),false);
assert.equal(n({...fresh,email:'old@users.alababak.app'},start),false);
assert.equal(n({email:'missing@example.test'},start),true);
const profile=g({uid:'same-uid',displayName:'اسم تجربة',email:'test@example.test'}, {referralCode:'MK-SAME',loyaltyPoints:0},123);
assert.equal(profile.role,'CUSTOMER');assert.equal(profile.id,'same-uid');assert.equal(profile.firstName,'اسم');
assert.match(e('auth/account-exists-with-different-credential'),/الطريقة الأصلية/);
assert.match(e('auth/popup-blocked'),/منع/); assert.match(e('auth/unauthorized-domain'),/عنوان الموقع/);
const html=readFileSync('index.html','utf8');
const authCode=html.slice(html.indexOf('const Auth = {'),html.indexOf('window.Auth = Auth;')+'window.Auth = Auth;'.length);
const elements=new Map(); const el=id=>{if(!elements.has(id)) elements.set(id,{disabled:false,value:'',textContent:'',classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
let sends=0,reloads=0,tokenRefreshes=0,boots=0,throwSend=false,popupError=null;
const user={uid:'u',email:'u@example.test',emailVerified:false,getIdToken:async force=>{assert.equal(force,true);tokenRefreshes++}};
const ctx={window:{},document:{getElementById:el},auth:{currentUser:user},Date,Math,console,
 sendEmailVerification:async()=>{sends++;if(throwSend)throw Error('network')},
 reload:async()=>{reloads++},bootAuthUser:async()=>{boots++},GoogleAuthProvider:class{},
 signInWithPopup:async()=>{if(popupError)throw {code:popupError}},googleError:e};
vm.createContext(ctx);vm.runInContext(authCode,ctx);const A=ctx.window.Auth;
await A.sendVerification();assert.equal(sends,1);assert.match(A.verificationNotice,/بعتنا/);
await A.sendVerification();assert.equal(sends,1);assert.match(A.verificationNotice,/استنى/);
A.verificationSentAt=0;throwSend=true;await A.sendVerification();assert.match(A.verificationNotice,/تعذّر/);assert.equal(el('verifyResendBtn').disabled,false);
await A.checkEmail();assert.equal(boots,0);assert.equal(reloads,1);
user.emailVerified=true;await A.checkEmail();assert.equal(boots,1);assert.equal(tokenRefreshes,1);
popupError='auth/popup-blocked';await A.googleLogin();assert.match(el('authError').textContent,/منع/);assert.equal(el('googleLoginBtn').disabled,false);
assert.match(html,/if\(Auth.registering \|\| Auth.googleBusy\) return;/);
assert.match(html,/if\(Auth.googleBusy \|\| Auth.registering \|\| Auth.loginBusy\) return;/);
assert.match(html,/if\(!existing.exists\(\)\) tx.set/);
assert.doesNotMatch(html,/localStorage.*accessToken/);
// Exercise the actual boot function with a minimal, isolated Firestore mock.
const bootCode=html.slice(html.indexOf('async function bootAuthUser(user)'),html.indexOf('onAuthStateChanged(auth, async user=>'));
let stored, writes=0;
const snap=()=>({exists:()=>!!stored,data:()=>stored});
const bootCtx={...ctx,URLSearchParams,authEpoch:0,clearSubs(){},resetSession(){},showSignedOut(){},S:{},needsEmailVerification:()=>false,
 TermsConsent:{askGoogleConsent:async()=>true,TERMS_VERSION:'2026-11-24'},serverTimestamp:()=>123,UI:{toast(){}},db:{},doc:()=>({}),getDoc:async()=>snap(),runTransaction:async(db,fn)=>fn({get:async()=>snap(),set:(ref,p)=>{stored=p;writes++}}),
 googleProfile:g,userDefaults:()=>({}),nowMs:()=>123,updateDoc:async()=>{},loadCart(){},loadWishlist(){},
 location:{pathname:'/',search:''},routeFromLocation:()=>null,routeURL:()=>'/customer/home',defaultTabForRole:()=> 'home',history:{replaceState(){}},subscribeShared(){},subscribeAdmin(){},renderShell(){},Auth:A};
vm.createContext(bootCtx);vm.runInContext(bootCode,bootCtx);
const googleUser={uid:'u',email:'u@example.test',providerData:[{providerId:'google.com'}]};
bootCtx.auth.currentUser=googleUser;stored={id:'u',role:'ADMIN',balance:500};
await bootCtx.bootAuthUser(googleUser);assert.equal(writes,0);assert.equal(stored.role,'ADMIN');assert.equal(stored.balance,500);assert.equal(bootCtx.S.role,'admin');
stored=null;bootCtx.subscribeCustomer=()=>{};await bootCtx.bootAuthUser(googleUser);assert.equal(writes,1);assert.equal(stored.id,'u');assert.equal(stored.role,'CUSTOMER');
stored=null;const passwordUser={...googleUser,providerData:[{providerId:'password'}]};bootCtx.auth.currentUser=passwordUser;
await assert.rejects(bootCtx.bootAuthUser(passwordUser),/profile-needs-admin-repair/);assert.equal(writes,1);
const diagnostics=policy.accountLoadError;
assert.equal(diagnostics(new Error('profile-needs-admin-repair')).code,'profile-needs-admin-repair');
assert.match(diagnostics(new Error('profile-needs-admin-repair')).message,/مش كاملة/);
assert.equal(diagnostics(new Error('private details')).code,'unexpected');
assert.match(diagnostics({code:'permission-denied',bootStage:'profile-create'}).message,/إنشاء بيانات الحساب/);
assert.match(diagnostics({code:'unavailable',bootStage:'profile-read'}).message,/نتصل/);
assert.equal(diagnostics({code:'secret-unknown',bootStage:'unsafe'}).code,'unexpected');
assert.equal(diagnostics({code:'secret-unknown',bootStage:'unsafe'}).stage,'unknown');
bootCtx.auth.currentUser=googleUser;bootCtx.getDoc=async()=>{throw {code:'permission-denied'}};
await assert.rejects(bootCtx.bootAuthUser(googleUser),x=>x.bootStage==='profile-read' && x.code==='permission-denied');
bootCtx.getDoc=async()=>snap();stored=null;bootCtx.runTransaction=async()=>{throw {code:'unavailable'}};
await assert.rejects(bootCtx.bootAuthUser(googleUser),x=>x.bootStage==='profile-create' && x.code==='unavailable');
// Canceling terms for a new Google profile must never write a profile or attribution.
let consentAsked=0,signouts=0;
bootCtx.getDoc=async()=>snap();stored=null;
bootCtx.TermsConsent.askGoogleConsent=async()=>{consentAsked++;return false;};
bootCtx.signOut=async()=>{signouts++;};
await bootCtx.bootAuthUser(googleUser);assert.equal(consentAsked,1);assert.equal(signouts,1);assert.equal(writes,1);
// Existing users must not be prompted or have consent backfilled silently.
stored={id:'u',role:'CUSTOMER'};await bootCtx.bootAuthUser(googleUser);assert.equal(consentAsked,1);
console.log('PASS: Auth policy/UI, profile preservation and stage diagnostics, no external requests');
