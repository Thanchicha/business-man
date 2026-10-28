import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh } from '../render/toon';
import { chain, mergeAll, orient, sweep, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { buckleShape, extrude } from './lib/shapes';
import { normalAt, trace } from './lib/surface';
import { jacketSurfaceSdf, onJacket } from './outfit/jacket';
import type { Part } from './types';

/**
 * Backpack (sheet detail 4): a black boxy backpack worn over her long hair, with a front pocket,
 * buckled flap straps and a little white cat keychain on the side. Two shoulder straps run over the
 * shoulders and down the jacket front with silver buckles.
 * Built in bag-local space (front = +Z) and placed facing straight back.
 */

const W = 0.12, H = 0.13, D = 0.052;
const BAG_Y = 0.418;

const rounded = (w: number, h: number, d: number, r: number) => {
  const g = new RoundedBoxGeometry(w, h, d, 3, r);
  g.deleteAttribute('uv');
  return g;
};

/** z of the jacket's back surface at (x, y), looking from behind. */
function backZ(x: number, y: number): number {
  return trace(jacketSurfaceSdf, vec(x, y, -0.5), vec(0, 0, 1), 0.6)?.z ?? -0.1;
}

/** Cat face keychain charm (local space, facing +Z): round head and two pointed ears. */
function catCharm(): { white: THREE.BufferGeometry; black: THREE.BufferGeometry } {
  const head = new THREE.SphereGeometry(0.013, 16, 12).scale(1.1, 0.95, 0.75);
  const ear = new THREE.ConeGeometry(0.0055, 0.01, 10);
  const ears = [-1, 1].map((s) => ear.clone().rotateZ(-s * 0.45).translate(s * 0.0085, 0.0125, 0));
  const eye = new THREE.SphereGeometry(0.0018, 8, 6);
  const black = [-1, 1].map((s) => eye.clone().scale(1, 1.3, 0.5).translate(s * 0.005, 0.001, 0.0098));
  const nose = new THREE.SphereGeometry(0.0012, 8, 6).scale(1.3, 0.8, 0.5).translate(0, -0.003, 0.0102);
  return { white: mergeAll([head, ...ears]), black: mergeAll([...black, nose]) };
}

export function buildBag(): Part {
  const group = new THREE.Group();
  group.name = 'bag';
  const m = materials();
  const bag = new THREE.Group();

  const front = D / 2 + 0.006;
  const body = rounded(W, H, D, 0.016);
  const flap = rounded(W + 0.004, H * 0.34, 0.008, 0.005).translate(0, H * 0.34, D / 2 + 0.001);
  const pocket = rounded(W * 0.72, H * 0.4, 0.018, 0.007).translate(0, -H * 0.18, D / 2 + 0.006);
  const black: THREE.BufferGeometry[] = [body, flap, pocket];
  const metal: THREE.BufferGeometry[] = [];
  // Two vertical flap straps with square buckles.
  const buckle = extrude(buckleShape(0.015, 0.012, 0.003), 0.0025);
  for (const x of [-0.034, 0.034]) {
    black.push(new THREE.BoxGeometry(0.011, H * 0.5, 0.004).translate(x, H * 0.12, front + 0.01));
    metal.push(buckle.clone().translate(x, H * 0.02, front + 0.013));
  }
  // Keychain ring on the side with a short chain and the cat charm.
  const ringPos = vec(W / 2 + 0.003, H * 0.22, 0.012);
  metal.push(new THREE.TorusGeometry(0.0065, 0.0014, 6, 16).rotateY(Math.PI / 2).translate(ringPos.x, ringPos.y, ringPos.z));
  const charmPos = vec(W / 2 + 0.01, -H * 0.12, 0.014);
  metal.push(chain([ringPos.clone().add(vec(0, -0.006, 0)), charmPos.clone().add(vec(0, 0.02, 0))], 0.006, 0.0012));
  const cat = catCharm();
  // Charm faces sideways (outward) so it reads in the side and 3/4 views.
  const catWhite = cat.white.clone().rotateY(Math.PI / 2).translate(charmPos.x, charmPos.y, charmPos.z);
  const catBlack = cat.black.clone().rotateY(Math.PI / 2).translate(charmPos.x, charmPos.y, charmPos.z);

  bag.add(toonMesh(mergeAll(black), m.leather, { name: 'bagBody', outline: OUTLINE.detail }));
  bag.add(toonMesh(mergeAll(metal), m.metal, { name: 'bagMetal', outline: OUTLINE.tiny }));
  bag.add(toonMesh(catWhite, m.cloth, { name: 'bagCharm', outline: OUTLINE.tiny }));
  bag.add(toonMesh(catBlack, m.black, { name: 'bagCharmFace', outline: false }));
  // Kira's bag sits over her long hair (pressed into the curtain, whose back is at z ≈ −0.215).
  const surfaceZ = Math.min(backZ(0, BAG_Y + H / 2 - 0.01), backZ(0, BAG_Y - H / 2), backZ(0, BAG_Y), -0.2);
  bag.position.set(0, BAG_Y, surfaceZ - D / 2 - 0.003);
  // Facing back; the charm side ends up on her left (+X) after the half turn.
  bag.rotation.set(-0.06, Math.PI, 0, 'YXZ');
  group.add(bag);
  bag.updateMatrixWorld(true);

  // Shoulder straps: bag top → up the back → over the shoulder → down the jacket front.
  const straps: THREE.BufferGeometry[] = [];
  const strapMetal: THREE.BufferGeometry[] = [];
  const strapBuckle = extrude(buckleShape(0.02, 0.016, 0.0036), 0.003);
  for (const s of [-1, 1]) {
    const top = vec(s * (W / 2 - 0.02), H / 2 - 0.006, -D / 2 + 0.004).applyMatrix4(bag.matrixWorld);
    const pts = [top];
    for (const [x, y] of [[0.05, 0.5], [0.058, 0.54]]) pts.push(onJacket(vec(s * x, y, -0.4), vec(s * x, y, 0), 0.004));
    pts.push(onJacket(vec(s * 0.066, 0.75, -0.01), vec(s * 0.066, 0.5, -0.01), 0.004));
    for (const [x, y] of [[0.066, 0.53], [0.068, 0.49], [0.072, 0.45], [0.082, 0.41]]) pts.push(onJacket(vec(s * x, y, 0.4), vec(s * x, y, 0), 0.004));
    straps.push(sweep(pts, { width: () => 0.015, thickness: () => 0.003, normalRef: (p) => normalAt(jacketSurfaceSdf, p), squareness: 6, segments: 64, radial: 10 }));
    const b = onJacket(vec(s * 0.068, 0.49, 0.4), vec(s * 0.068, 0.49, 0), 0.0065);
    strapMetal.push(orient(strapBuckle, b, normalAt(jacketSurfaceSdf, b)));
  }
  group.add(toonMesh(mergeAll(straps), m.leather, { name: 'bagStraps', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll(strapMetal), m.metal, { name: 'bagStrapMetal', outline: OUTLINE.tiny }));
  return { object: group };
}
