import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { jacketBodyGeometry, jacketEdges, jacketStraps, sleeveBands, sleeveGeometry, zippers } from './outfit/jacket';
import { pantsGeometry, pantsStraps, pockets } from './outfit/pants';
import { turtleneckGeometry } from './outfit/turtleneck';
import type { Part } from './types';

/** Outfit — black turtleneck, white cargo pants, oversized white hooded jacket (sheet details). */
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
  add(pantsGeometry(), m.cloth, 'pants');
  const pk = pockets();
  add(pk.white, m.cloth, 'pantsPockets', OUTLINE.detail);
  const ps = pantsStraps();
  add(mergeAll([pk.black, ps.black]), m.leather, 'pantsStraps', OUTLINE.detail);
  add(ps.metal, m.metal, 'pantsMetal', OUTLINE.tiny);

  // Body and sleeves are separate meshes so they can be skinned apart (body: torso, sleeves: arms).
  add(jacketBodyGeometry(), m.cloth, 'jacketBody');
  add(mergeAll([jacketEdges(), sleeveGeometry(-1), sleeveGeometry(1)]), m.cloth, 'jacketSleeves');
  add(sleeveBands(), m.black, 'jacketBands', OUTLINE.detail);
  const js = jacketStraps();
  add(js.black, m.leather, 'jacketStraps', OUTLINE.detail);
  add(js.metal, m.metal, 'jacketMetal', OUTLINE.tiny);
  add(zippers(), m.metal, 'jacketZippers', OUTLINE.tiny);
  return { object: group };
}
