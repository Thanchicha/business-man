# UI — round 1 builder notes

## What was built
Files: `src/ui/Controls.ts`, `src/ui/icons.ts` (new), `src/ui/style.css`, `index.html`, `tools/ui-shot.mjs` (new).
`src/main.ts` is unchanged (it already passes `params`, which carries `shot`).

- **Title block** styled like the sheet: white "Shion" in Mochiy Pop One (loaded subset `text=Shion` only), "3D Character Model ♡"
  subtitle, a white cat-face doodle on the left and sparkles + round glasses doodle on the right. The block is tilted -4° with
  a soft ink drop shadow so the white reads on the gray backdrop.
- **Panels**: white translucent (60% + 12px backdrop blur), 20px radius, soft lavender-ink shadow, headed "♡ View ♡" /
  "♡ Expression ♡" with inline SVG outline hearts. Text is ink `#3a3842`; labels use Mali (a rounded handwritten font with Thai support).
- **View presets** Front / Side / Back / 3/4 / Face, each with a tiny chibi-head doodle showing the angle. They call
  `viewer.setView(view, reducedMotion)` so the move is instant when reduced motion is on. Choosing a preset stops the turntable.
  When the user starts orbiting, or turns the turntable on, the preset highlight clears (the view is "free").
- **Expressions**: 8 buttons with hand-drawn SVG face doodles (ปกติ dot eyes; ยิ้ม ^^ + "!?"; วิงค์ one closed eye + ♪;
  ตกใจ ring eyes, "o" mouth, sweat drop; งอน half-lidded eyes, slanted brows, anger mark; ร้องไห้ blue tear streams + wobbly mouth;
  ง่วง closed arcs + "zZ"; เขิน >< eyes, hatched blush, pink heart). Each shows the Thai label, the English label and a key badge
  (1–8, hidden on touch). Strokes use `currentColor`, so the doodles turn white on the dark ink active state.
- **Keyboard**: 1–8 pick an expression, ← / → cycle through them, T turntable, R reset, H hide/show UI. Shortcuts are ignored
  while Ctrl/Meta/Alt is held or the focus is in a text field.
- **Tools**: Turntable (`controls.autoRotate`; it can't be turned on in shot mode, and its icon spins while on), Reset
  (returns to the default 3/4 view), Hide UI. When hidden, a toast says "press H or tap the eye", and a 44px eye button sits
  top-right: invisible until hover or focus on desktop, 45% opacity on touch. Hiding with H blurs focus so screenshots are clean.
- **Hint line**: mouse version "Drag orbit · Scroll zoom · Right-drag pan" plus key hints; a touch version
  ("Drag · Pinch · Two fingers pan") is switched in by `(hover:none) and (pointer:coarse)`.
- **Accessibility**: `aria-pressed` on every view, expression and turntable button; `role=group`/`toolbar` with labels;
  `aria-keyshortcuts`; `lang="th"` on Thai labels; a polite live region announces changes; `inert` on hidden panels;
  focus-visible style is a 2.5px ink outline plus a pink halo; reduced motion turns off transitions and spin and makes camera moves instant.
- **URL sync**: `view` and `expr` are written back with `history.replaceState`, so links are shareable. Shot mode skips this.

## Layout (responsive)
- **Landscape** (aspect ≥ 5/4 and width ≥ 640): title top-left, View panel under it, tools top-right, Expression panel as a
  2×4 grid centred on the right, hint bottom-left. Nothing overlaps the character.
- **Short landscape** (height ≤ 620, e.g. a phone on its side at 812×375): compact sizes, icon-only tools, no hint.
- **Portrait / square** (tablet 820×1180): title + hint top-left, tools top-right, and a bottom dock with the View
  segmented row above an 8-across Expression row. The dock sits over the boots/legs only.
- **Phone** (< 600 px wide, 375×812): icon-only 42px tools, compact title, hint under the title, a dock with 5 equal view buttons and
  a 4×2 expression grid (icon beside the Thai/English text, 46px tall). The dock's top edge is about 120px below the chin, even in Face view.
- Every touch target is ≥ 42px; nothing scrolls horizontally; safe-area insets are respected.

## Verification
- `node tools/ui-shot.mjs --out shots/ui/round-1` renders `desktop`, `desktop-face-smile`, `desktop-focus`, `desktop-hidden`,
  `tablet`, `mobile`, `mobile-face-blush` and `mobile-landscape`. For each shot it also checks for horizontal scroll, overlap with the
  projected face box (using the same fit maths as Viewer), overlap between UI boxes, boxes off-screen, buttons under 40px and loaded fonts.
  Final run: every check passed on every shot, and there were no page errors.
- Puppeteer functional check: 3 → wink, ←×3 → blush (wraps around), T → turntable on and view becomes free, click Side → turntable
  off and Side is active, R → 3/4. The URL and the live region update each time.
- `npx tsc --noEmit` passes.

## Known gaps / notes
- Judged against the placeholder blockout. The real hair is about 0.5 H wide, so in Face view on desktop the hair flare (not the face)
  will run under the side panels. They are translucent, so this is acceptable.
- The white title on the light-gray backdrop matches the sheet but has low contrast (it is decorative; the page `<title>` and
  heading text stay the same for screen readers).
- Google Fonts need network access; the fallbacks are Itim, then system ui-rounded, then Segoe UI.
- The tablet hint line is small (12.5px) by design, to keep it unobtrusive.
