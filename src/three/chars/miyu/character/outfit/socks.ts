import * as THREE from 'three';
import { leg } from '../body/bodyShape';
import { smax } from '../body/sdf';
import { meshSdf } from '../body/surfaceNets';
import { trace } from '../lib/surface';
import { vec } from '../lib/geometry';

/** Height of the thigh-high sock tops. */
export const SOCK_TOP = 0.287;

/** Both socks (legs inflated by the knit thickness), from inside the boots up to the thigh. */
export function sockSdf(x: number, y: number, z: number): number {
  const top = y > SOCK_TOP - 0.012 ? 0.0012 : 0; // slightly thicker welt at the top
  const d = leg(Math.abs(x), y, z) - 0.0042 - top;
  return smax(smax(d, y - SOCK_TOP, 0.002), 0.09 - y, 0.002);
}

export function sockGeometry(): THREE.BufferGeometry {
  return meshSdf(sockSdf, { min: [-0.12, 0.085, -0.06], max: [0.12, SOCK_TOP + 0.01, 0.06] }, 0.0028);
}

/** Point on the sock/leg surface seen from direction (dx, dz) at height y on side s. */
export function legSurface(s: number, y: number, angle: number, lift = 0): THREE.Vector3 {
  const cx = s * 0.059;
  const dir = vec(Math.sin(angle), 0, Math.cos(angle));
  const origin = vec(cx, y, 0).addScaledVector(dir, 0.2);
  const surf = (x: number, yy: number, z: number) => Math.max(leg(Math.abs(x), yy, z) - 0.0042, -s * x);
  const hit = trace(surf, origin, dir.clone().negate(), 0.25) ?? vec(cx, y, 0).addScaledVector(dir, 0.04);
  return hit.addScaledVector(dir, lift);
}
