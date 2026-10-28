import { RIG } from '../rig';
import { boxDistance, RoundCone, sdEllipsoid, smin } from './sdf';
import type { MeshBounds } from './surfaceNets';

/**
 * Neck, childlike torso, arms with mitten hands, chubby short legs and simple feet — one seamless
 * SDF in WORLD space. Symmetric: limbs are defined for her left (+X) and mirrored via |x|.
 */

const S = RIG.shoulderL, E = RIG.elbowL, W = RIG.wristL, HND = RIG.handL;
const HIP = RIG.hipJointL, K = RIG.kneeL, A = RIG.ankleL, F = RIG.footL;

// Torso + neck
const neck = new RoundCone({ x: 0, y: 0.53, z: RIG.neckZ }, { x: 0, y: 0.665, z: RIG.neckZ - 0.008 }, RIG.neckRadius + 0.002, RIG.neckRadius);
const shoulderLine = new RoundCone({ x: 0, y: 0.523, z: -0.009 }, { x: S.x - 0.006, y: S.y - 0.002, z: S.z }, 0.031, RIG.upperArmRadius + 0.001);

// Arm
const upperArm = new RoundCone(S, E, RIG.upperArmRadius, RIG.elbowRadius);
const forearm = new RoundCone(E, W, RIG.elbowRadius, RIG.wristRadius);
const thumb = new RoundCone(
  { x: HND.x - 0.005, y: HND.y + 0.009, z: HND.z + 0.011 },
  { x: HND.x - 0.007, y: HND.y - 0.005, z: HND.z + 0.017 },
  0.0058,
  0.0049,
);
const HAND_ROLL = 0.2; // palm bottom swings slightly outward following the arm
const hc = Math.cos(HAND_ROLL), hs = Math.sin(HAND_ROLL);
const ARM_MIN = [S.x - 0.04, HND.y - 0.04, -0.06];
const ARM_MAX = [HND.x + 0.04, S.y + 0.04, 0.06];

// Leg
const thigh = new RoundCone(HIP, K, RIG.thighRadius, RIG.kneeRadius);
const shin = new RoundCone(K, A, RIG.kneeRadius, RIG.ankleRadius);
const LEG_MIN = [HIP.x - 0.07, 0.0, -0.07];
const LEG_MAX = [HIP.x + 0.07, HIP.y + 0.05, 0.1];

/** Torso without the neck (chest, belly, pelvis, shoulder line); x must be |x|. */
export function torsoCore(x: number, y: number, z: number): number {
  const chest = sdEllipsoid(x, y - 0.484, z - 0.001, 0.068, 0.062, 0.053);
  const belly = sdEllipsoid(x, y - 0.418, z - 0.009, 0.071, 0.056, 0.054);
  const pelvis = sdEllipsoid(x, y - 0.355, z + 0.003, 0.069, 0.05, 0.053);
  let d = smin(chest, belly, 0.04);
  d = smin(d, pelvis, 0.04);
  return smin(d, shoulderLine.dist(x, y, z), 0.035);
}

/** Torso including the neck; x must be |x|. */
export function torso(x: number, y: number, z: number): number {
  return smin(torsoCore(x, y, z), neck.dist(x, y, z), 0.022);
}

function arm(x: number, y: number, z: number): number {
  const ball = sdEllipsoid(x - S.x + 0.003, y - S.y + 0.003, z - S.z, 0.022, 0.024, 0.021);
  let d = smin(ball, upperArm.dist(x, y, z), 0.015);
  d = smin(d, forearm.dist(x, y, z), 0.01);
  // Mitten palm in a slightly rolled frame.
  const px = x - HND.x, py = y - HND.y, pz = z - HND.z;
  const rx = px * hc - py * hs, ry = px * hs + py * hc;
  const palm = sdEllipsoid(rx, ry, pz - 0.001, 0.012, 0.022, 0.017);
  const fingers = sdEllipsoid(rx + 0.001, ry + 0.018, pz - 0.0015, 0.0105, 0.013, 0.015);
  let hand = smin(palm, fingers, 0.008);
  hand = smin(hand, thumb.dist(x, y, z), 0.005);
  return smin(d, hand, 0.012);
}

/** One leg (her left; pass |x|). */
export function leg(x: number, y: number, z: number): number {
  let d = smin(thigh.dist(x, y, z), shin.dist(x, y, z), 0.03);
  const thighFat = sdEllipsoid(x - HIP.x - 0.002, y - 0.29, z - 0.002, 0.03, 0.05, 0.032);
  d = smin(d, thighFat, 0.03);
  const calf = sdEllipsoid(x - K.x, y - 0.15, z + 0.006, 0.0205, 0.048, 0.0215);
  d = smin(d, calf, 0.025);
  const foot = sdEllipsoid(x - F.x, y - F.y, z - F.z, 0.023, 0.02, 0.045);
  return smin(d, foot, 0.02);
}

/** Body SDF in world coordinates (head excluded — see headShape.ts). */
export function bodySdf(wx: number, y: number, z: number): number {
  const x = Math.abs(wx);
  let d = torso(x, y, z);
  const ab = boxDistance(x, y, z, ARM_MIN, ARM_MAX);
  d = smin(d, ab > 0.04 ? ab : arm(x, y, z), 0.022);
  const lb = boxDistance(x, y, z, LEG_MIN, LEG_MAX);
  d = smin(d, lb > 0.04 ? lb : leg(x, y, z), 0.035);
  return d;
}

export const BODY_BOUNDS: MeshBounds = {
  min: [-0.19, 0.025, -0.1],
  max: [0.19, 0.71, 0.1],
};
