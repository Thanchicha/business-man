import * as THREE from 'three';
import { scalpSdf } from '../body/headShape';
import { smax } from '../body/sdf';
import { sweep } from '../lib/geometry';
import { trace } from '../lib/surface';

/** Center the hair volume radiates from (between cranium center and crown). */
export const HAIR_CENTER = new THREE.Vector3(0, 0.79, -0.02);

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Hair line: the cap exists above this height (low at the back, at the forehead in front). */
export function hairlineY(x: number, z: number): number {
  const frontLine = THREE.MathUtils.lerp(0.79, 0.69, smooth(0.075, 0.125, Math.abs(x)));
  // At the back the hem is a soft U low on the nape, covering the top of the collar.
  const backLine = 0.6 + 0.04 * smooth(0.02, 0.14, Math.abs(x));
  return THREE.MathUtils.lerp(backLine, frontLine, smooth(-0.06, 0.075, z));
}

/**
 * The hair "cap": the scalp inflated by a volume that grows toward the crown (crown ≈ 0.98) and
 * puffs out over the sides, cut off along the hair line. The clumps in layout.ts cover it.
 * Solid SDF in world space.
 */
export function capSdf(x: number, y: number, z: number): number {
  const front = smooth(-0.02, 0.1, z) * (1 - smooth(0.06, 0.14, Math.abs(x)));
  const off = (0.018 + 0.036 * smooth(0.7, 0.93, y)) * (1 - 0.5 * front) + 0.022 * smooth(0.64, 0.8, y) * (1 - smooth(0.86, 0.95, y)) * Math.min(1, Math.abs(x) / 0.13);
  const back = smooth(-0.02, -0.1, z);
  // Fuller, rounded back of the head down to the nape.
  const nape = 0.012 * back * (1 - smooth(0.64, 0.8, y));
  const d = scalpSdf(x, y, z) - off - nape;
  return smax(d, hairlineY(x, z) - y, 0.024);
}

/**
 * Point on the cap surface in the direction given by azimuth `a` (radians from +Z toward +X)
 * and polar angle `p` (from straight up), pushed `out` along the ray.
 */
export function capPoint(a: number, p: number, out = 0): THREE.Vector3 {
  const dir = new THREE.Vector3(Math.sin(p) * Math.sin(a), Math.cos(p), Math.sin(p) * Math.cos(a));
  const origin = HAIR_CENTER.clone().addScaledVector(dir, 0.5);
  const hit = trace(capSdf, origin, dir.clone().negate(), 0.5) ?? HAIR_CENTER.clone().addScaledVector(dir, 0.17);
  return hit.addScaledVector(dir, out);
}

/** Outward direction for a hair point: radial from the head center above it, horizontal below. */
export function outward(p: THREE.Vector3): THREE.Vector3 {
  const c = new THREE.Vector3(0, Math.min(p.y, HAIR_CENTER.y), HAIR_CENTER.z);
  const v = p.clone().sub(c);
  if (v.lengthSq() < 1e-8) v.set(0, 1, 0);
  return v.normalize();
}

export interface LockOptions {
  width: number;
  /** Full thickness at the root; defaults to a third of the width so clumps read as volumes. */
  thickness?: number;
  /** Where along the lock the width peaks (0..1). */
  belly?: number;
  /** Where the tip taper begins (0..1); the taper is an ogive, so tips end soft, not needle-like. */
  tipStart?: number;
  /** Ogive exponent: lower is rounder (0.5 ≈ rounded end, 1 ≈ pointed). */
  tipRound?: number;
  segments?: number;
  twist?: number;
  /** Thickness axis at a point; defaults to outward from the head. */
  normalRef?: (p: THREE.Vector3) => THREE.Vector3;
}

/**
 * A sculpted hair clump through the given points: a thick lens-shaped cross-section (width
 * tangent to the head) that swells to a belly and closes in a smooth ogive tip.
 */
export function lock(points: THREE.Vector3[], o: LockOptions): THREE.BufferGeometry {
  const w0 = o.width, th = o.thickness ?? w0 * 0.34;
  const belly = o.belly ?? 0.3, ts = o.tipStart ?? 0.55, tr = o.tipRound ?? 0.75;
  const taper = (t: number) => (t <= ts ? 1 : Math.pow(Math.max(0, Math.cos(((t - ts) / (1 - ts)) * Math.PI * 0.5)), tr));
  // Roots narrow in so their end caps stay buried inside the hair cap instead of poking through.
  const root = (t: number) => 0.4 + 0.6 * Math.min(1, t / 0.12) ** 0.7;
  return sweep(points, {
    width: (t) => w0 * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, t / (2 * belly)))) * taper(t) * root(t),
    thickness: (t) => th * (1 - 0.35 * t) * Math.pow(taper(t), 0.6) * root(t) + 0.0008,
    normalRef: o.normalRef ?? ((p) => outward(p)),
    twist: o.twist ? (t) => o.twist! * t : undefined,
    segments: o.segments ?? 32,
    radial: 12,
    squareness: 1.8,
  });
}
