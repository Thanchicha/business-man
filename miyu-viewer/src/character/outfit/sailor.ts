import * as THREE from 'three';
import { bowGeometry } from '../lib/bow';
import { orient, shellFromGrids, sweep, vec } from '../lib/geometry';
import { trace } from '../lib/surface';
import { blouseFront, blouseSdf } from './blouse';

/**
 * Miyu's sailor collar (reference/sheet.webp): a white cape lying over the shoulders, open in a
 * V at the front where the pink neck bow sits, with a pink trim line along its outer edge.
 * Angles θ are measured from +Z (front) toward +X (her left).
 */

/** Center the collar is projected from onto the blouse. */
const C = vec(0, 0.47, -0.008);
/** Half-angle of the front opening. */
const OPEN = 0.32;

/** Elevation (radians above horizontal) of the collar's outer edge at θ: deep at front and back. */
function edgeElevation(theta: number): number {
  const front = Math.max(0, Math.cos(theta));
  const back = Math.max(0, -Math.cos(theta));
  return 0.62 - 0.36 * front ** 2 - 0.3 * back ** 2;
}
const NECK_ELEVATION = 1.18;

function collarPoint(theta: number, v: number, lift: number): THREE.Vector3 {
  const phi = THREE.MathUtils.lerp(NECK_ELEVATION, edgeElevation(theta), v);
  const dir = vec(Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi));
  const hit = trace(blouseSdf, C.clone().addScaledVector(dir, 0.3), dir.clone().negate(), 0.3) ?? C.clone().addScaledVector(dir, 0.07);
  // A slight puff across the middle so the collar reads as fabric lying on the blouse.
  return hit.addScaledVector(dir, lift + 0.0015 * Math.sin(Math.PI * v));
}

const thetaAt = (u: number) => OPEN + (Math.PI * 2 - 2 * OPEN) * u;

function grid(lift: number): THREE.Vector3[][] {
  const rows = 12, cols = 120;
  const g: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: THREE.Vector3[] = [];
    for (let c = 0; c <= cols; c++) row.push(collarPoint(thetaAt(c / cols), r / rows, lift));
    g.push(row);
  }
  return g;
}

export function sailorCollar(): THREE.BufferGeometry {
  return shellFromGrids(grid(0.0055), grid(0.0025), false);
}

/** Pink trim line just inside the collar's outer edge (and down both front edges). */
export function collarTrim(): THREE.BufferGeometry[] {
  const n = 100;
  const edge = Array.from({ length: n + 1 }, (_, i) => collarPoint(thetaAt(0.01 + 0.98 * (i / n)), 0.86, 0.0068));
  const tube = (pts: THREE.Vector3[]) =>
    sweep(pts, { width: () => 0.0045, thickness: () => 0.0018, normalRef: (p) => p.clone().sub(C).normalize(), segments: 140, radial: 8, squareness: 4 });
  return [tube(edge)];
}

/** Pink ribbon bow at the V of the collar. */
export function neckBow(): THREE.BufferGeometry {
  const at = blouseFront(0, 0.522, 0.012);
  const bow = bowGeometry({ wing: 0.04, wingHeight: 0.032, tail: 0.05, tailWidth: 0.014, thickness: 0.006, tailSpread: 0.014, sway: 0.1 });
  return orient(bow, at, vec(0, 0.15, 1).normalize());
}
