import * as THREE from 'three';
import { sdEllipsoid, smax, smin } from './body/sdf';
import { meshSdf } from './body/surfaceNets';
import { bangs, sideLocks } from './hair/layout';
import { longHair } from './hair/longhair';
import { earInners, earShells } from './hair/ears';
import { capSdf } from './hair/shared';
import { mergeAll } from './lib/geometry';
import { glassesGeometry } from './lib/glasses';
import { materials, OUTLINE } from './lib/materials';
import { memoGeometry } from './lib/memo';
import { toonMesh } from '../render/toon';
import type { ExtraLook } from './looks';
import type { Part } from './types';

/** Visor cap: a skull cap over the hair with a flat brim at the front. */
const visorSdf = (x: number, y: number, z: number): number => {
  const dome = smax(capSdf(x, y, z) - 0.012, 0.8 - y, 0.004);
  const brim = sdEllipsoid(x, y - 0.8, z - 0.125, 0.085, 0.007, 0.065);
  return smin(dome, brim, 0.008);
};

/**
 * Hair and head wear: the volume cap, the bangs and the cheek locks, plus a long back curtain,
 * a visor cap or glasses when the look asks for them.
 */
export function buildHair(look: ExtraLook): Part {
  const group = new THREE.Group();
  group.name = 'hair';
  const m = materials();
  const cap = toonMesh(memoGeometry('hairCap', () => meshSdf(capSdf, { min: [-0.22, 0.58, -0.22], max: [0.22, 1.0, 0.2] }, 0.0048)), m.hair, { name: 'hairCap', outline: OUTLINE.hair });
  const locks = toonMesh(memoGeometry('hairLocks', () => mergeAll([...sideLocks(), ...bangs()])), m.hair, { name: 'hairLocks', outline: OUTLINE.hair });
  group.add(cap, locks);
  if (look.hair === 'long') group.add(toonMesh(memoGeometry('hairLong', () => mergeAll(longHair())), m.hair, { name: 'hairLong', outline: OUTLINE.hair }));
  if (look.ears) {
    group.add(toonMesh(memoGeometry('earShells', () => mergeAll(earShells())), m.ear, { name: 'hairEars', outline: OUTLINE.hair }));
    group.add(toonMesh(memoGeometry('earInners', () => mergeAll(earInners())), m.accent, { name: 'hairEarInner', outline: false }));
  }
  if (look.hat === 'visor') group.add(toonMesh(meshSdf(visorSdf, { min: [-0.23, 0.78, -0.23], max: [0.23, 1.02, 0.22] }, 0.0038), m.top, { name: 'hat', outline: OUTLINE.cloth }));
  if (look.glasses) group.add(toonMesh(glassesGeometry({ eyeX: 0.077, eyeY: 0.67, halfW: 0.05, halfH: 0.039, corner: 0.012 }), m.dark, { name: 'glasses', outline: OUTLINE.tiny }));
  return { object: group };
}
