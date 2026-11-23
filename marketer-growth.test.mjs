import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const tools=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('marketer-tools.js')).toString('base64'));
const members=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('member-roles.js')).toString('base64'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const stores=[{id:'a',marketerId:'mk',status:'ACTIVE'},{id:'b',marketerId:'mk',status:'PENDING'},{id:'c',marketerId:'mk',status:'ACTIVE'},{id:'other',marketerId:'other'}];
const subs=[{merchantId:'a',marketerId:'mk',status:'APPROVED',price:200},{merchantId:'a',marketerId:'mk',status:'APPROVED',price:400},{merchantId:'b',marketerId:'mk',status:'PENDING',price:200},{merchantId:'c',marketerId:'mk',status:'APPROVED',price:200,grantedByAdmin:true},{merchantId:'other',marketerId:'mk',status:'APPROVED',price:200}];
assert.deepEqual(tools.marketerFunnel(stores,subs,'mk'),{registered:3,paid:1,notPaid:2});
assert.deepEqual(tools.marketerFunnel([...stores,stores[0]],subs,'mk'),{registered:3,paid:1,notPaid:2});
for(const price of [0,-1,'x',Infinity])assert.equal(tools.marketerFunnel(stores,[{...subs[0],price}],'mk').paid,0);
assert.equal(tools.marketerReferralLink(''), '');assert.equal(tools.marketerReferralLink("x'bad"),'');assert.equal(new URL(tools.marketerReferralLink('MK-EXAMPLE')).searchParams.get('marketer'),'MK-EXAMPLE');
const state={profile:{referralCode:'MK-DEMO-2026'},user:{uid:'mk'},mkMerchants:stores,mkSubs:subs,mkGrowthLoad:{merchants:'ready',subscriptions:'ready'}};
let markup=tools.renderMarketerGrowth(state,esc);assert.match(markup,/دفع اشتراكًا معتمدًا/);assert.match(markup,/MarketerTools.copyLink/);assert.match(markup,/مرة واحدة/);
state.mkGrowthLoad.subscriptions='error';assert.match(tools.renderMarketerGrowth(state,esc),/تعذّر تحميل/);state.mkGrowthLoad.subscriptions='ready';
assert.equal(members.parseMemberRequest('كود المسوّق للمراجعة: mk-demo-2026','MERCHANT').fields.marketerCode,'MK-DEMO-2026');
const data={'users/admin':{role:'ADMIN',adminRole:'SUPER'},'users/customer':{role:'CUSTOMER'},'users/mk':{role:'MARKETER',referralCode:'MK-DEMO',firstName:'Demo'},'settings/app':{merchantPlansV2:true}};
const input={name:'Store',phone:'01012345678',activity:'Food',address:'Test',marketerCode:'MK-DEMO',marketerId:'mk'};let writes=[];
const args={db:{},doc:(d,c,id)=>c+'/'+id,runTransaction:async(d,cb)=>cb({get:async ref=>({exists:()=>!!data[ref],data:()=>data[ref]}),set:(...v)=>writes.push(v),update:(...v)=>writes.push(v)}),actorId:'admin',userId:'customer',recordId:'new',role:'MERCHANT',input,now:123};
await members.createMemberRecord(args);assert.equal(writes[0][1].marketerId,'mk');assert.equal(writes[0][1].status,'PENDING');assert.equal(writes[0][1].subEndsAt,undefined);
writes=[];data['users/mk'].referralCode='CHANGED';await assert.rejects(members.createMemberRecord(args),/marketer-unavailable/);assert.equal(writes.length,0);
console.log('PASS marketer funnel, unique paid stores, grants/pending excluded, missing data not zero, safe personal links, parsed code and transactional attribution recheck');
if(process.argv.includes('--preview')){
 const html=readFileSync('index.html','utf8'),styles=html.match(/<style>([\s\S]*?)<\/style>/)[1]+readFileSync('brand.css','utf8');
 writeFileSync('/downloads/marketer-growth-preview.html',`<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"><style>${styles}body{margin:0;padding:16px 14px}.demo{font-size:11px;color:var(--ink-soft)}</style><body><h2 style="margin:0">لوحة المسوّق</h2><p class="demo">معاينة للمراجعة · بيانات توضيحية وليست أرقام إنتاج</p>${markup}</body></html>`);
}
