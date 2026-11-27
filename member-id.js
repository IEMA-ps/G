// National ID photos for join requests (merchant / service provider / courier).
// Stored ONLY in memberRequestIds/{uid} (readable by the owner and super admins, nothing else). Never in users/merchants/orders.
// Two small JPEG data URLs (front + back), resized in the browser. No Firebase Storage.
export const MAX_SIDE=1000;
export const MAX_CHARS=300000; // ~220KB each, two images stay far under the 1MB Firestore document limit
export const KINDS=['store','service','courier']; // which join requests need an ID (switch: settings/app.memberIdRequired=false turns it off)
const DATA=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
export const required=(kind,settings)=>KINDS.includes(kind)&&!(settings&&settings.memberIdRequired===false);
export const validImage=u=>typeof u==='string'&&u.length>100&&u.length<=MAX_CHARS&&DATA.test(u);
export function fit(w,h,max=MAX_SIDE){const k=Math.min(1,max/Math.max(w,h));return {w:Math.max(1,Math.round(w*k)),h:Math.max(1,Math.round(h*k))};}
export const CONSENT='أوافق على رفع صورة بطاقتي لإثبات هويتي فقط. الصورة بتتحفظ بشكل خاص ومحدش بيشوفها غير إدارة الموقع، وبتفضل محفوظة بعد الموافقة على الطلب.';
// The document that is written. Throws if anything is missing, so a half request can never be sent.
export function buildDoc({uid,kind,front,back,now}){
  if(!validImage(front)||!validImage(back)) throw new Error('id-images-required');
  return {userId:uid,kind,front,back,consent:true,createdAt:now};
}
export function resize(file,max=MAX_SIDE){
  return new Promise((ok,no)=>{
    if(!file||!/^image\//.test(file.type||''))return no(new Error('اختار صورة'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      try{
        const {w,h}=fit(img.naturalWidth,img.naturalHeight,max),c=document.createElement('canvas');
        c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
        let q=0.8,out=c.toDataURL('image/jpeg',q);
        while(out.length>MAX_CHARS&&q>0.35){q-=0.1;out=c.toDataURL('image/jpeg',q);}
        URL.revokeObjectURL(url);
        validImage(out)?ok(out):no(new Error('الصورة كبيرة، جرّب صورة تانية'));
      }catch(e){no(e);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);no(new Error('مش قادر أقرا الصورة'));};
    img.src=url;
  });
}
const state={front:'',back:''};
export const reset=()=>{state.front='';state.back='';};
export const get=()=>({...state});
export async function pick(side,input,esc){
  const f=input.files&&input.files[0];if(!f)return;
  const out=await resize(f);state[side]=out;
  const p=document.getElementById('rqId'+side+'Prev');if(p)p.innerHTML=`<img src="${esc(out)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
}
export function fieldsHTML(esc){
  reset();
  const box=(side,label)=>`<div style="flex:1;min-width:130px"><div id="rqId${side}Prev" style="height:96px;border-radius:12px;background:var(--teal-tint);overflow:hidden;display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-id-card" style="font-size:26px;color:var(--teal)"></i></div><label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:6px 0 0"><i class="fa-solid fa-camera"></i> ${esc(label)}<input type="file" accept="image/*" style="display:none" onchange="pickMemberId('${side}',this)"></label></div>`;
  return `<fieldset id="rqIdBox" style="border:1px solid var(--line);border-radius:14px;padding:12px;margin:12px 0;min-width:0"><legend style="font-size:13px;font-weight:700;padding:0 5px">صورة بطاقة الرقم القومي <span style="color:var(--danger)">*</span></legend>
  <div style="display:flex;gap:10px;flex-wrap:wrap">${box('front','وش البطاقة')}${box('back','ضهر البطاقة')}</div>
  <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.8;margin-top:10px"><input type="checkbox" id="rqIdConsent" style="margin-top:5px"><span>${esc(CONSENT)}</span></label></fieldset>`;
}
