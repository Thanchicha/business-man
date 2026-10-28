// UI screenshot tool (UI on). Starts its own Vite server and renders the overlay at desktop,
// tablet and phone sizes, plus a few interaction states. Also checks for horizontal overflow,
// small touch targets and UI boxes overlapping the projected face region.
//
//   node tools/ui-shot.mjs --out shots/ui/round-1
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const out = resolve(root, arg('out', 'shots/ui/latest'));

const DEVICES = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180, hasTouch: true, isMobile: true },
  mobile: { width: 375, height: 812, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  'mobile-landscape': { width: 812, height: 375, hasTouch: true, isMobile: true },
};

/** name → [device, query, optional page action] */
const SHOTS = [
  ['desktop', 'view=threequarter&expr=normal'],
  ['desktop-face-smile', 'view=face&expr=smile', 'desktop'],
  ['desktop-focus', 'view=front&expr=normal', 'desktop', async (p) => { for (let i = 0; i < 9; i++) await p.keyboard.press('Tab'); }],
  ['desktop-hidden', 'view=front&expr=normal', 'desktop', async (p) => { await p.keyboard.press('h'); await sleep(400); }],
  ['tablet', 'view=threequarter&expr=wink'],
  ['mobile', 'view=threequarter&expr=normal'],
  ['mobile-face-blush', 'view=face&expr=blush', 'mobile'],
  ['mobile-landscape', 'view=front&expr=sleepy'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found; set CHROME_PATH');

mkdirSync(out, { recursive: true });
const server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});

const errors = [];
try {
  for (const [name, query, deviceName = name, action] of SHOTS) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const device = DEVICES[deviceName];
    await page.setViewport(device);
    await page.goto(`${url}?${query}&shot=1`, { waitUntil: 'networkidle0', timeout: 180000 });
    await page.waitForFunction(() => window.__shion?.ready === true, { timeout: 180000 });
    await page.evaluate(() => document.fonts.ready);
    if (action) await action(page);
    await sleep(250);
    const report = await page.evaluate(audit, query.includes('view=face'));
    await page.screenshot({ path: join(out, `${name}.png`) });
    console.log(`wrote ${name}.png`, JSON.stringify(report));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.error('\nPage errors:\n' + [...new Set(errors)].join('\n'));
  process.exitCode = 1;
}

/** Runs in the page: overflow, small targets, and overlap with an approximate face box. */
function audit(isFace) {
  const W = innerWidth, H = innerHeight;
  // Approximate projection of the face (y 0.56..0.93, |x| < 0.15) using Viewer's fit logic.
  const fov = (20 * Math.PI) / 180, aspect = W / H;
  const fitH = isFace ? 0.46 : 1.16, cy = isFace ? 0.71 : 0.52;
  const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const dist = Math.max(fitH / 2 / Math.tan(fov / 2), (fitH * 0.62) / 2 / Math.tan(hFov / 2));
  const pxPerUnit = H / 2 / (Math.tan(fov / 2) * dist);
  const face = {
    left: W / 2 - 0.15 * pxPerUnit, right: W / 2 + 0.15 * pxPerUnit,
    top: H / 2 - (0.93 - cy) * pxPerUnit, bottom: H / 2 - (0.56 - cy) * pxPerUnit,
  };
  const boxes = [...document.querySelectorAll('.ui .panel, .ui .brand, .ui .hint')]
    .filter((n) => getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().width > 0);
  const overlaps = boxes.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.left < face.right && r.right > face.left && r.top < face.bottom && r.bottom > face.top;
  }).map((n) => n.className);
  const offscreen = boxes.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.left < 0 || r.top < 0 || r.right > W + 0.5 || r.bottom > H + 0.5;
  }).map((n) => n.className);
  const small = [...document.querySelectorAll('.ui button')]
    .filter((b) => b.offsetParent && (b.getBoundingClientRect().width < 40 || b.getBoundingClientRect().height < 40))
    .map((b) => b.getAttribute('aria-label') || b.textContent.trim());
  const pairs = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].getBoundingClientRect(), b = boxes[j].getBoundingClientRect();
    if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) pairs.push(`${boxes[i].className}×${boxes[j].className}`);
  }
  return {
    hScroll: document.documentElement.scrollWidth > W,
    faceOverlap: overlaps, uiOverlap: pairs, offscreen, smallTargets: small,
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
  };
}
