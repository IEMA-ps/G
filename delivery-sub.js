// اشتراك التوصيل: خصم ثابت على رسوم التوصيل مرة كل 7 أيام من تاريخ التفعيل (متجر واحد: المنصة بتعوّض المندوب).
export const WEEK_MS = 7 * 86400000;
export const SUB_DEFAULTS = { on: false, price: 100, discount: 40, courierPay: 25, minOrder: 150, days: 30 };

export function subSettings(s = {}) {
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
  return {
    on: s.deliverySubOn === true,
    price: num(s.deliverySubPrice, SUB_DEFAULTS.price),
    discount: num(s.deliverySubDiscount, SUB_DEFAULTS.discount),
    courierPay: num(s.deliverySubCourierPay, SUB_DEFAULTS.courierPay),
    minOrder: num(s.deliverySubMinOrder, SUB_DEFAULTS.minOrder),
    days: Math.max(1, Math.floor(num(s.deliverySubDays, SUB_DEFAULTS.days)))
  };
}

// رقم الفترة (0 = أول 7 أيام من التفعيل). -1 لو الاشتراك مش شغال.
export function subPeriod(profile = {}, now) {
  const start = Number(profile.deliverySubStartedAt), until = Number(profile.deliverySubUntil);
  if (!Number.isFinite(start) || !Number.isFinite(until) || now < start || now >= until) return -1;
  return Math.floor((now - start) / WEEK_MS);
}

export function subState(profile, settings, now) {
  const cfg = subSettings(settings);
  const period = cfg.on ? subPeriod(profile || {}, now) : -1;
  const used = Number((profile || {}).deliverySubUsedPeriod);
  const usedThis = Number.isFinite(used) && used >= period && period >= 0;
  const start = Number((profile || {}).deliverySubStartedAt);
  const nextAt = period >= 0 ? start + (period + 1) * WEEK_MS : 0;
  return { cfg, active: period >= 0, period, usedThis, nextAt };
}

// طلب من متجر واحد: التوصيل مجاني للعميل والمنصة بتدفع للمندوب مبلغ ثابت (courierPay).
// طلب من أكتر من متجر: بيتخصم مبلغ ثابت (discount) من إجمالي رسوم التوصيل، والمندوب بيتحاسب عادي (من غير تعويض).
export function applySub(quote, profile, settings, subtotal, now) {
  const st = subState(profile, settings, now);
  const r = (n) => Math.round(n * 100) / 100;
  const eligible = st.active && !st.usedThis && st.cfg.discount > 0 && Number(subtotal) >= st.cfg.minOrder && quote.net > 0;
  const single = quote.storeCount < 2;
  const subDiscount = !eligible ? 0 : single ? r(quote.net) : r(Math.min(st.cfg.discount, quote.net));
  const courierComp = !eligible ? 0 : single ? st.cfg.courierPay : 0;
  return { ...quote, subDiscount, courierComp, subFree: eligible && single, subPeriod: eligible ? st.period : -1, net: r(quote.net - subDiscount), subState: st };
}
