// Fixed ad slots: static image banners, optional link. No third-party scripts, no rotation.
// Every slot is OFF until the main admin turns it on and gives it a valid https image.
export const AD_SLOTS=[
  {id:'mkJoin',label:'أعلى نافذة طلب الانضمام كمسوّق'},
  {id:'mkDash',label:'أعلى لوحة المسوق'},
  {id:'custHome',label:'الصفحة الرئيسية للعميل'}
];
export const AD_SLOT_IDS=AD_SLOTS.map(s=>s.id);
export function cleanHttps(value){
  const v=String(value??'').trim();
  if(!v||v.length>2048||/\s/.test(v)) return '';
  try{const u=new URL(v);return u.protocol==='https:'&&u.hostname?u.href:'';}catch{return '';}
}
// Uploaded banner: a small JPEG data URL saved inside settings/app (no Firebase Storage). 3:1 like the slot, 900x300.
export const AD_W=900,AD_H=300,AD_MAX_CHARS=80000;
const AD_DATA=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
export const isAdData=u=>typeof u==='string'&&u.length<=AD_MAX_CHARS&&AD_DATA.test(u);
// An image is either our own uploaded JPEG or a normal https link.
export const cleanImage=v=>isAdData(String(v??'').trim())?String(v).trim():cleanHttps(v);
export function normalizeSlot(raw){
  const r=raw&&typeof raw==='object'?raw:{};
  return {on:r.on===true,imageUrl:cleanImage(r.imageUrl),link:cleanHttps(r.link),alt:String(r.alt??'').trim().slice(0,120)};
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
    const imageUrl=cleanImage(rawImg),link=cleanHttps(rawLink);
    const label=AD_SLOTS.find(s=>s.id===id).label;
    if(rawImg&&!imageUrl) return {error:`الصورة لازم تكون صورة مرفوعة أو رابط يبدأ بـ https (${label})`};
    if(rawLink&&!link) return {error:`الرابط لازم يبدأ بـ https (${label})`};
    if(on&&!imageUrl) return {error:`ارفع صورة أو حط رابط قبل التشغيل (${label})`};
    slots[id]={on,imageUrl,link,alt:String(read(id,'alt')||'').trim().slice(0,120)};
  }
  return {slots};
}

// ---- Browser only: pick a file, crop to 3:1 from the center, resize to 900x300 JPEG. ----
export function resizeAd(file){
  return new Promise((ok,no)=>{
    if(!file||!/^image\//.test(file.type||''))return no(new Error('اختار صورة'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      try{
        const W=img.naturalWidth,H=img.naturalHeight;let sw=W,sh=W*AD_H/AD_W;if(sh>H){sh=H;sw=H*AD_W/AD_H;}
        const c=document.createElement('canvas');c.width=AD_W;c.height=AD_H;const x=c.getContext('2d');
        x.fillStyle='#fff';x.fillRect(0,0,AD_W,AD_H);x.drawImage(img,(W-sw)/2,(H-sh)/2,sw,sh,0,0,AD_W,AD_H);
        let q=0.82,out=c.toDataURL('image/jpeg',q);
        while(out.length>AD_MAX_CHARS&&q>0.3){q-=0.08;out=c.toDataURL('image/jpeg',q);}
        URL.revokeObjectURL(url);
        isAdData(out)?ok(out):no(new Error('الصورة تقيلة، جرّب صورة أبسط أو استخدم رابط'));
      }catch(e){no(e);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);no(new Error('مش قادر أقرا الصورة'));};
    img.src=url;
  });
}
// state[id]: undefined = nothing chosen (use the link field), non-empty = uploaded/kept image, '' = removed.
const state={};
export function initAd(id,current){state[id]=isAdData(current)?current:undefined;}
export const adImageValue=(id,linkValue)=>state[id]?state[id]:String(linkValue||'').trim();
export async function pickAd(id,input,esc){
  const f=input.files&&input.files[0];if(!f)return;
  const out=await resizeAd(f);state[id]=out;
  const p=document.getElementById('ad_'+id+'_prev');if(p)p.innerHTML=`<img src="${esc(out)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  const l=document.getElementById('ad_'+id+'_imageUrl');if(l)l.value='';
  return out;
}
export function clearAd(id){
  state[id]='';const p=document.getElementById('ad_'+id+'_prev');if(p)p.innerHTML='<i class="fa-solid fa-image" style="color:var(--ink-soft)"></i>';
  const l=document.getElementById('ad_'+id+'_imageUrl');if(l)l.value='';
}
