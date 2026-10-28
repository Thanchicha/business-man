// Renders frames of the opening film in headless Chrome (needs the dev server: npm run dev).
//
//   node tools/opening-shots.mjs --out shots/opening --times 2,5,9 [--url http://localhost:5173] [--w 1280 --h 720]
//
// Game time is advanced by hand with __engine.step(), so frames are the same on every run.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require(resolve('kuro-viewer/node_modules/puppeteer-core'));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const out = resolve(arg('out', 'shots/opening'));
const times = arg('times', '2,6,10').split(',').map(Number);
const url = arg('url', 'http://localhost:5173');
const w = Number(arg('w', 1280));
const h = Number(arg('h', 720));
const fps = Number(arg('fps', 20));

const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find((p) => existsSync(p));
if (!exe) throw new Error('No Chrome/Edge found; set CHROME_PATH');
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: w, height: h });
  await page.goto(`${url}/?screen=opening&shots=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__engine && document.querySelector('.cine-bar'), { timeout: 240000 });
  let now = 0;
  for (const t of times.sort((a, b) => a - b)) {
    // advance in short slices and let the script's promises run between them (a long synchronous
    // step would starve `await stage.wait(...)`)
    await page.evaluate(async (s, f) => {
      const slice = 0.1;
      for (let done = 0; done < s - 1e-6; done += slice) {
        window.__engine.step(Math.min(slice, s - done), f);
        await new Promise((r) => setTimeout(r, 0));
      }
    }, t - now, fps);
    now = t;
    await new Promise((r) => setTimeout(r, 80));
    const file = join(out, `t${String(t).padStart(5, '0')}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', file);
  }
  if (errors.length) console.log('errors:', errors.slice(0, 5));
} finally {
  await browser.close();
}
