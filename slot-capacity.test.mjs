import assert from 'node:assert/strict';
import * as S from './services.js';
// سعة الميعاد: الافتراضي 1، وعدد صحيح من 1 لـ20 بس
assert.equal(S.capacityOf(null),1);
assert.equal(S.capacityOf({capacity:5}),5);
assert.equal(S.capacityOf({capacity:0}),1);
assert.equal(S.capacityOf({capacity:21}),1);
assert.equal(S.capacityOf({capacity:2.5}),1);
// سعة 1 مش بتتكتب في الجدول (عشان القواعد الحالية تفضل شغالة)
assert.equal('capacity' in S.normalizeSchedule({capacity:1}),false);
assert.equal(S.normalizeSchedule({capacity:4}).capacity,4);
// رقم الحجز: المقعد الأول زي ما كان
assert.equal(S.bookingId('m1','2026-11-28','10:30'),'m1_2026-11-28_1030');
assert.equal(S.bookingId('m1','2026-11-28','10:30',1),'m1_2026-11-28_1030');
assert.equal(S.bookingId('m1','2026-11-28','10:30',3),'m1_2026-11-28_1030_s3');
assert.equal(S.seatKey('2026-11-28','10:30'),'2026-11-28|10:30');
assert.equal(S.seatKey('2026-11-28','10:30',2),'2026-11-28|10:30|2');
// أول مقعد فاضي
const b=new Set([S.seatKey('2026-11-28','10:30'),S.seatKey('2026-11-28','10:30',2)]);
assert.equal(S.seatFor(b,'2026-11-28','10:30',3),3);
assert.equal(S.seatFor(b,'2026-11-28','10:30',2),null);
assert.equal(S.seatFor(new Set(),'2026-11-28','10:30',1),1);
assert.equal(S.seatFor(new Set([S.seatKey('2026-11-28','10:30')]),'2026-11-28','10:30',1),null);
// الميعاد بيتقفل لما العدد يوصل للسعة بس
assert.deepEqual([...S.bookedSetFor(b,'2026-11-28',3)],[]);
assert.deepEqual([...S.bookedSetFor(b,'2026-11-28',2)],['10:30']);
assert.deepEqual([...S.bookedSetFor(b,'2026-11-28')],['10:30']);
assert.deepEqual([...S.bookedSetFor(b,'2026-11-29',2)],[]);
// الفورم بيقرا السعة
const get=(id,f)=>({schSlot:'30',schCap:'5'})[id]??(f==='checked'?false:'10:00');
const sch=S.readScheduleForm(get,[]);assert.equal(sch.capacity,5);
// الميعاد ظاهر في اللوحة طول ما فيه مقعد فاضي
const ms=Date.parse('2026-11-26T10:00:00+02:00'),sc=S.normalizeSchedule({capacity:3});
assert.ok(S.slotsFor(sc,'2026-11-28',S.bookedSetFor(b,'2026-11-28',3),ms).includes('10:30'));
assert.ok(!S.slotsFor(S.normalizeSchedule({}),'2026-11-28',S.bookedSetFor(b,'2026-11-28',1),ms).includes('10:30'));
console.log('slot capacity tests passed');
