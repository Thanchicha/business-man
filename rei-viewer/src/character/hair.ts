import * as THREE from 'three';
import { meshSdf } from './body/surfaceNets';
import { ahoge, bangs, crownLocks, fluff, sideLocks } from './hair/layout';
import { capSdf } from './hair/shared';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { toonMesh } from '../render/toon';
import type { Part } from './types';

/**
 * Hair outlines are a soft lavender gray: clumps separate mainly through shape and shading, the
 * line only firms up the silhouette.
 */
const HAIR_LINE = '#9d99ad';

/**
 * Hair — Rei's short, fluffy messy white hair (sheet detail 1): a full volume cap over the scalp,
 * long pointed bangs falling over the eyes, cheek locks, two layers of flicked-out clumps around
 * the sides and back that make the wide round silhouette, crown clumps and a two-strand ahoge.
 */
export function buildHair(): Part {
  const group = new THREE.Group();
  group.name = 'hair';
  const m = materials();
  const cap = toonMesh(meshSdf(capSdf, { min: [-0.22, 0.58, -0.22], max: [0.22, 1.0, 0.2] }, 0.0042), m.hair, { name: 'hairCap', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  const locks = toonMesh(mergeAll([...fluff(), ...crownLocks(), ...sideLocks(), ...bangs(), ...ahoge()]), m.hair, { name: 'hairLocks', outline: OUTLINE.hair, outlineColor: HAIR_LINE });
  group.add(cap, locks);
  return { object: group };
}
