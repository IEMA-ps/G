// Shared catalog logic. No merchant prices or inventory belong in base records.
export const CATALOG_FIELDS=['sku','title','description','categoryId','unit','barcode','source','rightsConfirmed'];
export function safeKey(value){
 const key=String(value||'').trim();
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw Error('كود المنتج لازم يكون حروف إنجليزية أو أرقام أو - أو _، بحد أقصى 64 حرف');
 return key;
}
export function catalogEntry(row,categories){
 const d={};for(const k of CATALOG_FIELDS)d[k]=String(row[k]??'').trim();
 d.sku=safeKey(d.sku);
 if(!d.title||d.title.length>160||d.description.length>1200||!d.unit||d.unit.length>80||d.barcode.length>64||!d.source||d.source.length>300)throw Error('راجع الاسم والوحدة ومصدر البيانات وأطوال الحقول');
 if(!categories.some(c=>c.id===d.categoryId&&c.isActive!==false))throw Error('اختار قسم موجود ومفعّل');
 if(row.rightsConfirmed!==true)throw Error('لازم تأكد إن عندك حق استخدام بيانات المنتجات');
 d.rightsConfirmed=true;return d;
}
export function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');
 if(text.length>500000)throw Error('الملف أكبر من الحد المسموح');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted){quoted=!quoted;}else throw Error('تنسيق CSV غير صحيح');}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('علامة تنصيص غير مقفولة في الملف');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 const headers=rows.shift()||[];
 if(new Set(headers).size!==headers.length||headers.some(k=>!CATALOG_FIELDS.includes(k)||k==='rightsConfirmed')||!['sku','title','categoryId','unit','source'].every(k=>headers.includes(k)))throw Error('عناوين الملف المطلوبة: sku,title,description,categoryId,unit,barcode,source');
 if(!rows.length||rows.length>100)throw Error('كل دفعة من 1 إلى 100 منتج');
 const seen=new Set();return rows.map(values=>{if(values.length!==headers.length)throw Error('عدد الأعمدة مش متساوي');const r=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));r.sku=safeKey(r.sku);if(seen.has(r.sku))throw Error('كود مكرر داخل الملف: '+r.sku);seen.add(r.sku);return r;});
}
export function offerId(mid,sku){return 'catalog_'+encodeURIComponent(mid)+'_'+safeKey(sku);}
export function offerData(base,mid,price,stock){
 if(!base||base.isActive!==true)throw Error('المنتج مش متاح للتفعيل');
 if(!mid)throw Error('المتجر غير مربوط بالحساب');
 if(String(price).trim()===''||!Number.isFinite(Number(price))||Number(price)<=0||Number(price)>1000000||Math.abs(Number(price)*100-Math.round(Number(price)*100))>0.00001)throw Error('اكتب سعر صحيح أكبر من صفر بحد أقصى منزلتين عشريتين');
 if(String(stock).trim()===''||!Number.isSafeInteger(Number(stock))||Number(stock)<0||Number(stock)>1000000)throw Error('اكتب كمية صحيحة من 0 إلى مليون');
 const id=offerId(mid,base.sku);
 return {id,catalogId:base.sku,catalogVersion:base.version,merchantId:mid,title:base.title,description:base.description,categoryId:base.categoryId,unit:base.unit,barcode:base.barcode,price:Number(price),stock:Number(stock),imageUrl:'',isActive:true,isPopular:false,isNew:true,rating:0,oldPrice:null,discountPercent:0,flashPrice:null,flashEndsAt:null,groupDiscountPercent:0,groupMinParticipants:3};
}
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Explicit preview-time mapping from CSV labels/tokens to current active category IDs.
export function mapCatalogRows(rows,mapping,categories){
 return rows.map(row=>{
  const id=mapping[row.categoryId];
  if(!id||!categories.some(c=>c.id===id&&c.isActive!==false))throw Error('اربط كل قسم في الملف بقسم مفعّل في البرنامج');
  return catalogEntry({...row,categoryId:id,rightsConfirmed:true},categories);
 });
}
