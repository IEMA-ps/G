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

  // 3) المودال بحالاته
  const openModal = state => page.evaluate(st => {
    document.getElementById('modalSheet').innerHTML = '<div class="modal-head"><h3><i class="fa-brands fa-telegram" style="color:var(--teal)"></i> إشعارات تليجرام</h3><button class="modal-close" onclick="UI.closeModal()"><i class="fa-solid fa-xmark"></i></button></div><div id="tgLinkBody">' + TelegramNotify.linkModalHTML(st) + '</div>';
    document.getElementById('modalRoot').classList.remove('hidden');
  }, state);
  const settle = () => page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished)).catch(() => {}));
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
