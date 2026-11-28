import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('sub-cancel.js')).toString('base64'));
const D = 86400000, now = 1e12;
const S = [
  {id: 'a', merchantId: 'm1', status: 'APPROVED', endsAt: now + 10 * D, approvedAt: 3, planId: 'p2', planName: 'سنوي'},
  {id: 'b', merchantId: 'm1', status: 'APPROVED', endsAt: now - 20 * D, approvedAt: 1, planId: 'p1', planName: 'شهري'},
  {id: 'c', merchantId: 'm1', status: 'PENDING', createdAt: 5},
  {id: 'd', merchantId: 'm1', status: 'CANCELED', endsAt: now + 99 * D, approvedAt: 2},
  {id: 'e', merchantId: 'm2', status: 'APPROVED', endsAt: now + D, approvedAt: 9}];
assert.deepEqual(f.subsOf(S, 'm1').map(x => x.id), ['c', 'a', 'd', 'b']);
assert.equal(f.subsOf(S, 'm2').length, 1);
assert.equal(f.subsOf(null, 'm1').length, 0);
assert.equal(f.subState(S[0], now), 'ACTIVE'); assert.equal(f.subState(S[1], now), 'EXPIRED');
assert.equal(f.subState(S[2], now), 'PENDING'); assert.equal(f.subState(S[3], now), 'CANCELED');
assert.equal(f.subState({status: 'REJECTED'}, now), 'REJECTED');
assert.equal(f.canCancel(S[0]), true); assert.equal(f.canCancel(S[1]), true); assert.equal(f.canCancel(S[2]), true);
assert.equal(f.canCancel(S[3]), false); assert.equal(f.canCancel({status: 'REJECTED'}), false); assert.equal(f.canCancel(null), false);
const m = {id: 'm1', subEndsAt: now + 10 * D};
// canceling the running one falls back to the next approved one
assert.deepEqual(f.merchantPatchAfterCancel(m, S, S[0]), {subPlanId: 'p1', subPlanName: 'شهري', subEndsAt: now - 20 * D});
// no other approved subscription -> no subscription
assert.deepEqual(f.merchantPatchAfterCancel(m, [S[0]], S[0]), {subEndsAt: 0});
// canceling one that is not the current end date does not touch the merchant
assert.equal(f.merchantPatchAfterCancel(m, S, S[1]), null);
// canceled/pending ones are never a fallback and pending cancel does not touch the merchant
assert.equal(f.merchantPatchAfterCancel(m, S, S[2]), null);
// new-model fields come from the fallback subscription
const N = [{id: 'x', merchantId: 'm1', status: 'APPROVED', endsAt: 500, planId: 'q', planName: 'ظهور', model: 'MERCHANT_V2', kind: 'ORDERING', termsVersion: 1},
  {id: 'y', merchantId: 'm1', status: 'APPROVED', endsAt: 900, planId: 'r', planName: 'بروفايل', model: 'MERCHANT_V2', kind: 'PROFILE'}];
assert.deepEqual(f.merchantPatchAfterCancel({id: 'm1', subEndsAt: 900}, N, N[1]), {subPlanId: 'q', subPlanName: 'ظهور', subEndsAt: 500, subscriptionModel: 'MERCHANT_V2', subPlanType: 'ORDERING', subOrderCommissionPercent: 2, subTermsVersion: 1});
assert.deepEqual(f.cancelFields('u1', 7), {status: 'CANCELED', canceledAt: 7, canceledBy: 'u1'});
console.log('sub-cancel tests passed');
