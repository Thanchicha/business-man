# g2-hair — round 1 builder notes

Time-boxed round (the coordinator asked to wrap up early): the twin tails were rebuilt; the bangs and cheek locks only got a quick fattening pass.

Renders: `shots/g2-hair/round-1/` (front, side, back, threequarter, face, threequarter-walk, comp-front, comp-face).
Work/iteration renders + helper scripts: `shots/g2-hair/work/` (overlay.mjs = red/cyan silhouette overlay vs reference,
grid.mjs = world grid on a render, probe.mjs = numeric SDF extents via vite SSR, shot.mjs = copy of tools/shot.mjs
with a long protocolTimeout because the machine was overloaded).

## What changed
- **Twin tails (`hair/twintails.ts`, rewritten)**: the old sweep core + clump ribbons + separate root loop are gone. Each tail
  is now an implicit volume: a fat round core (round-cone chain along a Catmull-Rom spine) plus 6 big soft clumps
  that merge into the core up top and separate below about y 0.6, ending in soft ogive points (outer flick at sleeve height,
  inner tip curling in, back flick for the side view). Shallow strand grooves (4 angles around the spine) give
  the cel shading something to draw lavender strand lines on. Both tails are mirrored (evaluated at |x|).
- **One surface for cap and tails (`hair.ts`)**: `smin(capSdf, tailsSdf, 0.02)` is meshed once with surface nets, then
  split per triangle (nearest to tail SDF → `hairTails`, else → `hairCap`). The seam vertices are shared, so the head hair
  flows straight into the tails with no stuck-on loop ("dog ear") and no visible join. Mesh names, `hitHair` unchanged.
- **Skeleton (`anim/skeleton.ts`)**: tail bones moved to the new spine (tailL1 (±0.19, 0.9, −0.08),
  tailL2 (±0.262, 0.6, −0.134)). `tailWeights` is now rigid to the head above y 0.8–0.9 *or* inside a head ellipsoid
  (center (0, 0.79, −0.02), radii 0.19/0.2/0.185, fade e 1.04→1.24), so the shared cap/tail seam never opens. The walk
  spot-check (`threequarter-walk.png`) deforms cleanly.
- **Bangs/cheek locks (`hair/layout.ts`)**: 7 bangs re-spaced, wider (0.096–0.112, narrow 0.066 center strand dipping to
  0.688 between the eyes), thicker (0.36×width), earlier and rounder tip taper (tipStart 0.5, tipRound 0.7).
  Cheek locks wider and thicker (0.088/0.078 wide, 0.028 thick).
- Bows/hairpin: not changed; they still land on the hair surface via `hitHair`.

## Key numbers
- Spine (her left): (0.06,0.9,−0.035) → crest (0.16,0.942,−0.07) → (0.207,0.845,−0.1) → (0.23,0.655,−0.124)
  → (0.236,0.465,−0.126) → tips (0.228,0.345,−0.114).
- Core radius: 0.03 at the root, 0.052 at y≈0.84, 0.066 at y≈0.6, ends around y 0.47. Clump radii 0.028–0.036,
  blends: clump/clump 0.009, core/clumps 0.018, cap/tails 0.02. Grooves: depth 0.0032, width 0.0075.

## Checks
- `npx tsc --noEmit` passes. No page errors from my final renders. (Earlier one render picked up a transient
  `jacket.ts danglingStraps` import error while the outfit piece was mid-edit; that is not from the hair files.)

## Known remaining gaps
1. **Bangs** are still sweep ribbons. They are fatter now but still read as a band of spikes, not the reference's
   few puffy layered clumps with forehead gaps. Planned fix (not done): an SDF bang layer in the cap mesh, with
   rounded slabs over a radial heightfield of skin/cap so clumps merge into the cap with creases.
2. Tail tops still read a little like a flat shelf next to the crown from the front and back; the reference crest
   is rounder and sits a touch higher in front. The front-view outward bulge at y 0.45–0.65 is about 0.02–0.03
   short (the back view already matches, because the reference sheet's front and back disagree).
3. Side view: the lower tail sits slightly too far back and too low (about 0.02); the reference narrows to points
   by about y 0.38.
4. Hair is near flat white: the grooves and clump creases are subtle under the current toon material. g2-look should
   add lavender shade and a darker tone toward the tail ends. A lower hair shade threshold would show the grooves.
5. Ahoge, back-of-head strand lines and bow/hairpin scale are untouched.
