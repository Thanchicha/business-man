# Kira — Reference Analysis & Build Spec

Single source of truth for every builder and critic. Reference sheet: `reference/sheet.webp`.
Per-view crops (3x upscaled): `reference/crops/*.png`
(`front`, `side`, `back`, `threequarter`, `detail-*`, `expr-*`).

## 1. Art style

- Chibi, ~2.6 heads tall. Soft anime cel shading: 2–3 tone, **cool lavender-gray shadows** on whites,
  never muddy/brown. Very bright, airy, low contrast overall except the blacks.
- Thin dark-gray (not pure black) line art around silhouettes and major folds.
- Palette (sRGB):
  - Hair lit `#f6f5f8`, hair shade `#cfcdd8`, hair deep shade `#a9a6b6`
  - Cloth white lit `#f7f6f8`, shade `#d3d1dc`
  - Black cloth/leather `#1d1c22`, black shade `#0f0e13`, black highlight `#4a4854`
  - Metal (buckles, rings, chains) `#d9dae0` with dark `#7d7e88`
  - Skin lit `#fdf1ec`, skin shade `#f2d3d0`, blush `#f4aeb6`
  - Eye iris `#5d5c66` → lighter bottom `#a9a8b3`, pupil `#2b2a31`, lash line `#24232a`
  - Background: light cool gray `#cdd0d6` → `#c3c6cd` vertical gradient; soft gray floor shadow.

## 2. Proportions (measured from the reference crops; RIG in src/character/rig.ts is authoritative) (front view, total height H = 1.0 world unit, feet at y = 0)

| Landmark | y (fraction of H) | notes |
|---|---|---|
| Ahoge tip | ~1.06 | two antenna strands rising from crown, curving forward/right |
| Hair top (crown) | ~0.97 | hair volume adds height above skull |
| Skull top | ~0.924 | |
| Eye center | ~0.665 | eyes sit LOW on face; huge (eye height ≈ 0.075 H) |
| Chin | ~0.593 | head (skull top→chin) ≈ 0.33 H, round and wide |
| Choker / neck | ~0.577 | very short neck |
| Shoulders | ~0.55 | narrow (≈0.20 H wide body), jacket makes it wider |
| Belt / waist | ~0.41 | |
| Skirt hem (black) | ~0.33 | white frill petticoat below to ~0.30 |
| Thigh strap | ~0.26 | on her RIGHT leg (viewer's left in front view) |
| Knee | ~0.20 | |
| Boot top | ~0.18 | boots are BIG, chunky: ~0.18 H tall |
| Sole | 0.00 | thick platform sole ~0.035 H |

- Head width (face) ≈ 0.24 H; hair silhouette width ≈ 0.50 H (very voluminous, flares out).
- Long hair falls to ~0.30–0.34 (skirt hem level), messy wispy ends.
- Legs short and slightly apart; feet slightly apart, toes forward.
- Arms hang down, hands at ~0.36 hidden in big sleeve cuffs.

## 3. Orientation convention (IMPORTANT)

Character faces **+Z**, up is +Y. Her **right** = **−X**, her **left** = **+X**.

- Front view: camera on +Z.   Viewer's left = her right.
- Side view (reference): character faces screen-left ⇒ camera on **+X** (we see HER LEFT side).
- Back view: camera on −Z.
- 3/4 view: camera rotated ~35–40° from +Z toward +X (we see her front + left side).

## 4. Components

### Hair (white twin tails) — reference/twintail.png, crops in reference/twin/
- Bangs: 7 broad pointed clumps, tips just above the eyes (≈0.70–0.72), a center point between the
  eyes, longer outer pieces to the cheeks. **No painted shadow on the forehead.**
- Cheek locks in front of the ears, ending at the jaw (≈0.58–0.60) and curling in under the cheeks.
- Ahoge: one thin strand from the crown curling over toward her left.
- Back of head: smooth rounded dome with a center part and soft strand lines (inverted V near the
  hem, curves sweeping toward the tails); U-shaped hem just above the choker.
- Twin tails tied high on the back-sides of the head: a rounded loop over the tie, then a wide
  round bundle falling behind the shoulders to the skirt hem (≈0.33), tips curling inward.

### Hair accessories
- Her RIGHT (viewer's left, front): black ribbon bow with two long tails on the tail tie (≈0.78).
- Her LEFT (viewer's right, front): slanted black hairpin with a butterfly on its end (≈0.82) and a
  small black bow below it (≈0.78).

### Face
- Large round gray eyes (w ≈0.075, centers ±0.077 at y ≈0.67); a heavy lash line wrapping the top
  and outer side of the eye with a small flick, pale crease line above, short lower lash at the outer
  corner. Iris dark at the top fading light, soft pupil, one round catch light. Tiny nose and mouth.
- Soft pink blush ovals under the eyes (hatch lines only when flustered).
- Small ears partially visible through hair.

### Upper body
- White blouse/shirt with a black butterfly print on chest, small white frill at neckline.
- Black studded choker with silver O-ring and a small cross pendant on a short chain.
- Black harness: two suspender straps from shoulders down the chest to the belt, with silver
  rectangular buckles and O-rings; straps continue over shoulders to the back.
- Oversized white jacket worn **slipped off the shoulders** (rests at upper arm / elbow), very puffy
  sleeves, black strap bands with silver buckles around upper arms and cuffs, black strap tabs,
  hem reaching ~skirt length. Long dangling black straps with silver crosses hang from sleeves.
- Hands: small, mostly hidden by cuffs; black fingerless-glove hint.

### Lower body
- Black belt with silver square buckle at waist; silver chains loop from belt on her left hip,
  small white butterfly charm on skirt front-left.
- Short black pleated skirt (flared), with a white ruffled petticoat peeking below.
- White thigh-high socks; black garter/thigh strap with O-ring on her RIGHT thigh.
- Garter straps from skirt hem down to sock tops.

### Boots
- Chunky white platform boots, mid-calf. Black rounded toe cap, thick white lug sole with black
  tread band, 2–3 black buckle straps around the shaft with silver buckles, black butterfly/bow
  on front of shaft, a black heel tab.

### Bag
- Small black boxy bag centered on her back at waist height (≈0.43), flap with two buckle straps,
  white cat face patch, butterfly charm and keychain. Two short straps hang it from the back
  suspenders; silver chains drape from its sides toward each hip.

## 5. Expressions (bottom row of sheet, left→right)
| key | Thai | description |
|---|---|---|
| normal | ปกติ | open round eyes, tiny neutral/slightly down mouth |
| smile | ยิ้ม | eyes closed as happy upward arcs (^ ^), open smiling mouth, blush; "!?" |
| wink | วิงค์ | her left eye closed arc, right open, small smile; ♪ |
| surprised | ตกใจ | eyes wide, small pupils, small round "o" mouth; sweat marks |
| angry | งอน | pouty/sulky: half-lidded flat eyes, puffed small frown, anger marks |
| crying | ร้องไห้ | watery bluish-tinted eyes, tears streaming, wobbly frown |
| sleepy | ง่วง | closed downward-curved eyes, small relaxed mouth; "zzz" |
| blush | เขิน | strong red cheeks with hatch lines, shy eyes, wavy mouth; hearts |

## 6. Animation (src/character/anim/)

- `skeleton.ts`: procedural skeleton at the RIG joints (hips → spine → chest → neck → head, two bones
  per twin tail, shoulder/elbow/wrist, thigh/knee/ankle). After every part is built, `skinCharacter`
  re-binds each mesh as a SkinnedMesh with automatic distance weights; per-part rules keep hair
  rigid to the head, tails on the tail bones, skirt/bag on the torso, jacket/blouse off the legs.
  Outline hulls are skinned too (the outline shader includes the skinning chunks).
- `Animator.ts`: idle breathing; walking (legs, arm swing, hip bob, tail spring) around a loop on the
  stage, walking back to the center to face front when stopped; gestures wave, nod, bow, cheer, shy.
  Chibi arms are short: poses keep hands out to the sides/front, never overhead (they vanish into
  the head).
- Talking: the face cycles half/open mouth frames (`paintFace(expr, { mouth })`) with a light head bob.
- UI: Action panel (Walk, Talk, 5 gestures); keys W walk, S talk. The camera follows part of her
  walking so the travel still reads.

## 7. Tooling

- `npm run dev` — dev server.
- `node tools/shot.mjs --out shots/<dir> [--views front,side,back,threequarter,face] [--expr normal|all] [--w 600 --h 1100]`
  renders screenshots headlessly (starts its own Vite server). Files: `<view>[-<expr>].png`.
- `node tools/compare.mjs --ref reference/crops/front.png --a shots/x/front.png [--b shots/y/front.png] --out comp.png [--blind]`
  builds a labeled side-by-side. With `--blind` and two candidates, A/B order is randomized and
  the answer is written to `<out>.key.json` (do not read it until you've judged).
- URL params: `?view=front|side|back|threequarter|face|free&expr=<key>&ui=0`, plus `walk=1`, `talk=1`,
  `gesture=<wave|nod|bow|cheer|shy>`, `time=<s>` (pose time in screenshot mode; walking stays in place).
- `node tools/shot.mjs --q 'gesture=wave&time=1.1' --tag wave` renders a pose.
- `window.__kira` exposes `setView(name)`, `setExpression(key)`, `setWalking(on)`, `setTalking(on)`,
  `playGesture(name)`, `ready`.
