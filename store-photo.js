// Store photo (merchants) / personal photo (service providers). Stored as a small JPEG data URL in merchants.logoUrl.
// No Firebase Storage. Resized in the browser to <= 400px, JPEG.
export const MAX_SIDE=400;
export const MAX_CHARS=90000; // ~65KB of image, far under the 1MB Firestore document limit
const DATA=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
export const isOn=s=>!!s&&s.storePhotoRequired===true;
export const labelFor=(m,isService)=>isService?'صورة شخصية':'صورة المتجر';
export const hasPhoto=m=>!!m&&typeof m.logoUrl==='string'&&m.logoUrl.trim()!=='';
// Accepts our own data URL or a legacy https link (old stores keep theirs). Anything else is dropped.
export function safeSrc(u){
  const v=String(u||'').trim();
  if(v.length<=MAX_CHARS&&DATA.test(v))return v;
  try{const x=new URL(v);return x.protocol==='https:'?x.href:'';}catch{return '';}
}
export const validNew=u=>typeof u==='string'&&u.length<=MAX_CHARS&&DATA.test(u);
export function fit(w,h,max=MAX_SIDE){const k=Math.min(1,max/Math.max(w,h));return {w:Math.max(1,Math.round(w*k)),h:Math.max(1,Math.round(h*k))};}
// Browser only. Square crop from the center keeps cards tidy.
export function resize(file,max=MAX_SIDE){
  return new Promise((ok,no)=>{
    if(!file||!/^image\//.test(file.type||''))return no(new Error('اختار صورة'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      try{
        const s=Math.min(img.naturalWidth,img.naturalHeight),side=Math.min(max,s),c=document.createElement('canvas');
        c.width=c.height=side;
        c.getContext('2d').drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,side,side);
        let q=0.82,out=c.toDataURL('image/jpeg',q);
        while(out.length>MAX_CHARS&&q>0.4){q-=0.1;out=c.toDataURL('image/jpeg',q);}
        URL.revokeObjectURL(url);
        validNew(out)?ok(out):no(new Error('الصورة كبيرة، جرّب صورة تانية'));
      }catch(e){no(e);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);no(new Error('مش قادر أقرا الصورة'));};
    img.src=url;
  });
}
const state={};
export const value=(id,current)=>state[id]!==undefined?state[id]:(current||'');
export function fieldHTML(id,label,current,esc,required){
  const src=safeSrc(current);state[id]=undefined;
  return `<div class="field"><label>${esc(label)}${required?' <span style="color:var(--danger)">*</span>':''}</label>
    <div style="display:flex;align-items:center;gap:12px"><div id="${id}Prev" style="width:84px;height:84px;border-radius:16px;background:var(--teal-tint);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0">${src?`<img src="${esc(src)}" alt="" style="width:100%;height:100%;object-fit:cover">`:'<i class="fa-solid fa-camera" style="font-size:24px;color:var(--teal)"></i>'}</div>
    <label class="btn btn-ghost btn-sm" style="width:auto;cursor:pointer;margin:0"><i class="fa-solid fa-image"></i> ${src?'تغيير الصورة':'اختيار صورة'}<input id="${id}File" type="file" accept="image/*" style="display:none" onchange="pickStorePhoto('${id}',this)"></label></div>
    <p style="font-size:11px;color:var(--ink-soft);margin:6px 0 0">الصورة بتتصغّر تلقائي، وهتظهر للعملاء على كارت وصفحة النشاط.</p></div>`;
}
export async function pick(id,input,esc){
  const f=input.files&&input.files[0];if(!f)return;
  const out=await resize(f);state[id]=out;
  const p=document.getElementById(id+'Prev');if(p)p.innerHTML=`<img src="${esc(out)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  return out;
}
export function promptHTML(m,isService,esc){
  if(hasPhoto(m))return '';
  const l=labelFor(m,isService);
  return `<div class="card" style="margin-bottom:12px;border-color:var(--danger)"><div class="row-between"><span style="font-size:13.5px"><i class="fa-solid fa-camera" style="color:var(--danger);margin-left:8px"></i><b>ضيف ${esc(l)}</b><br><span style="font-size:12px;color:var(--ink-soft)">العملاء بيثقوا في المتجر اللي له صورة. بياخد دقيقة.</span></span><button class="btn btn-primary btn-sm" style="width:auto" onclick="openMerchantEdit()">إضافة</button></div></div>`;
}
