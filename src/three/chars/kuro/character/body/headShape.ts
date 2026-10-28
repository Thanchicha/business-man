import { RIG } from '../rig';
import { sdEllipsoid, smax, smin } from './sdf';
import type { MeshBounds } from './surfaceNets';

/**
 * Chibi head as an implicit surface in WORLD space.
 *
 * Above the cheeks the skull is exactly the RIG cranium ellipsoid. The face/jaw is a loft of
 * horizontal cross-sections whose half-width and front/back depth follow the reference
 * silhouette (measured on reference/crops/front.png & side.png): full round cheeks down to
 * ≈0.62, then a soft U into a small chin at RIG.chinY. The front of each section is a flattened
 * superellipse so the face reads as a clean, broad, decal-friendly surface.
 */

const C = RIG.headCenter;
const CR = RIG.craniumRadii;

/** Face loft keyframes (world y): half width, front z, back z. */
const FACE_KEYS: [y: number, w: number, zf: number, zb: number][] = [
  [RIG.chinY, 0.02, 0.074, 0.058],
  [0.597, 0.038, 0.09, 0.05],
  [0.604, 0.064, 0.102, 0.036],
  [0.613, 0.087, 0.111, 0.014],
  [0.626, 0.106, 0.117, -0.014],
  [0.645, 0.12, 0.117, -0.052],
  [0.665, 0.125, 0.114, -0.08],
  [0.7, 0.126, 0.106, -0.098],
  [0.73, 0.12, 0.096, -0.09],
  [0.76, 0.104, 0.082, -0.07],
  [0.79, 0.08, 0.06, -0.04],
];
const FACE_TOP = FACE_KEYS[FACE_KEYS.length - 1][0];

/** Catmull-Rom sampled lookup table of the loft profile. */
const LUT_N = 512;
const LUT = new Float32Array(LUT_N * 3);
(function buildLut() {
  const n = FACE_KEYS.length;
  for (let i = 0; i < LUT_N; i++) {
    const y = RIG.chinY + ((FACE_TOP - RIG.chinY) * i) / (LUT_N - 1);
    let s = 0;
    while (s < n - 2 && y > FACE_KEYS[s + 1][0]) s++;
    const p0 = FACE_KEYS[Math.max(0, s - 1)], p1 = FACE_KEYS[s], p2 = FACE_KEYS[s + 1], p3 = FACE_KEYS[Math.min(n - 1, s + 2)];
    const t = (y - p1[0]) / (p2[0] - p1[0]);
    for (let c = 1; c <= 3; c++) {
      // Non-uniform Catmull-Rom tangents (by y spacing) keep the profile smooth with uneven keys.
      const m1 = (p2[c] - p0[c]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
      const m2 = (p3[c] - p1[c]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
      const t2 = t * t, t3 = t2 * t;
      LUT[i * 3 + c - 1] = (2 * t3 - 3 * t2 + 1) * p1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[c] + (t3 - t2) * m2;
    }
  }
})();

const FRONT_POWER = 2.6; // >2 flattens the face front

function faceLoft(x: number, wy: number, wz: number): number {
  const yc = Math.min(Math.max(wy, RIG.chinY), FACE_TOP);
  const fi = ((yc - RIG.chinY) / (FACE_TOP - RIG.chinY)) * (LUT_N - 1);
  const i = Math.min(LUT_N - 2, Math.floor(fi)), t = fi - i;
  const w = LUT[i * 3] + (LUT[i * 3 + 3] - LUT[i * 3]) * t;
  const zf = LUT[i * 3 + 1] + (LUT[i * 3 + 4] - LUT[i * 3 + 1]) * t;
  const zb = LUT[i * 3 + 2] + (LUT[i * 3 + 5] - LUT[i * 3 + 2]) * t;
  const zc = (zf + zb) / 2, rz = Math.max((zf - zb) / 2, 0.003), rx = Math.max(w, 0.003);
  const u = x / rx, v = Math.abs(wz - zc) / rz;
  const p = wz > zc ? FRONT_POWER : 2;
  const q = Math.pow(Math.pow(u, p) + Math.pow(v, p), 1 / p);
  let d = (q - 1) * Math.min(rx, rz);
  d = smax(d, RIG.chinY - wy, 0.012);
  return smax(d, wy - FACE_TOP, 0.02);
}

/**
 * Head SDF in world coordinates. No ears: the twin-tail reference hides them completely, and
 * modelled ears poked out under the cheek locks as skin bumps.
 */
export function headSdf(wx: number, wy: number, wz: number): number {
  return skullSdf(wx, wy, wz);
}

/** Back-of-skull bulge only (cranium + occiput), world coordinates — the scalp the hair covers. */
export function scalpSdf(wx: number, wy: number, wz: number): number {
  const x = Math.abs(wx - C.x), y = wy - C.y, z = wz - C.z;
  const cranium = sdEllipsoid(x, y, z, CR.x, CR.y, CR.z);
  const occiput = sdEllipsoid(x, y + 0.105, z + 0.05, 0.095, 0.064, 0.082);
  return smin(cranium, occiput, 0.04);
}

/** Skull: scalp + face loft, world coordinates. */
export function skullSdf(wx: number, wy: number, wz: number): number {
  return smin(scalpSdf(wx, wy, wz), faceLoft(Math.abs(wx - C.x), wy, wz), 0.03);
}

export const HEAD_BOUNDS: MeshBounds = {
  min: [C.x - 0.16, C.y - 0.205, C.z - 0.16],
  max: [C.x + 0.16, C.y + 0.165, C.z + 0.16],
};

/**
 * Z of the head surface (front) at world (x, y), found by marching from the front.
 * Returns NaN when the ray misses. Useful for placing face decals or bangs.
 */
export function headFrontZ(x: number, y: number): number {
  let z = C.z + 0.25;
  for (let i = 0; i < 128; i++) {
    const d = headSdf(x, y, z);
    if (d < 1e-5) return z;
    z -= Math.max(d, 1e-4);
    if (z < C.z - 0.2) break;
  }
  return NaN;
}
