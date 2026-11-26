import test from 'node:test'; import assert from 'node:assert/strict';
import { applySub, subState, WEEK_MS } from './delivery-sub.js';
import { deliveryQuote } from './delivery-batch.js';
const S = { deliverySubOn: true, deliverySubDiscount: 25, deliverySubMinOrder: 150 };
const t0 = 1_000_000_000_000;
const p = (extra = {}) => ({ deliverySubStartedAt: t0, deliverySubUntil: t0 + 30 * 86400000, deliverySubUsedPeriod: -1, ...extra });
const q = (n) => deliveryQuote(n, 40, 0);
test('discount once per 7-day period from activation', () => {
  { const r = applySub(q(1), p(), S, 200, t0 + 1000); assert.equal(r.net, 0); assert.equal(r.courierComp, 25); assert.equal(r.subFree, true); }
  assert.equal(applySub(q(1), p({ deliverySubUsedPeriod: 0 }), S, 200, t0 + 6 * 86400000).subDiscount, 0);
  const next = applySub(q(1), p({ deliverySubUsedPeriod: 0 }), S, 200, t0 + WEEK_MS + 1);
  assert.equal(next.subDiscount, 40); assert.equal(next.subPeriod, 1);
});
test('multi-store: one 25 off only', () => { const r = applySub(q(2), p(), S, 300, t0 + 5); assert.equal(r.net, 55); assert.equal(r.courierComp, 25); assert.equal(r.subFree, false); });
test('needs minimum order, active, switch on', () => {
  assert.equal(applySub(q(1), p(), S, 149, t0 + 5).subDiscount, 0);
  assert.equal(applySub(q(1), p(), S, 200, t0 + 31 * 86400000).subDiscount, 0);
  assert.equal(applySub(q(1), p(), { ...S, deliverySubOn: false }, 200, t0 + 5).subDiscount, 0);
  assert.equal(applySub(q(1), {}, S, 200, t0 + 5).subDiscount, 0);
});
test('multi-store deduction never exceeds the total fee', () => { assert.equal(applySub(deliveryQuote(2, 10, 0), p(), S, 200, t0 + 5).net, 0); });
test('state tells when next period starts', () => { assert.equal(subState(p(), S, t0 + 5).nextAt, t0 + WEEK_MS); });
