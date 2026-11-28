/* تنبيهات انتهاء الاشتراك + نسبة التجديد. دوال نقية، من غير Firebase. */
export const DAY = 86400000;
export const MERCHANT_STAGES = ['d7', 'd3', 'd1', 'lapsed']; // قبل الانتهاء بـ 7 و3 و1 يوم، ويوم الانتهاء
export const MARKETER_STAGES = ['m3', 'm10']; // بعد الانتهاء بـ 3 و10 أيام ومفيش تجديد
export const RENEWAL_FACTOR = 0.5; // التجديد = نصف نسبة الاشتراك الأول

/* أعلى مرحلة وصلنا لها للتاجر، أو null. 'lapsed' بتفضل 3 أيام بس بعد الانتهاء (بعدها المسوّق هو اللي بيتابع). */
export function merchantStage(endsAt, now = Date.now()) {
  const e = Number(endsAt);
  if (!e || !isFinite(e)) return null;
  if (now >= e) return now - e < 3 * DAY ? 'lapsed' : null;
  const days = Math.ceil((e - now) / DAY);
  return days <= 1 ? 'd1' : days <= 3 ? 'd3' : days <= 7 ? 'd7' : null;
}
/* مرحلة المسوّق: m3 من 3 أيام بعد الانتهاء لحد 10، m10 من 10 لحد 20 يوم. بعد كده مفيش. */
export function marketerStage(endsAt, now = Date.now()) {
  const e = Number(endsAt);
  if (!e || !isFinite(e) || now < e) return null;
  const d = (now - e) / DAY;
  return d >= 10 ? (d < 20 ? 'm10' : null) : d >= 3 ? 'm3' : null;
}
/* معرّف ثابت للتنبيه: نفس المتجر + نفس تاريخ الانتهاء + نفس المرحلة = تنبيه واحد بس. */
export function alertId(merchantId, endsAt, stage) { return `exp-${merchantId}-${Math.floor(Number(endsAt) / 1000)}-${stage}`; }

const fmt = ms => new Date(ms).toLocaleDateString('ar-EG', {timeZone: 'Africa/Cairo', day: 'numeric', month: 'long'});
export function merchantAlert(stage, endsAt) {
  const d = fmt(endsAt);
  if (stage === 'd7') return {title: 'اشتراكك هينتهي كمان 7 أيام', message: `اشتراكك بينتهي يوم ${d}. جدّد من صفحة الاشتراك عشان متجرك يفضل ظاهر للعملاء.`};
  if (stage === 'd3') return {title: 'اشتراكك هينتهي كمان 3 أيام', message: `اشتراكك بينتهي يوم ${d}. جدّد دلوقتي عشان متجرك ميتخفيش.`};
  if (stage === 'd1') return {title: 'اشتراكك هينتهي بكرة', message: `اشتراكك بينتهي يوم ${d}. جدّد النهارده عشان متجرك ميتخفيش.`};
  if (stage === 'lapsed') return {title: 'اشتراكك انتهى — متجرك مخفي', message: 'جدّد من صفحة الاشتراك عشان متجرك يرجع ظاهر للعملاء.'};
  return null;
}
export function marketerAlert(stage, name, endsAt) {
  const n = String(name || 'أحد تجارك').slice(0, 60);
  if (stage === 'm3') return {title: 'اشتراك أحد تجارك انتهى', message: `اشتراك «${n}» انتهى يوم ${fmt(endsAt)}. كلّمه وشجّعه يجدد، وليك عمولة على التجديد.`};
  if (stage === 'm10') return {title: 'تاجر لسه مجددش اشتراكه', message: `«${n}» اشتراكه منتهي من 10 أيام ولسه مجددش. كلّمه تاني، وليك عمولة على التجديد.`};
  return null;
}

/* التجديد = المتجر كان له مدة اشتراك قبل كده (subEndsAt موجود). أول اشتراك = بدون. */
export function isRenewal(merchant) { return !!(merchant && Number(merchant.subEndsAt) > 0); }
/* نسبة المسوّق: التجديد بياخد نص النسبة اللي الاشتراك الأول بياخدها (الأساسية + مكافأة الشريحة). */
export function commissionPercent(basePct, tierBonus, renewal) {
  const full = Math.min(100, (Number(basePct) || 0) + (Number(tierBonus) || 0));
  return renewal ? Math.round(full * RENEWAL_FACTOR * 100) / 100 : full;
}
