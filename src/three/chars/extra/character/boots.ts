import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { sdEllipsoid, smax, smin } from './body/sdf';
import { meshSdf, type MeshBounds } from './body/surfaceNets';
import { materials, OUTLINE } from './lib/materials';
import { RIG } from './rig';
import type { Part } from './types';

/** Low-top sneakers: a white rubber sole under a coral upper with a short ankle cuff. Shapes are in |x| space. */

const BX = RIG.ankleL.x + 0.002;
const SOLE_H = RIG.soleTopY + 0.001;
const CUFF_TOP = 0.1;

const local = (fn: (x: number, y: number, z: number) => number) => (wx: number, y: number, z: number) => fn(Math.abs(Math.abs(wx) - BX), y, z);

/** 2D rounded rectangle distance. */
function roundRect(x: number, z: number, hx: number, hz: number, r: number): number {
  const qx = Math.abs(x) - hx + r, qz = Math.abs(z) - hz + r;
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - r;
}

const soleSdf = local((x, y, z) => {
  const d2 = roundRect(x, z - 0.018, 0.046 + 0.005 * Math.max(0, (z - 0.018) / 0.086), 0.086, 0.034);
  const dy = Math.abs(y - SOLE_H / 2) - SOLE_H / 2;
  return Math.min(Math.max(d2, dy), 0) + Math.hypot(Math.max(d2, 0), Math.max(dy, 0)) - 0.002;
});

const upperSdf = local((x, y, z) => {
  const toe = sdEllipsoid(x, y - (SOLE_H + 0.012), z - 0.058, 0.043, 0.03, 0.05);
  const vamp = sdEllipsoid(x, y - (SOLE_H + 0.03), z - 0.012, 0.044, 0.04, 0.06);
  const heel = sdEllipsoid(x, y - (SOLE_H + 0.03), z + 0.035, 0.043, 0.045, 0.042);
  const cuff = smax(Math.hypot(x, z + 0.008) - 0.04, Math.abs(y - (CUFF_TOP + 0.04) / 2) - (CUFF_TOP - 0.04) / 2, 0.012);
  return smin(smin(smin(toe, vamp, 0.02), heel, 0.02), cuff, 0.02);
});

const BOUNDS: MeshBounds = { min: [-0.13, -0.005, -0.085], max: [0.13, CUFF_TOP + 0.01, 0.125] };

export function buildBoots(): Part {
  const group = new THREE.Group();
  group.name = 'boots';
  const m = materials();
  group.add(toonMesh(meshSdf(upperSdf, BOUNDS, 0.0028), m.shoe, { name: 'shoes', outline: OUTLINE.cloth }));
  group.add(toonMesh(meshSdf(soleSdf, BOUNDS, 0.0024), m.cloth, { name: 'shoeSoles', outline: OUTLINE.detail }));
  return { object: group };
}
