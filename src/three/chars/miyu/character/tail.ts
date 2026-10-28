import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { bowGeometry } from './lib/bow';
import { mergeAll, orient, sweep, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { band } from './lib/shapes';
import type { Part } from './types';

/**
 * Pink cat tail (reference/sheet.webp): leaves the lower back under the waist bow, dips behind
 * the skirt and curls up beside her left hip into a round fluffy tip, with a pink ribbon bow and a
 * light-pink scrunchie near the end.
 */

export const TAIL_CURVE = new THREE.CatmullRomCurve3(
  [
    vec(0, 0.375, -0.062),
    vec(0.02, 0.335, -0.13),
    vec(0.08, 0.3, -0.17),
    vec(0.155, 0.3, -0.15),
    vec(0.205, 0.335, -0.105),
    vec(0.225, 0.385, -0.072),
    vec(0.222, 0.42, -0.058),
  ],
  false,
  'centripetal',
);

/** Tail diameter at t: slim at the base, swelling into a round fluffy tip that closes as a dome. */
function girth(t: number): number {
  const swell = 0.024 + 0.024 * THREE.MathUtils.smoothstep(t, 0.55, 0.85);
  const dome = t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1;
  return swell * dome + 0.002;
}

function tailGeometry(): THREE.BufferGeometry {
  const pts = TAIL_CURVE.getSpacedPoints(40);
  return sweep(pts, {
    width: girth,
    thickness: girth,
    normalRef: () => vec(0, 0, 1),
    segments: 60,
    radial: 14,
    caps: true,
  });
}

export function buildTail(): Part {
  const group = new THREE.Group();
  group.name = 'tail';
  const m = materials();
  group.add(toonMesh(tailGeometry(), m.hair, { name: 'catTail', outline: OUTLINE.cloth, outlineColor: '#df8cab' }));

  const tBow = 0.72;
  const p = TAIL_CURVE.getPointAt(tBow), T = TAIL_CURVE.getTangentAt(tBow);
  const outward = vec(p.x, 0, p.z + 0.02).normalize();
  const bow = bowGeometry({ wing: 0.034, wingHeight: 0.028, tail: 0.04, tailWidth: 0.01, thickness: 0.005 });
  const ring = band(vec(0, 0, 0), 0.017, 0.017, 0.012, 0.005, 0, 32);
  ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), T)).translate(p.x, p.y, p.z);
  group.add(toonMesh(mergeAll([orient(bow, p.clone().addScaledVector(outward, 0.016), outward), ring]), m.pink, { name: 'tailBow', outline: OUTLINE.detail }));
  return { object: group };
}
