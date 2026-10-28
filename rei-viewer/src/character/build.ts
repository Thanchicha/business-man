import * as THREE from 'three';

/**
 * Rei's male build. Every part is modelled in the shared chibi base space (the same RIG as
 * Shion, height 1, so both characters read as one game), then `warpPoint` turns the base body
 * into his: everything below the neck is stretched taller and made broader / deeper, while the
 * head keeps exactly the same size and is only lifted onto the longer body.
 *
 * The blend between the body scale and the head happens over the neck (NECK_LOW → NECK_HIGH).
 */
export const BUILD = {
  /** Vertical stretch of the body below the neck. */
  height: 1.2,
  /** Width (X) and depth (Z) scale of the body. */
  width: 1.17,
  depth: 1.12,
  /** Extra shoulder/chest breadth on top of `width` (peaks across the shoulders). */
  shoulders: 0.03,
} as const;

const NECK_LOW = 0.55;
const NECK_HIGH = 0.6;
/** Z the depth scale is centered on (the neck axis), so the head stays above the body. */
const AXIS_Z = -0.012;

const smooth = (e0: number, e1: number, x: number) => THREE.MathUtils.smoothstep(x, e0, e1);
/** 1 on the body, 0 on the head. */
const bodyAmount = (y: number) => 1 - smooth(NECK_LOW, NECK_HIGH, y);

/** ∫₀ʸ bodyAmount — closed form of the integrated smoothstep. */
function bodyIntegral(y: number): number {
  if (y <= NECK_LOW) return y;
  const span = NECK_HIGH - NECK_LOW;
  const t = Math.min(1, (y - NECK_LOW) / span);
  return NECK_LOW + span * (t - t ** 3 + t ** 4 / 2);
}

/** How far the head is raised. */
export const HEAD_LIFT = (BUILD.height - 1) * bodyIntegral(10);

/** Extra breadth that peaks across the shoulders and fades toward the waist and the neck. */
const shoulderBoost = (y: number) => BUILD.shoulders * smooth(0.42, 0.5, y) * (1 - smooth(0.54, 0.58, y));

/** Local X / Y / Z scale factors at base height y (used for positions and normals). */
function scales(y: number): [number, number, number] {
  const b = bodyAmount(y);
  return [1 + (BUILD.width - 1 + shoulderBoost(y)) * b, 1 + (BUILD.height - 1) * b, 1 + (BUILD.depth - 1) * b];
}

/** Base space → Rei space (in place). */
export function warpPoint(p: THREE.Vector3): THREE.Vector3 {
  const [sx, , sz] = scales(p.y);
  p.x *= sx;
  p.z = AXIS_Z + (p.z - AXIS_Z) * sz;
  p.y = p.y + (BUILD.height - 1) * bodyIntegral(p.y);
  return p;
}

/** Warps a geometry's positions and normals (inverse-transpose of the local scale). */
export function warpGeometry(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor) {
      const [sx, sy, sz] = scales(p.y);
      n.fromBufferAttribute(nor, i);
      n.set(n.x / sx, n.y / sy, n.z / sz).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    warpPoint(p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}
