import * as THREE from 'three';
import { mat, mesh, signPlane } from './mat';
import type { FurnId } from '../../data/furniture';

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

const WOOD = '#b98352';
const DARK = '#5e4330';

/** Plain square wooden table, 2 seats. */
export function tableWood(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.07, 0.9, WOOD, 0, 0.74, 0));
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) g.add(box(0.07, 0.72, 0.07, DARK, x, 0.36, z));
  return g;
}

/** Long group table, 4 seats, with a little flower. */
export function tableLong(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 0.07, 0.8, WOOD, 0, 0.74, 0));
  for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) g.add(box(0.08, 0.72, 0.08, DARK, x, 0.36, z));
  g.add(box(1.6, 0.05, 0.05, DARK, 0, 0.3, 0));
  const vase = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 10), mat('#ffffff'));
  vase.position.set(0, 0.86, 0);
  const flower = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#f48fb1'));
  flower.position.set(0, 0.98, 0);
  g.add(vase, flower);
  return g;
}

/** Wooden chair with a back, facing +Z. */
export function chairWood(cushion = '#f6c1d4'): THREE.Group {
  const g = new THREE.Group();
  const wood = '#9a6a45';
  g.add(box(0.46, 0.06, 0.46, wood, 0, 0.46, 0), box(0.44, 0.04, 0.44, cushion, 0, 0.5, 0), box(0.46, 0.5, 0.05, wood, 0, 0.74, -0.21));
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(box(0.05, 0.46, 0.05, wood, x, 0.23, z));
  return g;
}

/** Round backless stool. */
export function stoolRound(color = '#c9a8e6'): THREE.Group {
  const g = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 16), mat(color));
  seat.position.y = 0.46;
  g.add(seat);
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) g.add(box(0.04, 0.44, 0.04, DARK, x, 0.22, z));
  return g;
}

/** Soft two-seat sofa, facing +Z. */
export function sofa(color = '#f4b6c8'): THREE.Group {
  const g = new THREE.Group();
  const shade = '#e898b0';
  g.add(box(1.7, 0.22, 0.85, '#7a5236', 0, 0.2, 0));
  g.add(box(1.7, 0.2, 0.8, color, 0, 0.41, 0.02));
  g.add(box(1.7, 0.55, 0.22, color, 0, 0.7, -0.32));
  for (const x of [-0.86, 0.86]) g.add(box(0.16, 0.5, 0.85, shade, x, 0.5, 0));
  for (const x of [-0.4, 0.4]) {
    const c = mesh(new THREE.BoxGeometry(0.72, 0.14, 0.62), mat('#fbd1de'));
    c.position.set(x, 0.58, 0.08);
    g.add(c);
    const pillow = box(0.3, 0.3, 0.1, x < 0 ? '#c9a8e6' : '#fff1c8', x * 1.15, 0.78, -0.13);
    pillow.rotation.z = x < 0 ? 0.2 : -0.2;
    g.add(pillow);
  }
  for (const [x, z] of [[-0.78, -0.34], [0.78, -0.34], [-0.78, 0.34], [0.78, 0.34]]) g.add(box(0.06, 0.1, 0.06, '#5e4330', x, 0.05, z));
  return g;
}

export function furnitureModel(id: FurnId, variant = 0): THREE.Group {
  switch (id) {
    case 'table_wood':
      return tableWood();
    case 'table_long':
      return tableLong();
    case 'chair_wood':
      return chairWood(variant % 2 ? '#efe2cf' : '#f6c1d4');
    case 'stool':
      return stoolRound(['#c9a8e6', '#a8d5c2', '#f7c873'][variant % 3]);
    case 'sofa':
      return sofa(['#f4b6c8', '#bcd9f2', '#d9c8f0'][variant % 3]);
  }
}

/** Brown cardboard box with tape. */
export function cardboardBox(w = 0.7, h = 0.5, d = 0.55): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, '#d2a56b', 0, h / 2, 0));
  g.add(box(0.1, 0.01, d + 0.01, '#f2e3c0', 0, h + 0.001, 0));
  g.add(box(0.1, h + 0.01, 0.01, '#f2e3c0', 0, h / 2, d / 2 + 0.002));
  return g;
}

/**
 * Small box truck facing +X: a cab, an open-backed cargo bay full of boxes and
 * wheels in `userData.wheels` so the scene can spin them.
 */
export function deliveryTruck(color = '#ffffff', stripe = '#f27aa8'): THREE.Group {
  const g = new THREE.Group();
  const L = 3.0;
  const H = 1.9;
  const W = 1.8;
  const cargo = new THREE.Group();
  cargo.add(box(L, 0.12, W, '#8e9095', 0, 0.62, 0));
  cargo.add(box(L, H - 0.7, 0.08, color, 0, 0.62 + (H - 0.7) / 2, W / 2 - 0.04));
  cargo.add(box(L, H - 0.7, 0.08, color, 0, 0.62 + (H - 0.7) / 2, -W / 2 + 0.04));
  cargo.add(box(0.08, H - 0.7, W, color, L / 2 - 0.04, 0.62 + (H - 0.7) / 2, 0));
  cargo.add(box(L, 0.1, W, color, 0, H - 0.05, 0));
  for (const z of [W / 2 + 0.002, -W / 2 - 0.002]) cargo.add(box(L, 0.18, 0.02, stripe, 0, 1.0, z));
  cargo.position.x = -0.6;
  g.add(cargo);
  const cab = new THREE.Group();
  cab.add(box(1.2, 0.8, W, stripe, 0, 0.62 + 0.4, 0));
  cab.add(box(0.8, 0.5, W - 0.04, '#bfe3f5', 0.1, 1.76, 0));
  cab.add(box(0.7, 0.04, W + 0.04, '#ffffff', 0.1, 2.02, 0));
  cab.position.x = 1.5;
  cab.scale.set(1, 0.95, 1);
  g.add(cab);
  const windshield = mesh(new THREE.BoxGeometry(0.04, 0.5, W - 0.2), mat('#dff3fb', { rough: 0.1 }), false);
  windshield.position.set(2.1, 1.5, 0);
  g.add(windshield);
  for (const z of [1, -1]) {
    const label = signPlane('FURNI EXPRESS', 2.0, 0.42, { bg: '#ffffff', fg: '#e0558f', border: stripe });
    label.position.set(-0.6, 1.45, z * (W / 2 + 0.012));
    label.rotation.y = z > 0 ? 0 : Math.PI;
    g.add(label);
  }
  for (const z of [1, -1]) {
    const hl = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.26), mat('#fff6d8', { emissive: '#fff0c0' }), false);
    hl.position.set(2.1, 0.9, z * 0.65);
    g.add(hl);
  }
  g.add(box(0.2, 0.14, W + 0.1, '#5a5d66', 2.1, 0.45, 0));
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [[1.5, 0.82], [1.5, -0.82], [-1.1, 0.82], [-1.1, -0.82]]) {
    const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), mat('#2a2d33'));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.34, z);
    const hub = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), mat('#d7dade'), false);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    hub.rotation.set(0, 0, 0);
    g.add(w);
    wheels.push(w);
  }
  // boxes stacked in the open back (x = -2.1 side)
  const load = new THREE.Group();
  const spots: [number, number, number][] = [[-1.7, 0.68, 0.45], [-1.7, 0.68, -0.4], [-1.0, 0.68, 0.42], [-1.0, 0.68, -0.42], [-1.65, 1.18, 0.4], [-1.05, 1.18, -0.38], [-0.4, 0.68, 0.4], [-0.4, 0.68, -0.4]];
  for (const [x, y, z] of spots) {
    const b = cardboardBox(0.6 + (Math.abs(x) % 0.3) * 0.3, 0.5, 0.6);
    b.position.set(x, y, z);
    b.rotation.y = (x + z) * 0.1;
    load.add(b);
  }
  g.add(load);
  g.userData.wheels = wheels;
  g.userData.load = load;
  /** Back of the truck, in the truck's own space. */
  g.userData.rear = new THREE.Vector3(-2.3, 0, 0);
  return g;
}
