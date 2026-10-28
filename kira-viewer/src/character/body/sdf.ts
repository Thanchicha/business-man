/**
 * Scalar signed-distance helpers (no allocations — these run millions of times while meshing).
 * Distances are in world units; negative = inside.
 */

export type Sdf = (x: number, y: number, z: number) => number;

/** Polynomial smooth minimum (union) with blend radius k. */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Smooth maximum (intersection / subtraction when b is negated). */
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** Ellipsoid (iq's bound-corrected approximation; accurate near the surface). */
export function sdEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number): number {
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Precomputed round cone (capsule with different end radii) between two points. */
export class RoundCone {
  private readonly ax: number;
  private readonly ay: number;
  private readonly az: number;
  private readonly bx: number;
  private readonly by: number;
  private readonly bz: number;
  private readonly l2: number;
  private readonly rr: number;
  private readonly a2: number;
  private readonly il2: number;
  /** Axis-aligned bounds (for cheap far-field rejection). */
  readonly min: [number, number, number];
  readonly max: [number, number, number];

  constructor(a: Vec3Like, b: Vec3Like, private readonly r1: number, private readonly r2: number) {
    this.ax = a.x; this.ay = a.y; this.az = a.z;
    this.bx = b.x - a.x; this.by = b.y - a.y; this.bz = b.z - a.z;
    this.l2 = this.bx ** 2 + this.by ** 2 + this.bz ** 2;
    this.rr = r1 - r2;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
    const r = Math.max(r1, r2);
    this.min = [Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z) - r];
    this.max = [Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z) + r];
  }

  dist(px: number, py: number, pz: number): number {
    const pax = px - this.ax, pay = py - this.ay, paz = pz - this.az;
    const y = pax * this.bx + pay * this.by + paz * this.bz;
    const z = y - this.l2;
    const qx = pax * this.l2 - this.bx * y;
    const qy = pay * this.l2 - this.by * y;
    const qz = paz * this.l2 - this.bz * y;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = y * y * this.l2;
    const z2 = z * z * this.l2;
    const k = Math.sign(this.rr) * this.rr * this.rr * x2;
    if (Math.sign(z) * this.a2 * z2 > k) return Math.sqrt(x2 + z2) * this.il2 - this.r2;
    if (Math.sign(y) * this.a2 * y2 < k) return Math.sqrt(x2 + y2) * this.il2 - this.r1;
    return (Math.sqrt(x2 * this.a2 * this.il2) + y * this.rr) * this.il2 - this.r1;
  }
}

/** Distance from a point to an axis-aligned box (0 inside) — a lower bound for anything inside it. */
export function boxDistance(px: number, py: number, pz: number, min: readonly number[], max: readonly number[]): number {
  const dx = Math.max(min[0] - px, 0, px - max[0]);
  const dy = Math.max(min[1] - py, 0, py - max[1]);
  const dz = Math.max(min[2] - pz, 0, pz - max[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Numerical gradient (central differences). */
export function gradient(f: Sdf, x: number, y: number, z: number, out: number[], e = 1e-4): number[] {
  out[0] = f(x + e, y, z) - f(x - e, y, z);
  out[1] = f(x, y + e, z) - f(x, y - e, z);
  out[2] = f(x, y, z + e) - f(x, y, z - e);
  const inv = 1 / (2 * e);
  out[0] *= inv; out[1] *= inv; out[2] *= inv;
  return out;
}
