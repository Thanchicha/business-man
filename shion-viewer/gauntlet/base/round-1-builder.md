# base — round 1 — builder notes

Renders: `shots/base/round-1/{front,side,back,threequarter,face}.png` (+ `compare-*.png` from tools/compare.mjs).
`npx tsc --noEmit` passes; `tools/shot.mjs` exits 0 with no page errors.

## What was built
- **Approach:** both meshes come from implicit (SDF) shapes, meshed with a custom Surface Nets
  extractor (`src/character/body/surfaceNets.ts`). Each vertex is projected onto the true surface
  and the normal comes from the field gradient, so the meshes are seamless and smoothly shaded:
  no part seams, no faceting. Blocks of the grid far from the surface are skipped, so build time
  is about 1.5 s for both meshes.
- **`head` mesh** (`body/headShape.ts`): the skull above the cheeks is exactly the RIG cranium
  ellipsoid, plus a small occiput. Below that, the face/jaw is a loft of cross-sections whose
  width and front/back depth follow keyframes measured from the reference (front + side crops).
  The cheeks stay full down to about y 0.62, then form a soft U into a small chin at 0.593. The
  jaw line rises diagonally to the neck. The front of each section is a flattened superellipse
  (power 2.6), which gives a broad, clean face front for decals. Small ears with a shallow bowl
  are blended in at eye level to just below.
- **`body` mesh** (`body/bodyShape.ts`): one seamless surface for the short neck, narrow sloped
  shoulder line, childlike torso (chest, belly and pelvis blended), arms hanging slightly away
  from the body, mitten hands with a thumb hint (palms toward thighs, hand center y≈0.337),
  short chubby legs that taper through the knee to small ankles, and simple feet inside the boot
  volume (foot bottom ≈0.034). The pose is symmetric: legs apart, toes forward.
- Skin uses `toonMaterial` (PALETTE.skin / skinShade, threshold 0.6, rim 0.08) and `toonMesh`
  outlines (head 0.0026, body 0.0024).

## Landmarks (RIG, src/character/rig.ts) — existing keys kept
| key | value |
|---|---|
| skullTopY | 0.924 |
| headCenter / craniumRadii | (0, 0.772, −0.012) / (0.139, 0.152, 0.138) |
| headRadius (mean) | 0.145 |
| eyeY / eyeHalfSpacing | 0.665 / 0.058 |
| mouthY / chinY / chin | 0.618 / 0.593 / (0, 0.594, 0.066) |
| faceFrontZ / faceHalfWidth | 0.116 / 0.117 |
| earL/R | (±0.104, 0.64, −0.036) |
| neckY (choker) / neckRadius / neckZ | 0.577 / 0.029 / −0.014 |
| shoulderY / shoulderHalfWidth | 0.548 / 0.078 (outer width across shoulders ≈0.21) |
| shoulderL / elbowL / wristL / handL (R mirrored) | (0.078,0.516,−0.008) / (0.104,0.437,−0.016) / (0.13,0.36,0) / (0.136,0.337,0.004) |
| arm radii | upper 0.022, elbow 0.018, wrist 0.0145 |
| waistY / hipY / crotchY / hipOuterHalfWidth | 0.41 / 0.37 / 0.305 / 0.092 |
| torsoProfile | halfWidth/halfDepth/z at y 0.33…0.54 (measured from the torso SDF) |
| hipJointL / kneeL / ankleL / footL | (0.054,0.335,0) / (0.06,0.2,0.004) / (0.061,0.074,−0.004) / (0.061,0.054,0.02) |
| leg radii | thigh 0.033, knee 0.025, calf 0.023, ankle 0.0175; `legRadiusAt(y)`, `legAxisAt(y)` |
| legSpacing | 0.06 |
| skirtHemY / thighStrapY / kneeY / bootTopY / soleTopY | 0.33 / 0.26 / 0.20 / 0.18 / 0.035 (unchanged) |

Exact surface queries for other pieces are exported from `src/character/body.ts`:
`headSdf(x,y,z)`, `bodySdf(x,y,z)` and `headFrontZ(x,y)` (z of the face surface, for placing
decals and bangs).

## SPEC deviation (needs a decision)
SPEC §2 says eye 0.72 and chin 0.56. I measured the reference crops at about 1400 px per H,
calibrated on sole, boot top and skirt hem, which do match SPEC. The measurements put the eye
centers at **≈0.665** and the chin at **≈0.593** (front and side agree). The choker is at ≈0.577
and the shoulders at ≈0.55. The SPEC head values would also give a head 0.37 tall by 0.24 wide,
which is much longer than the round chibi head in the art. I used the measured values. SPEC §2
should be updated to match, or the critic should judge against the reference.

## Known gaps
- The pose is exactly symmetric; there is no weight shift.
- The hands are simple mittens with no finger separation. They will mostly be hidden by the cuffs.
- The feet are simple rounded volumes sized to sit inside the boots.
- From the back, the hips read slightly wider than the waist because of the thigh tops. The
  skirt covers this; clothing should clear `hipOuterHalfWidth`.
- There is no idle animation (`update` is not defined).
