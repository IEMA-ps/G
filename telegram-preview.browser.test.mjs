// Visual smoke for the Telegram linking UI at 390px: merchant profile, delivery profile, modal states.
// Run: SCREENSHOT_DIR=/downloads node telegram-preview.browser.test.mjs
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const server = createServer((req, res) => {
  try {
    const path = join(root, req.url.split('?')[0] === '/' ? 'telegram-preview.html' : req.url.split('?')[0]);
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)] || 'application/octet-stream');
    res.end(readFileSync(path));
  } catch { res.writeHead(404); res.end(); }
}).listen(8191, '127.0.0.1');

const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox']});
const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const settle = () => page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished)).catch(() => {}));
const shot = name => page.screenshot({path: (process.env.SCREENSHOT_DIR || '/tmp') + '/' + name + '.png', fullPage: false});

try {
  await page.goto('http://127.0.0.1:8191/');
  await page.waitForFunction(() => typeof window.renderMain === 'function');
  await page.evaluate(() => document.fonts.ready);

  // 1) صفحة حساب التاجر وفيها زرار تليجرام
  await page.evaluate(() => { S.role='merchant'; renderMain(); window.scrollTo(0, 260); });
  assert.equal(await page.locator('button[onclick="openTelegramLink(\'merchant\')"]').count(), 1, 'merchant telegram button');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'merchant overflow');
  await shot('tg-merchant-profile-390');

  // 2) صفحة حساب المندوب وفيها صف تليجرام
  await page.evaluate(() => { S.role='delivery'; renderMain(); window.scrollTo(0, 0); });
  assert.equal(await page.locator('div[onclick="openTelegramLink(\'delivery\')"]').count(), 1, 'delivery telegram row');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'delivery overflow');
  await shot('tg-delivery-profile-390');

  // 2ب) صفحة حساب العميل وفيها صف تليجرام
  await page.evaluate(() => { S.role='customer'; renderMain(); window.scrollTo(0, document.body.scrollHeight); });
  assert.equal(await page.locator('div[onclick="openTelegramLink(\'customer\')"]').count(), 1, 'customer telegram row');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'customer overflow');
  await shot('tg-customer-profile-390');

  // 2ج) إعدادات الموقع: كارت البث فيه الجماهير الستة
  await page.evaluate(() => { S.role='admin'; renderMain(); });
  assert.equal(await page.locator('#tgBcAudience option').count(), 6, 'audience options');
  await page.evaluate(() => document.getElementById('tgBcAudience').scrollIntoView({block:'center'}));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'admin overflow');
  await shot('tg-admin-broadcast-390');

  // 2د) معاينة البث بالنص النهائي قبل الإرسال
  await page.evaluate(() => {
    document.getElementById('tgBcText').value = 'خبر مهم: توصيل مجاني النهاردة 🎉\nلكل الطلبات فوق ٢٠٠ جنيه.';
    previewTelegramBroadcast();
  });
  await settle();
  assert.equal(await page.locator('button[onclick="sendTelegramBroadcast()"]').count(), 1, 'confirm broadcast button');
  assert.ok((await page.locator('#tgBcBody').innerText()).includes('توصيل مجاني'), 'preview shows exact text');
  await shot('tg-broadcast-preview-390');

  // 2هـ) نتيجة البث بعد الإرسال
  await page.evaluate(() => { document.getElementById('tgBcBody').innerHTML = TelegramNotify.broadcastResultHTML({ok:true,total:12,sent:11,blocked:1,failed:0}); });
  await shot('tg-broadcast-result-390');
  await page.evaluate(() => UI.closeModal());

  // 2و) زرار المسوّق موجود في الكود المصدري (لوحته تقيلة على المعاينة)
  {
    const src = readFileSync('index.html', 'utf8');
    assert.ok(src.includes("openTelegramLink('marketer')"), 'marketer telegram button in source');
    assert.ok(src.includes("openTelegramLink('customer')"), 'customer telegram row in source');
  }

  // 3) المودال بحالاته
  const openModal = state => page.evaluate(st => {
    document.getElementById('modalSheet').innerHTML = '<div class="modal-head"><h3><i class="fa-brands fa-telegram" style="color:var(--teal)"></i> إشعارات تليجرام</h3><button class="modal-close" onclick="UI.closeModal()"><i class="fa-solid fa-xmark"></i></button></div><div id="tgLinkBody">' + TelegramNotify.linkModalHTML(st) + '</div>';
    document.getElementById('modalRoot').classList.remove('hidden');
  }, state);
  await page.evaluate(() => { S.role='merchant'; renderMain(); });
  await openModal('unlinked'); await settle();
  assert.equal(await page.locator('button[onclick="startTelegramLink()"]').count(), 1, 'link button');
  await shot('tg-modal-unlinked-390');
  await openModal('pending'); await settle();
  await shot('tg-modal-pending-390');
  await openModal('linked'); await settle();
  assert.equal(await page.locator('button[onclick="unlinkTelegram()"]').count(), 1, 'unlink button');
  await shot('tg-modal-linked-390');

  assert.deepEqual(errors, []);
  console.log('PASS visual smoke: 390px merchant/delivery telegram buttons + modal states (unlinked/pending/linked).');
} finally { await browser.close(); server.close(); }
