// Services section: clinics, teachers, home maintenance. A provider is a normal merchant record whose activityType is one of SERVICE_TYPES.
export const SERVICE_TYPES=['عيادات','مدرسين','صيانة منزلية','تدريب بدني شخصي','حلاقة رجالي','صالون تجميل وميك أب','تنظيف منازل','غسيل سجاد وكنب','نقل أثاث وونش','صيانة سيارات','غسيل سيارات متنقل','تصوير','تنظيم حفلات','رعاية أطفال وكبار','بيطري وخدمات حيوانات'];
export const SLOT_OPTIONS=[15,20,30,45,60];
export const DAY_NAMES=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
export const STATUS_LABEL={PENDING:'مستني رد مقدم الخدمة',ACCEPTED:'مقبول',REJECTED:'مرفوض',CANCELLED:'ملغي',DONE:'تم',NO_SHOW:'لم يحضر'};
export const isServiceProvider=m=>!!m&&SERVICE_TYPES.includes(String(m.activityType||'').trim());
export const servicesEnabled=s=>s?.servicesEnabled===true;
const HM=/^([01]\d|2[0-3]):[0-5]\d$/,DATE=/^\d{4}-\d{2}-\d{2}$/;
export const defaultSchedule=()=>({slotMinutes:30,closedDates:[],days:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[String(d),{on:d!==5,from:'10:00',to:'18:00'}]))});
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const fromMin=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function normalizeSchedule(raw){
  const d=defaultSchedule();if(!raw||typeof raw!=='object')return d;
  const slot=SLOT_OPTIONS.includes(raw.slotMinutes)?raw.slotMinutes:d.slotMinutes;
  const days={};
  for(const k of Object.keys(d.days)){const r=raw.days?.[k];const ok=r&&HM.test(r.from||'')&&HM.test(r.to||'')&&toMin(r.to)>toMin(r.from);days[k]=ok?{on:r.on===true,from:r.from,to:r.to}:d.days[k];}
  const closed=Array.isArray(raw.closedDates)?[...new Set(raw.closedDates.filter(x=>typeof x==='string'&&DATE.test(x)))].sort().slice(0,60):[];
  const cap=Number.isInteger(raw.capacity)&&raw.capacity>=1&&raw.capacity<=20?raw.capacity:1;
  return {slotMinutes:slot,closedDates:closed,days,...(cap>1?{capacity:cap}:{})};
}
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
  if(!DATE.test(date)||!day.on||s.closedDates.includes(date)||date<now.date)return [];
  const out=[];for(let t=toMin(day.from);t+s.slotMinutes<=toMin(day.to);t+=s.slotMinutes){const hm=fromMin(t);if(date===now.date&&hm<=now.time)continue;if(!booked.has(hm))out.push(hm);}
  return out;
}
// سعة الميعاد: كام حجز في نفس الميعاد (مدرس مع مجموعة طلاب). الافتراضي 1 زي ما كان. المقعد الأول رقمه زي الأول بالظبط، والمقاعد بعده فيها _s2 _s3.
export const CAPACITY_OPTIONS=[1,2,3,4,5,6,8,10,15,20];
export const capacityOf=schedule=>normalizeSchedule(schedule).capacity||1;
export const bookingId=(mid,date,time,seat=1)=>`${mid}_${date}_${time.replace(':','')}${seat>1?'_s'+seat:''}`;
export const seatKey=(date,time,seat=1)=>seat>1?`${date}|${time}|${seat}`:`${date}|${time}`;
// أول مقعد فاضي في الميعاد (null لو الميعاد اتملا). booked: Set من seatKey.
export function seatFor(booked,date,time,cap=1){for(let k=1;k<=cap;k++)if(!(booked&&booked.has(seatKey(date,time,k))))return k;return null;}
// صيانة منزلية: العميل لازم يكتب العطل والعنوان عشان الصنايعي يجهز نفسه. بيتخزنوا جوه حقل note (300 حرف) من غير تغيير في قواعد Firebase.
export const CRAFT_TYPE='صيانة منزلية';
export const isCraft=m=>!!m&&String(m.activityType||'').trim()===CRAFT_TYPE;
export function craftNote({problem,address}){
  const p=String(problem||'').trim(),a=String(address||'').trim();
  if(p.length<3)throw Error('اكتب العطل أو المشكلة');
  if(p.length>140)throw Error('وصف العطل أطول من 140 حرف');
  if(a.length<5)throw Error('اكتب العنوان بالتفصيل');
  if(a.length>90)throw Error('العنوان أطول من 90 حرف');
  return `العطل: ${p}\nالعنوان: ${a}`;
}
// تدريب بدني شخصي: الهدف والمستوى ومكان الجلسة (اختيار) + ملاحظات صحية اختيارية، جوه حقل note من غير تغيير في الحقول.
export const TRAINER_TYPE='تدريب بدني شخصي';
export const isTrainer=m=>!!m&&String(m.activityType||'').trim()===TRAINER_TYPE;
export const TRAINER_GOALS=['خسارة وزن','زيادة عضل','لياقة عامة','تأهيل بعد إصابة','تحضير لرياضة'];
export const TRAINER_LEVELS=['مبتدئ','متوسط','متقدم'];
export const TRAINER_PLACES=['عند المدرب','في بيتي','في الهواء الطلق'];
export function trainerNote({goal,level,place,extra}){
  if(!TRAINER_GOALS.includes(goal))throw Error('اختار هدفك من التمرين');
  if(!TRAINER_LEVELS.includes(level))throw Error('اختار مستوى لياقتك');
  if(!TRAINER_PLACES.includes(place))throw Error('اختار مكان الجلسة');
  const x=String(extra||'').trim();
  if(x.length>120)throw Error('الملاحظات أطول من 120 حرف');
  return `الهدف: ${goal}\nالمستوى: ${level}\nالمكان: ${place}`+(x?`\nملاحظات صحية: ${x}`:'');
}
// أنواع خدمات تانية: كل نوع ليه حقول بسيطة (اختيار أو نص قصير) بتتجمع في حقل note الموجود (300 حرف). [الاسم, النوع, الاختيارات أو أقصى طول, إجباري]
export const TYPE_FIELDS={"حلاقة رجالي": [["الخدمة", "select", ["قص شعر", "دقن", "قص شعر ودقن", "حلاقة عريس"], 1], ["المكان", "select", ["في الصالون", "في البيت"], 1], ["ملاحظات", "text", 60, 0]], "صالون تجميل وميك أب": [["الخدمة", "select", ["شعر", "ميك أب", "أظافر", "بشرة", "عروسة"], 1], ["المكان", "select", ["في الصالون", "في البيت"], 1], ["ملاحظات", "text", 60, 0]], "تنظيف منازل": [["نوع التنظيف", "select", ["عادي", "عميق", "بعد تشطيب"], 1], ["حجم المكان", "select", ["شقة صغيرة", "شقة متوسطة", "شقة كبيرة", "فيلا"], 1], ["العنوان", "text", 90, 1]], "غسيل سجاد وكنب": [["القطع", "select", ["سجاد", "كنب", "ستائر", "مراتب", "أكتر من نوع"], 1], ["العدد التقريبي", "text", 30, 1], ["العنوان", "text", 90, 1]], "نقل أثاث وونش": [["الخدمة", "select", ["نقل أثاث", "ونش", "نقل وفك وتركيب"], 1], ["من عنوان", "text", 90, 1], ["إلى عنوان", "text", 90, 1]], "صيانة سيارات": [["نوع السيارة وموديلها", "text", 60, 1], ["العطل", "text", 140, 1], ["المكان", "select", ["في الورشة", "في مكاني"], 1]], "غسيل سيارات متنقل": [["حجم السيارة", "select", ["صغيرة", "سيدان", "SUV", "ميني فان"], 1], ["نوع الغسيل", "select", ["خارجي", "داخلي", "كامل"], 1], ["العنوان", "text", 90, 1]], "تصوير": [["المناسبة", "select", ["فرح", "خطوبة", "عيد ميلاد", "منتجات", "بورتريه", "أخرى"], 1], ["مكان التصوير", "text", 90, 1], ["ملاحظات", "text", 80, 0]], "تنظيم حفلات": [["نوع الحفل", "select", ["فرح", "خطوبة", "عيد ميلاد", "شركات", "أخرى"], 1], ["عدد الحضور", "select", ["أقل من 30", "30 إلى 100", "100 إلى 300", "أكتر من 300"], 1], ["مكان الحفل", "text", 90, 1]], "رعاية أطفال وكبار": [["الرعاية لـ", "select", ["طفل", "كبير سن"], 1], ["المدة", "select", ["ساعات", "يوم كامل", "مبيت"], 1], ["العنوان", "text", 90, 1], ["ملاحظات", "text", 60, 0]], "بيطري وخدمات حيوانات": [["الحيوان", "select", ["قطة", "كلب", "طيور", "أخرى"], 1], ["الخدمة", "select", ["كشف", "تطعيم", "استحمام وتجميل", "إقامة"], 1], ["ملاحظات", "text", 80, 0]], "عيادات": [["نوع الزيارة", "select", ["كشف جديد", "متابعة", "استشارة"], 1], ["سبب الزيارة (اختياري)", "text", 80, 0]]};
export function typeNote(type,values){
  const fs=TYPE_FIELDS[String(type||'').trim()];if(!fs)throw Error('نوع الخدمة غير معروف');
  const out=[];
  fs.forEach(([label,kind,opt,req],i)=>{
    const v=String(values&&values[i]!=null?values[i]:'').trim();
    if(!v){if(req)throw Error(kind==='select'?'اختار: '+label:'اكتب: '+label);return;}
    if(kind==='select'&&!opt.includes(v))throw Error('اختيار غير صحيح: '+label);
    if(kind==='text'&&v.length>opt)throw Error(label+' أطول من '+opt+' حرف');
    out.push(label+': '+v);
  });
  return out.join('\n');
}
export const typeFieldsHTML=(type,esc)=>(TYPE_FIELDS[String(type||'').trim()]||[]).map(([label,kind,opt,req],i)=>kind==='select'
  ?`<div class="field"><label>${esc(label)}${req?' *':''}</label><select id="bkF${i}"><option value="">اختار</option>${opt.map(o=>`<option>${esc(o)}</option>`).join('')}</select></div>`
  :`<div class="field"><label>${esc(label)}${req?' *':''}</label><input id="bkF${i}" maxlength="${opt}"></div>`).join('');
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
export function scheduleEditorHTML(schedule,esc,capOn=false){
  const s=normalizeSchedule(schedule);
  return `<div class="card" style="margin-bottom:14px"><b>مواعيد التشغيل</b>
    <div class="field" style="margin-top:10px"><label>مدة الحجز</label><select id="schSlot">${SLOT_OPTIONS.map(n=>`<option value="${n}" ${s.slotMinutes===n?'selected':''}>${n} دقيقة</option>`).join('')}</select></div>
    ${capOn?`<div class="field"><label>عدد الحجوزات المسموح في نفس الميعاد</label><select id="schCap">${CAPACITY_OPTIONS.map(n=>`<option value="${n}" ${(s.capacity||1)===n?'selected':''}>${n===1?'حجز واحد (الوضع العادي)':n+' حجوزات (مجموعة)'}</option>`).join('')}</select><p class="welcome-note" style="margin:6px 0 0">للمدرس اللي بياخد أكتر من طالب في الساعة.</p></div>`:''}
    ${DAY_NAMES.map((n,i)=>{const d=s.days[String(i)];return `<div class="row-between" style="gap:6px;margin:8px 0;align-items:center"><label style="min-width:70px;flex-shrink:0"><input type="checkbox" id="schOn${i}" ${d.on?'checked':''}> ${n}</label><input type="time" id="schFrom${i}" value="${d.from}" style="width:0;min-width:0;flex:1"><span>إلى</span><input type="time" id="schTo${i}" value="${d.to}" style="width:0;min-width:0;flex:1"></div>`;}).join('')}
    <div class="field"><label>أيام إجازة (اختياري)</label><div style="display:flex;gap:8px"><input type="date" id="schClosedAdd"><button class="btn btn-ghost btn-sm" style="width:auto" onclick="addClosedDate()">إضافة</button></div>
    <div id="schClosedList" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${s.closedDates.map(d=>`<span class="badge-chip" onclick="removeClosedDate('${d}')" style="cursor:pointer">${d} ✕</span>`).join('')}</div></div>
    <button class="btn btn-primary" onclick="saveProviderSchedule()">حفظ المواعيد</button></div>`;
}
export function readScheduleForm(get,closed){
  const days={};for(let i=0;i<7;i++)days[String(i)]={on:!!get('schOn'+i,'checked'),from:get('schFrom'+i,'value'),to:get('schTo'+i,'value')};
  for(const [k,d] of Object.entries(days))if(d.on&&!(HM.test(d.from)&&HM.test(d.to)&&toMin(d.to)>toMin(d.from)))throw Error(`ساعات ${DAY_NAMES[+k]} مش مظبوطة`);
  return normalizeSchedule({slotMinutes:Number(get('schSlot','value')),capacity:Number(get('schCap','value'))||1,days,closedDates:closed});
}
// الأوقات اللي اتملت (عدد الحجوزات وصل للسعة) في اليوم ده.
export function bookedSetFor(booked,date,cap=1){const n={};for(const x of booked||[])if(x.startsWith(date+'|')){const t=x.split('|')[1];n[t]=(n[t]||0)+1;}return new Set(Object.keys(n).filter(t=>n[t]>=cap));}
export const WEEK_CHOICES=[4,8,12];
// dates of a weekly series starting at `date`; ok=false when that week's time is already taken or closed.
export function seriesInfo({schedule,booked,date,time,weeks},ms=Date.now()){
  const n=WEEK_CHOICES.includes(weeks)?weeks:WEEK_CHOICES[0];
  return Array.from({length:n},(_,i)=>{const d=addDays(date,7*i);return {date:d,ok:slotsFor(schedule,d,bookedSetFor(booked,d,capacityOf(schedule)),ms).includes(time)};});
}
export function bookingPanelHTML({m,schedule,booked,date,time,profile,repeat,weeks},esc,ms=Date.now()){
  const bf=d=>bookedSetFor(booked,d,capacityOf(schedule));
  const days=dateOptions(ms),sel=days.includes(date)?date:days.find(d=>slotsFor(schedule,d,bf(d),ms).length)||days[0],slots=slotsFor(schedule,sel,bf(sel),ms);
  const person=((profile?.firstName||'')+' '+(profile?.lastName||'')).trim(),ph=String(profile?.phone||'').trim(),known=!!person&&/^\+?[\d\s()-]{7,25}$/.test(ph),ready=!!(time&&slots.includes(time)),wk=repeat==='weekly',wn=WEEK_CHOICES.includes(weeks)?weeks:WEEK_CHOICES[0],ser=wk&&ready?seriesInfo({schedule,booked,date:sel,time,weeks:wn},ms):[],okN=ser.filter(x=>x.ok).length;
  const dayChip=d=>{const n=slotsFor(schedule,d,bf(d),ms).length,f=fmtDay(d).split(' ');return `<button type="button" class="bk-day ${d===sel?'active':''} ${n?'':'off'}" ${n?`onclick="pickBookDate('${esc(m.id)}','${d}')"`:'disabled'}><strong>${f[0]}</strong><span>${f[1]}</span><small>${n?n+' ميعاد':'مقفول'}</small></button>`;};
  return `<div class="card bk-panel" id="bookPanel" style="margin-bottom:16px"><h3 style="margin:0 0 14px">احجز ميعاد</h3>
    <div class="bk-label">1. اختار اليوم</div>
    <div class="bk-days">${days.map(dayChip).join('')}</div>
    <div class="bk-label">2. اختار الميعاد ${fmtDay(sel)}</div>
    ${slots.length?`<div class="bk-slots">${slots.map(t=>`<button type="button" class="bk-slot ${t===time?'active':''}" onclick="pickBookTime('${esc(m.id)}','${sel}','${t}')">${fmtTime(t)}</button>`).join('')}</div>`:'<p class="hint-box">مفيش مواعيد فاضية فى اليوم ده.</p>'}
    ${ready?`<div class="bk-label">3. نوع الحجز</div>
    <div class="bk-modes"><button type="button" class="bk-mode ${wk?'':'active'}" onclick="pickBookRepeat('${esc(m.id)}','once')">مرة واحدة</button><button type="button" class="bk-mode ${wk?'active':''}" onclick="pickBookRepeat('${esc(m.id)}','weekly')">كل أسبوع</button></div>
    ${wk?`<div class="bk-label" style="margin-top:12px">لمدة قد إيه؟ (نفس اليوم والساعة كل أسبوع)</div><div class="bk-modes">${WEEK_CHOICES.map(n=>`<button type="button" class="bk-mode ${n===wn?'active':''}" onclick="pickBookWeeks('${esc(m.id)}',${n})">${n} أسابيع</button>`).join('')}</div>
    <div class="bk-series">${ser.map((x,i)=>`<div class="${x.ok?'':'off'}"><span>${i+1}. ${fmtDay(x.date)} ${fmtTime(time)}</span><b>${x.ok?'✓':'مش متاح، هيتخطى'}</b></div>`).join('')}</div>`:''}
    <div class="bk-label">4. بياناتك</div>
    ${known?`<div class="bk-known" id="bkKnown"><div><strong>${esc(person)}</strong><span>${esc(ph)}</span></div><button type="button" class="btn btn-ghost btn-sm" style="width:auto" onclick="document.getElementById('bkKnown').classList.add('hidden');document.getElementById('bkEdit').classList.remove('hidden')">تعديل</button></div>`:''}
    <div id="bkEdit" class="${known?'hidden':''}"><div class="field"><label>اسمك</label><input id="bkName" maxlength="80" value="${esc(person)}"></div>
    <div class="field"><label>موبايلك</label><input id="bkPhone" inputmode="tel" value="${esc(ph)}"></div></div>
    ${TYPE_FIELDS[String(m.activityType||'').trim()]?typeFieldsHTML(m.activityType,esc):isTrainer(m)?`<div class="field"><label>هدفك من التمرين *</label><select id="bkGoal"><option value="">اختار</option>${TRAINER_GOALS.map(g=>`<option>${g}</option>`).join('')}</select></div>
    <div class="field"><label>مستوى لياقتك *</label><select id="bkLevel"><option value="">اختار</option>${TRAINER_LEVELS.map(g=>`<option>${g}</option>`).join('')}</select></div>
    <div class="field"><label>مكان الجلسة *</label><select id="bkPlace"><option value="">اختار</option>${TRAINER_PLACES.map(g=>`<option>${g}</option>`).join('')}</select></div>
    <div class="field"><label>إصابات أو ملاحظات صحية (اختياري)</label><textarea id="bkExtra" maxlength="120" placeholder="مثال: ألم في الركبة، أو ضغط"></textarea></div>`:isCraft(m)?`<div class="field"><label>إيه العطل أو المشكلة؟ *</label><textarea id="bkProblem" maxlength="140" placeholder="مثال: سخان الغاز بيطفي لوحده، أو تسريب مياه تحت الحوض"></textarea></div>
    <div class="field"><label>العنوان بالتفصيل *</label><input id="bkAddress" maxlength="90" placeholder="المنطقة، الشارع، رقم العمارة والدور والشقة"></div>`:`<div class="field"><label>ملاحظة (اختياري)</label><textarea id="bkNote" maxlength="300" placeholder="مثال: سبب الزيارة أو المادة أو العطل"></textarea></div>`}
    <button class="btn btn-primary" ${wk&&!okN?'disabled':''} onclick="submitBooking('${esc(m.id)}','${sel}','${time}')">${wk?`أرسل ${okN} طلبات حجز أسبوعية: ${fmtDay(sel)} ${fmtTime(time)}`:`أرسل طلب الحجز: ${fmtDay(sel)} ${fmtTime(time)}`}</button>
    <p class="welcome-note">الطلب بيوصل لمقدم الخدمة وهو اللى بيأكد الميعاد. الدفع بينك وبينه مباشرة.</p>`:''}</div>`;
}
export function bookingCardHTML(b,esc,role){
  const st=b.status,prov=role==='provider',phone=(prov?b.customerPhone:b.merchantPhone)||'';
  const wa=phone?`<a class="btn btn-ghost btn-sm" style="width:auto" target="_blank" href="https://wa.me/${esc(String(phone).replace(/\D/g,'').replace(/^0/,'20'))}"><i class="fa-brands fa-whatsapp"></i> واتساب</a>`:'';
  const acts=prov?(st==='PENDING'?`<button class="btn btn-primary btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','ACCEPTED')">قبول</button><button class="btn btn-danger btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','REJECTED')">رفض</button>`:st==='ACCEPTED'?`<button class="btn btn-primary btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','DONE')">تم</button><button class="btn btn-ghost btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','NO_SHOW')">لم يحضر</button><button class="btn btn-danger btn-sm" style="width:auto" onclick="setBookingStatus('${esc(b.id)}','REJECTED')">إلغاء</button>`:''):(['PENDING','ACCEPTED'].includes(st)?`<button class="btn btn-danger btn-sm" style="width:auto" onclick="cancelMyBooking('${esc(b.id)}')">إلغاء الحجز</button>`:'');
  return `<div class="card"><div class="row-between"><b>${esc(prov?b.customerName:b.merchantName)}</b><span class="status-pill ${st==='ACCEPTED'||st==='DONE'?'status-active':st==='PENDING'?'status-pending':'status-suspended'}">${STATUS_LABEL[st]||st}</span></div>
    <div style="font-size:13px;margin:6px 0">${fmtDay(b.date)} · ${fmtTime(b.time)}</div>${b.note?`<div style="font-size:12.5px;color:var(--ink-soft);white-space:pre-line">${esc(b.note)}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${acts}${wa}</div></div>`;
}
export function providerScheduleViewHTML(bookings,esc,ms=Date.now()){
  const t=cairoNow(ms).date,live=(bookings||[]).filter(b=>['PENDING','ACCEPTED'].includes(b.status)&&b.date>=t).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const by={};live.forEach(b=>(by[b.date]=by[b.date]||[]).push(b));
  return Object.keys(by).length?Object.entries(by).map(([d,list])=>`<div class="section-head"><h3>${fmtDay(d)}${d===t?' (النهاردة)':''}</h3></div><div class="list-gap">${list.map(b=>bookingCardHTML(b,esc,'provider')).join('')}</div>`).join(''):'<p class="hint-box">مفيش حجوزات جاية لسه.</p>';
}
export function bookedTableHTML(bookings,esc,ms=Date.now(),day){
  const t=cairoNow(ms).date,sel=DATE.test(String(day||''))?day:t;
  const live=(bookings||[]).filter(b=>['PENDING','ACCEPTED'].includes(b.status)&&b.date===sel).sort((a,b)=>a.time.localeCompare(b.time));
  const head=`<div class="section-head"><h3>المواعيد المحجوزة${sel===t?' (النهاردة)':' · '+fmtDay(sel)}</h3></div><div class="booked-day"><label for="bookedDay">يوم تاني؟</label><input type="date" id="bookedDay" value="${sel}" onchange="setBookedDay(this.value)">${sel===t?'':'<button type="button" class="btn btn-ghost btn-sm" style="width:auto" onclick="setBookedDay(\'\')">النهاردة</button>'}</div>`;
  if(!live.length) return head+`<p class="hint-box">${sel===t?'مفيش مواعيد محجوزة النهاردة.':'مفيش مواعيد محجوزة في اليوم ده.'}</p>`;
  const rows=live.map(b=>{const phone=String(b.customerPhone||'').replace(/\D/g,'').replace(/^0/,'20');
    const wa=phone?`<a class="btn btn-ghost btn-sm" style="width:auto" target="_blank" rel="noopener" href="https://wa.me/${esc(phone)}"><i class="fa-brands fa-whatsapp"></i> واتساب</a>`:'<span style="color:var(--ink-soft)">لا يوجد رقم</span>';
    return `<tr><td>${fmtTime(b.time)}</td><td><b>${esc(b.customerName||'')}</b>${b.status==='PENDING'?' <span class="status-pill status-pending">مستنية ردك</span>':''}</td><td style="white-space:pre-line;font-size:12.5px">${esc(b.note||'')}</td><td>${wa}</td></tr>`;}).join('');
  return head+`<div class="card" style="margin-bottom:14px;overflow-x:auto"><table class="booked-table" style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr><th>الميعاد</th><th>العميل</th><th>التفاصيل</th><th>تواصل</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
export function serviceListHTML(providers,type,esc){
  const list=providers.filter(m=>!type||m.activityType===type);
  return `<div class="cat-scroll" style="margin-bottom:12px"><div class="cat-chip ${!type?'active':''}" onclick="setServiceType('')"><span>الكل</span></div>${SERVICE_TYPES.map(t=>`<div class="cat-chip ${type===t?'active':''}" onclick="setServiceType('${t}')"><span>${t}</span></div>`).join('')}</div>`
   +(list.length?`<div class="list-gap">${list.map(m=>`<div class="merchant-card" onclick="openMerchant('${esc(m.id)}')"><div class="logo">${m.logoUrl?`<img src="${esc(m.logoUrl)}">`:'<i class="fa-solid fa-user-doctor"></i>'}</div><div class="info"><h4>${esc(m.businessName)}</h4><div class="meta">${esc(m.activityType)}${m.address?' · '+esc(m.address):''}</div></div></div>`).join('')}</div>`:'<p class="hint-box">مفيش مزودين فى القسم ده لسه.</p>');
}

// Wording for a service provider's own screens: the same merchant screens, with store words swapped for service words.
export const PROVIDER_WORDS=[
 ['بيانات المتجر','بيانات النشاط'],['صفحة متجرك','صفحتك'],['وحطه فى المحل','وحطه فى مكان شغلك'],
 ['إشعارات الطلبات على تليجرام','إشعارات الحجوزات على تليجرام'],
 ['اسم المتجر','اسم النشاط'],['نوع المتجر','نوع النشاط'],['وصف المتجر','وصف النشاط'],
 ['متجرك مخفي','صفحتك مخفية'],['للمتاجر القديمة','للحسابات القديمة'],
 ['مكان متجرك','مكان نشاطك'],['باقة الطلبات','باقة الحجوزات'],
 ['صفحة لمتجرك','صفحة لنشاطك'],['تعرف الناس بمتجرك','تعرف الناس بنشاطك'],
 ['عشان تستقبل طلبات','عشان تستقبل حجوزات'],
 ['من غير عرض منتجات أو استقبال طلبات داخل التطبيق','من غير استقبال حجوزات داخل التطبيق'],
 ['من غير منتجات أو طلبات داخل التطبيق','من غير حجوزات داخل التطبيق'],
 ['وكمان تعرض منتجاتك وتستقبل الطلبات وتجهزها لاستلام المندوب','وكمان تستقبل حجوزات العملاء وتنظم مواعيدك'],
 ['وكمان تعرض منتجاتك وتستقبل الطلبات وتجهزها للمندوب','وكمان تستقبل حجوزات العملاء وتنظم مواعيدك'],
 ['بتضيف المنتجات واستقبال الطلبات وتجهيزها للمندوب','بتضيف استقبال حجوزات العملاء وتنظيم مواعيدك'],
 ['لو عايز تعرض منتجات وتستقبل طلبات','لو عايز تستقبل حجوزات'],
 ['من باقة الطلبات','من باقة الحجوزات'],['منتجات وطلبات + 2% على التاجر','حجوزات وطلبات حجز بدون عمولة'],
 ['العملاء بيتواصلوا مع متجرك مباشرة','العملاء بيتواصلوا معاك مباشرة'],['التواصل مع المتجر مباشرة','التواصل معاك مباشرة'],
];
// Providers pay no commission on bookings: commission sentences are cut from their screens.
export const PROVIDER_CUTS=[
 / فيها عمولة 2% على التاجر من قيمة المنتجات في الطلبات المسلّمة، من غير رسوم التوصيل، والدفع كاش بس\./g,
 /<p class="welcome-fee">\+ 2% [^<]*<\/p>/g,
 /<div class="plan-fee">\+ 2% [^<]*<\/div>/g,
 /\. عمولة الطلبات 2% مستمرة خلال فترة العرض، وبعدها الأسعار العادية/g,
];
export const providerWords=html=>PROVIDER_CUTS.reduce((t,r)=>t.replace(r,''),PROVIDER_WORDS.reduce((t,[a,b])=>t.split(a).join(b),String(html||'')));
