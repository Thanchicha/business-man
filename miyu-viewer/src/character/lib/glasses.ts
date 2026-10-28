import * as THREE from 'three';
import { headFrontZ, headSdf } from '../body/headShape';
import { mergeAll, sweep, vec } from './geometry';
import { keepOutside } from './surface';

/**
 * Thin black rectangular glasses (Kuro / Kira / Miyu): two rounded-rectangle rims that follow
 * the curve of the face a little in front of the bangs' tips, a low bridge, and temples running
 * back along the sides of the head to the ears.
 */

export interface GlassesOptions {
  /** Eye center |x| and y (the face painter's EYE). */
  eyeX: number;
  eyeY: number;
  /** Rim half width / half height. */
  halfW?: number;
  halfH?: number;
  /** Corner radius of the rims (smaller = squarer). */
  corner?: number;
  /** Distance of the rims in front of the face surface. */
  offset?: number;
  /** Wire thickness. */
  wire?: number;
}

const wireTube = (pts: THREE.Vector3[], wire: number, closed: boolean) =>
  sweep(pts, { width: () => wire * 1.4, thickness: () => wire, closed, segments: closed ? 96 : 32, radial: 8, squareness: 3, curveType: 'catmullrom', tension: 0.1 });

export function glassesGeometry(o: GlassesOptions): THREE.BufferGeometry {
  const hw = o.halfW ?? 0.05, hh = o.halfH ?? 0.03, r = o.corner ?? 0.012, off = o.offset ?? 0.022, wire = o.wire ?? 0.0032;
  // Rims stand on a gently curved plane in front of the face (sampled at the eye height).
  const zAt = (x: number) => {
    const z = headFrontZ(x, o.eyeY);
    return (Number.isNaN(z) ? headFrontZ(Math.sign(x) * 0.1, o.eyeY) : z) + off;
  };
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const cx = s * o.eyeX, cy = o.eyeY;
    const pts: THREE.Vector3[] = [];
    // Rounded rectangle, sampled corner by corner.
    const corners: [number, number, number][] = [[hw - r, hh - r, 0], [-(hw - r), hh - r, Math.PI / 2], [-(hw - r), -(hh - r), Math.PI], [hw - r, -(hh - r), Math.PI * 1.5]];
    for (const [ox, oy, a0] of corners) {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        const x = cx + ox + Math.cos(a) * r, y = cy + oy + Math.sin(a) * r;
        pts.push(vec(x, y, zAt(x)));
      }
    }
    parts.push(wireTube(pts, wire, true));
    // Temple: from the outer top corner back along the head to just above the ear.
    const ox = s * (o.eyeX + hw);
    const start = vec(ox, cy + hh * 0.5, zAt(ox));
    const temple = [start, vec(s * 0.128, cy + 0.012, 0.06), vec(s * 0.138, cy + 0.01, 0.0), vec(s * 0.134, cy - 0.004, -0.045)].map((p, i) => (i === 0 ? p : keepOutside(headSdf, p, 0.006)));
    parts.push(wireTube(temple, wire * 0.9, false));
  }
  // Bridge.
  const bx = o.eyeX - hw;
  const bridge = [vec(-bx, o.eyeY + hh * 0.35, zAt(-bx)), vec(0, o.eyeY + hh * 0.5, zAt(0) + 0.002), vec(bx, o.eyeY + hh * 0.35, zAt(bx))];
  parts.push(wireTube(bridge, wire * 0.9, false));
  return mergeAll(parts);
}
