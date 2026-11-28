// Admin: list all of a merchant's subscriptions and cancel one. Pure helpers (no Firebase), tested in sub-cancel.test.mjs.
// A subscription doc: {id, merchantId, planName, status: PENDING|APPROVED|REJECTED|CANCELED, endsAt, approvedAt, price, model, kind, termsVersion}.
// The merchant doc carries the current plan (subPlanId, subPlanName, subEndsAt, and for the new model subscriptionModel, subPlanType, ...).
export const subsOf = (subs, merchantId) => (subs || []).filter(s => s && s.merchantId === merchantId)
  .sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0));
/* Display state: PENDING, REJECTED, CANCELED, ACTIVE (approved and running), EXPIRED (approved and over). */
export function subState(s, now = Date.now()) {
  if (!s) return 'EXPIRED';
  if (s.status === 'PENDING' || s.status === 'REJECTED' || s.status === 'CANCELED') return s.status;
  return Number(s.endsAt) > now ? 'ACTIVE' : 'EXPIRED';
}
export const canCancel = s => !!s && (s.status === 'APPROVED' || s.status === 'PENDING');
/* What to write on the merchant after canceling `target`.
   Only the subscription that defines the merchant's current end date changes the merchant. Others: patch = null.
   Falls back to the latest remaining approved subscription, or to "no subscription" (subEndsAt 0). */
export function merchantPatchAfterCancel(merchant, subs, target) {
  if (!merchant || !target || target.status !== 'APPROVED') return null;
  if (Number(target.endsAt) !== Number(merchant.subEndsAt)) return null;
  const next = (subs || []).filter(s => s && s.merchantId === merchant.id && s.status === 'APPROVED' && s.id !== target.id && Number(s.endsAt) > 0)
    .sort((a, b) => Number(b.endsAt) - Number(a.endsAt))[0];
  if (!next) return {subEndsAt: 0};
  const patch = {subPlanId: next.planId, subPlanName: next.planName, subEndsAt: Number(next.endsAt)};
  if (next.model) {
    patch.subscriptionModel = next.model; patch.subPlanType = next.kind;
    patch.subOrderCommissionPercent = next.kind === 'ORDERING' ? 2 : 0; patch.subTermsVersion = next.termsVersion || 1;
  }
  return patch;
}
export const cancelFields = (uid, now) => ({status: 'CANCELED', canceledAt: now, canceledBy: uid});
