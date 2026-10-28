import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { hitHair } from './hair';
import { bowGeometry } from './lib/bow';
import { chain, mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { band, butterflySmooth, crossShape, extrude } from './lib/shapes';
import { RIG } from './rig';
import type { Part } from './types';

/**
 * Accessories (SPEC §4): studded choker with O-ring and cross pendant; on her RIGHT a black ribbon
 * bow with long tails on the twin tail; on her LEFT a hairpin with a butterfly and a small bow.
 * Hair pieces are placed on the hair surface.
 */

interface Placed {
  p: THREE.Vector3;
  n: THREE.Vector3;
}

/** Surface point + normal on the hair, looking from the front-ish direction `from`. */
function onHair(x: number, y: number, from = vec(0, 0, 1), lift = 0.004): Placed {
  const origin = vec(x, y, 0).addScaledVector(from, 0.6);
  const hit = hitHair(origin, from.clone().negate());
  if (!hit) return { p: vec(x, y, 0.12), n: from.clone() };
  const n = hit.face ? hit.face.normal.clone() : from.clone();
  if (n.dot(from) < 0) n.negate();
  n.lerp(from, 0.85).normalize();
  return { p: hit.point.clone().addScaledVector(n, lift), n };
}

function choker(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const y = RIG.neckY, r = RIG.neckRadius + 0.004, z = RIG.neckZ;
  const black = [band(vec(0, y, z), r, r * 1.03, 0.012, 0.004)];
  const metal: THREE.BufferGeometry[] = [];
  const stud = new THREE.SphereGeometry(0.0021, 8, 6);
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    const a = i * 0.3;
    metal.push(stud.clone().translate(Math.sin(a) * (r + 0.0025), y, z + Math.cos(a) * (r * 1.03 + 0.0025)));
  }
  const front = vec(0, y - 0.008, z + r * 1.03 + 0.004);
  metal.push(new THREE.TorusGeometry(0.0058, 0.0015, 6, 18).translate(front.x, front.y, front.z));
  metal.push(chain([front.clone().add(vec(0, -0.005, 0.001)), front.clone().add(vec(0.001, -0.016, 0.004))], 0.005, 0.0009));
  metal.push(extrude(crossShape(0.26), 0.0025, 0.017).translate(front.x + 0.001, front.y - 0.025, front.z + 0.005));
  return { black, metal };
}

/** Her RIGHT side (−X): black ribbon bow with two long tails on the twin tail's tie. */
function tailBow(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const at = onHair(-0.232, 0.78, vec(-0.35, 0, 1).normalize(), 0.03);
  const bow = bowGeometry({ wing: 0.048, wingHeight: 0.044, tail: 0.13, tailWidth: 0.012, thickness: 0.0055, tailSpread: 0.008, sway: 0.12 });
  return { black: [orient(bow, at.p, at.n)], metal: [] };
}

/** Her LEFT side (+X): slanted black hairpin with a butterfly on its end, a small bow below. */
function leftClips(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const side = vec(0.35, 0, 1).normalize();
  const pin = onHair(0.135, 0.818, side, 0.007);
  const tilt = 0.38;
  const bar = new THREE.BoxGeometry(0.066, 0.0075, 0.004).rotateZ(tilt);
  const fly = extrude(butterflySmooth(), 0.005, 0.038).translate(Math.cos(tilt) * 0.04, Math.sin(tilt) * 0.04, 0.002);
  const bow = onHair(0.158, 0.778, side, 0.03);
  return {
    black: [
      orient(mergeAll([bar, fly]), pin.p, pin.n),
      orient(bowGeometry({ wing: 0.048, wingHeight: 0.04, tail: 0, thickness: 0.0055 }), bow.p, bow.n),
    ],
    metal: [],
  };
}

export function buildAccessories(): Part {
  const group = new THREE.Group();
  group.name = 'accessories';
  const m = materials();
  const parts = [choker(), tailBow(), leftClips()];
  group.add(toonMesh(mergeAll(parts.flatMap((p) => p.black)), m.black, { name: 'accessoriesBlack', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll(parts.flatMap((p) => p.metal)), m.metal, { name: 'accessoriesMetal', outline: OUTLINE.tiny }));
  return { object: group };
}
