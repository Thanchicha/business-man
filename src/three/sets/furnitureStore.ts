import * as THREE from 'three';
import * as P from '../models/props';
import * as F from '../models/furniture';
import { canvasTexture, mat, mesh, signPlane } from '../models/mat';
import { createCharacter, type Character } from '../models/miyu';
import { STAFF_BY_ID } from '../../data/staff';
import type { FurnId } from '../../data/furniture';

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

export interface FurnitureStation {
  id: string;
  label: string;
  /** What this display sells; the cashier has none. */
  item?: FurnId;
  obj: THREE.Object3D;
  /** Where the player stands to use it. */
  front: THREE.Vector3;
}

export interface FurnitureStoreSet {
  group: THREE.Group;
  stations: FurnitureStation[];
  /** Axis-aligned blockers: [minX, minZ, maxX, maxZ]. */
  walls: [number, number, number, number][];
  bounds: [number, number, number, number];
  /** Where the player walks in from (outside) and where they stop. */
  outside: THREE.Vector3;
  start: THREE.Vector3;
  cashier: Character;
}

/** A showroom: wood-slat back wall, display platforms along it and a till on the right. Open to the street at +Z. */
export function buildFurnitureStore(): FurnitureStoreSet {
  const g = new THREE.Group();
  const W = 16;
  const D = 12;
  const floorTex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#e9d3b4';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i % 2 ? '#e2c9a6' : '#edd9bd';
      c.fillRect(0, i * 32, 128, 31);
      c.fillStyle = '#c9ab85';
      c.fillRect(0, i * 32 + 31, 128, 1);
      c.fillRect(((i * 53) % 100) + 14, i * 32, 1, 31);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(W / 4, D / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  g.add(box(W, 3.4, 0.3, '#f6efe4', 0, 1.7, -D / 2), box(W, 0.9, 0.34, '#c89466', 0, 0.45, -D / 2));
  g.add(box(0.3, 3.4, D, '#f1e7d8', -W / 2, 1.7, 0), box(0.3, 3.4, D, '#f1e7d8', W / 2, 1.7, 0));
  for (let x = -W / 2 + 0.5; x < W / 2; x += 0.7) g.add(box(0.06, 0.9, 0.04, '#a8764a', x, 0.45, -D / 2 + 0.18));
  const sign = signPlane('FURNITURE', 4.4, 0.8, { bg: '#c89466', fg: '#ffffff', border: '#ffffff', font: 'Fredoka, Mitr, sans-serif' });
  sign.position.set(0, 2.6, -D / 2 + 0.17);
  g.add(sign);
  // sale banner and wall frames
  const frames: [number, string][] = [[-6, '#f6c1d4'], [-3.6, '#a9cfee'], [3.6, '#f7c873'], [6, '#c9e8d0']];
  for (const [x, c] of frames) g.add(box(0.9, 0.7, 0.05, '#7a5236', x, 2.0, -D / 2 + 0.18), box(0.76, 0.56, 0.06, c, x, 2.0, -D / 2 + 0.19));

  const walls: FurnitureStoreSet['walls'] = [];
  const stations: FurnitureStation[] = [];
  const platform = (w: number, d: number, color: string) => {
    const p = new THREE.Group();
    p.add(box(w, 0.14, d, '#d7b48a', 0, 0.07, 0), box(w - 0.2, 0.04, d - 0.2, color, 0, 0.16, 0));
    return p;
  };
  const station = (id: string, label: string, item: FurnId, x: number, z: number, w: number, d: number, color: string, fill: (p: THREE.Group) => void) => {
    const p = platform(w, d, color);
    fill(p);
    // price tag standing on the front edge
    p.position.set(x, 0, z);
    g.add(p);
    walls.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    stations.push({ id, label, item, obj: p, front: new THREE.Vector3(x, 0, z + d / 2 + 0.7) });
  };
  const put = (p: THREE.Group, m: THREE.Object3D, x: number, z: number, rot = 0) => {
    m.position.set(x, 0.18, z);
    m.rotation.y = rot;
    p.add(m);
  };
  station('table_wood', 'โต๊ะไม้ธรรมดา', 'table_wood', -5.5, -4.5, 3.0, 2.0, '#f3dfc6', (p) => {
    put(p, F.tableWood(), -0.7, 0);
    put(p, F.tableWood(), 0.7, 0.1, 0.4);
  });
  station('table_long', 'โต๊ะยาว 4 ที่นั่ง', 'table_long', -1.4, -4.5, 3.0, 2.0, '#f6e6d2', (p) => {
    put(p, F.tableLong(), 0, 0);
    put(p, F.chairWood('#efe2cf'), -0.45, -0.75);
    put(p, F.chairWood('#efe2cf'), 0.45, 0.75, Math.PI);
  });
  station('sofa', 'โซฟานั่งสบาย', 'sofa', 3.2, -4.5, 3.8, 2.0, '#fbe3ec', (p) => {
    put(p, F.sofa('#f4b6c8'), -0.95, -0.1);
    put(p, F.sofa('#bcd9f2'), 1.05, -0.1);
  });
  station('chair_wood', 'เก้าอี้ไม้', 'chair_wood', -5.5, -0.6, 3.0, 1.8, '#f3dfc6', (p) => {
    for (let i = 0; i < 3; i++) put(p, F.chairWood(i % 2 ? '#efe2cf' : '#f6c1d4'), -0.9 + i * 0.9, 0.1);
  });
  station('stool', 'สตูลกลม', 'stool', -1.4, -0.6, 3.0, 1.8, '#f6e6d2', (p) => {
    for (let i = 0; i < 4; i++) put(p, F.stoolRound(['#c9a8e6', '#a8d5c2', '#f7c873', '#f4b6c8'][i]), -1.05 + i * 0.7, 0.1);
  });
  // cashier counter on the right with the shopkeeper behind it
  const co = new THREE.Group();
  co.add(P.counterBlock(2.8, '#c89466', '#f7efe4'));
  const reg = P.register();
  reg.position.set(0.6, 1.08, 0);
  co.add(reg);
  co.rotation.y = -Math.PI / 2;
  co.position.set(6.0, 0, 0.6);
  g.add(co);
  walls.push([5.6, -0.9, 6.4, 2.1]);
  stations.push({ id: 'checkout', label: 'จ่ายเงิน', obj: co, front: new THREE.Vector3(4.8, 0, 0.6) });
  const cashier = createCharacter(STAFF_BY_ID.server.spec);
  cashier.root.position.set(7.0, 0, 0.6);
  cashier.root.rotation.y = -Math.PI / 2;
  g.add(cashier.root);
  // decoration
  for (const [x, z, s] of [[-7.2, 4.8, 1.5], [7.2, 4.8, 1.5], [7.2, -4.8, 1.3], [-7.2, -4.8, 1.3]]) {
    const pl = P.plant(s);
    pl.position.set(x, 0, z);
    g.add(pl);
    walls.push([x - 0.35, z - 0.35, x + 0.35, z + 0.35]);
  }
  const stack = new THREE.Group();
  for (const [x, y, z] of [[0, 0, 0], [0.8, 0, 0.1], [0.3, 0.5, 0.05]] as [number, number, number][]) {
    const b = F.cardboardBox(0.7, 0.5, 0.55);
    b.position.set(x, y, z);
    stack.add(b);
  }
  stack.position.set(6.8, 0, -3.2);
  g.add(stack);
  walls.push([6.2, -3.6, 7.8, -2.7]);
  const rug = mesh(new THREE.BoxGeometry(5, 0.02, 3), mat('#f6c1d4'), false);
  rug.position.set(1.4, 0.011, 3.0);
  g.add(rug);
  return {
    group: g,
    stations,
    walls,
    bounds: [-W / 2 + 0.6, -D / 2 + 0.6, W / 2 - 0.6, D / 2 + 3],
    outside: new THREE.Vector3(1.4, 0, 8.5),
    start: new THREE.Vector3(1.4, 0, 3.6),
    cashier,
  };
}
