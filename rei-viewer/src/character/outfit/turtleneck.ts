import * as THREE from 'three';
import { torsoCore } from '../body/bodyShape';
import { smax, smin } from '../body/sdf';
import { meshSdf } from '../body/surfaceNets';
import { vec } from '../lib/geometry';
import { trace } from '../lib/surface';
import { RIG } from '../rig';

/** Cloth offset of the turtleneck over the torso. */
const T = 0.0075;
/** Bottom of the shirt (tucked under the waistband of the pants). */
export const SHIRT_BOTTOM = 0.39;
/** Stand-up collar around the neck. */
const COLLAR = { bottom: 0.53, top: 0.588, r: RIG.neckRadius + 0.0085 };

/** Fitted black turtleneck: torso inflated by the knit thickness plus a folded high collar. */
export function turtleneckSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const fold = 0.001 * Math.sin(ax * 150 + y * 34) * Math.max(0, Math.min(1, (0.5 - y) / 0.08));
  let d = smax(torsoCore(ax, y, z) - T - fold, SHIRT_BOTTOM - y, 0.004);
  // Collar: a soft cylinder, slightly fuller at the folded top edge.
  const roll = 0.0035 * Math.exp(-(((y - (COLLAR.top - 0.012)) / 0.008) ** 2));
  const r = COLLAR.r + roll + 0.004 * Math.max(0, (COLLAR.bottom + 0.02 - y) / 0.02);
  const collar = smax(Math.hypot(x, z - RIG.neckZ) - r, Math.abs(y - (COLLAR.top + COLLAR.bottom) / 2) - (COLLAR.top - COLLAR.bottom) / 2, 0.006);
  d = smin(d, collar, 0.012);
  return d;
}

export function turtleneckGeometry(): THREE.BufferGeometry {
  return meshSdf(turtleneckSdf, { min: [-0.13, SHIRT_BOTTOM - 0.01, -0.09], max: [0.13, COLLAR.top + 0.01, 0.09] }, 0.003);
}

/** Front surface point of the turtleneck at (x, y). */
export function shirtFront(x: number, y: number, lift = 0): THREE.Vector3 {
  const p = trace(turtleneckSdf, vec(x, y, 0.3), vec(0, 0, -1), 0.5) ?? vec(x, y, 0.06);
  p.z += lift;
  return p;
}

export const COLLAR_SIZE = COLLAR;
