# Gauntlet Loop protocol

Every piece of Shion is built by a **builder** agent and judged by a **fresh, harsh critic** agent.
A piece loops (builder fixes → new fresh critic) until the critic passes it.

Project root: this folder. Read `SPEC.md` first — it holds the reference analysis, palette,
proportions, orientation convention and tooling.

## Folder conventions

```
gauntlet/<piece>/round-<N>-builder.md   builder notes: what changed, known gaps
gauntlet/<piece>/round-<N>-critic.md    critic report: scores, blind result, verdict, fix list
shots/<piece>/round-<N>/                builder's renders for round N
shots/<piece>/round-<N>-critic/         critic's own fresh renders for round N
shots/<piece>/accepted/                 renders of the last version a critic preferred (baseline)
```

## Rules for builders

1. Only edit the files your piece owns (listed in your brief). Shared files (`src/render/toon.ts`,
   `src/character/rig.ts` after the base piece, `src/character/Shion.ts`, `src/app/*`) are
   read-only unless your brief says otherwise. Other pieces are being built in parallel — do
   not touch their files; if something of theirs blocks you, note it in your builder notes.
2. Use `RIG` landmarks and `PALETTE` colors; use `toonMaterial` / `toonMesh` / `addOutline` from
   `src/render/toon.ts` so the look stays consistent.
3. Build real geometry (custom BufferGeometry, Lathe/Tube/Extrude/Shape, deformed primitives,
   canvas textures for printed/drawn detail). No external model files or image assets except
   textures you generate procedurally in code.
4. Look at your work constantly: `node tools/shot.mjs --out shots/<piece>/round-<N> --views ...`
   and `node tools/compare.mjs` / `node tools/zoom.mjs` against `reference/crops/*`. Iterate on
   your own until you believe it is excellent before handing over.
5. `npx tsc --noEmit` must pass and the page must log no errors (shot.mjs reports them).
6. Keep code clean: small focused functions, typed, comments only where they add information.
7. Finish by writing `gauntlet/<piece>/round-<N>-builder.md` (changes, remaining gaps).

## Rules for critics

You are a harsh art director. You did not build this; you have no stake in it. Default to FAIL.

1. Render fresh: `node tools/shot.mjs --out shots/<piece>/round-<N>-critic --views <views> [--expr ...]`.
   Never judge from the builder's screenshots.
2. Reference vs ours: `node tools/compare.mjs --ref reference/crops/<view>.png --a <our png> --out <...>`.
   Zoom into details with `tools/zoom.mjs` on both the reference crop and our render.
3. **Blind A/B vs previous** (if `shots/<piece>/accepted/` exists):
   `node tools/compare.mjs --ref <ref> --a shots/<piece>/accepted/<view>.png --b <fresh png> --out <...> --blind`.
   Decide which of A/B matches the reference better and write your choice down in the report
   **before** reading the `.key.json`. Then read the key and record whether the new version won.
4. Score each rubric item 1–10 against the reference (10 = indistinguishable in design and
   quality from the reference art translated to 3D). Be specific and concrete.
5. Verdict:
   - **PASS** only if (a) the new version won the blind A/B on the majority of views (or there is
     no previous version), and (b) every rubric item scores ≥ 8, and (c) you are genuinely
     impressed — you would prefer it to the reference as a 3D asset.
   - Otherwise **FAIL**.
6. Write `gauntlet/<piece>/round-<N>-critic.md` with: blind A/B results, scores table, verdict,
   and a **prioritized, concrete fix list** (what is wrong, where, what it should look like, with
   numbers where possible — positions in RIG units, sizes, colors). Do not edit source code.
7. If the verdict is PASS (or the new version won the blind A/B), copy your fresh renders into
   `shots/<piece>/accepted/` (replace old files) so they become the new baseline.
