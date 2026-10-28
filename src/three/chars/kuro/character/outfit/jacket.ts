import * as THREE from 'three';
import { torsoCore } from '../body/bodyShape';
import { sdEllipsoid, smax, smin } from '../body/sdf';
import { meshSdf } from '../body/surfaceNets';
import { bump, mergeAll, orient, shellFromGrids, sweep, vec } from '../lib/geometry';
import { band, buckleShape, extrude, strap } from '../lib/shapes';
import { normalAt, trace } from '../lib/surface';
import { RIG } from '../rig';

/**
 * Kuro's oversized black zip track hoodie, worn on the shoulders and open at the front: a boxy shell
 * over the chest falling loose to the hip, the hood bunched up behind the neck, the same puffy
 * gathered sleeves as the rest of the cast (bell cuffs half hiding the hands), silver zippers
 * along the front edges and black strap bands with long dangling straps.
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
    p(0.084, 0.506, -0.012),
    p(0.1, 0.47, -0.016),
    p(0.117, 0.435, -0.016),
    p(0.128, 0.396, -0.01),
    p(0.139, 0.355, -0.004),
    p(0.148, 0.299, -0.004),
  ]);
}

/** Parameter of the gather between the round puff and the long bell cuff (≈ y 0.395). */
export const SLEEVE_GATHER_T = 0.58;

/** Base radius keys: puff → gather → bell cuff with a turned-back hem at the opening. */
const R_KEYS: [number, number][] = [
  [0, 0.03], [0.1, 0.033], [0.3, 0.034], [0.42, 0.033], [0.52, 0.032], [SLEEVE_GATHER_T, 0.03],
  [0.66, 0.031], [0.88, 0.036], [0.93, 0.038], [0.955, 0.039], [1, 0.039],
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

/** Relative radial offset: soft puff folds, gathered pleats at the wrist, drape in the cuff, sag. */
function sleeveRelief(s: number, t: number, a: number): number {
  const puffEnd = SLEEVE_GATHER_T - 0.02;
  const puff = 0.01 * Math.sin(a * 5 + t * 5) * bump(t / puffEnd);
  const gather = 0.075 * Math.sin(a * 11) * bump((t - SLEEVE_GATHER_T + 0.06) / 0.12);
  const drape = 0.035 * Math.sin(a * 4 + 0.5) * smooth(SLEEVE_GATHER_T + 0.05, 0.92, t);
  const sag = 0.01 * Math.max(0, Math.cos(a - outerBack(s))) * bump(t / puffEnd);
  return puff + gather + drape + sag;
}

/** The bell cuff hangs flattened against her side: narrower across X, deeper front-to-back. */
function cuffAspect(t: number): { kx: number; kz: number } {
  const k = smooth(SLEEVE_GATHER_T - 0.04, SLEEVE_GATHER_T + 0.12, t);
  return { kx: 1 - 0.2 * k, kz: 1 + 0.12 * k };
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
// Jacket body (solid shell, worn on the shoulders, open front, hood resting on the back)
// ---------------------------------------------------------------------------------------------

/** Hem height and shell thickness of the jacket body. */
export const JACKET_HEM = 0.312;
const SHELL = 0.009;
const DRAPE_Z = -0.008;
/** Neck opening radius (the turtleneck collar shows through it). */
const NECK_HOLE = 0.047;

/** Half width of the open front at height y: narrow at the collar, wider toward the hem. */
export const frontGap = (y: number) => 0.03 + 0.03 * smooth(0.54, 0.34, y);

/** Outer surface before cuts: torso inflated over the chest, falling as a loose boxy drape. */
function outerSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const core = torsoCore(ax, y, z) - 0.016;
  const t = smooth(0.5, JACKET_HEM, y);
  const rx = 0.1 + 0.03 * t, rz = 0.074 + 0.026 * t;
  // Superellipse cross-section: a little boxy, like a stiff oversized jacket.
  const q = Math.pow(Math.pow(ax / rx, 2.6) + Math.pow(Math.abs(z - DRAPE_Z) / rz, 2.6), 1 / 2.6);
  const drape = smax((q - 1) * Math.min(rx, rz), y - 0.49, 0.03);
  return smin(core, drape, 0.03);
}

/** Hood bunched up behind the neck, resting on the upper back. */
function hoodSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const bulk = sdEllipsoid(ax, y - 0.548, z + 0.064, 0.09, 0.052, 0.054);
  // Two soft lobes so it reads as gathered cloth, not a ball.
  const lobes = sdEllipsoid(ax - 0.04, y - 0.556, z + 0.058, 0.05, 0.044, 0.048);
  const fold = 0.002 * Math.sin(ax * 90 + y * 60);
  return smin(bulk, lobes, 0.02) - fold;
}

/** Negated SDF of the neck-hole cylinder above the chest (positive inside it, for cutting). */
const neckHole = (x: number, y: number, z: number) => -smax(Math.hypot(x, z - RIG.neckZ) - NECK_HOLE, 0.5 - y, 0.01);

/** Solid jacket body in world space (shell + hood, front opening and neck hole cut out). */
export function jacketSdf(x: number, y: number, z: number): number {
  const outer = outerSdf(x, y, z);
  let d = smax(outer, -(outer + SHELL), 0.002);
  d = smin(d, hoodSdf(x, y, z), 0.012);
  d = smax(d, neckHole(x, y, z), 0.006);
  // Open front.
  const gap = Math.max(Math.abs(x) - frontGap(y), -z);
  d = smax(d, -gap, 0.003);
  return smax(d, JACKET_HEM - y, 0.003);
}

/** Outer jacket surface (no front opening) — straps and the bag trace against this. */
export function jacketSurfaceSdf(x: number, y: number, z: number): number {
  return smax(smin(outerSdf(x, y, z), hoodSdf(x, y, z), 0.012), JACKET_HEM - y, 0.003);
}

export function jacketBodyGeometry(): THREE.BufferGeometry {
  return meshSdf(jacketSdf, { min: [-0.165, JACKET_HEM - 0.006, -0.135], max: [0.165, 0.615, 0.125] }, 0.0027);
}

/** Point on the jacket surface hit from `from` toward `to`, lifted along the normal. */
export function onJacket(from: THREE.Vector3, to: THREE.Vector3, lift: number): THREE.Vector3 {
  const dir = to.clone().sub(from);
  const p = trace(jacketSurfaceSdf, from, dir, dir.length()) ?? to.clone();
  return p.addScaledVector(normalAt(jacketSurfaceSdf, p), lift);
}

/** Soft rolled rims around the sleeve openings. */
export function jacketEdges(): THREE.BufferGeometry {
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

/** Silver zipper teeth along both front edges, from the collar to the hem. */
export function zippers(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const y = THREE.MathUtils.lerp(0.53, JACKET_HEM + 0.004, i / 16);
      const x = s * (frontGap(y) + 0.0035);
      pts.push(onJacket(vec(x, y, 0.3), vec(x, y, 0), 0.0008));
    }
    parts.push(sweep(pts, { width: () => 0.0042, thickness: () => 0.0018, normalRef: (p) => vec(p.x, 0, p.z - DRAPE_Z).normalize(), squareness: 6, segments: 40, radial: 8 }));
  }
  return mergeAll(parts);
}

// ---------------------------------------------------------------------------------------------
// Black sleeve bands, cuff tabs and dangling straps
// ---------------------------------------------------------------------------------------------

/** Black band around the upper sleeve. */
const BAND_T = 0.2;

/** Small black D-shaped tab: flat top, round bottom. */
function tabShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.lineTo(1, 0);
  s.absellipse(0, 0, 1, 0.75, 0, -Math.PI, true);
  return s;
}

/** Black bands around the upper sleeves and the wrist gathers, plus a tab at each wrist. */
export function sleeveBands(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tab = extrude(tabShape(), 0.0022, 0.0085);
  for (const s of [-1, 1]) {
    const curve = sleeveCurve(s);
    for (const [t, h] of [[BAND_T, 0.013], [SLEEVE_GATHER_T, 0.011]] as const) {
      const { p, T } = frameAt(curve, t);
      const r = sleeveRadius(t) * (t === SLEEVE_GATHER_T ? 1.08 : 1) + 0.009;
      const g = band(vec(0, 0, 0), r, r, h, 0.003, 0, 40);
      // band() is built around +Y; rotate so its axis follows the sleeve tangent.
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), T));
      parts.push(g.translate(p.x, p.y, p.z));
    }
    const t = SLEEVE_GATHER_T + 0.045;
    const at = sleevePoint(s, t, outerFront(s), 0.0015);
    const out = at.clone().sub(frameAt(curve, t).p).setY(0).normalize();
    parts.push(orient(tab, at, out));
  }
  return mergeAll(parts);
}

/** Long black straps dangling from each upper-sleeve band down the outside of the arm, with buckles. */
export function jacketStraps(): { black: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const black: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const buckle = extrude(buckleShape(0.016, 0.013, 0.003), 0.0025);
  for (const s of [-1, 1]) {
    // Dangling sleeve strap: from the band, hanging along the outer side of the puff.
    const a = s > 0 ? Math.PI : 0; // outermost side of the sleeve
    const pts = [BAND_T, 0.32, 0.44].map((t) => sleevePoint(s, t, a, 0.004));
    const end = pts[pts.length - 1];
    pts.push(end.clone().add(vec(s * 0.004, -0.035, 0.004)));
    black.push(strap(pts, 0.011, 0.0025, () => vec(s, 0, 0.15).normalize(), 24));
    metal.push(orient(buckle, pts[1].clone().add(vec(s * 0.002, 0, 0)), vec(s, 0, 0.2).normalize()));
  }
  return { black: mergeAll(black), metal: mergeAll(metal) };
}

/** Two white track stripes down the outer side of each sleeve, shoulder to wrist gather. */
export function sleeveStripes(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const curve = sleeveCurve(s);
    const outer = s > 0 ? Math.PI - 0.45 : 0.45; // outer side, turned a little toward the front
    for (const da of [-0.17, 0.17]) {
      const ts = Array.from({ length: 14 }, (_, i) => 0.04 + (i / 13) * (SLEEVE_GATHER_T - 0.05));
      const pts = ts.map((t) => sleevePoint(s, t, outer + da * s, 0.0012));
      parts.push(strap(pts, 0.0075, 0.0016, (p) => {
        const c = curve.getPointAt(ts[0]);
        let best = c, d = Infinity;
        for (const t of ts) {
          const q = curve.getPointAt(t);
          const dq = q.distanceToSquared(p);
          if (dq < d) (d = dq), (best = q);
        }
        return p.clone().sub(best).normalize();
      }, 40));
    }
  }
  return mergeAll(parts);
}
