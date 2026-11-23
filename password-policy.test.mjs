import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const policy=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('password-policy.js')).toString('base64'));
for(const value of ['',null,'Abc1234','abcdefgh','ABCDEFGH','12345678','Abcdefgh','Abcdefg١'])assert.notEqual(policy.passwordError(value),'');
for(const value of ['Abcdef12','Abcdef12!',' Abcdef1','عAbcdef12'])assert.equal(policy.passwordError(value),'');
assert.match(policy.passwordError('abcdefgh'),/كبير/);assert.match(policy.passwordError('ABCDEFGH'),/صغير/);assert.match(policy.passwordError('Abcdefgh'),/رقم/);assert.doesNotMatch(policy.passwordChecklist('<img>'),/<img>/);
const html=readFileSync('index.html','utf8');
const authCode=html.slice(html.indexOf('const Auth = {'),html.indexOf('window.Auth = Auth;')+'window.Auth = Auth;'.length);
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',focus(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
let created=0,reauth=0,updated=0;
const ctx={EgyptLocations:{read:()=>({governorate:"الجيزة",area:"الدقي"})},getDoc:async()=>({exists:()=>false}),doc:()=>({}),db:{},bootAuthUser:async()=>{},window:{},document:{getElementById:el},auth:{currentUser:null},Date,Math,console,passwordError:policy.passwordError,PASSWORD_HINT:policy.PASSWORD_HINT,INTERNAL_EMAIL:/@users\.alababak\.app$/i,createUserWithEmailAndPassword:async()=>{created++;throw {code:'test-stop'}},UI:{toast(){},closeModal(){},openModal:s=>ctx.modal=s},EmailAuthProvider:{credential:(e,p)=>({email:e,password:p})},reauthenticateWithCredential:async(u,c)=>{reauth++;assert.equal(c.password,'oldshort')},updatePassword:async(u,p)=>{updated++;assert.equal(p,'Abcdef12')},passwordChecklist:policy.passwordChecklist,generateAccountPassword:()=>'',modal:''};
vm.createContext(ctx);vm.runInContext(authCode,ctx);
el('regEmail').value='new@example.test';el('regPassword').value='weak';await ctx.window.Auth.register({preventDefault(){}});assert.equal(created,0);assert.match(el('authError').textContent,/كلمة المرور محتاجة/);assert.equal(el('registerBtn').disabled,false);
el('regPassword').value='Abcdef12';await ctx.window.Auth.register({preventDefault(){}});assert.equal(created,1);
ctx.auth.currentUser={email:'old@example.test'};vm.runInContext(html.slice(html.indexOf('window.generateAccountPassword='),html.indexOf('window.openLinkMerchantUser =')),ctx);
el('cpOld').value='oldshort';el('cpNew').value='Abcdefgh';await ctx.window.saveChangePassword();assert.equal(reauth,0);assert.equal(updated,0);assert.match(el('cpError').textContent,/رقم/);
el('cpNew').value='Abcdef12';await ctx.window.saveChangePassword();assert.equal(reauth,1);assert.equal(updated,1);
assert.match(html,/autocomplete="new-password"/);assert.match(html,/minlength="8"/);assert.doesNotMatch(html,/6 أحرف على الأقل/);
console.log('PASS8+ uppercase/lowercase/digit, symbols optional, Arabic errors, signup rejects before account creation, change rejects before reauth/update, old password accepted for reauth unchanged');
if(process.argv.includes('--preview')){
 const styles=html.match(/<style>([\s\S]*?)<\/style>/)[1]+readFileSync('brand.css','utf8');
 const head=`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"><style>${styles}body{margin:0;padding:16px 14px}.preview{max-width:480px;margin:auto}.preview-note{font-size:11px;color:var(--ink-soft)}.modal-sheet{max-height:none!important;position:relative}</style><body><main class="preview"><p class="preview-note">معاينة للمراجعة · لا حسابات أو كلمات مرور حقيقية</p>`;
 const reg=html.slice(html.indexOf('<div class="field"><label>كلمة المرور</label><input type="password" id="regPassword"'),html.indexOf('<div class="field"><label>كلمة المرور</label><input type="password" id="regPassword"')+2000).split('\n')[0].replace('<div id="regPasswordChecks"></div>',`<div id="regPasswordChecks">${policy.passwordChecklist('Examplex')}</div>`);
 writeFileSync('/downloads/password-signup-preview.html',head+`<section class="card"><h2>حساب جديد</h2><p style="font-size:13px">كمّل بياناتك واختار كلمة مرور قوية</p>${reg}<p class="password-error">${policy.passwordError('Examplex')}</p><button class="btn btn-primary">إنشاء حساب</button></section></main></body></html>`);
 ctx.window.openChangePassword();
 const modal=ctx.modal.replace(policy.passwordChecklist(''),policy.passwordChecklist('example1')).replace('<p id="cpError" class="password-error" role="alert"></p>',`<p id="cpError" class="password-error" role="alert">${policy.passwordError('example1')}</p>`);
 writeFileSync('/downloads/password-change-preview.html',head+`<section class="modal-sheet">${modal}</section></main></body></html>`);
}
