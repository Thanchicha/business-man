# g2-outfit — round 1 builder notes

Renders: `shots/g2-outfit/round-1/{front,side,back,threequarter}.png` (+ `threequarter-walk.png`,
comps in `round-1/it10/comp-*.png`). `npx tsc --noEmit` passes; shot.mjs reports no page errors.

## Changes
- **Sleeves (`outfit/jacket.ts`)**: redesigned as in the reference: a round puff from the shoulder
  to a gather at about y 0.395, then a long, clean bell cuff that hangs level down to y 0.30 and
  hides the hands. The cuff is flattened against her side (narrower in X, deeper in Z) so the
  skirt stays visible in front of it, and it ends in a rolled hem rim. The puff is slightly smaller
  (outer edge |x| ≈ 0.19, as in the reference). Fixed the puff sag: on her right sleeve it pointed
  inward.
- **Removed clutter**: the dangling straps, silver crosses, black cuff bands and all sleeve
  buckles are gone. The `jacketStraps`, `jacketCrosses` and `jacketBuckles` meshes no longer
  exist; their entries remain in MODES and are harmless. What stays is the black band across the
  top of each sleeve plus a small black D-shaped tab at each wrist gather (the dark crescent in
  the reference side and 3/4 views). The tab is merged into `jacketBands`.
- **Jacket body**: the open front widens toward the hem (56° → 110°), so the front hem corners
  no longer flare out as "wings" beside the skirt. The hem moved to y 0.318 and its folds are
  softer.
- **Harness**: belt raised to y 0.424, which makes it a little narrower, as in the reference. The
  hip chains are now two strands with different drape, a little thicker. A short chain now hangs
  the white butterfly charm from the belt.
- **Bag**: a bit smaller (0.114 × 0.078) and lower (y 0.414). The vertical flap straps, studs and
  cat-face decal are replaced by two square buckles high on the flap, a silver tongue and a white
  turn-lock plate with a keyhole. The butterfly charm now overlaps the bag's lower corner, as in
  the reference. Strap depth now accounts for the jacket's rolled top edge, which used to hide the
  straps. The chains start higher on the bag sides and drape to the hips.
- **Boots**: added a padded collar roll at the shaft top. The toe cap is now a rounded dome
  (ellipsoid mask) instead of a pointed arch. Straps moved slightly lower and the butterfly sits
  just under the collar.

## Remaining gaps
- A small white nub (petticoat ruffle or hem corner) can peek below her left cuff in the 3/4
  view. A tiny bit of hand can show at the inner edge of the cuff opening.
- The cuff hem is a simple rolled rim. The reference has a crisper turned-back band.
- The skirt and petticoat shape were not retuned. The reference waist and belt read a touch
  narrower and the flare slightly stronger.
- The boot sole tread and strap buckles are unchanged. The collar could be a little fatter, as in
  the reference.
- The lock plate is a plain shield. The reference plate seems to have a cat or U motif.
