// Install button: dismissible, remembered, hidden while typing. Run: SCREENSHOT_DIR=/tmp node pwa-install.browser.test.mjs
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const page_html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><div style="padding:20px"><h3>تسجيل الدخول</h3><input id="pw" type="password" placeholder="كلمة المرور" style="width:100%;padding:12px;margin-top:300px"></div><script type="module" src="/pwa-install.js"></script></body></html>`;
const server=createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(page_html);}
 try{res.setHeader('Content-Type','text/javascript');res.end(readFileSync('.'+req.url.split('?')[0]));}catch{res.writeHead(404);res.end();}}).listen(8193,'127.0.0.1');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const dir=process.env.SCREENSHOT_DIR||'/tmp';
try{
 for(const [w,h] of [[390,844],[1280,800]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8193/');await page.waitForSelector('#pwaInstallWrap');
  assert.equal(await page.locator('#pwaInstallWrap').isVisible(),true);
  await page.screenshot({path:`${dir}/install-shown-${w}.png`});
  await page.focus('#pw');assert.equal(await page.locator('#pwaInstallWrap').isVisible(),false,'hidden while typing');
  await page.screenshot({path:`${dir}/install-typing-${w}.png`});
  await page.evaluate(()=>document.activeElement.blur());assert.equal(await page.locator('#pwaInstallWrap').isVisible(),true);
  await page.click('#pwaInstallClose');assert.equal(await page.locator('#pwaInstallWrap').isVisible(),false,'closed');
  await page.screenshot({path:`${dir}/install-closed-${w}.png`});
  await page.reload();await page.waitForSelector('#pwaInstallWrap',{state:'attached'});
  assert.equal(await page.locator('#pwaInstallWrap').isVisible(),false,'stays closed after reload');
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log('PASS install button: shown, hidden while typing, dismissible, remembered (390px and 1280px)');
}finally{await browser.close();server.close();}
