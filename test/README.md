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
npm run tour                  # P14: the guided First Flight advances by doing and persists tourDone
npm run shots                 # render PNG/JPEG screenshots of each screen to test/shots/
```

Notes: the harnesses pre-seed `localStorage` (tutorialSeen) to skip the first-run How-to.
`@napi-rs/canvas` occasionally hangs encoding a HUNT frame for certain seeds (a headless quirk —
real browsers are unaffected); render HUNT with a fixed seed if needed.
