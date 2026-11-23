import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const f=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('founding-merchants.js')).toString('base64'));
const mp=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('merchant-plans.js')).toString('base64'));
const esc=s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const settings of [{marketerOfferEnabled:false},{marketerOfferEnabled:true}])assert.equal(f.renderFoundingOffer({settings,plans:mp.PLAN_TEMPLATES},esc,String),'');
const markup=f.renderFoundingOffer({settings:{marketerOfferEnabled:false},plans:mp.PLAN_TEMPLATES,preview:true},esc,n=>n+' ج.م');
assert.match(markup,/كود المسوّق \(اختياري\)/);assert.match(markup,/disabled/);assert.doesNotMatch(markup,/progress|50|foundingArea|onclick=/);assert.match(markup,/معاينة نظرية/);
const index=readFileSync('index.html','utf8');assert.doesNotMatch(index,/foundingCampaigns|foundingSeats|firstPaidSubscriptionId|FOUNDERS_RUNTIME_READY/);
console.log('PASS theoretical offer preview, hidden in merchant runtime even with toggle ON, optional inert code, no area/counter/seat/price mutation');
if(process.argv.includes('--preview')){
 const styles=index.match(/<style>([\s\S]*?)<\/style>/)[1]+readFileSync('brand.css','utf8');
 writeFileSync('/downloads/founding-preview.html',`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"><style>${styles}body{margin:0;padding:16px 14px}.card{padding:18px}</style><body><h2 style="margin:0">الاشتراكات والباقات</h2>${markup}<h3>الباقات العادية</h3><div class="card"><b>الصفحة التعريفية</b><p style="font-size:12px">3 شهور200 ج.م ·6 شهور400 ج.م ·سنة600 ج.م</p></div></body></html>`);
}
