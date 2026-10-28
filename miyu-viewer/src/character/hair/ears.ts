import * as THREE from 'three';
import { sweep, vec } from '../lib/geometry';
import { capPoint } from './shared';

/**
 * Cat ears on the top-sides of the head (reference/sheet.webp): a rounded pink triangle with a
 * white fluffy inner ear. Both live in the hair group so they ride rigidly on the head.
 */

interface EarFrame {
  base: THREE.Vector3;
  /** Base → tip direction. */
  up: THREE.Vector3;
  /** Direction the inner ear faces. */
  front: THREE.Vector3;
}

function earFrame(s: number): EarFrame {
  const base = capPoint(s * 0.62, 0.52, -0.018);
  const up = vec(s * 0.5, 1, 0.05).normalize();
  const front = vec(s * 0.35, 0.05, 1).normalize();
  front.addScaledVector(up, -front.dot(up)).normalize();
  return { base, up, front };
}

const EAR_LEN = 0.1;

function earSweep(f: EarFrame, len: number, width: number, thick: number, forward: number): THREE.BufferGeometry {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const t = i / 5;
    // Slight backward bend toward the tip.
    return f.base.clone().addScaledVector(f.up, len * t).addScaledVector(f.front, forward - 0.012 * t * t);
  });
  return sweep(pts, {
    width: (t) => width * Math.pow(1 - t, 0.85) + 0.004,
    thickness: (t) => thick * (1 - 0.6 * t) + 0.002,
    normalRef: () => f.front,
    squareness: 2.4,
    segments: 20,
    radial: 14,
  });
}

/** Pink outer ears (both sides). */
export function earShells(): THREE.BufferGeometry[] {
  return [-1, 1].map((s) => earSweep(earFrame(s), EAR_LEN, 0.095, 0.032, 0));
}

/** White fluffy inner ears, sitting just in front of each shell. */
export function earInners(): THREE.BufferGeometry[] {
  return [-1, 1].map((s) => {
    const f = earFrame(s);
    f.base.addScaledVector(f.up, 0.016);
    return earSweep(f, EAR_LEN * 0.62, 0.05, 0.012, 0.011);
  });
}
