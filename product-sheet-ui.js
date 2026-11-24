import {buildTemplate,readSheetFile,parseSheet,applyMapping,planWrites} from './product-sheet.js';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installSheet({S,db,doc,writeBatch,UI,renderMain,canEdit}){
 let parsed=null,busy=false;
 const toast=m=>UI.toast(m);
 function download(){const url=URL.createObjectURL(new Blob([buildTemplate()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='نموذج-منتجات-المتجر.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
 function open(){if(!canEdit()||S.role!=='merchant')return;parsed=null;UI.openModal(`<div class="modal-head"><h3>رفع شيت المنتجات</h3><button class="modal-close" onclick="UI.closeModal()" aria-label="إغلاق">×</button></div>
  <p>١. حمّل النموذج واكتب فيه: اسم المنتج، النوع، السعر، الحجم.<br>٢. ارفع الشيت هنا وراجع قبل الحفظ.<br>٣. لو رفعت نفس الشيت تاني بعد تعديل الأسعار، المنتجات بنفس الاسم والحجم بيتحدث سعرها، والجديد بيتضاف. اللي مش في الشيت بيفضل زي ما هو.</p>
  <button class="btn btn-ghost" onclick="ProductSheet.download()">تحميل نموذج Excel</button>
  <div class="field"><label>ملف Excel (.xlsx) أو CSV</label><input id="ps-file" type="file" accept=".xlsx,.csv" onchange="ProductSheet.preview()"></div><div id="ps-out"></div>`)}
 async function preview(){if(busy)return;busy=true;const out=document.getElementById('ps-out');try{parsed=null;out.innerHTML='';const rows=await readSheetFile(document.getElementById('ps-file').files[0]);const p=parseSheet(rows,S.categories||[]);parsed=p;const cats=(S.categories||[]).filter(c=>c.isActive!==false);
  const mine=new Map((S.myProducts||[]).map(x=>[x.id,x]));const plan=planWrites(applyMapping(p.rows.map(r=>({...r,categoryId:r.categoryId||cats[0]?.id})),{},S.categories,0),S.profile.merchantId,mine);
  out.innerHTML=`<div class="sc-note">${p.rows.length} سطر سليم${p.errors.length?` · ${p.errors.length} فيهم مشكلة وهيتخطوا`:''}<br>جديد: ${plan.creates.length} · تحديث: ${plan.updates.length}</div>`+
  (p.errors.length?`<ul>${p.errors.slice(0,15).map(x=>`<li>سطر ${x.line}: ${e(x.errors.join('، '))}</li>`).join('')}</ul>`:'')+
  (p.unmatchedTypes.length?`<p>الأنواع دي مش أسماء أقسام. اختار القسم لكل نوع:</p>${p.unmatchedTypes.map((t,i)=>`<div class="field"><label>${e(t)}</label><select id="ps-map-${i}"><option value="">اختار القسم</option>${cats.map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></div>`).join('')}`:'')+
  `<div class="field"><label>الكمية للمنتجات الجديدة اللي من غير كمية في الشيت</label><input id="ps-stock" type="number" min="0" step="1" value="10"></div><button class="btn btn-primary" onclick="ProductSheet.commit()" ${p.rows.length?'':'disabled'}>حفظ ${p.rows.length} منتج</button>`}catch(err){out.innerHTML=`<div class="sc-note" style="color:var(--danger)">${e(err.message)}</div>`}finally{busy=false}}
 async function commit(){if(busy||!parsed||!canEdit())return;busy=true;try{const p=parsed,cats=S.categories||[];const mapping=Object.fromEntries(p.unmatchedTypes.map((t,i)=>[t,document.getElementById('ps-map-'+i).value]));
  const stockRaw=document.getElementById('ps-stock').value;const ds=Number(stockRaw);if(stockRaw===''||!Number.isSafeInteger(ds)||ds<0||ds>1e6)throw Error('اكتب كمية صحيحة');
  const rows=applyMapping(p.rows,mapping,cats,ds),mine=new Map((S.myProducts||[]).map(x=>[x.id,x])),plan=planWrites(rows,S.profile.merchantId,mine);
  if(S.settings&&S.settings.subsEnforced){const pl=(S.plans||[]).find(x=>x._id===(S.myMerchant&&S.myMerchant.subPlanId));if(pl&&pl.maxProducts>0&&(S.myProducts||[]).length+plan.creates.length>pl.maxProducts)throw Error('الشيت هيعدي حد باقتك ('+pl.maxProducts+' منتج). مفيش حاجة اتحفظت.')}
  const ops=[...plan.creates.map(c=>b=>b.set(doc(db,'products',c.id),c.data)),...plan.updates.map(u=>b=>b.update(doc(db,'products',u.id),u.patch))];
  for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(f=>f(b));await b.commit()}
  UI.closeModal();toast(`تم: ${plan.creates.length} جديد، ${plan.updates.length} تحديث`);renderMain()}catch(err){toast(err.code==='permission-denied'?'الصلاحيات منعت الحفظ. راجع الشيت وحاول تاني.':err.message||'الحفظ ماكملش')}finally{busy=false}}
 window.ProductSheet={download,open,preview,commit};return window.ProductSheet}
