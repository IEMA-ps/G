// New features start OFF. The super admin switches them on here (settings/app, merged, nothing else is touched).
export const FLAGS = [
  {key:'favoriteStoresEnabled', label:'المتاجر المفضلة وحفظ المفضلة على حساب العميل'}
];
export const isOn = (settings, key) => !!settings && settings[key] === true;

export function cardHTML(settings, esc){
  const rows = FLAGS.map(f => `<div class="field"><label>${esc(f.label)}</label><select id="ff_${f.key}"><option value="0" ${isOn(settings,f.key)?'':'selected'}>مقفول</option><option value="1" ${isOn(settings,f.key)?'selected':''}>مفتوح</option></select></div>`).join('');
  return `<div class="card" style="margin-bottom:16px;border-color:var(--teal)"><b>مميزات جديدة (مقفولة لحد ما تفتحها)</b>${rows}<button class="btn btn-primary" onclick="saveFeatureFlags()">حفظ</button></div>`;
}
// Reads the switches from the page. `get(id)` returns the select value or null.
export function readFlags(get){
  const out = {};
  for(const f of FLAGS){ const v = get('ff_' + f.key); if(v !== null && v !== undefined) out[f.key] = v === '1'; }
  return out;
}
