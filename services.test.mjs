import assert from 'node:assert/strict';
import * as S from './services.js';
import {SERVICE_TYPES as ST} from './store-types.js';
assert.deepEqual(S.SERVICE_TYPES,ST);
assert.ok(S.isServiceProvider({activityType:'عيادات'})&&!S.isServiceProvider({activityType:'مطاعم'})&&!S.isServiceProvider(null));
assert.equal(S.servicesEnabled({}),false);assert.equal(S.servicesEnabled({servicesEnabled:true}),true);
// 2026-11-24 is Tuesday (2), Cairo 11:00 = 09:00Z (UTC+2 in winter)
const ms=Date.parse('2026-11-24T09:00:00Z');assert.deepEqual(S.cairoNow(ms),{date:'2026-11-24',time:'11:00'});
assert.equal(S.weekday('2026-11-24'),2);assert.equal(S.addDays('2026-11-30',1),'2026-12-01');
const sch=S.normalizeSchedule({slotMinutes:60,days:{'2':{on:true,from:'10:00',to:'14:00'}},closedDates:['2026-11-25','bad']});
assert.equal(sch.slotMinutes,60);assert.deepEqual(sch.closedDates,['2026-11-25']);
// today: 10:00 passed, 11:00 not strictly after now -> excluded; 12:00,13:00 remain (14:00 would end at 15)
assert.deepEqual(S.slotsFor(sch,'2026-11-24',new Set(),ms),['12:00','13:00']);
assert.deepEqual(S.slotsFor(sch,'2026-11-24',new Set(['12:00']),ms),['13:00']);
assert.deepEqual(S.slotsFor(sch,'2026-11-25',new Set(),ms),[]); // closed date
assert.deepEqual(S.slotsFor(sch,'2026-11-23',new Set(),ms),[]); // past
assert.deepEqual(S.slotsFor(S.defaultSchedule(),'2026-11-27',new Set(),ms),[]); // Friday off
assert.equal(S.slotsFor(S.defaultSchedule(),'2026-11-28',new Set(),ms)[0],'10:00');
assert.equal(S.slotsFor({days:{'2':{on:true,from:'18:00',to:'10:00'}}},'2026-12-01',new Set(),ms).length,16); // invalid day falls back to default 10-18 / 30 min
assert.equal(S.bookingId('m1','2026-11-24','13:00'),'m1_2026-11-24_1300');
const ok={date:'2026-11-24',time:'13:00',name:' Ali ',phone:'01012345678',note:''};
assert.deepEqual(S.validBookingInput(ok,sch,new Set(),ms),{name:'Ali',phone:'01012345678',note:''});
assert.throws(()=>S.validBookingInput({...ok,phone:'123'},sch,new Set(),ms));
assert.throws(()=>S.validBookingInput({...ok,time:'12:00'},sch,new Set(['12:00']),ms));
assert.throws(()=>S.validBookingInput({...ok,note:'x'.repeat(301)},sch,new Set(),ms));
assert.throws(()=>S.validBookingInput({...ok,time:'09:00'},sch,new Set(),ms));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html=S.bookingPanelHTML({m:{id:'m1'},schedule:sch,booked:new Set(['2026-11-24|12:00']),date:'2026-11-24',time:'13:00',profile:{firstName:'<b>',phone:'010'}},esc,ms);
assert.match(html,/submitBooking\('m1','2026-11-24','13:00'\)/);assert.doesNotMatch(html,/<b>/);assert.doesNotMatch(html,/pickBookTime\('m1','2026-11-24','12:00'\)/);
const st=S.providerStats([{status:'PENDING',date:'2026-11-24'},{status:'ACCEPTED',date:'2026-11-24'},{status:'REJECTED',date:'2026-11-24'},{status:'ACCEPTED',date:'2026-11-20'}],ms);
assert.deepEqual(st,{pending:1,today:1,upcoming:2});
const card=S.bookingCardHTML({id:'x_1',status:'PENDING',date:'2026-11-24',time:'13:00',customerName:'<i>',customerPhone:'01012345678'},esc,'provider');
assert.match(card,/setBookingStatus\('x_1','ACCEPTED'\)/);assert.doesNotMatch(card,/<i>/);assert.match(card,/wa\.me\/201012345678/);
const c2=S.bookingCardHTML({id:'x_1',status:'CANCELLED',date:'2026-11-24',time:'13:00',merchantName:'د'},esc,'customer');assert.doesNotMatch(c2,/cancelMyBooking/);
assert.equal(S.fmtTime('13:00'),'1:00 م');assert.equal(S.fmtTime('00:30'),'12:30 ص');
console.log('services tests passed');
{
  const days=Object.fromEntries([0,1,2,3,4,5,6].map(i=>[String(i),{on:true,from:'10:00',to:'12:00'}]));
  const sch=S.normalizeSchedule({slotMinutes:60,days,closedDates:['2026-12-10']});
  const ms=Date.parse('2026-11-25T09:00:00+02:00');
  const ser=S.seriesInfo({schedule:sch,booked:new Set(['2026-12-03|10:00']),date:'2026-11-26',time:'10:00',weeks:8},ms);
  assert.equal(ser.length,8);assert.equal(ser[0].date,'2026-11-26');assert.equal(ser[1].date,'2026-12-03');
  assert.deepEqual(ser.map(x=>x.ok),[true,false,false,true,true,true,true,true]);
  assert.equal(S.seriesInfo({schedule:sch,booked:new Set(),date:'2026-11-26',time:'10:00',weeks:7},ms).length,4);
  assert.deepEqual(S.WEEK_CHOICES,[4,8,12]);
  const html=S.bookingPanelHTML({m:{id:'m1'},schedule:sch,booked:new Set(),date:'2026-11-26',time:'10:00',profile:{},repeat:'weekly',weeks:12},(x=>x),ms);
  assert.ok(html.includes('12 أسابيع')&&html.includes('أرسل 11 طلبات'));
  console.log('weekly booking tests passed');
}
// جدول المواعيد المحجوزة: اليوم الحالي افتراضيًا، ويوم تاني بالاختيار؛ المعلق/المقبول فقط، باسم العميل وزر واتساب
{
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bk=[
    {id:'a',status:'ACCEPTED',date:'2026-11-24',time:'12:00',customerName:'أحمد',customerPhone:'01012345678'},
    {id:'b',status:'PENDING',date:'2026-11-24',time:'15:00',customerName:'سارة',customerPhone:''},
    {id:'c',status:'CANCELLED',date:'2026-11-24',time:'10:00',customerName:'ملغي',customerPhone:'01000000000'},
    {id:'d',status:'ACCEPTED',date:'2026-11-25',time:'10:00',customerName:'بكرة',customerPhone:'01000000000'},
    {id:'e',status:'PENDING',date:'2026-11-24',time:'09:00',customerName:'<x>',customerPhone:'01111111111'}];
  const h=S.bookedTableHTML(bk,esc,ms);
  assert.ok(h.includes('أحمد')&&h.includes('سارة')&&!h.includes('ملغي')&&!h.includes('بكرة')&&h.includes('(النهاردة)'));
  assert.ok(h.includes('https://wa.me/201012345678')&&h.includes('&lt;x&gt;')&&!h.includes('<x>'));
  assert.ok(h.indexOf('&lt;x&gt;')<h.indexOf('أحمد')&&h.indexOf('أحمد')<h.indexOf('سارة'));
  assert.ok(h.includes('type="date"')&&h.includes('value="2026-11-24"')&&!h.includes('setBookedDay(\'\')'));
  const o=S.bookedTableHTML(bk,esc,ms,'2026-11-25');
  assert.ok(o.includes('بكرة')&&!o.includes('أحمد')&&o.includes('value="2026-11-25"')&&o.includes('setBookedDay(\'\')'));
  assert.ok(S.bookedTableHTML(bk,esc,ms,'bad').includes('أحمد'));
  assert.ok(S.bookedTableHTML([],esc,ms).includes('مفيش مواعيد محجوزة النهاردة'));
  assert.ok(S.bookedTableHTML([],esc,ms,'2026-12-01').includes('مفيش مواعيد محجوزة في اليوم ده'));
}
// صيانة منزلية: العطل والعنوان
assert.equal(S.isCraft({activityType:'صيانة منزلية'}),true);assert.equal(S.isCraft({activityType:'مدرسين'}),false);
assert.equal(S.craftNote({problem:'  سخان بيطفي ',address:'المعادي شارع 9 عمارة 3'}),'العطل: سخان بيطفي\nالعنوان: المعادي شارع 9 عمارة 3');
assert.throws(()=>S.craftNote({problem:'',address:'المعادي شارع 9'}));
assert.throws(()=>S.craftNote({problem:'سخان بيطفي',address:'قريب'}));
assert.throws(()=>S.craftNote({problem:'x'.repeat(141),address:'المعادي شارع 9'}));
assert.ok(S.craftNote({problem:'x'.repeat(140),address:'y'.repeat(90)}).length+30<=300);

// تدريب بدني شخصي
assert.ok(S.SERVICE_TYPES.includes('تدريب بدني شخصي'));
assert.equal(S.isTrainer({activityType:'تدريب بدني شخصي'}),true);assert.equal(S.isTrainer({activityType:'مدرسين'}),false);
assert.equal(S.trainerNote({goal:'خسارة وزن',level:'مبتدئ',place:'في بيتي'}),'الهدف: خسارة وزن\nالمستوى: مبتدئ\nالمكان: في بيتي');
assert.equal(S.trainerNote({goal:'زيادة عضل',level:'متقدم',place:'عند المدرب',extra:' ألم ركبة '}),'الهدف: زيادة عضل\nالمستوى: متقدم\nالمكان: عند المدرب\nملاحظات صحية: ألم ركبة');
assert.throws(()=>S.trainerNote({goal:'',level:'مبتدئ',place:'في بيتي'}));
assert.throws(()=>S.trainerNote({goal:'خسارة وزن',level:'x',place:'في بيتي'}));
assert.throws(()=>S.trainerNote({goal:'خسارة وزن',level:'مبتدئ',place:'x'}));
assert.throws(()=>S.trainerNote({goal:'خسارة وزن',level:'مبتدئ',place:'في بيتي',extra:'x'.repeat(121)}));
assert.ok(S.trainerNote({goal:'تأهيل بعد إصابة',level:'متوسط',place:'في الهواء الطلق',extra:'x'.repeat(120)}).length+30<=300);


// أنواع خدمات تانية (حقول بسيطة جوه note)
for(const [type,fs] of Object.entries(S.TYPE_FIELDS)){
  assert.ok(S.SERVICE_TYPES.includes(type),type);
  const full=fs.map(([,k,o])=>k==='select'?o.reduce((a,b)=>b.length>a.length?b:a,''):'ي'.repeat(o));
  const note=S.typeNote(type,full);
  assert.ok(note.length+30<=300,type+' '+note.length);
  const req=fs.map(([,k,o,r])=>r?(k==='select'?o[0]:'ك'):'');
  assert.ok(S.typeNote(type,req).length>0);
  fs.forEach(([,k,o,r],i)=>{if(r){const v=[...req];v[i]='';assert.throws(()=>S.typeNote(type,v),type+' required '+i);}
    if(k==='select'){const v=[...req];v[i]='غلط';assert.throws(()=>S.typeNote(type,v));}
    if(k==='text'){const v=[...req];v[i]='ي'.repeat(o+1);assert.throws(()=>S.typeNote(type,v));}});
  assert.ok(S.typeFieldsHTML(type,x=>x).includes('bkF0'));
}
assert.throws(()=>S.typeNote('مدرسين',[]));
assert.equal(S.typeNote('حلاقة رجالي',['قص شعر','في البيت','']),'الخدمة: قص شعر\nالمكان: في البيت');
assert.equal(S.typeNote('عيادات',['متابعة','']),'نوع الزيارة: متابعة');
// المدرسين: السنة الدراسية إجبارية وبتظهر في أول سطر من note (للمدرس في الحجز والإشعار والجدول)
assert.ok(S.typeFieldsHTML('مدرسين',x=>x).includes('السنة الدراسية'));
assert.throws(()=>S.typeNote('مدرسين',['','رياضيات']));
assert.throws(()=>S.typeNote('مدرسين',['الصف العاشر']));
assert.equal(S.typeNote('مدرسين',['ثانوي - الصف الثاني','']),'السنة الدراسية: ثانوي - الصف الثاني');
assert.equal(S.typeNote('مدرسين',['إعدادي - الصف الأول','رياضيات']),'السنة الدراسية: إعدادي - الصف الأول\nالمادة أو ملاحظة (اختياري): رياضيات');
// التقويم الشهري: السبت أول يوم في الأسبوع، الأيام المتاحة بس قابلة للاختيار
assert.deepEqual(S.monthGrid('2026-11')[0].slice(0,3),[null,'2026-11-01','2026-11-02']);
assert.equal(S.monthGrid('2026-11').flat().filter(Boolean).length,30);
assert.equal(S.addMonths('2026-12',1),'2027-01');assert.equal(S.addMonths('2026-01',-1),'2025-12');
{const h=S.bookingPanelHTML({m:{id:'m1'},schedule:sch,booked:new Set(),date:'2026-11-24',time:'',profile:{},month:'2026-12'},x=>x,ms);
 assert.ok(h.includes('ديسمبر 2026')&&h.includes("pickBookMonth('m1','2026-11')"));
 assert.ok(h.includes("pickBookDate('m1','2026-12-01')")); // الثلاثاء مفتوح
 assert.ok(!h.includes("pickBookDate('m1','2026-12-04')")); // الجمعة مقفول
 assert.ok(!S.bookingPanelHTML({m:{id:'m1'},schedule:sch,booked:new Set(),date:'2026-11-24',time:'',profile:{}},x=>x,ms).includes("pickBookMonth('m1','2026-10')"));} // مفيش رجوع قبل شهر النهاردة
const mvHtml=S.bookingPanelHTML({m:{id:'m1',activityType:'نقل أثاث وونش'},schedule:S.normalizeSchedule(S.defaultSchedule()),booked:new Set(),date:'2026-11-28',time:'11:00',profile:{},repeat:'once'},x=>x,Date.parse('2026-11-26T10:00:00+02:00'));
assert.ok(mvHtml.includes('bkF2')&&!mvHtml.includes('bkNote')&&!mvHtml.includes('bkProblem'));

// ---- المدرس: السنين والساعات لكل سنة ----
{
  const ms2=Date.parse('2026-11-24T09:00:00Z'); // الثلاثاء 11:00 القاهرة
  const days=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[String(d),{on:true,from:'16:00',to:'18:00'}]));
  const sc=S.normalizeSchedule({slotMinutes:60,days,grades:['ثانوي - الصف الثالث','إعدادي - الصف الأول','مش سنة'],
    gradeDays:{'ثانوي - الصف الثالث':{...days,'3':{on:true,from:'20:00',to:'22:00'}},'جامعي':days}});
  assert.deepEqual(sc.grades,['إعدادي - الصف الأول','ثانوي - الصف الثالث']); // بالترتيب، من غير سنين غلط
  assert.deepEqual(Object.keys(sc.gradeDays),['ثانوي - الصف الثالث']); // ساعات لسنة مش بيدرّسها بتتشال
  assert.deepEqual(S.slotsFor(sc,'2026-11-25',new Set(),ms2,'ثانوي - الصف الثالث'),['20:00','21:00']);
  assert.deepEqual(S.slotsFor(sc,'2026-11-25',new Set(),ms2,'إعدادي - الصف الأول'),['16:00','17:00']); // من غير ساعات خاصة: الأساسية
  assert.deepEqual(S.slotsFor(sc,'2026-11-25',new Set(),ms2),['16:00','17:00']);
  assert.equal(S.normalizeSchedule({days}).grades,undefined); // مدرس قديم: من غير سنين
  const ok0={date:'2026-11-25',time:'20:00',name:'احمد',phone:'01012345678',note:''};
  assert.ok(S.validBookingInput({...ok0,grade:'ثانوي - الصف الثالث'},sc,new Set(),ms2));
  assert.throws(()=>S.validBookingInput({...ok0,grade:'إعدادي - الصف الأول'},sc,new Set(),ms2)); // 20:00 مش متاح للإعدادي
  assert.throws(()=>S.validBookingInput({...ok0,grade:'جامعي'},sc,new Set(),ms2)); // سنة مش بيدرّسها
  assert.throws(()=>S.validBookingInput({...ok0,grade:''},sc,new Set(),ms2));
  const T={m:{id:'m1',activityType:'مدرسين'},schedule:sc,booked:new Set(),profile:{},date:'2026-11-25'};
  const none=S.bookingPanelHTML({...T,time:''},x=>x,ms2);
  assert.ok(none.includes('pickBookGrade')&&!none.includes('bk-cal')&&none.includes('اختار سنتك')); // لازم يختار السنة الأول
  assert.ok(!none.includes('جامعي'));
  const picked=S.bookingPanelHTML({...T,grade:'ثانوي - الصف الثالث',time:'20:00'},x=>x,ms2);
  assert.ok(picked.includes('bk-cal')&&picked.includes('id="bkF0" value="ثانوي - الصف الثالث"')&&picked.includes('8:00 م'));
  const one=S.bookingPanelHTML({...T,schedule:S.normalizeSchedule({days,grades:['جامعي']}),time:'16:00'},x=>x,ms2);
  assert.ok(one.includes('bk-cal')&&one.includes('value="جامعي"')); // سنة واحدة: بتتختار لوحدها
  // المحرر + القراءة من الفورم
  const form={};const get=(id,f)=>form[id+'|'+f];
  S.GRADES.forEach((g,gi)=>{form['schG'+gi+'|checked']=['ثانوي - الصف الأول','ثانوي - الصف الثاني'].includes(g);});
  for(let i=0;i<7;i++){form['schOn'+i+'|checked']=i!==5;form['schFrom'+i+'|value']='10:00';form['schTo'+i+'|value']='14:00';}
  form['schSlot|value']='60';form['schPer|checked']=true;
  S.GRADES.forEach((g,gi)=>{for(let i=0;i<7;i++){form[`schgOn${gi}_${i}|checked`]=true;form[`schgFrom${gi}_${i}|value`]=gi===10?'18:00':'09:00';form[`schgTo${gi}_${i}|value`]=gi===10?'21:00':'12:00';}});
  const rd=S.readScheduleForm(get,[]);
  assert.deepEqual(rd.grades,['ثانوي - الصف الأول','ثانوي - الصف الثاني']);
  assert.equal(rd.gradeDays['ثانوي - الصف الأول']['0'].from,'09:00');assert.equal(rd.gradeDays['ثانوي - الصف الثاني']['0'].from,'18:00');
  form['schPer|checked']=false;assert.equal(S.readScheduleForm(get,[]).gradeDays,undefined);
  form['schPer|checked']=true;form['schgTo10_0|value']='08:00';assert.throws(()=>S.readScheduleForm(get,[])); // ساعات غلط لسنة
  const ed=S.scheduleEditorHTML(rd,x=>x,true,true);
  assert.ok(ed.includes('أدرّس إيه')&&ed.includes('schgPanel13')&&ed.includes('schGradeQuick(0)'));
  assert.ok(!S.scheduleEditorHTML(rd,x=>x,true,false).includes('أدرّس إيه')); // مش مدرس: مفيش القسم ده
  // فلتر السنين في جدول المدرس
  const bk=[{status:'PENDING',date:'2026-11-25',time:'20:00',customerName:'a',note:'السنة الدراسية: ثانوي - الصف الثالث'},{status:'ACCEPTED',date:'2026-11-25',time:'21:00',customerName:'b',note:'السنة الدراسية: جامعي\nالمادة: فيزياء'}];
  assert.equal(S.gradeOfBooking(bk[1]),'جامعي');
  const all=S.bookedTableHTML(bk,x=>x,ms2,'2026-11-25','');assert.ok(all.includes('>a<')||all.includes('a</b>'));
  const f=S.bookedTableHTML(bk,x=>x,ms2,'2026-11-25','جامعي');assert.ok(f.includes('b</b>')&&!f.includes('a</b>')&&f.includes("setBookedGrade('')"));
}
console.log('teacher grades tests passed');
