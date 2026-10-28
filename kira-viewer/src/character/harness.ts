import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { band, buckleShape, extrude } from './lib/shapes';
import { SKIRT, skirtPoint } from './outfit/skirt';
import { legSurface } from './outfit/socks';
import { legAxisAt, legRadiusAt } from './rig';
import type { Part } from './types';

/**
 * Straps (sheet detail 5): studded black belt with a square buckle at the skirt waist, and a
 * black thigh strap with an O-ring on her RIGHT thigh.
 */

const BELT_Y = 0.424;

function belt(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const t = (BELT_Y - SKIRT.top) / (SKIRT.hem - SKIRT.top);
  const p0 = skirtPoint(0, t, 0, true), p90 = skirtPoint(Math.PI / 2, t, 0, true);
  const rx = p90.x + 0.004, rz = p0.z - SKIRT.cz + 0.004;
  const black = [band(vec(0, BELT_Y, SKIRT.cz), rx, rz, 0.02, 0.0045)];
  const frame = extrude(buckleShape(0.032, 0.027, 0.006), 0.004);
  const prong = new THREE.BoxGeometry(0.003, 0.02, 0.003);
  const front = vec(0.004, BELT_Y, SKIRT.cz + rz + 0.004);
  const metal = [frame.clone().translate(front.x, front.y, front.z), prong.translate(front.x, front.y, front.z + 0.002)];
  // Belt studs.
  const stud = new THREE.SphereGeometry(0.0022, 8, 6);
  for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) < 2) continue;
    const a = i * 0.32;
    metal.push(stud.clone().translate(Math.sin(a) * (rx + 0.003), BELT_Y, SKIRT.cz + Math.cos(a) * (rz + 0.003)));
  }
  return { black, metal };
}

/** Thigh strap with O-ring on her RIGHT thigh (−X). */
function thighStrap(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const y = 0.262;
  const axis = legAxisAt(y);
  const r = legRadiusAt(y) + 0.0035;
  const black = [band(vec(-axis.x, y, axis.z), r, r * 1.02, 0.011, 0.003, 0.002)];
  const ring = new THREE.TorusGeometry(0.0068, 0.0016, 6, 16);
  const front = legSurface(-1, y, -0.5, 0.005);
  const metal = [orient(ring, front.add(vec(0, -0.008, 0)), vec(-0.5, 0, 1).normalize())];
  return { black, metal };
}

export function buildHarness(): Part {
  const group = new THREE.Group();
  group.name = 'harness';
  const m = materials();
  const bl = belt();
  const leg = thighStrap();
  group.add(toonMesh(mergeAll([...bl.black, ...leg.black]), m.leather, { name: 'harnessStraps', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll([...bl.metal, ...leg.metal]), m.metal, { name: 'harnessMetal', outline: OUTLINE.tiny }));
  return { object: group };
}
