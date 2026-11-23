// Generate an offline fake-data review of the Telegram linking UI from the real index.html code.
// No Firebase SDK, no network calls to Firebase, no writes.
import {readFileSync, writeFileSync} from 'node:fs';
const source = readFileSync('index.html', 'utf8');
const take = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const merchantFn = take('function renderMerchantProfile(){', 'window.updateStoreMapPreview');
const deliveryAndHandlers = take('function renderDeliveryProfile(){', '/* ================= ADMIN VIEWS');
const style = source.match(/<style>([\s\S]*?)<\/style>/)[1];
writeFileSync('telegram-preview.html', `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة إشعارات تليجرام — بيانات تجريبية</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style>${style}</style><link rel="stylesheet" href="brand.css"></head><body data-role="merchant"><div id="appShell"><div id="topbar"><div class="tb-title">حسابي<small>معاينة فقط · بيانات تجريبية</small></div></div><main id="mainContent"></main><nav id="bottomNav"></nav></div><div id="modalRoot" class="hidden"><div class="modal-backdrop" onclick="UI.closeModal()"></div><div class="modal-sheet" id="modalSheet"></div></div><script type="module">
import * as TelegramNotify from './telegram-notify.js';
window.TelegramNotify = TelegramNotify;
const esc = x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fmtMoney = n=>Number(n||0).toLocaleString('ar-EG')+' ج.م';
const emptyState = (icon,title,text)=>'<section class="empty-state"><i class="fa-solid '+icon+'"></i><h4>'+title+'</h4><p>'+text+'</p></section>';
const MERCHANT_STATUS = {ACTIVE:{label:'مفعّل',cls:'status-active'}};
const typeLabel = ()=>'عطارة';
const publicStoreUrl = ()=>'#';
const MerchantPlans = {isNewMerchant:()=>false, supportHref:()=>'https://wa.me/201000000000', modeOf:()=>'ORDERING'};
const S = window.S = {
  role:'merchant', tab:'m_profile',
  user:{uid:'u1', getIdToken:async()=>'fake-token'},
  profile:{merchantId:'m1', deliveryAgentId:'a1', firstName:'محمود', lastName:'سيد'},
  myMerchant:{id:'m1', businessName:'عطارة البركة', managerName:'الحاج محمود', phone:'01012345678', whatsappNumber:'01012345678', address:'شارع الجمهورية — الجيزة', status:'ACTIVE', logoUrl:'', minOrderAmount:0, openTime:'09:00', closeTime:'23:00'},
  myAgent:{id:'a1', name:'كريم السيد', phone:'01098765432', vehicleType:'موتوسيكل', rating:4.8, ratingCount:23},
  settings:{supportWhatsapp:'01000000000'},
  mySubOrders:[], allSubOrders:[], activeAgents:[]
};
window.UI = {
  openModal: html=>{document.getElementById('modalSheet').innerHTML=html;document.getElementById('modalRoot').classList.remove('hidden');},
  closeModal: ()=>document.getElementById('modalRoot').classList.add('hidden'),
  toast: msg=>console.log('toast:', msg)
};
window.go = ()=>{};
${merchantFn}
${deliveryAndHandlers}
window.renderMain = ()=>{
  const isDelivery = S.role==='delivery';
  document.body.dataset.role = S.role;
  document.getElementById('mainContent').innerHTML = isDelivery ? renderDeliveryProfile() : renderMerchantProfile();
  const nav = isDelivery
    ? [['d_dashboard','fa-motorcycle','مهامي'],['d_history','fa-clock-rotate-left','السجل'],['d_profile','fa-id-card','حسابي']]
    : [['m_dashboard','fa-chart-line','الرئيسية'],['m_products','fa-box','منتجاتي'],['m_orders','fa-receipt','الطلبات'],['m_reports','fa-chart-pie','الأداء'],['m_statement','fa-file-invoice','العمولة'],['m_profile','fa-store','متجري']];
  const active = isDelivery ? 'd_profile' : 'm_profile';
  document.getElementById('bottomNav').innerHTML = nav.map(([tab,icon,label])=>'<button class="nav-btn '+(tab===active?'active':'')+'"><span style="position:relative"><i class="fa-solid '+icon+'"></i></span><span>'+label+'</span></button>').join('');
};
// Block real network actions in this review only.
document.addEventListener('click', event=>{
  const b = event.target.closest('[onclick]'); if(!b) return;
  const action = b.getAttribute('onclick');
  if(!['openTelegramLink(','UI.closeModal(','checkTelegramLink('].some(p=>action.startsWith(p))){
    event.preventDefault(); event.stopImmediatePropagation(); alert('معاينة فقط، بدون حفظ أو تغيير بيانات.');
  }
}, true);
renderMain();
</script></body></html>`);
console.log('Generated telegram-preview.html with real render functions and fake data.');
