import * as THREE from 'three';
import { mat, mesh, signPlane, texMat } from './mat';

export const PASTEL = ['#f7a8b8', '#ffd28a', '#fff1a8', '#b8e6b0', '#a8d8f0', '#c8b4f0'];
const TRUNK = '#b5836e';

function ball(color: string, r: number, sy = 1): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat(color));
  m.scale.y = sy;
  return m;
}

/** Round lollipop tree. */
export function tree(color = '#8fcb86', h = 1, blobs = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.1 * h, 0.14 * h, 0.9 * h, 10), mat(TRUNK));
  trunk.position.y = 0.45 * h;
  g.add(trunk);
  const top = ball(color, 0.6 * h);
  top.position.y = 1.25 * h;
  g.add(top);
  if (blobs > 1) {
    const b2 = ball(color, 0.42 * h);
    b2.position.set(0.35 * h, 1.0 * h, 0.15 * h);
    const b3 = ball(color, 0.38 * h);
    b3.position.set(-0.3 * h, 1.05 * h, -0.2 * h);
    g.add(b2, b3);
  }
  return g;
}

export function bush(color = '#7fbf7a', s = 1): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, r] of [[0, 0, 0.35], [0.3, 0.1, 0.25], [-0.28, 0.05, 0.27]]) {
    const b = ball(color, r * s);
    b.position.set(x * s, r * s * 0.8, z * s);
    g.add(b);
  }
  return g;
}

export function mushroom(cap = '#f07a8a', s = 1): THREE.Group {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.25 * s, 10), mat('#fff3e8'));
  stem.position.y = 0.12 * s;
  const top = mesh(new THREE.SphereGeometry(0.2 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap));
  top.position.y = 0.22 * s;
  g.add(stem, top);
  for (const [x, z] of [[0.08, 0.1], [-0.1, 0.04], [0.02, -0.12]]) {
    const dot = ball('#ffffff', 0.03 * s);
    dot.position.set(x * s, 0.36 * s, z * s);
    g.add(dot);
  }
  return g;
}

export function lollipop(color = '#ff9cc4'): THREE.Group {
  const g = new THREE.Group();
  const stick = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), mat('#fff6ee'));
  stick.position.y = 0.5;
  const candy = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 20), mat(color));
  candy.rotation.x = Math.PI / 2;
  candy.position.y = 1.1;
  const swirl = mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), mat('#ffffff'));
  swirl.position.set(0, 1.1, 0.045);
  g.add(stick, candy, swirl);
  return g;
}

export function lamp(): THREE.Group {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 14), mat('#f2b8c6'));
  base.position.y = 0.06;
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 10), mat('#f6d0da'));
  pole.position.y = 0.85;
  const cup = mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.08, 14), mat('#f2b8c6'));
  cup.position.y = 1.68;
  const bulb = mesh(new THREE.SphereGeometry(0.2, 16, 12), mat('#fff1d0', { emissive: '#ffe2a8' }));
  bulb.position.y = 1.85;
  g.add(base, pole, cup, bulb);
  return g;
}

export function cloud(s = 1): THREE.Group {
  const g = new THREE.Group();
  for (const [x, y, r] of [[0, 0, 1], [1.1, -0.2, 0.75], [-1.0, -0.25, 0.7], [0.4, 0.5, 0.7]]) {
    const b = mesh(new THREE.SphereGeometry(r * s, 18, 12), mat('#ffffff', { rough: 1 }), false);
    b.position.set(x * s, y * s, 0);
    g.add(b);
  }
  return g;
}

/** Row of pastel rainbow tiles following a polyline. */
export function rainbowPath(points: [number, number][], width = 1.1, step = 0.55): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(step * 0.92, 0.08, width / 2 - 0.04);
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    for (let d = 0; d < len; d += step) {
      const x = x0 + Math.cos(ang) * d;
      const z = z0 + Math.sin(ang) * d;
      for (const side of [-1, 1]) {
        const tile = new THREE.Mesh(geo, mat(PASTEL[(n + (side > 0 ? 3 : 0)) % PASTEL.length]));
        tile.receiveShadow = true;
        tile.position.set(x - Math.sin(ang) * side * width * 0.25, 0.04, z + Math.cos(ang) * side * width * 0.25);
        tile.rotation.y = -ang;
        g.add(tile);
      }
      n++;
    }
  }
  return g;
}

export function ringPath(r: number, width = 1.1): THREE.Group {
  const pts: [number, number][] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 24) pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  return road(pts, width);
}

/** Asphalt road with cream kerbs and white centre dashes along a polyline. */
export function road(points: [number, number][], width = 1.6): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.06, width + 0.5), mat('#f3e7dc'));
    kerb.position.set(mx, 0.03, mz);
    kerb.rotation.y = -ang;
    kerb.receiveShadow = true;
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.08, width), mat('#8e8b9c'));
    asphalt.position.set(mx, 0.04, mz);
    asphalt.rotation.y = -ang;
    asphalt.receiveShadow = true;
    g.add(kerb, asphalt);
    for (let d = 0.3; d < len; d += 0.9) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.07), mat('#ffffff'));
      dash.position.set(x0 + Math.cos(ang) * d, 0.045, z0 + Math.sin(ang) * d);
      dash.rotation.y = -ang;
      g.add(dash);
    }
  }
  return g;
}

/** The floating island the town sits on. */
export function island(r: number): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(new THREE.CylinderGeometry(r, r, 0.3, 72), mat('#a9d79f'));
  top.position.y = -0.15;
  const rim = mesh(new THREE.TorusGeometry(r, 0.25, 12, 72), mat('#a9d79f'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.2;
  const side = mesh(new THREE.CylinderGeometry(r + 0.2, r * 0.9, 2.2, 72), mat('#f2c4b0'));
  side.position.y = -1.4;
  const under = mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.5, 2.5, 72), mat('#e8b2a0'));
  under.position.y = -3.7;
  g.add(top, rim, side, under);
  return g;
}

export interface HouseOpts {
  wall?: string;
  roof?: string;
  w?: number;
  d?: number;
  h?: number;
  door?: string;
  chimney?: boolean;
}

export function house(o: HouseOpts = {}): THREE.Group {
  const w = o.w ?? 2.2;
  const d = o.d ?? 2;
  const h = o.h ?? 1.6;
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(w + 0.3, 0.15, d + 0.3), mat('#f3d6cf'));
  base.position.y = 0.075;
  const body = mesh(new THREE.BoxGeometry(w, h, d), mat(o.wall ?? '#f6e9e4'));
  body.position.y = h / 2 + 0.15;
  const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, h * 0.85, 4), mat(o.roof ?? '#f08aa0'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + 0.15 + h * 0.42;
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  const door = mesh(new THREE.BoxGeometry(0.5, 0.85, 0.08), mat(o.door ?? '#c86478'));
  door.position.set(0, 0.57, d / 2 + 0.02);
  const knob = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#ffd28a'));
  knob.position.set(0.15, 0.55, d / 2 + 0.07);
  g.add(base, body, roof, door, knob);
  for (const x of [-w * 0.3, w * 0.3]) {
    const win = mesh(new THREE.BoxGeometry(0.42, 0.42, 0.06), mat('#a9bde0', { rough: 0.3 }));
    win.position.set(x, h * 0.65 + 0.15, d / 2 + 0.02);
    const frame = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), mat('#ffffff'));
    frame.position.set(x, h * 0.65 + 0.15, d / 2 + 0.005);
    g.add(frame, win);
  }
  if (o.chimney !== false) {
    const ch = mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), mat('#efe3df'));
    ch.position.set(w * 0.25, h + 0.15 + h * 0.5, -d * 0.1);
    g.add(ch);
  }
  return g;
}

/** Tall office block with window strips. */
export function tower(color = '#a9bde0', h = 5, w = 1.8): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(w, h, w), mat(color));
  body.position.y = h / 2;
  g.add(body);
  for (let y = 0.6; y < h - 0.3; y += 0.6) {
    const strip = mesh(new THREE.BoxGeometry(w + 0.04, 0.22, w + 0.04), mat('#e6f0fb', { rough: 0.3 }), false);
    strip.position.y = y;
    g.add(strip);
  }
  const top = mesh(new THREE.BoxGeometry(w * 0.6, 0.3, w * 0.6), mat('#ffffff'));
  top.position.y = h + 0.15;
  g.add(top);
  return g;
}

/** Big pink school building with towers, used as the university. */
export function university(): THREE.Group {
  const g = new THREE.Group();
  const main = mesh(new THREE.BoxGeometry(5, 2.6, 2.4), mat('#f4b6c6'));
  main.position.y = 1.3;
  g.add(main);
  const roof = mesh(new THREE.BoxGeometry(5.2, 0.25, 2.6), mat('#b89ae0'));
  roof.position.y = 2.7;
  g.add(roof);
  for (let x = -2; x <= 2; x += 0.8) {
    for (const y of [0.9, 1.9]) {
      const win = mesh(new THREE.BoxGeometry(0.45, 0.5, 0.06), mat('#c9d4ef', { rough: 0.3 }), false);
      win.position.set(x, y, 1.22);
      g.add(win);
    }
  }
  for (const x of [-2.6, 2.6]) {
    const t = mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.4, 20), mat('#f2a8bc'));
    t.position.set(x, 1.7, 0.6);
    const c = mesh(new THREE.ConeGeometry(0.7, 1.1, 20), mat('#b89ae0'));
    c.position.set(x, 3.95, 0.6);
    g.add(t, c);
  }
  const clockT = mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), mat('#f6c4d2'));
  clockT.position.set(0, 3.4, 0);
  const clockR = mesh(new THREE.ConeGeometry(1.0, 1, 4), mat('#ee7c9c'));
  clockR.rotation.y = Math.PI / 4;
  clockR.position.set(0, 4.6, 0);
  const face = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 24), mat('#fffaf2'));
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 3.45, 0.62);
  g.add(clockT, clockR, face);
  const door = mesh(new THREE.BoxGeometry(0.9, 1.1, 0.1), mat('#b07ac0'));
  door.position.set(0, 0.55, 1.22);
  const awn = mesh(new THREE.BoxGeometry(1.3, 0.12, 0.5), mat('#e05a80'));
  awn.position.set(0, 1.2, 1.4);
  g.add(door, awn);
  return g;
}

/** Shopping mall: wide pink block with glass front and a sign. */
export function mall(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(5, 2.2, 3), mat('#f8c8d8'));
  body.position.y = 1.1;
  const glass = mesh(new THREE.BoxGeometry(3, 1.3, 0.08), mat('#bfe0f5', { rough: 0.2 }));
  glass.position.set(0, 0.8, 1.52);
  const band = mesh(new THREE.BoxGeometry(5.1, 0.35, 3.1), mat('#ff8fb8'));
  band.position.y = 2.1;
  const sign = signPlane('MALL', 1.6, 0.45, { bg: '#ffffff', fg: '#e0558f' });
  sign.position.set(0, 1.75, 1.53);
  g.add(body, glass, band, sign);
  return g;
}

/** Elevated train track on pillars with a little station. */
export function btsLine(len = 12): THREE.Group {
  const g = new THREE.Group();
  const track = mesh(new THREE.BoxGeometry(len, 0.3, 1), mat('#d9d4e6'));
  track.position.y = 2.6;
  g.add(track);
  for (let x = -len / 2 + 1; x < len / 2; x += 2.5) {
    const p = mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.6, 12), mat('#c4bed4'));
    p.position.set(x, 1.3, 0);
    g.add(p);
  }
  const station = mesh(new THREE.BoxGeometry(3, 0.9, 1.6), mat('#ffffff'));
  station.position.set(0, 3.2, 0);
  const stripe = mesh(new THREE.BoxGeometry(3.05, 0.2, 1.65), mat('#7fb8f0'));
  stripe.position.set(0, 3.4, 0);
  const train = mesh(new THREE.CapsuleGeometry(0.4, 2.4, 6, 12), mat('#9fd0f5'));
  train.rotation.z = Math.PI / 2;
  train.position.set(-3, 3.0, 0);
  train.name = 'train';
  g.add(station, stripe, train);
  return g;
}

/** Empty lot for rent: sandy patch with a yellow sign. */
export function rentLot(): THREE.Group {
  const g = new THREE.Group();
  const lot = mesh(new THREE.BoxGeometry(2.6, 0.1, 2.2), mat('#ecd3a6'));
  lot.position.y = 0.05;
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), mat('#a8826a'));
  post.position.set(0.8, 0.6, 0.6);
  const board = signPlane('ให้เช่า', 0.9, 0.45, { bg: '#ffd56b', fg: '#7a5420' });
  board.position.set(0.8, 1.15, 0.65);
  const back = board.clone();
  back.rotation.y = Math.PI;
  back.position.z = 0.6 - 0.01;
  g.add(lot, post, board, back);
  for (const [x, z] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) {
    const c = mesh(new THREE.ConeGeometry(0.1, 0.3, 8), mat('#ff9f6a'));
    c.position.set(x, 0.15, z);
    g.add(c);
  }
  return g;
}

/** A rival bubble tea shop: small house with a striped awning and a cup sign. */
export function teaShop(color: string, name?: string): THREE.Group {
  const g = house({ wall: '#fff4ee', roof: color, w: 1.8, d: 1.6, h: 1.3, chimney: false });
  const awn = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.9, 12, 1, false, 0, Math.PI), texMat(`awn|${color}`, 64, 16, (c) => {
    for (let x = 0; x < 64; x += 8) {
      c.fillStyle = (x / 8) % 2 ? '#ffffff' : color;
      c.fillRect(x, 0, 8, 16);
    }
  }));
  awn.rotation.z = Math.PI / 2;
  awn.position.set(0, 1.25, 0.85);
  g.add(awn);
  const cup = bubbleTea('#d9a877', true);
  cup.scale.setScalar(1.6);
  cup.position.set(0.6, 1.55, 0.9);
  g.add(cup);
  if (name) {
    const s = signPlane(name, 1.4, 0.32, { bg: '#ffffff', fg: '#4a3448' });
    s.position.set(0, 1.0, 0.86);
    g.add(s);
  }
  return g;
}

/** A bubble tea cup with drink, pearls, lid and straw. ~0.4 tall. */
export function bubbleTea(drink: string, pearls = true, layer?: string): THREE.Group {
  const g = new THREE.Group();
  const cupGeo = new THREE.CylinderGeometry(0.11, 0.085, 0.3, 18);
  const drinkM = mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.26, 18), mat(drink));
  drinkM.position.y = 0.14;
  g.add(drinkM);
  if (layer) {
    const l = mesh(new THREE.CylinderGeometry(0.102, 0.098, 0.06, 18), mat(layer));
    l.position.y = 0.24;
    g.add(l);
  }
  const glass = new THREE.Mesh(cupGeo, mat('#ffffff', { opacity: 0.35, rough: 0.2 }));
  glass.position.y = 0.15;
  g.add(glass);
  if (pearls) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#3b2626', { rough: 0.3 }));
      p.position.set(Math.cos(a) * 0.06, 0.04 + (i % 3) * 0.02, Math.sin(a) * 0.06);
      g.add(p);
    }
  }
  const lid = mesh(new THREE.SphereGeometry(0.11, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffffff', { opacity: 0.6, rough: 0.2 }));
  lid.position.y = 0.3;
  lid.scale.y = 0.5;
  const straw = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), mat('#ff7eb6'));
  straw.position.set(0.03, 0.4, 0);
  straw.rotation.z = -0.15;
  const sticker = mesh(new THREE.CircleGeometry(0.04, 14), mat('#ffffff'), false);
  sticker.position.set(0, 0.16, 0.102);
  g.add(lid, straw, sticker);
  return g;
}

/** Supermarket shelf with rows of colourful products. Front faces +Z. */
export function shelf(colors: string[], w = 2.2): THREE.Group {
  const g = new THREE.Group();
  // open frame: back panel, two sides and a top, so the products show
  const back = mesh(new THREE.BoxGeometry(w, 1.5, 0.08), mat('#d5dbe2'));
  back.position.set(0, 0.75, -0.26);
  const top = mesh(new THREE.BoxGeometry(w, 0.08, 0.6), mat('#eef1f4'));
  top.position.set(0, 1.5, 0);
  g.add(back, top);
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) {
    const side = mesh(new THREE.BoxGeometry(0.08, 1.5, 0.6), mat('#eef1f4'));
    side.position.set(x, 0.75, 0);
    g.add(side);
  }
  let n = 0;
  for (const y of [0.2, 0.62, 1.04]) {
    const board = mesh(new THREE.BoxGeometry(w - 0.1, 0.05, 0.5), mat('#ffffff'));
    board.position.set(0, y, 0.08);
    g.add(board);
    for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.22) {
      const c = colors[n++ % colors.length];
      const tall = n % 3 === 0;
      const item = tall ? mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), mat(c)) : mesh(new THREE.BoxGeometry(0.16, 0.22, 0.14), mat(c));
      item.position.set(x, y + (tall ? 0.17 : 0.135), 0.18);
      g.add(item);
    }
  }
  return g;
}

/** Glass-fronted fridge. Front faces +Z. */
export function fridge(colors: string[], w = 2.2): THREE.Group {
  const g = new THREE.Group();
  const back = mesh(new THREE.BoxGeometry(w, 1.9, 0.08), mat('#d6e4f2'));
  back.position.set(0, 0.95, -0.31);
  const base = mesh(new THREE.BoxGeometry(w, 0.15, 0.7), mat('#e4eef8'));
  base.position.y = 0.075;
  g.add(back, base);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
    const side = mesh(new THREE.BoxGeometry(0.1, 1.9, 0.7), mat('#e4eef8'));
    side.position.set(x, 0.95, 0);
    g.add(side);
  }
  for (const y of [0.18, 0.68, 1.18]) {
    const shelfBoard = mesh(new THREE.BoxGeometry(w - 0.1, 0.04, 0.6), mat('#f4f8fc'));
    shelfBoard.position.set(0, y, 0);
    g.add(shelfBoard);
  }
  let n = 0;
  for (const y of [0.35, 0.85, 1.35]) {
    for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.2) {
      const item = mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), mat(colors[n++ % colors.length]));
      item.position.set(x, y, 0.22);
      g.add(item);
    }
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 1.6, 0.04), mat('#cfe6ff', { opacity: 0.35, rough: 0.1 }));
  glass.position.set(0, 0.95, 0.36);
  const top = mesh(new THREE.BoxGeometry(w + 0.05, 0.2, 0.75), mat('#9fc6ea'));
  top.position.y = 1.95;
  g.add(glass, top);
  return g;
}

export function plant(s = 1): THREE.Group {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.35 * s, 14), mat('#e89a72'));
  pot.position.y = 0.17 * s;
  g.add(pot);
  const b = bush('#78c07a', 0.7 * s);
  b.position.y = 0.3 * s;
  g.add(b);
  return g;
}

export function table(top = '#f6dcc4'): THREE.Group {
  const g = new THREE.Group();
  const t = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20), mat(top));
  t.position.y = 0.7;
  const leg = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), mat('#c8a48a'));
  leg.position.y = 0.35;
  const foot = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), mat('#c8a48a'));
  foot.position.y = 0.02;
  g.add(t, leg, foot);
  return g;
}

export function stool(color = '#ffb6d2'): THREE.Group {
  const g = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), mat(color));
  seat.position.y = 0.45;
  const leg = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), mat('#c8a48a'));
  leg.position.y = 0.22;
  g.add(seat, leg);
  return g;
}

/** Cat tower for the café. */
export function catTower(): THREE.Group {
  const g = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), mat('#e9d2b4'));
  post.position.y = 0.8;
  g.add(post);
  for (const [y, r, c] of [[0.05, 0.5, '#f6b6c8'], [0.8, 0.38, '#c8b4f0'], [1.6, 0.42, '#f6b6c8']] as [number, number, string][]) {
    const p = mesh(new THREE.CylinderGeometry(r, r, 0.1, 18), mat(c));
    p.position.y = y;
    g.add(p);
  }
  return g;
}

export function counterBlock(w: number, color = '#ffc2d8', top = '#fff1ea'): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(w, 1, 0.8), mat(color));
  body.position.y = 0.5;
  const t = mesh(new THREE.BoxGeometry(w + 0.1, 0.08, 0.9), mat(top));
  t.position.y = 1.04;
  g.add(body, t);
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.2; x += 0.8) {
    const panel = mesh(new THREE.BoxGeometry(0.6, 0.6, 0.02), mat('#ffd6e6'), false);
    panel.position.set(x, 0.5, 0.41);
    g.add(panel);
  }
  return g;
}

export function register(): THREE.Group {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), mat('#5b5f73'));
  base.position.y = 0.1;
  const screen = mesh(new THREE.BoxGeometry(0.4, 0.28, 0.04), mat('#9fe0c9', { emissive: '#7fd0b0' }));
  screen.position.set(0, 0.36, -0.05);
  screen.rotation.x = -0.3;
  g.add(base, screen);
  return g;
}

export function cart(): THREE.Group {
  const g = new THREE.Group();
  const basket = mesh(new THREE.BoxGeometry(0.6, 0.35, 0.8), mat('#cfe0f0', { opacity: 0.85 }));
  basket.position.y = 0.55;
  const handle = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mat('#ff7eb6'));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0.8, -0.45);
  g.add(basket, handle);
  for (const [x, z] of [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0.3], [0.25, 0.3]]) {
    const w = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), mat('#3a3f4f'));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.08, z);
    g.add(w);
  }
  return g;
}

export function pond(r = 1.6): THREE.Group {
  const g = new THREE.Group();
  const rim = mesh(new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.12, 30), mat('#d8eef6'));
  rim.position.y = 0.06;
  const water = mesh(new THREE.CylinderGeometry(r, r, 0.14, 30), mat('#8fcff0', { rough: 0.2 }));
  water.position.y = 0.08;
  g.add(rim, water);
  for (const [x, z] of [[0.4, 0.3], [-0.5, -0.2]]) {
    const pad = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), mat('#7fc47a'));
    pad.position.set(x, 0.16, z);
    g.add(pad);
  }
  return g;
}
