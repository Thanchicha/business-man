import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh } from '../render/toon';
import { chain, mergeAll, sweep, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { buckleShape, butterflySmooth, extrude } from './lib/shapes';
import { trace } from './lib/surface';
import { blouseSdf } from './outfit/blouse';
import { jacketBodyGeometry, jacketEdges } from './outfit/jacket';
import type { Part } from './types';

/**
 * Bag (reference/twintail.png, back view): small black boxy bag centered on her back — flap with
 * two square buckles, a silver tongue down to a white turn-lock plate, and a keychain with a
 * white butterfly charm on one corner. Two short straps hang it
 * from the back suspenders and silver chains drape from its sides toward the hips.
 * Built in bag-local space (front = +Z) and placed facing straight back.
 */

const W = 0.114, H = 0.078, D = 0.044;
const BAG_Y = 0.414;

const backRay = new THREE.Raycaster();
/** z of the outermost back surface (jacket or blouse) at (x, y), looking from behind. */
function backZ(x: number, y: number, jacket: THREE.Mesh): number {
  backRay.set(vec(x, y, -1), vec(0, 0, 1));
  const hit = backRay.intersectObject(jacket, false)[0];
  const blouse = trace(blouseSdf, vec(x, y, -0.5), vec(0, 0, 1), 0.6);
  return Math.min(hit ? hit.point.z : 0, blouse ? blouse.z : 0);
}

const rounded = (w: number, h: number, d: number, r: number) => {
  const g = new RoundedBoxGeometry(w, h, d, 3, r);
  g.deleteAttribute('uv');
  return g;
};

/** Rounded shield for the flap's turn-lock plate, with a keyhole (unit size, centered). */
function lockPlateShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.1);
  s.lineTo(-0.5, 0.42);
  s.quadraticCurveTo(-0.5, 0.5, -0.4, 0.5);
  s.lineTo(0.4, 0.5);
  s.quadraticCurveTo(0.5, 0.5, 0.5, 0.42);
  s.lineTo(0.5, 0.1);
  s.bezierCurveTo(0.52, -0.32, 0.3, -0.5, 0, -0.5);
  s.bezierCurveTo(-0.3, -0.5, -0.52, -0.32, -0.5, 0.1);
  // Keyhole slot.
  const hole = new THREE.Path();
  hole.absellipse(0, -0.05, 0.1, 0.2, 0, Math.PI * 2, false);
  s.holes.push(hole);
  return s;
}

export function buildBag(): Part {
  const group = new THREE.Group();
  group.name = 'bag';
  const m = materials();
  const bag = new THREE.Group();

  const front = D / 2 + 0.006;
  const body = rounded(W, H, D, 0.011);
  const flap = rounded(W + 0.005, H * 0.56, 0.007, 0.004).translate(0, H * 0.22, D / 2 + 0.002);
  const black: THREE.BufferGeometry[] = [body, flap];
  const metal: THREE.BufferGeometry[] = [];
  // Square buckles high on the flap, where the hanging straps attach.
  const buckle = extrude(buckleShape(0.016, 0.013, 0.003), 0.0025);
  for (const x of [-0.03, 0.03]) metal.push(buckle.clone().translate(x, H * 0.3, front));
  // Turn-lock: a short silver tongue from the flap edge down to a white lock plate.
  metal.push(new THREE.BoxGeometry(0.008, 0.016, 0.003).translate(0, -H * 0.04, front + 0.001));
  const plate = extrude(lockPlateShape(), 0.004, 0.028).translate(0, -H * 0.2, front + 0.001);
  // Keychain ring on her-right side with a short chain and a white butterfly charm.
  const ringPos = vec(W / 2 + 0.002, H * 0.02, 0.012);
  metal.push(new THREE.TorusGeometry(0.0065, 0.0014, 6, 16).rotateY(Math.PI / 2).translate(ringPos.x, ringPos.y, ringPos.z));
  const flyPos = vec(W / 2 - 0.008, -H * 0.3, front + 0.004);
  metal.push(chain([ringPos.clone().add(vec(0, -0.006, 0.002)), flyPos.clone().add(vec(0.004, 0.012, -0.002))], 0.006, 0.0012));
  const fly = extrude(butterflySmooth(), 0.004, 0.032).rotateZ(-0.35).translate(flyPos.x, flyPos.y, flyPos.z);

  bag.add(toonMesh(mergeAll(black), m.leather, { name: 'bagBody', outline: OUTLINE.detail }));
  bag.add(toonMesh(mergeAll(metal), m.metal, { name: 'bagMetal', outline: OUTLINE.tiny }));
  bag.add(toonMesh(mergeAll([fly, plate]), m.cloth, { name: 'bagButterfly', outline: OUTLINE.tiny }));
  const jacket = new THREE.Mesh(mergeAll([jacketBodyGeometry(), jacketEdges()]));
  jacket.updateMatrixWorld(true);
  const surfaceZ = Math.min(backZ(0, BAG_Y + H / 2, jacket), backZ(0, BAG_Y - H / 2, jacket), backZ(0, BAG_Y, jacket));
  bag.position.set(0, BAG_Y, surfaceZ - D / 2 - 0.004);
  bag.rotation.set(-0.05, Math.PI, 0, 'YXZ');
  group.add(bag);
  bag.updateMatrixWorld(true);

  // Straps: from the bag's top corners up the back, joining the suspenders below the shoulders.
  const straps: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const top = vec(s * (W / 2 - 0.018), H / 2 - 0.004, 0).applyMatrix4(bag.matrixWorld);
    const pts = [top];
    for (const y of [top.y + 0.012, 0.468, 0.482, 0.5, 0.53]) {
      const x = Math.sign(top.x) * THREE.MathUtils.lerp(Math.abs(top.x), 0.046, (y - top.y) / (0.53 - top.y));
      pts.push(vec(x, y, backZ(x, y, jacket) - 0.004));
    }
    straps.push(sweep(pts, { width: () => 0.0125, thickness: () => 0.0026, normalRef: () => vec(0, 0, -1), squareness: 6, segments: 24, radial: 10 }));
  }
  group.add(toonMesh(mergeAll(straps), m.leather, { name: 'bagStraps', outline: OUTLINE.detail }));

  // Silver chains draping from the bag's sides across the back toward each hip.
  const chains: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const start = vec(s * (W / 2 + 0.002), H * 0.12, 0).applyMatrix4(bag.matrixWorld);
    const pts = [start];
    for (const [x, y] of [[0.095, 0.4], [0.13, 0.385], [0.168, 0.378]]) pts.push(vec(s * x, y, backZ(s * x, y, jacket) - 0.006));
    chains.push(chain(pts, 0.0095, 0.0017));
  }
  group.add(toonMesh(mergeAll(chains), m.metal, { name: 'bagChains', outline: OUTLINE.tiny }));
  return { object: group };
}
