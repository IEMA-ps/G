// Store opening status. Pure functions, no network. Times are Cairo wall-clock time.
// Merchant fields (all optional, old stores keep working): openTime/closeTime "HH:MM", closedDays [0..6] (0 = Sunday, JS getDay),
// temporarilyClosed (true = the merchant closed the store himself until he reopens it).
export const DAY_NAMES = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const WD = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};

export function cairoNow(date = new Date()){
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get = t => (parts.find(p=>p.type===t)||{}).value;
  return {day: WD[get('weekday')], mins: (parseInt(get('hour'),10)%24)*60 + parseInt(get('minute'),10)};
}

const toMins = v => { const m=/^(\d{1,2}):(\d{2})$/.exec(v||''); return m ? (+m[1])*60+(+m[2]) : null; };

// -> {open:boolean, reason:null|'TEMP'|'DAY_OFF'|'HOURS'}
export function storeStatus(m, date = new Date()){
  if(!m) return {open:true, reason:null};
  if(m.temporarilyClosed === true) return {open:false, reason:'TEMP'};
  const {day, mins} = cairoNow(date);
  const open = toMins(m.openTime), close = toMins(m.closeTime);
  const hasHours = open!==null && close!==null && open!==close;   // equal times = open 24 hours, missing = always open
  const overnight = hasHours && open > close;
  // the part of an overnight shift after midnight still belongs to the day the shift started
  const shiftDay = overnight && mins < close ? (day+6)%7 : day;
  const off = Array.isArray(m.closedDays) ? m.closedDays.map(Number) : [];
  if(off.includes(shiftDay)) return {open:false, reason:'DAY_OFF'};
  if(!hasHours) return {open:true, reason:null};
  const inside = overnight ? (mins>=open || mins<close) : (mins>=open && mins<close);
  return inside ? {open:true, reason:null} : {open:false, reason:'HOURS'};
}

export const REASON_LABEL = {TEMP:'مغلق مؤقتًا', DAY_OFF:'إجازة اليوم', HOURS:'مغلق حاليًا'};
