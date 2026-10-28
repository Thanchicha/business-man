// Combines shots/<dir>/{front,side,back,threequarter}.png into shots/<dir>/all.png.
import sharp from 'sharp';
const dir = process.argv[2];
const views = ['front', 'side', 'back', 'threequarter'];
const imgs = await Promise.all(views.map((v) => sharp(`${dir}/${v}.png`).resize(400).toBuffer()));
const { height } = await sharp(imgs[0]).metadata();
await sharp({ create: { width: 1600, height, channels: 3, background: '#fff' } })
  .composite(imgs.map((input, i) => ({ input, left: i * 400, top: 0 })))
  .png()
  .toFile(`${dir}/all.png`);
