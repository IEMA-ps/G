// Merchant plan v2. Pure helpers: no network, authentication, or database writes.
export const MODEL = 'MERCHANT_V2';
export const PLAN_TYPES = { PROFILE:'PROFILE', ORDERING:'ORDERING' };
export const PLAN_TEMPLATES = [
  ...[[3,200],[6,400],[12,600]].map(([months,price])=>({id:`profile_${months}m_v2`,name:'الصفحة التعريفية',kind:'PROFILE',months,price})),
  ...[[3,400],[6,800],[12,1200]].map(([months,price])=>({id:`ordering_${months}m_v2`,name:'باقة الطلبات',kind:'ORDERING',months,price}))
].map((p,i)=>({...p,model:MODEL,termsVersion:1,orderCommissionPercent:p.kind==='ORDERING'?2:0,maxProducts:0,active:true,sortOrder:i,marketerPercent:null}));
export const isNewPlan = p => p?.model===MODEL && ['PROFILE','ORDERING'].includes(p.kind);
export const isNewMerchant = m => m?.subscriptionModel===MODEL;
export const modeOf = m => isNewMerchant(m)?m.subPlanType:'LEGACY';
export const hasTerm = (m,now=Date.now()) => Number(m?.subEndsAt||0)>now;
export function visibleMerchant(m,enforced=false,now=Date.now()){
  return !!m && m.status==='ACTIVE' && ((isNewMerchant(m)||enforced)?hasTerm(m,now):true);
}
export function canOrder(m,enforced=false,now=Date.now()){
  return visibleMerchant(m,enforced,now) && modeOf(m)!=='PROFILE' && (!isNewMerchant(m)||modeOf(m)==='ORDERING');
}
export function addCalendarMonths(ms,months){
  const d=new Date(ms),day=d.getDate();
  d.setDate(1);d.setMonth(d.getMonth()+Number(months));
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));return d.getTime();
}
export function termFor(m,p,now=Date.now()){
  if(!isNewPlan(p)) throw new Error('باقة غير صالحة');
  if(hasTerm(m,now) && (!isNewMerchant(m)||modeOf(m)!==p.kind)) throw new Error('تغيير نوع الباقة أو نقل اشتراك قديم متاح بعد انتهاء المدة الحالية، حفاظًا على حق التاجر.');
  return {subscriptionModel:MODEL,subPlanType:p.kind,subPlanId:p.id||p._id,subPlanName:p.name,subEndsAt:addCalendarMonths(Math.max(now,Number(m?.subEndsAt||0)),p.months),subOrderCommissionPercent:p.kind==='ORDERING'?2:0,subTermsVersion:1};
}
export function feeSnapshot(m,subtotal){
  if(!isNewMerchant(m)) return {};
  if(modeOf(m)!=='ORDERING') throw new Error('الباقة التعريفية لا تستقبل طلبات');
  // Product prices already include merchant discounts. Platform-funded cart coupons/points
  // remain the platform's cost; delivery is never included in this fee base.
  const base=Math.round(Math.max(0,Number(subtotal)||0)*100)/100;
  return {commissionModel:MODEL,commissionTermsVersion:1,commissionPayer:'MERCHANT',commissionPercent:2,commissionBase:base,commissionAmount:Math.round(base*2)/100,commissionBasis:'GOODS_AFTER_MERCHANT_DISCOUNTS_EXCLUDES_DELIVERY'};
}
export const marketerPercentFor = (p,settings) => p?.marketerPercent!=null ? p.marketerPercent : (settings?.marketerSubPercent!=null ? settings.marketerSubPercent : 10);
// Upgrade request: a merchant with a valid PROFILE term asks for an ORDERING plan from his own account.
// The ordering term starts at approval; the unused rest of the profile term is NOT credited (no proration).
export const canRequestUpgrade = (m,p,now=Date.now()) => isNewMerchant(m) && hasTerm(m,now) && modeOf(m)==='PROFILE' && isNewPlan(p) && p.kind==='ORDERING' && p.active!==false;
export function upgradeTermFor(m,p,now=Date.now()){
  if(!canRequestUpgrade(m,p,now)) throw new Error('الترقية متاحة فقط للمتجر صاحب باقة تعريفية سارية إلى باقة طلبات');
  return {subscriptionModel:MODEL,subPlanType:'ORDERING',subPlanId:p.id||p._id,subPlanName:p.name,subEndsAt:addCalendarMonths(now,p.months),subOrderCommissionPercent:2,subTermsVersion:1};
}
export const millisOf = value => typeof value?.toMillis==='function'?value.toMillis():Number(value);
export function cairoMonth(ms){
  const value=millisOf(ms);
  if(!Number.isFinite(value) || value<=0) return null;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit'}).formatToParts(new Date(value));
  return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
}
export function statements(orders){
  const groups=new Map();
  for(const o of orders||[]){
    if(o.commissionModel!==MODEL || o.status!=='DELIVERED') continue;
    const month=cairoMonth(o.deliveredAt);
    if(!month) continue; // Never silently guess the billing month from order creation.
    const key=o.merchantId+'_'+month;
    const row=groups.get(key)||{key,merchantId:o.merchantId,month,base:0,fee:0,count:0,orders:[]};
    row.base+=Number(o.commissionBase)||0;row.fee+=Number(o.commissionAmount)||0;row.count++;row.orders.push(o);
    groups.set(key,row);
  }
  return [...groups.values()].map(r=>({...r,base:Math.round(r.base*100)/100,fee:Math.round(r.fee*100)/100})).sort((a,b)=>b.month.localeCompare(a.month)||a.merchantId.localeCompare(b.merchantId));
}
export function phoneHref(raw){
  const digits=String(raw||'').replace(/[^0-9]/g,'');
  if(!/^0[0-9]{8,10}$|^20[0-9]{8,10}$/.test(digits)) return '';
  return 'tel:+'+(digits.startsWith('0')?'20'+digits.slice(1):digits);
}
export function mapHref(m){
  const lat=Number(m?.latitude),lng=Number(m?.longitude);
  if(m?.latitude!==''&&m?.longitude!==''&&m?.latitude!=null&&m?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180) return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng);
  return m?.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(m.address):'';
}
