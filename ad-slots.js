// Fixed ad slots: static image banners, optional link. No third-party scripts, no rotation.
// Every slot is OFF until the main admin turns it on and gives it a valid https image.
export const AD_SLOTS=[
  {id:'mkJoin',label:'أعلى نافذة طلب الانضمام كمسوّق'},
  {id:'mkDash',label:'تحت الفيديو فى لوحة المسوق'},
  {id:'custHome',label:'الصفحة الرئيسية للعميل'}
];
export const AD_SLOT_IDS=AD_SLOTS.map(s=>s.id);
export function cleanHttps(value){
  const v=String(value??'').trim();
  if(!v||v.length>2048||/\s/.test(v)) return '';
  try{const u=new URL(v);return u.protocol==='https:'&&u.hostname?u.href:'';}catch{return '';}
}
export function normalizeSlot(raw){
  const r=raw&&typeof raw==='object'?raw:{};
  return {on:r.on===true,imageUrl:cleanHttps(r.imageUrl),link:cleanHttps(r.link),alt:String(r.alt??'').trim().slice(0,120)};
}
export function adSlotHTML(settings,id,esc=s=>s){
  if(!AD_SLOT_IDS.includes(id)) return '';
  const s=normalizeSlot(settings?.adSlots?.[id]);
  if(!s.on||!s.imageUrl) return '';
  const img=`<img src="${esc(s.imageUrl)}" alt="${esc(s.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="display:block;width:100%;aspect-ratio:3/1;object-fit:cover;border-radius:14px;background:var(--line)" onerror="this.closest('.ad-slot').remove()">`;
  return `<div class="ad-slot" data-ad-slot="${id}" style="margin-bottom:14px">${s.link?`<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer nofollow">${img}</a>`:img}</div>`;
}
// Reads the admin form. Returns {slots, error}. A slot that is ON needs a valid https image.
export function readAdForm(read){
  const slots={};
  for(const id of AD_SLOT_IDS){
    const on=!!read(id,'on');
    const rawImg=String(read(id,'imageUrl')||'').trim(),rawLink=String(read(id,'link')||'').trim();
    const imageUrl=cleanHttps(rawImg),link=cleanHttps(rawLink);
    const label=AD_SLOTS.find(s=>s.id===id).label;
    if(rawImg&&!imageUrl) return {error:`رابط الصورة لازم يبدأ بـ https (${label})`};
    if(rawLink&&!link) return {error:`الرابط لازم يبدأ بـ https (${label})`};
    if(on&&!imageUrl) return {error:`حط رابط صورة قبل التشغيل (${label})`};
    slots[id]={on,imageUrl,link,alt:String(read(id,'alt')||'').trim().slice(0,120)};
  }
  return {slots};
}
