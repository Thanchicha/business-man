// Side-by-side comparison sheets for critics.
//
//   node tools/compare.mjs --ref reference/crops/front.png --a shots/new/front.png --out comp.png
//   node tools/compare.mjs --ref reference/crops/front.png --a shots/old/front.png --b shots/new/front.png --out comp.png --blind
//
// With --blind and two candidates the left/right order is randomized and the answer is written
// to <out>.key.json — judge first, then read the key.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ref = arg('ref');
const a = arg('a');
const b = arg('b');
const out = arg('out', 'compare.png');
const blind = process.argv.includes('--blind');
const panelH = Number(arg('h', 900));
if (!ref || !a) throw new Error('need --ref and --a');

let candidates = b ? [{ label: 'A', src: a }, { label: 'B', src: b }] : [{ label: 'OURS', src: a }];
let key = null;
if (b && blind) {
  const swap = Math.random() < 0.5;
  const ordered = swap ? [b, a] : [a, b];
  candidates = [{ label: 'A', src: ordered[0] }, { label: 'B', src: ordered[1] }];
  key = { A: ordered[0], B: ordered[1] };
}

/** Trims uniform background so subjects are compared at the same scale, then fits to height. */
async function panel(src) {
  const trimmed = await sharp(src).trim({ threshold: 18 }).toBuffer().catch(() => sharp(src).toBuffer());
  return sharp(trimmed).resize({ height: panelH - 60, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
}

const items = [{ label: 'REFERENCE', src: ref }, ...candidates];
const rendered = await Promise.all(items.map((it) => panel(it.src)));
const gap = 24;
const widths = rendered.map((r) => r.info.width);
const total = widths.reduce((s, w) => s + w, 0) + gap * (items.length + 1);

const composites = [];
let x = gap;
for (let i = 0; i < items.length; i++) {
  composites.push({ input: rendered[i].data, left: x, top: 50 });
  const svg = `<svg width="${widths[i]}" height="40"><text x="${widths[i] / 2}" y="30" font-size="26" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#333">${items[i].label}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left: x, top: 6 });
  x += widths[i] + gap;
}

await sharp({ create: { width: total, height: panelH, channels: 3, background: '#ffffff' } })
  .composite(composites)
  .png()
  .toFile(out);
if (key) writeFileSync(out + '.key.json', JSON.stringify(key, null, 2));
console.log('wrote', out, key ? '(blind; key in ' + out + '.key.json)' : '');
