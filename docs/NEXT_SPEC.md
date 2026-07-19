# NEXT_SPEC — Passes 9–12 · "The Photo Loop" and the studio-grade build-out

Owner's brief (2026-07-19): *"…a way to make it so you lock yourself in position, can look around,
then zoom in and out and move the camera around, lock it, paint, unlock and look — it needs to flow
seamlessly for players. Polish everything, work the UI to make UX smooth and fun. Serious set of maps
and unlockables. Professional game-studio quality."*

Design process: 3 independent designs (kid-tablet / AAA-game-feel / systems-risk lenses) → 2 adversarial
judges → this synthesis. The kid-tablet design won on every axis; the others contributed the feel
vocabulary and the engineering discipline below.

---

## Pass 9 — THE PHOTO LOOP (lock → look → zoom → hold → paint → unlock)

Every concept maps to something the reference player (an 8-year-old on a tablet) already knows:
**pinch = zoom** (Photos app), **shutter = "I kept this view"**, **one big pill = "take me home."**

The flow: tap 👁 and you plant (anchor ring pulses under your feet) while the camera airlifts to
seeker altitude. Drag to look, **pinch/wheel to zoom** (0.55×–1.6× of base, detents at FAR / SEEKER /
NORMAL / CLOSE). Frame a shot you like and tap 🎨: **shutter click** — the view is now HELD (corner
viewfinder brackets draw in, 📌 lights on the pill) and the studio slides up *over your framed shot*
with a light dim, so you paint while watching your tiny faraway self repaint live from the hunter's
altitude. Tap empty space to hop back to LOOK with **pixel-identical framing** (accidental taps cost
nothing). Only the MODE pill glides all the way home to MOVE.

**The stillness law (the single sentence that produces the seamlessness):**
> Hops between LOOK and PAINT never move the camera. Only returning to MOVE does — one eased glide home.

### State (no new ctrlModes; all render-side; multiplayer-safe = per-client)
- `camLock` (bool) — "the shot is held." Set **implicitly** in `enterPaint()` when called from
  INSPECT (the kid never chooses it — the shutter IS the lock). Cleared on: hop back to INSPECT,
  any return to MOVE, spotted-pop, blur, pause, round end, `startRound`, and the line-774 desync healer.
- `vz` / `vzTarget` — user view-zoom multiplier on `zoomBase`, `VZ_OUT=0.55 … VZ_IN=1.6`,
  `VZ_SEEKER=0.78 (=== INSPECT_ZOOM_MUL)`, detents `[0.55, 0.78, 1.0, 1.6]`. Eased at `VZ_RATE=7`
  for buttons/keys; tracks 1:1 during an active pinch/wheel gesture. **Fresh INSPECT entry resets to
  0.78** (keeps "eases to seeker altitude by default" true for tests and for predictability).
- `pinch` — `{idA,idB,d0,vz0,…}` gesture record; new pointer role `'pinch'`.

### Camera (one formula, one condition)
- `zoom = max(floor, zoomBase·(1+FX.zoomPunch)·(1+(vz−1)·inspectZoomT))` — `vz` generalizes
  `INSPECT_ZOOM_MUL` inside the existing ease; MOVE zoom untouched; exit-returns-zoom falls out of the
  existing `inspectZoomT` decay for free.
- `inspectZoomT` target is 1 when `ctrlMode==='INSPECT' || (ctrlMode==='PAINT' && camLock)` —
  **that condition IS the camera lock.**
- Pan policy: PAINT forces `camPan=0` only when `!camLock`; locked PAINT holds pan like INSPECT.
  MOVE→INSPECT now **preserves** `camPan` (a peek flows continuously into the look).
- INSPECT pan clamp scales with altitude: `INSPECT_PAN_MAX · clamp(1/vzEased, 1, 1.8)`.
- Pivot-preserving zoom: wheel zooms toward the cursor, pinch toward the finger midpoint — implemented
  as data edits to `camPan` only; projections keep reading `cam+zoom`. Active `'pan'` drags are
  **re-anchored whenever zoom changes** (the stale-anchor gotcha).
- Re-seed rule (universal): on any camera-authority handoff (finger lift, unlock, ⌖) recompute offsets
  so the next frame is pixel-identical.
- Spotted-while-locked: brackets shatter outward, camera **glides** home at 1.5× rates — never snaps.
- Perf: low `qLevel` clamps the zoom-out floor (~0.62); ambient drifters + grain suppressed when
  eased zoom < 0.8×zoomBase.

### Exits — "pill = home, everything else = back"
- Locked PAINT: ✕ / Esc / 👁 / B / tap-empty → back to LOOK, framing byte-identical. Pill → MOVE.
- Unlocked PAINT (entered from MOVE): **byte-identical to today** (tap-empty/✕/Esc → MOVE) — every
  legacy test rides this path.
- INSPECT: 👁 / Esc / pill → MOVE glide home.

### Input
- **Touch:** pinch (second non-UI pointer while a `'pan'` pointer is live → both become `'pinch'`;
  in INSPECT the second finger may come from the move side too — two-handed tablet grip — but a live
  `'joystick'` pointer is never conscripted). In MOVE, a pan-side pinch **auto-enters INSPECT** seeded
  from the gesture (the discovery moment). One-finger drag above the studio panel reframes during
  locked paint. Zoom **buttons** 🔍±(≥48px, detent dots) on the ability-column side in INSPECT/locked
  PAINT — gestures are enhancement, buttons are the guarantee.
- **Desktop:** wheel zooms (ctrl+wheel = trackpad pinch handled identically, both preventDefault'd);
  wheel-out in MOVE enters INSPECT; wheel in unlocked PAINT engages the hold and zooms. `-`/`=` detent
  step in INSPECT only (studio keeps its saturation keys).
- **Gamepad:** right stick (axes 2/3, previously unused) pans; D-pad detent-steps zoom in INSPECT.
- FREEZE is un-gated in INSPECT (Survive/Heat): hard-anchor with settle bonus while scouting.

### Studio while held
- Dim drops 0.72 → ~0.35 (panel keeps its own solid bg) — you paint *inside your framed shot*;
  wet-paint drips, crawl and blend-snap render in-world at altitude: the hero moment.
- Entry compose-nudge (narrowed): only when the body would sit behind the panel, ease `camPan` by the
  minimal vertical delta (~260ms; instant under reduced motion). A small ⭣ body indicator covers
  deliberate far-framing.
- Reticle/MATCH range extends to the held frame in Practice; scored modes keep a range cap (tuning knob).
- Threat honesty: while the body is off-frame in a held camera, a UFO closing on your *body* pulses the
  YOU edge-arrow amber→red with a heartbeat ramp — no cheap-shot spotted pops.

### First-run coaching (one-shots, settings-persisted)
- First INSPECT: "🤏 pinch to zoom · drag to look".
- First auto-hold: "📌 View held — the pill takes you home".

### Tests (harness upgrade first: WheelEvent + two-pointer pinch helpers)
`test/lockandlook.js`: stillness law (hop preserves cam/zoom exactly), auto-lock on 🎨-from-INSPECT,
empty-tap hop back (framing identical), pill → MOVE glide, wheel/pinch zoom bounds + detents, pan
re-anchor under zoom, MOVE-entry paint byte-identical, spotted glide, reset-site sweep (pause/blur/
round-end clear camLock/vz), __aac add-only shape.

---

## Pass 10 — UX/UI polish sweep (studio-grade)
- Title screen glow-up; menu transitions (eased slide/fade, reduced-motion-aware).
- Toast queue (single-slot overwrite bug), level-select subtitle fix (says "Survive" for every mode),
  keyboard/gamepad support in SETTINGS (currently pointer-only), HUNT HUD chrome unified with hider HUD.
- Sound polish: UI click family, shutter, detent ticks, hold/release whooshes.
- Portrait-tablet layout pass (studio panel + zoom stack + dock collisions).

## Pass 11 — Serious map set (the owner's most-emphasized priority)
- Extend `tools/generate-levels.mjs` with crafted-feel primitives: `carvePath` (rivers/roads),
  `ring` (clearings), courtyards with interiors, seam-strips (1–2 tile terrain butts that reward
  2-tone Split Camo), cover clusters with LoS shadows.
- 6 new maps (12 total), each with a hiding-spot identity; keep ≤ ~110×80 (terrain-cache bake limit);
  16+ spread hider spawns; seekers near edges; validate all via `tools/validate-maps.mjs`.
- Per-map explicit `biome` field (validator + generator + `startRound`).

## Pass 12 — Deeper unlockables/progression
- XP + level curve on top of existing score funnels (`finishRound`/`endHunt`/`endTimeAttack`).
- Challenges (Blend-Book-style checkers), map-unlock arc in `LEVELS`/level-select (locked cards),
  more cosmetics (wrapping wardrobe grid), daily streaks.
- All add-only on `PROGRESS` with `loadProgress` back-compat defaults.

## Invariants (merge gates)
- Classic `<script>`; `window.__aac.state` add-only; projections read `cam+zoom` only; sim untouched
  by camera (determinism + DAILY seed order); camo calibration byte-identical on uniform ground;
  every `ctrlMode='MOVE'` assignment site clears `camLock` (grep before merge); `_hud.modeButtons`
  stays length 4; baked map stays last in `LEVELS`.
