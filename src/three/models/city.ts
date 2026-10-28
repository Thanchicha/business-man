import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, mat, mesh, signPlane, texMat } from './mat';
import { bubbleTea } from './props';

/**
 * City pieces in the style of the mockups: real-world colours (brick, beige,
 * blue glass, grey asphalt, green trees) instead of candy pastels.
 */

export const WALLS = {
  cream: '#efe4cf',
  beige: '#dcc6a3',
  sand: '#e6d3b3',
  brick: '#b4624a',
  redBrick: '#9c4c3b',
  white: '#f3f0ea',
  grey: '#c9ccd0',
  slate: '#9aa6b2',
  peach: '#e9b998',
  blue: '#a8bfd2',
};
export const ROOFS = ['#a5483a', '#5f6b7d', '#7c5238', '#3f6b6f', '#8a3f35'];
const ROOF_FLAT = '#8e9095';

export type FacadeStyle = 'glass' | 'office' | 'apartment' | 'brick' | 'house';

const CELL = 32;
const facadeCache = new Map<string, THREE.MeshStandardMaterial>();

/** Deterministic pseudo-random from a string, so textures don't change between builds. */
function seeded(key: string): () => number {
  let s = 0;
  for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/**
 * A building face drawn on a canvas: cols × rows of windows over a wall colour.
 * At night lit windows go into the emissive map so they glow.
 */
export function facadeMat(style: FacadeStyle, wall: string, cols: number, rows: number, o: { shop?: string; night?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${style}|${wall}|${cols}|${rows}|${o.shop ?? ''}|${o.night ? 1 : 0}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const W = cols * CELL;
  const H = rows * CELL;
  const rnd = seeded(key);
  const lit: [number, number, number, number][] = [];
  const glassGrad = (c: CanvasRenderingContext2D, y: number, h: number) => {
    const g = c.createLinearGradient(0, y, 0, y + h);
    if (o.night) {
      g.addColorStop(0, '#2a3a5c');
      g.addColorStop(1, '#1c2742');
    } else {
      g.addColorStop(0, '#cfe6f6');
      g.addColorStop(1, '#6f9cc6');
    }
    return g;
  };
  const map = canvasTexture(W, H, (c) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, W, H);
    if (style === 'brick') {
      c.fillStyle = shade(wall, 0.82);
      for (let y = 0; y < H; y += 4) {
        c.fillRect(0, y, W, 1);
        for (let x = (y / 4) % 2 ? 0 : 4; x < W; x += 8) c.fillRect(x, y, 1, 4);
      }
    }
    if (style === 'glass') {
      c.fillStyle = glassGrad(c, 0, H);
      c.fillRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) {
        c.fillStyle = shade(wall, 0.9);
        c.fillRect(0, r * CELL, W, 6);
        for (let col = 0; col < cols; col++) if (o.night && rnd() < 0.45) lit.push([col * CELL + 1, r * CELL + 6, CELL - 2, CELL - 6]);
      }
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let col = 0; col <= cols; col++) c.fillRect(col * CELL - 1, 0, 2, H);
      if (!o.night) {
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath();
        c.moveTo(W * 0.15, 0);
        c.lineTo(W * 0.45, 0);
        c.lineTo(W * 0.05, H);
        c.lineTo(0, H);
        c.lineTo(0, H * 0.6);
        c.fill();
      }
    } else {
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = col * CELL;
          const y = r * CELL;
          const shopRow = o.shop && r === rows - 1;
          if (shopRow) continue;
          let wx = x + 8;
          let wy = y + 7;
          let ww = CELL - 16;
          let wh = CELL - 14;
          if (style === 'office') {
            wx = x + 3;
            ww = CELL - 6;
            wy = y + 8;
            wh = CELL - 14;
          } else if (style === 'house') {
            wx = x + 9;
            ww = CELL - 18;
            wy = y + 9;
            wh = CELL - 16;
          }
          if (style !== 'office') {
            c.fillStyle = style === 'brick' ? '#efe6da' : '#ffffff';
            c.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          }
          c.fillStyle = glassGrad(c, wy, wh);
          c.fillRect(wx, wy, ww, wh);
          if (style !== 'office') {
            c.fillStyle = 'rgba(255,255,255,0.85)';
            c.fillRect(wx + ww / 2 - 0.5, wy, 1, wh);
          }
          if (style === 'apartment' && r % 2 === 0) {
            c.fillStyle = shade(wall, 0.75);
            c.fillRect(x + 4, y + CELL - 6, CELL - 8, 3);
          }
          if (o.night && rnd() < 0.5) lit.push([wx, wy, ww, wh]);
        }
      }
    }
    if (o.shop) {
      const y = (rows - 1) * CELL;
      c.fillStyle = shade(wall, 0.85);
      c.fillRect(0, y, W, CELL);
      const g = c.createLinearGradient(0, y + 8, 0, y + CELL);
      g.addColorStop(0, '#fff2d6');
      g.addColorStop(1, '#e7b680');
      c.fillStyle = g;
      c.fillRect(4, y + 9, W - 8, CELL - 9);
      c.fillStyle = 'rgba(80,50,30,0.35)';
      for (let x = 4; x < W - 4; x += CELL) c.fillRect(x, y + 9, 2, CELL - 9);
      c.fillStyle = o.shop;
      c.fillRect(0, y, W, 8);
      lit.push([4, y + 9, W - 8, CELL - 9]);
    }
  });
  let emissiveMap: THREE.Texture | null = null;
  if (o.night && lit.length) {
    emissiveMap = canvasTexture(W, H, (c) => {
      c.fillStyle = '#000000';
      c.fillRect(0, 0, W, H);
      for (const [x, y, w, h] of lit) {
        c.fillStyle = rnd() < 0.3 ? '#ffe9b8' : '#ffc874';
        c.fillRect(x, y, w, h);
      }
    });
  }
  const m = new THREE.MeshStandardMaterial({ map, roughness: style === 'glass' ? 0.35 : 0.85, emissive: emissiveMap ? '#ffffff' : '#000000', emissiveMap, emissiveIntensity: emissiveMap ? 1.1 : 0 });
  facadeCache.set(key, m);
  return m;
}

export interface BuildingOpts {
  w: number;
  d: number;
  h: number;
  style: FacadeStyle;
  wall: string;
  roof?: string;
  /** Colour of the shop band on the ground floor, if it has a shopfront. */
  shop?: string;
  /** Striped awning over the shopfront. */
  awning?: string;
  night?: boolean;
  seed?: number;
}

/** A box building with window facades on all four sides and a few things on the roof. */
export function building(o: BuildingOpts): THREE.Group {
  const g = new THREE.Group();
  const floorH = o.style === 'glass' ? 0.9 : o.style === 'house' ? 1.1 : 0.85;
  const rows = Math.max(1, Math.round(o.h / floorH));
  const colsW = Math.max(1, Math.round(o.w / 0.75));
  const colsD = Math.max(1, Math.round(o.d / 0.75));
  const sideW = facadeMat(o.style, o.wall, colsW, rows, { shop: o.shop, night: o.night });
  const sideD = facadeMat(o.style, o.wall, colsD, rows, { night: o.night });
  const top = mat(o.roof ?? ROOF_FLAT);
  const body = mesh(new THREE.BoxGeometry(o.w, o.h, o.d), [sideD, sideD, top, top, sideW, sideW] as unknown as THREE.Material);
  body.position.y = o.h / 2;
  g.add(body);
  const r = seeded(`b${o.seed ?? 0}${o.w}${o.h}`);
  if (o.style !== 'house') {
    // parapet and rooftop machinery
    const cap = mesh(new THREE.BoxGeometry(o.w + 0.08, 0.14, o.d + 0.08), mat(shade(o.style === 'glass' ? '#c9d3dc' : o.wall, 0.86)));
    cap.position.y = o.h + 0.03;
    g.add(cap);
    const n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const bw = 0.4 + r() * 0.5;
      const u = mesh(new THREE.BoxGeometry(bw, 0.3 + r() * 0.3, bw * 0.8), mat(i ? '#b8bcc2' : '#d8dadd'));
      u.position.set((r() - 0.5) * (o.w - bw - 0.2), o.h + 0.25, (r() - 0.5) * (o.d - bw - 0.2));
      g.add(u);
    }
    if (o.style === 'glass' && o.h > 7) {
      const crown = mesh(new THREE.BoxGeometry(o.w * 0.6, 0.8, o.d * 0.6), facadeMat('glass', '#8fb0c8', 2, 1, { night: o.night }));
      crown.position.y = o.h + 0.4;
      g.add(crown);
    }
  } else {
    const roof = mesh(new THREE.ConeGeometry(Math.max(o.w, o.d) * 0.8, o.h * 0.55, 4), mat(o.roof ?? ROOFS[0]));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(o.w / Math.max(o.w, o.d), 1, o.d / Math.max(o.w, o.d));
    roof.position.y = o.h + o.h * 0.27;
    g.add(roof);
    const door = mesh(new THREE.BoxGeometry(0.4, 0.75, 0.06), mat('#7a5238'));
    door.position.set(o.w * 0.22, 0.375, o.d / 2 + 0.02);
    g.add(door);
  }
  if (o.awning) {
    const aw = awning(o.awning, o.w * 0.92);
    aw.position.set(0, Math.min(o.h, 0.85) - 0.02, o.d / 2);
    g.add(aw);
  }
  return g;
}

/** Sloped striped awning, front edge along +Z. */
export function awning(color: string, w: number, depth = 0.5): THREE.Group {
  const g = new THREE.Group();
  const m = texMat(`stripes|${color}`, 64, 8, (c) => {
    for (let x = 0; x < 64; x += 8) {
      c.fillStyle = (x / 8) % 2 ? '#ffffff' : color;
      c.fillRect(x, 0, 8, 8);
    }
  });
  const map = m.map!;
  map.wrapS = THREE.RepeatWrapping;
  const slope = mesh(new THREE.BoxGeometry(w, 0.04, depth), m);
  slope.rotation.x = 0.45;
  slope.position.set(0, -depth * 0.2, depth / 2);
  const valance = mesh(new THREE.BoxGeometry(w, 0.14, 0.03), m);
  valance.position.set(0, -depth * 0.43 - 0.06, depth * 0.95);
  g.add(slope, valance);
  return g;
}

// ---------------------------------------------------------------- nature

const LEAF = ['#5f9e4a', '#6fae55', '#4f8e40', '#7dba5f', '#568f45'];
const BLOSSOM = ['#f4b6c7', '#f7c5d2', '#efa6bb'];
const leafGeo = new THREE.IcosahedronGeometry(1, 1);
leafGeo.userData.shared = true;

/** Puffy street tree; `blossom` gives the pink sakura look from the mockups. */
export function cityTree(seed: number, s = 1, blossom = false): THREE.Group {
  const r = seeded(`t${seed}`);
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 0.9 * s, 8), mat('#7a5a44'));
  trunk.position.y = 0.45 * s;
  g.add(trunk);
  const colors = blossom ? BLOSSOM : LEAF;
  const base = colors[Math.floor(r() * colors.length)];
  const puffs: [number, number, number, number][] = [
    [0, 1.25, 0, 0.55],
    [0.32, 1.05, 0.12, 0.4],
    [-0.3, 1.08, -0.1, 0.42],
    [0.05, 1.05, -0.32, 0.38],
    [-0.08, 1.55, 0.05, 0.36],
  ];
  puffs.forEach(([x, y, z, rad], i) => {
    const p = mesh(leafGeo, mat(i === 4 ? shade(base, 1.12) : i % 2 ? shade(base, 0.92) : base, { flat: false }));
    p.scale.setScalar(rad * s * (0.9 + r() * 0.2));
    p.position.set(x * s, y * s, z * s);
    g.add(p);
  });
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

export function hedge(w: number, d = 0.4, color = '#5c9a48'): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, 0.4, d), mat(color));
  m.position.y = 0.2;
  return m;
}

export function flowerBed(w: number, d: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const r = seeded(`f${seed}`);
  const soil = mesh(new THREE.BoxGeometry(w, 0.16, d), mat('#8a6a4e'));
  soil.position.y = 0.08;
  g.add(soil);
  const cols = ['#f48fb1', '#ffd36e', '#ffffff', '#f06b7d', '#c69be8'];
  for (let i = 0; i < Math.round(w * d * 14); i++) {
    const f = mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(r() < 0.35 ? '#5f9e4a' : cols[Math.floor(r() * cols.length)]), false);
    f.position.set((r() - 0.5) * (w - 0.1), 0.19, (r() - 0.5) * (d - 0.1));
    g.add(f);
  }
  return g;
}

// ---------------------------------------------------------------- street furniture

export function streetLamp(night = false): THREE.Group {
  const g = new THREE.Group();
  const c = '#3e4450';
  const pole = mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.2, 8), mat(c));
  pole.position.y = 1.1;
  const arm = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mat(c));
  arm.position.set(0.22, 2.15, 0);
  const head = mesh(new THREE.BoxGeometry(0.3, 0.08, 0.16), mat(c));
  head.position.set(0.42, 2.1, 0);
  const bulb = mesh(new THREE.BoxGeometry(0.24, 0.03, 0.12), mat('#fff6dc', { emissive: night ? '#ffd88a' : '#fff2cc' }), false);
  bulb.position.set(0.42, 2.05, 0);
  g.add(pole, arm, head, bulb);
  return g;
}

export function bench(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#a8774f');
  const iron = mat('#3e4450');
  for (const [y, z, rx] of [[0.42, 0, 0], [0.42, -0.12, 0], [0.72, -0.2, -0.25]] as [number, number, number][]) {
    const s = mesh(new THREE.BoxGeometry(1.2, 0.05, 0.12), wood);
    s.position.set(0, y, z);
    s.rotation.x = rx;
    g.add(s);
  }
  for (const x of [-0.5, 0.5]) {
    const leg = mesh(new THREE.BoxGeometry(0.05, 0.42, 0.3), iron);
    leg.position.set(x, 0.21, -0.06);
    g.add(leg);
  }
  return g;
}

export function car(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(1.1, 0.28, 0.52), mat(color, { rough: 0.4 }));
  body.position.y = 0.26;
  const cabin = mesh(new THREE.BoxGeometry(0.62, 0.24, 0.48), mat(color, { rough: 0.4 }));
  cabin.position.set(-0.06, 0.5, 0);
  const glass = mesh(new THREE.BoxGeometry(0.64, 0.16, 0.5), mat('#2f3d52', { rough: 0.2 }), false);
  glass.position.set(-0.06, 0.5, 0);
  g.add(body, cabin, glass);
  for (const [x, z] of [[-0.34, 0.24], [0.34, 0.24], [-0.34, -0.24], [0.34, -0.24]]) {
    const w = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat('#2a2d33'));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.12, z);
    g.add(w);
  }
  for (const z of [-0.17, 0.17]) {
    const hl = mesh(new THREE.BoxGeometry(0.02, 0.06, 0.1), mat('#fff6d8', { emissive: '#fff0c0' }), false);
    hl.position.set(0.56, 0.3, z);
    g.add(hl);
  }
  return g;
}

export const CAR_COLORS = ['#e8eef3', '#d94a4a', '#3a6fb0', '#f2c14e', '#2f3640', '#f3f3f3', '#5fa36a', '#9aa3ad'];

export function boat(): THREE.Group {
  const g = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(1.8, 0.35, 0.7), mat('#ffffff'));
  hull.position.y = 0.1;
  const stripe = mesh(new THREE.BoxGeometry(1.82, 0.08, 0.72), mat('#2f6fae'));
  stripe.position.y = 0.0;
  const cabin = mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5), mat('#f3f0ea'));
  cabin.position.set(-0.2, 0.42, 0);
  const win = mesh(new THREE.BoxGeometry(0.72, 0.1, 0.52), mat('#3a5a7a'), false);
  win.position.set(-0.2, 0.47, 0);
  g.add(hull, stripe, cabin, win);
  return g;
}

/** Big ferris wheel by the water; the rotating part is named "wheel". */
export function ferrisWheel(R = 3.6, night = false): THREE.Group {
  const g = new THREE.Group();
  const steel = mat('#f3f3f6');
  for (const z of [-0.45, 0.45]) {
    for (const s of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.08, 0.1, R + 1.2, 8), steel);
      leg.position.set(s * (R * 0.32), (R + 1.0) / 2, z);
      leg.rotation.z = s * 0.33;
      g.add(leg);
    }
  }
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.y = R + 1;
  for (const z of [-0.3, 0.3]) {
    const ring = mesh(new THREE.TorusGeometry(R, 0.06, 6, 48), mat('#ffffff', { emissive: night ? '#ffb6d8' : undefined }));
    ring.position.z = z;
    wheel.add(ring);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12), steel);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const cabinCols = ['#f48fb1', '#7fb8e6', '#ffd36e', '#8fd0a8', '#c69be8', '#ff9f7a'];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spoke = mesh(new THREE.BoxGeometry(R, 0.04, 0.04), steel, false);
    spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const cab = mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), mat(cabinCols[i % cabinCols.length]));
    cab.position.set(Math.cos(a) * R, Math.sin(a) * R - 0.25, 0);
    cab.userData.cabin = true;
    wheel.add(cab);
  }
  g.add(wheel);
  return g;
}

/** Storefront for a bubble tea shop (ours or a rival): 2 storeys, awning, cup sign. Faces +Z. */
export function teaStore(color: string, o: { name?: string; w?: number; night?: boolean; wall?: string } = {}): THREE.Group {
  const w = o.w ?? 2.6;
  const g = building({ w, d: 2.2, h: 2.2, style: 'apartment', wall: o.wall ?? '#f7f1ea', shop: color, awning: color, night: o.night, seed: w });
  const cup = bubbleTea('#d9a877', true);
  cup.scale.setScalar(1.8);
  cup.position.set(w / 2 - 0.35, 2.2, 0.9);
  g.add(cup);
  if (o.name) {
    const s = signPlane(o.name, Math.min(w - 0.3, 2), 0.32, { bg: '#ffffff', fg: '#4a3448', border: color });
    s.position.set(0, 1.12, 1.12);
    g.add(s);
  }
  return g;
}

// ---------------------------------------------------------------- performance

/**
 * Bakes every static mesh under `root` into one mesh per material, which cuts
 * thousands of draw calls down to a few dozen. Objects in `keep` (and their
 * children) stay as they are because they move or are clicked.
 */
export function mergeStatic(root: THREE.Group, keep: THREE.Object3D[]): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const kept = new Set<THREE.Object3D>();
  for (const k of keep) k.traverse((o) => kept.add(o));
  const buckets = new Map<string, { material: THREE.Material; shadow: boolean; geos: THREE.BufferGeometry[] }>();
  const doomed: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || kept.has(m)) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
    const groups = Array.isArray(m.material) && m.geometry.groups.length ? m.geometry.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
    // non-indexed copies keep the same vertex order, so groups map 1:1 when the source was indexed
    for (const gr of groups) {
      const material = mats[gr.materialIndex ?? 0];
      const part = groups.length > 1 ? sliceGeo(geo, gr.start, gr.count) : geo;
      const key = `${material.uuid}|${m.castShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material, shadow: m.castShadow, geos: [] }));
      b.geos.push(part);
    }
    doomed.push(m);
  });
  for (const m of doomed) {
    m.removeFromParent();
    if (!m.geometry.userData.shared) m.geometry.dispose();
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const out = new THREE.Mesh(merged, b.material);
    out.castShadow = b.shadow;
    out.receiveShadow = true;
    out.matrixAutoUpdate = false;
    root.add(out);
  }
}

function sliceGeo(geo: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) {
    const attr = a as THREE.BufferAttribute;
    out.setAttribute(k, new THREE.BufferAttribute((attr.array as Float32Array).slice(start * attr.itemSize, (start + count) * attr.itemSize), attr.itemSize));
  }
  return out;
}

/** Little white sailboat with a triangular sail. */
export function sailboat(): THREE.Group {
  const g = boat();
  g.scale.setScalar(0.8);
  const mast = mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), mat('#e8e2d8'));
  mast.position.set(0.2, 1.2, 0);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 1.9);
  shape.lineTo(1.1, 0);
  shape.closePath();
  const sail = mesh(new THREE.ShapeGeometry(shape), mat('#fffaf4', { side: THREE.DoubleSide }));
  sail.position.set(0.25, 0.25, 0);
  g.add(mast, sail);
  return g;
}
