// بدء سريع: نفتح التطبيق من نسخة الحساب المحفوظة في كاش Firestore، ونتأكد من السيرفر في الخلفية.
// الأدمن عمره ما بيفتح بالنسخة المحفوظة. لو الدور أو الربط أو الحظر اتغير، بنعيد الفتح كامل من السيرفر.
export const KEY='bk_fast_boot_v1',TTL=7*24*3600*1000;
export function stamp(storage,uid,role,now){try{storage.setItem(KEY,JSON.stringify({uid,role:String(role||'CUSTOMER'),at:now}));}catch(e){}}
export function clear(storage){try{storage.removeItem(KEY);}catch(e){}}
export function read(storage){try{const s=JSON.parse(storage.getItem(KEY)||'null');return s&&typeof s==='object'?s:null;}catch(e){return null;}}
export function eligible(storage,uid,now){
  const s=read(storage);
  return !!s&&s.uid===uid&&Number.isFinite(s.at)&&now-s.at>=0&&now-s.at<=TTL&&String(s.role||'').toUpperCase()!=='ADMIN';
}
export function profileOk(p,isBanned){
  return !!p&&String(p.role||'CUSTOMER').toUpperCase()!=='ADMIN'&&!isBanned(p)&&p.waitlisted!==true&&!!p.referralCode&&p.loyaltyPoints!==undefined;
}
const ACCESS=['role','adminRole','merchantId','deliveryAgentId'];
export function sameAccess(a,b){
  if(!a||!b)return false;
  return ACCESS.every(k=>String(a[k]==null?'':a[k]).toUpperCase()===String(b[k]==null?'':b[k]).toUpperCase());
}
// بس الأخطاء اللي معناها إن الحساب مبقاش مسموح له (مش مشاكل الشبكة) هي اللي بتعمل إعادة فتح كاملة.
export const isAccessError=e=>!!e&&(e.code==='permission-denied'||e.code==='unauthenticated');
