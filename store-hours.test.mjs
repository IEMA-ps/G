import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('./store-hours.js',import.meta.url),'utf8');
const H=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
// Cairo is UTC+2 in winter (Nov 2026). 2026-11-25 is a Wednesday (day 3).
const at=(iso)=>new Date(iso+'Z');   // given in UTC
const wed12=at('2026-11-25T10:00:00');          // 12:00 Cairo Wednesday
const wed23=at('2026-11-25T21:30:00');          // 23:30 Cairo Wednesday
const thu01=at('2026-11-25T23:30:00');          // 01:30 Cairo Thursday
eq(H.cairoNow(wed12),{day:3,mins:720},'cairo time');
eq(H.storeStatus({},wed12),{open:true,reason:null},'no config = open');
eq(H.storeStatus(null,wed12).open,true);
eq(H.storeStatus({openTime:'09:00',closeTime:'23:00'},wed12).open,true);
eq(H.storeStatus({openTime:'09:00',closeTime:'23:00'},wed23),{open:false,reason:'HOURS'});
eq(H.storeStatus({openTime:'09:00',closeTime:'09:00'},wed23).open,true,'same time = 24h');
eq(H.storeStatus({openTime:'18:00',closeTime:'02:00'},thu01).open,true,'overnight after midnight');
eq(H.storeStatus({temporarilyClosed:true,openTime:'09:00',closeTime:'23:00'},wed12),{open:false,reason:'TEMP'});
eq(H.storeStatus({closedDays:[3]},wed12),{open:false,reason:'DAY_OFF'});
eq(H.storeStatus({closedDays:[4]},wed12).open,true);
// Wednesday day off, overnight shift Wed 18:00 to Thu 02:00: Thursday 01:30 still counts as Wednesday
eq(H.storeStatus({closedDays:[3],openTime:'18:00',closeTime:'02:00'},thu01),{open:false,reason:'DAY_OFF'},'overnight shift keeps its start day');
eq(H.storeStatus({closedDays:[4],openTime:'18:00',closeTime:'02:00'},thu01).open,true,'Thursday off does not cut the Wednesday shift');
eq(H.storeStatus({closedDays:['3']},wed12).open,false,'string days tolerated');
eq(H.storeStatus({openTime:'bad',closeTime:'x'},wed12).open,true,'bad times = open');
console.log(`store-hours: ${n} checks passed`);
