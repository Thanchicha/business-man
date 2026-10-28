import * as THREE from 'three';
import { mergeAll, sweep, vec } from './geometry';

export interface BowOptions {
  /** Half span of one wing (center → wing tip). */
  wing: number;
  /** Wing height at its widest. */
  wingHeight: number;
  /** Tail length (0 = no tails). */
  tail: number;
  tailWidth?: number;
  /** Ribbon thickness. */
  thickness?: number;
  /** Horizontal splay of the tails. */
  tailSpread?: number;
  /** Tail sway (adds an S-curve). */
  sway?: number;
}

/**
 * Ribbon bow in local space: faces +Z, centered on the knot at the origin.
 * Two pillowy wings, a knot and (optionally) two long hanging tails with pointed ends.
 */
export function bowGeometry(o: BowOptions): THREE.BufferGeometry {
  const th = o.thickness ?? o.wingHeight * 0.16;
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // Wing: pinched at the knot, swelling to a rounded outer end, tilted slightly up.
    const pts = [vec(0, 0, 0), vec(s * o.wing * 0.35, o.wingHeight * 0.08, -th), vec(s * o.wing * 0.72, o.wingHeight * 0.16, -th * 1.2), vec(s * o.wing, o.wingHeight * 0.12, -th * 0.6)];
    parts.push(
      sweep(pts, {
        width: (t) => o.wingHeight * (0.28 + 0.72 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5)) * (t > 0.92 ? Math.sqrt(Math.max(0, 1 - (t - 0.92) / 0.08)) * 0.9 + 0.1 : 1),
        thickness: (t) => th * (1 + 1.6 * Math.sin(Math.PI * t)),
        normalRef: () => new THREE.Vector3(0, 0, 1),
        segments: 18,
        radial: 10,
        squareness: 2.6,
      }),
    );
    if (o.tail > 0) {
      const tw = o.tailWidth ?? o.wingHeight * 0.32;
      const spread = o.tailSpread ?? o.wing * 0.45;
      const sway = o.sway ?? 0.15;
      const tp = [
        vec(s * 0.002, -o.wingHeight * 0.05, th),
        vec(s * spread * 0.45, -o.tail * 0.3, th * 0.6 + sway * o.tail * 0.1),
        vec(s * spread * (0.8 + sway), -o.tail * 0.65, -sway * o.tail * 0.08),
        vec(s * spread, -o.tail, 0),
      ];
      parts.push(
        sweep(tp, {
          width: (t) => tw * (0.75 + 0.35 * t) * (t > 0.9 ? Math.max(0.05, (1 - t) / 0.1) : 1),
          thickness: () => th * 0.7,
          normalRef: () => new THREE.Vector3(0, 0, 1),
          twist: (t) => s * 0.35 * Math.sin(t * Math.PI),
          segments: 20,
          radial: 8,
          squareness: 5,
        }),
      );
    }
  }
  const knot = new THREE.SphereGeometry(1, 14, 10);
  knot.scale(o.wingHeight * 0.26, o.wingHeight * 0.34, th * 2.4);
  parts.push(knot);
  return mergeAll(parts);
}
