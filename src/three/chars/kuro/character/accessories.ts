import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { glassesGeometry } from './lib/glasses';
import { materials, OUTLINE } from './lib/materials';
import type { Part } from './types';

/** Accessories (sheet detail 1): thin black rectangular glasses. */
export function buildAccessories(): Part {
  const group = new THREE.Group();
  group.name = 'accessories';
  const m = materials();
  const glasses = glassesGeometry({ eyeX: 0.077, eyeY: 0.666, halfW: 0.047, halfH: 0.027, corner: 0.009 });
  group.add(toonMesh(glasses, m.black, { name: 'glasses', outline: OUTLINE.tiny }));
  return { object: group };
}
