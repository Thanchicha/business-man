import * as THREE from 'three';
import { rand, sweep, vec } from '../lib/geometry';
import { lock } from './shared';

/**
 * Twin tails (reference/twintail.png): tied high on the back-sides of the head, each tail rises
 * into a soft rounded loop above the tie, then falls wide behind the shoulders to the skirt hem.
 * The tie and loop are blended into the hair cap (tailRootSdf); below that a smooth round core is
 * wrapped by clumps that separate toward the bottom, so it reads as a full volume from every view.
 */

/** Tail axis for her left (+X); mirrored for her right. The root sits inside the hair cap. */
const AXIS: [number, number, number][] = [
  [0.09, 0.875, -0.06],
  [0.138, 0.898, -0.08],
  [0.186, 0.9, -0.102],
  [0.218, 0.84, -0.124],
  [0.236, 0.72, -0.15],
  [0.246, 0.6, -0.158],
  [0.25, 0.48, -0.154],
  [0.24, 0.39, -0.136],
  [0.222, 0.33, -0.128],
];

/** Half extent of the clump ring around the axis (lateral, depth) at axis parameter t. */
function spread(t: number): [number, number] {
  const grow = THREE.MathUtils.smoothstep(t, 0.08, 0.4);
  const belly = 0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.1));
  return [0.064 * grow * belly, 0.055 * grow * belly];
}

interface Strand {
  /** Angle around the axis (0 = outward/lateral, π/2 = toward the back). */
  angle: number;
  /** Radial scale of the offset. */
  r: number;
  /** Where along the axis the strand ends (1 = full length). */
  end: number;
  width: number;
  /** Tip curl toward the body (+) or away (−), world units. */
  curl: number;
}

const STRANDS: Strand[] = [
  { angle: 0.0, r: 1.0, end: 0.97, width: 0.11, curl: 0.01 },
  { angle: 1.05, r: 1.0, end: 0.95, width: 0.11, curl: 0.014 },
  { angle: 2.1, r: 1.0, end: 0.99, width: 0.11, curl: 0.02 },
  { angle: 3.15, r: 1.0, end: 0.93, width: 0.11, curl: 0.028 },
  { angle: 4.2, r: 1.0, end: 0.91, width: 0.104, curl: 0.022 },
  { angle: 5.25, r: 1.0, end: 0.96, width: 0.11, curl: 0.012 },
  // A loose outer wisp that breaks the silhouette near the bottom.
  { angle: -0.25, r: 1.15, end: 0.88, width: 0.06, curl: 0.004 },
];

/** Where the separate clumps start, inside the smooth core. */
const STRAND_START = 0.16;

function axisCurve(s: number): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(AXIS.map(([x, y, z]) => vec(s * x, y, z)), false, 'centripetal');
}

/** Axis span that is part of the hair cap surface (see tailRootSdf); the core sweep starts inside it. */
const ROOT_END = 0.3;
const CORE_START = 0.2;

/** Capsule chain along the tail root for both sides: [x, y, z, radius] per sample. */
const ROOT_SAMPLES: [number, number, number, number][][] = [-1, 1].map((s) => {
  const curve = axisCurve(s);
  const n = 14;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * ROOT_END;
    const p = curve.getPointAt(t);
    return [p.x, p.y, p.z, 0.044 + 0.012 * (t / ROOT_END)] as [number, number, number, number];
  });
});

/**
 * Signed distance to the twin tails' roots (tie and loop). hair.ts blends this into the cap so
 * the hair on the head flows into each tail as one surface instead of a separate stuck-on loop.
 */
export function tailRootSdf(x: number, y: number, z: number): number {
  let d = Infinity;
  for (const chain of ROOT_SAMPLES) {
    for (let i = 0; i < chain.length - 1; i++) {
      const [ax, ay, az, ar] = chain[i], [bx, by, bz, br] = chain[i + 1];
      const vx = bx - ax, vy = by - ay, vz = bz - az;
      const h = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / (vx * vx + vy * vy + vz * vz)));
      const dx = x - ax - vx * h, dy = y - ay - vy * h, dz = z - az - vz * h;
      d = Math.min(d, Math.sqrt(dx * dx + dy * dy + dz * dz) - (ar + (br - ar) * h));
    }
  }
  return d;
}

/** Smooth round core of the upper tail, starting inside the blended root and fading into the clumps. */
function core(curve: THREE.CatmullRomCurve3): THREE.BufferGeometry {
  const pts = Array.from({ length: 21 }, (_, i) => curve.getPointAt(CORE_START + ((1 - CORE_START) * i) / 20));
  return sweep(pts, {
    width: (t) => 0.112 * (0.62 + 0.38 * THREE.MathUtils.smoothstep(t, 0, 0.12)) * (1 - 0.35 * t) * Math.pow(Math.cos(Math.max(0, t - 0.6) / 0.4 * Math.PI * 0.5), 0.6) + 0.001,
    thickness: (t) => 0.094 * (0.6 + 0.4 * THREE.MathUtils.smoothstep(t, 0, 0.12)) * (1 - 0.4 * t) * Math.pow(Math.cos(Math.max(0, t - 0.6) / 0.4 * Math.PI * 0.5), 0.6) + 0.001,
    normalRef: () => vec(0, 0, 1),
    segments: 70,
    radial: 16,
    squareness: 2.2,
  });
}

/** One tail (s = +1 her left, −1 her right). */
export function twinTail(s: number): THREE.BufferGeometry[] {
  const curve = axisCurve(s);
  const samples = curve.getSpacedPoints(80);
  // Thickness axis of each clump points away from the tail axis, so clumps wrap the bundle.
  const fromAxis = (p: THREE.Vector3) => {
    let best = samples[0], d = Infinity;
    for (const q of samples) {
      const dq = q.distanceToSquared(p);
      if (dq < d) (d = dq), (best = q);
    }
    const v = p.clone().sub(best);
    v.y = 0;
    return v.lengthSq() < 1e-8 ? vec(s, 0, -0.4).normalize() : v.normalize();
  };
  const clumps = STRANDS.map((st, i) => {
    const n = 12;
    const pts: THREE.Vector3[] = [];
    const wobble = (rand(i * 7 + (s > 0 ? 3 : 11)) - 0.5) * 0.4;
    for (let k = 0; k <= n; k++) {
      const t = STRAND_START + (k / n) * (st.end - STRAND_START);
      const c = curve.getPointAt(t);
      const [a, b] = spread(t);
      const ang = st.angle + wobble * t;
      // Lateral offset is along ±X (mirrored), depth along −Z.
      const off = vec(s * Math.cos(ang) * a * st.r, 0, -Math.sin(ang) * b * st.r);
      off.x -= s * st.curl * THREE.MathUtils.smoothstep(k / n, 0.7, 1);
      pts.push(c.add(off));
    }
    return lock(pts, {
      width: st.width,
      thickness: st.width * 0.46,
      belly: 0.45,
      tipStart: 0.62,
      tipRound: 0.65,
      segments: 48,
      twist: s * (rand(i + 40) - 0.5) * 0.25,
      normalRef: fromAxis,
    });
  });
  return [core(curve), ...clumps];
}
