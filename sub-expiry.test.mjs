import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('sub-expiry.js')).toString('base64'));
const D = f.DAY, E = Date.UTC(2026, 11, 10, 12);
// المرحلة للتاجر
assert.equal(f.merchantStage(E, E - 8 * D), null);
assert.equal(f.merchantStage(E, E - 7 * D), 'd7');
assert.equal(f.merchantStage(E, E - 4 * D), 'd7');
assert.equal(f.merchantStage(E, E - 3 * D), 'd3');
assert.equal(f.merchantStage(E, E - 2.5 * D), 'd3');
assert.equal(f.merchantStage(E, E - D), 'd1');
assert.equal(f.merchantStage(E, E - 3600e3), 'd1');
assert.equal(f.merchantStage(E, E), 'lapsed');
assert.equal(f.merchantStage(E, E + 2 * D), 'lapsed');
assert.equal(f.merchantStage(E, E + 3 * D), null);
assert.equal(f.merchantStage(0, E), null); assert.equal(f.merchantStage(undefined, E), null); assert.equal(f.merchantStage('x', E), null);
// المرحلة للمسوّق
assert.equal(f.marketerStage(E, E - D), null);
assert.equal(f.marketerStage(E, E + 2 * D), null);
assert.equal(f.marketerStage(E, E + 3 * D), 'm3');
assert.equal(f.marketerStage(E, E + 9.9 * D), 'm3');
assert.equal(f.marketerStage(E, E + 10 * D), 'm10');
assert.equal(f.marketerStage(E, E + 19 * D), 'm10');
assert.equal(f.marketerStage(E, E + 20 * D), null);
// معرّف ثابت، وتجديد (تاريخ جديد) بيدي معرّف جديد
assert.equal(f.alertId('m1', E, 'd7'), f.alertId('m1', E, 'd7'));
assert.notEqual(f.alertId('m1', E, 'd7'), f.alertId('m1', E + 30 * D, 'd7'));
assert.notEqual(f.alertId('m1', E, 'd7'), f.alertId('m2', E, 'd7'));
// النصوص
for (const s of f.MERCHANT_STAGES) { const a = f.merchantAlert(s, E); assert.ok(a.title && a.message); assert.ok(a.title.length < 150 && a.message.length < 600); }
for (const s of f.MARKETER_STAGES) { const a = f.marketerAlert(s, 'مطعم النور', E); assert.ok(a.message.includes('مطعم النور')); }
assert.equal(f.merchantAlert('x', E), null); assert.equal(f.marketerAlert('x', 'a', E), null);
assert.ok(f.marketerAlert('m3', 'x'.repeat(500), E).message.length < 200);
// نسبة التجديد = النص
assert.equal(f.isRenewal({subEndsAt: 1}), true); assert.equal(f.isRenewal({}), false); assert.equal(f.isRenewal(null), false); assert.equal(f.isRenewal({subEndsAt: 0}), false);
assert.equal(f.commissionPercent(10, 0, false), 10);
assert.equal(f.commissionPercent(10, 0, true), 5);
assert.equal(f.commissionPercent(10, 5, true), 7.5);
assert.equal(f.commissionPercent(10, 5, false), 15);
assert.equal(f.commissionPercent(95, 20, false), 100);
assert.equal(f.commissionPercent(7, 0, true), 3.5);
assert.equal(f.commissionPercent(null, null, true), 0);
console.log('sub-expiry tests passed');
