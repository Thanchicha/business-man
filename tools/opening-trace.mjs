import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require(resolve('kuro-viewer/node_modules/puppeteer-core'));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://localhost:5173/?screen=opening&shots=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__engine && document.querySelector('.cine-bar'), { timeout: 240000 });
for (let i = 1; i <= 30; i++) {
  const r = await page.evaluate(() => { window.__engine.step(1, 20); const c = window.__engine.camera.position; return [[...document.querySelectorAll('.label3d')].map((e) => e.innerText).join('|'), c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1)].join(' '); });
  console.log(i, r);
}
await browser.close();
