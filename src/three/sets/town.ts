import * as THREE from 'three';
import * as P from '../models/props';
import * as C from '../models/city';
import { canvasTexture, mat, mesh, signPlane, texMat } from '../models/mat';
import { rng } from '../../sim/rng';
import { LOCATIONS } from '../../data/locations';

export interface TownSet {
  group: THREE.Group;
  /** Centre of each rentable lot, by location id. */
  lots: Record<string, THREE.Vector3>;
  lotObjects: Record<string, THREE.Object3D>;
  /** Named landmarks for labels. */
  landmarks: { name: string; obj: THREE.Object3D; h: number }[];
  plaza: THREE.Vector3;
  /** Pink glowing outline + map pin over one lot (null hides it). */
  highlight(id: string | null): void;
  update(dt: number): void;
}

/**
 * A coastal grid city like the mockup map: blocks every 10 units, asphalt
 * roads with crosswalks, the sea along the south edge.
 */
const PITCH = 10;
const ROAD = 2.4;
const BLOCK = PITCH - ROAD;
const P_OFF = 1.65;
const XS = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
const ZS = [-40, -30, -20, -10, 0];
const COAST = 13;

/** Rentable lots sit on one parcel of a block, facing the street. */
const LOT_POS: Record<string, [number, number, number]> = {
  university: [-10 - P_OFF, -10 - P_OFF, Math.PI],
  village: [-20 + P_OFF, P_OFF, 0],
  bts: [10 - P_OFF, -10 - P_OFF, Math.PI],
  office: [20 - P_OFF, -10 + P_OFF, -Math.PI / 2],
  mall: [10 + P_OFF, P_OFF, Math.PI / 2],
};

/** Parcels next to each lot where the rival shops stand. */
const RIVAL_POS: Record<string, [number, number, number][]> = {
  university: [[-10 + P_OFF, -10 - P_OFF, Math.PI]],
  bts: [[10 + P_OFF, -10 - P_OFF, Math.PI], [10 + P_OFF, -10 + P_OFF, Math.PI / 2]],
  office: [[20 + P_OFF, -10 + P_OFF, 0]],
  mall: [[10 + P_OFF, -P_OFF, Math.PI / 2], [10 - P_OFF, P_OFF, 0], [10 - P_OFF, -P_OFF, -Math.PI / 2]],
};

type Kind = 'mixed' | 'office' | 'houses' | 'park' | 'campus' | 'field' | 'mall' | 'lots' | 'apartments';

function blockKind(x: number, z: number): Kind {
  const k = `${x},${z}`;
  const fixed: Record<string, Kind> = {
    '0,0': 'park',
    '-10,-20': 'campus',
    '-20,-20': 'field',
    '20,0': 'mall',
    '-10,-10': 'lots',
    '10,-10': 'lots',
    '10,0': 'lots',
    '-20,0': 'lots',
    '20,-10': 'lots',
    '-20,-10': 'houses',
    '-30,0': 'houses',
    '-30,-10': 'houses',
    '-40,0': 'houses',
    '-30,-20': 'houses',
    '20,-20': 'office',
    '30,-20': 'office',
    '30,-10': 'office',
    '10,-20': 'office',
    '20,-30': 'office',
    '30,-30': 'office',
    '0,-30': 'office',
    '10,-30': 'office',
  };
  return fixed[k] ?? (Math.abs(x) >= 30 || z <= -30 ? 'apartments' : 'mixed');
}

export function buildTown(o: { night?: boolean } = {}): TownSet {
  const night = !!o.night;
  const g = new THREE.Group();
  const r = rng(2024);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const keep: THREE.Object3D[] = [];

  // ---- ground: asphalt everywhere, sea to the south
  const asphalt = mesh(new THREE.PlaneGeometry(120, 90), mat('#6f737b', { rough: 0.95 }), false);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, COAST - 45);
  asphalt.receiveShadow = true;
  g.add(asphalt);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshStandardMaterial({ color: '#4f9fd4', roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.35, COAST + 100);
  sea.receiveShadow = true;
  g.add(sea);
  keep.push(sea);
  // gentle wave sparkles on the water
  const sparkles = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + r() * 1.2, 0.07), mat('#d8f0ff', { emissive: '#bfe6ff' }));
    s.rotation.x = -Math.PI / 2;
    s.position.set((r() - 0.5) * 110, -0.33, COAST + 2 + r() * 30);
    sparkles.add(s);
  }
  g.add(sparkles);
  keep.push(sparkles);
  const seawall = mesh(new THREE.BoxGeometry(120, 0.6, 0.6), mat('#cfc6b4'));
  seawall.position.set(0, -0.1, COAST + 0.1);
  g.add(seawall);

  // ---- lane markings and crosswalks
  const lineMat = mat('#f4f4f0');
  const dash = new THREE.BoxGeometry(0.7, 0.012, 0.09);
  const zebra = new THREE.BoxGeometry(0.22, 0.012, 1.1);
  const roadXs = [...XS.map((x) => x - PITCH / 2), XS[XS.length - 1] + PITCH / 2];
  const roadZs = [...ZS.map((z) => z - PITCH / 2), ZS[ZS.length - 1] + PITCH / 2];
  for (const z of roadZs)
    for (let x = -45; x < 45; x += 1.5) {
      if (roadXs.some((rx) => Math.abs(rx - x) < ROAD)) continue;
      const d = new THREE.Mesh(dash, lineMat);
      d.position.set(x, 0.01, z);
      g.add(d);
    }
  for (const x of roadXs)
    for (let z = -45; z < COAST - 1; z += 1.5) {
      if (roadZs.some((rz) => Math.abs(rz - z) < ROAD)) continue;
      const d = new THREE.Mesh(dash, lineMat);
      d.rotation.y = Math.PI / 2;
      d.position.set(x, 0.01, z);
      g.add(d);
    }
  // zebra crossings on the four sides of the central intersections
  for (const x of roadXs.filter((v) => Math.abs(v) < 26))
    for (const z of roadZs.filter((v) => v > -26)) {
      for (let i = -3; i <= 3; i++) {
        for (const [dx, dz, rot] of [[0, -ROAD / 2 - 0.75, Math.PI / 2], [0, ROAD / 2 + 0.75, Math.PI / 2], [-ROAD / 2 - 0.75, 0, 0], [ROAD / 2 + 0.75, 0, 0]] as [number, number, number][]) {
          const zb = new THREE.Mesh(zebra, lineMat);
          zb.rotation.y = rot;
          const along = i * 0.36;
          zb.position.set(x + dx + (rot ? along : 0), 0.012, z + dz + (rot ? 0 : along));
          if (Math.abs(dz) > 0 && z + dz > COAST - 1) continue;
          g.add(zb);
        }
      }
    }

  // ---- blocks
  const landmarks: TownSet['landmarks'] = [];
  const anchor = (x: number, y: number, z: number) => {
    const a = new THREE.Object3D();
    a.position.set(x, y, z);
    g.add(a);
    keep.push(a);
    return a;
  };
  const sidewalk = mat('#d9d3c8');
  const kerb = mat('#bdb6aa');
  const lawn = mat('#86bd5e');
  const paving = mat('#e4dccd');
  const slab = (x: number, z: number, w: number, d: number, m: THREE.Material, y = 0.14) => {
    const s = mesh(new THREE.BoxGeometry(w, y, d), m);
    s.position.set(x, y / 2, z);
    s.castShadow = false;
    g.add(s);
    return s;
  };
  const tree = (x: number, z: number, s = 1, blossom = r() < 0.34) => {
    const t = C.cityTree(Math.floor(r() * 1e6), s, blossom);
    t.position.set(x, 0.14, z);
    g.add(t);
  };
  const place = (o: THREE.Object3D, x: number, z: number, rot = 0) => {
    o.position.set(x, 0.14, z);
    o.rotation.y = rot;
    g.add(o);
    return o;
  };
  /** A building on one parcel, facing the nearest road side. */
  const parcelBuilding = (x: number, z: number, kind: Kind, rot: number) => {
    const style: C.FacadeStyle = kind === 'office' ? pick(['glass', 'glass', 'office']) : kind === 'houses' ? 'house' : pick(['apartment', 'apartment', 'brick', 'office']);
    const wall =
      style === 'glass' ? pick(['#9fb9cf', '#a9c4d8', '#8fa9c2']) : style === 'brick' ? pick([C.WALLS.brick, C.WALLS.redBrick, '#b8735a']) : style === 'house' ? pick([C.WALLS.cream, C.WALLS.white, C.WALLS.sand, C.WALLS.peach]) : pick([C.WALLS.cream, C.WALLS.beige, C.WALLS.white, C.WALLS.grey, C.WALLS.sand, C.WALLS.blue, C.WALLS.peach]);
    const h =
      kind === 'office' ? 6 + r() * 9 : kind === 'houses' ? 1.2 + r() * 0.4 : kind === 'apartments' ? 3.5 + r() * 6 : 2.2 + r() * 3.2;
    const w = kind === 'houses' ? 2.2 : 2.6 + r() * 0.5;
    const shopColor = kind === 'mixed' && r() < 0.6 ? pick(['#d9534f', '#3f8f6b', '#2f6fae', '#e0a43a', '#f48fb1', '#7a5a9a']) : undefined;
    const b = C.building({ w, d: kind === 'houses' ? 2.0 : 2.6 + r() * 0.4, h, style, wall, roof: style === 'house' ? pick(C.ROOFS) : undefined, shop: shopColor, awning: shopColor && r() < 0.7 ? shopColor : undefined, night, seed: Math.floor(r() * 1000) });
    place(b, x, z, rot);
  };
  /** Rotation that turns a parcel's front (+Z) towards the closer outer edge. */
  const faceOut = (dx: number, dz: number) => (Math.abs(dz) >= Math.abs(dx) ? (dz > 0 ? 0 : Math.PI) : dx > 0 ? Math.PI / 2 : -Math.PI / 2);
  const reserved = new Set<string>();
  for (const id of Object.keys(LOT_POS)) reserved.add(`${LOT_POS[id][0]},${LOT_POS[id][1]}`);
  for (const list of Object.values(RIVAL_POS)) for (const [x, z] of list) reserved.add(`${x},${z}`);

  for (const bx of XS)
    for (const bz of ZS) {
      const kind = blockKind(bx, bz);
      slab(bx, bz, BLOCK + 0.1, BLOCK + 0.1, kerb, 0.13);
      slab(bx, bz, BLOCK - 0.1, BLOCK - 0.1, sidewalk, 0.14);
      const near = Math.abs(bx) <= 30 && bz >= -30;
      // street trees along the sidewalk edge
      if (near && kind !== 'park')
        for (const [dx, dz] of [[-2.6, BLOCK / 2 - 0.35], [2.6, BLOCK / 2 - 0.35], [-BLOCK / 2 + 0.35, 2.6], [BLOCK / 2 - 0.35, -2.6]]) if (r() < 0.75) tree(bx + dx, bz + dz, 0.75);
      if (kind === 'park') {
        slab(bx, bz, BLOCK - 1.2, BLOCK - 1.2, lawn, 0.17);
        slab(bx, bz, BLOCK - 1.2, 1.0, paving, 0.18);
        slab(bx, bz, 1.0, BLOCK - 1.2, paving, 0.18);
        const pond = P.pond(1.3);
        place(pond, bx, bz);
        const jet = mesh(new THREE.CylinderGeometry(0.08, 0.3, 0.9, 10), mat('#d8f0ff', { opacity: 0.7 }), false);
        jet.position.set(bx, 0.6, bz);
        g.add(jet);
        for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2], [-2.6, -0.9], [2.6, 0.9]]) tree(bx + dx, bz + dz, 0.9, r() < 0.4);
        for (const [dx, dz, rot] of [[-1.4, 1.2, 0], [1.4, -1.2, Math.PI]] as [number, number, number][]) place(C.bench(), bx + dx, bz + dz, rot);
        for (const [dx, dz] of [[-1.3, -2.6], [1.3, 2.6]]) place(C.flowerBed(1.2, 0.6, dx * 10), bx + dx, bz + dz);
        continue;
      }
      if (kind === 'field') {
        slab(bx, bz, BLOCK - 0.8, BLOCK - 0.8, mat('#c97a5a'), 0.16);
        slab(bx, bz, BLOCK - 2.0, BLOCK - 2.6, lawn, 0.17);
        for (const dz of [-1.6, 1.6]) {
          const l = mesh(new THREE.BoxGeometry(BLOCK - 2.2, 0.01, 0.05), lineMat, false);
          l.position.set(bx, 0.18, bz + dz);
          g.add(l);
        }
        continue;
      }
      if (kind === 'campus') {
        slab(bx, bz, BLOCK - 0.8, BLOCK - 0.8, lawn, 0.16);
        const uni = buildUniversity(night);
        place(uni, bx, bz - 0.8);
        landmarks.push({ name: 'มหาวิทยาลัย', obj: anchor(bx, 0, bz), h: 6.2 });
        for (const dx of [-3, 3]) tree(bx + dx, bz + 2.6, 0.9, true);
        continue;
      }
      if (kind === 'mall') {
        const mall = buildMall(night);
        place(mall, bx, bz, -Math.PI / 2);
        landmarks.push({ name: 'ห้างสรรพสินค้า', obj: anchor(bx, 0, bz), h: 4.6 });
        continue;
      }
      // four parcels per block
      for (const [dx, dz] of [[-P_OFF, -P_OFF], [P_OFF, -P_OFF], [-P_OFF, P_OFF], [P_OFF, P_OFF]]) {
        const x = bx + dx;
        const z = bz + dz;
        if (reserved.has(`${x},${z}`)) continue;
        if (kind === 'houses') {
          slab(x, z, 3.1, 3.1, lawn, 0.16);
          parcelBuilding(x, z - 0.2, kind, faceOut(dx, dz));
          tree(x + (dx > 0 ? 1.1 : -1.1), z + (dz > 0 ? 1.1 : -1.1), 0.7);
          continue;
        }
        if (kind === 'mixed' && near && r() < 0.15) {
          slab(x, z, 3.0, 3.0, lawn, 0.16);
          tree(x - 0.6, z - 0.5, 0.9);
          tree(x + 0.7, z + 0.6, 0.8, true);
          continue;
        }
        parcelBuilding(x, z, kind === 'lots' ? 'mixed' : kind, faceOut(dx, dz));
      }
    }

  // ---- waterfront promenade between the last road and the sea
  const prom = (ZS[ZS.length - 1] + PITCH / 2 + ROAD / 2 + COAST) / 2;
  const promD = COAST - (ZS[ZS.length - 1] + PITCH / 2 + ROAD / 2);
  slab(0, prom, 120, promD, paving, 0.14);
  for (let x = -44; x <= 44; x += 4) {
    if (Math.abs(x - 22) < 5) continue;
    slab(x, prom - 0.6, 2.6, 1.6, lawn, 0.17);
    tree(x, prom - 0.6, 0.85, r() < 0.3);
  }
  for (let x = -42; x <= 42; x += 6) place(C.streetLamp(night), x + 2, COAST - 0.6, -Math.PI / 2);
  for (const x of [-14, -6, 4, 12, 30]) place(C.bench(), x, COAST - 0.9);
  const wheel = C.ferrisWheel(3.4, night);
  place(wheel, 22, prom);
  landmarks.push({ name: 'ชิงช้าสวรรค์', obj: anchor(22, 0, prom), h: 8.4 });
  keep.push(wheel.getObjectByName('wheel')!);
  // wooden pier with a boat
  const pier = mesh(new THREE.BoxGeometry(1.6, 0.14, 6), mat('#a77b52'));
  pier.position.set(-10, 0.05, COAST + 3);
  g.add(pier);
  for (const z of [1, 3, 5]) for (const x of [-10.7, -9.3]) {
    const post = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), mat('#7a5a3e'));
    post.position.set(x, -0.25, COAST + z);
    g.add(post);
  }
  const boats = [C.boat(), C.sailboat(), C.boat(), C.sailboat(), C.sailboat()];
  boats.forEach((b, i) => {
    b.position.set(i ? -34 + i * 15 : -8.4, -0.3, COAST + 2.5 + (i % 3) * 4);
    b.rotation.y = i ? 0.3 : Math.PI / 2;
    g.add(b);
    keep.push(b);
  });

  // ---- elevated BTS line over the road north of the lots
  const btsZ = -15;
  const bts = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(90, 0.35, 1.3), mat('#d5d7db'));
  deck.position.y = 3.1;
  bts.add(deck);
  for (let x = -44; x <= 44; x += 4) {
    if (roadXs.some((rx) => Math.abs(rx - x) < 1.6)) continue;
    const p = mesh(new THREE.BoxGeometry(0.5, 3.0, 0.5), mat('#c4c7cc'));
    p.position.set(x, 1.5, 0);
    bts.add(p);
  }
  const station = new THREE.Group();
  const hall = mesh(new THREE.BoxGeometry(5, 1.2, 2.4), mat('#eef0f2'));
  hall.position.y = 3.9;
  const roof = mesh(new THREE.BoxGeometry(5.4, 0.18, 2.8), mat('#5c9a5a'));
  roof.position.y = 4.6;
  const glass = mesh(new THREE.BoxGeometry(5.02, 0.5, 2.42), mat('#7fa9c8', { rough: 0.3 }), false);
  glass.position.y = 4.0;
  station.add(hall, roof, glass);
  for (const sx of [-1, 1]) {
    const stair = mesh(new THREE.BoxGeometry(0.9, 0.2, 3.4), mat('#c9ccd0'));
    stair.position.set(sx * 2.2, 1.7, 2.2);
    stair.rotation.x = 0.85;
    station.add(stair);
  }
  station.position.x = 10;
  bts.add(station);
  const train = new THREE.Group();
  train.name = 'train';
  for (let i = 0; i < 3; i++) {
    const car = mesh(new THREE.BoxGeometry(2.3, 0.75, 0.9), mat('#f3f5f7', { rough: 0.4 }));
    car.position.set(i * 2.4, 3.7, 0);
    const stripe = mesh(new THREE.BoxGeometry(2.32, 0.14, 0.92), mat('#4f9a52'), false);
    stripe.position.set(i * 2.4, 3.55, 0);
    const win = mesh(new THREE.BoxGeometry(2.0, 0.22, 0.92), mat('#2f3d52', { rough: 0.2 }), false);
    win.position.set(i * 2.4, 3.85, 0);
    train.add(car, stripe, win);
  }
  bts.add(train);
  bts.position.z = btsZ;
  g.add(bts);
  keep.push(train);
  landmarks.push({ name: 'สถานี BTS', obj: anchor(10, 0, btsZ), h: 5.6 });
  landmarks.push({ name: 'ย่านออฟฟิศ', obj: anchor(25, 0, -25), h: 15 });
  landmarks.push({ name: 'หมู่บ้าน', obj: anchor(-30, 0, -5), h: 3.6 });

  // ---- lots for rent and the rivals next to them
  const lots: Record<string, THREE.Vector3> = {};
  const lotObjects: Record<string, THREE.Object3D> = {};
  for (const loc of LOCATIONS) {
    const [x, z, rot] = LOT_POS[loc.id];
    const lot = rentLot();
    place(lot, x, z, rot);
    keep.push(lot);
    lots[loc.id] = new THREE.Vector3(x, 0, z);
    lotObjects[loc.id] = lot;
    loc.competitors.forEach((c, i) => {
      const [sx, sz, srot] = RIVAL_POS[loc.id][i];
      place(C.teaStore(c.color, { night, w: 2.8 }), sx, sz, srot);
    });
  }

  // ---- far skyline so the horizon isn't empty
  for (let i = 0; i < 26; i++) {
    const x = -70 + i * 5.6 + r() * 2;
    const h = 8 + r() * 18;
    const b = C.building({ w: 3 + r() * 2, d: 3, h, style: pick(['glass', 'office', 'apartment']), wall: pick(['#a9bccb', '#c9ccd0', '#dcc6a3', '#9fb5c9']), night, seed: i });
    b.position.set(x, 0, -52 - r() * 8);
    g.add(b);
  }

  // ---- traffic
  const cars: { obj: THREE.Group; axis: 'x' | 'z'; lane: number; speed: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const axis = i % 2 ? 'x' : 'z';
    const dir = r() < 0.5 ? 1 : -1;
    const roadLine = axis === 'x' ? pick(roadZs) : pick(roadXs.filter((v) => Math.abs(v) < 40));
    const c = C.car(pick(C.CAR_COLORS));
    const lane = roadLine + dir * 0.55 * (axis === 'x' ? 1 : -1);
    const start = -45 + r() * 90;
    if (axis === 'x') c.position.set(start, 0, lane);
    else c.position.set(lane, 0, Math.min(4, start * 0.5 - 20));
    c.rotation.y = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(c);
    keep.push(c);
    cars.push({ obj: c, axis, lane, speed: dir * (2 + r() * 1.5) });
  }

  // ---- selection highlight
  const hl = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ color: '#ff8fc0', transparent: true, opacity: 0.35, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.2;
  const edge = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.45, 4, 1), new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0.9, depthWrite: false }));
  edge.rotation.x = -Math.PI / 2;
  edge.rotation.z = Math.PI / 4;
  edge.position.y = 0.21;
  const pin = new THREE.Group();
  const pinHead = mesh(new THREE.SphereGeometry(0.42, 20, 14), mat('#ff5fa2', { emissive: '#ff5fa2' }), false);
  pinHead.position.y = 0.9;
  const pinTip = mesh(new THREE.ConeGeometry(0.3, 0.75, 16), mat('#ff5fa2', { emissive: '#ff5fa2' }), false);
  pinTip.rotation.x = Math.PI;
  pinTip.position.y = 0.42;
  const dot = mesh(new THREE.SphereGeometry(0.17, 12, 8), mat('#ffffff'), false);
  dot.position.set(0, 0.95, 0.3);
  pin.add(pinHead, pinTip, dot);
  pin.position.y = 2.2;
  hl.add(glow, edge, pin);
  hl.visible = false;
  g.add(hl);
  keep.push(hl);

  C.mergeStatic(g, keep);

  let t = 0;
  return {
    group: g,
    lots,
    lotObjects,
    landmarks,
    plaza: new THREE.Vector3(0, 0, 3.4),
    highlight(id) {
      hl.visible = !!id;
      if (id) hl.position.copy(lots[id]);
    },
    update(dt) {
      t += dt;
      train.position.x = ((t * 3) % 100) - 50;
      wheel.getObjectByName('wheel')!.rotation.z = t * 0.12;
      wheel.getObjectByName('wheel')!.children.forEach((c) => {
        if (c.userData.cabin) c.rotation.z = -t * 0.12;
      });
      for (const c of cars) {
        if (c.axis === 'x') {
          c.obj.position.x += c.speed * dt;
          if (c.obj.position.x > 46) c.obj.position.x = -46;
          if (c.obj.position.x < -46) c.obj.position.x = 46;
        } else {
          c.obj.position.z += c.speed * dt;
          if (c.obj.position.z > 5) c.obj.position.z = -46;
          if (c.obj.position.z < -46) c.obj.position.z = 5;
        }
      }
      boats.forEach((b, i) => {
        b.position.y = -0.3 + Math.sin(t * 1.5 + i) * 0.04;
        if (i) b.position.x = ((b.position.x + dt * 0.6 + 60) % 120) - 60;
      });
      sparkles.children.forEach((s, i) => ((s as THREE.Mesh).visible = Math.sin(t * 2 + i * 1.7) > -0.2));
      pin.position.y = 2.2 + Math.sin(t * 3) * 0.15;
      pin.rotation.y = t * 1.5;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(t * 4) * 0.08;
    },
  };
}

/** Empty parcel for rent: paved patch, low fence and a "for rent" board. Front faces +Z. */
function rentLot(): THREE.Group {
  const g = new THREE.Group();
  const lot = mesh(new THREE.BoxGeometry(3.0, 0.06, 3.0), mat('#d8c9a8'));
  lot.position.y = 0.03;
  g.add(lot);
  for (const [x, z, w, d] of [[0, -1.45, 3, 0.06], [-1.45, 0, 0.06, 3], [1.45, 0, 0.06, 3]] as [number, number, number, number][]) {
    const f = mesh(new THREE.BoxGeometry(w, 0.3, d), mat('#f2efe8'));
    f.position.set(x, 0.15, z);
    g.add(f);
  }
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), mat('#6e5a4a'));
  post.position.set(0.9, 0.6, 1.1);
  const board = signPlane('ให้เช่า', 1.0, 0.5, { bg: '#ffd56b', fg: '#6a4a10' });
  board.position.set(0.9, 1.15, 1.15);
  const back = board.clone();
  back.rotation.y = Math.PI;
  back.position.z = 1.05;
  g.add(post, board, back);
  for (const [x, z] of [[-1.2, 1.2], [-0.5, 1.25]]) {
    const c = mesh(new THREE.ConeGeometry(0.1, 0.32, 8), texMat('cone', 8, 16, (ctx) => {
      ctx.fillStyle = '#ff8a3c';
      ctx.fillRect(0, 0, 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 6, 8, 3);
    }));
    c.position.set(x, 0.16, z);
    g.add(c);
  }
  return g;
}

function buildUniversity(night: boolean): THREE.Group {
  const g = new THREE.Group();
  const main = C.building({ w: 6.2, d: 2.6, h: 2.8, style: 'brick', wall: '#e8d6b8', night, seed: 7 });
  g.add(main);
  for (const x of [-3.6, 3.6]) {
    const wing = C.building({ w: 1.4, d: 3.6, h: 2.2, style: 'brick', wall: '#e8d6b8', night, seed: 8 });
    wing.position.set(x * 0.92, 0, 0.5);
    g.add(wing);
  }
  const tower = C.building({ w: 1.4, d: 1.4, h: 4.6, style: 'brick', wall: '#dcc6a3', night, seed: 9 });
  tower.position.set(0, 0, 0.2);
  g.add(tower);
  const cap = mesh(new THREE.ConeGeometry(1.1, 1.3, 4), mat('#a5483a'));
  cap.rotation.y = Math.PI / 4;
  cap.position.set(0, 5.3, 0.2);
  const face = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), mat('#fffaf0'));
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 3.9, 0.93);
  const hand = mesh(new THREE.BoxGeometry(0.05, 0.32, 0.02), mat('#333333'), false);
  hand.position.set(0, 4.0, 0.97);
  g.add(cap, face, hand);
  const steps = mesh(new THREE.BoxGeometry(2.4, 0.2, 0.8), mat('#e2ddd3'));
  steps.position.set(0, 0.1, 1.6);
  g.add(steps);
  for (const x of [-0.8, -0.27, 0.27, 0.8]) {
    const col = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), mat('#f4efe6'));
    col.position.set(x, 1.0, 1.45);
    g.add(col);
  }
  const portico = mesh(new THREE.BoxGeometry(2.2, 0.25, 0.6), mat('#f4efe6'));
  portico.position.set(0, 1.9, 1.45);
  g.add(portico);
  return g;
}

/** The town's landmark: a pink cat-themed mall with cat ears on the roof and a cat face over the entrance. */
function buildMall(night: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = C.building({ w: 7, d: 6.6, h: 3.6, style: 'apartment', wall: '#f6c9da', night, seed: 11 });
  g.add(body);
  const upper = C.building({ w: 5, d: 4.6, h: 1.8, style: 'apartment', wall: '#fbe0ea', night, seed: 12 });
  upper.position.y = 3.6;
  g.add(upper);
  const front = mesh(new THREE.BoxGeometry(4.4, 2.4, 0.15), C.facadeMat('glass', '#c9b3e6', 6, 3, { night }));
  front.position.set(0, 1.3, 3.36);
  const band = mesh(new THREE.BoxGeometry(7.1, 0.4, 6.7), mat('#f27aa8'));
  band.position.y = 3.45;
  const roof = mesh(new THREE.BoxGeometry(5.1, 0.25, 4.7), mat('#f27aa8'));
  roof.position.y = 5.5;
  const sign = signPlane('NEKO MALL', 2.6, 0.5, { bg: '#ffffff', fg: '#e0558f', border: '#f27aa8' });
  sign.position.set(0, 2.95, 3.41);
  const canopy = mesh(new THREE.BoxGeometry(4.8, 0.12, 1.0), mat('#fff4f8'));
  canopy.position.set(0, 2.6, 3.8);
  g.add(front, band, roof, sign, canopy);
  // giant cat ears and a round cat face on the upper floor
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.9, 1.4, 4), mat('#f6c9da'));
    ear.rotation.y = Math.PI / 4;
    ear.position.set(s * 1.6, 6.3, 0);
    const inner = mesh(new THREE.ConeGeometry(0.5, 0.9, 4), mat('#ff9cc4'));
    inner.rotation.y = Math.PI / 4;
    inner.position.set(s * 1.6, 6.15, 0.42);
    g.add(ear, inner);
  }
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 32),
    new THREE.MeshStandardMaterial({
      emissive: '#ffffff',
      emissiveIntensity: night ? 0.7 : 0.15,
      map: canvasTexture(128, 128, (c) => {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(64, 64, 64, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4a3448';
        c.fillRect(38, 52, 10, 16);
        c.fillRect(80, 52, 10, 16);
        c.fillStyle = '#ff8fb8';
        c.beginPath();
        c.arc(30, 80, 9, 0, Math.PI * 2);
        c.arc(98, 80, 9, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#4a3448';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(54, 80);
        c.quadraticCurveTo(59, 86, 64, 80);
        c.quadraticCurveTo(69, 86, 74, 80);
        c.stroke();
      }),
    }),
  );
  face.position.set(0, 4.55, 2.32);
  g.add(face);
  // pink fountain plaza in front with sakura trees
  const basin = mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.3, 24), mat('#f3e6ee'));
  basin.position.set(0, 0.15, 4.9);
  const water = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 24), mat('#9fd4f0', { rough: 0.2 }), false);
  water.position.set(0, 0.29, 4.9);
  const spout = mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.8, 10), mat('#e0f4ff', { opacity: 0.7 }), false);
  spout.position.set(0, 0.7, 4.9);
  g.add(basin, water, spout);
  for (const x of [-3, 3]) {
    const t = C.cityTree(x * 7, 0.85, true);
    t.position.set(x, 0, 3.8);
    g.add(t);
  }
  return g;
}
