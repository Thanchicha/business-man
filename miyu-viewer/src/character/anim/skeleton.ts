import * as THREE from 'three';
import { RIG } from '../rig';
import { TAIL_CURVE } from '../tail';

/**
 * Procedural skeleton for Miyu and automatic skinning of every built part.
 *
 * Every part is modelled in world space at rest, so the skeleton's bones sit at the RIG joints
 * with identity rest rotations. `skinCharacter` re-binds each mesh as a SkinnedMesh whose weights
 * come from distance to the bone "segments" (capsules around the limbs), filtered by per-part
 * rules so hair stays rigid to the head, the skirt and bag only follow the torso, etc.
 */

export type BoneName =
  | 'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'hairL' | 'hairR' | 'hairB' | 'ahoge'
  | 'catTail1' | 'catTail2' | 'catTail3'
  | 'shoulderL' | 'elbowL' | 'wristL' | 'shoulderR' | 'elbowR' | 'wristR'
  | 'thighL' | 'kneeL' | 'ankleL' | 'thighR' | 'kneeR' | 'ankleR';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mirror = (p: THREE.Vector3) => v(-p.x, p.y, p.z);

/** Rest (world) positions of every bone and its parent. */
const LAYOUT: [BoneName, BoneName | null, THREE.Vector3][] = [
  ['root', null, v(0, 0, 0)],
  ['hips', 'root', v(0, 0.36, 0)],
  ['spine', 'hips', v(0, 0.4, 0)],
  ['chest', 'spine', v(0, 0.47, -0.004)],
  ['neck', 'chest', v(0, 0.545, -0.012)],
  ['head', 'neck', v(0, 0.59, -0.012)],
  // Hair sway pivots (high on the head so the lower bob swings) and the ahoge root.
  ['hairL', 'head', v(0.11, 0.75, -0.03)],
  ['hairR', 'head', v(-0.11, 0.75, -0.03)],
  ['hairB', 'head', v(0, 0.75, -0.1)],
  ['ahoge', 'head', v(0, 0.965, -0.01)],
  // Cat tail chain along the tail curve (tail.ts).
  ['catTail1', 'hips', TAIL_CURVE.getPointAt(0)],
  ['catTail2', 'catTail1', TAIL_CURVE.getPointAt(0.34)],
  ['catTail3', 'catTail2', TAIL_CURVE.getPointAt(0.68)],
  ['shoulderL', 'chest', RIG.shoulderL.clone()],
  ['elbowL', 'shoulderL', RIG.elbowL.clone()],
  ['wristL', 'elbowL', RIG.wristL.clone()],
  ['shoulderR', 'chest', RIG.shoulderR.clone()],
  ['elbowR', 'shoulderR', RIG.elbowR.clone()],
  ['wristR', 'elbowR', RIG.wristR.clone()],
  ['thighL', 'hips', RIG.hipJointL.clone()],
  ['kneeL', 'thighL', RIG.kneeL.clone()],
  ['ankleL', 'kneeL', RIG.ankleL.clone()],
  ['thighR', 'hips', RIG.hipJointR.clone()],
  ['kneeR', 'thighR', RIG.kneeR.clone()],
  ['ankleR', 'kneeR', RIG.ankleR.clone()],
];

export class Rig {
  readonly bones = new Map<BoneName, THREE.Bone>();
  readonly skeleton: THREE.Skeleton;
  readonly index = new Map<BoneName, number>();

  constructor() {
    const world = new Map<BoneName, THREE.Vector3>();
    const list: THREE.Bone[] = [];
    for (const [name, parent, p] of LAYOUT) {
      const bone = new THREE.Bone();
      bone.name = name;
      bone.position.copy(parent ? p.clone().sub(world.get(parent)!) : p);
      if (parent) this.bones.get(parent)!.add(bone);
      world.set(name, p);
      this.index.set(name, list.length);
      this.bones.set(name, bone);
      list.push(bone);
    }
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(list);
  }

  get root(): THREE.Bone {
    return this.bones.get('root')!;
  }

  bone(name: BoneName): THREE.Bone {
    return this.bones.get(name)!;
  }
}

// ---------------------------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------------------------

interface Segment {
  bone: BoneName;
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
  group: 'torso' | 'head' | 'arm' | 'leg';
}

const toe = v(RIG.footL.x, 0.04, 0.075);
const SEGMENTS: Segment[] = [
  { bone: 'hips', a: v(0, 0.29, 0), b: v(0, 0.4, 0), r: 0.065, group: 'torso' },
  { bone: 'spine', a: v(0, 0.4, 0), b: v(0, 0.47, -0.004), r: 0.065, group: 'torso' },
  { bone: 'chest', a: v(0, 0.47, -0.004), b: v(0, 0.53, -0.008), r: 0.07, group: 'torso' },
  { bone: 'neck', a: v(0, 0.54, -0.012), b: v(0, 0.59, -0.012), r: 0.028, group: 'head' },
  { bone: 'head', a: v(0, 0.76, -0.01), b: v(0, 0.76, -0.01), r: 0.15, group: 'head' },
  ...([1, -1] as const).flatMap((s): Segment[] => {
    const m = (p: THREE.Vector3) => (s > 0 ? p.clone() : mirror(p));
    const k = s > 0 ? 'L' : 'R';
    return [
      { bone: `shoulder${k}` as BoneName, a: m(RIG.shoulderL), b: m(RIG.elbowL), r: 0.022, group: 'arm' },
      { bone: `elbow${k}` as BoneName, a: m(RIG.elbowL), b: m(RIG.handL), r: 0.017, group: 'arm' },
      { bone: `thigh${k}` as BoneName, a: m(RIG.hipJointL), b: m(RIG.kneeL), r: 0.036, group: 'leg' },
      { bone: `knee${k}` as BoneName, a: m(RIG.kneeL), b: m(RIG.ankleL), r: 0.025, group: 'leg' },
      { bone: `ankle${k}` as BoneName, a: m(RIG.ankleL), b: m(toe), r: 0.03, group: 'leg' },
    ];
  }),
];

const tmp = new THREE.Vector3();
function segmentDistance(p: THREE.Vector3, s: Segment): number {
  const ab = tmp.copy(s.b).sub(s.a);
  const len2 = ab.lengthSq();
  const h = len2 < 1e-10 ? 0 : THREE.MathUtils.clamp(p.clone().sub(s.a).dot(ab) / len2, 0, 1);
  return Math.max(0, p.distanceTo(s.a.clone().addScaledVector(ab, h)) - s.r);
}

type Weights = [BoneName, number][];

/** Automatic weights from the closest segments (inverse distance, 4th power). */
function autoWeights(p: THREE.Vector3, groups: Segment['group'][]): Weights {
  const scored = SEGMENTS.filter((s) => groups.includes(s.group)).map((s) => [s.bone, 1 / (segmentDistance(p, s) + 0.01) ** 4] as [BoneName, number]);
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, 4);
}

const smooth = (e0: number, e1: number, x: number) => THREE.MathUtils.smoothstep(x, e0, e1);

function headWeights(p: THREE.Vector3): Weights {
  const neck = 1 - smooth(0.57, 0.6, p.y);
  return [['head', 1 - neck], ['neck', neck]];
}

/**
 * Bob: rigid to the head on the crown, then the lower hair hangs from the sway bones — her left
 * side on hairL, her right on hairR, the back on hairB (blended by angle around the head).
 */
function bobWeights(p: THREE.Vector3): Weights {
  const free = 1 - smooth(0.66, 0.77, p.y);
  const a = Math.atan2(p.x, p.z + 0.025);
  const wl = Math.max(0, Math.sin(a)) ** 2, wr = Math.max(0, -Math.sin(a)) ** 2, wb = Math.max(0, -Math.cos(a)) ** 2;
  const sum = wl + wr + wb || 1;
  return [['head', 1 - free], ['hairL', (free * wl) / sum], ['hairR', (free * wr) / sum], ['hairB', (free * wb) / sum]];
}

/** Ahoge: the strands above the crown ride on the ahoge bone. */
function ahogeWeights(p: THREE.Vector3): Weights {
  const w = smooth(0.965, 0.985, p.y);
  return [['head', 1 - w], ['ahoge', w]];
}

const TAIL_SAMPLES = TAIL_CURVE.getSpacedPoints(80);

/** Cat tail: blend along the chain by the nearest curve parameter, rigid to the hips at the root. */
function catTailWeights(p: THREE.Vector3): Weights {
  let best = 0, d = Infinity;
  TAIL_SAMPLES.forEach((q, i) => {
    const dq = q.distanceToSquared(p);
    if (dq < d) (d = dq), (best = i);
  });
  const t = best / (TAIL_SAMPLES.length - 1);
  const hips = 1 - smooth(0.0, 0.08, t);
  const w3 = smooth(0.6, 0.78, t);
  const w2 = smooth(0.26, 0.44, t) - w3;
  const w1 = 1 - hips - w2 - w3;
  return [['hips', hips], ['catTail1', Math.max(0, w1)], ['catTail2', Math.max(0, w2)], ['catTail3', w3]];
}

/**
 * 'trunk' = torso + neck only (body clothing that must not follow the arms), 'sleeve' = arm bones
 * only (sleeves rotate with the arm and never pull the jacket body), 'lower' = torso + legs (the
 * hands rest beside the hips, but socks and leg straps must not be dragged up with them).
 */
export type SkinMode = 'auto' | 'upper' | 'trunk' | 'sleeve' | 'lower' | 'torso' | 'head' | 'hair' | 'bob' | 'ahoge' | 'catTail';

function weightsFor(mode: SkinMode, p: THREE.Vector3): Weights {
  switch (mode) {
    case 'head':
      return headWeights(p);
    case 'hair':
      return [['head', 1]];
    case 'bob':
      return bobWeights(p);
    case 'ahoge':
      return ahogeWeights(p);
    case 'catTail':
      return catTailWeights(p);
    case 'torso':
      return autoWeights(p, ['torso']);
    case 'trunk':
      return autoWeights(p, ['torso', 'head']);
    case 'sleeve':
      return autoWeights(p, ['arm']);
    case 'lower':
      return autoWeights(p, ['torso', 'leg']);
    case 'upper':
      return autoWeights(p, ['torso', 'head', 'arm']);
    default:
      return autoWeights(p, ['torso', 'head', 'arm', 'leg']);
  }
}

/** Per-part skinning rules by mesh name (anything unlisted uses full automatic weights). */
const MODES: Record<string, SkinMode> = {
  head: 'head',
  faceDecal: 'head',
  hairCap: 'hair',
  hairLocks: 'hair',
  hairBob: 'bob',
  hairAhoge: 'ahoge',
  catEars: 'hair',
  catEarInner: 'hair',
  accessoriesPink: 'bob',
  accessoriesWhite: 'hair',
  accessoriesDark: 'hair',
  skirt: 'torso',
  skirtStripes: 'torso',
  petticoat: 'torso',
  belt: 'torso',
  beltBuckle: 'torso',
  backBow: 'torso',
  catTail: 'catTail',
  tailBow: 'catTail',
  blouse: 'trunk',
  neckFrill: 'trunk',
  sailorCollar: 'trunk',
  collarTrim: 'trunk',
  neckBow: 'trunk',
  sleeves: 'sleeve',
  cuffRims: 'sleeve',
  cuffBands: 'sleeve',
  cuffBows: 'sleeve',
  socks: 'lower',
  sockTrims: 'lower',
};

function skinAttributes(geo: THREE.BufferGeometry, mode: SkinMode, rig: Rig): void {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const idx = new Uint16Array(n * 4);
  const wts = new Float32Array(n * 4);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    const w = weightsFor(mode, p).filter(([, x]) => x > 1e-4);
    const sum = w.reduce((s, [, x]) => s + x, 0) || 1;
    w.forEach(([bone, x], k) => {
      idx[i * 4 + k] = rig.index.get(bone)!;
      wts[i * 4 + k] = x / sum;
    });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
}

/**
 * Replaces every mesh under `root` with a SkinnedMesh bound to `rig` (geometry baked into root
 * space), keeping materials, render order and outline hulls. Skinned meshes are collected in a
 * 'skinned' group under `root`; the rig's root bone is added to `root` too.
 */
export function skinCharacter(root: THREE.Object3D, rig: Rig): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) meshes.push(o as THREE.Mesh);
  });

  const container = new THREE.Group();
  container.name = 'skinned';
  const identity = new THREE.Matrix4();
  for (const mesh of meshes) {
    const geo = mesh.geometry.clone().applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld));
    skinAttributes(geo, MODES[mesh.name] ?? 'auto', rig);
    const skinned = new THREE.SkinnedMesh(geo, mesh.material);
    skinned.name = mesh.name;
    skinned.renderOrder = mesh.renderOrder;
    skinned.frustumCulled = false;
    skinned.bind(rig.skeleton, identity);
    const hull = mesh.children.find((c) => c.userData.isOutline) as THREE.Mesh | undefined;
    if (hull) {
      const outline = new THREE.SkinnedMesh(geo, hull.material);
      outline.name = hull.name;
      outline.userData.isOutline = true;
      outline.renderOrder = hull.renderOrder;
      outline.frustumCulled = false;
      outline.bind(rig.skeleton, identity);
      skinned.add(outline);
    }
    mesh.parent?.remove(mesh);
    container.add(skinned);
  }
  root.add(rig.root, container);
}
