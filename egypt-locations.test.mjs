import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const dataURI=f=>'data:text/javascript;base64,'+Buffer.from(readFileSync(f)).toString('base64');
const source=readFileSync('egypt-locations.js','utf8').replace("'./egypt-locations-data.js?v=eg-1'",JSON.stringify(dataURI('egypt-locations-data.js')));
const p=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(p.GOVERNORATES.length,27);assert.equal(p.GOVERNORATES.reduce((n,g)=>n+g.areas.length,0),410);
assert.equal(new Set(p.GOVERNORATES.map(g=>g.id)).size,27);
for(const g of p.GOVERNORATES){assert.ok(g.areas.length);assert.equal(new Set(g.areas.map(a=>a.name)).size,g.areas.length)}
assert.ok(p.findAreas('القاهرة','نصر').length);assert.equal(p.findAreas('المحافظة المجهولة').length,0);assert.equal(p.findAreas('القاهرة','لن يوجد هذا المكان').length,0);assert.ok(p.findAreas('الإسكندرية','ابو قير').length);
assert.throws(()=>p.locationPicker('bad"'));assert.match(p.locationPicker('eg'),/منطقة أخرى/);assert.doesNotMatch(p.locationPicker('eg'),/كل مناطق مصر/);
const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',disabled:false,hidden:false,innerHTML:''});return els.get(id)};
const api=p.installLocations({}, {getElementById:el});
assert.deepEqual(api.read('x'),{governorate:'',area:''});assert.throws(()=>api.read('x',{required:true}),/المحافظة/);
el('xGov').value='الجيزة';api.changeGovernorate('x');assert.equal(el('xArea').disabled,false);assert.match(el('xArea').innerHTML,/الدقي/);assert.throws(()=>api.read('x'),/المنطقة/);
el('xArea').value='مدينة نصر';assert.throws(()=>api.read('x'),/التابعة/);
el('xArea').value='__other__';api.changeArea('x');assert.equal(el('xOtherField').hidden,false);assert.throws(()=>api.read('x'),/اكتب/);el('xOther').value='قرية تجربة';assert.equal(api.address('x','شارع 1'),'المحافظة: الجيزة | المنطقة: قرية تجربة | شارع 1');
el('xGov').value='';el('xArea').value='';api.changeGovernorate('x');assert.equal(api.address('x','العنوان القديم دون تغيير'),'العنوان القديم دون تغيير');
const html=readFileSync('index.html','utf8');
for(const prefix of ['af','rqLoc','memberLoc','meLoc','amLoc','mkLoc'])assert.ok(html.includes(`locationPicker('${prefix}'`));
// Run actual customer save handler: validate before writes, preserve existing field schema.
const ctx={window:{},EgyptLocations:api,document:{getElementById:el},UI:{toast(){},closeModal(){}},S:{user:{uid:'test'},myAddresses:[]},db:{},collection:()=>'',addDoc:async(c,d)=>ctx.writes.push(d),writes:[]};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('window.saveAddress ='),html.indexOf('window.deleteAddress =')),ctx);
el('afGov').value='';await ctx.window.saveAddress();assert.equal(ctx.writes.length,0);
el('afGov').value='الجيزة';el('afArea').value='الدقي';el('afStreet').value='شارع تجربة';el('afLabel').value='المنزل';await ctx.window.saveAddress();assert.equal(ctx.writes.length,1);assert.equal(ctx.writes[0].governorate,'الجيزة');assert.equal(ctx.writes[0].area,'الدقي');assert.match(ctx.writes[0].fullAddressText,/شارع تجربة/);
console.log('PASS 27 governorates / 410 areas, parent linkage, Arabic search, custom fallback, validation before write, legacy address preserved, six entry points');
if(process.argv.includes('--preview')){
 const css=html.match(/<style>([\s\S]*?)<\/style>/)[1]+readFileSync('brand.css','utf8');const picker=p.locationPicker('preview',{required:true}).replace('id="previewGov"','id="previewGov"').replace('<option value="الجيزة">','<option selected value="الجيزة">').replace('id="previewSearch" type="search" disabled','id="previewSearch" type="search" value="الدقي"').replace('id="previewArea" disabled','id="previewArea"').replace(p.areaOptions(''),p.areaOptions('الجيزة','الدقي','الدقي')).replace('اختار المحافظة أولًا.','نتيجة واحدة. تقدر تختار «منطقة أخرى» لو مش موجودة.');
 const head=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"><style>${css}body{padding:14px}.modal-sheet{max-height:none!important;max-width:480px;margin:auto}</style><body><section class="modal-sheet"><p class="location-note">معاينة للمراجعة، بيانات وهمية</p><h3>عنوان جديد</h3>`;
 writeFileSync('/downloads/egypt-address-preview.html',head+picker+'<div class="field"><label>الشارع</label><input value="شارع تجربة"></div><div class="field"><label>رقم العمارة / الشقة</label><input></div><button class="btn btn-primary">حفظ العنوان</button></section></html>');
 const other=picker.replace(p.areaOptions('الجيزة','الدقي','الدقي'),p.areaOptions('الجيزة') .replace('value="__other__"','selected value="__other__"')).replace('id="previewOtherField" hidden','id="previewOtherField"').replace('id="previewOther" maxlength="120" disabled','id="previewOther" maxlength="120" value="منطقة تجربة"');
 writeFileSync('/downloads/egypt-other-preview.html',head.replace('عنوان جديد','منطقة أخرى')+other+'<button class="btn btn-primary">حفظ العنوان</button></section></html>');
}
