import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { hitHair } from './hair';
import { bowGeometry } from './lib/bow';
import { glassesGeometry } from './lib/glasses';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { blouseFront } from './outfit/blouse';
import type { Part } from './types';

/**
 * Accessories (sheet details 1–3): thin black square glasses; on her LEFT two white X clips and a
 * white cat-face clip in the hair; on her RIGHT a white ribbon bow on a side lock; a black ribbon
 * bow tie at the blouse collar. Hair pieces are placed on the hair surface.
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

/** X clip: two crossed flat bars (local, facing +Z). */
function xClip(): THREE.BufferGeometry {
  const bar = new THREE.BoxGeometry(0.032, 0.0065, 0.004);
  return mergeAll([bar.clone().rotateZ(Math.PI / 4), bar.clone().rotateZ(-Math.PI / 4)]);
}

/** Cat face clip (local, facing +Z): round head, two pointed ears; black eyes separately. */
function catClip(): { white: THREE.BufferGeometry; black: THREE.BufferGeometry } {
  const head = new THREE.SphereGeometry(0.015, 16, 12).scale(1.1, 0.92, 0.55);
  const ear = new THREE.ConeGeometry(0.0062, 0.011, 10);
  const ears = [-1, 1].map((s) => ear.clone().rotateZ(-s * 0.45).translate(s * 0.0095, 0.0135, 0));
  const eye = new THREE.SphereGeometry(0.002, 8, 6);
  const black = [-1, 1].map((s) => eye.clone().scale(1, 1.3, 0.5).translate(s * 0.0056, 0.001, 0.008));
  return { white: mergeAll([head, ...ears]), black: mergeAll(black) };
}

function hairPieces(): { white: THREE.BufferGeometry[]; black: THREE.BufferGeometry[] } {
  const side = vec(0.4, 0.1, 1).normalize();
  const white: THREE.BufferGeometry[] = [];
  const black: THREE.BufferGeometry[] = [];
  for (const [x, y, rot] of [[0.112, 0.828, 0.1], [0.138, 0.79, -0.15]] as const) {
    const at = onHair(x, y, side, 0.004);
    white.push(orient(xClip().rotateZ(rot), at.p, at.n));
  }
  const cat = onHair(0.152, 0.858, side, 0.006);
  const c = catClip();
  white.push(orient(c.white, cat.p, cat.n));
  black.push(orient(c.black, cat.p, cat.n));
  // White ribbon bow with short tails on her right side lock.
  const bow = onHair(-0.165, 0.665, vec(-0.5, 0, 1).normalize(), 0.008);
  white.push(orient(bowGeometry({ wing: 0.032, wingHeight: 0.028, tail: 0.06, tailWidth: 0.008, thickness: 0.004, tailSpread: 0.006 }), bow.p, bow.n));
  return { white, black };
}

/** Black ribbon bow tie at the blouse collar, tails hanging down the front. */
function bowTie(): THREE.BufferGeometry {
  const p = blouseFront(0, 0.548, 0.008);
  return orient(bowGeometry({ wing: 0.03, wingHeight: 0.026, tail: 0.05, tailWidth: 0.008, thickness: 0.0045, tailSpread: 0.01 }), p, vec(0, 0.1, 1).normalize());
}

export function buildAccessories(): Part {
  const group = new THREE.Group();
  group.name = 'accessories';
  const m = materials();
  const hp = hairPieces();
  group.add(toonMesh(mergeAll(hp.white), m.cloth, { name: 'hairClips', outline: OUTLINE.tiny }));
  group.add(toonMesh(mergeAll(hp.black), m.black, { name: 'hairClipFace', outline: false }));
  group.add(toonMesh(bowTie(), m.black, { name: 'bowTie', outline: OUTLINE.detail }));
  const glasses = glassesGeometry({ eyeX: 0.077, eyeY: 0.67, halfW: 0.05, halfH: 0.039, corner: 0.012 });
  group.add(toonMesh(glasses, m.black, { name: 'glasses', outline: OUTLINE.tiny }));
  return { object: group };
}
