import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { torsoCore } from '../body/bodyShape';
import { RoundCone, sdEllipsoid, smax, smin } from '../body/sdf';
import { meshSdf } from '../body/surfaceNets';
import { mergeAll, orient, vec } from '../lib/geometry';
import { band, buckleShape, extrude, strap } from '../lib/shapes';
import { normalAt, trace } from '../lib/surface';

/**
 * Loose white cargo pants (reference/sheet.webp, detail 4): wide straight legs that bunch over the
 * sneakers, a black belt, big side cargo pockets with black flaps, black adjuster bands above the
 * knees and long black straps dangling from the belt down the outside of each leg.
 */

export const PANTS = { top: 0.438, hem: 0.08, beltY: 0.428 };

const leg = new RoundCone({ x: 0.058, y: 0.35, z: 0.0 }, { x: 0.063, y: 0.1, z: -0.004 }, 0.05, 0.05);

/** One baggy leg (pass |x|): straight tube, fuller knee, fabric stacking above the hem. */
function legSdf(x: number, y: number, z: number): number {
  let d = leg.dist(x, y, z);
  d = smin(d, sdEllipsoid(x - 0.061, y - 0.2, z - 0.004, 0.052, 0.06, 0.052), 0.02);
  const stack = Math.max(0, 1 - Math.abs(y - 0.105) / 0.03);
  d -= 0.006 * stack + 0.0016 * Math.sin(y * 260 + x * 40) * stack;
  // Long soft folds down the leg.
  const ang = Math.atan2(z - 0.004, x - 0.061);
  d -= 0.0012 * Math.sin(ang * 5 + y * 20);
  return d;
}

export function pantsSdf(wx: number, y: number, z: number): number {
  const x = Math.abs(wx);
  const hips = torsoCore(x, y, z) - 0.016;
  let d = smin(hips, legSdf(x, y, z), 0.03);
  d = smax(d, y - PANTS.top, 0.004);
  return smax(d, PANTS.hem - y, 0.004);
}

export function pantsGeometry(): THREE.BufferGeometry {
  return meshSdf(pantsSdf, { min: [-0.14, PANTS.hem - 0.006, -0.08], max: [0.14, PANTS.top + 0.008, 0.08] }, 0.003);
}

/** Pants surface point on side s, seen from azimuth `a` (radians from +Z toward the outside). */
export function pantsPoint(s: number, y: number, a: number, lift = 0): THREE.Vector3 {
  const dir = vec(s * Math.sin(a), 0, Math.cos(a));
  const c = vec(s * 0.061, y, 0.004);
  const half = (px: number, py: number, pz: number) => Math.max(pantsSdf(px, py, pz), -s * px);
  const p = trace(half, c.clone().addScaledVector(dir, 0.2), dir.clone().negate(), 0.25) ?? c.clone().addScaledVector(dir, 0.05);
  return p.addScaledVector(normalAt(pantsSdf, p), lift);
}

function waistRadii(y: number): [number, number] {
  const side = trace(pantsSdf, vec(0.3, y, 0), vec(-1, 0, 0), 0.3);
  const front = trace(pantsSdf, vec(0, y, 0.3), vec(0, 0, -1), 0.3);
  return [side?.x ?? 0.09, front?.z ?? 0.07];
}

/** White cargo pockets on the outer thighs. */
export function pockets(): { white: THREE.BufferGeometry; black: THREE.BufferGeometry } {
  const white: THREE.BufferGeometry[] = [];
  const black: THREE.BufferGeometry[] = [];
  const box = new RoundedBoxGeometry(0.046, 0.054, 0.012, 2, 0.004);
  box.deleteAttribute('uv');
  const flap = new RoundedBoxGeometry(0.05, 0.016, 0.006, 2, 0.0025);
  flap.deleteAttribute('uv');
  for (const s of [-1, 1]) {
    const a = 1.25;
    const p = pantsPoint(s, 0.245, a, 0.004);
    const n = normalAt(pantsSdf, p).setY(0).normalize();
    white.push(orient(box, p, n));
    black.push(orient(flap, p.clone().add(vec(0, 0.024, 0)).addScaledVector(n, 0.007), n));
  }
  return { white: mergeAll(white), black: mergeAll(black) };
}

/** Belt, knee adjuster bands, dangling straps; silver buckles. */
export function pantsStraps(): { black: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const black: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const [rx, rz] = waistRadii(PANTS.beltY);
  black.push(band(vec(0, PANTS.beltY, 0), rx + 0.002, rz + 0.002, 0.016, 0.004));
  const buckle = extrude(buckleShape(0.024, 0.02, 0.0045), 0.0035);
  metal.push(buckle.clone().translate(0, PANTS.beltY, rz + 0.006));
  const small = extrude(buckleShape(0.015, 0.012, 0.003), 0.0025);

  for (const s of [-1, 1]) {
    // Adjuster band around the leg above the knee, buckle on the outer front.
    const y = 0.17;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 40; i++) pts.push(pantsPoint(s, y + 0.003 * Math.sin((i / 40) * Math.PI * 2), (i / 40) * Math.PI * 2, 0.0025));
    black.push(strap([...pts, pts[0], pts[1]], 0.012, 0.0028, (p) => normalAt(pantsSdf, p), 64));
    const b = pantsPoint(s, y, 0.7, 0.005);
    metal.push(orient(small, b, normalAt(pantsSdf, b)));

    // Long strap from the belt down the outer front of the leg, ending loose below the knee.
    const hang = [PANTS.beltY - 0.004, 0.36, 0.29, 0.22, 0.15].map((yy, i) => pantsPoint(s, yy, 0.62 + i * 0.05, 0.004 + (i > 2 ? 0.003 : 0)));
    black.push(strap(hang, 0.011, 0.0026, (p) => normalAt(pantsSdf, p), 40));
    const hb = hang[1].clone();
    metal.push(orient(small, hb.addScaledVector(normalAt(pantsSdf, hb), 0.002), normalAt(pantsSdf, hang[1])));
  }
  return { black: mergeAll(black), metal: mergeAll(metal) };
}
