// Services section: clinics, teachers, home maintenance. A provider is a normal merchant record whose activityType is one of SERVICE_TYPES.
export const SERVICE_TYPES=['عيادات','مدرسين','صيانة منزلية'];
export const SLOT_OPTIONS=[15,20,30,45,60];
export const DAY_NAMES=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
export const STATUS_LABEL={PENDING:'مستني رد المزود',ACCEPTED:'مقبول',REJECTED:'مرفوض',CANCELLED:'ملغي',DONE:'تم',NO_SHOW:'لم يحضر'};
export const isServiceProvider=m=>!!m&&SERVICE_TYPES.includes(String(m.activityType||'').trim());
export const servicesEnabled=s=>s?.servicesEnabled===true;
const HM=/^([01]\d|2[0-3]):[0-5]\d$/,DATE=/^\d{4}-\d{2}-\d{2}$/;
export const defaultSchedule=()=>({slotMinutes:30,closedDates:[],oneOffs:[],days:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[String(d),{on:d!==5,from:'10:00',to:'18:00'}]))});
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const fromMin=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function normalizeSchedule(raw){
  const d=defaultSchedule();if(!raw||typeof raw!=='object')return d;
  const slot=SLOT_OPTIONS.includes(raw.slotMinutes)?raw.slotMinutes:d.slotMinutes;
  const days={};
  for(const k of Object.keys(d.days)){const r=raw.days?.[k];const ok=r&&HM.test(r.from||'')&&HM.test(r.to||'')&&toMin(r.to)>toMin(r.from);days[k]=ok?{on:r.on===true,from:r.from,to:r.to}:d.days[k];}
  const closed=Array.isArray(raw.closedDates)?[...new Set(raw.closedDates.filter(x=>typeof x==='string'&&DATE.test(x)))].sort().slice(0,60):[];
  const rawOO=Array.isArray(raw.oneOffs)?raw.oneOffs:Array.isArray(raw.days?.oneOffs)?raw.days.oneOffs:[];
  const seen=new Set(),oneOffs=rawOO.filter(o=>o&&typeof o.date==='string'&&DATE.test(o.date)&&HM.test(o.from||'')&&HM.test(o.to||'')&&toMin(o.to)>toMin(o.from)).map(o=>({date:o.date,from:o.from,to:o.to})).filter(o=>{const k=o.date+o.from+o.to;if(seen.has(k))return false;seen.add(k);return true;}).sort((x,y)=>(x.date+x.from).localeCompare(y.date+y.from)).slice(0,60);
  return {slotMinutes:slot,closedDates:closed,days,oneOffs};
}
// stored shape: oneOffs lives inside the existing `days` map (days.oneOffs) so the published rules accept it unchanged.
export const scheduleForSave=sch=>({slotMinutes:sch.slotMinutes,closedDates:sch.closedDates,days:{...sch.days,oneOffs:sch.oneOffs||[]}});
export function cairoNow(ms=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
export function dateOptions(ms=Date.now(),n=14){const t=cairoNow(ms).date;return Array.from({length:n},(_,i)=>addDays(t,i));}
// times that can still be booked on `date`. booked: Set of 'HH:MM' that are active.
export function slotsFor(schedule,date,booked=new Set(),ms=Date.now()){
  const s=normalizeSchedule(schedule),day=s.days[String(weekday(date))],now=cairoNow(ms);
  if(!DATE.test(date)||s.closedDates.includes(date)||date<now.date)return [];
  const ranges=[];if(day.on)ranges.push(day);for(const o of s.oneOffs)if(o.date===date)ranges.push(o);
  const all=new Set();
  for(const r of ranges)for(let t=toMin(r.from);t+s.slotMinutes<=toMin(r.to);t+=s.slotMinutes)all.add(fromMin(t));
  return [...all].sort().filter(hm=>!(date===now.date&&hm<=now.time)&&!booked.has(hm));
}
export const bookingId=(mid,date,time)=>`${mid}_${date}_${time.replace(':','')}`;
export function validBookingInput({date,time,name,phone,note},schedule,booked,ms=Date.now()){
  const n=String(name||'').trim(),p=String(phone||'').replace(/[\s\-]/g,''),nt=String(note||'').trim();
  if(!n||n.length>80)throw Error('اكتب اسمك');
  if(!/^(\+?20|0)?1[0125]\d{8}$/.test(p))throw Error('رقم الموبايل مش صحيح');
  if(nt.length>300)throw Error('الملاحظة أطول من 300 حرف');
  if(!slotsFor(schedule,date,booked,ms).includes(time))throw Error('الميعاد ده مش متاح، اختار ميعاد تاني');
  return {name:n,phone:p,note:nt};
}
export const fmtDay=date=>`${DAY_NAMES[weekday(date)]} ${date.slice(8)}/${date.slice(5,7)}`;
export const fmtTime=hm=>{const [h,m]=hm.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'ص':'م'}`;};
export function providerStats(bookings,ms=Date.now()){
  const t=cairoNow(ms).date,live=(bookings||[]).filter(b=>['PENDING','ACCEPTED'].includes(b.status));
  return {pending:live.filter(b=>b.status==='PENDING').length,today:live.filter(b=>b.date===t&&b.status==='ACCEPTED').length,upcoming:live.filter(b=>b.date>=t).length};
}
// ---- HTML ----
const field=(id,label,v,esc)=>`<div class="field"><label>${label}</label>${v}</div>`;
export function scheduleEditorHTML(schedule,esc,mode='weekly'){
  const s=normalizeSchedule(schedule),wk=mode!=='once';
  const week=DAY_NAMES.map((n,i)=>{const d=s.days[String(i)];return `<div class="row-between" style="gap:8px;margin:8px 0;align-items:center"><label style="min-width:78px"><input type="checkbox" id="schOn${i}" ${d.on?'checked':''}> ${n}</label><input type="time" id="schFrom${i}" value="${d.from}" style="width:110px"><span>إلى</span><input type="time" id="schTo${i}" value="${d.to}" style="width:110px"></div>`;}).join('');
  const once=`<div class="field"><label>التاريخ</label><input type="date" id="schOoDate"></div>
    <div class="row-between" style="gap:8px;margin:8px 0;align-items:center"><span>من</span><input type="time" id="schOoFrom" value="10:00" style="width:110px"><span>إلى</span><input type="time" id="schOoTo" value="14:00" style="width:110px"></div>
    <button class="btn btn-ghost btn-sm" style="width:auto" onclick="addOneOff()">إضافة الميعاد</button>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${s.oneOffs.length?s.oneOffs.map((o,i)=>`<div class="row-between" style="gap:8px"><span style="font-size:13px">${fmtDay(o.date)} · ${fmtTime(o.from)} إلى ${fmtTime(o.to)}</span><button class="btn btn-ghost btn-sm" style="width:auto" onclick="removeOneOff(${i})">حذف</button></div>`).join(''):'<span class="welcome-note" style="margin:0">مفيش مواعيد لمرة واحدة.</span>'}</div>`;
  return `<div class="card" style="margin-bottom:14px"><b>مواعيد الشغل</b>
    <div class="field" style="margin-top:10px"><label>مدة الحجز</label><select id="schSlot">${SLOT_OPTIONS.map(n=>`<option value="${n}" ${s.slotMinutes===n?'selected':''}>${n} دقيقة</option>`).join('')}</select></div>
    <div class="row-between" style="gap:14px;justify-content:flex-start;margin:6px 0 10px"><label><input type="radio" name="schMode" id="schModeW" ${wk?'checked':''} onchange="setSchMode('weekly')"> كل أسبوع في يوم محدد</label><label><input type="radio" name="schMode" id="schModeO" ${wk?'':'checked'} onchange="setSchMode('once')"> مرة واحدة</label></div>
    <div id="schWeekly" class="${wk?'':'hidden'}">${week}</div>
    <div id="schOnce" class="${wk?'hidden':''}">${once}</div>
    <div class="field"><label>أيام إجازة (اختياري)</label><div style="display:flex;gap:8px"><input type="date" id="schClosedAdd"><button class="btn btn-ghost btn-sm" style="width:auto" onclick="addClosedDate()">إضافة</button></div>
    <div id="schClosedList" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${s.closedDates.map(d=>`<span class="badge-chip" onclick="removeClosedDate('${d}')" style="cursor:pointer">${d} ✕</span>`).join('')}</div></div>
    <button class="btn btn-primary" onclick="saveProviderSchedule()">حفظ المواعيد</button></div>`;
}
export function readScheduleForm(get,closed,oneOffs=[]){
  const days={};for(let i=0;i<7;i++)days[String(i)]={on:!!get('schOn'+i,'checked'),from:get('schFrom'+i,'value'),to:get('schTo'+i,'value')};
  for(const [k,d] of Object.entries(days))if(d.on&&!(HM.test(d.from)&&HM.test(d.to)&&toMin(d.to)>toMin(d.from)))throw Error(`ساعات ${DAY_NAMES[+k]} مش مظبوطة`);
  return normalizeSchedule({slotMinutes:Number(get('schSlot','value')),days,closedDates:closed,oneOffs});
}
export function bookedSetFor(booked,date){return new Set([...(booked||[])].filter(x=>x.startsWith(date+'|')).map(x=>x.split('|')[1]));}
export function bookingPanelHTML({m,schedule,booked,date,time,profile},esc,ms=Date.now()){
  const bf=d=>bookedSetFor(booked,d);
  const days=dateOptions(ms),sel=days.includes(date)?date:days.find(d=>slotsFor(schedule,d,bf(d),ms).length)||days[0],slots=slotsFor(schedule,sel,bf(sel),ms);
  return `<div class="card" id="bookPanel" style="margin-bottom:16px"><h3 style="margin:0 0 10px">احجز ميعاد</h3>
    <div class="cat-scroll" style="margin-bottom:10px">${days.map(d=>{const n=slotsFor(schedule,d,bf(d),ms).length;return `<div class="cat-chip ${d===sel?'active':''}" ${n?`onclick="pickBookDate('${esc(m.id)}','${d}')"`:'style="opacity:.45"'}><span>${fmtDay(d)}</span><span style="font-weight:400">${n?n+' ميعاد':'مقفول'}</span></div>`;}).join('')}</div>
    ${slots.length?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">${slots.map(t=>`<button class="btn ${t===time?'btn-primary':'btn-ghost'} btn-sm" style="width:auto" onclick="pickBookTime('${esc(m.id)}','${sel}','${t}')">${fmtTime(t)}</button>`).join('')}</div>`:'<p class="hint-box">مفيش مواعيد فاضية فى اليوم ده.</p>'}
    ${time&&slots.includes(time)?`<div class="field"><label>اسمك</label><input id="bkName" maxlength="80" value="${esc(profile?.firstName||'')} ${esc(profile?.lastName||'')}"></div>
    <div class="field"><label>موبايلك</label><input id="bkPhone" inputmode="tel" value="${esc(profile?.phone||'')}"></div>
    <div class="field"><label>ملاحظة (اختياري)</label><textarea id="bkNote" maxlength="300" placeholder="مثال: سبب الزيارة أو المادة أو العطل"></textarea></div>
    <button class="btn btn-primary" onclick="submitBooking('${esc(m.id)}','${sel}','${time}')">أرسل طلب الحجز: ${fmtDay(sel)} ${fmtTime(time)}</button>
    <p class="welcome-note">الطلب بيوصل للمزود وهو اللى بيأكد الميعاد. الدفع بينك وبينه مباشرة.</p>`:''}</div>`;
}
export function bookingCardHTML(b,esc,role){
  const st=b.status,prov=role==='provider',phone=(prov?b.customerPhone:b.merchantPhone)||'';
  const wa=phone?`<a class="btn btn-ghost btn-sm" style="width:auto" target="_blank" href="https://wa.me/${esc(String(phone).replace(/\D/g,'').replace(/^0/,'20'))}"><i class="fa-brands fa-whatsapp"></i> واتساب</a>`:'';
  const acts=prov?(st==='PENDING'?`<button class="btn btn-primary btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','ACCEPTED')">قبول</button><button class="btn btn-danger btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','REJECTED')">رفض</button>`:st==='ACCEPTED'?`<button class="btn btn-primary btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','DONE')">تم</button><button class="btn btn-ghost btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','NO_SHOW')">لم يحضر</button><button class="btn btn-danger btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','REJECTED')">إلغاء</button>`:''):(['PENDING','ACCEPTED'].includes(st)?`<button class="btn btn-danger btn-sm" style="width:auto" onclick="cancelMyBooking('${esc(b.id)}')">إلغاء الحجز</button>`:'');
  return `<div class="card"><div class="row-between"><b>${esc(prov?b.customerName:b.merchantName)}</b><span class="status-pill ${st==='ACCEPTED'||st==='DONE'?'status-active':st==='PENDING'?'status-pending':'status-suspended'}">${STATUS_LABEL[st]||st}</span></div>
    <div style="font-size:13px;margin:6px 0">${fmtDay(b.date)} · ${fmtTime(b.time)}</div>${b.note?`<div style="font-size:12.5px;color:var(--ink-soft)">${esc(b.note)}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${acts}${wa}</div></div>`;
}
export function providerScheduleViewHTML(bookings,esc,ms=Date.now()){
  const t=cairoNow(ms).date,live=(bookings||[]).filter(b=>['PENDING','ACCEPTED'].includes(b.status)&&b.date>=t).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const by={};live.forEach(b=>(by[b.date]=by[b.date]||[]).push(b));
  return Object.keys(by).length?Object.entries(by).map(([d,list])=>`<div class="section-head"><h3>${fmtDay(d)}${d===t?' (النهاردة)':''}</h3></div><div class="list-gap">${list.map(b=>bookingCardHTML(b,esc,'provider')).join('')}</div>`).join(''):'<p class="hint-box">مفيش حجوزات جاية لسه.</p>';
}
export function serviceListHTML(providers,type,esc){
  const list=providers.filter(m=>!type||m.activityType===type);
  return `<div class="cat-scroll" style="margin-bottom:12px"><div class="cat-chip ${!type?'active':''}" onclick="setServiceType('')"><span>الكل</span></div>${SERVICE_TYPES.map(t=>`<div class="cat-chip ${type===t?'active':''}" onclick="setServiceType('${t}')"><span>${t}</span></div>`).join('')}</div>`
   +(list.length?`<div class="list-gap">${list.map(m=>`<div class="merchant-card" onclick="openMerchant('${esc(m.id)}')"><div class="logo">${m.logoUrl?`<img src="${esc(m.logoUrl)}">`:'<i class="fa-solid fa-user-doctor"></i>'}</div><div class="info"><h4>${esc(m.businessName)}</h4><div class="meta">${esc(m.activityType)}${m.address?' · '+esc(m.address):''}</div></div></div>`).join('')}</div>`:'<p class="hint-box">مفيش مزودين فى القسم ده لسه.</p>');
}

export function makeOneOff({date,from,to},ms=Date.now()){
  if(!DATE.test(date||''))throw Error('اختار التاريخ');
  if(date<cairoNow(ms).date)throw Error('التاريخ ده عدّى');
  if(!(HM.test(from||'')&&HM.test(to||'')&&toMin(to)>toMin(from)))throw Error('الساعات مش مظبوطة');
  return {date,from,to};
}
