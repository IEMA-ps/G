import {parsePaste,validate} from './product-paste.js';
import {planWrites} from './product-sheet.js';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installPaste({S,db,doc,writeBatch,UI,renderMain,canEdit}){
 let rows=[],bad=new Set(),busy=false;
 const toast=m=>UI.toast(m),cats=()=>(S.categories||[]).filter(c=>c.isActive!==false);
 const $=id=>document.getElementById(id);
 function open(){
  if(!canEdit()||S.role!=='merchant')return;rows=[];bad=new Set();
  const cs=cats();
  UI.openModal(`<div class="modal-head"><h3>إضافة منتجات من رسالة</h3><button class="modal-close" onclick="UI.closeModal()" aria-label="إغلاق">×</button></div>
  <p style="font-size:13px;line-height:1.9">الصق هنا الرسالة أو قايمة الأسعار. كل سطر منتج: الاسم والسعر والكمية (الكمية اختيارية).<br><span style="color:var(--ink-soft)">مثال: بيكنج باودر / 5 / 10</span></p>
  <div class="field"><textarea id="pp-text" rows="6" dir="rtl" placeholder="بيكنج باودر / 5 / 10&#10;أرز 50 ج&#10;سكر - ٣٠ - ٢٠ قطعة"></textarea></div>
  <div style="display:flex;gap:10px"><div class="field" style="flex:1"><label>القسم</label><select id="pp-cat">${cs.map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></div>
  <div class="field" style="flex:1"><label>الحجم / الوحدة</label><input id="pp-unit" value="قطعة"></div></div>
  <div class="field"><label>الكمية للمنتجات اللي من غير كمية</label><input id="pp-stock" type="number" min="0" step="1" value="10"></div>
  <button class="btn btn-primary" onclick="ProductPaste.parse()"><i class="fa-solid fa-wand-magic-sparkles"></i> تحليل ومعاينة</button><div id="pp-out"></div>`);
 }
 function parse(){
  try{rows=[];bad=new Set();const r=parsePaste($('pp-text').value,S.myProducts||[]);rows=r.rows;
   if(!rows.length){$('pp-out').innerHTML='<p>مفيش سطور فيها سعر. اكتب كل منتج في سطر، ومعاه سعره.</p>';return}
   draw(r.ignored);
  }catch(err){toast(err.message||'تعذر تحليل النص')}
 }
 let ignoredN=0;
 function draw(ig){
  if(ig!==undefined)ignoredN=ig;
  const out=$('pp-out');
  out.innerHTML=`<div class="sc-note" style="margin:12px 0">راجع واعدّل قبل الحفظ. ${ignoredN?`اتجاهلت ${ignoredN} سطر مفيهوش أرقام.`:''}</div>`+
  `<div class="list-gap">${rows.map((r,i)=>{
    const st=r.dupInList?'<span style="color:var(--danger);font-size:12px">اسم مكرر في القايمة: احذف واحد</span>':r.existingId?`<label style="font-size:12px"><input type="checkbox" ${r.update?'checked':''} onchange="ProductPaste.upd(${i},this.checked)"> موجود بسعر ${e(r.existingPrice)} ج. حدّث السعر${'/الكمية'}</label>`:'<span style="color:var(--success);font-size:12px">منتج جديد</span>';
    return `<div class="card" style="padding:10px;${bad.has(i)?'border-color:var(--danger)':''}"><div style="display:flex;gap:8px;align-items:center">
     <input value="${e(r.name)}" oninput="ProductPaste.set(${i},'name',this.value)" style="flex:1;min-width:0" aria-label="الاسم">
     <button class="icon-btn" style="background:var(--danger-tint);color:var(--danger)" onclick="ProductPaste.del(${i})" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></div>
     <div style="display:flex;gap:8px;margin-top:8px"><input value="${e(r.price)}" inputmode="decimal" placeholder="السعر" oninput="ProductPaste.set(${i},'price',this.value)" style="flex:1;min-width:0" aria-label="السعر">
     <input value="${e(r.stock)}" inputmode="numeric" placeholder="الكمية" oninput="ProductPaste.set(${i},'stock',this.value)" style="flex:1;min-width:0" aria-label="الكمية"></div>
     <div style="margin-top:6px">${st}</div></div>`}).join('')}</div>
  <button class="btn btn-primary" style="margin-top:12px" onclick="ProductPaste.commit()">حفظ ${rows.length} منتج</button>`;
 }
 const set=(i,k,v)=>{if(rows[i]){rows[i][k]=v;bad.delete(i)}};
 const upd=(i,v)=>{if(rows[i])rows[i].update=!!v};
 const del=i=>{rows.splice(i,1);bad=new Set();
  const seen=new Set();rows.forEach(r=>{const k=r.name.trim().toLowerCase();r.dupInList=!!k&&seen.has(k);if(k)seen.add(k)});
  if(!rows.length){$('pp-out').innerHTML='';return}draw()};
 async function commit(){
  if(busy||!rows.length||!canEdit())return;busy=true;
  try{
   const ds=Number($('pp-stock').value),unit=$('pp-unit').value.replace(/\s+/g,' ').trim(),categoryId=$('pp-cat').value;
   if($('pp-stock').value===''||!Number.isSafeInteger(ds)||ds<0||ds>1e6)throw Error('اكتب كمية صحيحة');
   if(!unit||unit.length>60)throw Error('اكتب الحجم أو الوحدة');
   if(!cats().some(c=>c.id===categoryId))throw Error('اختار القسم');
   bad=new Set();const creates=[],updates=[];
   rows.forEach((r,i)=>{const v=validate(r);if(r.dupInList||v.errors.length){bad.add(i);return}
    if(r.existingId){if(r.update)updates.push({row:r,v})}else creates.push({title:v.name,unit,categoryId,price:v.price,stockGiven:v.stock!==null,stock:v.stock===null?ds:v.stock})});
   if(bad.size){draw();throw Error('فيه '+bad.size+' سطر محتاج تصليح (باللون الأحمر)')}
   const plan=planWrites(creates,S.profile.merchantId,new Map());
   if(!plan.creates.length&&!updates.length)throw Error('مفيش حاجة جديدة للحفظ');
   if(S.settings&&S.settings.subsEnforced){const pl=(S.plans||[]).find(x=>x._id===(S.myMerchant&&S.myMerchant.subPlanId));if(pl&&pl.maxProducts>0&&(S.myProducts||[]).length+plan.creates.length>pl.maxProducts)throw Error('المنتجات دي هتعدي حد باقتك ('+pl.maxProducts+')')}
   const mine=new Map((S.myProducts||[]).map(x=>[x.id,x]));
   const ops=[...plan.creates.map(c=>b=>b.set(doc(db,'products',c.id),c.data)),
    ...updates.map(({row,v})=>{const prev=mine.get(row.existingId)||{};const patch={price:v.price,discountPercent:prev.oldPrice&&prev.oldPrice>v.price?Math.round((prev.oldPrice-v.price)/prev.oldPrice*100):0};if(v.stock!==null)patch.stock=v.stock;return b=>b.update(doc(db,'products',row.existingId),patch)})];
   for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(f=>f(b));await b.commit()}
   UI.closeModal();toast(`تم: ${plan.creates.length} جديد، ${updates.length} تحديث`);renderMain();
  }catch(err){toast(err.code==='permission-denied'?'الصلاحيات منعت الحفظ.':err.message||'تعذر الحفظ')}finally{busy=false}
 }
 window.ProductPaste={open,parse,set,upd,del,commit};return window.ProductPaste;
}
