import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { blouseGeometry, neckFrill } from './outfit/blouse';
import { jacketBodyGeometry, jacketEdges, sleeveGeometry, sleeveStripes, zippers } from './outfit/jacket';
import { petticoatGeometry, skirtGeometry } from './outfit/skirt';
import { legWarmerGeometry } from './outfit/socks';
import type { Part } from './types';

/**
 * Outfit (sheet details 3 and 5) — white blouse with a small collar frill, black pleated skirt
 * over a black ruffle, an oversized black hooded jacket with white stripes down the sleeves,
 * slouchy black leg warmers.
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

  add(blouseGeometry(), m.cloth, 'blouse');
  add(neckFrill(), m.cloth, 'neckFrill', OUTLINE.detail);
  add(skirtGeometry(), m.black, 'skirt');
  add(petticoatGeometry(), m.dark, 'petticoat', OUTLINE.detail);
  add(legWarmerGeometry(), m.dark, 'legWarmers');

  // Body and sleeves are separate meshes so they can be skinned apart (body: torso, sleeves: arms).
  add(jacketBodyGeometry(), m.dark, 'jacketBody');
  add(mergeAll([jacketEdges(), sleeveGeometry(-1), sleeveGeometry(1)]), m.dark, 'jacketSleeves');
  add(sleeveStripes(), m.cloth, 'sleeveStripes', OUTLINE.tiny);
  add(zippers(), m.metal, 'jacketZippers', OUTLINE.tiny);
  return { object: group };
}
