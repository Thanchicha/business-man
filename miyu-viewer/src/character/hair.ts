import * as THREE from 'three';
import { meshSdf } from './body/surfaceNets';
import { bob } from './hair/bob';
import { earInners, earShells } from './hair/ears';
import { ahoge, bangs, sideLocks } from './hair/layout';
import { capSdf } from './hair/shared';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { toonMesh } from '../render/toon';
import type { Part } from './types';

let built: THREE.Mesh[] = [];
/** Pink hair gets a deeper rose outline; clumps separate mainly through shape and shading. */
const HAIR_LINE = '#df8cab';

/**
 * Hair — Miyu's pink layered bob: a volume cap over the scalp, 7 bangs, cheek locks, the two-strand
 * ahoge, a short fluffy bob ending above the collar (hair/bob.ts) and cat ears (hair/ears.ts).
 */
export function buildHair(): Part {
  const group = new THREE.Group();
  group.name = 'hair';
  const m = materials();
  const cap = toonMesh(meshSdf(capSdf, { min: [-0.22, 0.58, -0.22], max: [0.22, 1.0, 0.2] }, 0.0042), m.hair, { name: 'hairCap', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const locks = toonMesh(mergeAll(bangs()), m.hair, { name: 'hairLocks', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const antenna = toonMesh(mergeAll(ahoge()), m.hair, { name: 'hairAhoge', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  // Cheek locks join the bob so they sway with it.
  const bobMesh = toonMesh(mergeAll([...sideLocks(), ...bob()]), m.hair, { name: 'hairBob', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const ears = toonMesh(mergeAll(earShells()), m.hair, { name: 'catEars', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const inner = toonMesh(mergeAll(earInners()), m.cloth, { name: 'catEarInner', outline: OUTLINE.tiny, outlineColor: HAIR_LINE });
  group.add(cap, locks, antenna, bobMesh, ears, inner);
  built = [cap, locks, bobMesh];
  return { object: group };
}

const ray = new THREE.Raycaster();

/**
 * First hair surface hit from `origin` along `dir` (world space), or null.
 * Lets accessories sit on the hair. Valid after buildHair() (the Miyu root is at the origin).
 */
export function hitHair(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Intersection | null {
  ray.set(origin, dir.clone().normalize());
  for (const m of built) m.updateMatrixWorld(true);
  const hits = ray.intersectObjects(built, false).filter((h) => !h.object.userData.isOutline);
  return hits[0] ?? null;
}
