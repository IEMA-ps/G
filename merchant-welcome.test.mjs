import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const MerchantPlans=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('merchant-plans.js')).toString('base64'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let modal='';
const S={myMerchant:{businessName:'IEMA Stor',status:'ACTIVE',subscriptionModel:MerchantPlans.MODEL},mySubs:[],settings:{merchantPlansV2:true,marketerOfferEnabled:false},plans:MerchantPlans.PLAN_TEMPLATES.map(p=>({...p,_id:p.id}))};
const ctx={S,MerchantPlans,esc,fmtMoney:n=>n+' ج.م',subOk:m=>!!m?.subEndsAt&&m.subEndsAt>Date.now(),window:{},UI:{openModal:s=>modal=s,toast:()=>{}},emptyState:()=>'',fmtDay:()=>''};vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('// Used only when'),html.indexOf('/* ===== 3 خطوات')),ctx);
vm.runInContext(html.slice(html.indexOf('window.openSubscribe ='),html.indexOf('window.submitSubscription =')),ctx);
let welcome=ctx.merchantPaywall();assert.match(welcome,/IEMA Stor/);assert.match(welcome,/go\('m_subscription'\)/);for(const n of [200,400,600,800,1200])assert.ok(welcome.includes(n+' ج.م'));assert.doesNotMatch(welcome,/300 ج.م|عرض كود/);assert.match(welcome,/المسلّمة فقط/);
ctx.window.openSubscribe(S.plans[0]._id);assert.match(modal,/اطلب رقم التحويل من الدعم/);assert.match(modal,/إرسال الطلب مش تفعيل تلقائي/);assert.match(modal,/رقم العملية الموجود/);
if(process.argv.includes('--preview')){
 const styles=html.match(/<style>([\s\S]*?)<\/style>/)[1];
 const head=`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"><style>${styles}${readFileSync('brand.css','utf8')}body{padding:0;margin:0}.preview-shell{max-width:600px;margin:auto;padding:16px 14px}.preview-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.preview-head h2{font-size:20px;margin:0}.modal-sheet{position:relative!important;max-width:600px;width:100%;max-height:none!important;margin:0!important;border-radius:24px 24px 0 0!important;padding:20px;box-sizing:border-box}</style>`;
 writeFileSync('/downloads/welcome-preview.html',head+`<body><main class="preview-shell"><header class="preview-head"><div><h2>IEMA Stor</h2><small>لوحة التاجر</small></div><img src="https://3alababk.com/logo.svg" width="72"></header>${welcome}</main></body></html>`);
 writeFileSync('/downloads/payment-preview.html',head+`<body><div class="preview-shell"><h2>IEMA Stor</h2><p>الباقات المتاحة</p></div><section class="modal-sheet">${modal}</section></body></html>`);
}
ctx.window.openSubscribe(S.plans[0]._id);assert.doesNotMatch(modal,/01067666047/);
S.settings.subPaymentInstructions='01099999999';S.settings.supportWhatsapp='+201000000001';assert.doesNotMatch(ctx.subscriptionPaymentInstructions(),/0109999|01067666047/);assert.match(ctx.subscriptionPaymentInstructions(),/wa\.me\/201000000001/);S.settings.supportWhatsapp='';assert.doesNotMatch(ctx.subscriptionPaymentInstructions(),/<a /);
S.myMerchant.businessName='<img onerror=x>';assert.match(ctx.merchantPaywall(),/&lt;img/);assert.doesNotMatch(ctx.merchantPaywall(),/<img onerror/);
S.myMerchant.status='PENDING';assert.match(ctx.merchantPaywall(),/استنى الموافقة قبل تحويل/);ctx.window.openSubscribe(S.plans[0]._id);assert.match(modal,/استنى الموافقة قبل التحويل/);
S.plans[0].price=257;assert.match(ctx.merchantPaywall(),/257 ج.م/);S.plans[0].active=false;assert.doesNotMatch(ctx.merchantPaywall(),/257 ج.م/);
S.plans=[];assert.match(ctx.merchantPaywall(),/مش متاحة/);S.settings.merchantPlansV2=false;S.plans=[{name:'قديمة',months:1,price:11,description:'وصف'}];assert.match(ctx.merchantPaywall(),/قديمة/);assert.doesNotMatch(ctx.merchantPaywall(),/2%/);
S.myMerchant.subEndsAt=Date.now()+100000;assert.equal(ctx.merchantPaywall(),'');S.myMerchant=null;assert.equal(ctx.merchantPaywall(),'');
console.log('PASS merchant welcome, actual active prices, legacy/empty states, escaped content, pending approval, modal steps, editable payment override, offer disabled');
