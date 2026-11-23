import { GOVERNORATES } from './egypt-locations-data.js?v=eg-1';
export { GOVERNORATES };
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const normalize=s=>String(s||'').normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064B-\u065F\u0670]/g,'').toLowerCase().trim();
export function findAreas(governorate,query=''){
 const gov=GOVERNORATES.find(g=>g.name===governorate),q=normalize(query);
 return (gov?.areas||[]).filter(a=>!q||[a.name,...a.aliases].some(n=>normalize(n).includes(q)));
}
export function areaOptions(gov,query='',selected=''){
 return '<option value="">اختار المدينة أو المنطقة</option>'+findAreas(gov,query).map(a=>`<option value="${esc(a.name)}" ${a.name===selected?'selected':''}>${esc(a.name)}</option>`).join('')+'<option value="__other__">منطقة أخرى، اكتبها</option>';
}
// Lists help enter an address. They do not promise service, delivery or coverage.
export function locationPicker(prefix,{required=false}={}){
 if(!/^[A-Za-z][A-Za-z0-9]*$/.test(prefix))throw Error('invalid-location-prefix');
 return `<fieldset class="location-picker" data-location="${prefix}"><legend>المحافظة والمنطقة${required?'':' (اختياري)'}</legend><div class="field"><label for="${prefix}Gov">المحافظة</label><select id="${prefix}Gov" ${required?'required':''} onchange="EgyptLocations.changeGovernorate('${prefix}')"><option value="">اختار المحافظة</option>${GOVERNORATES.map(g=>`<option value="${esc(g.name)}">${esc(g.name)}</option>`).join('')}</select></div><div class="field"><label for="${prefix}Search">ابحث عن مدينة أو منطقة</label><input id="${prefix}Search" type="search" disabled oninput="EgyptLocations.search('${prefix}')" placeholder="اكتب جزءًا من اسم المنطقة" autocomplete="off"></div><div class="field"><label for="${prefix}Area">المدينة / المنطقة</label><select id="${prefix}Area" disabled ${required?'required':''} onchange="EgyptLocations.changeArea('${prefix}')">${areaOptions('')}</select><p id="${prefix}Count" class="location-note" role="status">اختار المحافظة أولًا.</p></div><div class="field" id="${prefix}OtherField" hidden><label for="${prefix}Other">اسم المنطقة غير الموجودة</label><input id="${prefix}Other" maxlength="120" disabled></div><p class="location-note">هتلاقي المدن والأحياء الرئيسية هنا، بس ممكن بعض القرى والنجوع ما تكونش موجودة. اختيار المنطقة مش تأكيد إن التوصيل متاح فيها.</p><p id="${prefix}Error" class="password-error" role="alert"></p></fieldset>`;
}
export function installLocations(target=window,doc=document){
 const el=id=>doc.getElementById(id);
 const api={
 changeGovernorate(p){const gov=el(p+'Gov').value;el(p+'Search').value='';el(p+'Search').disabled=!gov;el(p+'Area').disabled=!gov;el(p+'Area').innerHTML=areaOptions(gov);el(p+'Count').textContent=gov?`${findAreas(gov).length} مدينة ومنطقة متاحة. تقدر تختار «منطقة أخرى» لو مش موجودة.`:'اختار المحافظة أولًا.';api.changeArea(p);},
 search(p){const gov=el(p+'Gov').value,q=el(p+'Search').value,current=el(p+'Area').value;el(p+'Area').innerHTML=areaOptions(gov,q,current);el(p+'Count').textContent=`${findAreas(gov,q).length} نتيجة. لو مش موجودة، اختار «منطقة أخرى، اكتبها».`;api.changeArea(p);},
 changeArea(p){const other=el(p+'Area').value==='__other__';el(p+'OtherField').hidden=!other;el(p+'Other').disabled=!other;el(p+'Error').textContent='';},
 read(p,{required=false}={}){const gov=el(p+'Gov')?.value||'',selected=el(p+'Area')?.value||'',other=el(p+'Other')?.value.trim()||'';let area=selected==='__other__'?other:selected;let error='';if(/[|\r\n]/.test(area))error='اكتب اسم المنطقة بدون فواصل رأسية أو أسطر جديدة.';if(required||gov||selected){if(error){}else if(!GOVERNORATES.some(g=>g.name===gov))error='اختار المحافظة.';else if(!area)error=selected==='__other__'?'اكتب اسم المنطقة.':'اختار المدينة أو المنطقة.';else if(selected!=='__other__'&&!findAreas(gov).some(a=>a.name===selected))error='راجع المنطقة التابعة للمحافظة.';}if(el(p+'Error'))el(p+'Error').textContent=error;if(error)throw Error(error);return {governorate:gov,area};},
 address(p,details=''){const loc=api.read(p);const original=String(details||'').trim();const text=loc.governorate?original.replace(/^المحافظة: [^|\r\n]+ \| المنطقة: [^|\r\n]+(?: \| |$)/,''):original;return loc.governorate?`المحافظة: ${loc.governorate} | المنطقة: ${loc.area}${text?' | '+text:''}`:text;}
 };
 target.EgyptLocations=api;return api;
}
