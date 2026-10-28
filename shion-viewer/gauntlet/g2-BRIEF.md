# Gauntlet round 2 — match the twin-tail sheet

Reference (the absolute quality bar): `reference/twintail.png` (full sheet: front, side, back, 3/4).
Per-view crops at 3x: `reference/twin/front.png`, `side.png`, `back.png`, `threequarter.png`, `face.png`.
Baseline renders of the model before this round: `shots/g2/baseline/*` (plus `comp-*.png` side-by-sides).

Read `SPEC.md` (sections 1–7) and `GAUNTLET.md` first. GAUNTLET.md's builder/critic rules apply, with the
piece folders below. Orientation: character faces +Z, her LEFT = +X (viewer's right in the front view).

## Pieces (in order)

| piece | folder | owns |
|---|---|---|
| g2-hair | `gauntlet/g2-hair`, `shots/g2-hair` | `src/character/hair.ts`, `src/character/hair/*`, hair bits of `src/character/accessories.ts` (bows/hairpin), tail entries in `src/character/anim/skeleton.ts` (LAYOUT tail bones + `tailWeights`) |
| g2-face | `gauntlet/g2-face`, `shots/g2-face` | `src/character/face/*`, `src/character/body/headShape.ts` (face loft only) |
| g2-outfit | `gauntlet/g2-outfit`, `shots/g2-outfit` | `src/character/outfit/*`, `outfit.ts`, `harness.ts`, `boots.ts`, `bag.ts`, choker in `accessories.ts` |
| g2-look | `gauntlet/g2-look`, `shots/g2-look` | `src/render/toon.ts`, `src/character/lib/materials.ts`, `src/character/palette.ts`, `src/scene/Stage.ts` |

## Gap analysis (orchestrator, before round 1)

### Hair — biggest gap
1. **Twin-tail shape.** Ours: narrow vertical curtains hanging straight down from a separate round loop
   that reads like a dog ear above each side of the head. Reference: the tail top hugs the head (the
   loop peaks just below the crown and flows out of the head hair), then the tail **arcs outward**
   into a broad soft bundle that is widest around sleeve height (outer edge ≈ |x| 0.34 in the front
   view), made of 3–4 big soft clumps; bottom ends around y ≈ 0.33 with a couple of tips flicking
   outward and inner tips curling inward. Not stringy: big rounded clumps with a few lavender strand
   lines.
2. **Side view of tails.** Ours: a straight plank behind the back. Reference: the tail leaves the
   top-back of the head, sweeps back and down in a gentle S, is wide in depth (≈0.12–0.15), ends with
   pointed clumps at ≈ y 0.35–0.38.
3. **Bangs.** Ours: thin sharp zig-zag spikes, flat band. Reference: fewer, **fat rounded clumps** with
   layered volume and soft points, a center gap showing forehead, a strand dipping between the eyes,
   long side pieces down to the cheeks. Clumps have thickness and lavender shading where they overlap.
4. **Cheek locks.** Reference: thick, wide locks in front of the ears curving inward under the cheeks
   to chin level. Ours: thin strings.
5. **Hair shading/volume.** Reference head hair is rounder and fuller at the top-sides, with soft
   lavender-gray shading and a few drawn strand lines; tails darken slightly toward the ends. Ours
   reads as flat white (lighting/material is g2-look's piece, but hair geometry must create the
   overlaps and grooves that catch shading).
6. **Ahoge.** Ours is too tall/thin. Reference: a short, fat crescent curling to her left.
7. **Bows.** Her right: black ribbon bow with two long tails on the tail tie at temple height —
   reference bow is larger and sits on the front of the tail base. Her left: slanted black hairpin with
   a butterfly end, small black bow below it. Placement roughly right already; check scale.

### Face / head
- Eyes: too much white sclera, rim of white around the iris; reference iris fills the eye, softer
  gray, lash line thinner with a small wing. Reference face rounder, fuller cheeks, wider softer blush,
  slightly pinker skin. Eyes sit a touch lower/farther apart in the reference relative to the bangs.

### Outfit
- Close overall. Sleeves: reference cuffs are bell-shaped and clean; ours have extra dangling straps
  and cross charms that clutter the silhouette. Check skirt flare, petticoat, boot shapes vs reference.

### Look (materials/lighting)
- Ours is too bright/flat white with harsh dark outlines. Reference: soft lavender-gray shading on all
  whites (hair especially), gentle gradients, thinner softer lavender outlines.

## Tooling notes
- `node tools/shot.mjs --out <dir> --views front,side,back,threequarter[,face]` — about 25 s per view
  (the character is rebuilt on every page load); only render the views you need while iterating.
- `node tools/compare.mjs --ref reference/twin/<view>.png --a <png> [--b <png> --blind] --out <png>`.
- `node tools/zoom.mjs --in <png> --rect x,y,w,h --scale 2 --out <png>`.
- `npx tsc --noEmit` must pass; shot.mjs must report no page errors.

## Hard constraints
- TypeScript + Three.js only; keep code clean, typed, small functions, comments only where useful.
- Refine the existing model; don't rebuild from scratch unless a part truly needs it.
- The character is skinned and animated (`src/character/anim/`). Keep mesh names that
  `skeleton.ts` MODES relies on (`hairCap`, `hairLocks`, `hairTails`, `accessoriesBlack`,
  `accessoriesMetal`, …). If tail geometry moves, update the tail bones in `skeleton.ts` LAYOUT and the
  height thresholds in `tailWeights` so the tails still sway correctly. Spot-check
  `--q "walk=1&time=0.225"` renders for broken deformation when you touch rigged parts.
- `hitHair` (hair.ts) is used by accessories to place bows on the hair surface — keep it working.
- Don't touch files owned by other pieces.
