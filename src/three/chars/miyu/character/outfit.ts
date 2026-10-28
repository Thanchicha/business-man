import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { blouseGeometry, neckFrill } from './outfit/blouse';
import { cuffRims, sleeveGeometry } from './outfit/jacket';
import { collarTrim, neckBow, sailorCollar } from './outfit/sailor';
import { petticoatGeometry, skirtGeometry } from './outfit/skirt';
import { sockGeometry } from './outfit/socks';
import { backBow, belt, cuffTrims, heartBuckle, skirtStripes, sockTrims } from './outfit/trims';
import type { Part } from './types';

/**
 * Outfit — white blouse with a sailor collar and pink neck bow, puffy sleeves gathered at the wrist
 * into a frill with pink bands + bows,
 * pink striped pleated skirt over a white frill, heart belt + big back bow, white socks with pink
 * ribbon tops.
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
  add(sailorCollar(), m.cloth, 'sailorCollar', OUTLINE.detail);
  add(mergeAll(collarTrim()), m.pink, 'collarTrim', false);
  add(neckBow(), m.pink, 'neckBow', OUTLINE.detail);

  add(skirtGeometry(), m.pink, 'skirt');
  add(skirtStripes(), m.pinkLight, 'skirtStripes', false);
  add(petticoatGeometry(), m.cloth, 'petticoat', OUTLINE.detail);
  add(belt(), m.pink, 'belt', OUTLINE.detail);
  add(heartBuckle(), m.cloth, 'beltBuckle', OUTLINE.tiny);
  add(backBow(), m.pink, 'backBow', OUTLINE.detail);
  add(sockGeometry(), m.cloth, 'socks');
  add(sockTrims(), m.pink, 'sockTrims', OUTLINE.tiny);

  add(mergeAll([sleeveGeometry(-1), sleeveGeometry(1)]), m.cloth, 'sleeves');
  add(cuffRims(), m.pinkLight, 'cuffRims', OUTLINE.detail);
  const cuffs = cuffTrims();
  add(cuffs.bands, m.pink, 'cuffBands', OUTLINE.detail);
  add(cuffs.bows, m.pink, 'cuffBows', OUTLINE.tiny);
  return { object: group };
}
