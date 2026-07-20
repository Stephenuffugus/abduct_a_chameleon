# HANDOFF — v0.2 "Photo Loop" session (2026-07-19)

This is the complete record of the v0.2 build session so nothing is lost if the environment stops.
Read this + `docs/NEXT_SPEC.md` + the project memory to resume with full context.

## Owner's brief (verbatim intent)
Build "the next hot version" at professional game-studio quality: **"a way to make it so you lock
yourself in position, can look around, then zoom in and out and move the camera around, lock it,
paint, unlock and look — it needs to flow seamlessly for players"**; polish everything; smooth fun
UI/UX; a serious set of maps and unlockables. Long-term: huge game, massive multiplayer, maybe its
own website; eventually the skywolf studio game portal (probably standalone).

## What shipped (branch `glowup`, commits `3cc9f7a..2c4caeb`)

### Pass 9 — "The Photo Loop" (`3cc9f7a`)
The owner's camera flow. Designed by a 3-lens judge panel (kid-tablet / AAA-game-feel /
systems-risk → 2 adversarial judges); full synthesis in `docs/NEXT_SPEC.md`.
- **The stillness law** (inviolable): hops between LOOK and PAINT never move the camera; only
  returning to MOVE does — one eased glide home.
- **No lock button**: 🎨 from LOOK *is* the shutter (`camLock` set implicitly). Corner viewfinder
  brackets + 📌 pill chip + shutter SFX sell it.
- Free view-zoom `vz` (0.55–1.6 × zoomBase; detents FAR/SEEKER(0.78)/NORMAL/CLOSE) folded into the
  existing `inspectZoomT` ease — one formula in `updateCamera`. Wheel (+ctrl-wheel), two-finger
  pinch (pinch pointers glue the grabbed world point under the midpoint; on finger-lift the
  survivor re-anchors — the **re-seed rule**: any camera-authority handoff recomputes offsets so
  the next frame is pixel-identical), ＋⌖－ HUD cluster with detent dots, `-`/`=` keys, gamepad
  right stick + dpad.
- Exit grammar (inviolable): **pill = all the way home; everything else = one step back**
  (tap-empty / Esc / ✕ / 👁 hop held-PAINT→LOOK framing-identical).
- Studio dim 0.35 over a held shot (paint inside your framed view); compose-nudge (self-disarming
  tween) keeps the body above the panel; reticle range extends over a held frame; threat-aware YOU
  arrow ("⚠ ship near you") prevents cheap-shot spotted pops; spotted glides home at 1.5×, never
  snaps; ❄ freeze un-gated while Looking; ambient FX shed at survey altitude; zoom-out floor rises
  on struggling tablets (qLevel ≥ 2). All camera state render-side → multiplayer-safe.

### Pass 10 — UX polish (`39460c4`)
Settings fully keyboard/gamepad navigable (settingsSel ring + auto-scroll, ←→ adjusts sliders);
level-select scrolls (drag with tap-on-clean-release, wheel, keyboard-follow, clipped hit rects);
toast queue; title screen uses the real humanoids (waving painted hider + big-head alien) and
scales to short viewports; 180 ms menu fade-slide (reduced-motion aware); How-to-Play teaches the
photo loop; studio lifts above the dock on narrow screens; keyboard dash/decoy/ink gated to MOVE;
blur closes the studio.

### Pass 11 — serious map set (`1c5298e` builder + `2c4caeb` critique fixes; engine `6b69c96`)
- 6 expansion maps via `tools/generate-levels.mjs`'s new crafted `design()` API (carvePath,
  seamStrip, checkerboard, stripes, clearing, courtyard(+flood), coverCluster, coverPair, coverRow,
  bridge, fillRect) on a **separate RNG stream** — the six legacy maps stay byte-identical:
  - **Riverline** — valley of three bridges (92×64, 6 seekers)
  - **Sunken Ruins** — flooded walled courtyards (84×62)
  - **Cinderfield** — seam causeways through lava, two southern crossings (88×62)
  - **Frostharbor** — docks, crate rows, ice floes (96×66, 22 hider spawns)
  - **Scrapline** — junkyard alleys, nine distinct yards (84×60)
  - **Twin Gardens** — 2-tone mosaic playground, seams on bed borders (80×60)
- Every map was adversarially critiqued (grid-level analysis: dead spawns, dead cells, seam
  density, cover pairing, patrol space) and fixed to 0 dead spawns / 0–3 dead cells. Critique
  record: `docs/notes/map-critiques-v02.json`.
- Engine: `MAP.biome` honored before name-inference; maps ≥ 4800 cells field +1 UFO in
  Survive/Daily (practice/heat exempt). `tools/validate-maps.mjs` gates everything.

### Pass 12 — progression (`74b9d7f`)
XP on every scored round (score/10 + win bonus) through all three end funnels; triangular level
curve (`xpLevel`); summary '+XP' + level bar; 5 CHALLENGES (Untouchable→Bolt, Ghost Hunter→Star,
Quick Banker, Marathon Ghost, Field Guide → XP); 5 new head accents (Beret Lv3, Sprout Lv5,
Headset Lv8, Bolt, Star); wardrobe level header + wrapped accent grid; **map-unlock arc** —
manifest rows 7+ unlock at Lv 2–7 (`entry.unlockLevel` in `loadLevels`, gated in
`drawLevelSelect`); `PROGRESS.xp/challenges` with `loadProgress` back-compat.

## Verification state
`cd test && npm run all` → **13 suites, all green**: smoke, survive, abilities, hunt, timeattack,
math, twotone, pass8, controls, **lockandlook** (P9: stillness law, implicit hold, wheel+pinch —
harness gained WheelEvent + two-pointer helpers), **progression** (P12: XP awarded/persisted),
**maps** (all 13 levels boot into PLAYING in the real engine, unlocks pre-seeded). Real-pixel
screenshots: `npm run shots` → `test/shots/`.

## Review — COMPLETE (2026-07-20)
The adversarial review ran 6 dimension finders (36 raw findings, saved to
`docs/notes/review-findings-raw-v02.json`) + partial verification (29/30 captured votes upheld).
All findings triaged by hand and fixed in three batches ("Review fixes batch 1/2/3" commits):
state-machine integrity (TA/Hunt end-funnel leak, pinch lifecycle, gamepad drift, pointercancel),
camera math (pan-clamp glide, zoom-under-drag re-anchoring, nudge token/settled-zoom, ambient gate,
threat-arrow anchor), and UI/progression/test hardening (level-select scroll fight, storage armor,
deterministic lockandlook, big-map +1-UFO coverage). Deliberate skips: #29 (inspect chrome fades
with rings but header pops — cosmetic), #30 (menu fade translates 14px from hit rects for 180ms —
accepted tradeoff). All 13 suites green.

## Post-review pieces (2026-07-20, all green, all pushed)
- **P13** — web presence (meta/og/theme-color/SVG-data-URI favicon), daily 🔥 streaks
  (`PROGRESS.daily`, +2 streak challenges), wardrobe challenge panel with hints, sound identity
  (lookIn/home whooshes, level-up arpeggio).
- **P14 "First Flight"** — guided practice tour: 5 steps advanced by watching the live sim on a
  REAL-time clock (practice slow-mo would stall it), ✕-only interactive banner, persists
  `settings.tourDone`, suppresses coachOnce while active. Suite: `test/tour.js`.
- Pause menu gains **How to Play** (help renders over the pause scrim; resume clears it); pause
  rows space adaptively for short viewports.
- **P16** — trail cosmetics (`PROGRESS.equipped.trail`): Bubbles Lv2 / Sparks Lv6 / Leaves via
  Marathon Ghost, emitted through the pooled particle system only while visibly moving
  (`conceal<0.5` gate = camo-safe by construction); wardrobe TRAILS chip row.
- **Feel pass** — staged summary reveal (headline → grade slam → stat cascade → score count-up →
  best/XP after the count; all three end funnels carry `t0`; reduced-motion = instant); floating
  world-space 'ftext' popups at the earned moments (NEAR MISS! / BANKED x/y / vanished ✓ /
  CAUGHT x/y 🛸); level cards show their identity subtitle; Settings can re-arm the tour; first
  PLAY no longer opens the text overlay (First Flight teaches instead). Tour test matches via Q —
  KeyM is shadowed by the mute binding (documented quirk), the old path passed only on
  spawn-matched luck.
- **📷 Snapshot** — the camera cluster's fourth button captures the framed world layer (grabbed
  post-drawRound, pre-HUD) as a PNG download; near-miss popup shows its +150 value.
- Suite count: **14** (`npm run all`), plus `npm run shots`.

## Durable artifacts
- `docs/NEXT_SPEC.md` — the Pass 9–12 spec + invariants (merge gates).
- `docs/notes/codebase-map-v02.json` — six-concern structural map of index.html (functions, line
  anchors, invariants, gotchas, extension points) as of ~`1f13087`; line numbers drift, concepts don't.
- `docs/notes/map-critiques-v02.json` — the per-map adversarial critiques the fixes answered.
- Project memory (`~/.claude/.../memory/`): `v02-photo-loop.md` + updated `how-to-test-the-game.md`.

## Inviolable rules for future sessions (merge gates)
1. The stillness law and the "pill = home / everything else = back" exit grammar.
2. Projections read `cam`+`zoom` only; shake is offset-only; camera state stays render-side.
3. Sim determinism: seeded rng consumption order; DAILY reproducible; camo calibration
   byte-identical on uniform ground (`npm run math` + `npm run twotone`).
4. `window.__aac.state` is add-only; classic `<script>` (jsdom).
5. Every transition out of PLAYING clears studio + `ctrlMode`/`camLock`/`pinch` (grep every
   `ctrlMode='MOVE'` assignment when touching transitions).
6. Maps change only through `tools/generate-levels.mjs` + `tools/validate-maps.mjs`; legacy six
   stay byte-identical; baked map stays LAST in `LEVELS`.
7. `_hud.modeButtons` stays length 4 (controls.js asserts it).

## Next (owner roadmap)
- Multiplayer: the `SeekerController` seam + deterministic fixed-timestep sim are ready; camera/vz
  are per-client. Decide netcode + recon-fairness caps (how much a hider may scout per mode).
- Standalone website / skywolf portal packaging; accounts/cosmetics sync; real art pass.
- Ideas parked: power-user absolute camera freeze ("security cam"), within-round zoom-preference
  memory, sustained-dwell perf budget test on low tier, portrait-specific layout audit.
