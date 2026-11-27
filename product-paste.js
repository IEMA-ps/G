// Paste a price list (e.g. copied from WhatsApp) and turn each line into a product row. No AI, plain rules.
export const MAX_ROWS=100;
const AR='٠١٢٣٤٥٦٧٨٩',FA='۰۱۲۳۴۵۶۷۸۹';
export function digits(s){return String(s??'').replace(/[٠-٩]/g,c=>AR.indexOf(c)).replace(/[۰-۹]/g,c=>FA.indexOf(c)).replace(/[٫]/g,'.').replace(/٬/g,'');}
export const norm=s=>String(s??'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652\u0640]/g,'').replace(/\s+/g,' ').trim();
const PRICE_AFTER=/^\s*(?:ج\.?\s?م|جنيه|جنية|ج|egp|le|l\.e)(?![\u0621-\u064A])/i;
const PRICE_BEFORE=/(?:بسعر|سعر)\s*:?\s*$/;
const STOCK_AFTER=/^\s*(?:قطعه|قطعة|حبه|حبة|كرتونه|كرتونة|علبه|علبة|وحده|وحدة|عدد|pcs|pc)(?![\u0621-\u064A])/i;
const STOCK_BEFORE=/(?:كميه|كمية|مخزون|عدد|متوفر|الكميه|الكمية)\s*:?\s*$/;
const SIZE_AFTER=/^\s*(?:لتر|ل|كيلو|كجم|كغ|جرام|غرام|مل|سم|متر|جم(?!\.)|kg|g|ml|l|cm)(?![\u0621-\u064A])/i;
function clean(raw){
  let s=digits(raw).replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
  s=s.replace(/^[\s\-–—•*·▪✅✔☑🔸🔹🔸➡➤>]+/u,'');
  s=s.replace(/^\d{1,3}\s*[.)]\s*/,'').replace(/^\d{1,3}\s*[-–]\s+(?=\D)/,'');
  s=s.replace(/(\d),(\d{3})(?!\d)/g,'$1$2').replace(/(\d),(\d{1,2})(?!\d)/g,'$1.$2');
  return s.trim();
}
export function parseLine(raw){
  const s=clean(raw);if(!s||!/\d/.test(s))return null;
  const found=[];const re=/\d+(?:\.\d+)?/g;let m;
  while((m=re.exec(s))){
    const after=s.slice(m.index+m[0].length,m.index+m[0].length+14),before=s.slice(Math.max(0,m.index-12),m.index);
    let kind=null,len=m[0].length;
    if(SIZE_AFTER.test(after)&&!PRICE_AFTER.test(after))kind='size';
    else if(PRICE_AFTER.test(after)){kind='price';len+=after.match(PRICE_AFTER)[0].length;}
    else if(STOCK_AFTER.test(after)){kind='stock';len+=after.match(STOCK_AFTER)[0].length;}
    else if(PRICE_BEFORE.test(before))kind='price';
    else if(STOCK_BEFORE.test(before))kind='stock';
    found.push({start:m.index,end:m.index+len,v:m[0],kind});
  }
  let price=null,stock=null;const used=[];
  for(const f of found){if(f.kind==='price'&&price===null){price=f.v;used.push(f);}else if(f.kind==='stock'&&stock===null){stock=f.v;used.push(f);}}
  for(const f of found){if(f.kind)continue;if(price===null){price=f.v;used.push(f);}else if(stock===null){stock=f.v;used.push(f);}}
  let name='',pos=0;
  for(const f of used.sort((a,b)=>a.start-b.start)){name+=s.slice(pos,f.start)+' ';pos=f.end;}
  name+=s.slice(pos);
  name=name.replace(/(?:بسعر|سعر|كميه|كمية|مخزون|متوفر|الكميه|الكمية)\s*:?/g,' ').replace(/[\/|\\؛;،,:\t]+/g,' ').replace(/\s[-–—]+\s/g,' ').replace(/^[\s\-–—.]+|[\s\-–—.]+$/g,'').replace(/\s+/g,' ').trim();
  return {name,price,stock};
}
export function validate(r){
  const e=[];const name=String(r.name??'').replace(/\s+/g,' ').trim();
  const price=Number(digits(r.price));const stockRaw=digits(r.stock).trim();const stock=stockRaw===''?null:Number(stockRaw);
  if(!name||name.length>120)e.push('اسم المنتج ناقص أو طويل');
  if(String(r.price??'').trim()===''||!Number.isFinite(price)||price<=0||price>1e6||Math.abs(price*100-Math.round(price*100))>1e-6)e.push('السعر مش صحيح');
  if(stock!==null&&(!Number.isSafeInteger(stock)||stock<0||stock>1e6))e.push('الكمية لازم رقم صحيح');
  return {errors:e,name,price,stock};
}
// Returns rows ready for preview, plus how many lines were ignored (no digits at all, like headings).
export function parsePaste(text,existing=[]){
  const lines=String(text??'').split(/\r?\n/);const rows=[];let ignored=0;
  const mine=new Map((existing||[]).map(p=>[norm(p.title),p]));const seen=new Set();
  for(const l of lines){
    if(!l.trim())continue;
    const p=parseLine(l);if(!p){ignored++;continue;}
    if(rows.length>=MAX_ROWS)throw Error('الحد '+MAX_ROWS+' منتج في المرة الواحدة');
    const k=norm(p.name);const prev=k?mine.get(k):null;
    rows.push({name:p.name,price:p.price??'',stock:p.stock??'',existingId:prev?prev.id:null,existingPrice:prev?prev.price:null,dupInList:!!k&&seen.has(k),update:false});
    if(k)seen.add(k);
  }
  return {rows,ignored};
}
