// Crops and enlarges a region of an image for close inspection.
//   node tools/zoom.mjs --in shots/x/front.png --rect 150,80,300,300 --scale 2 --out zoom.png
//   (--rect accepts fractions too: --rect 0.25,0.05,0.5,0.35)
import sharp from 'sharp';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const input = arg('in');
const out = arg('out', 'zoom.png');
const scale = Number(arg('scale', 2));
const meta = await sharp(input).metadata();
let [x, y, w, h] = arg('rect').split(',').map(Number);
if ([x, y, w, h].every((v) => v <= 1)) {
  x *= meta.width; w *= meta.width; y *= meta.height; h *= meta.height;
}
const rect = { left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) };
await sharp(input).extract(rect).resize({ width: Math.round(rect.width * scale), kernel: 'lanczos3' }).png().toFile(out);
console.log('wrote', out, rect);
