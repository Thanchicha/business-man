import * as THREE from 'three';
import * as P from '../models/props';
import { canvasTexture, mat, mesh, signPlane } from '../models/mat';
import { createCharacter } from '../models/miyu';
import { STAFF_BY_ID } from '../../data/staff';

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color), shadow);
  m.position.set(x, y, z);
  return m;
}

function floor(w: number, d: number, a: string, b: string, tile = 1): THREE.Mesh {
  const tex = canvasTexture(64, 64, (c) => {
    c.fillStyle = a;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = b;
    c.fillRect(0, 0, 32, 32);
    c.fillRect(32, 32, 32, 32);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / (tile * 2), d / (tile * 2));
  tex.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- room

export { buildRoom, type RoomSet } from './room';

// ---------------------------------------------------------------- street

export { buildStreet } from './street';

// ---------------------------------------------------------------- supermarket

export interface MarketStation {
  id: string;
  label: string;
  items: string[];
  obj: THREE.Object3D;
  /** Where the player stands to use it. */
  front: THREE.Vector3;
}

export interface MarketSet {
  group: THREE.Group;
  stations: MarketStation[];
  /** Axis-aligned blockers on the floor: [minX, minZ, maxX, maxZ]. */
  walls: [number, number, number, number][];
  bounds: [number, number, number, number];
  start: THREE.Vector3;
  floor: THREE.Mesh;
}

export function buildMarket(): MarketSet {
  const g = new THREE.Group();
  const W = 16;
  const D = 12;
  const fl = floor(W, D, '#eef1f4', '#dfe5ec', 0.7);
  g.add(fl);
  g.add(box(W, 3, 0.3, '#f4f1ec', 0, 1.5, -D / 2), box(W, 0.5, 0.32, '#3fb0aa', 0, 0.9, -D / 2));
  g.add(box(0.3, 3, D, '#efebe5', -W / 2, 1.5, 0));
  g.add(box(0.3, 3, D, '#efebe5', W / 2, 1.5, 0));
  const sign = signPlane('SUPERMARKET', 4, 0.7, { bg: '#3fb0aa', fg: '#ffffff', border: '#ffffff' });
  sign.position.set(0, 2.5, -D / 2 + 0.17);
  g.add(sign);
  const walls: MarketSet['walls'] = [];
  const stations: MarketStation[] = [];
  const place = (obj: THREE.Object3D, x: number, z: number, w: number, d: number) => {
    obj.position.set(x, 0, z);
    g.add(obj);
    walls.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
  };
  const station = (id: string, label: string, items: string[], obj: THREE.Object3D, x: number, z: number, w = 2.2, d = 0.7) => {
    place(obj, x, z, w, d);
    stations.push({ id, label, items, obj, front: new THREE.Vector3(x, 0, z + d / 2 + 0.7) });
  };
  station('dairy', 'ตู้แช่นม/น้ำแข็ง', ['milk', 'creamer', 'ice'], P.fridge(['#ffffff', '#7fb2f0', '#f3e2b8', '#cfeaff']), -5, -5.3);
  place(P.fridge(['#ff9f7a', '#5cc9a7', '#ffc94d', '#e85a71']), -2.4, -5.3, 2.2, 0.7);
  station('tea', 'ชา & ผง', ['tea_black', 'tea_green', 'tea_thai', 'cocoa', 'taro'], P.shelf(['#b07a4a', '#7cbf6a', '#f08a3c', '#6b3f2a', '#a98bd6']), -4.5, -1.5);
  station('syrup', 'ไซรัป', ['syrup', 'brown_sugar', 'peach'], P.shelf(['#f6d58a', '#8b4a22', '#ffb38a', '#e0a63a']), -0.5, -1.5);
  station('topping', 'ท็อปปิ้ง', ['pearls'], P.shelf(['#3b2626', '#d8eef6', '#f2b866', '#ff9cc4']), -4.5, 2);
  station('supply', 'แก้ว/หลอด', ['cups'], P.shelf(['#dbeef7', '#ff7eb6', '#eef6fb', '#ffffff']), -0.5, 2);
  place(P.shelf(['#e85a71', '#ffc94d', '#7fc8f8', '#5cc9a7']), 3.5, -1.5, 2.2, 0.7);
  place(P.shelf(['#ff9f7a', '#c8b4f0', '#7fc8f8', '#ffd28a']), 3.5, 2, 2.2, 0.7);
  // checkout with a cashier
  const co = new THREE.Group();
  co.add(P.counterBlock(2.6, '#e3e8ee', '#ffffff'));
  const reg = P.register();
  reg.position.set(0.6, 1.08, 0);
  co.add(reg);
  co.rotation.y = -Math.PI / 2;
  place(co, 5.8, -4.2, 0.8, 2.6);
  stations.push({ id: 'checkout', label: 'แคชเชียร์', items: [], obj: co, front: new THREE.Vector3(4.7, 0, -4.2) });
  const cashier = createCharacter(STAFF_BY_ID.server.spec);
  cashier.root.position.set(6.8, 0, -4.2);
  cashier.root.rotation.y = -Math.PI / 2;
  g.add(cashier.root);
  g.userData.cashier = cashier;
  for (const [x, z] of [[7.2, 5.2], [-7.2, 5.2], [7.2, -0.5]]) {
    const pl = P.plant(1.4);
    place(pl, x, z, 0.6, 0.6);
  }
  const c = P.cart();
  c.position.set(1.6, 0, 4.6);
  c.rotation.y = 0.5;
  g.add(c);
  return { group: g, stations, walls, bounds: [-W / 2 + 0.5, -D / 2 + 0.5, W / 2 - 0.5, D / 2 - 0.3], start: new THREE.Vector3(5.5, 0, 3.5), floor: fl };
}


export { buildShop, type ShopSet } from './shop';
