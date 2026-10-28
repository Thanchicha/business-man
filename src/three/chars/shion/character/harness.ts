import * as THREE from 'three';
import { toonMesh } from '../render/toon';
import { chain, mergeAll, orient, vec } from './lib/geometry';
import { materials, OUTLINE } from './lib/materials';
import { band, buckleShape, butterflySmooth, extrude, strap } from './lib/shapes';
import { normalAt, trace } from './lib/surface';
import { blouseSdf } from './outfit/blouse';
import { SKIRT, skirtPoint } from './outfit/skirt';
import { legSurface, SOCK_TOP } from './outfit/socks';
import { legAxisAt, legRadiusAt } from './rig';
import type { Part } from './types';

/**
 * Harness (SPEC §4): suspender straps over the shoulders with silver buckles and O-rings, belt
 * with a square buckle, chains on her left hip, white butterfly charm, thigh strap with O-ring on
 * her RIGHT thigh, garter straps from the skirt hem to the sock tops.
 */

const BELT_Y = 0.424;

/** Point on the blouse surface hit from `from` toward `to`, lifted along the normal. */
function onBlouse(from: THREE.Vector3, to: THREE.Vector3, lift: number): THREE.Vector3 {
  const dir = to.clone().sub(from);
  const p = trace(blouseSdf, from, dir, dir.length()) ?? to.clone();
  return p.addScaledVector(normalAt(blouseSdf, p), lift);
}

/** Suspender path for side s: front (belt → chest → over shoulder) → back (→ belt). */
function suspenderPoints(s: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const lift = 0.0028;
  for (const [x, y] of [[0.036, BELT_Y + 0.006], [0.038, 0.45], [0.04, 0.49], [0.043, 0.52], [0.046, 0.54]]) {
    pts.push(onBlouse(vec(s * x, y, 0.3), vec(s * x, y, -0.005), lift));
  }
  // Over the shoulder: shoot downward.
  for (const z of [0.012, -0.012]) pts.push(onBlouse(vec(s * 0.05, 0.7, z), vec(s * 0.05, 0.5, z), lift));
  for (const [x, y] of [[0.047, 0.535], [0.045, 0.5], [0.042, 0.45], [0.04, BELT_Y + 0.006]]) {
    pts.push(onBlouse(vec(s * x, y, -0.3), vec(s * x, y, 0), lift));
  }
  return pts;
}

function suspenders(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const black: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const buckle = extrude(buckleShape(0.02, 0.015, 0.0034), 0.003);
  const ring = new THREE.TorusGeometry(0.0062, 0.0015, 6, 16);
  for (const s of [-1, 1]) {
    const pts = suspenderPoints(s);
    black.push(strap(pts, 0.0125, 0.0026, (p) => normalAt(blouseSdf, p), 64));
    // Buckle high on the chest, O-ring lower down.
    const b = onBlouse(vec(s * 0.041, 0.505, 0.3), vec(s * 0.041, 0.505, 0), 0.0055);
    metal.push(orient(buckle, b, normalAt(blouseSdf, b)));
    const r = onBlouse(vec(s * 0.038, 0.462, 0.3), vec(s * 0.038, 0.462, 0), 0.0055);
    metal.push(orient(ring, r, normalAt(blouseSdf, r)));
  }
  return { black, metal };
}

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

/** Silver chains looping from the belt on her left hip. */
function hipChains(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const at = (a: number, y: number, lift: number) => {
    const t = (y - SKIRT.top) / (SKIRT.hem - SKIRT.top);
    return skirtPoint(a, t, lift, true);
  };
  // Two strands of different length draping across her left hip.
  parts.push(chain([at(0.45, BELT_Y - 0.008, 0.008), at(0.75, 0.39, 0.012), at(1.05, 0.378, 0.014), at(1.35, 0.392, 0.012), at(1.55, BELT_Y - 0.008, 0.008)], 0.0095, 0.0015));
  parts.push(chain([at(0.55, BELT_Y - 0.008, 0.008), at(0.85, 0.374, 0.014), at(1.15, 0.36, 0.016), at(1.4, 0.372, 0.013), at(1.6, BELT_Y - 0.008, 0.008)], 0.0095, 0.0015));
  // Short chain from the belt down to the butterfly charm.
  const top = charmPosition().add(vec(0, 0.017, 0));
  parts.push(chain([at(0.28, BELT_Y - 0.009, 0.007), top], 0.007, 0.0012));
  return mergeAll(parts);
}

const CHARM_ANGLE = 0.4;
function charmPosition(): THREE.Vector3 {
  const t = (0.372 - SKIRT.top) / (SKIRT.hem - SKIRT.top);
  return skirtPoint(CHARM_ANGLE, t, 0.02, true);
}

function butterflyCharm(): THREE.BufferGeometry {
  const dir = vec(Math.sin(CHARM_ANGLE), 0.1, Math.cos(CHARM_ANGLE)).normalize();
  return orient(extrude(butterflySmooth(), 0.004, 0.038), charmPosition(), dir);
}

/** Thigh strap with O-ring on her RIGHT thigh (−X), and a garter strap on each leg. */
function legStraps(): { black: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] } {
  const black: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const y = 0.262;
  const axis = legAxisAt(y);
  const r = legRadiusAt(y) + 0.0068;
  black.push(band(vec(-axis.x, y, axis.z), r, r * 1.02, 0.011, 0.003, 0.002));
  const ring = new THREE.TorusGeometry(0.0068, 0.0016, 6, 16);
  const front = legSurface(-1, y, -0.5, 0.008);
  metal.push(orient(ring, front.add(vec(0, -0.008, 0)), vec(-0.5, 0, 1).normalize()));

  // Garters: one clean strap per leg, from under the skirt hem down to the sock welt.
  for (const s of [-1, 1]) {
    for (const ang of [0.12 * s]) {
      const pts = [0.345, 0.318, SOCK_TOP - 0.006].map((yy) => legSurface(s, yy, ang, 0.0022));
      black.push(strap(pts, 0.0065, 0.0018, (p) => {
        const a = legAxisAt(p.y);
        a.x *= s;
        return p.clone().sub(a).setY(0).normalize();
      }, 16));
    }
  }
  return { black, metal };
}

export function buildHarness(): Part {
  const group = new THREE.Group();
  group.name = 'harness';
  const m = materials();
  const sus = suspenders();
  const bl = belt();
  const legs = legStraps();
  group.add(toonMesh(mergeAll([...sus.black, ...bl.black, ...legs.black]), m.leather, { name: 'harnessStraps', outline: OUTLINE.detail }));
  group.add(toonMesh(mergeAll([...sus.metal, ...bl.metal, ...legs.metal, hipChains()]), m.metal, { name: 'harnessMetal', outline: OUTLINE.tiny }));
  group.add(toonMesh(butterflyCharm(), m.cloth, { name: 'butterflyCharm', outline: OUTLINE.detail }));
  return { object: group };
}
