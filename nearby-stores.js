// Only explicit location labels created by the picker are matched. No GPS or legacy-address guessing.
const normalize=s=>String(s||'').normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064B-\u065F\u0670]/g,'').trim().toLowerCase();
export function storedLocation(address){
 const m=String(address||'').match(/^المحافظة: ([^|\r\n]+) \| المنطقة: ([^|\r\n]+)(?: \| |$)/);
 return m?{governorate:m[1].trim(),area:m[2].trim()}:null;
}
export function nearbyStores(stores,preference,showAll=false){
 const all=Array.isArray(stores)?stores:[],chosen=!!(preference?.governorate&&preference?.area);
 const matches=chosen?all.filter(m=>{const loc=storedLocation(m.address);return loc&&normalize(loc.governorate)===normalize(preference.governorate)&&normalize(loc.area)===normalize(preference.area)}):[];
 return {stores:showAll||!chosen||!matches.length?all:matches,matches:matches.length,mode:showAll?'all':!chosen?'unselected':matches.length?'nearby':'fallback'};
}
