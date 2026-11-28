import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const idx = readFileSync('index.html', 'utf8'), sw = readFileSync('sw.js', 'utf8'), tg = readFileSync('telegram-notify.js', 'utf8');
// نسبة التجديد في المسارين (القديم والجديد) وبس
assert.equal((idx.match(/SubExpiry\.commissionPercent\(/g) || []).length, 2);
assert.doesNotMatch(idx, /Math\.min\(100,\s*basePct\s*\+\s*tierBonus\)|Math\.min\(100,basePct\+tierBonus\)/);
assert.match(idx, /SubExpiry\.isRenewal\(m\)/);
// مزامنة الـ Worker بعد الاعتماد، والكل بيعدي من activateSubscription
assert.match(idx, /async function activateSubscription\(subId, sub\)\{\s*await activateSubscriptionCore\(subId, sub\);\s*try\{ TelegramNotify\.expirySync\(\[sub\.merchantId\]\)/);
// تنبيهات داخل التطبيق للتاجر والمسوّق
assert.match(idx, /expirySweepMerchant\(mId, S\.myMerchant\)/);
assert.match(idx, /expirySweepMarketer\(uid_, S\.mkMerchants\)/);
assert.match(idx, /where\('targetType','==','MARKETER'\), where\('targetId','==',uid_\)/);
// الملف في الكاش وفي الـ SHELL، والنسخة اتحركت
assert.match(sw, /'\/sub-expiry\.js'/); assert.match(sw, /CACHE='alababak-services-v81'/);
assert.match(tg, /export function expirySync/);
// الـ Worker مش بيحتاج تغيير قواعد، والكرون بيشغل التنبيهات
assert.match(readFileSync('worker/worker.js', 'utf8'), /runExpiryCron\(env\)/);
console.log('sub-expiry wiring tests passed');
