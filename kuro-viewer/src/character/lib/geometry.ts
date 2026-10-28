import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural geometry helpers shared by clothing, hair and accessories.
 */

export type Vec3Tuple = [number, number, number];
export const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface SweepOptions {
  /** Cross-section full width (along the binormal) at curve parameter t∈[0,1]. */
  width: (t: number) => number;
  /** Cross-section full thickness (along the reference normal) at t. */
  thickness: (t: number) => number;
  /** Reference "normal" direction at a point (thickness axis), e.g. outward from the head. */
  normalRef?: (p: THREE.Vector3, t: number) => THREE.Vector3;
  /** Superellipse exponent of the cross-section (2 = ellipse, 6+ = rounded rectangle). */
  squareness?: number;
  /** Twist of the cross-section around the tangent (radians) at t. */
  twist?: (t: number) => number;
  /** Vertices around the cross-section. */
  radial?: number;
  segments?: number;
  closed?: boolean;
  caps?: boolean;
  curveType?: 'centripetal' | 'chordal' | 'catmullrom';
  tension?: number;
}

/** Sweeps a superellipse cross-section along a Catmull-Rom curve through `points`. */
export function sweep(points: THREE.Vector3[], o: SweepOptions): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, o.closed ?? false, o.curveType ?? 'centripetal', o.tension ?? 0.5);
  const segs = o.segments ?? 32;
  const radial = o.radial ?? 10;
  const n = o.squareness ?? 2;
  const closed = o.closed ?? false;
  const rows = closed ? segs : segs + 1;
  const pos: number[] = [];
  const idx: number[] = [];

  const frames = curve.computeFrenetFrames(segs, closed);
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const centers: THREE.Vector3[] = [];
  for (let i = 0; i < rows; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    T.copy(frames.tangents[i]);
    if (o.normalRef) N.copy(o.normalRef(p, t));
    else N.copy(frames.normals[i]);
    N.addScaledVector(T, -N.dot(T));
    if (N.lengthSq() < 1e-10) N.copy(frames.normals[i]);
    N.normalize();
    B.crossVectors(T, N).normalize();
    const tw = o.twist ? o.twist(t) : 0;
    if (tw) {
      const c = Math.cos(tw), s = Math.sin(tw);
      const n2 = N.clone().multiplyScalar(c).addScaledVector(B, s);
      B.multiplyScalar(c).addScaledVector(N, -s);
      N.copy(n2);
    }
    const w = Math.max(o.width(t), 1e-5) / 2;
    const h = Math.max(o.thickness(t), 1e-5) / 2;
    centers.push(p.clone());
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cx = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
      const cy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      pos.push(p.x + B.x * w * cx + N.x * h * cy, p.y + B.y * w * cx + N.y * h * cy, p.z + B.z * w * cx + N.z * h * cy);
    }
  }
  const ringCount = closed ? rows : rows - 1;
  for (let i = 0; i < ringCount; i++) {
    const i2 = (i + 1) % rows;
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j, b = i * radial + j2, c = i2 * radial + j2, d = i2 * radial + j;
      idx.push(a, d, b, b, d, c);
    }
  }
  if (!closed && (o.caps ?? true)) {
    for (const [ring, flip] of [[0, true], [rows - 1, false]] as const) {
      const ci = pos.length / 3;
      const c = centers[ring];
      pos.push(c.x, c.y, c.z);
      // Duplicate ring vertices so caps get flat normals.
      const base = pos.length / 3;
      for (let j = 0; j < radial; j++) {
        const k = (ring * radial + j) * 3;
        pos.push(pos[k], pos[k + 1], pos[k + 2]);
      }
      for (let j = 0; j < radial; j++) {
        const j2 = (j + 1) % radial;
        if (flip) idx.push(ci, base + j2, base + j);
        else idx.push(ci, base + j, base + j2);
      }
    }
  }
  return finish(pos, idx);
}

/** Builds an indexed geometry from flat arrays and computes smooth normals. */
export function finish(pos: number[], idx: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Thick shell from two matching grids (rows × cols): outer surface, inner surface and rims
 * joining them along every open border. `closedU` wraps the columns.
 */
export function shellFromGrids(outer: THREE.Vector3[][], inner: THREE.Vector3[][], closedU: boolean): THREE.BufferGeometry {
  const rows = outer.length, cols = outer[0].length;
  const pos: number[] = [];
  const idx: number[] = [];
  const push = (grid: THREE.Vector3[][]) => {
    const base = pos.length / 3;
    for (const row of grid) for (const v of row) pos.push(v.x, v.y, v.z);
    return base;
  };
  const surface = (base: number, flip: boolean) => {
    const cmax = closedU ? cols : cols - 1;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cmax; c++) {
        const c2 = (c + 1) % cols;
        const a = base + r * cols + c, b = base + r * cols + c2, cc = base + (r + 1) * cols + c2, d = base + (r + 1) * cols + c;
        if (flip) idx.push(a, b, d, b, cc, d);
        else idx.push(a, d, b, b, d, cc);
      }
    }
  };
  surface(push(outer), false);
  surface(push(inner), true);
  // Rims: strips between outer and inner along each open border (separate vertices for crisp edges).
  const rim = (a: THREE.Vector3[], b: THREE.Vector3[], flip: boolean, closed: boolean) => {
    const base = pos.length / 3;
    for (let i = 0; i < a.length; i++) pos.push(a[i].x, a[i].y, a[i].z, b[i].x, b[i].y, b[i].z);
    const m = closed ? a.length : a.length - 1;
    for (let i = 0; i < m; i++) {
      const i2 = (i + 1) % a.length;
      const p0 = base + i * 2, p1 = p0 + 1, q0 = base + i2 * 2, q1 = q0 + 1;
      if (flip) idx.push(p0, p1, q0, q0, p1, q1);
      else idx.push(p0, q0, p1, q0, q1, p1);
    }
  };
  rim(outer[0], inner[0], false, closedU);
  rim(outer[rows - 1], inner[rows - 1], true, closedU);
  if (!closedU) {
    rim(outer.map((r) => r[0]), inner.map((r) => r[0]), true, false);
    rim(outer.map((r) => r[cols - 1]), inner.map((r) => r[cols - 1]), false, false);
  }
  return finish(pos, idx);
}

/** Keeps only position+normal so geometries from different generators can be merged. */
export function mergeAll(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = geoms.map((g) => {
    const c = g.index ? g : g.toNonIndexed();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', c.getAttribute('position'));
    out.setAttribute('normal', c.getAttribute('normal') ?? (c.computeVertexNormals(), c.getAttribute('normal')));
    if (c.index) out.setIndex(c.index);
    else out.setIndex([...Array(c.getAttribute('position').count).keys()]);
    return out;
  });
  const merged = mergeGeometries(clean, false);
  if (!merged) throw new Error('mergeAll: incompatible geometries');
  return merged;
}

/** Returns a copy of `g` transformed by position / euler rotation / scale. */
export function place(g: THREE.BufferGeometry, p: THREE.Vector3 | Vec3Tuple, rot: Vec3Tuple = [0, 0, 0], scale: number | Vec3Tuple = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    Array.isArray(p) ? new THREE.Vector3(...p) : p,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale),
  );
  return g.clone().applyMatrix4(m);
}

/** Orients geometry built along +Z so that +Z points along `dir` (and +Y roughly along `up`). */
export function orient(g: THREE.BufferGeometry, at: THREE.Vector3, dir: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)): THREE.BufferGeometry {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), up);
  m.setPosition(at);
  return g.clone().applyMatrix4(m);
}

/** A chain of alternating torus links along a curve. */
export function chain(points: THREE.Vector3[], linkLength = 0.008, wire = 0.0012): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const count = Math.max(2, Math.round(curve.getLength() / (linkLength * 0.78)));
  const link = new THREE.TorusGeometry(linkLength / 2 - wire, wire, 5, 10);
  link.scale(1, 0.62, 1);
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const g = link.clone();
    // Torus lies in XY; long axis X. Align X with tangent, alternate rotation around it.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), i % 2 ? Math.PI / 2 : 0);
    g.applyQuaternion(spin).applyQuaternion(q).translate(p.x, p.y, p.z);
    out.push(g);
  }
  return mergeAll(out);
}

/** Smooth 0→1→0 bump. */
export const bump = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
