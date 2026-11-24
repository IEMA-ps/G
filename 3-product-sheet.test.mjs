import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {zip,buildTemplate,readXlsx,parseSheet,applyMapping,planWrites,productIdFor,parseCSVRows,HEADERS} from './product-sheet.js';
const cats=[{id:'c1',name:'سوبر ماركت',isActive:true},{id:'c2',name:'مستلزمات منزلية',isActive:true},{id:'c3',name:'قديم',isActive:false}];
const buf=u=>u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength);
test('template round-trips through the reader',async()=>{const rows=await readXlsx(buf(buildTemplate()));assert.deepEqual(rows[0].slice(0,5),HEADERS);assert.equal(rows.length,1);});
const te=new TextEncoder();
function excelLike(table){const ss=[],idx=t=>{let i=ss.indexOf(t);if(i<0){ss.push(t);i=ss.length-1}return i};
 const rows=table.map((r,i)=>`<row r="${i+1}">${r.map((v,c)=>v===null?'':typeof v==='number'?`<c r="${'ABCDE'[c]}${i+1}"><v>${v}</v></c>`:`<c r="${'ABCDE'[c]}${i+1}" t="s"><v>${idx(v)}</v></c>`).join('')}</row>`).join('');
 return zip([['xl/worksheets/sheet1.xml',te.encode(`<worksheet><sheetData>${rows}</sheetData></worksheet>`)],['xl/sharedStrings.xml',te.encode(`<sst>${ss.map(t=>`<si><t>${t.replace(/&/g,'&amp;')}</t></si>`).join('')}</sst>`)]])}
test('reads Excel-style file (shared strings, numbers, Arabic digits)',async()=>{const f=excelLike([['اسم المنتج','النوع','السعر','الحجم','الكمية'],['أرز أبيض','سوبر ماركت',32.5,'كيس 1 كجم',20],['سائل غسيل','مستلزمات منزلية','٥٥ جنيه','1 لتر',null],['زيت','بقالة',95,'1 لتر',5],['سكر & ملح','سوبر ماركت',0,'1 كجم',null],['أرز أبيض','سوبر ماركت',33,'كيس 1 كجم',null]]);const p=parseSheet(await readXlsx(buf(f)),cats);
 assert.equal(p.rows.length,3);assert.equal(p.rows[0].price,32.5);assert.equal(p.rows[1].price,55);assert.equal(p.rows[1].categoryId,'c2');assert.equal(p.rows[2].categoryId,null);assert.deepEqual(p.unmatchedTypes,['بقالة']);
 assert.equal(p.errors.length,2);assert.match(p.errors[0].errors[0],/السعر/);assert.match(p.errors[1].errors.join(),/مكرر مع سطر 2/);});
test('unmatched type needs a mapping',()=>{const p=parseSheet([['الاسم','النوع','السعر','الحجم'],['س','بقالة',5,'ك']],cats);assert.throws(()=>applyMapping(p.rows,{},cats,10),/اختار قسم/);assert.throws(()=>applyMapping(p.rows,{'بقالة':'c3'},cats,10),/اختار قسم/);assert.equal(applyMapping(p.rows,{'بقالة':'c1'},cats,10)[0].stock,10);});
test('missing column and limits',()=>{assert.throws(()=>parseSheet([['الاسم','السعر']],cats),/ناقص عمود/);assert.throws(()=>parseSheet([['الاسم','النوع','السعر','الحجم']],cats),/مفيش منتجات/);});
test('re-upload updates same name+size, creates new, keeps stock when blank',()=>{const p=parseSheet([['الاسم','النوع','السعر','الحجم','الكمية'],['أرز  أبيض','سوبر ماركت','40','كيس 1 كجم',''],['عدس','سوبر ماركت','20','1 كجم','7']],cats);const rows=applyMapping(p.rows,{},cats,10);
 const id=productIdFor('m1','أرز أبيض','كيس 1 كجم');const plan=planWrites(rows,'m1',new Map([[id,{oldPrice:50}]]));
 assert.equal(plan.updates.length,1);assert.equal(plan.updates[0].patch.price,40);assert.equal('stock' in plan.updates[0].patch,false);assert.equal(plan.updates[0].patch.discountPercent,20);
 assert.equal(plan.creates.length,1);assert.equal(plan.creates[0].data.stock,7);assert.equal(plan.creates[0].data.merchantId,'m1');assert.equal(plan.creates[0].data.catalogId,undefined);});
test('csv fallback',()=>{assert.deepEqual(parseCSVRows('\uFEFFa,"b,c"\r\n1,2'),[['a','b,c'],['1','2']]);});
