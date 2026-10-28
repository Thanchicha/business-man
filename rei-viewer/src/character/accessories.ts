import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { chain, mergeAll, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { crossShape, extrude } from './lib/shapes';
import { COLLAR_SIZE, shirtFront } from './outfit/turtleneck';
import { RIG } from './rig';
import type { Part } from './types';

/**
 * Accessories (sheet detail 2): a long silver chain necklace worn over the turtleneck collar,
 * hanging in a V down the chest to a silver cross pendant.
 */

const PENDANT_Y = 0.478;

function necklace(): THREE.BufferGeometry {
  const r = COLLAR_SIZE.r + 0.007;
  const pts: THREE.Vector3[] = [];
  // Front V on his right → around the back of the collar → front V on his left.
  for (const y of [PENDANT_Y + 0.014, 0.51, 0.535]) pts.push(shirtFront(-0.006 - (y - PENDANT_Y) * 0.55, y, 0.0025));
  // a = −0.62π … −1.38π sweeps around the back of the collar (cos a < 0).
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.62 - (i / 10) * Math.PI * 0.76;
    pts.push(vec(Math.sin(a) * r, COLLAR_SIZE.bottom + 0.018 + 0.006 * Math.cos(a), RIG.neckZ + Math.cos(a) * r));
  }
  for (const y of [0.535, 0.51, PENDANT_Y + 0.014]) pts.push(shirtFront(0.006 + (y - PENDANT_Y) * 0.55, y, 0.0025));
  return chain(pts, 0.0065, 0.0011);
}

function pendant(): THREE.BufferGeometry {
  const p = shirtFront(0, PENDANT_Y - 0.002, 0.004);
  return extrude(crossShape(0.24), 0.003, 0.026).translate(p.x, p.y - 0.012, p.z);
}

export function buildAccessories(): Part {
  const group = new THREE.Group();
  group.name = 'accessories';
  const m = materials();
  group.add(toonMesh(mergeAll([necklace(), pendant()]), m.metal, { name: 'necklace', outline: OUTLINE.tiny }));
  return { object: group };
}
