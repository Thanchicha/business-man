import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { jacketBodyGeometry, jacketEdges, sleeveGeometry, sleeveStripes, zippers } from './outfit/jacket';
import { pantsGeometry, pockets } from './outfit/pants';
import { turtleneckGeometry, undershirtGeometry } from './outfit/turtleneck';
import type { Part } from './types';

/**
 * Outfit (sheet details 2 and 4) — black inner shirt over a white undershirt hem, a black zip
 * track hoodie with white stripes down the sleeves, loose black cargo pants.
 */
export function buildOutfit(): Part {
  const group = new THREE.Group();
  group.name = 'outfit';
  const m = materials();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, outline: number | false = OUTLINE.cloth) => {
    const mesh = toonMesh(geo, mat, { name, outline });
    group.add(mesh);
    return mesh;
  };

  add(turtleneckGeometry(), m.black, 'turtleneck');
  add(undershirtGeometry(), m.cloth, 'undershirt', OUTLINE.detail);
  add(pantsGeometry(), m.dark, 'pants');
  const pk = pockets();
  add(pk.white, m.dark, 'pantsPockets', OUTLINE.detail);
  add(pk.black, m.leather, 'pantsStraps', OUTLINE.detail);

  // Body and sleeves are separate meshes so they can be skinned apart (body: torso, sleeves: arms).
  add(jacketBodyGeometry(), m.dark, 'jacketBody');
  add(mergeAll([jacketEdges(), sleeveGeometry(-1), sleeveGeometry(1)]), m.dark, 'jacketSleeves');
  add(sleeveStripes(), m.cloth, 'sleeveStripes', OUTLINE.tiny);
  add(zippers(), m.metal, 'jacketZippers', OUTLINE.tiny);
  return { object: group };
}
