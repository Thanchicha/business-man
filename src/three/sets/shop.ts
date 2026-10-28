import * as THREE from 'three';
import * as P from '../models/props';
import { canvasTexture, mat, mesh, signPlane } from '../models/mat';
import { furnitureModel } from '../models/furniture';
import { layout, type Furniture, type Placement } from '../../data/furniture';

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color), shadow);
  m.position.set(x, y, z);
  return m;
}

export interface ShopSet {
  group: THREE.Group;
  order: THREE.Vector3;
  queue: THREE.Vector3[];
  pickup: THREE.Vector3[];
  door: THREE.Vector3;
  /** Floor area cats may wander: [minX, minZ, maxX, maxZ]. */
  catArea: [number, number, number, number];
  camera: { pos: THREE.Vector3; look: THREE.Vector3 };
  setMenu(lines: string[]): void;
  /** Bought furniture, one entry per piece, so a scene can place them one at a time. */
  furniture: { placement: Placement; obj: THREE.Object3D }[];
  /** Every place a customer can sit, facing the way they sit. */
  seats: { pos: THREE.Vector3; rot: number }[];
}

/** Wooden plank floor. */
function planks(w: number, d: number): THREE.Mesh {
  const tex = canvasTexture(128, 128, (c) => {
    const cols = ['#c1915f', '#b48555', '#c89a6a', '#bb8a5a'];
    for (let y = 0; y < 128; y += 16) {
      const off = (y / 16) % 2 ? 40 : 0;
      for (let x = -off; x < 128; x += 80) {
        c.fillStyle = cols[((x + y) / 16) & 3];
        c.fillRect(x, y, 80, 16);
        c.fillStyle = 'rgba(90,55,30,0.35)';
        c.fillRect(x, y, 1, 16);
      }
      c.fillStyle = 'rgba(90,55,30,0.45)';
      c.fillRect(0, y, 128, 1);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 3, d / 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function brickMat(w: number, h: number): THREE.MeshStandardMaterial {
  const tex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#d8c7b4';
    c.fillRect(0, 0, 128, 128);
    const cols = ['#b5654b', '#a95a42', '#bf7257', '#9f533e'];
    for (let y = 0; y < 128; y += 16)
      for (let x = (y / 16) % 2 ? -16 : 0; x < 128; x += 32) {
        c.fillStyle = cols[((x * 7 + y) / 16) & 3];
        c.fillRect(x + 1, y + 1, 30, 14);
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 1.6, h / 1.6);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
}

/** Daylight street seen through the shop's front windows. */
function outsideTex(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, '#b49ce0');
    sky.addColorStop(1, '#ffd2c4');
    c.fillStyle = sky;
    c.fillRect(0, 0, 512, 256);
    const blds: [number, number, number, string][] = [[0, 40, 90, '#dcc6a3'], [92, 70, 80, '#b4624a'], [176, 20, 110, '#a9c4d8'], [290, 60, 90, '#efe4cf'], [384, 30, 128, '#c9ccd0']];
    for (const [x, y, w, col] of blds) {
      c.fillStyle = col;
      c.fillRect(x, y, w, 200);
      c.fillStyle = '#a9cfee';
      for (let wy = y + 10; wy < 170; wy += 22) for (let wx = x + 8; wx < x + w - 12; wx += 20) c.fillRect(wx, wy, 11, 13);
    }
    for (const [x, col] of [[40, '#f4b6c7'], [150, '#f7c5d2'], [250, '#6fae55'], [350, '#f4b6c7'], [470, '#efa6bb']] as [number, string][]) {
      c.fillStyle = '#7a5a44';
      c.fillRect(x - 3, 150, 6, 40);
      c.fillStyle = col;
      for (const [dx, dy, r] of [[0, 135, 30], [-22, 150, 22], [22, 148, 24]]) {
        c.beginPath();
        c.arc(x + dx, dy, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = '#d9c3ad';
    c.fillRect(0, 190, 512, 66);
    c.fillStyle = '#c7ad95';
    for (let x = 0; x < 512; x += 32) c.fillRect(x, 190, 1, 66);
  });
}

/** Wooden café chair with a back, facing +Z. */
function chair(cushion: string): THREE.Group {
  const g = new THREE.Group();
  const wood = '#9a6a45';
  g.add(box(0.46, 0.06, 0.46, wood, 0, 0.46, 0), box(0.44, 0.04, 0.44, cushion, 0, 0.5, 0));
  g.add(box(0.46, 0.5, 0.05, wood, 0, 0.74, -0.21));
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(box(0.05, 0.46, 0.05, wood, x, 0.23, z));
  return g;
}

function woodTable(): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 24), mat('#b98352'));
  top.position.y = 0.74;
  const leg = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 10), mat('#5e4330'));
  leg.position.y = 0.37;
  const foot = mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 16), mat('#5e4330'));
  foot.position.y = 0.02;
  const vase = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 10), mat('#ffffff'));
  vase.position.set(0.12, 0.86, 0);
  const flower = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#f48fb1'));
  flower.position.set(0.12, 0.98, 0);
  g.add(top, leg, foot, vase, flower);
  return g;
}

/** A wall shelf with jars, cups and a little plant. Front faces +Z. */
function wallShelf(w: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.06, 0.32, '#9a6a45', 0, 0, 0));
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) g.add(box(0.05, 0.18, 0.28, '#7a5236', x, -0.11, 0));
  const items = ['#f3e2c6', '#3b2626', '#d9a877', '#ffffff', '#a8d58a', '#f6c1d4'];
  let i = seed;
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.26) {
    const kind = i++ % 4;
    if (kind === 3) {
      const p = P.plant(0.55);
      p.position.set(x, 0.03, 0);
      g.add(p);
      continue;
    }
    const hgt = kind === 1 ? 0.26 : 0.2;
    const jar = mesh(new THREE.CylinderGeometry(0.08, 0.08, hgt, 12), mat(items[i % items.length], { rough: 0.4 }));
    jar.position.set(x, 0.03 + hgt / 2, 0);
    const lid = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12), mat('#c89466'));
    lid.position.set(x, 0.03 + hgt + 0.015, 0);
    g.add(jar, lid);
  }
  return g;
}

/** Warm pendant lamp: cord, brass cap and a glowing glass globe. */
function pendant(x: number, z: number, drop = 0.9): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.02, drop, 0.02, '#3a2a20', 0, 4 - drop / 2, 0, false));
  const cap = mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.1, 12), mat('#c9a15a', { rough: 0.3 }), false);
  cap.position.y = 4 - drop - 0.02;
  const globe = mesh(new THREE.SphereGeometry(0.2, 16, 12), mat('#fff1cf', { emissive: '#ffcf7a' }), false);
  globe.position.y = 4 - drop - 0.22;
  g.add(cap, globe);
  g.position.set(x, 0, z);
  return g;
}

/**
 * A cosy wooden bubble tea café, seen from behind the counter: plank floor,
 * brick wall with shelves, chalkboard menu, warm pendant lights and the
 * daylight street through big front windows. Customers come in through the
 * door in front and line up at the counter.
 */
export function buildShop(catCafe: boolean, furniture?: Furniture): ShopSet {
  const g = new THREE.Group();
  g.add(planks(14, 12));
  // front wall: wood wainscot, cream plaster, big window and the door
  g.add(box(14, 1.0, 0.3, '#9c6b47', 0, 0.5, -6), box(14, 3.0, 0.3, '#f4e9d8', 0, 2.5, -6), box(14, 0.08, 0.34, '#7a5236', 0, 1.02, -6));
  const outside = new THREE.MeshBasicMaterial({ map: outsideTex() });
  const winX = -0.9;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.1), outside);
  glass.position.set(winX, 2.15, -5.84);
  g.add(glass);
  const frames: [number, number, number, number][] = [[winX, 1.1, 5.5, 0.14], [winX, 3.2, 5.5, 0.14], [winX - 2.68, 2.15, 0.14, 2.2], [winX + 2.68, 2.15, 0.14, 2.2], [winX - 0.9, 2.15, 0.08, 2.1], [winX + 0.9, 2.15, 0.08, 2.1]];
  for (const [x, y, w, h] of frames) g.add(box(w, h, 0.1, '#7a5236', x, y, -5.8));
  g.add(box(5.4, 0.08, 0.36, '#9a6a45', winX, 1.12, -5.68));
  for (const x of [winX - 1.8, winX + 1.7]) {
    const p = P.plant(0.6);
    p.position.set(x, 1.16, -5.66);
    g.add(p);
  }
  g.add(box(1.7, 2.9, 0.12, '#7a5236', 4.6, 1.45, -5.82));
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.5), outside);
  doorGlass.position.set(4.6, 1.5, -5.74);
  g.add(doorGlass);
  const open = signPlane('OPEN', 0.8, 0.32, { bg: '#f27aa8', fg: '#ffffff' });
  open.position.set(4.6, 2.1, -5.7);
  g.add(open);
  // pink neon sign over the window
  const label = catCafe ? 'Bubble Tea & Cat Café' : 'Bubble Tea';
  const neonTex = canvasTexture(640, 100, (c) => {
    c.shadowColor = '#ff5fa2';
    c.shadowBlur = 18;
    c.font = '600 60px Fredoka, Mitr, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ff7ab4';
    c.fillText(label, 320, 52);
    c.strokeStyle = '#ffd0e4';
    c.lineWidth = 3;
    c.strokeText(label, 320, 52);
  });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.62), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true }));
  neon.position.set(winX, 3.62, -5.82);
  g.add(neon);
  // brick side wall with shelves; plaster wall opposite with pictures
  const brick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 12), brickMat(12, 4));
  brick.position.set(-7, 2, 0);
  brick.receiveShadow = true;
  g.add(brick);
  g.add(box(0.3, 1.0, 12, '#9c6b47', 7, 0.5, 0), box(0.3, 3.0, 12, '#f1e3cf', 7, 2.5, 0), box(0.34, 0.08, 12, '#7a5236', 7, 1.02, 0));
  for (const [z, y, s] of [[-3.6, 2.2, 1], [-1.6, 2.9, 2], [-3.6, 2.9, 3]] as [number, number, number][]) {
    const sh = wallShelf(1.8, s);
    sh.rotation.y = Math.PI / 2;
    sh.position.set(-6.68, y, z);
    g.add(sh);
  }
  for (const [z, s] of [[-3.0, 4], [-0.8, 5]] as [number, number][]) {
    const sh = wallShelf(1.8, s);
    sh.rotation.y = -Math.PI / 2;
    sh.position.set(6.68, 2.3, z);
    g.add(sh);
  }
  for (const [z, col] of [[-4.6, '#f6c1d4'], [-2.0, '#a9cfee']] as [number, string][]) g.add(box(0.05, 0.8, 0.62, '#7a5236', 6.82, 3.2, z), box(0.06, 0.66, 0.48, col, 6.8, 3.2, z));
  // ceiling with beams and warm pendant lights
  g.add(box(14, 0.1, 12, '#efe2cf', 0, 4.05, 0, false));
  for (let z = -5; z <= 5; z += 2.5) g.add(box(14, 0.18, 0.22, '#8a5c3b', 0, 3.92, z, false));
  for (const [x, z] of [[-3.2, -1.6], [0, -1.6], [3.2, -1.6], [-3.6, 1.6], [-1.2, 2.0]]) g.add(pendant(x, z));
  for (const [x, z] of [[-2.5, -1.5], [2.5, -1]]) {
    const l = new THREE.PointLight('#ffcf8a', 5, 9, 1.6);
    l.position.set(x, 3.0, z);
    g.add(l);
  }
  // ivy trailing from the beams near the windows
  for (let i = 0; i < 16; i++) {
    const x = -6.4 + i * 0.85;
    const len = 3 + (i * 7) % 5;
    for (let k = 0; k < len; k++) {
      const leaf = mesh(new THREE.SphereGeometry(0.08, 6, 5), mat(k % 2 ? '#4f8a46' : '#6fae55'), false);
      leaf.scale.set(1, 0.7, 0.6);
      leaf.position.set(x + Math.sin(k * 1.3 + i) * 0.08, 3.85 - k * 0.16, -5.6 + Math.cos(i) * 0.1);
      g.add(leaf);
    }
  }
  // pink neon cat on the brick wall
  const neonCat = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.78),
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTexture(180, 156, (c) => {
        c.strokeStyle = '#ff8cc6';
        c.shadowColor = '#ff4fa8';
        c.shadowBlur = 14;
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(32, 70);
        c.lineTo(46, 20);
        c.lineTo(74, 50);
        c.lineTo(106, 50);
        c.lineTo(134, 20);
        c.lineTo(148, 70);
        c.arc(90, 88, 60, -0.3, Math.PI + 0.3);
        c.closePath();
        c.stroke();
        c.fillStyle = '#ffb3d6';
        c.fillRect(64, 84, 7, 12);
        c.fillRect(109, 84, 7, 12);
      }),
    }),
  );
  neonCat.position.set(-6.82, 3.3, -0.4);
  neonCat.rotation.y = Math.PI / 2;
  g.add(neonCat);
  const neonGlow = new THREE.PointLight('#ff7ab8', 3, 4, 1.6);
  neonGlow.position.set(-6.2, 3.2, -0.4);
  g.add(neonGlow);
  // pastry display case and a drinks fridge along the plaster wall
  const cakeCase = new THREE.Group();
  cakeCase.add(box(1.8, 0.9, 0.7, '#b07a4f', 0, 0.45, 0), box(1.8, 0.04, 0.7, '#f7efe4', 0, 0.92, 0));
  const caseGlass = mesh(new THREE.BoxGeometry(1.76, 0.5, 0.66), mat('#e6f4ff', { opacity: 0.3, rough: 0.1 }), false);
  caseGlass.position.y = 1.19;
  cakeCase.add(caseGlass);
  const sweets = ['#ffd6e6', '#f7c873', '#c9a8e6', '#fff1e0', '#f48fb1', '#a87050'];
  for (let i = 0; i < 6; i++) {
    const cake = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), mat(sweets[i]));
    cake.position.set(-0.65 + i * 0.26, 0.99, (i % 2) * 0.16 - 0.08);
    const top = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(i % 2 ? '#e8435a' : '#ffffff'), false);
    top.position.set(cake.position.x, 1.07, cake.position.z);
    cakeCase.add(cake, top);
  }
  cakeCase.position.set(6.4, 0, -1.6);
  cakeCase.rotation.y = -Math.PI / 2;
  g.add(cakeCase);
  const fridge = P.fridge(['#ffd6e6', '#fff1c8', '#c9e8ff', '#d6f5e0', '#e8d6ff'], 1.4);
  fridge.position.set(6.45, 0, -4.2);
  fridge.rotation.y = -Math.PI / 2;
  g.add(fridge);
  // seating and the cat corner
  const placed: ShopSet['furniture'] = [];
  const seatSpots: ShopSet['seats'] = [];
  if (furniture) {
    layout(furniture).forEach((pl, i) => {
      const obj = furnitureModel(pl.id, i);
      obj.position.set(pl.x, 0, pl.z);
      obj.rotation.y = pl.rot;
      g.add(obj);
      placed.push({ placement: pl, obj });
      if (pl.id === 'chair_wood' || pl.id === 'stool') seatSpots.push({ pos: new THREE.Vector3(pl.x, 0, pl.z), rot: pl.rot });
      if (pl.id === 'sofa') for (const dx of [-0.4, 0.4]) seatSpots.push({ pos: new THREE.Vector3(pl.x + dx, 0, pl.z + 0.05), rot: pl.rot });
    });
  }
  // a shop that never visited the furniture store keeps its starter set
  const seats: [number, number][] = furniture ? [] : catCafe ? [[-5.4, -4.0], [-2.2, -4.0], [-5.6, -2.2]] : [[-5, -2.5]];
  for (const [x, z] of seats) {
    const t = woodTable();
    t.position.set(x, 0, z);
    g.add(t);
    for (const dx of [-0.85, 0.85]) {
      const s = chair(dx < 0 ? '#f6c1d4' : '#efe2cf');
      s.position.set(x + dx, 0, z);
      s.rotation.y = dx < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(s);
      seatSpots.push({ pos: new THREE.Vector3(x + dx, 0, z), rot: s.rotation.y });
    }
  }
  if (catCafe) {
    const ct = new THREE.Group();
    ct.add(box(0.24, 1.7, 0.24, '#e7d3b4', 0, 0.85, 0));
    for (const [y, rr, c] of [[0.05, 0.55, '#c89466'], [0.85, 0.4, '#f1e3cf'], [1.7, 0.45, '#c89466']] as [number, number, string][]) {
      const p = mesh(new THREE.CylinderGeometry(rr, rr, 0.1, 18), mat(c));
      p.position.y = y;
      ct.add(p);
    }
    ct.position.set(-6.2, 0, 0.1);
    g.add(ct);
    const rug = mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.03, 32), mat('#f3d9c4'));
    rug.position.set(-4.4, 0.015, -0.3);
    const rugIn = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.035, 32), mat('#f6c1d4'));
    rugIn.position.set(-4.4, 0.02, -0.3);
    g.add(rug, rugIn);
    for (const [x, z] of [[-3.3, 0.5], [-5.5, -0.9]]) {
      const bed = mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 16), mat('#efe2cf'));
      bed.rotation.x = Math.PI / 2;
      bed.position.set(x, 0.1, z);
      g.add(bed);
    }
  }
  for (const [x, z, s] of [[6.2, -5.2, 1.5], [-6.3, -5.2, 1.4], [2.7, -5.3, 1.2], [6.3, 2.5, 1.3]]) {
    const pl = P.plant(s);
    pl.position.set(x, 0, z);
    g.add(pl);
  }
  // the counter in front of the camera: wooden slats, cream top, tools of the trade
  const counter = new THREE.Group();
  counter.add(box(9, 1, 0.8, '#b07a4f', 0, 0.5, 0), box(9.1, 0.08, 0.92, '#f7efe4', 0, 1.04, 0));
  for (let x = -4.3; x <= 4.3; x += 0.3) counter.add(box(0.04, 0.9, 0.02, '#8f5f3b', x, 0.5, 0.41, false));
  counter.add(box(9, 0.12, 0.04, '#f6c1d4', 0, 0.92, 0.42, false));
  counter.position.set(0.5, 0, 3.8);
  g.add(counter);
  const reg = P.register();
  reg.position.set(-2.6, 1.08, 3.8);
  reg.rotation.y = Math.PI;
  g.add(reg);
  for (let i = 0; i < 4; i++) {
    const cup = P.bubbleTea(['#d9a877', '#a8d58a', '#f39a4f', '#c9a8e6'][i], i % 2 === 0);
    cup.position.set(1.9 + i * 0.4, 1.08, 3.75);
    g.add(cup);
  }
  for (let i = 0; i < 3; i++) {
    const urn = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 14), mat('#d7dade', { rough: 0.25 }));
    urn.position.set(3.8 + i * 0.4, 1.33, 3.6);
    const tap = mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), mat('#3a3f4a'));
    tap.position.set(3.8 + i * 0.4, 1.18, 3.47);
    g.add(urn, tap);
  }
  const stack = mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 14), mat('#ffffff', { opacity: 0.8 }));
  stack.position.set(-1.6, 1.38, 3.7);
  const sealer = new THREE.Group();
  sealer.add(box(0.36, 0.4, 0.4, '#f2f2f4', 0, 0.2, 0), box(0.3, 0.08, 0.34, '#f27aa8', 0, 0.42, 0));
  sealer.position.set(-0.9, 1.08, 3.65);
  const jar = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 14), mat('#ffffff', { opacity: 0.5, rough: 0.2 }));
  jar.position.set(1.2, 1.23, 3.7);
  const pearls = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 14), mat('#3b2626', { rough: 0.3 }));
  pearls.position.set(1.2, 1.17, 3.7);
  g.add(stack, sealer, jar, pearls);
  // chalkboard menu facing the owner, left of the window
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 512;
  boardCanvas.height = 320;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }));
  board.position.set(-5.2, 2.5, -5.82);
  g.add(board);

  return {
    group: g,
    order: new THREE.Vector3(0.2, 0, 2.6),
    queue: [0, 1, 2, 3, 4, 5].map((i) => new THREE.Vector3(1.4 + i * 0.25, 0, 1.2 - i * 1.05)),
    pickup: [new THREE.Vector3(-2.6, 0, 2.5), new THREE.Vector3(-3.6, 0, 2.2), new THREE.Vector3(-4.6, 0, 1.9)],
    door: new THREE.Vector3(4.6, 0, -5.4),
    catArea: [-6.3, -1.5, -2.6, 0.8],
    camera: { pos: new THREE.Vector3(0.3, 3.5, 8.8), look: new THREE.Vector3(0.3, 1.0, -1) },
    furniture: placed,
    seats: seatSpots,
    setMenu(lines) {
      const c = boardCanvas.getContext('2d')!;
      c.fillStyle = '#34413a';
      c.fillRect(0, 0, 512, 320);
      c.strokeStyle = '#9a6a45';
      c.lineWidth = 16;
      c.strokeRect(0, 0, 512, 320);
      c.fillStyle = '#ffffff';
      c.font = '600 34px Fredoka, Mitr';
      c.textAlign = 'center';
      c.fillText('~ MENU ~', 256, 52);
      c.font = '24px Mitr';
      c.textAlign = 'left';
      const half = Math.ceil(lines.length / 2);
      lines.forEach((l, i) => {
        c.fillStyle = i % 2 ? '#ffd6e6' : '#fff4d6';
        c.fillText(l, i < half ? 30 : 270, 96 + (i % half) * 40);
      });
      boardTex.needsUpdate = true;
    },
  };
}
