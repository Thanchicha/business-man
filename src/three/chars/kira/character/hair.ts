import * as THREE from 'three';
import { meshSdf } from './body/surfaceNets';
import { ahoge, bangs, sideLocks } from './hair/layout';
import { longHair } from './hair/longhair';
import { capSdf } from './hair/shared';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { toonMesh } from '../render/toon';
import type { Part } from './types';

let built: THREE.Mesh[] = [];
/** Dark hair gets a near-black outline; clumps separate through the mauve rim light and shading. */
const HAIR_LINE = '#0f0b0d';

/**
 * Hair — Kira's long dark loose hair: a volume cap over the scalp, 7 bangs, cheek locks, the
 * ahoge, and a wavy curtain falling behind the shoulders to the skirt hem (hair/longhair.ts).
 */
export function buildHair(): Part {
  const group = new THREE.Group();
  group.name = 'hair';
  const m = materials();
  const cap = toonMesh(meshSdf(capSdf, { min: [-0.22, 0.58, -0.22], max: [0.22, 1.0, 0.2] }, 0.0042), m.hair, { name: 'hairCap', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const locks = toonMesh(mergeAll([...sideLocks(), ...bangs(), ...ahoge()]), m.hair, { name: 'hairLocks', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const long = toonMesh(mergeAll(longHair()), m.hair, { name: 'hairLong', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  group.add(cap, locks, long);
  built = [cap, locks, long];
  return { object: group };
}

const ray = new THREE.Raycaster();

/**
 * First hair surface hit from `origin` along `dir` (world space), or null.
 * Lets accessories sit on the hair. Valid after buildHair() (the Kira root is at the origin).
 */
export function hitHair(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Intersection | null {
  ray.set(origin, dir.clone().normalize());
  for (const m of built) m.updateMatrixWorld(true);
  const hits = ray.intersectObjects(built, false).filter((h) => !h.object.userData.isOutline);
  return hits[0] ?? null;
}
