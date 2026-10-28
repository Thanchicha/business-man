import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { sdEllipsoid, smax, smin } from './body/sdf';
import { meshSdf, type MeshBounds } from './body/surfaceNets';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { normalAt, trace } from './lib/surface';
import { RIG } from './rig';
import type { Part } from './types';

/**
 * Chunky white high-top sneakers (sheet detail 4): the same thick lug sole as the cast's boots
 * with a black tread band, a rounded white toe box, black side panels sweeping back to the
 * heel, a black padded collar and black laces. The pant hems bunch over the ankles.
 * Shapes are SDFs in shoe-local space (x = |x|).
 */

const BX = RIG.ankleL.x + 0.002; // shoe center |x|
const SOLE_H = RIG.soleTopY + 0.001;
const TOP = 0.095;
const SHAFT_R = 0.043;
const SHAFT_Z = -0.008;

/** 2D rounded rectangle distance. */
function roundRect(x: number, z: number, hx: number, hz: number, r: number): number {
  const qx = Math.abs(x) - hx + r, qz = Math.abs(z) - hz + r;
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - r;
}

function sole(x: number, y: number, z: number): number {
  // Footprint: wider rounded toe, narrower heel.
  const zc = 0.018, hz = 0.09;
  const widen = 0.006 * Math.max(0, (z - zc) / hz);
  const d2 = roundRect(x, z - zc, 0.048 + widen, hz, 0.036);
  const dy = Math.abs(y - SOLE_H / 2) - SOLE_H / 2;
  let d = Math.min(Math.max(d2, dy), 0) + Math.hypot(Math.max(d2, 0), Math.max(dy, 0));
  d -= 0.002;
  // Lugs: chunky bumps along the bottom edge.
  if (y < 0.014) d -= 0.0028 * Math.max(0, Math.sin(z * 150)) * Math.max(0, 1 - y / 0.014);
  return d;
}

function upper(x: number, y: number, z: number): number {
  const toe = sdEllipsoid(x, y - (SOLE_H + 0.012), z - 0.06, 0.045, 0.028, 0.05);
  const vamp = sdEllipsoid(x, y - (SOLE_H + 0.026), z - 0.014, 0.045, 0.04, 0.062);
  const heel = sdEllipsoid(x, y - (SOLE_H + 0.03), z + 0.035, 0.044, 0.045, 0.042);
  const shaft = smax(Math.hypot(x, z - SHAFT_Z) - SHAFT_R, Math.abs(y - (TOP + 0.04) / 2) - (TOP - 0.04) / 2, 0.012);
  let d = smin(toe, vamp, 0.02);
  d = smin(d, heel, 0.02);
  return smin(d, shaft, 0.025);
}

/** Padded collar rolled around the top of the shaft. */
function collar(x: number, y: number, z: number): number {
  return Math.hypot(Math.hypot(x, z - SHAFT_Z) - SHAFT_R - 0.001, y - (TOP - 0.006)) - 0.006;
}

/** Shoe solid; x is |x - BX| in shoe-local space. */
function shoeLocal(x: number, y: number, z: number): number {
  return smin(sole(x, y, z), upper(x, y, z), 0.006);
}

const local = (fn: (x: number, y: number, z: number) => number) => (wx: number, y: number, z: number) => fn(Math.abs(Math.abs(wx) - BX), y, z);

/** World-space shoe SDF (both shoes). */
export const bootSdf = local(shoeLocal);

/**
 * Black side panel: a thin skin over the upper in a band that sweeps up from the toe toward the
 * heel, on both sides of the shoe (leaves the toe box and the front of the vamp white).
 */
const panelSdf = local((x, y, z) => {
  const d = upper(x, y, z) - 0.0015;
  const mid = SOLE_H + 0.018 + 0.28 * Math.max(0, 0.03 - z);
  const stripe = Math.abs(y - mid) - 0.011;
  const span = Math.max(z - 0.045, -0.06 - z);
  const sides = 0.022 - x;
  return smax(smax(smax(d, stripe, 0.003), span, 0.004), smax(sides, SOLE_H + 0.003 - y, 0.002), 0.003);
});

const collarSdf = local(collar);

/** Black tread band around the middle of the sole. */
const treadSdf = local((x, y, z) => smax(sole(x, y, z) - 0.0012, Math.abs(y - 0.016) - 0.0055, 0.002));

const BOUNDS: MeshBounds = { min: [-0.13, -0.005, -0.085], max: [0.13, TOP + 0.012, 0.125] };

/** Black lace bars across the vamp, from the toe box up to the collar. */
function laces(): THREE.BufferGeometry {
  const bar = new THREE.BoxGeometry(0.03, 0.0045, 0.004);
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (const [i, z] of [0.05, 0.036, 0.022, 0.009].entries()) {
      const hit = trace(bootSdf, vec(s * BX, 0.2, z), vec(0, -1, 0), 0.25);
      if (!hit) continue;
      const n = normalAt(bootSdf, hit);
      parts.push(orient(bar.clone().rotateZ(i % 2 ? 0.25 : -0.25), hit.addScaledVector(n, 0.0015), n, vec(0, 0, 1)));
    }
  }
  return mergeAll(parts);
}

export function buildBoots(): Part {
  const group = new THREE.Group();
  group.name = 'boots';
  const m = materials();
  group.add(toonMesh(meshSdf(bootSdf, BOUNDS, 0.0026), m.cloth, { name: 'boots', outline: OUTLINE.cloth }));
  group.add(toonMesh(meshSdf(panelSdf, BOUNDS, 0.0024), m.leather, { name: 'shoePanels', outline: OUTLINE.detail }));
  group.add(toonMesh(meshSdf(collarSdf, BOUNDS, 0.0024), m.leather, { name: 'shoeCollars', outline: OUTLINE.detail }));
  group.add(toonMesh(meshSdf(treadSdf, BOUNDS, 0.0022), m.black, { name: 'bootTread', outline: false }));
  group.add(toonMesh(laces(), m.black, { name: 'shoeLaces', outline: OUTLINE.tiny }));
  return { object: group };
}
