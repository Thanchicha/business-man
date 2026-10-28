import * as THREE from 'three';
import { headFrontZ, headSdf } from '../body/headShape';
import { rand, sweep, vec } from '../lib/geometry';
import { keepOutside, trace } from '../lib/surface';
import { capPoint, capSdf, HAIR_CENTER, lock } from './shared';

/**
 * Hair clump layouts over the cap: bangs, cheek locks and the ahoge (the long
 * hair lives in longhair.ts). Every function returns plain geometries; hair.ts merges them.
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
// Bangs: 11 broad locks flowing from a part slightly to her left. Locks over the eyes stop at the
// upper lash line (eye top ≈ 0.70) so the eyes stay readable; the outer locks frame the cheeks.
// ---------------------------------------------------------------------------------------------

interface BangSpec {
  u: number; // -1 (her right, -X) … 1 (her left, +X)
  tipY: number;
  width: number;
  /** Sideways drift of the tip, flowing away from the part. */
  drift: number;
  /** Layer: 1 sits slightly in front of its neighbours for depth. */
  layer: 0 | 1;
}

const PART_X = 0.014;

const BANGS: BangSpec[] = [
  { u: -1.0, tipY: 0.64, width: 0.078, drift: -0.016, layer: 0 },
  { u: -0.68, tipY: 0.7, width: 0.094, drift: -0.014, layer: 1 },
  { u: -0.34, tipY: 0.722, width: 0.098, drift: -0.012, layer: 0 },
  { u: 0.0, tipY: 0.704, width: 0.07, drift: 0.0, layer: 1 },
  { u: 0.34, tipY: 0.724, width: 0.098, drift: 0.012, layer: 0 },
  { u: 0.68, tipY: 0.702, width: 0.094, drift: 0.014, layer: 1 },
  { u: 1.0, tipY: 0.646, width: 0.078, drift: 0.016, layer: 0 },
];

export function bangs(): THREE.BufferGeometry[] {
  return BANGS.map((b, i) => {
    const th = b.width * 0.3;
    const lift = th * 0.5 + 0.003 + b.layer * 0.004;
    const root = capPoint(PART_X * 4 + b.u * 0.62, 0.36, -0.02);
    const ys = [0.875, 0.815, 0.76];
    // x fans out from the part, then the lower half curls gently away from it.
    const xs = ys.map((_, k) => PART_X + (b.u * 0.118 - PART_X) * (0.62 + 0.14 * k));
    const pts = [root];
    ys.forEach((y, k) => pts.push(vec(xs[k], y, frontZ(xs[k], y, lift + 0.006 - 0.002 * k))));
    const tx = b.u * 0.118 + b.drift;
    const midY = (0.76 + b.tipY) / 2;
    const mx = (xs[2] + tx) / 2 + b.drift * 0.25;
    pts.push(vec(mx, midY, frontZ(mx, midY, lift + 0.001)));
    // Tips tuck slightly toward the face, like real anime bangs.
    pts.push(vec(tx, b.tipY, frontZ(tx, b.tipY, lift - 0.002)));
    return lock(pts, { width: b.width, thickness: th, belly: 0.3, tipStart: 0.6, tipRound: 0.85, twist: (rand(i + 7) - 0.5) * 0.2 });
  });
}

// ---------------------------------------------------------------------------------------------
// Cheek locks: two per side in front of the ears, ending at the jaw and curling in under the
// cheeks (reference/twintail.png: tips at about chin height).
// ---------------------------------------------------------------------------------------------

export function sideLocks(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const zf = 0.07 - k * 0.034;
      const tipY = (s < 0 ? [0.592, 0.578] : [0.598, 0.582])[k];
      const pts = [
        capPoint(s * (0.98 + k * 0.26), 0.66, -0.006),
        vec(s * (0.136 + k * 0.016), 0.745, zf),
        vec(s * (0.15 + k * 0.018), 0.68, zf - 0.004),
        vec(s * (0.146 + k * 0.02), 0.628, zf - 0.008),
        vec(s * (0.124 + k * 0.022), tipY, zf - 0.006),
      ].map((p, i) => (i === 0 ? p : keepOutside(headSdf, p, 0.012)));
      out.push(lock(pts, { width: 0.072 - k * 0.008, thickness: 0.022, belly: 0.35, tipStart: 0.55, tipRound: 0.65 }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Ahoge: one thin strand rising from the crown and curling over toward her left.
// ---------------------------------------------------------------------------------------------

export function ahoge(): THREE.BufferGeometry[] {
  const top = capPoint(0, 0.0, -0.012);
  const pts = [vec(0, 0, 0), vec(-0.006, 0.028, 0.004), vec(-0.002, 0.054, 0.008), vec(0.016, 0.072, 0.01), vec(0.04, 0.072, 0.01), vec(0.056, 0.056, 0.008)].map((p) => p.add(top));
  return [
    sweep(pts, {
      width: (t) => 0.024 * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 0.7) + 0.0015,
      thickness: (t) => 0.011 * (1 - 0.6 * t) + 0.001,
      normalRef: () => vec(0, 0, 1),
      segments: 32,
      radial: 10,
    }),
  ];
}
