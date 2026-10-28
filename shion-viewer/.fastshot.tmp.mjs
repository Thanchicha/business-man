import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
const out = resolve(process.argv[2]);
const views = (process.argv[3] || 'front,side,back,threequarter,face').split(',');
const exprs = (process.argv[4] || 'normal').split(',');
mkdirSync(out, { recursive: true });
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 0 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('[dbg]')) && errors.push(m.text()));
  await page.setViewport({ width: 600, height: 1100 });
  const t0 = Date.now();
  await page.goto(`${server.resolvedUrls.local[0]}?view=front&ui=0&shot=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shion?.ready === true, { timeout: 180000 });
  console.log('ready in', Date.now() - t0, 'ms');
  for (const v of views) {
    await page.setViewport(v === 'face' ? { width: 600, height: 600 } : { width: 600, height: 1100 });
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate((v) => window.__shion.setView(v), v);
    for (const e of exprs) {
      await page.evaluate((e) => window.__shion.setExpression(e), e);
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: join(out, exprs.length > 1 ? `${v}-${e}.png` : `${v}.png`) });
    }
  }
} finally { await browser.close(); await server.close(); }
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ok');
