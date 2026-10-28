import * as THREE from 'three';
import { rand, vec } from '../lib/geometry';
import { capPoint, lock } from './shared';

/**
 * Kira's long loose hair (sheet details 1–2): two layers of soft wavy clumps that leave the cap
 * around the sides and back and fall as a wide curtain behind the shoulders to the skirt hem,
 * plus a few locks that fall forward over each shoulder onto the jacket.
 * Angles a are measured from +Z (front) toward +X (her left).
 */

const CENTER_Z = -0.03;

/** Half extents of the hair curtain around the body at height y (lateral, depth). */
function curtain(y: number): [number, number] {
  const keys: [number, number, number][] = [
    [0.3, 0.19, 0.165], [0.4, 0.2, 0.172], [0.5, 0.2, 0.176], [0.62, 0.19, 0.17], [0.72, 0.176, 0.164],
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
  /** Inset from the curtain (inner layer sits a little closer to the body). */
  inset: number;
  width: number;
  /** Phase shift so the layers' clumps interleave. */
  shift: number;
  seed: number;
}

const LAYERS: Layer[] = [
  { count: 18, inset: 0.014, width: 0.094, shift: 0.5, seed: 3 },
  { count: 20, inset: 0, width: 0.088, shift: 0, seed: 1 },
];
const SPAN: [number, number] = [0.98, Math.PI * 2 - 0.98];

function curtainLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const L of LAYERS) {
    for (let i = 0; i < L.count; i++) {
      const r = (k: number) => rand(L.seed * 131 + i * 17 + k) - 0.5;
      const a = SPAN[0] + (SPAN[1] - SPAN[0]) * ((i + 0.5 + L.shift * 0.5) / (L.count + L.shift * 0.5)) + r(1) * 0.06;
      const back = Math.max(0, -Math.cos(a));
      // Longest at the back (skirt hem), shorter toward the sides.
      const tipY = 0.31 + 0.06 * (1 - back) + r(2) * 0.03;
      const side = vec(Math.cos(a), 0, -Math.sin(a)); // tangent around the curtain, for the waves
      const phase = r(3) * 6;
      const pts = [capPoint(a, 1.2, -0.014)];
      for (const y of [0.72, 0.63, 0.54, 0.46, 0.39, tipY]) {
        const [rx, rz] = curtain(y);
        const wave = 0.011 * Math.sin(y * 34 + phase) * THREE.MathUtils.smoothstep(0.72 - y, 0, 0.12);
        const tuck = y === tipY ? 0.012 : 0; // tips curl slightly in
        const p = vec(Math.sin(a) * (rx - L.inset - tuck), y, CENTER_Z + Math.cos(a) * (rz - L.inset - tuck));
        pts.push(p.addScaledVector(side, wave));
      }
      out.push(lock(pts, {
        width: L.width * (0.9 + 0.25 * (r(4) + 0.5)),
        thickness: 0.03,
        belly: 0.5,
        tipStart: 0.72,
        tipRound: 0.9,
        segments: 56,
        twist: r(5) * 0.4,
        normalRef: (p) => vec(p.x, 0, p.z - CENTER_Z).normalize(),
      }));
    }
  }
  return out;
}

/** Locks falling forward over each shoulder onto the jacket front. */
function frontLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const a = s * (0.7 + k * 0.12);
      const phase = rand(k * 5 + (s > 0 ? 1 : 9)) * 6;
      const tipY = 0.4 + 0.03 * k + (rand(k + 30) - 0.5) * 0.02;
      const pts = [capPoint(a, 1.35, -0.012)];
      for (const [y, x, z] of [[0.7, 0.168, 0.06], [0.6, 0.172, 0.05], [0.52, 0.175, 0.044 - 0.012 * k], [tipY, 0.168, 0.04 - 0.014 * k]] as const) {
        pts.push(vec(s * (x + 0.006 * k + 0.008 * Math.sin(y * 30 + phase)), y, z));
      }
      out.push(lock(pts, { width: 0.07, thickness: 0.026, belly: 0.45, tipStart: 0.68, tipRound: 0.9, segments: 40 }));
    }
  }
  return out;
}

export function longHair(): THREE.BufferGeometry[] {
  return [...curtainLocks(), ...frontLocks()];
}
