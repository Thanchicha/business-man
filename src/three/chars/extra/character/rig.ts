import * as THREE from 'three';

/**
 * Body landmarks in world units (character height H = 1, feet at y = 0, facing +Z,
 * her RIGHT = −X, her LEFT = +X). Every part module positions itself from these so proportions
 * stay consistent. Values were measured on reference/crops/front.png and side.png
 * (≈1400 px per H; lower-body heights agree with SPEC §2, head/eye/chin were re-measured —
 * the reference eyes sit at ≈0.665 and the chin at ≈0.593).
 *
 * The body mesh is generated from signed-distance shapes built from these numbers
 * (src/character/body/*). For exact surface queries use `headSdf` / `bodySdf` /
 * `headFrontZ` exported from `src/character/body.ts`.
 *
 * Sides: `…L` = her left (+X), `…R` = her right (−X). Limb landmarks are joint centers.
 */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Mirror helper: her-left landmark → her-right landmark. */
const mirror = (p: THREE.Vector3) => v(-p.x, p.y, p.z);

// --- head --------------------------------------------------------------------------------------
/** Center of the cranium ellipsoid (the skull above eye level is exactly this ellipsoid). */
const headCenter = v(0, 0.772, -0.012);
/** Cranium half-extents. Hair should sit ≥ 0.006 outside this ellipsoid. */
const craniumRadii = v(0.139, 0.152, 0.138);

// --- arms (her left; right is mirrored) ---------------------------------------------------------
const shoulderL = v(0.078, 0.516, -0.008);
const elbowL = v(0.104, 0.437, -0.016);
const wristL = v(0.13, 0.36, 0.0);
const handL = v(0.136, 0.337, 0.004);

// --- legs (her left; right is mirrored) ---------------------------------------------------------
const hipJointL = v(0.054, 0.335, 0.0);
const kneeL = v(0.06, 0.2, 0.004);
const ankleL = v(0.061, 0.074, -0.004);
const footL = v(0.061, 0.054, 0.02);

export const RIG = {
  height: 1,

  // Head
  headCenter,
  /** Mean cranium radius (use `craniumRadii` for the real ellipsoid). */
  headRadius: 0.145,
  craniumRadii,
  /** Top of the skull (hair crown sits at ≈0.97, ahoge tip ≈1.03–1.06). */
  skullTopY: 0.924,
  eyeY: 0.665,
  /** Suggested eye centers' half spacing (face piece may refine). */
  eyeHalfSpacing: 0.074,
  mouthY: 0.618,
  chinY: 0.593,
  /** Chin tip point. */
  chin: v(0, 0.594, 0.066),
  /** Face front surface z at eye level on the midline (face is flattened here for decals). */
  faceFrontZ: 0.116,
  /** Half width of the face across the cheeks (≈ y 0.63). */
  faceHalfWidth: 0.117,
  /** Ear centers (small ears, eye level to just below). */
  earL: v(0.104, 0.64, -0.036),
  earR: v(-0.104, 0.64, -0.036),

  // Neck & torso
  /** Choker height. */
  neckY: 0.577,
  neckRadius: 0.029,
  neckZ: -0.014,
  /** Top of the shoulder line beside the neck. */
  shoulderY: 0.548,
  /** Shoulder joint |x|. Outer body width across the shoulders ≈ 0.21. */
  shoulderHalfWidth: 0.078,
  waistY: 0.41,
  hipY: 0.37,
  /** Crotch (bottom of torso between the thighs). */
  crotchY: 0.305,
  /**
   * Torso cross-sections (measured from the torso SDF, arms/legs excluded; y 0.51 includes the shoulder line): half width along X, half depth along Z,
   * and z center. Clothing can loft through these (add cloth thickness on top).
   */
  torsoProfile: [
    { y: 0.33, halfWidth: 0.06, halfDepth: 0.046, z: -0.003 },
    { y: 0.36, halfWidth: 0.07, halfDepth: 0.056, z: -0.001 },
    { y: 0.39, halfWidth: 0.07, halfDepth: 0.056, z: 0.004 },
    { y: 0.42, halfWidth: 0.071, halfDepth: 0.056, z: 0.007 },
    { y: 0.45, halfWidth: 0.07, halfDepth: 0.057, z: 0.005 },
    { y: 0.48, halfWidth: 0.076, halfDepth: 0.055, z: 0.002 },
    { y: 0.51, halfWidth: 0.094, halfDepth: 0.052, z: -0.002 },
    { y: 0.54, halfWidth: 0.065, halfDepth: 0.042, z: -0.008 },
  ],
  /** Outer half width of the hips INCLUDING the thigh tops (y 0.30–0.34) — skirt must clear this. */
  hipOuterHalfWidth: 0.092,

  // Arms
  shoulderL,
  shoulderR: mirror(shoulderL),
  elbowL,
  elbowR: mirror(elbowL),
  wristL,
  wristR: mirror(wristL),
  /** Hand (palm) centers — small mittens, palms facing the thighs. */
  handL,
  handR: mirror(handL),
  upperArmRadius: 0.022,
  elbowRadius: 0.018,
  wristRadius: 0.0145,

  // Legs
  hipJointL,
  hipJointR: mirror(hipJointL),
  kneeL,
  kneeR: mirror(kneeL),
  ankleL,
  ankleR: mirror(ankleL),
  /** Foot centers (feet fit inside y 0.035..0.075, toes forward to z ≈ +0.065). */
  footL,
  footR: mirror(footL),
  thighRadius: 0.033,
  kneeRadius: 0.025,
  calfRadius: 0.023,
  ankleRadius: 0.0175,
  /** |x| of the leg axis (thigh ≈0.052 → ankle ≈0.058). */
  legSpacing: 0.06,

  // Clothing reference heights (SPEC §2)
  skirtHemY: 0.33,
  thighStrapY: 0.26,
  kneeY: 0.2,
  bootTopY: 0.18,
  soleTopY: 0.035,
} as const;

/** Approximate bare-leg radius at height y (thigh top → ankle), for socks/boots. */
export function legRadiusAt(y: number): number {
  const keys: [number, number][] = [
    [0.074, RIG.ankleRadius],
    [0.15, RIG.calfRadius],
    [0.2, RIG.kneeRadius],
    [0.26, 0.033],
    [0.31, 0.039],
    [0.345, RIG.thighRadius],
  ];
  if (y <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (y <= keys[i][0]) {
      const [y0, r0] = keys[i - 1];
      const [y1, r1] = keys[i];
      return THREE.MathUtils.lerp(r0, r1, (y - y0) / (y1 - y0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Leg axis |x| and z at height y (interpolated between joints; use sign for side). */
export function legAxisAt(y: number): THREE.Vector3 {
  const a = y > RIG.kneeY ? RIG.kneeL : RIG.ankleL;
  const b = y > RIG.kneeY ? RIG.hipJointL : RIG.kneeL;
  const t = THREE.MathUtils.clamp((y - a.y) / (b.y - a.y), 0, 1);
  return a.clone().lerp(b, t).setY(y);
}
