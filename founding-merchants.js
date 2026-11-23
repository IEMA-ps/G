// Theoretical offer card only. No writes, attribution, quota, areas or reservation logic.
export function renderFoundingOffer({settings,plans,preview=false},esc,money){
  if(!preview)return '';
  const plan=plans.find(p=>(p.id||p._id)==='profile_6m_v2'&&p.active!==false&&p.kind==='PROFILE'&&p.months===6);
  if(!plan)return '';
  return `<section class="card founding-offer"><div class="founding-preview">معاينة نظرية فقط · العرض متوقف · لا إرسال أو دفع</div><span class="badge-chip">عرض التجار المؤسسين</span><h3>ابدأ صفحتك بـ ${money(300)}</h3><p>6 شهور في الباقة التعريفية: صفحة متجرك وعنوانك واللوكيشن وأرقام التواصل. بدون منتجات أو طلبات داخل التطبيق.</p><p><b>عرض خاص للتجار المؤسسين بكود مسوّق.</b></p><div class="field"><label for="foundingCode">كود المسوّق (اختياري)</label><input id="foundingCode" dir="ltr" maxlength="64" autocomplete="off" placeholder="MK-..." value=""></div><p class="founding-help">الخانة للمعاينة بس. كتابة الكود أو تركه فاضي مش بيغيّر السعر، ومش بيربط متجرك بمسوّق أو يرسل طلب اشتراك.</p><p>اختار من الباقات العادية للاشتراك بالسعر الحالي. العرض ده مقترح للمراجعة، ومش متاح للدفع حاليًا.</p><button class="btn btn-primary" disabled>معاينة فقط، العرض غير مفعّل</button></section>`;
}
