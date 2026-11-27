// New features start OFF. The super admin switches them on here (settings/app, merged, nothing else is touched).
export const FLAGS = [
  {key:'favoriteStoresEnabled', label:'المتاجر المفضلة وحفظ المفضلة على حساب العميل'},
  {key:'merchantRatingsEnabled', label:'تقييمات العملاء للتاجر (عرض وردود) وعدد التقييمات على صفحة المتجر'},
  {key:'trackingTimelineEnabled', label:'تتبع الطلب للعميل بأوقات كل خطوة واسم المندوب ورقمه (يحتاج قواعد Firebase الأخيرة)'},
  {key:'marketerInsightsEnabled', label:'لوحة المسوّق: ملخص الشهر، محلات محتاجة متابعة، وفلتر المحلات'},
  {key:'pushNotificationsEnabled', label:'الإشعارات الفورية على الموبايل (تحتاج Worker الإشعارات المحدّث)'},
  {key:'providerRemindersEnabled', label:'تذكيرات مقدمي الخدمة على تليجرام (قبل الميعاد بساعة، حجز مستني ساعتين، ملخص بكرة) (تحتاج Worker #115)'},
  {key:'broadcastTargetsEnabled', label:'بث الأدمن لفئة معينة (تجار، مناديب، مقدمي خدمة، مسوقين، أو شخص واحد) على تليجرام والإشعارات الفورية (يحتاج Worker المحدّث)'},
  {key:'marketerContestEnabled', label:'مسابقة المسوّقين الشهرية (ترتيب بأول اشتراك مدفوع، الجوائز يدويًا)'},
  {key:'pasteProductsEnabled', label:'إضافة منتجات بلصق رسالة أو قايمة أسعار (معاينة وتعديل قبل الحفظ)'},
  {key:'smartSupportEnabled', label:'مساعد على بابك: شات دعم ذكي بردود تلقائية جوه الموقع وعلى صفحة البداية (الزائر يسجّل اسمه ورقمه الأول)'}
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

