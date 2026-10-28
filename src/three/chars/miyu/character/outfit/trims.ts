import * as THREE from 'three';
import { bowGeometry } from '../lib/bow';
import { mergeAll, orient, shellFromGrids, sweep, vec } from '../lib/geometry';
import { band, extrude, heartShape } from '../lib/shapes';
import { SLEEVE_GATHER_T, sleeveCurve, sleevePoint, sleeveRadius } from './jacket';
import { SKIRT, skirtPoint } from './skirt';
import { legSurface, SOCK_TOP } from './socks';
import { legAxisAt } from '../rig';

/**
 * Pink trims of Miyu's outfit: light-pink stripes on the skirt pleats, the belt with its heart
 * buckle, the big bow at the back of the waist, the pink cuff bands + bows on the sleeves and the
 * ribbon trims + bows on the sock tops.
 */

const PLEATS = 22;

/** Light-pink vertical stripes along every pleat ridge of the skirt. */
export function skirtStripes(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const half = (Math.PI * 2) / PLEATS * 0.16;
  for (let k = 0; k < PLEATS; k++) {
    const c = (k / PLEATS) * Math.PI * 2;
    const g = (lift: number) => {
      const rows = 16, cols = 4;
      return Array.from({ length: rows + 1 }, (_, r) =>
        Array.from({ length: cols + 1 }, (_, i) => skirtPoint(c - half + (2 * half * i) / cols, 0.06 + 0.9 * (r / rows), lift)),
      );
    };
    parts.push(shellFromGrids(g(0.0012), g(0.0002), false));
  }
  return mergeAll(parts);
}

/** Pink belt around the waist. */
export function belt(): THREE.BufferGeometry {
  return band(vec(0, SKIRT.top - 0.006, SKIRT.cz), 0.086, 0.073, 0.016, 0.005);
}

/** White heart buckle at the front of the belt. */
export function heartBuckle(): THREE.BufferGeometry {
  return extrude(heartShape(), 0.006, 0.03).translate(0, SKIRT.top - 0.005, SKIRT.cz + 0.077);
}

/** Big pink bow at the back of the waist. */
export function backBow(): THREE.BufferGeometry {
  const bow = bowGeometry({ wing: 0.072, wingHeight: 0.056, tail: 0.1, tailWidth: 0.02, thickness: 0.008, tailSpread: 0.028, sway: 0.15 });
  return orient(bow, vec(0, SKIRT.top - 0.01, SKIRT.cz - 0.078), vec(0, 0, -1));
}

/** Pink band around each sleeve at the wrist gather, with a small bow on the outer side. */
export function cuffTrims(): { bands: THREE.BufferGeometry; bows: THREE.BufferGeometry } {
  const bands: THREE.BufferGeometry[] = [];
  const bows: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const curve = sleeveCurve(s);
    const t = SLEEVE_GATHER_T;
    const p = curve.getPointAt(t), T = curve.getTangentAt(t);
    const r = sleeveRadius(t) + 0.004;
    const g = band(vec(0, 0, 0), r, r, 0.011, 0.004, 0, 40);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), T));
    bands.push(g.translate(p.x, p.y, p.z));
    const at = sleevePoint(s, t, s > 0 ? Math.PI - 0.9 : 0.9, 0.008);
    const out = at.clone().sub(p).setY(0).normalize();
    bows.push(orient(bowGeometry({ wing: 0.022, wingHeight: 0.018, tail: 0.02, tailWidth: 0.007, thickness: 0.004 }), at, out));
  }
  return { bands: mergeAll(bands), bows: mergeAll(bows) };
}

/** Pink ribbon trim around each sock top, with a small bow on the outer front. */
export function sockTrims(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const y = SOCK_TOP - 0.006;
  for (const s of [-1, 1]) {
    const n = 40;
    const ring = Array.from({ length: n }, (_, i) => legSurface(s, y, (i / n) * Math.PI * 2, 0.0015));
    const c = legAxisAt(y).setX(s * legAxisAt(y).x);
    parts.push(sweep(ring, { closed: true, width: () => 0.008, thickness: () => 0.0025, normalRef: (p) => p.clone().sub(c).setY(0).normalize(), segments: 80, radial: 8, squareness: 4 }));
    const a = s * 0.55;
    const at = legSurface(s, y, a, 0.005);
    parts.push(orient(bowGeometry({ wing: 0.02, wingHeight: 0.016, tail: 0.018, tailWidth: 0.006, thickness: 0.0035 }), at, vec(Math.sin(a), 0, Math.cos(a))));
  }
  return mergeAll(parts);
}
