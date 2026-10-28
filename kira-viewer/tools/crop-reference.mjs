// Slices the reference sheet into per-view crops used by critics.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
const src = fileURLToPath(new URL('../reference/sheet.webp', import.meta.url));
const out = fileURLToPath(new URL('../reference/crops/', import.meta.url));
mkdirSync(out, { recursive: true });

const crops = {
  front: [15, 85, 260, 520],
  side: [272, 85, 250, 520],
  back: [520, 85, 250, 520],
  threequarter: [768, 85, 240, 520],
  'detail-hair': [1028, 62, 158, 128],
  'detail-collar': [1028, 196, 158, 124],
  'detail-jacket': [1028, 330, 158, 112],
  'detail-bag': [1028, 448, 158, 112],
  'detail-boots': [1028, 565, 158, 115],
  'expr-normal': [28, 678, 132, 135],
  'expr-smile': [163, 678, 132, 135],
  'expr-wink': [298, 678, 132, 135],
  'expr-surprised': [433, 678, 132, 135],
  'expr-pout': [568, 678, 132, 135],
  'expr-crying': [703, 678, 132, 135],
  'expr-sleepy': [838, 678, 132, 135],
  'expr-blush': [973, 678, 132, 135],
};

for (const [name, [left, top, width, height]] of Object.entries(crops)) {
  await sharp(src).extract({ left, top, width, height }).resize({ width: width * 3, kernel: 'lanczos3' }).png().toFile(out + name + '.png');
}
console.log('wrote', Object.keys(crops).length, 'crops');
