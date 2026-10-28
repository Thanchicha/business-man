import * as THREE from 'three';
import { meshSdf } from './body/surfaceNets';
import { ahoge, bangs, sideLocks } from './hair/layout';
import { capSdf } from './hair/shared';
import { tailRootSdf, twinTail } from './hair/twintails';
import { smin } from './body/sdf';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { toonMesh } from '../render/toon';
import type { Part } from './types';

let built: THREE.Mesh[] = [];
/**
 * Hair outlines are a soft lavender gray: clumps separate mainly through shape and shading, the
 * line only firms up the silhouette.
 */
const HAIR_LINE = '#9d99ad';

/**
 * Hair — white twin tails (reference/twintail.png): a volume cap over the scalp (smooth back with a
 * center part), 7 bangs, cheek locks, the ahoge and two high tails falling to the skirt hem.
 */
export function buildHair(): Part {
  const group = new THREE.Group();
  group.name = 'hair';
  const m = materials();

  // The tail roots are part of the cap surface, so the head hair flows into each tail seamlessly.
  const capWithTails = (x: number, y: number, z: number) => smin(capSdf(x, y, z), tailRootSdf(x, y, z), 0.022);
  const cap = toonMesh(meshSdf(capWithTails, { min: [-0.3, 0.58, -0.24], max: [0.3, 1.0, 0.2] }, 0.0042), m.hair, { name: 'hairCap', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const locks = toonMesh(mergeAll([...sideLocks(), ...bangs(), ...ahoge()]), m.hair, { name: 'hairLocks', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const tails = toonMesh(mergeAll([...twinTail(-1), ...twinTail(1)]), m.hair, { name: 'hairTails', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  group.add(cap, locks, tails);
  built = [cap, locks, tails];
  return { object: group };
}

const ray = new THREE.Raycaster();

/**
 * First hair surface hit from `origin` along `dir` (world space), or null.
 * Lets accessories sit on the hair. Valid after buildHair() (the Shion root is at the origin).
 */
export function hitHair(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Intersection | null {
  ray.set(origin, dir.clone().normalize());
  for (const m of built) m.updateMatrixWorld(true);
  const hits = ray.intersectObjects(built, false).filter((h) => !h.object.userData.isOutline);
  return hits[0] ?? null;
}
