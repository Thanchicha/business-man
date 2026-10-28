import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { sdEllipsoid, smax, smin } from './body/sdf';
import { meshSdf, type MeshBounds } from './body/surfaceNets';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { bowGeometry } from './lib/bow';
import { extrude, heartShape } from './lib/shapes';
import { RIG } from './rig';
import type { Part } from './types';

/**
 * Fluffy white platform boots (reference/sheet.webp): thick pink sole, rounded toe box with a
 * pink heart, a mid-calf shaft laced up the front with pink ribbon, a small bow at the top, a
 * heart on the outer side and a bumpy fluffy cuff. Shapes are SDFs in boot-local space (x = |x|).
 */

const BX = RIG.ankleL.x + 0.002; // boot center |x|
const SOLE_H = RIG.soleTopY + 0.001;
const TOP = RIG.bootTopY + 0.004;
const SHAFT_R = 0.044;
const SHAFT_Z = -0.008;

/** 2D rounded rectangle distance. */
function roundRect(x: number, z: number, hx: number, hz: number, r: number): number {
  const qx = Math.abs(x) - hx + r, qz = Math.abs(z) - hz + r;
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - r;
}

function sole(x: number, y: number, z: number): number {
  // Footprint: wider rounded toe, narrower heel.
  const zc = 0.018, hz = 0.088;
  const widen = 0.006 * Math.max(0, (z - zc) / hz);
  const d2 = roundRect(x, z - zc, 0.047 + widen, hz, 0.036);
  const dy = Math.abs(y - SOLE_H / 2) - SOLE_H / 2;
  let d = Math.min(Math.max(d2, dy), 0) + Math.hypot(Math.max(d2, 0), Math.max(dy, 0));
  d -= 0.002;
  // Lugs: chunky bumps along the bottom edge.
  if (y < 0.014) d -= 0.0028 * Math.max(0, Math.sin(z * 150)) * Math.max(0, 1 - y / 0.014);
  return d;
}

function upper(x: number, y: number, z: number): number {
  const toe = sdEllipsoid(x, y - (SOLE_H + 0.012), z - 0.058, 0.044, 0.03, 0.05);
  const vamp = sdEllipsoid(x, y - (SOLE_H + 0.03), z - 0.012, 0.045, 0.04, 0.06);
  const heel = sdEllipsoid(x, y - (SOLE_H + 0.03), z + 0.035, 0.044, 0.045, 0.042);
  // Shaft: soft cylinder, a little wider at the top.
  const r = SHAFT_R + 0.004 * Math.max(0, (y - 0.12) / 0.06);
  const shaft = smax(Math.hypot(x, z - SHAFT_Z) - r, Math.abs(y - (TOP + 0.04) / 2) - (TOP - 0.04) / 2, 0.012);
  let d = smin(toe, vamp, 0.02);
  d = smin(d, heel, 0.02);
  d = smin(d, shaft, 0.025);
  // Padded collar rolled around the top of the shaft.
  const collarR = SHAFT_R + 0.004 * Math.max(0, (TOP - 0.12) / 0.06) + 0.001;
  const collar = Math.hypot(Math.hypot(x, z - SHAFT_Z) - collarR, y - (TOP - 0.005)) - 0.0062;
  return smin(d, collar, 0.006);
}

/** Boot solid; x is |x - BX| in boot-local space. */
function bootLocal(x: number, y: number, z: number): number {
  return smin(sole(x, y, z), upper(x, y, z), 0.006);
}

const local = (fn: (x: number, y: number, z: number) => number) => (wx: number, y: number, z: number) => fn(Math.abs(Math.abs(wx) - BX), y, z);

/** World-space boot SDF (both boots). */
export const bootSdf = local(bootLocal);

/** Pink sole: a thin skin over the whole platform sole. */
const soleSdf = local((x, y, z) => smax(sole(x, y, z) - 0.0014, y - (SOLE_H + 0.0015), 0.002));

/** Fluffy white cuff rolled around the top of the shaft (bumpy ring). */
const fluffSdf = local((x, y, z) => {
  const r = SHAFT_R + 0.004 * Math.max(0, (TOP - 0.12) / 0.06) + 0.006;
  const a = Math.atan2(x, z - SHAFT_Z);
  const bumps = 0.0024 * Math.sin(a * 9) + 0.0014 * Math.sin(y * 420);
  return Math.hypot(Math.hypot(x, z - SHAFT_Z) - r, (y - (TOP - 0.006)) * 0.85) - 0.011 - bumps;
});

const BOUNDS: MeshBounds = { min: [-0.13, -0.005, -0.085], max: [0.13, TOP + 0.03, 0.125] };

/** Lace crossings up the front of the shaft, a small bow on top, hearts on the toe and outer side. */
function laces(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bar = new THREE.BoxGeometry(0.03, 0.0055, 0.004);
  const heart = extrude(heartShape(), 0.005, 0.024);
  for (const s of [-1, 1]) {
    for (const y of [0.088, 0.112, 0.136]) {
      const r = SHAFT_R + 0.004 * Math.max(0, (y - 0.12) / 0.06) + 0.002;
      const p = vec(s * BX, y, SHAFT_Z + r);
      parts.push(mergeAll([bar.clone().rotateZ(0.55), bar.clone().rotateZ(-0.55)]).translate(p.x, p.y, p.z));
    }
    const top = vec(s * BX, 0.158, SHAFT_Z + SHAFT_R + 0.004);
    parts.push(orient(bowGeometry({ wing: 0.018, wingHeight: 0.015, tail: 0.016, tailWidth: 0.006, thickness: 0.0035 }), top, vec(0, 0, 1)));
    parts.push(heart.clone().rotateX(-0.5).translate(s * BX, SOLE_H + 0.032, 0.088));
    parts.push(orient(heart, vec(s * (BX + SHAFT_R + 0.002), 0.12, SHAFT_Z), vec(s, 0, 0)));
  }
  return mergeAll(parts);
}

export function buildBoots(): Part {
  const group = new THREE.Group();
  group.name = 'boots';
  const m = materials();
  group.add(toonMesh(meshSdf(bootSdf, BOUNDS, 0.0026), m.cloth, { name: 'boots', outline: OUTLINE.cloth }));
  group.add(toonMesh(meshSdf(soleSdf, BOUNDS, 0.0024), m.pink, { name: 'bootSoles', outline: OUTLINE.detail }));
  group.add(toonMesh(meshSdf(fluffSdf, BOUNDS, 0.0024), m.cloth, { name: 'bootFluff', outline: OUTLINE.detail }));
  group.add(toonMesh(laces(), m.pink, { name: 'bootLaces', outline: OUTLINE.tiny }));
  return { object: group };
}
