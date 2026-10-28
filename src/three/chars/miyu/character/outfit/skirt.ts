import * as THREE from 'three';
import { shellFromGrids, vec } from '../lib/geometry';

/**
 * Short black pleated flared skirt and the white ruffled petticoat beneath it.
 * Angles θ are measured from +Z (front) toward +X (her left).
 */

export const SKIRT = { top: 0.428, hem: 0.334, cz: 0.003 };
const PLEATS = 22;

/** Smooth radii of the skirt bell at normalized height t (0 = waist, 1 = hem). */
function bell(t: number): { rx: number; rz: number } {
  const e = 1 - Math.pow(1 - t, 1.7);
  return { rx: 0.081 + (0.152 - 0.081) * e, rz: 0.068 + (0.13 - 0.068) * e };
}

/** Triangle wave in [-1, 1] — sharp pleat folds. */
const tri = (u: number) => 1 - 4 * Math.abs(u - Math.floor(u + 0.5));

/** Point on the skirt's outer surface (no pleats if `smooth`). */
export function skirtPoint(theta: number, t: number, lift = 0, smooth = false): THREE.Vector3 {
  const { rx, rz } = bell(t);
  const pleat = smooth ? 0 : 0.075 * Math.pow(t, 0.9) * tri((theta / (Math.PI * 2)) * PLEATS);
  const k = 1 + pleat + lift / rx;
  const y = THREE.MathUtils.lerp(SKIRT.top, SKIRT.hem, t) + (t > 0.9 ? 0.002 * Math.sin(theta * PLEATS) : 0);
  return vec(Math.sin(theta) * rx * k, y, SKIRT.cz + Math.cos(theta) * rz * k);
}

function grid(fn: (theta: number, t: number) => THREE.Vector3, rows: number, cols: number): THREE.Vector3[][] {
  const g: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: THREE.Vector3[] = [];
    for (let c = 0; c < cols; c++) row.push(fn((c / cols) * Math.PI * 2, r / rows));
    g.push(row);
  }
  return g;
}

export function skirtGeometry(): THREE.BufferGeometry {
  const cols = PLEATS * 8, rows = 18;
  const outer = grid((a, t) => skirtPoint(a, t), rows, cols);
  const inner = grid((a, t) => skirtPoint(a, t, -0.004), rows, cols);
  return shellFromGrids(outer, inner, true);
}

/** White ruffled petticoat: starts inside the skirt and peeks below the hem to ≈0.30. */
export function petticoatGeometry(): THREE.BufferGeometry {
  const cols = 240, rows = 12;
  const top = 0.37, hem = 0.302;
  const point = (a: number, t: number, lift: number) => {
    const e = Math.pow(t, 1.3);
    const rx = 0.118 + (0.158 - 0.118) * e;
    const rz = 0.1 + (0.136 - 0.1) * e;
    const ruffle = 1 + (0.022 * Math.sin(a * 38) + 0.01 * Math.sin(a * 61 + 1)) * Math.pow(t, 1.5);
    const k = ruffle + lift / rx;
    const y = THREE.MathUtils.lerp(top, hem, t) + 0.003 * Math.sin(a * 38 + 0.8) * t;
    return vec(Math.sin(a) * rx * k, y, SKIRT.cz + Math.cos(a) * rz * k);
  };
  const outer = grid((a, t) => point(a, t, 0), rows, cols);
  const inner = grid((a, t) => point(a, t, -0.003), rows, cols);
  return shellFromGrids(outer, inner, true);
}
