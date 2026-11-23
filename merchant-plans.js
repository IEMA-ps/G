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
// Marketer-code offer: 6 months of the PROFILE plan for a fixed price, only for merchants
// attributed to a marketer (they entered a valid marketer code at registration). One use per merchant.
export const MARKETER_OFFER = { id:'MARKETER_PROFILE_6M', planId:'profile_6m_v2', kind:'PROFILE', months:6, price:300 };
export const marketerOfferOn = settings => settings?.marketerOfferEnabled===true;
export function marketerOfferFor(m,p,settings){
  if(!marketerOfferOn(settings) || !m?.marketerId || m.marketerOfferUsed) return null;
  if(!isNewMerchant(m) || !isNewPlan(p) || p.active===false) return null;
  if((p.id||p._id)!==MARKETER_OFFER.planId || p.kind!==MARKETER_OFFER.kind || p.months!==MARKETER_OFFER.months) return null;
  if(hasTerm(m) && modeOf(m)!==MARKETER_OFFER.kind) return null;
  return {offerId:MARKETER_OFFER.id,price:MARKETER_OFFER.price,listPrice:p.price};
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
// Google links are data, never arbitrary iframe HTML. No short-link network resolver.
export function googleMapsURL(raw){
  const value=String(raw||'').trim();if(!value)return '';
  if(value.length>4096)throw Error('invalid-map-link');
  let u;try{u=new URL(value);}catch{throw Error('invalid-map-link');}
  const host=u.hostname.toLowerCase(),path=u.pathname;
  const allowed=(host==='maps.app.goo.gl'&&path.length>1)||(host==='goo.gl'&&path.startsWith('/maps/'))||((host==='www.google.com'||host==='google.com')&&(path==='/maps'||path.startsWith('/maps/')))||(host==='maps.google.com'&&(path==='/'||path==='/maps'||path.startsWith('/maps/')));
  if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed)throw Error('invalid-map-link');
  return u.href;
}
export function mapCoordinates(m){
  const lat=Number(m?.latitude),lng=Number(m?.longitude);
  return m?.latitude!==''&&m?.longitude!==''&&m?.latitude!=null&&m?.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{latitude:lat,longitude:lng}:null;
}
export function coordinatesFromMapURL(raw){
  const href=googleMapsURL(raw);if(!href)return null;
  const u=new URL(href);if(u.hostname==='maps.app.goo.gl'||u.hostname==='goo.gl')return null;
  const pair=value=>{const m=String(value||'').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);return m?mapCoordinates({latitude:m[1],longitude:m[2]}):null;};
  for(const k of ['query','q']){const c=pair(u.searchParams.get(k));if(c)return c;}
  let path;try{path=decodeURIComponent(u.pathname);}catch{return null;}
  // Place pins use !3d / !4d. @lat,lng is often just the camera center, not the pin.
  const pin=path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if(pin)return mapCoordinates({latitude:pin[1],longitude:pin[2]});
  const simple=path.match(/^\/maps\/(?:place|search)\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:\/|$)/);
  return simple?mapCoordinates({latitude:simple[1],longitude:simple[2]}):null;
}
export function mapInputValue(m){
  try{if(m?.googleMapsUrl)return googleMapsURL(m.googleMapsUrl);}catch{}
  const c=mapCoordinates(m);return c?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.latitude+','+c.longitude):'';
}
export function mapLocationPatch(raw,existing={}){
  const googleMapsUrl=googleMapsURL(raw),old=mapInputValue(existing);
  // An unchanged form never rewrites legacy coordinates. Changed opaque links remove stale coordinates.
  if(googleMapsUrl===old)return {googleMapsUrl};
  const c=coordinatesFromMapURL(googleMapsUrl);
  return {googleMapsUrl,latitude:c?.latitude??null,longitude:c?.longitude??null};
}
export function mapPreview(raw){
  let href;try{href=googleMapsURL(raw);}catch{return {state:'invalid',href:'',embed:''};}
  if(!href)return {state:'empty',href:'',embed:''};
  const u=new URL(href),c=coordinatesFromMapURL(href);
  if(c)return {state:'pin',href,embed:'https://maps.google.com/maps?q='+encodeURIComponent(c.latitude+','+c.longitude)+'&z=16&hl=ar&output=embed'};
  if((u.hostname==='www.google.com'||u.hostname==='google.com')&&u.pathname==='/maps/embed'&&u.searchParams.get('pb'))return {state:'embed',href,embed:href};
  return {state:'unresolved',href,embed:''};
}
export function mapPreviewHTML(raw,esc){
  const p=mapPreview(raw);
  if(p.state==='invalid')return '<p role="alert" style="color:var(--danger);font-size:12px">حط رابط Google Maps صحيح، ويكون بدايته https://</p>';
  if(p.state==='empty')return '<p style="font-size:12px;color:var(--ink-soft)">الصق رابط لوكيشن متجرك، وهتشوف معاينة الخريطة هنا.</p>';
  const note=p.embed?'راجع العلامة على الخريطة قبل الحفظ. لو الخريطة مش ظاهرة، افتح الرابط في Google Maps.':'الرابط هيتحفظ عند الضغط على حفظ. لا نقدر نحدد نقطة مؤكدة للمعاينة من الرابط ده، ومش هنعرض مكان تخميني. افتحه في Google Maps وانسخ الرابط الكامل الذي يحتوي على إحداثيات، أو رابط تضمين الخريطة.';
  return (p.embed?'<iframe title="خريطة موقع المتجر من Google" src="'+esc(p.embed)+'" width="100%" height="240" style="display:block;border:0;border-radius:16px;min-width:200px" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>':'')+'<p style="font-size:12px;line-height:1.9;color:var(--ink-soft)">'+note+'</p><a href="'+esc(p.href)+'" target="_blank" rel="noopener noreferrer" style="font-size:12px">افتح اللوكيشن في Google Maps</a>';
}
export function mapField(id,m,esc){
  const value=mapInputValue(m);
  return '<div class="field"><label for="'+id+'">رابط اللوكيشن من Google Maps (اختياري)</label><input id="'+id+'" type="url" dir="ltr" maxlength="4096" value="'+esc(value)+'" placeholder="https://maps.app.goo.gl/..." oninput="clearTimeout(this._mapTimer);this._mapTimer=setTimeout(()=>updateStoreMapPreview(\''+id+'\'),600)"><p style="font-size:11px;line-height:1.8;color:var(--ink-soft)">افتح Google Maps، واضغط «مشاركة» وبعدها «نسخ الرابط». المعاينة بتتصل بجوجل عشان تعرض مكان متجرك.</p><div id="'+id+'Preview" aria-live="polite">'+mapPreviewHTML(value,esc)+'</div></div>';
}
export function mapHref(m){
  const saved=mapInputValue(m);if(saved)return saved;
  return m?.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(m.address):'';
}

// Support WhatsApp number. Returns digits in international form, or '' when unset/invalid
// (also treats the old built-in placeholder as unset so no button points to a made-up number).
export function supportPhone(raw){
  let d=String(raw||'').replace(/[^0-9]/g,'');
  if(d.startsWith('00')) d=d.slice(2);
  else if(d.startsWith('0')) d='20'+d.slice(1);
  if(d==='201000000000' || !/^[1-9][0-9]{10,14}$/.test(d)) return '';
  if(d.startsWith('20') && d.length!==12) return '';
  return d;
}
export function supportHref(raw,msg){
  const d=supportPhone(raw);
  return d?'https://wa.me/'+d+(msg?'?text='+encodeURIComponent(msg):''):'';
}
