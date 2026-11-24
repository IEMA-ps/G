// Offline UI and consent behavior tests. No Firebase calls or real accounts.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {extname,join} from 'node:path';
import assert from 'node:assert/strict';
const source=readFileSync('index.html','utf8');
const auth=source.slice(source.indexOf('const Auth = {'),source.indexOf('window.Auth = Auth;')+'window.Auth = Auth;'.length);
const head=source.slice(source.indexOf('<head>')+6,source.indexOf('</head>')).replace(/<script[\s\S]*?<\/script>/g,'');
const body=source.slice(source.indexOf('<body>')+6,source.indexOf('<script type="module">'));
const preview=`<!doctype html><html lang="ar" dir="rtl"><head>${head}</head><body>${body}<script type="module">
import * as TermsConsent from '/terms-consent.js';
import {locationPicker,installLocations} from '/egypt-locations.js';
import {passwordChecklist} from '/password-policy.js';
installLocations();document.getElementById('regLocation').innerHTML=locationPicker('regLoc',{required:true});
const auth={currentUser:null};let creates=0;
const createUserWithEmailAndPassword=async()=>{creates++;throw Error('OFFLINE_TEST_STOP')};
const INTERNAL_EMAIL=/@users.alababak.app$/;const passwordError=()=>'';const UI={toast(){}};
${auth}
window.creates=()=>creates;window.askGoogleConsent=TermsConsent.askGoogleConsent;
window.updatePasswordChecklist=(input,id)=>document.getElementById(id).innerHTML=passwordChecklist(input.value);
document.getElementById('loadingScreen').classList.add('hidden');document.getElementById('authScreen').classList.remove('hidden');Auth.switchTab('register');
</script></body></html>`;
const server=createServer((req,res)=>{try{const path=req.url.split('?')[0];res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'text/html');res.end(path==='/review'?preview:readFileSync(join(process.cwd(),path)));}catch{res.writeHead(404);res.end();}}).listen(8193,'127.0.0.1');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=name=>page.screenshot({path:(process.env.SCREENSHOT_DIR||'/downloads')+'/'+name+'.png',fullPage:false});
try{
 await page.goto('http://127.0.0.1:8193/review');await page.waitForFunction(()=>!!window.Auth);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('#regTerms').isChecked(),false);
 await page.evaluate(()=>Auth.register({preventDefault(){}}));assert.equal(await page.evaluate(()=>creates()),0);assert.match(await page.locator('#authError').innerText(),/لازم توافق/);
 await page.locator('#regFirst').fill('حساب معاينة');await page.locator('#regEmail').fill('review@example.test');
 await page.locator('#regTerms').scrollIntoViewIfNeeded();await shot('terms-signup-mobile');
 const [termsTab]=await Promise.all([page.waitForEvent('popup'),page.locator('label[for=regTerms] a').click()]);await termsTab.waitForLoadState();assert.equal(await page.locator('#regFirst').inputValue(),'حساب معاينة');assert.equal(await page.locator('#regTerms').isChecked(),false);await termsTab.close();
 await page.locator('#regTerms').check();assert.equal(await page.locator('#regTerms').isChecked(),true);
 await page.evaluate(()=>{window.consentResult=null;askGoogleConsent().then(v=>window.consentResult=v)});assert.equal(await page.locator('#googleTermsAccept').isDisabled(),true);await shot('terms-google-mobile');
 await page.locator('#googleTerms').check();await page.locator('#googleTermsAccept').click();assert.equal(await page.evaluate(()=>window.consentResult),true);
 await page.evaluate(()=>{window.consentResult=null;askGoogleConsent().then(v=>window.consentResult=v)});assert.equal(await page.locator('#googleTerms').isChecked(),false);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.consentResult),false);
 await page.goto('http://127.0.0.1:8193/terms.html');await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('section').count(),9);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await shot('terms-page-mobile');
 await page.locator('#marketer').scrollIntoViewIfNeeded();await shot('terms-marketer-mobile');
 await page.setViewportSize({width:1366,height:900});await page.evaluate(()=>scrollTo(0,0));await shot('terms-page-desktop');
 const terms=await page.locator('body').innerText();assert.doesNotMatch(terms,/\b01\d{9}\b|القسم الرابع|قواعد الجروب|حافز الـ/);assert.match(terms,/مش إعلان عن تفعيل/);
 assert.deepEqual(errors,[]);console.log('PASS: unchecked email gate, new-tab preserves form, Google accept/cancel/reset, nine sections, 390px no overflow, desktop/mobile screenshots. Offline only.');
}finally{await browser.close();server.close();}
