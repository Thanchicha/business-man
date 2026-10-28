import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { blouseGeometry, butterflyPrint, neckFrill } from './outfit/blouse';
import { cuffRims, jacketBodyGeometry, jacketEdges, sleeveBands, sleeveGeometry } from './outfit/jacket';
import { petticoatGeometry, skirtGeometry } from './outfit/skirt';
import { sockGeometry } from './outfit/socks';
import type { Part } from './types';

/** Outfit — blouse, skirt + petticoat, oversized jacket, socks (SPEC §4). */
export function buildOutfit(): Part {
  const group = new THREE.Group();
  group.name = 'outfit';
  const m = materials();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, outline: number | false = OUTLINE.cloth) => {
    const mesh = toonMesh(geo, mat, { name, outline });
    group.add(mesh);
    return mesh;
  };

  add(blouseGeometry(), m.cloth, 'blouse');
  add(neckFrill(), m.cloth, 'neckFrill', OUTLINE.detail);
  group.add(butterflyPrint());
  add(skirtGeometry(), m.black, 'skirt');
  add(petticoatGeometry(), m.cloth, 'petticoat', OUTLINE.detail);
  add(sockGeometry(), m.cloth, 'socks');

  // Body and sleeves are separate meshes so they can be skinned apart (body: torso, sleeves: arms).
  add(mergeAll([jacketBodyGeometry(), jacketEdges()]), m.cloth, 'jacketBody');
  add(mergeAll([cuffRims(), sleeveGeometry(-1), sleeveGeometry(1)]), m.cloth, 'jacketSleeves');
  add(sleeveBands(), m.black, 'jacketBands', OUTLINE.detail);
  return { object: group };
}
