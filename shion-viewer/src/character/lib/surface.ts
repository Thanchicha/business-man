import * as THREE from 'three';
import type { Sdf } from '../body/sdf';

/**
 * Sphere-traces `sdf` from `origin` along `dir` and returns the first surface hit
 * (or null when nothing is hit within `maxDist`).
 */
export function trace(sdf: Sdf, origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 1): THREE.Vector3 | null {
  const d = dir.clone().normalize();
  let t = 0;
  for (let i = 0; i < 200 && t < maxDist; i++) {
    const p = origin.clone().addScaledVector(d, t);
    const s = sdf(p.x, p.y, p.z);
    if (s < 2e-5) return p;
    t += Math.max(s * 0.9, 2e-4);
  }
  return null;
}

/** Surface point reached by shooting from `from` toward `toward` (e.g. a point inside the body). */
export function surfaceToward(sdf: Sdf, from: THREE.Vector3, toward: THREE.Vector3): THREE.Vector3 {
  const dir = toward.clone().sub(from);
  return trace(sdf, from, dir, dir.length()) ?? toward.clone();
}

/** Outward surface normal (normalized gradient). */
export function normalAt(sdf: Sdf, p: THREE.Vector3, e = 1e-4): THREE.Vector3 {
  return new THREE.Vector3(
    sdf(p.x + e, p.y, p.z) - sdf(p.x - e, p.y, p.z),
    sdf(p.x, p.y + e, p.z) - sdf(p.x, p.y - e, p.z),
    sdf(p.x, p.y, p.z + e) - sdf(p.x, p.y, p.z - e),
  ).normalize();
}

/** Pushes a point out of `sdf` so it ends at least `gap` outside the surface. */
export function keepOutside(sdf: Sdf, p: THREE.Vector3, gap: number): THREE.Vector3 {
  for (let i = 0; i < 6; i++) {
    const d = sdf(p.x, p.y, p.z);
    if (d >= gap) break;
    p.addScaledVector(normalAt(sdf, p), gap - d);
  }
  return p;
}
