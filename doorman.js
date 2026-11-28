// البواب: حساب عميل عليه doormanId + سجل doormen/{id} + كود BW-XXXXXX. دوال نقية بس.
export const CODE_RE=/^BW-[A-Z0-9]{6}$/;
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const codeOf=id=>'BW-'+id;
export const isCode=c=>CODE_RE.test(String(c||'').trim().toUpperCase());
export const idOf=c=>isCode(c)?String(c).trim().toUpperCase().slice(3):'';
export function newId(rand=Math.random){let s='';for(let i=0;i<6;i++)s+=ALPHA[Math.floor(rand()*ALPHA.length)%ALPHA.length];return s;}
const name=u=>[u&&u.firstName,u&&u.lastName].filter(Boolean).join(' ').trim();
export function recordFor(user,uid,id,now){return {id,ownerId:uid,name:name(user),phone:String((user&&user.phone)||''),code:codeOf(id),status:'ACTIVE',createdAt:now};}
export function cleanLoc(l){const t=v=>String(v==null?'':v).trim().slice(0,40);l=l||{};return {building:t(l.building),floor:t(l.floor),apt:t(l.apt)};}
export function residentDoc(user,uid,doormanId,loc,now){return {residentId:uid,doormanId,name:name(user),phone:String((user&&user.phone)||''),...cleanLoc(loc),createdAt:now};}
export const linkFor=(id,origin='https://3alababk.com')=>origin+'/register?ref='+codeOf(id);
export const enabled=s=>!!(s&&s.doormenEnabled===true);
export const sortResidents=l=>[...(l||[])].sort((a,b)=>String(a.building).localeCompare(String(b.building),'ar',{numeric:true})||String(a.apt).localeCompare(String(b.apt),'ar',{numeric:true})||String(a.name).localeCompare(String(b.name),'ar'));
