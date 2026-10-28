import * as THREE from 'three';
import { bump, mergeAll, orient, shellFromGrids, sweep, vec } from '../lib/geometry';
import { band, extrude } from '../lib/shapes';

/**
 * Oversized white jacket worn slipped off the shoulders: a bell-shaped body hanging around the
 * back from the upper arms, very puffy sleeves gathered at the wrist that open into wide bell
 * cuffs hiding the hands, rolled edges, and a black band across the top of each sleeve.
 */

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Sleeves
// ---------------------------------------------------------------------------------------------

/** Sleeve axis for side s (+1 her left, -1 her right): shoulder → wrist gather → cuff opening. */
export function sleeveCurve(s: number): THREE.CatmullRomCurve3 {
  const p = (x: number, y: number, z: number) => vec(s * x, y, z);
  return new THREE.CatmullRomCurve3([
    // Miyu: puffy sleeve gathered at the wrist, ending in a short frill over the back of the hand.
    p(0.084, 0.506, -0.012),
    p(0.098, 0.474, -0.016),
    p(0.112, 0.44, -0.016),
    p(0.122, 0.405, -0.01),
    p(0.13, 0.375, -0.004),
    p(0.134, 0.35, 0.0),
  ]);
}

/** Parameter of the gather between the round puff and the long bell cuff (≈ y 0.395). */
export const SLEEVE_GATHER_T = 0.76;

/** Base radius keys: round puff → wrist gather → short flared frill. */
const R_KEYS: [number, number][] = [
  [0, 0.031], [0.12, 0.037], [0.35, 0.041], [0.55, 0.039], [0.68, 0.031], [SLEEVE_GATHER_T, 0.022],
  [0.84, 0.026], [0.94, 0.033], [1, 0.034],
];
export function sleeveRadius(t: number): number {
  for (let i = 1; i < R_KEYS.length; i++) {
    if (t <= R_KEYS[i][0]) {
      const [t0, r0] = R_KEYS[i - 1], [t1, r1] = R_KEYS[i];
      const u = (t - t0) / (t1 - t0);
      return r0 + (r1 - r0) * (u * u * (3 - 2 * u));
    }
  }
  return R_KEYS[R_KEYS.length - 1][1];
}

/**
 * Stable frame along the sleeve: N points forward (+Z), B toward −X. Through the cuff the
 * cross-sections turn horizontal so the bell opening hangs level instead of facing outward.
 */
function frameAt(curve: THREE.CatmullRomCurve3, t: number) {
  const level = smooth(SLEEVE_GATHER_T, 0.97, t);
  const T = curve.getTangentAt(t).lerp(vec(0, -1, 0), level).normalize();
  const B = new THREE.Vector3().crossVectors(T, vec(0, 0, 1)).normalize();
  const N = new THREE.Vector3().crossVectors(B, T).normalize();
  return { p: curve.getPointAt(t), T, B, N };
}

/** Angle around the sleeve facing outward-front (the visible outer side) for side s. */
const outerFront = (s: number) => (s > 0 ? Math.PI - 0.6 : 0.6);
/** Angle facing outward-back, where the puff sags. */
const outerBack = (s: number) => (s > 0 ? Math.PI + 0.6 : -0.6);

/** Relative radial offset: soft puff folds, gathered pleats at the wrist, ruffles in the frill, sag. */
function sleeveRelief(s: number, t: number, a: number): number {
  const puffEnd = SLEEVE_GATHER_T - 0.02;
  const puff = 0.012 * Math.sin(a * 5 + t * 5) * bump(t / puffEnd);
  const gather = 0.075 * Math.sin(a * 11) * bump((t - SLEEVE_GATHER_T + 0.06) / 0.12);
  const drape = 0.1 * Math.sin(a * 13 + 0.5) * smooth(SLEEVE_GATHER_T + 0.03, 0.95, t);
  const sag = 0.012 * Math.max(0, Math.cos(a - outerBack(s))) * bump(t / puffEnd);
  return puff + gather + drape + sag;
}

/** The bell cuff hangs flattened against her side: narrower across X, deeper front-to-back. */
function cuffAspect(t: number): { kx: number; kz: number } {
  const k = smooth(SLEEVE_GATHER_T - 0.04, SLEEVE_GATHER_T + 0.12, t);
  return { kx: 1 - 0.08 * k, kz: 1 + 0.05 * k };
}

/** Sleeve surface point at parameter t, angle a (0 = −X side, π/2 = front), offset along the radius. */
function sleeveSurface(s: number, t: number, a: number, offset: number, curve = sleeveCurve(s)): THREE.Vector3 {
  const { p, B, N } = frameAt(curve, t);
  const { kx, kz } = cuffAspect(t);
  const r = Math.max(0.017, sleeveRadius(t) * (1 + sleeveRelief(s, t, a)) + offset);
  return p.addScaledVector(B, Math.cos(a) * r * kx).addScaledVector(N, Math.sin(a) * r * kz);
}

function sleeveGrid(s: number, inset: number): THREE.Vector3[][] {
  const curve = sleeveCurve(s);
  const rows = 56, cols = 48;
  const g: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: THREE.Vector3[] = [];
    for (let c = 0; c < cols; c++) row.push(sleeveSurface(s, r / rows, (c / cols) * Math.PI * 2, -inset, curve));
    g.push(row);
  }
  return g;
}

export function sleeveGeometry(s: number): THREE.BufferGeometry {
  return shellFromGrids(sleeveGrid(s, 0), sleeveGrid(s, 0.006), true);
}

/** Point on the sleeve surface (relief included) at parameter t, angle a, lifted along the radius. */
export function sleevePoint(s: number, t: number, a: number, lift = 0): THREE.Vector3 {
  return sleeveSurface(s, t, a, lift);
}

// ---------------------------------------------------------------------------------------------
// Jacket body
// ---------------------------------------------------------------------------------------------

/** Half-angle of the open front: narrow at the top, opening wide toward the hem so the front
 * edges tuck behind the bell cuffs instead of flaring out beside the skirt. */
const gapAt = (v: number) => THREE.MathUtils.degToRad(56 + 54 * Math.pow(v, 1.4));
const CZ = -0.02;

function bodyPoint(theta: number, v: number, lift: number): THREE.Vector3 {
  const front = smooth(0.25, 0.65, Math.cos(theta));
  const yTop = 0.474 - 0.03 * front;
  const yHem = 0.318 + 0.004 * front;
  const e = Math.pow(v, 0.8);
  // The top sits inside the slim sleeves (≈ upper-arm axis), then flares toward the hem.
  const rx = 0.104 + 0.084 * e;
  const rz = 0.084 + 0.052 * e;
  const fold = 1 + 0.03 * Math.sin(theta * 9 + 0.7) * Math.pow(v, 1.3) + 0.012 * Math.sin(theta * 17) * v;
  const k = fold + lift / rx;
  return vec(Math.sin(theta) * rx * k, THREE.MathUtils.lerp(yTop, yHem, v), CZ + Math.cos(theta) * rz * k);
}

/** Body point at column fraction u ∈ [0, 1] around the open shell (u = 0/1 are the front edges). */
const bodyAt = (u: number, v: number, lift: number) => {
  const gap = gapAt(v);
  return bodyPoint(gap + (Math.PI * 2 - 2 * gap) * u, v, lift);
};

function bodyGrid(lift: number): THREE.Vector3[][] {
  const rows = 22, cols = 96;
  const g: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) row.push(bodyAt(c / cols, r / rows, lift));
    g.push(row);
  }
  return g;
}

export function jacketBodyGeometry(): THREE.BufferGeometry {
  return shellFromGrids(bodyGrid(0), bodyGrid(-0.006), false);
}

/** Rolled edges of the jacket body: along the top, down both front edges and around the hem. */
export function jacketEdges(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 60;
  const along = (fn: (u: number) => THREE.Vector3) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const tube = (pts: THREE.Vector3[], r: number) =>
    sweep(pts, { width: () => r * 2, thickness: () => r * 1.4, normalRef: (p) => vec(p.x, 0, p.z - CZ).normalize(), segments: 80, radial: 8 });
  parts.push(tube(along((u) => bodyAt(u, 0, 0.003)), 0.007));
  parts.push(tube(along((u) => bodyAt(u, 1, 0.002)), 0.005));
  for (const u of [0, 1]) parts.push(tube(along((v) => bodyAt(u, v, 0.002)), 0.006));
  return mergeAll(parts);
}

/** Rolled rims around both sleeve openings (they belong to the sleeves). */
export function cuffRims(): THREE.BufferGeometry {
  return mergeAll([-1, 1].map((s) => cuffRim(s)));
}

/** Soft rolled rim around the bell cuff opening. */
function cuffRim(s: number): THREE.BufferGeometry {
  const n = 48;
  const pts = Array.from({ length: n }, (_, i) => sleevePoint(s, 0.995, (i / n) * Math.PI * 2, -0.001));
  const center = sleeveCurve(s).getPointAt(0.995);
  return sweep(pts, {
    closed: true,
    width: () => 0.006,
    thickness: () => 0.0045,
    normalRef: (p) => p.clone().sub(center).normalize(),
    segments: 96,
    radial: 8,
  });
}

// ---------------------------------------------------------------------------------------------
// Black sleeve bands and cuff tabs
// ---------------------------------------------------------------------------------------------

/** Black band across the top of each sleeve (the off-shoulder trim). */
const BAND_T = 0.12;

/** Small black D-shaped tab: flat top, round bottom. */
function tabShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.lineTo(1, 0);
  s.absellipse(0, 0, 1, 0.75, 0, -Math.PI, true);
  return s;
}

/** Black bands around the upper sleeves plus a small black tab at each wrist gather. */
export function sleeveBands(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tab = extrude(tabShape(), 0.0022, 0.0085);
  for (const s of [-1, 1]) {
    const curve = sleeveCurve(s);
    const { p, T } = frameAt(curve, BAND_T);
    const r = sleeveRadius(BAND_T) + 0.009;
    const g = band(vec(0, 0, 0), r, r, 0.013, 0.003, 0, 40);
    // band() is built around +Y; rotate so its axis follows the sleeve tangent.
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), T));
    parts.push(g.translate(p.x, p.y, p.z));

    const t = SLEEVE_GATHER_T + 0.045;
    const at = sleevePoint(s, t, outerFront(s), 0.0015);
    const out = at.clone().sub(frameAt(curve, t).p).setY(0).normalize();
    parts.push(orient(tab, at, out));
  }
  return mergeAll(parts);
}
