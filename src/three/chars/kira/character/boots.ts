import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { sdEllipsoid, smax, smin } from './body/sdf';
import { meshSdf, type MeshBounds } from './body/surfaceNets';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { band, buckleShape, extrude } from './lib/shapes';
import { RIG } from './rig';
import type { Part } from './types';

/**
 * Chunky black platform boots (sheet detail 5): thick lug sole with a white band, rounded
 * toe box with a leather toe cap, a wide mid-calf shaft with three buckle straps and a heel tab
 * (the leg warmers slump over the top). Shapes are SDFs in boot-local space (x = |x|).
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

/** Toe cap: a thin black skin over the front of the toe box, a rounded dome seen from the front. */
const toeCapSdf = local((x, y, z) => {
  const d = upper(x, y, z) - 0.0015;
  const dome = sdEllipsoid(x, y - SOLE_H, z - 0.104, 0.043, 0.037, 0.068);
  return smax(smax(d, dome, 0.004), SOLE_H + 0.002 - y, 0.003);
});

/** Black tread band around the middle of the sole. */
const treadSdf = local((x, y, z) => smax(sole(x, y, z) - 0.0012, Math.abs(y - 0.016) - 0.0055, 0.002));

const BOUNDS: MeshBounds = { min: [-0.13, -0.005, -0.085], max: [0.13, TOP + 0.01, 0.125] };

/** Strap heights around the shaft. */
const STRAPS = [0.082, 0.116, 0.148];

function straps(): { black: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const black: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const frame = extrude(buckleShape(0.02, 0.017, 0.0035), 0.003);
  for (const s of [-1, 1]) {
    for (const [i, y] of STRAPS.entries()) {
      const r = SHAFT_R + 0.004 * Math.max(0, (y - 0.12) / 0.06) + 0.003;
      black.push(band(vec(s * BX, y, SHAFT_Z), r, r, 0.012, 0.004, 0.002 * (i - 1)));
      // Buckle on the outer side, and a short loose strap end.
      const p = vec(s * (BX + r + 0.002), y, SHAFT_Z + 0.01);
      metal.push(orient(frame, p, vec(s, 0, 0.2).normalize()));
    }
    // Heel tab.
    const tab = new THREE.BoxGeometry(0.016, 0.034, 0.008, 1, 1, 1);
    black.push(tab.translate(s * BX, TOP - 0.008, SHAFT_Z - SHAFT_R - 0.006));
  }
  return { black: mergeAll(black), metal: mergeAll(metal) };
}

export function buildBoots(): Part {
  const group = new THREE.Group();
  group.name = 'boots';
  const m = materials();
  // Kira's boots: black leather-look platforms with a thin white band around the sole.
  group.add(toonMesh(meshSdf(bootSdf, BOUNDS, 0.0026), m.dark, { name: 'boots', outline: OUTLINE.cloth }));
  group.add(toonMesh(meshSdf(toeCapSdf, BOUNDS, 0.0026), m.leather, { name: 'bootToeCaps', outline: OUTLINE.detail }));
  group.add(toonMesh(meshSdf(treadSdf, BOUNDS, 0.0022), m.cloth, { name: 'bootTread', outline: false }));
  const st = straps();
  group.add(toonMesh(st.black, m.leather, { name: 'bootStraps', outline: OUTLINE.detail }));
  group.add(toonMesh(st.metal, m.metal, { name: 'bootBuckles', outline: OUTLINE.tiny }));
  return { object: group };
}
