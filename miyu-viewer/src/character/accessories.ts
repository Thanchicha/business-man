import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { hitHair } from './hair';
import { bowGeometry } from './lib/bow';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { extrude } from './lib/shapes';
import type { Part } from './types';

/**
 * Hair accessories (reference/sheet.webp): on her LEFT a pink ribbon bow with tails, a white cat
 * clip and a pink X clip; on her RIGHT a small white cat clip with a little pink bow.
 * Pieces are placed on the hair surface.
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

/** Cat head silhouette (unit width): a round face with two pointed ears. */
function catHeadShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.0);
  s.bezierCurveTo(-0.5, -0.32, -0.26, -0.42, 0, -0.42);
  s.bezierCurveTo(0.26, -0.42, 0.5, -0.32, 0.5, 0.0);
  s.lineTo(0.46, 0.44);
  s.lineTo(0.2, 0.26);
  s.quadraticCurveTo(0, 0.32, -0.2, 0.26);
  s.lineTo(-0.46, 0.44);
  s.closePath();
  return s;
}

/** Small dark eyes + pink nose for a cat clip, laid on its front face. */
function catFace(size: number): { dark: THREE.BufferGeometry[]; pink: THREE.BufferGeometry[] } {
  const eye = new THREE.SphereGeometry(size * 0.06, 8, 6).scale(1, 1.2, 0.5);
  return {
    dark: [eye.clone().translate(-size * 0.2, 0, size * 0.1), eye.clone().translate(size * 0.2, 0, size * 0.1)],
    pink: [new THREE.SphereGeometry(size * 0.05, 8, 6).scale(1.3, 0.8, 0.5).translate(0, -size * 0.12, size * 0.1)],
  };
}

interface Built {
  pink: THREE.BufferGeometry[];
  white: THREE.BufferGeometry[];
  dark: THREE.BufferGeometry[];
}

function catClip(at: Placed, size: number, out: Built): void {
  const head = extrude(catHeadShape(), size * 0.16, size);
  const face = catFace(size);
  out.white.push(orient(head, at.p, at.n));
  out.dark.push(...face.dark.map((g) => orient(g, at.p, at.n)));
  out.pink.push(...face.pink.map((g) => orient(g, at.p, at.n)));
}

/** Her LEFT (+X): ribbon bow with tails, a cat clip at its knot and an X clip above it. */
function leftSide(out: Built): void {
  const side = vec(0.45, 0.05, 1).normalize();
  // The bow sits on the side of the bob, facing out-front, so it clears the cheek locks.
  const bow = onHair(0.17, 0.79, vec(1, 0.05, 0.75).normalize(), 0.024);
  out.pink.push(orient(bowGeometry({ wing: 0.05, wingHeight: 0.042, tail: 0.11, tailWidth: 0.014, thickness: 0.0055, tailSpread: 0.012, sway: 0.14 }), bow.p, bow.n));
  catClip({ p: bow.p.clone().addScaledVector(bow.n, 0.012), n: bow.n }, 0.04, out);
  const x = onHair(0.12, 0.855, side, 0.006);
  const bar = new THREE.BoxGeometry(0.034, 0.0068, 0.004);
  out.pink.push(orient(mergeAll([bar.clone().rotateZ(0.7), bar.clone().rotateZ(-0.7)]), x.p, x.n));
}

/** Her RIGHT (−X): small cat clip with a little bow below it. */
function rightSide(out: Built): void {
  const side = vec(-0.45, 0.05, 1).normalize();
  const clip = onHair(-0.135, 0.845, side, 0.008);
  catClip(clip, 0.034, out);
  const bow = onHair(-0.158, 0.79, side, 0.014);
  out.pink.push(orient(bowGeometry({ wing: 0.03, wingHeight: 0.026, tail: 0.04, tailWidth: 0.009, thickness: 0.0045 }), bow.p, bow.n));
}

export function buildAccessories(): Part {
  const group = new THREE.Group();
  group.name = 'accessories';
  const m = materials();
  const out: Built = { pink: [], white: [], dark: [] };
  leftSide(out);
  rightSide(out);
  group.add(toonMesh(mergeAll(out.pink), m.pink, { name: 'accessoriesPink', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll(out.white), m.cloth, { name: 'accessoriesWhite', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll(out.dark), m.black, { name: 'accessoriesDark', outline: false }));
  return { object: group };
}
