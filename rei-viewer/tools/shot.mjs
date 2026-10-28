// Headless screenshot tool. Starts its own Vite dev server, renders views/expressions with
// installed Chrome/Edge (puppeteer-core), and writes PNGs.
//
//   node tools/shot.mjs --out shots/base/iter1 --views front,side,back,threequarter --expr normal
//   node tools/shot.mjs --out shots/face/iter1 --views face --expr all
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const EXPRESSIONS = ['normal', 'smile', 'wink', 'surprised', 'angry', 'crying', 'sleepy', 'blush'];
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const out = resolve(root, arg('out', 'shots/latest'));
const views = arg('views', 'front,side,back,threequarter').split(',');
const exprArg = arg('expr', 'normal');
const exprs = exprArg === 'all' ? EXPRESSIONS : exprArg.split(',');
const width = Number(arg('w', 600));
const height = Number(arg('h', 1100));
const faceSize = Number(arg('face', 600));
// Extra query string, e.g. --q 'walk=1&time=0.3' or --q 'gesture=wave&time=1'.
const extra = arg('q', '');
const tag = arg('tag', '');

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = browserCandidates.find((p) => existsSync(p));
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
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const view of views) {
    const isFace = view === 'face';
    await page.setViewport(isFace ? { width: faceSize, height: faceSize } : { width, height });
    for (const expr of exprs) {
      await page.goto(`${url}?view=${view}&expr=${expr}&ui=0&shot=1${extra ? '&' + extra : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => window.__rei?.ready === true, { timeout: 180000 });
      const name = (exprs.length > 1 || exprArg !== 'normal' ? `${view}-${expr}` : view) + (tag ? `-${tag}` : '') + '.png';
      await page.screenshot({ path: join(out, name) });
      console.log('wrote', join(out, name));
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.error('\nPage errors:\n' + [...new Set(errors)].join('\n'));
  process.exitCode = 1;
}
