import * as THREE from 'three';
import { rand, vec } from '../lib/geometry';
import { capPoint, lock } from './shared';

/**
 * Miyu's short fluffy bob (reference/sheet.webp, shortened so no strand reaches the collar):
 * three layers of soft clumps leave the cap around the sides and back and end above the collar
 * (≈0.58), the tips alternately curling in and flicking out for a layered, airy silhouette.
 * A few short locks fall forward in front of the ears. Angles a are measured from +Z (front)
 * toward +X (her left).
 */

const CENTER_Z = -0.025;
/** Nothing may hang below this (the sailor collar / neck frill start just under it). */
export const BOB_MIN_Y = 0.578;

/** Half extents of the bob around the head at height y (lateral, depth): widest at the cheeks. */
function bell(y: number): [number, number] {
  const keys: [number, number, number][] = [
    [0.57, 0.19, 0.166], [0.62, 0.198, 0.17], [0.67, 0.192, 0.168], [0.72, 0.18, 0.162], [0.77, 0.164, 0.154],
  ];
  if (y <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (y <= keys[i][0]) {
      const [y0, a0, b0] = keys[i - 1], [y1, a1, b1] = keys[i];
      const t = (y - y0) / (y1 - y0);
      return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t];
    }
  }
  const k = keys[keys.length - 1];
  return [k[1], k[2]];
}

interface Layer {
  count: number;
  /** Inset from the bell (inner layers sit closer to the head). */
  inset: number;
  width: number;
  /** Tip height at the back and at the sides. */
  tipBack: number;
  tipSide: number;
  shift: number;
  seed: number;
}

const LAYERS: Layer[] = [
  { count: 15, inset: 0.02, width: 0.11, tipBack: 0.596, tipSide: 0.604, shift: 0.66, seed: 5 },
  { count: 17, inset: 0.009, width: 0.104, tipBack: 0.606, tipSide: 0.616, shift: 0.33, seed: 3 },
  { count: 19, inset: 0, width: 0.096, tipBack: 0.618, tipSide: 0.63, shift: 0, seed: 1 },
];
const SPAN: [number, number] = [1.0, Math.PI * 2 - 1.0];

function bobLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const L of LAYERS) {
    for (let i = 0; i < L.count; i++) {
      const r = (k: number) => rand(L.seed * 131 + i * 17 + k) - 0.5;
      const a = SPAN[0] + (SPAN[1] - SPAN[0]) * ((i + 0.5 + L.shift) / L.count) + r(1) * 0.06;
      const back = Math.max(0, -Math.cos(a));
      const tipY = Math.max(BOB_MIN_Y, THREE.MathUtils.lerp(L.tipSide, L.tipBack, back) + r(2) * 0.02);
      const pts = [capPoint(a, 1.12, -0.014)];
      for (const y of [0.76, 0.715, 0.67]) {
        const [rx, rz] = bell(y);
        pts.push(vec(Math.sin(a) * (rx - L.inset), y, CENTER_Z + Math.cos(a) * (rz - L.inset)));
      }
      // Alternate tips curl in (classic bob) or flick out (fluffy layers).
      const curl = i % 3 === 0 ? -0.012 : 0.008 + 0.01 * (r(3) + 0.5);
      const midY = (0.67 + tipY) / 2;
      const [mx, mz] = bell(midY);
      pts.push(vec(Math.sin(a) * (mx - L.inset + curl * 0.3), midY, CENTER_Z + Math.cos(a) * (mz - L.inset + curl * 0.3)));
      const [rx, rz] = bell(tipY);
      pts.push(vec(Math.sin(a) * (rx - L.inset + curl), tipY, CENTER_Z + Math.cos(a) * (rz - L.inset + curl)));
      out.push(lock(pts, {
        width: L.width * (0.9 + 0.25 * (r(4) + 0.5)),
        thickness: 0.03,
        belly: 0.5,
        tipStart: 0.7,
        tipRound: 0.45,
        segments: 40,
        twist: r(5) * 0.4,
        normalRef: (p) => vec(p.x, 0, p.z - CENTER_Z).normalize(),
      }));
    }
  }
  return out;
}

/** Short locks falling in front of the ears, ending above the collar. */
function frontLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const a = s * (0.84 + k * 0.15);
      const tipY = Math.max(BOB_MIN_Y, 0.588 + 0.012 * k + (rand(k + (s > 0 ? 30 : 40)) - 0.5) * 0.012);
      const pts = [capPoint(a, 1.22, -0.012)];
      for (const [y, x, z] of [[0.72, 0.17, 0.05], [0.66, 0.182, 0.046], [0.615, 0.184, 0.042 - 0.01 * k], [tipY, 0.178 + 0.006 * k, 0.04 - 0.014 * k]] as const) {
        pts.push(vec(s * (x + 0.008 * k), y, z));
      }
      out.push(lock(pts, { width: 0.068, thickness: 0.025, belly: 0.45, tipStart: 0.62, tipRound: 0.7, segments: 32 }));
    }
  }
  return out;
}

export function bob(): THREE.BufferGeometry[] {
  return [...bobLocks(), ...frontLocks()];
}
