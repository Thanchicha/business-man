import * as THREE from 'three';
import * as C from '../models/city';
import { canvasTexture, mat, mesh } from '../models/mat';
import { bubbleTea, plant } from '../models/props';

/**
 * The street in front of "Bubble Tea", like the cover art: a cream two-storey
 * shop with a pink striped awning between brick and beige neighbours, sakura
 * trees on the pavement and towers behind. Shopfronts face +Z at z = -1.6.
 */
export function buildStreet(o: { night?: boolean } = {}): THREE.Group {
  const night = !!o.night;
  const g = new THREE.Group();

  // brick paving everywhere in front of the shops
  const pave = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#b89c86';
    c.fillRect(0, 0, 128, 128);
    const cols = ['#dcc2ad', '#d4b8a2', '#e2cbb8', '#cfb19b'];
    for (let y = 0; y < 128; y += 16)
      for (let x = (y / 16) % 2 ? -16 : 0; x < 128; x += 32) {
        c.fillStyle = cols[((x + y * 3) / 16) & 3];
        c.fillRect(x + 1, y + 1, 30, 14);
      }
  });
  pave.wrapS = pave.wrapT = THREE.RepeatWrapping;
  pave.repeat.set(30, 16);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ map: pave, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -6;
  ground.receiveShadow = true;
  g.add(ground);
  // a stone kerb line and a planter strip give the pavement some structure
  const kerb = mesh(new THREE.BoxGeometry(90, 0.08, 0.3), mat('#d9d4cb'));
  kerb.position.set(0, 0.04, 3.9);
  g.add(kerb);

  // ---- our shop
  const shop = teaShopFront(night);
  shop.position.set(0, 0, -1.6);
  g.add(shop);

  // ---- neighbours along the street
  const row: [number, C.BuildingOpts][] = [
    [-6.6, { w: 6.6, d: 5, h: 5.4, style: 'brick', wall: C.WALLS.brick, shop: '#3f8f6b', awning: '#3f8f6b' }],
    [-13.6, { w: 7, d: 5, h: 7.2, style: 'apartment', wall: C.WALLS.cream, shop: '#2f6fae', awning: '#2f6fae' }],
    [-21, { w: 7.4, d: 5, h: 4.4, style: 'brick', wall: '#c27a5c', shop: '#e0a43a' }],
    [6.4, { w: 6.2, d: 5, h: 4.2, style: 'apartment', wall: C.WALLS.beige, shop: '#e07a3a', awning: '#e07a3a' }],
    [13.2, { w: 7, d: 5, h: 8.4, style: 'office', wall: C.WALLS.grey, shop: '#7a5a9a' }],
    [20.8, { w: 7.6, d: 5, h: 5.6, style: 'apartment', wall: C.WALLS.peach, shop: '#d9534f', awning: '#d9534f' }],
  ];
  row.forEach(([x, b], i) => {
    const bd = C.building({ ...b, night, seed: i + 3 });
    bd.position.set(x, 0, -1.6 - b.d / 2);
    g.add(bd);
  });

  // ---- skyline behind
  const towers: [number, number, number, C.FacadeStyle, string][] = [
    [-18, -16, 16, 'glass', '#9fb9cf'],
    [-9, -20, 22, 'glass', '#8fa9c2'],
    [-1, -14, 11, 'office', '#e6dccb'],
    [7, -22, 24, 'glass', '#a9c4d8'],
    [16, -15, 14, 'apartment', C.WALLS.sand],
    [25, -20, 19, 'glass', '#9fb9cf'],
    [-28, -22, 13, 'office', C.WALLS.slate],
    [33, -16, 10, 'apartment', C.WALLS.cream],
    [-3, -32, 30, 'glass', '#a9c4d8'],
    [-36, -14, 9, 'brick', C.WALLS.redBrick],
  ];
  towers.forEach(([x, z, h, style, wall], i) => {
    const t = C.building({ w: 5 + (i % 3), d: 5, h, style, wall, night, seed: i + 20 });
    t.position.set(x, 0, z);
    g.add(t);
  });

  // ---- pavement life: sakura and green trees, lamps, benches, planters
  const trees: [number, number, number, boolean][] = [
    [-8.6, 3.2, 1.7, true],
    [8.4, 3.2, 1.7, true],
    [-15.5, 3.2, 1.8, true],
    [-4.6, -0.9, 1.5, true],
    [11.8, -0.7, 1.4, true],
    [15.5, 3.2, 1.8, true],
    [-23, 3.2, 1.8, true],
    [23, 3.2, 1.6, true],
    [-11.5, -0.6, 1.2, false],
  ];
  trees.forEach(([x, z, s, blossom], i) => {
    const t = C.cityTree(i * 13 + 5, s, blossom);
    t.position.set(x, 0, z);
    g.add(t);
    const bed = mesh(new THREE.CylinderGeometry(0.5 * s, 0.55 * s, 0.18, 16), mat('#9a8a78'));
    bed.position.set(x, 0.09, z);
    g.add(bed);
  });
  for (const x of [-11, 4.6, 11.5, -19]) {
    const l = C.streetLamp(night);
    l.position.set(x, 0, 3.7);
    l.rotation.y = -Math.PI / 2;
    g.add(l);
  }
  // a cute vending machine by the brick cafe, glowing softly
  const vend = new THREE.Group();
  const vbody = mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7), mat('#9fd8e8'));
  vbody.position.y = 0.9;
  const vwin = mesh(new THREE.BoxGeometry(0.7, 0.9, 0.04), mat('#eaf8ff', { emissive: night ? '#cfefff' : '#bfe8ff' }), false);
  vwin.position.set(0, 1.2, 0.36);
  vend.add(vbody, vwin);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
    const can = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), mat(['#ff8fb8', '#ffd36e', '#7fc8f8', '#8fd0a8'][(r + k) % 4]), false);
    can.position.set(-0.24 + k * 0.16, 0.92 + r * 0.26, 0.4);
    vend.add(can);
  }
  vend.position.set(-9.9, 0, -1.05);
  g.add(vend);
  const bench = C.bench();
  bench.position.set(-5.2, 0, 0.2);
  g.add(bench);
  for (const [x, w] of [[-10.2, 1.6], [10.6, 1.8]] as [number, number][]) {
    const f = C.flowerBed(w, 0.6, x);
    f.position.set(x, 0, -1.2);
    g.add(f);
  }
  return g;
}

/** Warm café interior seen through the shop windows. */
function interiorTex(night: boolean): THREE.CanvasTexture {
  return canvasTexture(256, 128, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, night ? '#ffe2b0' : '#fbe6c9');
    grd.addColorStop(1, night ? '#e9a66a' : '#e2b98d');
    c.fillStyle = grd;
    c.fillRect(0, 0, 256, 128);
    // menu boards
    c.fillStyle = '#3b4a40';
    for (const x of [30, 100, 170]) c.fillRect(x, 18, 56, 32);
    c.fillStyle = '#f6efe2';
    for (const x of [30, 100, 170]) for (let y = 26; y < 46; y += 7) c.fillRect(x + 6, y, 30 + ((x + y) % 14), 2);
    // pendant lights
    for (const x of [40, 128, 216]) {
      c.fillStyle = '#7a5a40';
      c.fillRect(x, 0, 2, 10);
      c.fillStyle = '#fff3c8';
      c.beginPath();
      c.arc(x + 1, 13, 6, 0, Math.PI * 2);
      c.fill();
    }
    // shelves with cups
    c.fillStyle = '#a8744e';
    c.fillRect(10, 62, 236, 4);
    const cups = ['#d9a877', '#a8d58a', '#f39a4f', '#c9a8e6', '#f6d7a8'];
    for (let x = 16; x < 240; x += 14) {
      c.fillStyle = cups[(x / 14) % 5 | 0];
      c.fillRect(x, 50, 9, 12);
    }
    // counter
    c.fillStyle = '#b07a4f';
    c.fillRect(0, 92, 256, 36);
    c.fillStyle = '#f7efe4';
    c.fillRect(0, 88, 256, 6);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(90, 0);
    c.lineTo(30, 128);
    c.lineTo(0, 128);
    c.fill();
  });
}

/** Our shop's front: cream walls, pink awning, glowing sign, flower boxes. */
function teaShopFront(night: boolean): THREE.Group {
  const g = new THREE.Group();
  const W = 6;
  const D = 4.4;
  const H = 4.8;
  const wall = '#f8f1e8';
  const pink = '#f27aa8';
  const upper = C.facadeMat('apartment', wall, 4, 2, { night });
  const plain = mat(wall);
  const body = mesh(new THREE.BoxGeometry(W, H, D), [plain, plain, mat('#8e9095'), plain, upper, plain] as unknown as THREE.Material);
  body.position.set(0, H / 2, -D / 2);
  g.add(body);
  // ground floor: pink base, big windows into the warm café and a glass door
  const base = mesh(new THREE.BoxGeometry(W + 0.1, 2.1, 0.12), mat('#fbe7ee'));
  base.position.set(0, 1.05, 0.03);
  g.add(base);
  const inside = interiorTex(night);
  const winMat = new THREE.MeshStandardMaterial({ map: inside, roughness: 0.3, emissive: '#ffffff', emissiveMap: inside, emissiveIntensity: night ? 0.95 : 0.35 });
  for (const [x, w] of [[-1.6, 2.4], [2.15, 1.3]] as [number, number][]) {
    const frame = mesh(new THREE.BoxGeometry(w + 0.16, 1.56, 0.06), mat('#ffffff'));
    frame.position.set(x, 1.12, 0.1);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), winMat);
    glass.position.set(x, 1.12, 0.135);
    g.add(frame, glass);
    const sill = C.flowerBed(w, 0.28, x * 7);
    sill.position.set(x, 0.26, 0.28);
    g.add(sill);
  }
  const doorFrame = mesh(new THREE.BoxGeometry(1.06, 1.86, 0.06), mat('#c0638a'));
  doorFrame.position.set(0.55, 0.93, 0.1);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.74), winMat);
  door.position.set(0.55, 0.9, 0.135);
  const handle = mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), mat('#d9b46a'));
  handle.position.set(0.88, 0.95, 0.17);
  g.add(doorFrame, door, handle);
  // awning and the shop sign
  const aw = C.awning(pink, W - 0.2, 0.9);
  aw.position.set(0, 2.22, 0.08);
  g.add(aw);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.8),
    (() => {
      const map = canvasTexture(576, 128, (c) => {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.roundRect(4, 4, 568, 120, 30);
        c.fill();
        c.strokeStyle = pink;
        c.lineWidth = 8;
        c.stroke();
        // cat face badge
        c.fillStyle = '#ffd6e6';
        c.beginPath();
        c.arc(78, 66, 38, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(48, 50);
        c.lineTo(54, 18);
        c.lineTo(74, 38);
        c.moveTo(108, 50);
        c.lineTo(102, 18);
        c.lineTo(82, 38);
        c.fill();
        c.beginPath();
        c.arc(78, 70, 30, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4a3448';
        c.fillRect(64, 64, 6, 8);
        c.fillRect(86, 64, 6, 8);
        c.fillStyle = pink;
        c.fillRect(75, 78, 6, 4);
        c.fillStyle = '#e0558f';
        c.font = '600 64px Fredoka, Mitr, sans-serif';
        c.textBaseline = 'middle';
        c.fillText('Bubble Tea', 140, 70);
      });
      return new THREE.MeshStandardMaterial({ map, roughness: 0.6, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: night ? 0.8 : 0.15 });
    })(),
  );
  sign.position.set(-0.2, 2.75, 0.06);
  g.add(sign);
  // pink cornices
  for (const y of [2.32, H]) {
    const band = mesh(new THREE.BoxGeometry(W + 0.2, 0.16, D + 0.2), mat(y === H ? '#e8d9cc' : '#f6c1d4'));
    band.position.set(0, y, -D / 2);
    g.add(band);
  }
  // flower boxes under the upstairs windows
  for (const x of [-2.25, -0.75, 0.75, 2.25]) {
    const box = C.flowerBed(0.9, 0.22, x * 3 + 1);
    box.position.set(x, 3.12, 0.12);
    g.add(box);
  }
  // blade sign with a cup on the corner
  const arm = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), mat('#3e4450'));
  arm.position.set(W / 2 - 0.15, 3.75, 0.35);
  const blade = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), mat('#ffffff'));
  blade.rotation.z = Math.PI / 2;
  blade.position.set(W / 2 - 0.15, 3.3, 0.55);
  const cup = bubbleTea('#d9a877', true);
  cup.scale.setScalar(1.5);
  cup.position.set(W / 2 - 0.15, 3.0, 0.55);
  g.add(arm, blade, cup);
  // A-frame menu board and potted plants by the door
  const board = new THREE.Group();
  const face = mesh(
    new THREE.BoxGeometry(0.62, 0.86, 0.04),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(64, 96, (c) => {
        c.fillStyle = '#a8744e';
        c.fillRect(0, 0, 64, 96);
        c.fillStyle = '#34413a';
        c.fillRect(5, 5, 54, 86);
        c.fillStyle = '#ffffff';
        c.font = '600 11px Mitr';
        c.fillText('MENU', 16, 22);
        c.fillStyle = '#f7c6d8';
        for (let y = 34; y < 84; y += 10) c.fillRect(11, y, 26 + (y % 3) * 6, 3);
      }),
      roughness: 0.9,
    }),
  );
  face.position.y = 0.45;
  face.rotation.x = -0.18;
  board.add(face);
  board.position.set(-3.6, 0, 1.0);
  board.rotation.y = 0.3;
  g.add(board);
  for (const x of [-0.25, 1.35]) {
    const p = plant(1.1);
    p.position.set(x, 0, 0.45);
    g.add(p);
  }
  return g;
}
