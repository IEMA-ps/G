// Business activity is not a subscription plan or a product category.
export const STORE_TYPES=['مطاعم','سوبر ماركت','خضار وفاكهة','لحوم ودواجن وأسماك','حلويات','مشروبات','صيدلية','عناية وتجميل','عطور','إلكترونيات','ملابس','مستلزمات أطفال','مستلزمات منزلية','ورد وهدايا','حيوانات أليفة','مكتبات وقرطاسية'];
export const typeLabel=m=>String(m?.activityType||'').trim()||'غير محدد';
export function typePicker(id,current,esc){
 const value=String(current||'').trim(),known=STORE_TYPES.includes(value),other=!!value&&!known;
 return `<div class="field"><label for="${id}">نوع المتجر</label><select id="${id}" onchange="StoreTypes.change('${id}')"><option value="">اختار نوع المتجر</option>${STORE_TYPES.map(t=>`<option value="${esc(t)}" ${value===t?'selected':''}>${esc(t)}</option>`).join('')}<option value="__other__" ${other?'selected':''}>أخرى، اكتب النوع</option></select><div id="${id}OtherWrap" class="${other?'':'hidden'}" style="margin-top:8px"><label for="${id}Other" style="font-size:12px">نوع المتجر الآخر</label><input id="${id}Other" maxlength="120" value="${other?esc(value):''}" placeholder="اكتب النشاط الرئيسي للمتجر"></div><p style="font-size:11px;line-height:1.8;color:var(--ink-soft)">النشاط الرئيسي، مش نوع الباقة. اختار «أخرى» لو نشاطك مش موجود.</p></div>`;
}
export function typeValue(choice,other='',required=true){
 const value=String(choice==='__other__'?other:choice||'').trim();
 if(((required||choice==='__other__')&&!value)||value.length>120||/[\u0000-\u001f\u007f]/.test(value))throw Error('اختار نوع المتجر، أو اكتب النوع لو اخترت أخرى.');
 return value;
}
export function installStoreTypes(){
 window.StoreTypes={
  change(id){const other=document.getElementById(id).value==='__other__';document.getElementById(id+'OtherWrap').classList.toggle('hidden',!other);document.getElementById(id+'Other').required=other;},
  read(id,required=true){return typeValue(document.getElementById(id)?.value,document.getElementById(id+'Other')?.value,required);},
  set(id,value){const el=document.getElementById(id);if(!el)return;el.value=STORE_TYPES.includes(value)?value:value?'__other__':'';const other=document.getElementById(id+'Other');if(other)other.value=value||'';this.change(id);}
 };
}
export function typeOptions(stores){return [...new Set((stores||[]).map(typeLabel))].sort((a,b)=>a.localeCompare(b,'ar'));}
export function filterStoresByType(stores,type){return !type?stores:stores.filter(m=>typeLabel(m)===type);}
