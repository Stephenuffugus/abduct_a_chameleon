# Headless tests

No browser needed — these load `../index.html` in **jsdom** (game logic) or **@napi-rs/canvas**
(real pixels, for screenshots), pump frames, fire input, and fail on any runtime error.
The game must keep a classic `<script>` and the `window.__aac.state` diagnostic hook.

```bash
cd test && npm install        # jsdom + @napi-rs/canvas
npm run all                   # smoke + survive + abilities + hunt (assert 0 errors)
npm run smoke                 # boot → menu → round → studio → pause
npm run survive               # a full Survive round into an abduction → SUMMARY
npm run abilities             # fires Freeze/Dash/Decoy/Ink, checks effects
npm run hunt                  # Hunt mode: fly the UFO, scan, catch a bot
npm run timeattack            # Time Attack "Beacon Run": bank a beacon
npm run math                  # camo colour-match math vs docs/BUILD_SPEC.md calibration
npm run twotone               # P8 Split Camo oracle: per-tone match == uniform, two-tone beats a seam
npm run pass8                 # P8 "Living Camo": coach, touch-offset, split toggle, drips, blend-snap, Blend Book
npm run lockandlook           # P9 "Photo Loop": stillness law, implicit camera-hold, wheel+pinch zoom, hop-back/pill exits
npm run progression           # P12: XP awarded at round end, level derived, persisted; __aac add-only shape
npm run maps                  # P11: every manifest level boots into PLAYING in the real engine (unlocks pre-seeded)
npm run capture               # P23: a fleeing runner IS catchable, re-hide still breaks the beam, riverline bridges shelter, tongue+burrow work
npm run tour                  # P14: the guided First Flight advances by doing and persists tourDone
npm run shots                 # render PNG/JPEG screenshots of each screen to test/shots/
npm run paint3d               # 3D ONLY: the paint studio fits a landscape phone and both exits work
npm run twotone3d             # 3D ONLY: the two-tone camo model (the 3D sibling of twotone)
```

## The two 3D tests (`paint3d.mjs`, `twotone3d.mjs`)

Everything above loads the **2D** `../index.html` in jsdom. The 3D file cannot be tested that way
— it needs real WebGL — so `paint3d.mjs` drives `../abduct-3d.html` in **headless Chrome with
swiftshader** instead. It needs `puppeteer` (in devDependencies) and **skips with exit 0** if that
is not installed, so the suite still runs on a machine without it.

It guards the three things that broke on 2026-08-01, at 932x430, 844x390 and 667x375:

1. **The softlock.** The studio was anchored `top:50%` + `translateY(-50%)` and rendered 703px
   tall inside a 430px viewport, so `#paintClose` sat at y=-123 and `#paintDone` at y=506. Both
   exits off-screen, and a phone has no `E` key — opening the studio, which is the whole game,
   could only be escaped by reloading. The test fails loudly if either exit leaves the screen.
2. **The touch law.** 30 of 34 controls measured under 44px. Now 0, asserted in RENDERED px.
3. **MATCH GROUND must actually match.** `matchFor` compared three.js LINEAR colour against sRGB
   canvas bytes, so a *perfect* paint scored 65% and camo could never pass the hunter's 0.70/0.75
   gates. The test fails below 95%.

`twotone3d.mjs` is the oracle for **two-tone camo** — the 3D port of the 2D game's P8 Split Camo,
checked through `window.__aac3dCamo` so the rules are asserted without walking a character across a
map. It fails if a single colour stops being taxed beside cover (that tax IS the decision), if a
two-tone coat ever scores worse than one colour, or if a split starts helping on open ground where
it must stay inert.

⚠ Run paint3d at more than one viewport height. The `?` button covering the 🎨 toggle only reproduces
at 390 and 375 tall — 430 alone looks clean, which is how that one got missed the first time.

Notes: the harnesses pre-seed `localStorage` (tutorialSeen) to skip the first-run How-to.
`@napi-rs/canvas` occasionally hangs encoding a HUNT frame for certain seeds (a headless quirk —
real browsers are unaffected); render HUNT with a fixed seed if needed.
