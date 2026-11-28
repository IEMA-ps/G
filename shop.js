// المحل والكراسي: كود فريق ST-XXXXXX لصاحب المحل، والحلاق يبعت طلب انضمام، وصاحب المحل يوافق. خدمات بالاسم والمدة بس (من غير أسعار).
export const CODE_RE=/^ST-[A-Z0-9]{6}$/;
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const isCode=c=>CODE_RE.test(String(c||'').trim().toUpperCase());
export const normCode=c=>String(c||'').trim().toUpperCase();
export function newCode(rand=Math.random){let s='';for(let i=0;i<6;i++)s+=ALPHA[Math.floor(rand()*ALPHA.length)%ALPHA.length];return 'ST-'+s;}
export const enabled=s=>!!(s&&s.shopsEnabled===true);
export const linkFor=(code,origin='https://3alababk.com')=>origin+'/?shop='+normCode(code);
export function codeFromSearch(search){try{const c=normCode(new URLSearchParams(search||'').get('shop'));return isCode(c)?c:'';}catch(e){return '';}}
export const MAX_ITEMS=12,MIN_MINUTES=5,MAX_MINUTES=240;
// بيرجّع اسم ومدة بس. أي حقل تاني (زي السعر) بيتشال.
export function cleanServices(list){
  const out=[],seen=new Set();
  for(const x of Array.isArray(list)?list:[]){
    const name=String((x&&x.name)==null?'':x.name).trim().slice(0,40);
    const minutes=Math.round(Number(x&&x.minutes));
    if(!name||!Number.isFinite(minutes)||minutes<MIN_MINUTES||minutes>MAX_MINUTES||seen.has(name))continue;
    seen.add(name);out.push({name,minutes});if(out.length>=MAX_ITEMS)break;
  }
  return out;
}
export function durationLabel(min){
  const m=Math.round(Number(min));if(!(m>0))return '';
  if(m<60)return m+' دقيقة';
  const h=Math.floor(m/60),r=m%60;
  const hs=h===1?'ساعة':h===2?'ساعتين':h+' ساعات';
  return r?hs+' و'+r+' دقيقة':hs;
}
export const chairRequest=(barberId,shopId,code,name,now)=>({barberId,shopId,code:normCode(code),name:String(name||'').slice(0,80),status:'PENDING',requestedAt:now});
export const activeChairs=(chairs,shopId)=>(chairs||[]).filter(c=>c.shopId===shopId&&c.status==='ACTIVE');
export const pendingChairs=(chairs,shopId)=>(chairs||[]).filter(c=>c.shopId===shopId&&c.status==='PENDING');
