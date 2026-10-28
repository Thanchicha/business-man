import * as THREE from 'three';
import { headFrontZ, headSdf } from '../body/headShape';
import { rand, sweep, vec } from '../lib/geometry';
import { keepOutside, trace } from '../lib/surface';
import { capPoint, capSdf, HAIR_CENTER, lock } from './shared';

/**
 * Hair clump layouts over the cap: bangs, cheek locks, the fluffy flicked-out layers around the
 * sides and back, crown clumps and the ahoge. Every function returns plain geometries; hair.ts
 * merges them.
 */

/** z of the visible front surface (cap or face) at (x, y), plus `off`. */
function frontZ(x: number, y: number, off: number): number {
  const cap = trace(capSdf, vec(x, y, 0.5), vec(0, 0, -1), 0.7);
  const face = headFrontZ(x, y);
  let z = Number.isNaN(face) ? HAIR_CENTER.z : face;
  if (cap) z = Math.max(z, cap.z);
  return z + off;
}

// ---------------------------------------------------------------------------------------------
// Bangs: long messy pointed locks from a part slightly to his left. They fall over the top of
// the eyes (eye top ≈ 0.705) — one long lock between the eyes — and the outer ones frame the
// cheeks.
// ---------------------------------------------------------------------------------------------

interface BangSpec {
  u: number; // -1 (his right, -X) … 1 (his left, +X)
  tipY: number;
  width: number;
  /** Sideways drift of the tip, flowing away from the part. */
  drift: number;
  /** Layer: 1 sits slightly in front of its neighbours for depth. */
  layer: 0 | 1;
}

const PART_X = 0.014;

const BANGS: BangSpec[] = [
  { u: -1.0, tipY: 0.63, width: 0.074, drift: -0.012, layer: 0 },
  { u: -0.74, tipY: 0.69, width: 0.078, drift: -0.018, layer: 1 },
  { u: -0.48, tipY: 0.7, width: 0.08, drift: -0.006, layer: 0 },
  { u: -0.22, tipY: 0.692, width: 0.078, drift: 0.012, layer: 1 },
  { u: 0.03, tipY: 0.668, width: 0.064, drift: -0.004, layer: 0 },
  { u: 0.26, tipY: 0.696, width: 0.078, drift: 0.016, layer: 1 },
  { u: 0.5, tipY: 0.704, width: 0.08, drift: 0.008, layer: 0 },
  { u: 0.76, tipY: 0.688, width: 0.078, drift: 0.02, layer: 1 },
  { u: 1.0, tipY: 0.636, width: 0.074, drift: 0.012, layer: 0 },
];

export function bangs(): THREE.BufferGeometry[] {
  return BANGS.map((b, i) => {
    const th = b.width * 0.32;
    const lift = th * 0.5 + 0.003 + b.layer * 0.004;
    const root = capPoint(PART_X * 4 + b.u * 0.62, 0.36, -0.02);
    const ys = [0.875, 0.815, 0.76];
    const xs = ys.map((_, k) => PART_X + (b.u * 0.118 - PART_X) * (0.62 + 0.14 * k));
    const pts = [root];
    ys.forEach((y, k) => pts.push(vec(xs[k], y, frontZ(xs[k], y, lift + 0.006 - 0.002 * k))));
    const tx = b.u * 0.118 + b.drift;
    const midY = (0.76 + b.tipY) / 2;
    const mx = (xs[2] + tx) / 2 + b.drift * 0.25;
    pts.push(vec(mx, midY, frontZ(mx, midY, lift + 0.001)));
    pts.push(vec(tx, b.tipY, frontZ(tx, b.tipY, lift - 0.001)));
    return lock(pts, { width: b.width, thickness: th, belly: 0.3, tipStart: 0.55, tipRound: 1.0, twist: (rand(i + 7) - 0.5) * 0.3 });
  });
}

// ---------------------------------------------------------------------------------------------
// Cheek locks: two per side in front of the ears, ending at the jaw.
// ---------------------------------------------------------------------------------------------

export function sideLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const zf = 0.07 - k * 0.034;
      const tipY = (s < 0 ? [0.602, 0.618] : [0.606, 0.62])[k];
      const pts = [
        capPoint(s * (0.98 + k * 0.26), 0.66, -0.006),
        vec(s * (0.138 + k * 0.018), 0.745, zf),
        vec(s * (0.152 + k * 0.02), 0.68, zf - 0.004),
        vec(s * (0.148 + k * 0.022), 0.635, zf - 0.008),
        vec(s * (0.13 + k * 0.024), tipY, zf - 0.006),
      ].map((p, i) => (i === 0 ? p : keepOutside(headSdf, p, 0.012)));
      out.push(lock(pts, { width: 0.07 - k * 0.008, thickness: 0.022, belly: 0.35, tipStart: 0.55, tipRound: 0.9 }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Fluff: two layers of thick pointed clumps around the sides and back, each lying on the cap
// and flicking outward at the tip, so the head reads as a wide round messy mop from every side.
// ---------------------------------------------------------------------------------------------

interface FluffLayer {
  count: number;
  /** Polar angle (from straight up) of the roots, the middle and the tips. */
  polar: [number, number, number];
  /** How far the tips flick out from the cap. */
  flare: number;
  width: number;
  seed: number;
}

const LAYERS: FluffLayer[] = [
  { count: 14, polar: [0.42, 1.05, 1.62], flare: 0.04, width: 0.088, seed: 1 },
  { count: 13, polar: [0.95, 1.6, 2.2], flare: 0.034, width: 0.084, seed: 2 },
];
/** Azimuth span the fluff covers (radians from +Z): everything but the face. */
const SPAN: [number, number] = [0.78, Math.PI * 2 - 0.78];

export function fluff(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const L of LAYERS) {
    for (let i = 0; i < L.count; i++) {
      const r = (k: number) => rand(L.seed * 100 + i * 7 + k) - 0.5;
      const a = SPAN[0] + (SPAN[1] - SPAN[0]) * ((i + 0.5 + (L.seed === 2 ? 0.5 : 0)) / (L.count + (L.seed === 2 ? 0.5 : 0))) + r(1) * 0.12;
      const drift = r(2) * 0.25;
      // Shorter at the sides near the face, longest at the back.
      const sideness = Math.abs(Math.cos(a));
      const tipPolar = L.polar[2] - (Math.cos(a) > 0 ? 0.25 * sideness : 0) + r(3) * 0.12;
      const pts = [
        capPoint(a, L.polar[0], -0.012),
        capPoint(a + drift * 0.3, L.polar[1], 0.008),
        capPoint(a + drift * 0.7, (L.polar[1] + tipPolar) / 2, 0.014),
        capPoint(a + drift, tipPolar, L.flare * (0.8 + 0.4 * (r(4) + 0.5))),
      ];
      out.push(lock(pts, { width: L.width * (0.9 + 0.2 * (r(5) + 0.5)), thickness: L.width * 0.4, belly: 0.4, tipStart: 0.5, tipRound: 1.0, twist: r(6) * 0.4 }));
    }
  }
  return out;
}

/** Clumps radiating from the crown whorl over the top of the head. */
export function crownLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const pts = [capPoint(Math.PI, 0.18, -0.01), capPoint(a, 0.38, 0.008), capPoint(a + 0.15, 0.62, 0.012)];
    out.push(lock(pts, { width: 0.07, thickness: 0.024, belly: 0.45, tipStart: 0.55, tipRound: 1.0, twist: (rand(i + 90) - 0.5) * 0.3 }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Ahoge: two thin strands rising from the crown, curling forward.
// ---------------------------------------------------------------------------------------------

export function ahoge(): THREE.BufferGeometry[] {
  const top = capPoint(0, 0.05, -0.012);
  const strand = (pts: THREE.Vector3[], w: number) =>
    sweep(pts.map((p) => p.add(top)), {
      width: (t) => w * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 0.7) + 0.0015,
      thickness: (t) => 0.01 * (1 - 0.6 * t) + 0.001,
      normalRef: () => vec(0, 0, 1),
      segments: 32,
      radial: 10,
    });
  return [
    strand([vec(0, 0, 0), vec(-0.004, 0.03, 0.002), vec(0.002, 0.058, 0.012), vec(0.02, 0.07, 0.026), vec(0.036, 0.058, 0.034)], 0.022),
    strand([vec(-0.006, 0, -0.004), vec(-0.012, 0.024, -0.006), vec(-0.022, 0.044, -0.002), vec(-0.036, 0.048, 0.006)], 0.016),
  ];
}
