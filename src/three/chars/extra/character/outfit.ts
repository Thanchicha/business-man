import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { torsoCore } from './body/bodyShape';
import { RoundCone, smax, smin, type Sdf } from './body/sdf';
import { meshSdf } from './body/surfaceNets';
import { vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { trace } from './lib/surface';
import { skirtGeometry } from './outfit/skirt';
import type { ExtraLook } from './looks';
import type { Part } from './types';

/** Where the shirt ends, and where trousers and shorts begin and end. */
const SHIRT_BOTTOM = 0.385;
const JACKET_BOTTOM = 0.36;
const WAIST = 0.404;
const SHORTS_HEM = 0.2;
const PANTS_HEM = 0.08;

const smooth = (e0: number, e1: number, x: number) => THREE.MathUtils.smoothstep(x, e0, e1);

const shoulder = { x: 0.08, y: 0.514, z: -0.008 };
const elbow = { x: 0.104, y: 0.437, z: -0.016 };
const wrist = { x: 0.128, y: 0.372, z: -0.002 };

/** Sleeve solid for |x|: short (to above the elbow) or long (to the wrist). */
function sleeveSdf(long: boolean, r: number): Sdf {
  if (long) {
    const upper = new RoundCone(shoulder, elbow, 0.03 + r, 0.029 + r);
    const lower = new RoundCone(elbow, wrist, 0.029 + r, 0.026 + r);
    return (x, y, z) => smin(upper.dist(x, y, z), lower.dist(x, y, z), 0.01);
  }
  const cone = new RoundCone(shoulder, { x: 0.0955, y: 0.468, z: -0.012 }, 0.03 + r, 0.032 + r);
  return (x, y, z) => smax(cone.dist(x, y, z), 0.455 - y, 0.003);
}

/** Shirt / tee / jacket: the torso inflated by the cloth thickness plus sleeves; jackets open down the front. */
function topSdf(look: ExtraLook): Sdf {
  const jacket = look.top === 'jacket';
  const T = jacket ? 0.018 : 0.0075;
  const bottom = jacket ? JACKET_BOTTOM : SHIRT_BOTTOM;
  const sleeve = sleeveSdf(look.long, jacket ? 0.004 : 0);
  return (x, y, z) => {
    const ax = Math.abs(x);
    let body = smax(torsoCore(ax, y, z) - T, bottom - y, 0.004);
    if (jacket) body = smax(body, Math.min(0.012 + 0.05 * smooth(0.4, 0.55, y) - ax, z - 0.02), 0.004);
    return smin(body, sleeve(ax, y, z), 0.006);
  };
}

/** Plain torso layer (the shirt under a jacket, or the surface a tie rests on). */
const shirtCore: Sdf = (x, y, z) => smax(torsoCore(Math.abs(x), y, z) - 0.0075, SHIRT_BOTTOM - y, 0.004);

/** Front bib and skirt of an apron. */
const apronSdf: Sdf = (x, y, z) => {
  const ax = Math.abs(x);
  const half = 0.078 - 0.03 * smooth(0.48, 0.535, y);
  let d = torsoCore(ax, y, z) - 0.024;
  d = smax(d, ax - half, 0.004);
  d = smax(d, -z + 0.004, 0.004);
  return smax(smax(d, y - 0.535, 0.004), 0.3 - y, 0.004);
};

const trouser = (hem: number, bottomR: number) => {
  const cone = new RoundCone({ x: 0.058, y: 0.35, z: 0 }, { x: 0.061, y: hem + 0.01, z: 0.002 }, 0.05, bottomR);
  return (wx: number, y: number, z: number): number => {
    const x = Math.abs(wx);
    const d = smin(torsoCore(x, y, z) - 0.016, cone.dist(x, y, z), 0.03);
    return smax(smax(d, y - WAIST, 0.004), hem - y, 0.004);
  };
};

function bottomSdf(look: ExtraLook): Sdf | null {
  if (look.bottom === 'shorts') return trouser(SHORTS_HEM, 0.051);
  if (look.bottom === 'pants') return trouser(PANTS_HEM, 0.047);
  return null;
}

/** Tie: a thin strip with a knot, resting on the front of the shirt. */
function tieGeometry(): THREE.BufferGeometry {
  const front = trace(shirtCore, vec(0, 0.49, 0.3), vec(0, 0, -1), 0.5) ?? vec(0, 0.49, 0.07);
  const strip = new THREE.BoxGeometry(0.02, 0.09, 0.005).translate(0, 0.49 - 0.012, front.z + 0.003);
  const knot = new THREE.BoxGeometry(0.024, 0.02, 0.008).translate(0, 0.535, front.z + 0.004);
  const tip = new THREE.BoxGeometry(0.026, 0.026, 0.005).rotateZ(Math.PI / 4).translate(0, 0.436, front.z + 0.003);
  return mergeGeoms([strip, knot, tip]);
}

function mergeGeoms(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (const g of gs) {
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...Array.from(n.getAttribute('position').array));
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export function buildOutfit(look: ExtraLook): Part {
  const group = new THREE.Group();
  group.name = 'outfit';
  const m = materials();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, outline: number | false = OUTLINE.cloth) => group.add(toonMesh(geo, mat, { name, outline }));

  if (look.top === 'jacket') add(meshSdf(shirtCore, { min: [-0.15, SHIRT_BOTTOM - 0.01, -0.1], max: [0.15, 0.585, 0.1] }, 0.0034), m.inner, 'shirt');
  add(meshSdf(topSdf(look), { min: [-0.18, JACKET_BOTTOM - 0.01, -0.11], max: [0.18, 0.585, 0.11] }, 0.0034), m.top, 'tee');
  if (look.tie) add(tieGeometry(), m.accent, 'tie', OUTLINE.detail);

  const bottom = bottomSdf(look);
  if (bottom) add(meshSdf(bottom, { min: [-0.14, 0.07, -0.09], max: [0.14, WAIST + 0.01, 0.09] }, 0.0034), m.bottom, 'shorts');
  else add(skirtGeometry(), m.bottom, 'skirt');

  if (look.apron) add(meshSdf(apronSdf, { min: [-0.12, 0.28, -0.02], max: [0.12, 0.55, 0.12] }, 0.003), m.accent, 'apron');
  return { object: group };
}
