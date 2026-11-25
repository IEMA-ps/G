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
