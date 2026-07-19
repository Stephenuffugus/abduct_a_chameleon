I've now fully read `/workspaces/abduct_a_chameleon/index.html` (all 1507 lines) and cross-checked the seam/determinism contract in `docs/BUILD_SPEC.md`. Here is the reconciled single source of truth.

---

# ABDUCT A CHAMELEON — ENHANCEMENT SPEC v2

**The one build document. Ships in 7 additive passes on the single `index.html`. Reconciles all five specialist specs; where they disagreed, the resolution here is final.**

---

## 0. THE VISION (committed, cohesive)

**"MOONLIT ABDUCTION."** One failing-CRT night, seen over six different grounds. The world is cold neon-noir — a low blue moon, cyan scanners, heavy blue-black vignette, faint scanlines/chromatic fringe. Against that cold field there is exactly one warm, soft, *living* thing: **you**, a jewel-like chameleon whose only defense is to paint itself into the desaturated ground until two wet eyes float alone. The hunters are the opposite language: **cold machined chrome**, hard ellipses, clinical rings, snappy red/cyan snaps.

The three specialist visions are not in conflict — they are three layers of one idea:

| Layer | Language | Owner spec |
|---|---|---|
| **World** | Moonlit neon-noir, emissive-only saturation, per-biome color grade | art-biomes |
| **Character** | Warm living jewel (you) vs cold chrome (them); secondary motion everywhere | character-anim |
| **Feel/Audio** | Warm elastic overshoot for player acts; cold sharp hitch for threats | juice-feel |

Everything is procedural/synth, baked-once where possible, pooled, culled, allocation-free in hot paths. **The camo sampler (`terrainReference`) reads the `TERRAIN_RGB` hex table, never canvas pixels — so no amount of texture/art can desync detection. That is the safety rail the entire art pass rides on.**

---

## 1. MASTER DECISIONS (quick reference)

- **Art vision:** Moonlit noir, three light sources only (moon / scanner / your paint). Emitters are the only saturated pixels. Per-biome sky + multiply grade + drifter make the six levels readable at a glance while all sharing one night.
- **Chameleon look:** Warm rounded body, curling spiral tail, dorsal crest, **two independently-swiveling eye turrets that snap to the nearest UFO**, squash-&-stretch locomotion, breathing idle. Concealment = melt into ground via alpha + terrain-color edge-dither, with eyes as the last thing to fade (the "ghost with eyes").
- **UFO look:** 6 baked chrome-hull sprites (one per FSM state), live dynamic layers only (beam, scan-ring, thrusters, rim-lights, reticle, shadow-altitude, notice "!"). State = personality (bored PATROL → hunting SCAN → banking INVESTIGATE → aggressive CHASE → tractor BEAM → powered-down COOLDOWN).
- **Abilities (4, own cooldowns, no energy bar):** **FREEZE** (root, settle instantly, raise open-cap to 0.985), **DASH** (burst reposition, flare conspicuity), **DECOY** (painted twin steals belief), **INK** (breaks line-of-sight).
- **Modes (6, a 2×3 grid):** PRACTICE/ZEN, SURVIVE (both exist), **TIME ATTACK "Beacon Run"**, **HEAT "Endless"** (wire the greyed button), **DAILY**, **HUNT** (headline).
- **Hunter mode:** You fly the UFO (`HumanSeeker` controller); bot chameleons hide with the *same camo math* (`BotHider`). Falls straight out of the existing `SeekerController` seam — zero engine rewrite. Scan-pulse reveals well-hidden bots; beam abducts them. Proves the multiplayer seam.

---

## 2. THE ONE CONSTANTS + SETTINGS BLOCK

Paste into §1 CONSTANTS. **Reuse the easing kit already at lines 112–118** (`easeOutCubic, easeInOutCubic, easeOutQuad, easeOutBack, easeOutElastic, pulse`, plus `smoothstep`) — do **not** redeclare them. Add only the three missing ones.

```js
const TAU = Math.PI*2;
// --- easing additions only (rest already exist L112-118) ---
const easeInCubic   = t=> t*t*t;
const easeInOutSine = t=> -(Math.cos(Math.PI*t)-1)/2;
const triWave       = ph=> 2*Math.abs(ph-Math.floor(ph+0.5));

// ===== P1 ART / POST =====
const GRADE_ALPHA=0.22, SCANLINE_ALPHA=0.05, SCANLINE_PERIOD=3;
const CA_SHIFT=3, CA_ALPHA=0.06, VIGNETTE_EDGE='rgba(8,12,26,0.62)';
const AMB_CAP=56, AMB_GLOW_MAX=120;          // ambient drifters / ground glow blits per frame

// ===== P3 CAMERA / TRAUMA (override L80-82 CAM_*, SHAKE) =====
const CAM_STIFFNESS=11.0, CAM_DEADZONE_X=12, CAM_DEADZONE_Y=9;
const CAM_LOOK_K=0.18, CAM_LOOK_MAX=42, CAM_LOOK_SMOOTH=6.0;
const SHAKE_MAXOFF=16, SHAKE_MAXROT=0.030, TRAUMA_DECAY=1.9;
const TRAUMA = { repaint:0.18, uiConfirm:0.10, spotted:0.35, beamLock:0.45,
                 nearMiss:0.30, abduct:0.85, win:0.20 };
const PMAX=220;                              // pooled gameplay particle cap (comfort-scaled -> PCAP_EFF)

// ===== P5 ABILITIES =====
const FREEZE_RAMP=1/0.6, FREEZE_DECAY=1/0.4, FREEZE_CAP_MAX=0.985, FREEZE_STILL_MULT=0.5;
const DASH_SPEED=520, DASH_TIME=0.16, DASH_CD=2.5, DASH_FLARE_ADD=0.5, DASH_FLARE_TIME=0.5;
const DECOY_LIFE=6.0, DECOY_CD=12.0, DECOY_POP_COOLDOWN=2.0, DECOY_MAX=1;
const INK_R=90, INK_LIFE=3.5, INK_CD=10.0, INK_FADE=0.6, INK_MAX=2;

// ===== P5 MODES =====
const BEACON_R=30, BEACON_HOLD=1.2, BEACON_CONCEAL=0.6, TA_PENALTY=15, TA_BEACONS=5;
const HEAT_RAMP=25, HEAT_UFO_EVERY=60, HEAT_UFO_CAP=6;
// ===== P6 HUNT =====
const HUNTER_SPD=150, HUNTER_TAU=0.18, PULSE_CD=3.0, PULSE_REVEAL=0.25, PING_HOLD=2.5;
const HUNT_TIME=120, HIDER_COUNT={EASY:3,NORMAL:4,HARD:5}, BOT_HIDE_SPD=95;

// ===== PERSISTENCE KEYS (bump settings; new stores) =====
const LS_SETTINGS='aac.settings.v2';   // was v1 — migrated
const LS_PROGRESS='aac.progress.v1';   // cosmetics/unlocks/stats
const LS_DAILY   ='aac.daily.v1';      // {date,score,done}

const DEFAULT_SETTINGS = {
  // legacy (kept)
  muted:false, lastMode:'SURVIVE', lastLevel:0, lastDiff:'NORMAL',
  // audio (0..1)
  volMaster:0.85, volSfx:1.0, volMusic:0.65, musicOn:true,
  // comfort  (motion is the single juice multiplier source of truth)
  motion:'full',          // 'full'|'reduced'|'minimal'  -> FX.motion 1/0.45/0
  screenShake:'full',     // 'full'|'low'|'off'          -> extra shake multiply
  photosensitive:false,
  // accessibility
  colorblind:'off',       // 'off'|'deut'|'prot'|'trit'
  alwaysGlyphs:false, highContrast:false, textSize:'M', // 'S'|'M'|'L'
  // touch / control
  haptics:true, handed:'right', joystick:'dynamic', joyAnchor:null, sensitivity:1.0,
  // onboarding
  tutorialSeen:false,
};
```

**Runtime derived globals** (recomputed in `applySettingsRuntime()`):
`FX.motion, shakeScale, PCAP_EFF, AMB_CAP_EFF, PAL, glyphsOn, hcOn, hudScale, safe{top,right,bottom,left}`.

**`applySettingsRuntime()`** (call after every settings mutation, and once in `boot()` after `loadPersist`):
```js
FX.motion = {full:1, reduced:0.45, minimal:0}[settings.motion];
shakeScale = {full:1, low:0.5, off:0}[settings.screenShake];
PCAP_EFF   = {full:PMAX, reduced:160, minimal:90}[settings.motion];
AMB_CAP_EFF= {full:AMB_CAP, reduced:28, minimal:0}[settings.motion];
PAL = PALETTES[settings.colorblind]; glyphsOn = settings.alwaysGlyphs || settings.colorblind!=='off';
hcOn = settings.highContrast; hudScale = {S:0.88,M:1,L:1.18}[settings.textSize];
if(AC){ sfxGain.gain.value=settings.volSfx*0.34; musicGain.gain.value=(settings.musicOn?settings.volMusic:0);
        masterGain.gain.value=settings.muted?0:settings.volMaster*0.9; }
```

**`loadPersist()` migration** (replace L1474): clone `DEFAULT_SETTINGS`, `Object.assign` parsed `v2`; if absent, copy the 4 legacy keys from `aac.settings.v1`; then `applySettingsRuntime()`. Boot default: if `matchMedia('(prefers-reduced-motion:reduce)').matches` and no stored v2, set `motion:'reduced'`.

---

## 3. CROSS-CUTTING INVARIANTS (the "do not break" rails)

1. **Camo sampler integrity.** `terrainReference` / `matchQuality` / `concealment` / `conspicuity` / `updateStillness` keep their exact math and numeric constants. The **only** permitted signature change is adding a 5th optional `openCap` param to `concealment()` (default `MAX_CONCEAL_OPEN`) for FREEZE, and generalizing `computeCamo`→`computeCamoFor(actor,…)` in P5 (player becomes actor #0, all fields identical). No art/particle/texture touches these functions.
2. **Texture ≠ detection.** Terrain tile art (P1 §2) may only shift a tile's *visual mean* within ±6 of its base hex, so a color-matched chameleon still *looks* blended. Detection is unaffected regardless (hex table read), but the visual constraint keeps the fantasy honest.
3. **Determinism.** All new sim entities (decoys, inks, beacons, hunt bots, HEAT ramp) live in `round.*`, seeded from `mulberry32(round.seed)`. No `Math.random()`/`Date.now()` inside `stepSim`. Ambient/particles/tweens/audio/camera run on **real time** outside the fixed sim and may use `Math.random()` (they never feed detection).
4. **`window.__aac` preserved and extended** (P-by-P, §9). Never removed.
5. **Single file, offline, Canvas2D, no deps.** Every asset is a runtime-built offscreen canvas or synth node.
6. **60fps on mid phone at DPR2.** Enforced by the perf ledger (§8) and an adaptive-quality auto-scaler.
7. **Screen↔world mapping stays exact during play.** Trauma **rotation** is applied *only* during the abduction cutscene (`FX.traumaRot`), so `screenToWorld`, threat-arrow projection, and studio reticle never desync during normal input.

---

## 4. GLOBAL TIME / FRAME ARCHITECTURE

`frame()` (L1449) evolves across three passes; each edit is additive and shippable.

- **P1** adds at top: `gfx.frame++; gfx.t = now/1000;` and, in the ROUND branch, `updateAmbient(realDt)` before draw; extends the screen-space post chain.
- **P2** adds `updateChameleonAnim(realDt)` immediately before `drawRound()`; builds `UFO_SPRITE[state]` in `boot()`.
- **P3** performs the master rewrite: `FX` time-scale, hitstop, tween update, streaks, split of sim-time vs real-time.

**P3 canonical `frame()`** (folds in comfort's `PCAP_EFF`/`STUDIO_SLOWMO_EFF` and P1's ambient/gfx):
```js
function frame(now){
  const realDt=Math.min(MAX_FRAME_DT,(now-lastFrame)/1000||0); lastFrame=now;
  gfx.frame++; gfx.t=now/1000;
  updateGamepadEdges(); updateTweens(realDt);
  if(FX.hitstop>0){ FX.hitstop-=realDt*1000; FX.timeScale=0; } else FX.timeScale=FX.slowScale;
  const simDt=realDt*FX.timeScale;
  if(appState==='ROUND'){
    if(roundState==='PLAYING'||roundState==='COUNTDOWN'||roundState==='RESUME_COUNTDOWN'){
      acc+=simDt; let steps=0; while(acc>=DT_FIXED&&steps<5){ stepSim(DT_FIXED); acc-=DT_FIXED; steps++; }
      if(steps>=5) acc=0;
    }
    if(roundState==='CAUGHT'&&FX.hitstop<=0){ player.abductT+=realDt; if(player.abductT>=ABDUCT_CUTSCENE) finishRound('LOSE'); }
    else if(roundState==='TIMEOUT'){ round.summaryT+=realDt; if(round.summaryT>=TIMEOUT_ANIM) finishRound('WIN'); }
    updateParticles(simDt); updateAmbient(realDt);
    updateChameleonAnim(realDt); updateCamera(realDt); updateAudioFrame(realDt);
    drawRound(); drawRoundHUD(); drawStreaks();
  } else { hueAnim+=realDt; stopAllLoops(); drawMenu(); }
  drawToast(); requestAnimationFrame(frame);
}
```
`gfx = {frame:0, t:0}` is the single animation clock every live visual reads. `STUDIO_SLOWMO_EFF` (reduced-motion → 1.0) threads into `stepSim` L1262. Practice studio slow-mo and near-miss slow-mo multiply harmlessly (different modes).

**`FX` module + tween list** (add near §7):
```js
const FX = { motion:1, timeScale:1, hitstop:0, slowScale:1, trauma:0, traumaRot:0,
  zoomPunch:0, desat:0, reliefV:0, spottedV:0, tweens:[], streaks:[] };
function tw(from,to,dur,ease,set,opts){ opts=opts||{};
  if(FX.tweens.length>=48) FX.tweens.shift();
  FX.tweens.push({t:0,dur,delay:opts.delay||0,from,to,ease,set,done:opts.done}); }
function updateTweens(rdt){ for(let i=FX.tweens.length-1;i>=0;i--){ const w=FX.tweens[i];
  if(w.delay>0){ w.delay-=rdt; continue; } w.t+=rdt; const k=clamp01(w.t/w.dur);
  w.set(w.from+(w.to-w.from)*w.ease(k)); if(k>=1){ w.done&&w.done(); FX.tweens.splice(i,1); } } }
function addTrauma(a,rot){ FX.trauma=Math.min(1,FX.trauma+a*FX.motion*shakeScale);
  if(rot) FX.traumaRot=Math.min(1,FX.traumaRot+rot*FX.motion*shakeScale); }
function hitstop(ms){ FX.hitstop=Math.max(FX.hitstop, ms*(FX.motion>0?1:0)*(settings.motion==='reduced'?0.4:1)); }
function punchZoom(amt,rise,fall){ if(FX.motion<=0) return;
  tw(FX.zoomPunch,amt,rise/1000,easeOutCubic,v=>FX.zoomPunch=v,
     {done:()=>tw(FX.zoomPunch,0,fall/1000,easeInOutCubic,v=>FX.zoomPunch=v)}); }
```

---

## 5. IMPLEMENTATION PASSES

Ordered by impact-per-risk. Each pass is self-contained, smoke-verifiable, and leaves the game shippable.

---

### PASS 1 — WORLD: lighting, biome terrain cache, ambient layers
**Goal:** the single biggest visual delta. Turn the flat-fill world into moonlit noir with per-biome identity. Pure additive rendering; sim untouched.

**New state / constants:** `BIOME` table, `GLOW{}` sprites, `gfx`, `skyCache/vignetteCache/scanlineCache`, `amb[]`, `AMB_CAP/AMB_GLOW_MAX/GRADE_ALPHA/…` (§2).

**5.1 Glow sprite library** (build once in `boot()` — robust version, pass ints not string-hacks):
```js
function buildGlow(r,g,b){ const S=64,c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'), rg=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  rg.addColorStop(0,'rgba(255,255,255,0.95)'); rg.addColorStop(0.28,`rgba(${r},${g},${b},0.85)`);
  rg.addColorStop(1,`rgba(${r},${g},${b},0)`); x.fillStyle=rg;
  x.beginPath(); x.arc(S/2,S/2,S/2,0,TAU); x.fill(); return c; }
// GLOW.cyan=buildGlow(63,208,224); amber(242,179,61); lava(255,120,40); crystal(150,120,240);
// pod(150,110,235); fire(180,255,140); mint(120,230,200); white(230,240,255)
```

**5.2 Cached surfaces:**
- `buildVignette()` (rebuilt in `resize()`): screen-sized canvas = radial vignette (`rgba(8,12,26,0)`→`0.10`@0.72→`VIGNETTE_EDGE`) **plus** baked chromatic fringe (two additive radial rings, red pulled `-CA_SHIFT`, blue `+CA_SHIFT`, `CA_ALPHA`). When `hcOn`, drop the outer stop to `0.35`. One `drawImage` per frame.
- `buildScanlines()` (resize): 1×`SCANLINE_PERIOD` tile → `createPattern`; one full-screen fill/frame at `SCANLINE_ALPHA`.
- `buildSky(bi)` (in `startRound` after `setActiveMap`): screen-sized vertical `skyTop→skyBottom` + one soft off-center moon glow blob top-right.

**5.3 Per-terrain baked texture** — replace the two-dot noise in `buildTerrainCache` inner loop (L223–230) with a per-terrain motif dispatch. **Keep the dithered base fill L220–222 exactly** (that is the camo-safe mean). All motifs use `shadeHex(base,±≤22)` only, so tile mean stays within ±6 of base hex. Seed every choice from `hh=hashInt(col,row)`. Full recipe table (16 terrains: grass tufts, dirt pebbles, water static wave-lines, rock facets, concrete slab-seams on a 3-tile grid, foliage leaf-blobs, metal panel+rivets, sand ripple-arcs, snow sparkle+dimple, ice sheen+cracks, mud blotches, moss stipple, lava ash-crust over glowing cracks, ash grain, crystal shards, void stars) — implement art-biomes §2 verbatim. Drop baked grid alpha `0.04→0.025`; skip grid on concrete/metal. Baked once (<30ms for a 74×54 map), zero per-frame cost.

**5.4 Ambient overlays** (two subsystems, both culled to the visible rect `vx0..vy1` already computed at L901):
- `drawAmbientGround(vx0,vx1,vy0,vy1)` (analytic, **zero alloc**, step 3 below): iterate visible tiles only; emit cheap emissive blits — water caustic shimmer, lava glow-pulse + embers, crystal breathe, pod ground-glow, snow twinkle (throttled `((hh^(gfx.frame>>3))&15)===0`). Cap additive blits at `AMB_GLOW_MAX` via `if(glowN++>AMB_GLOW_MAX) break;`.
- `amb[]` overhead drifter pool (fixed `AMB_CAP_EFF`, recycled — never `splice`): per-biome fireflies / snow / dust / spores / embers with `'lighter'` glow-sprite blits, twinkle, wrap-to-visible-rect on exit. Seed in `startRound`.

**5.5 Render order** — rewrite `drawRound` (L895–925) to the exact sequence:
1. `drawImage(skyCache,0,0)` (replaces flat `COL.bg` fill) → **world space** →
2. `terrainCanvas` → 3. `drawAmbientGround` (under entities) → 4. footstep ripples → 5. `drawCover` (culled) → 6. repaint puffs/rings → 7. player/abduction → 8. UFOs → 9. `drawAmbientOverhead` (over entities, `'lighter'`) → 10. reticle → **screen space** →
11. multiply grade rect (`biome.grade`, `GRADE_ALPHA`) → 12. `drawImage(vignetteCache)` → 13. `drawDangerPulse()` (extract existing red overlap L1036–1040) → 14. scanline pattern fill.
HUD (`drawRoundHUD`) runs after `drawRound` in `frame` — stays crisp/ungraded. In `drawMenuBg` append vignette + scanline so menus share the CRT skin.

**5.6 Biome resolution:** `biomeOf()` matches `MAP.name` substring against the 6 keys (`greenwood/dunes/tundra/downtown/xeno/bog`); baked "Prototype Meadow" → `greenwood` fallback. Stash `round.biome`. Table = art-biomes §5 (skyTop/skyBottom/moon/grade/ambCount/drifter).

**Wiring:** `boot()`→build GLOW; `resize()`→buildVignette+buildScanlines; `buildTerrainCache()`→motif dispatch; `startRound()`→`round.biome=biomeOf()`, buildSky, seedAmbient; `drawRound()`→new order + ambient + post; `frame()`→`gfx` bump + `updateAmbient`.

**Verify headlessly:** extend `__aac` with `biome`, `ambCount:amb.length`, `terrainCacheBuilt:!!terrainCanvas`, `postReady:!!vignetteCache&&!!scanlineCache`. Smoke: load each of the 6 maps → assert `biome` resolves non-null and differs across maps; assert `ambCount<=AMB_CAP_EFF`; assert a sampled `terrainReference` at a known tile returns the same RGB as before P1 (proves texture didn't touch detection).

**Top risks & mitigations:**
- *Additive-blit overdraw on lava-heavy maps* → hard cap `AMB_GLOW_MAX=120` + adaptive-quality (§8).
- *Grade multiply washing out HUD* → grade is applied in world/screen post **before** HUD; HUD draws after. Verified by render order.
- *Texture drifting tile mean* → motif amplitude clamped to ±22 on `shadeHex`; add a build-time assertion in dev that sampled canvas mean per terrain is within 8 of `TERRAIN_RGB` (dev-only, stripped in prod).

---

### PASS 2 — CHARACTERS: chameleon, UFO, abduction cinematic
**Goal:** give the two actors real personality and secondary motion. Render-only scalar state; reads `player.*`/`round.ufos[].*`, never writes sim.

**2.1 Chameleon.** Add render-anim fields to the `player` literal (L349): `animT, walkPhase, prevSpeed, prevFacing, stretchX/Y, breathP, tailCurl, blinkT/Dur/E, oneEye, eyeL/R, eyeSweepP, repaintT, lookThreat`. One `updateChameleonAnim(realDt)` (all scalar lerps, zero alloc) — breathing (0.5 Hz belly pulse, fades while moving), squash-&-stretch (lean into travel, turn-squash on sharp facing change), distance-locked diagonal walk cycle (stride ≈0.9R, paired FL+RR / FR+RL), curling spiral tail (`tailCurl` uncoils moving / winds in on settle over ~0.4s), independent eye turrets (threat-pick nearest UFO weighted by state, snap rate 16 vs calm-wander 4, asymmetric blinks 2.5–6s). Replace `drawChameleon` (L948) with the layered draw (shadow→tail→rear legs→body+crest→front legs→casque/head/snout→eyes→repaint shimmer→dissolve dither). Character-anim §1 recipes verbatim, with the **cleaned tail coil**:
```js
// tapered right-curling coil from root(-1.05R,0); turns driven by tailCurl
const turns=0.6+1.9*player.tailCurl, a0=Math.PI*0.5, aEnd=a0+turns*TAU, N=14;
let px=-1.05*R,py=0;
for(let i=1;i<=N;i++){ const t=i/N,a=lerp(a0,aEnd,t),rr=lerp(0.62*R,0.05*R,t);
  const x=-1.05*R - Math.sin(a)*rr, y=Math.cos(a)*rr*player.tailCurl;
  ctx.strokeStyle=shadeHex(css,-14); ctx.lineWidth=lerp(0.34*R,0.05*R,t); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke(); px=x; py=y; }
```

**2.2 Concealment ghost curves** (replace the flat alphas L953/964/967 with, `c=player.conceal`):
`dissolve=smoothstep(0.42,0.97,c)`; `bodyA=lerp(1,0.06,dissolve)`; `outlineA=0.85*(1-c)^1.7` (gate off entirely when `c>0.9`); `shadowA=0.32*(1-c)^1.25`; `eyeA=max(0.60,1-c*0.68)`; `glintA=max(0.75,1-c*0.4)`. Plus **edge-dither** (`drawDissolveDither`): draw `floor(dissolve*16)` dots of the **sampled terrain color** (`player.ref.rgb`, read-only) from the static `DITHER_PTS` table, jittered by `animT`, clipped to the body path. Max 16 arcs, one instance. Result at `c→0.98`: a 6%-opacity ground-matched smear with two floating glinting eyes. **When `hcOn`, floor `outlineA` at 0.9 + a 1px inner black outline so low-vision players never lose themselves.**

**2.3 UFO.** Bake `UFO_SPRITE[state]` (6 offscreen ~140×90 @3× canvases) once in `boot()` after RGB fill: chrome radial gradient body, state-color rim ring, glass dome, alien silhouette, panel lines. `STATE_COL={PATROL:cyan,SCAN:cyan,INVESTIGATE:'#E0A030',CHASE:danger,BEAM:danger,COOLDOWN:muted}` (colorblind → `PAL`). Replace `drawUfo` (L972) dynamic layers, drawn per frame in order: fake-altitude shadow + hull bob → scan footprint + rotating scan-ring (speed by state) → tinted radar sweep-line → sensing link-line → beam telegraph (CHASE) → tractor beam (BEAM, §2.5) → under-rim thruster glow (scales with speed) → **hull sprite** rotated + velocity-banked → rim-light blink (rate by state; **steady if `photosensitive`**) → lock-on reticle (CHASE/BEAM) → notice "!" bubble (P4) → suspicion arc (keep, add `PAL` + glyph letter). When `hcOn`, draw a 4px black stroke under the colored rim. This baking is the key phone win — the only per-frame UFO allocs become the beam/thruster gradients (≤3 UFOs, acceptable).

**2.4 Abduction cinematic.** Rewrite `drawAbduction` (L1009) as 5 phase-keyed keyframes on `t=abductT/ABDUCT_CUTSCENE`: **A snatch/anticipation** (squash down, tail whip, hitstop, white flash `round.flash=0.85`), **B lift & stretch** (rise, taffy vertical stretch, accelerating spin, eyes stay), **C spaghettify + silhouette flash** (fill→white, thin+tall, light-streak sprite), **D pop into dome** (scale→0, sparkle burst of 12 pooled particles + expanding ring, dome white-flash, second flash 0.6), **E retract & settle** (beam shrinks, UFO bobs up then eases back). White flash = screen-space `fillRect` fading `-realDt*3.5`. Reuse existing `puff`/`ring` particle types for the burst.

**2.5 Tractor beam** (BEAM state, top-down volumetric fake, centered on player): outer soft cyan cone + 3 rotating caustic rings (`'lighter'`) + bright core column + hull emitter glow; **dust motes** pooled (`type:'beamdust'`, throttled ~2/frame via `u.dustT`, spiral inward, respect `PCAP_EFF`) — add `beamdust` case to `updateParticles` and the draw pass.

**2.6 Menu heroes.** Standalone `drawHeroChameleon(cx,cy,scale,t)` reusing the real look (color-cycled via `hueAnim`, breathing, blinking, **eyes tracking the drifting title UFO**, occasional tongue-flick). Title UFO does lazy scan sweeps the chameleon peeks at. Replace the placeholder ellipse in `drawTitle` (L1339). Wall-clock driven, 60fps regardless of sim.

**Wiring:** `player` literal fields; `updateChameleonAnim` called in `frame` before `drawRound`; `boot()` bakes `UFO_SPRITE`; `drawChameleon`/`drawUfo`/`drawAbduction`/`drawTitle` replaced; `beamdust`/`sparkle` types added to existing particle update+draw (still array-based here — P3 pools it).

**Verify headlessly:** `__aac.anim={walkPhase,tailCurl,eyeL:+..,eyeR:+..,blinkE}`, `ufoSprites:Object.keys(UFO_SPRITE).length===6`, `abductPhase:player.alive?null:clamp01(player.abductT/ABDUCT_CUTSCENE)`. Smoke: spawn a UFO near player, force BEAM → assert `beamdust` particles appear and stay ≤PCAP_EFF; run abduction → assert `round.flash>0` fires and decays to 0; assert `player.C`/`conceal` values identical to pre-P2 at rest (anim reads, never writes sim).

**Top risks:** *per-frame UFO gradient churn* → sprites baked; cache thruster/footprint gradients per-state if profiler shows churn. *Anim writing sim by accident* → `updateChameleonAnim` only assigns `player.anim*` fields, never `x/vx/facing/conceal/C`; enforce by code review + the identical-`C` smoke assertion.

---

### PASS 3 — JUICE: camera, particles, hitstop, audio glow-up
**Goal:** make painting feel like a warm pop and being noticed feel like the air goes cold. Introduces `FX` time-scale, trauma shake, pooled particles, and the audio bus/pad/music system.

**3.1 Camera** — split `zoom` into `zoomBase` (from `computeZoom`, sets `zoomBase`) + punch; add velocity lookahead + box deadzone. Rewrite `updateCamera` (L879) per juice-feel §1: `zoom=zoomBase*(1+FX.zoomPunch*FX.motion)`, eased `camLead`, box deadzone, world clamp, then `updateShake(dt)`. **Punch catalog** (event→amt/rise/fall): repaint +0.030/90/260, ui-confirm +0.018/70/180, spotted −0.060/90/420, beam-lock +0.050/120/hold, near-miss −0.040/120/380, abduction +0.120/200/hold, new-best +0.045/150/500.

**3.2 Trauma shake + hitstop** — replace `SHAKE`/`shake.mag` with the trauma model: `updateShake` sets `shake.x/y = ±SHAKE_MAXOFF*trauma²`, `shake.rot = ±SHAKE_MAXROT*traumaRot²`, decays `TRAUMA_DECAY`. **`applyWorldTransform` gains rotation about screen center, but `traumaRot` is only ever raised during abduction** — so normal play is rotation-free and `screenToWorld` stays exact. Hitstop table (full/reduced/minimal ms): beam-lock 40/16/0, near-miss 70/28/0, abduction 110/44/0.

**3.3 Pooled particles** — replace `particles[]`+push/splice (L863–875) with a fixed `pool[PMAX]` swap-pop system; **cache the color string once at spawn** (kills the per-repaint `rgb2hex` alloc). Preserve every existing/new type: `puff, ring, ripple, dust, splash, burst, spark, suck, sparkle, beamdust, ink, trail`. Comfort cap = `PCAP_EFF`; ambient stays in the **separate `amb[]` pool from P1** (do not merge — P1's dedicated recycled pool wins over juice-feel's "ambient-in-main-pool" proposal, for GC and richness). Per-type spawn recipes: footstep dust/splash by terrain (from `maybeFootstep`), repaint burst+flash-ring+sparkles (replaces `spawnRepaintPuff`), spotted red shards, beam suck, abduction sparkles, near-miss screen-space streaks (`FX.streaks`, cap 12, `drawStreaks()` after HUD).

**3.4 Event beats** — wire at the exact existing sites:
- L644/L640 `instantMatch`/`doMatch`: `SFX.match(player.mq)`, `punchZoom(+0.03,90,260)`, `addTrauma(TRAUMA.repaint)`, `vibe(12)`.
- L824 CHASE→BEAM: `addTrauma(TRAUMA.beamLock)`, `hitstop(40)`, `punchZoom(+0.05,120,…)`, `vibe(40)`.
- L853 near-miss: `nearMiss()` — whoosh + `hitstop(70)` + slow-mo (`FX.slowScale→0.4`, hold 200ms, ease back 360ms) + desat pulse + streaks + relief + `vibe(180)`; `minimal` → "CLOSE!" text + chime only.
- L855 spotted: notice "!" (`u.noticeT=0`), `addTrauma(TRAUMA.spotted)`, `punchZoom(-0.06,90,420)`, spark shards, spotted vignette pulse, sting bump, `vibe([30,50,30])`.
- L859 relief: `pulseRelief(0.22,500)` + breath punch; `SFX.relief()` already fires.
- L1219 `triggerAbduction`: `hitstop(110)`, `addTrauma(TRAUMA.abduct, 0.6)`, `punchZoom(+0.12,200,hold)`, duck music/pad, `vibe([80,60,120])`.

**3.5 Overlays** — extend `drawVignette` (L1031) with desat (`saturation` composite, skipped if `photosensitive`), relief (cyan-green radial), spotted (red radial) — steady fills, peaks scaled by comfort; `photosensitive` clamps peaks ≤0.3 and ≤2 pulses/sec.

**3.6 Audio glow-up** — in `ensureAudio` build the bus graph: `master(volMaster*0.9) ← sfxGain(volSfx*0.34) ← tone/noise`; `master ← musicGain(volMusic) ← pad + beam + sting + generative music`. `setMuted` toggles master only. Add: **per-biome pad** (replace `updateDrone`, 3 detuned oscs + LPF LFO, per-biome chord table), **suspicion sting** (`updateSuspicionLayer(round.maxSusp)` — bandpass saw + heartbeat tremolo, rate `1.2+susp*3.5` capped 3.0 Hz), **beam whine enhancement**, **terrain footstep ticks** (`footstepTick(domKey)` lookup, vol ≤0.05, ±5% pitch), **parametrized `SFX.match(q)`** (brighter on better match), **enhanced abduction** (sub thump + reverse swell + duck), **generative music** (84 BPM, 8-bar loop, biome key, bass/arp/perc, lookahead scheduler ≤3 voices, `duck()` on threat). `updateAudioFrame(rdt)` consolidates all per-frame audio. Voice budget ≤26 oscillators total.

**Wiring:** L80–82 constants; `frame` master rewrite (§4); `computeZoom`/`updateCamera`/`applyWorldTransform`; particle system; `ensureAudio`/`tone`/`noise`/`updateDrone`/`updateBeamSound`; all event sites above; `drawVignette`.

**Verify headlessly:** `__aac.fx={trauma:+..,hitstop,slowScale,zoomPunch,tweens:FX.tweens.length,particles:pn,streaks:FX.streaks.length}`. Smoke: fire `instantMatch()` → assert `FX.zoomPunch>0` then decays; force near-miss → assert `FX.slowScale<1` then returns to 1 within ~600ms; assert `pn<=PCAP_EFF` always; assert with `settings.motion='minimal'` that `FX.trauma===0`, `FX.hitstop===0`, `FX.streaks.length===0`.

**Top risks:** *saturation composite cost on phone* → single full-screen fill, gated off in photosensitive/minimal; adaptive-quality drops it first. *hitstop freezing input feel* → hitstop ≤110ms and only on big beats; camera/audio keep running so it reads as impact not lag. *tween leak* → cap 48, drop-oldest.

---

### PASS 4 — COMFORT: settings, accessibility, onboarding, threat arrows
**Goal:** premium comfort & readability; make every hostile spike loud/legible and everything else quiet/forgiving. All additive; each toggle re-routes an existing system.

**4.1 Settings page** — add `appState==='SETTINGS'` (from TITLE) + `settingsOverlay` flag (from PAUSE, round stays underneath). One scrollable canvas-drawn `drawSettings()` (phone-first vertical list, `settingsHits[]` rebuilt per draw, drag/wheel scroll, focus auto-scroll). Sections: **Audio** (Master/SFX/Music sliders), **Comfort** (Motion seg Full/Reduced/Minimal, Screen-shake seg Full/Low/Off, Photosensitive switch, Haptics switch), **Accessibility** (Colorblind seg, Meter-glyphs switch, High-contrast switch, Text-size seg), **Controls** (Handedness, Joystick Floating/Fixed, Turn-sensitivity slider), **Help** (Replay tutorial, How-to-play). Footer: Reset / Done. Widget recipes (slider/segmented/switch/link) per comfort-ux §1.3. Every setter → `applySettingsRuntime(); saveSettings()`. Add a `⚙ Settings` nav to TITLE (2-wide row with How-to-Play) and to `drawPause`.

**4.2 Accessibility wiring:**
- **Screen shake** already folded into `addTrauma` via `shakeScale` (P3).
- **Motion** = `FX.motion` (P3, single source) — the full degradation matrix (shake/zoom/hitstop/slowmo/desat/streaks/ambient/particle-cap) is comfort-ux's table, realized through `FX.motion`, `PCAP_EFF`, `AMB_CAP_EFF`, `STUDIO_SLOWMO_EFF`.
- **Colorblind `PALETTES`** (off/deut/prot/trit): semantic ramps for meter states + UFO states; drive `drawRoundHUD` match/detection fills, `drawUfo` hue + suspicion ring, threat arrows. **Glyphs** when `glyphsOn`: `●/◐/○!` on match meter, hatch + `!` on danger detection, state letter `·?!` over each UFO — legible with zero hue.
- **High contrast** `hcOn`: panel alpha 0.86→0.97, brighter lines/text, chameleon outline floor 0.9 + inner black outline, UFO black under-stroke, meter black borders, reduced vignette.
- **Text size** `hudScale`: multiply inside `txt()` guarded by `TEXT_SCALE_ON` (true only during HUD/menu draw, not world).
- **Haptics** `vibe(pat)`: gated `navigator.vibrate`; event map (tap 8, match 12, countdown 10 / GO [20,40,20], spotted [30,50,30], beam 40, abduct [80,60,120], relief 15, new-best pattern).

**4.3 Onboarding** — first PLAY tap with `!settings.tutorialSeen` → `startTutorial()`: a no-threat PRACTICE round on `BAKED_MAP` (`UFO_COUNT:0`), a 5-step coach overlay (dim + spotlight hole + bottom card + bouncing arrow) that auto-advances **by doing** (move → MATCH → hold-still → hug cover → "you vanished"). Skip button (44×44). On finish/skip → `tutorialSeen=true`, go to MODE_SELECT. Replayable from Settings. Reduced-motion: static arrow, instant spotlight, no confetti.

**4.4 Threat arrows + readability** — `drawThreatArrows()` in `drawRoundHUD` (screen space): for each UFO that is off-screen-and-threatening or CHASE/BEAM, draw a `PAL`-colored edge triangle at the inset-rect intersection along the ray to the UFO, with a `Nm` distance label and (CHASE/BEAM) a pulse; glyph letter when `glyphsOn`. Biggest situational-awareness win on tight phone cameras. Cheap (≤3 UFOs, no alloc). Plus: objective chip under the meters (`STAY HIDDEN`/`FREE ROAM`), better "why spotted" banner (cause icon + accent bar), and a staged **SUMMARY** (count-up, medal by grade, contextual weakest-metric tip; tap fast-forwards).

**4.5 Touch comfort** — safe-area insets via an `env(safe-area-inset-*)` probe read in `resize()`; every HUD anchor offset by `safe`. Bigger hit targets (MATCH 104×64, studio 64×64, pause/mute 48×48, +8px invisible `hitPad`). Handedness mirror (joystick/creep sides + action cluster + pause/mute). Joystick Floating (sticky re-center on rim) / Fixed (long-press reposition, saved to `joyAnchor`). Turn-sensitivity curve on joystick output.

**4.6 Playability polish** — resume countdown 0.8→1.4s ring-wipe `3·2·1`; forgiving scored spawn placement in `startRound` (far from seekers, never lava/void, near cover/good-terrain, min dist ≥`SCAN_R*1.25`) + a blue "safe" grace ring during `SPAWN_GRACE`; menu preselection (`menuEnter` sets `menuIndex` from `lastMode/lastLevel/lastDiff`); per-difficulty PB badges. **Difficulty-tuning recommendation** (data only, sim untouched): soften NORMAL toward `SUSPECT_GAIN:1.6, LOCK_TIME:1.9, SCAN_R:168`; optional intra-round ramp `round.rampMul=1+0.15*(elapsed/SURVIVE_TIME)` multiplying `D.SUSPECT_GAIN` in `updateUfo`.

**Wiring:** new `appState/overlay/globals`; `ensureAudio` bus (shared with P3); `drawSettings/drawThreatArrows/drawCoach`, upgraded `drawSummary`; `PAL/glyph/hc/hudScale` threaded into `drawRoundHUD/drawUfo/drawChameleon/drawVignette/panel/txt`; `stepSim` tutorial step + `rampMul`; `onPointerDown` handedness/joystick; `resize` safe probe.

**Verify headlessly:** `__aac.settings={motion,shake:settings.screenShake,cb:settings.colorblind,glyphsOn,hc:hcOn,textSize}`, `tutorial:round&&round.tutorial?round.tutorial.step:null`, `threatArrows:count`. Smoke: set each `colorblind` → assert `PAL` swaps and HUD fills change; set `motion='minimal'` → assert ambient/streaks/hitstop all 0; run tutorial → assert steps advance on simulated move/match/hold and `tutorialSeen` persists; move UFO off-screen → assert a threat arrow registers.

**Top risks:** *settings scroll-list hit math on notch phones* → all rects use `safe`; clip the list; test 360×640. *glyph/hc regressions to hot HUD path* → glyphs are ≤ a few extra `fillText`/`arc`, O(#meters+#UFOs), no alloc. *audio graph double-build with P3* → P3 and P4 share one `ensureAudio` builder; both `applySettingsRuntime` paths set the same gains.

---

### PASS 5 — MECHANICS: abilities + new modes
**Goal:** the unique-playstyle toolkit and mode diversity. Requires the **actor refactor** as its enabler.

**5.0 Actor refactor (enabler, do first in this pass).** Generalize `computeCamo`→`computeCamoFor(a,dt,speed)` (body identical, `s/player/a/`), `updateStillness`→`updateStillnessFor(a,…)`, add `matchQualityActor(a,ref)` (solid path = today's `matchQuality`), and add an optional 5th `openCap` param to `concealment(mq,S,cb,terrCap,openCap=MAX_CONCEAL_OPEN)`. `player` is actor #0 with all existing fields — a pure drop-in. **The equation and every constant are untouched.** This unblocks abilities' `freezeCap` and HUNT's bot hiders.

**5.1 Abilities (4).** Add `player.ability={freeze,freezeCharge,dashT,dashDx,dashDy,dashCd,dashFlare,decoyCd,inkCd}` and `player.freezeCap`. Numbers = §2 constants. Each pushes exactly one lever the detector already reads:

| Ability | Key / Touch / Pad | Rule | Cost | Hook |
|---|---|---|---|---|
| **FREEZE** | hold Space / ❄ / A(0) | roots you (`input.mx=my=0`); `freezeCharge` ramps; `updateStillnessFor` attack-tau ×0.5; `freezeCap=lerp(0.95,0.985,charge)` | can't flee a beam while frozen; water/lava caps still win | `gatherInput`, `updateStillnessFor`, `concealment` openCap |
| **DASH** | Ctrl / ⤢ / X(2) | `DASH_SPEED` burst `DASH_TIME` in input dir, ignores `MOVE_MULT`, still `circleBlocked` | `dashFlare` adds up to +0.5 to `C`; resets stillness | `movePlayer`, end of `computeCamoFor` |
| **DECOY** | C / 👥 / B(1) | drop `round.decoys.push({x,y,paint,S:1,C,life})`, own `C` computed once at spawn | `DECOY_CD=12`, max 1 | `updateUfo` sensing: parallel `signalDecoy`; max-signal wins belief; UFO pops decoy at `BEAM_R` → COOLDOWN 2s |
| **INK** | V / 💨 / LB(4) | `round.inks.push({x,y,r:INK_R,life})`; `losClear` returns false if segment passes within `r` | LoS-only, `INK_CD=10`, max 2 | `losClear` (≤2-cloud loop) |

HUD: right-edge vertical column of four 48px buttons `[❄][⤢][👥][💨]` above 🎨/MATCH, each with a radial cooldown wipe (FREEZE shows a fill ring). Desktop legend fades after 8s. Full gamepad remap (mechanics §1 table). Belief arbitration is strictly "max signal wins" (no blending) to stay legible + deterministic.

**5.2 Pattern painting (SHOULD, medium risk — ship the lite version).** Extend `terrainReference` to also return `secondRgb/secondKey/secondW` (reuse a module scratch, ~6 lines, no hot-loop alloc). Studio gains a PATTERN toggle + second swatch (reuses SV/hue widget). `matchQualityActor` pattern path = weighted redmean over both dominants through the **same curve** — identical to solid on pure tiles (no free lunch), a win on seams; pattern adds +0.02 conspicuity floor + doubles `SHIFT_SHIMMER` while crawling, so it's a real trade. If cut, still land the top-2 `terrainReference` change (HUNT bots use it).

**5.3 New modes.** MODE_SELECT → 2×3 responsive grid.
- **TIME ATTACK "Beacon Run" (MUST):** seed-pick `TA_BEACONS` beacons; bank one by being within `BEACON_R` with `conceal≥0.6` for `BEACON_HOLD` continuous, **paused while any UFO has LoS**; abduction respawns at last bank +`TA_PENALTY`s. Score = total time (lower better), graded off seeded par. `round.beacons[]`, a check block in `stepSim`, HUD swaps timer for `banked/5`.
- **HEAT "Endless" (SHOULD, wire the greyed button):** `round.diff` = a **cloned mutable** `{...DIFF.EASY}` (never mutate the shared const); every `HEAT_RAMP`s bump SCAN_R/speeds/gain, every `HEAT_UFO_EVERY`s add a UFO (cap 6), COORDINATE at 3min; one abduction ends it. Score = `floor(sec)*(1+ufoCount*0.15)`.
- **DAILY (SHOULD, P7-adjacent but wire seed here):** `seed=hashDate(YYYYMMDD)`, fixed SURVIVE/NORMAL/120s, one tracked attempt/day in `LS_DAILY`. Swap the `startRound` seed line when `mode==='DAILY'`.

**Wiring:** `computeCamoFor`/`concealment`/`updateStillnessFor`/`matchQualityActor`; `player.ability`; `gatherInput`/`movePlayer`/`losClear`/`updateUfo`; keydown + `updateGamepadEdges` remap; `round.decoys/inks/beacons/diff`; `stepSim` timers + mode checks; `startRound` mode branch; `drawRoundHUD` ability column; `terrainReference` top-2; studio pattern toggle.

**Verify headlessly:** `__aac.ability={freeze:+charge,dashCd,decoyCd,inkCd}`, `decoys:round.decoys.length`, `inks:round.inks.length`, `beacons:round.beacons?{banked,total}`, `mode:round.mode`, `heatUfos:round.ufos.length`. Smoke: hold FREEZE on a matched tile → assert `conceal` can exceed 0.95 (up to ≤0.985) and `input.mx===0`; drop DECOY near a suspecting UFO → assert `u.lastSuspect` tracks the decoy, not the player; drop INK between UFO and player → assert `losClear(u,player)===false`; run TIME ATTACK → assert a beacon banks after a held hidden dwell; run HEAT 30s → assert `round.diff.SCAN_R > DIFF.EASY.SCAN_R` and `DIFF.EASY.SCAN_R` unchanged (no shared-const mutation).

**Top risks:** *DECOY belief arbitration desync* → single "max signal wins" branch fed the decoy's position; deterministic. *HEAT mutating shared `DIFF`* → clone at round start; smoke asserts the const is untouched. *`losClear` cost* → ≤2 `Math.hypot` per segment step, culled; negligible. *Actor refactor regressing player camo* → the identical-`C` smoke test from P2 must still pass after the rename.

---

### PASS 6 — HUNT: the second perspective (headline)
**Goal:** you fly the UFO; bots hide with the same math. Doubles content from existing spawn data; proves the seam. HIGH risk, **staged** so each stage is independently shippable (cut line = stage e).

**Seam use (exactly as designed):**
```js
const HumanSeeker = { think(view){ return readHunterIntent(view); } };
const BotHider    = { think(view){ return botHiderIntent(view); } };
// startRound(HUNT): playerUfo.controller=HumanSeeker; each bot.controller=BotHider
```
Round loop becomes the spec's intended `for each ufo: applyIntent(ufo, ufo.controller.think(view(ufo)))`. `BotSeeker` (offline SURVIVE) is untouched; HUNT only swaps which controller the player's UFO holds. A future `Remote*` drops in with zero engine change.

**Roles flip via the map's own spawns** — pick one `seeker` spawn for the player UFO, `HIDER_COUNT[diff]` `hider` spawns for bots. **Zero new maps.**

**Hunter controls:** move (WASD/stick/drag, `HUNTER_SPD`, momentum τ=`HUNTER_TAU`); **SCAN PULSE** (Space/RB/tap, expanding ring `0→SCAN_R*1.4` over 0.5s, `PULSE_CD`, pings any hider the front crosses with `C>PULSE_REVEAL` → red marker `PING_HOLD`s — your tool vs perfect-blend bots that still leak a little `C`); **FOCUS SCAN** (hold Shift/LT, shrink SCAN_R 60% but double gain); **BEAM** (hold LMB/RT within `BEAM_R` if target `C≥BEAM_HOLD_C`, reuses lines 826–843 verbatim with target=locked bot); camera zoom out one notch (`TARGET_VISIBLE_TILES=20`).

**BotHider AI** — each bot is a full hider actor (own paint/S/C via `computeCamoFor`), FSM reusing existing thresholds: WANDER → SEEK_TERRAIN (low-openness/cover cell via existing `opennessGrid`) → PAINT_MATCH (crawls at `PAINT_SHIFT_SPEED`, HARD uses pattern path on seams) → HOLD (`freeze=true`, `C` bottoms out — invisible until pulsed) → FLEE (on scan-overlap+LoS+rising sensed-signal, or on ping; bolts, breaks LoS, re-hides; HARD bots get the toolkit — DASH/decoy/ink — for symmetry). Sensing is symmetric: the hunter senses each bot with the player's sensing code (`bot.C * prox * losClear`); the bot senses hunter proximity to decide FLEE.

**Scoring:** `+200`/catch, catch-streak bonus (+50/100/150 within 15s), `−40` per bot that escapes a beam, board-clear bonus `max(0,(HUNT_TIME-elapsed))*5`; grade off catch-ratio + speed. New `best` key `level|HUNT|diff`. SUMMARY reuses the screen with hunter labels (Caught, Board-clear, Best streak).

**Staged shipping:** (a) actor refactor [done in P5] → (b) `BotHider` wander+paint, no hunter, verify via `__aac` → (c) `HumanSeeker` intent + hunter HUD → (d) beam/scoring → (e) bot toolkit on HARD (**cut line** — HUNT still ships without bot decoys).

**Wiring:** `HumanSeeker`/`BotHider` controllers; `startRound` HUNT role-flip + bot spawns; `updateBots` loop uses `ufo.controller.think`; `botHiderIntent`/`readHunterIntent`; hunter HUD (pulse cooldown, ping markers, caught counter); reuse `computeCamoFor` per bot per tick.

**Verify headlessly:** `__aac.hunt={role:round.mode==='HUNT'?'hunter':'hider', bots:round.bots?round.bots.length:0, caught, pings, botStates:round.bots?.map(b=>b.state)}`. Smoke: start HUNT → assert `round.bots.length===HIDER_COUNT[diff]` and each bot `computeCamoFor` runs (bot `C` in [0,1]); fire scan pulse over a HOLD bot → assert it pings if `C>PULSE_REVEAL`; beam a bot to lock → assert `caught` increments and the bot is removed; assert `player.controller===HumanSeeker`.

**Top risks:** *5 bot camo evals/tick blowing frame budget* → ≤5 actors × one `computeCamoFor` = well within budget; culled draws. *Bot pathing jank in open maps* → straight steer + `circleBlocked` (maps are open); no A* needed. *Seam divergence* → both directions use the one sensing function; keep sim deterministic (bots seeded). Stage (b) is verifiable headlessly before any hunter UI exists, de-risking the whole mode.

---

### PASS 7 — COSMETICS: unlocks, wardrobe, daily meta
**Goal:** low-risk retention layer. **All cosmetic, applied at draw time, never touches the sim.**

New store `LS_PROGRESS={unlocks:[ids], stats:{catches,dailyStreak,lastDaily,…}, equipped:{skin,ufo,trail}}`.
- **Chameleon skins** (tint/overlay in `drawChameleon`, gated on `currentPaint`): default, glasswing (outline ×0.4, body α0.85), emberback (3 amber dorsal dots), frostscale (inner blue rim), circuit (dark fork lines). Unlocks: Survive-HARD once / bank-all-beacons / HEAT-180s / 7-day DAILY streak.
- **UFO skins** (HUNT player UFO): classic, obsidian, retro-green. Unlock by HUNT catches / board-clears.
- **Trails** (pooled `type:'trail'`, culled): none, paintdrip, stardust.
- **Wardrobe** tile on TITLE; locked entries show unlock condition; equipping writes `equipped`, read at draw.
- **DAILY meta** (finish the P5 seed hook): streak counter, "Today's best: N", feeds skin unlocks.

**Verify headlessly:** `__aac.progress={unlocks:PROGRESS.unlocks.length, equipped:PROGRESS.equipped}`, `daily:LS_DAILY parsed`. Smoke: win Survive-HARD → assert `glasswing` unlock added and persisted; equip a skin → assert `drawChameleon` reads it and player `C` is unchanged (cosmetic-only assertion).

**Top risks:** *cosmetic accidentally reading into sim* → skins/trails only modify draw calls; the unchanged-`C` smoke assertion guards it. *localStorage schema drift* → versioned key `aac.progress.v1`, defensive parse.

---

## 6. FINAL DECISION SHEET (what a reviewer should memorize)

**Art:** moonlit noir; three lights only; emitters are the only saturated pixels; per-biome sky+grade+drifter for instant identity; CRT post (vignette+CA+scanlines) shared by world and menus; texture never affects detection.

**Chameleon:** warm jewel, spiral tail, dorsal crest, twin tracking eye-turrets, squash-&-stretch + breathing; conceal = alpha-melt + terrain-color edge-dither, eyes fade last.

**UFO:** 6 baked chrome hull sprites by FSM state; live beam/thrusters/rim-lights/reticle/shadow; state = personality; notice "!" on spot.

**Abilities:** FREEZE (root→cap 0.985), DASH (520px/s, 0.16s, flare +0.5, cd 2.5), DECOY (6s life, cd 12, max 1, steals belief), INK (r90, 3.5s, cd 10, max 2, breaks LoS).

**Modes:** PRACTICE, SURVIVE, TIME ATTACK, HEAT, DAILY, HUNT.

**Hunter:** fly the UFO via `HumanSeeker`; `HIDER_COUNT` `BotHider` chameleons; scan-pulse reveal + beam abduct; catch-scoring; proves the seam.

---

## 7. PER-PASS RISK → 60fps + SAMPLER-INTEGRITY SUMMARY

| Pass | 60fps guard | Sampler guard |
|---|---|---|
| P1 | `AMB_GLOW_MAX` blit cap; recycled `amb[]`; baked terrain/post; adaptive-quality drops scanlines→ambient first | texture reads nothing; motif amplitude ≤±22; dev mean-check |
| P2 | 6 baked UFO sprites; scalar-only anim; ≤16 dither arcs; beamdust throttled | `updateChameleonAnim` writes only `player.anim*`; identical-`C` smoke |
| P3 | pooled swap-pop, cached color strings, `PCAP_EFF`, tween cap 48, ≤26 oscillators; desat gated | camera/particles/audio all on real-time, never feed `computeCamo`; rotation only in cutscene |
| P4 | HUD glyphs/arrows O(#meters+#UFOs) no alloc; cached wash for spotlight | comfort re-routes existing systems; camo math untouched |
| P5 | abilities O(1); `≤5` decoys/inks/beacons; `losClear` ≤2-cloud loop | `computeCamoFor` = pure rename; `concealment` +optional param defaulted; HEAT clones diff |
| P6 | ≤5 bot `computeCamoFor`/tick; culled draws; no A* | one sensing fn both directions; seeded bots; determinism preserved |
| P7 | pooled trails, culled; draw-time only | cosmetics never read sim; unchanged-`C` smoke |

**Adaptive quality auto-scaler (add in P1, global safety net):** track EMA of `realDt`; if >20ms for 30 frames, step down a quality level: L1 halve `AMB_CAP_EFF`; L2 disable scanlines + CA; L3 disable ambient ground glow + drop `PCAP_EFF` to 90. Recover one level after 120 frames <15ms. Exposed as `__aac.perf={ema, qLevel}`.

---

## 8. FRAME BUDGET LEDGER (mid phone, DPR2, target ≤16.6ms)

| System | Budget |
|---|---|
| Sim (stepSim, ≤3–6 actors) | ~2.0 ms |
| Terrain blit + cover (culled) | ~1.5 ms |
| Ambient ground + `amb[]` (≤176 small `'lighter'` blits) | ~1.0 ms |
| Chameleon + UFO sprites + beam | ~2.0 ms |
| Post chain (grade+vignette+scanline+overlays) | ~1.8 ms |
| Particles (≤`PCAP_EFF`) + streaks | ~1.0 ms |
| HUD + arrows + glyphs | ~1.2 ms |
| Audio (scheduler, real-time) | ~0.5 ms |
| **Total** | **~11 ms** — headroom for GC & phone jitter |

---

## 9. `window.__aac` EXTENSIONS (headless verification, added per pass, never removed)

Extend the existing getter (L1494) additively:
```js
biome, ambCount, terrainCacheBuilt, postReady,                 // P1
anim:{walkPhase,tailCurl,eyeL,eyeR,blinkE}, ufoSprites, abductPhase, // P2
fx:{trauma,hitstop,slowScale,zoomPunch,tweens,particles:pn,streaks}, // P3
settingsView:{motion,shake,colorblind,glyphsOn,hc,textSize}, tutorialStep, threatArrows, // P4
ability:{freeze,dashCd,decoyCd,inkCd}, decoys, inks, beacons, mode, // P5
hunt:{role,bots,caught,pings,botStates}, // P6
progress:{unlocks,equipped}, daily, perf:{ema,qLevel} // P7 + auto-scaler
```
Plus a dev-only test method (stripped in prod) `__aac.force({event})` to fire `repaint/spotted/nearMiss/beamLock/abduct` for smoke harness beat-verification, and `__aac.sampleAt(wx,wy)` returning `terrainReference` so the harness can assert detection is byte-identical before/after every visual pass.

---

## 10. SMOKE-GATE CHECKLIST (must pass between every pass)

1. `__aac.state` reachable; `appState` cycles TITLE→…→SUMMARY.
2. `__aac.sampleAt` at 5 fixed world points returns identical RGB to the P0 baseline (proves no visual pass desynced the camo sampler).
3. Start a round on each of the 6 biomes + baked → no thrown errors, `terrainCacheBuilt`, `biome` resolves.
4. `pn<=PCAP_EFF` and `amb.length<=AMB_CAP_EFF` at all times.
5. `settings.motion='minimal'` zeroes `trauma/hitstop/streaks/ambient`.
6. A full SURVIVE round to WIN and to abduction completes and reaches SUMMARY.
7. `perf.ema < 16.6ms` on the reference mid-phone profile; auto-scaler engages under synthetic load and recovers.

**Files:** all changes land in `/workspaces/abduct_a_chameleon/index.html`. Seam contract referenced from `/workspaces/abduct_a_chameleon/docs/BUILD_SPEC.md` §10. This document supersedes the five component specs wherever they disagree.