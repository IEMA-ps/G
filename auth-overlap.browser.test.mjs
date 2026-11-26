// Visual regression for the auth-screen floating buttons: the install bubble and the
// support button must never cover the login / Google / register buttons at 390px or 1280px.
// Run: SCREENSHOT_DIR=/tmp node auth-overlap.browser.test.mjs   (needs playwright + /usr/bin/google-chrome)
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = createServer((req, res) => {
  try {
    let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    const f = join(root, p);
    res.setHeader('Content-Type', types[extname(f)] || 'application/octet-stream');
    res.end(readFileSync(f));
  } catch { res.writeHead(404); res.end(); }
}).listen(8193, '127.0.0.1');

const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox']});
const shot = (page, name) => page.screenshot({path: (process.env.SCREENSHOT_DIR || '/tmp') + '/' + name + '.png'});
const rect = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }, sel);
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

async function openAuth(width, height) {
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  await page.goto('http://127.0.0.1:8193/');
  await page.waitForFunction(() => !document.getElementById('authScreen').classList.contains('hidden'), null, {timeout: 30000});
  // المساعد الذكي مفتوح على الموقع الحقيقي فالزرار ظاهر للزائر — نجبره يظهر في الاختبار
  await page.evaluate(() => document.getElementById('supportBtn').classList.remove('hidden'));
  await page.waitForTimeout(300);
  return page;
}

try {
  // 390px login
  let page = await openAuth(390, 844);
  ok(await page.evaluate(() => document.getElementById('pwaInstallBtn').hidden), 'install bubble hidden on login (390px)');
  let support = await rect(page, '#supportBtn');
  ok(!overlap(support, await rect(page, '#loginBtn')), 'support button clear of login button (390px)');
  ok(!overlap(support, await rect(page, '#googleLoginBtn')), 'support button clear of Google button (390px)');
  await shot(page, 'auth-login-390');
  await page.click('#tabRegister');
  await page.waitForTimeout(300);
  support = await rect(page, '#supportBtn');
  ok(!overlap(support, await rect(page, '#registerBtn')), 'support button clear of register button at rest (390px)');
  // scrolled to the very bottom: the submit button must still be fully clear
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  support = await rect(page, '#supportBtn');
  ok(!overlap(support, await rect(page, '#registerBtn')), 'support button clear of register button at bottom (390px)');
  ok(!overlap(support, await rect(page, '#regTerms')), 'support button clear of terms checkbox at bottom (390px)');
  ok(await page.evaluate(() => document.getElementById('pwaInstallBtn').hidden), 'install bubble hidden on register (390px)');
  await shot(page, 'auth-register-390');
  await page.close();

  // 1280px register: bubble must not cover any field label
  page = await openAuth(1280, 900);
  await page.click('#tabRegister');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('pwaInstallBtn').hidden), 'install bubble hidden on register (1280px)');
  await shot(page, 'auth-register-1280');
  // desktop: support button sits outside the card, never over a field, at any scroll position
  for (const y of [0, 400, 900, 2000]) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(150);
    const sb = await rect(page, '#supportBtn');
    for (const f of ['#regFirst', '#regEmail', '#regPassword', '#registerBtn', '#googleLoginBtn']) {
      ok(!overlap(sb, await rect(page, f)), `support button clear of ${f} at scroll ${y} (1280px)`);
    }
  }
  await page.close();

  // bubble comes back once the auth screen is gone (signed-in shell)
  page = await openAuth(390, 844);
  await page.evaluate(() => { document.getElementById('authScreen').classList.add('hidden'); document.getElementById('appShell').classList.remove('hidden'); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.getElementById('pwaInstallBtn').hidden), 'install bubble returns after auth screen hides');
  // support button back to its app position
  support = await rect(page, '#supportBtn');
  const bottomGap = 844 - (support.y + support.h);
  ok(bottomGap >= 90 && bottomGap <= 100, 'support button back at its app position (bottom ~96-98px), got ' + bottomGap);
  await page.close();

  console.log(`auth-overlap: ${n} checks passed`);
} finally {
  await browser.close();
  server.close();
}
