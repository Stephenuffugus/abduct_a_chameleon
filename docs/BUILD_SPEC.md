All five specs grounded and cross-checked against the real maps (68–74 × 52–54 grids, `format:"scanner-map" v1`, 5 seeker + 16 hider spawns each, up to ~370 cover objects incl. many `wall`). Here is the reconciled single source of truth.

---

# ABDUCT A CHAMELEON — MASTER BUILD SPEC (v1.0)

Single `index.html`, vanilla JS + Canvas2D, no build, no deps, offline-first from a plain http server (and degrades gracefully on `file://`). Top-down. Multiplayer-ready but not built. This document supersedes the five component specs wherever they disagree; every conflict is resolved below and the resolution is final.

## 0. Conflict resolutions (authoritative decisions)

| # | Conflict | Specs | DECISION |
|---|---|---|---|
| C1 | World scale `TILE` | 32 (camo/picker/ai/render) vs 24 (session) | **TILE = 32** |
| C2 | Player walk speed | 150 (camo), 116 (ai), 190 (session), 80-ref (render) | **PLAYER_WALK = 150**, CREEP = 55. All AI speeds rescaled ×1.293 to keep the design *ratios* (see §6). |
| C3 | Concealment/detection formula | 5 different | **Camo-model is canonical.** It produces `conceal` (UI) and `C=conspicuity` (AI). Picker's `matchQuality`, render's `C`, session's `detectability`, and bot-ai's inline `C` are all replaced by camo-model outputs. Aliases: `blend ≡ matchQuality`, `detectability ≡ C`. |
| C4 | Color distance | raw redmean D=12..220 (camo) vs norm/0.42 (picker) vs /420 (ai) | **Raw redmean, D_PERFECT=12, D_EXPOSED=220, smoothstep** (verified vs real hexes). |
| C5 | Ground sampling | footprint AABB blend (camo) vs 3×3 (picker) vs center tile (ai/render) | **Footprint AABB area-weighted blend** — one function, used by both camo math and the eyedropper. |
| C6 | MATCH assist | exact + paint-crawl (camo) vs 82% snap + 2.5s cooldown (picker) | **MATCH sets `targetPaint` = exact footprint reference; body physically crawls at PAINT_SHIFT_SPEED. No artificial gap, no cooldown.** The crawl (≤0.85 s, with `SHIFT_SHIMMER` exposure) + stillness *is* the skill and the natural rate-limit. Manual SV/hue drag still lets experts override. |
| C7 | Studio slow-mo | Practice only (picker) vs unstated | **STUDIO_SLOWMO = 0.35 in PRACTICE only.** In SURVIVE the full Studio runs at real time; the always-available instant-MATCH (`Q`/tap) is the in-chase tool. |
| C8 | Stillness model | S attack/recover (camo) vs timeStill/1.5 (ai) vs 1−v/2.5t (render) vs 1−v/MAX (session) | **Camo-model `S`** (attack 0.08 s, recover 1.20 s, smoothstep 20→150). |
| C9 | Beam lock duration | 1.5 (camo) vs 2.4/1.7/1.1 (ai) vs 1.6/1.2/0.9 (session) | **Per-tier LOCK_TIME 2.4 / 1.7 / 1.1** (bot-ai owns the beam). |
| C10 | Difficulty names | CHILL/NORMAL/NIGHTMARE (ai) vs EASY/NORMAL/HARD (session) | **EASY / NORMAL / HARD** (= CHILL/NORMAL/NIGHTMARE constants). PRACTICE is a no-fail variant of EASY. |
| C11 | Camera | follow-cam (render) vs letterbox whole map (session) | **Adaptive follow-cam** (render-juice §1). |
| C12 | Timestep | fixed 60 Hz (ai) vs single clamped dt (session/render) | **Fixed-timestep accumulator @ 60 Hz** (DT_FIXED=1/60), render interpolates, seeded RNG for determinism. |
| C13 | SUSPECT_GAIN | tuned for old C≈0.60 walking | **Retuned** because unified walking `C≈1.0`: GAIN 1.3/1.8/2.6 (re-verified in §6.6). |
| C14 | Player radius | 11 (camo) vs 13.4 (render) | **PLAYER_RADIUS = 12** (footprint+collision); **PLAYER_DRAW_R = 13** (body). |
| C15 | Modes shipping | PRACTICE+SURVIVE (session), HEAT stub | **PRACTICE + SURVIVE ship. HEAT = greyed "Coming soon".** |

Key emergent player-facing `C` values under the unified model (memorize these — everything is tuned around them):

| Situation | conceal | C | Result |
|---|---|---|---|
| Matched color, settled still | 0.95 | 0.05 | Ghost — meter drains |
| Matched, still, hugging boulder | 0.99 | 0.01 | Effectively invisible |
| Matched, **creeping** (55 px/s) | ~0.73 | ~0.43 | Risky near a scanner, usable to reposition |
| Matched, **walking** (150) | ~0.00 | 1.00 | Full flare — motion is the dominant tell |
| Foliage-on-grass (mq 0.56), still | 0.47 | 0.53 | "Close ≠ matched" — draws investigation |
| Any color, walking | ~0.00 | 1.00 | Movement always exposes |

---

## 1. MASTER CONSTANTS BLOCK (paste-ready, final)

```js
// ============ WORLD / SCALE ============
const TILE = 32;                 // world px per terrain cell (authoritative)
const PLAYER_RADIUS = 12;        // footprint + collision radius (world px)
const PLAYER_DRAW_R  = 13;       // chameleon teardrop body radius
const DT_FIXED   = 1/60;         // fixed sim step (s)
const MAX_FRAME_DT = 0.05;       // frame dt clamp fed to the accumulator (tab-switch guard)

// ============ MOVEMENT ============
const PLAYER_WALK  = 150;        // px/s full walk (== camo MOVE_FULL)
const PLAYER_CREEP = 55;         // px/s held creep (Shift / creep button)
const MOVE_MULT = { water:0.55, ice:1.10, lava:0.80, void:0.0, _default:1.0 };
const ICE_MOMENTUM_TAU = 0.35;   // s, ice velocity lerp constant

// ============ CAMO / CONCEALMENT (canonical detection model) ============
const D_PERFECT = 12, D_EXPOSED = 220;          // raw redmean thresholds
const PAINT_SHIFT_SPEED = 300, SHIFT_DELTA_EPS = 4; // paint crawl px/ch/s
const MOVE_STILL_MAX = 20, MOVE_FULL = 150;     // stillness smoothstep band
const STILL_ATTACK = 0.08, STILL_RECOVER = 1.20;// S time-constants (fall fast / rise slow)
const COVER_RADIUS = 44;
const COVER_MAX = { wall:0.85, boulder:0.75, alien_pod:0.72, dead_tree:0.68,
                    tree:0.66, crate:0.62, barrel:0.60, ice_spike:0.55, cactus:0.50 };
const GAMMA_M = 1.3, GAMMA_S = 1.6;
const MAX_CONCEAL_OPEN = 0.95, CONCEAL_HARDCAP = 0.99;
const MOVE_BEACON = 0.85, SHIFT_SHIMMER = 0.06;
// terrain interactions
const WATER_RIPPLE_FLOOR=0.35, WATER_CONCEAL_CAP=0.90;
const ICE_SETTLE_MULT=1.5;
const LAVA_MATCH_CAP=0.35, LAVA_CONCEAL_CAP=0.40, LAVA_DOT=2; // hp/s
const CRYSTAL_CONCEAL_CAP=0.92;
const WELL_HIDDEN_C = 0.30, STREAK_C = 0.35;    // scoring thresholds (alias of C)

// ============ COLOR / PAINT (picker) ============
const STUDIO_SLOWMO = 0.35;      // PRACTICE-only time scale while Studio open
const STUDIO_W = 360, STUDIO_H = 300; // logical panel px
// paintHSV is the single source of truth; PAINT(rgb)/hex/paintCss derived from it.

// ============ BOT AI — shared thresholds (constant across difficulty) ============
const ENTER_SUSPECT=0.35, EXIT_SUSPECT=0.15, ENTER_INVEST=0.60;
const ENTER_CHASE=0.85 /* == SPOTTED */, DROP_CHASE=0.45;
const BEAM_R=26, BEAM_BREAK_R=64, BEAM_HOLD_C=0.05, REACQUIRE_TIME=0.9, BEAM_DRAIN=0.6;
const TURN_RATE=3.2, ARRIVE_DT=0.25, BELIEF_TRACK=6.0;
const SPAWN_GRACE=1.5;           // s of half-gain after round start
const COORD_RANGE=480;           // HARD shared-belief radius
const NOISE_FLOOR_BASE=0.06;     // overridden per tier below

// ============ BOT AI — per-difficulty (EASY / NORMAL / HARD) ============
const DIFF = {
  EASY:   { UFO_COUNT:1, SCAN_R:144, PATROL_SPD:90,  SCAN_SPD:36, INVEST_SPD:100,
            CHASE_SPD:135, BEAM_TRACK_SPD:78,  SUSPECT_GAIN:1.3, SUSPECT_DECAY:0.85,
            LOCK_TIME:2.4, NOISE_FLOOR:0.09, GIVEUP_TIME:4.5, COOLDOWN_TIME:3.5,
            PATROL_REROLL:30, COORDINATE:false, SURVIVE_TIME:90,  diffIndex:0 },
  NORMAL: { UFO_COUNT:2, SCAN_R:176, PATROL_SPD:118, SCAN_SPD:48, INVEST_SPD:135,
            CHASE_SPD:165, BEAM_TRACK_SPD:100, SUSPECT_GAIN:1.8, SUSPECT_DECAY:0.65,
            LOCK_TIME:1.7, NOISE_FLOOR:0.06, GIVEUP_TIME:6.0, COOLDOWN_TIME:2.5,
            PATROL_REROLL:22, COORDINATE:false, SURVIVE_TIME:120, diffIndex:1 },
  HARD:   { UFO_COUNT:3, SCAN_R:208, PATROL_SPD:150, SCAN_SPD:60, INVEST_SPD:170,
            CHASE_SPD:195, BEAM_TRACK_SPD:122, SUSPECT_GAIN:2.6, SUSPECT_DECAY:0.45,
            LOCK_TIME:1.1, NOISE_FLOOR:0.04, GIVEUP_TIME:8.0, COOLDOWN_TIME:1.5,
            PATROL_REROLL:16, COORDINATE:true,  SURVIVE_TIME:180, diffIndex:2 },
};
// PRACTICE = EASY movement/scan constants, but: UFO_COUNT:1, LOCK_TIME:Infinity
//   (beam never completes → 2 s "SPOTTED" warning then loses interest), failEnabled:false.

// ============ RENDERING ============
const TARGET_VISIBLE_TILES=16, ZOOM_MIN=1.35, ZOOM_MAX=2.6;
const CAM_STIFFNESS=9.0, CAM_DEADZONE=6, DITHER_AMP=6, DPR_CAP=2;
const SHAKE = { beamLock:10, abductStart:14, repaint:2.5, max:14, decay:0.0009 };
const COL = { bg:'#0E1220', amber:'#F2B33D', cyan:'#3FD0E0' };
const COVER_COLOR = { tree:'#2c5223', dead_tree:'#4a3d2e', boulder:'#5b606b',
  ice_spike:'#bfe0f2', crate:'#8a5a2b', barrel:'#9a7b3a', cactus:'#3f7a45',
  wall:'#39415A', alien_pod:'#8e7fd6' };
// which cover blocks LoS: ALL of the above. Which blocks MOVEMENT: only 'wall' (+ 'void' terrain).

// ============ SESSION / SCORING ============
const COUNTDOWN_SEC=3.0, RESUME_COUNTDOWN=0.8, ABDUCT_CUTSCENE=1.4, TIMEOUT_ANIM=1.2;
const GRADE = { S:0.92, A:0.80, B:0.66, C:0.50, D:0.34 }; // else F
const LS_BEST='aac.best.v1', LS_SETTINGS='aac.settings.v1';

// ============ TERRAIN TABLE (frozen) ============
const TERRAIN_HEX = { void:'#12182B', grass:'#4E8C4A', dirt:'#C9A96B', water:'#3A6EA5',
  rock:'#7B7F88', concrete:'#AAB0BC', foliage:'#2F5E37', metal:'#6E7A8A', sand:'#E0CB94',
  snow:'#E9EEF3', ice:'#ABCFE6', mud:'#4E4A31', moss:'#5FA663', lava:'#D2452A',
  ash:'#383944', crystal:'#8E7FD6' };
// TERRAIN_RGB[key] = {r,g,b} precomputed at boot.
const PRESET_ORDER = ['grass','dirt','sand','moss','foliage','mud','rock','concrete',
  'metal','ash','snow','ice','water','crystal','lava','void']; // 8×2 swatch grid
```

---

## 2. CAMO / CONCEALMENT MATH (canonical — the AI consumes exactly this `C`)

All functions run once per **fixed sim step** (DT_FIXED), in the order in §2.7. Colors are compared in plain sRGB integers 0–255 (no linearization, no `getImageData` — see Pitfall P1).

### 2.1 Footprint terrain reference (one function; also the eyedropper source)

```js
function terrainReference(px, py) {          // player center, world px
  const R = PLAYER_RADIUS;
  const x0=px-R, x1=px+R, y0=py-R, y1=py+R;
  const footArea = (2*R)*(2*R);
  const c0=Math.floor(x0/TILE), c1=Math.floor(x1/TILE);
  const r0=Math.floor(y0/TILE), r1=Math.floor(y1/TILE);
  let aR=0,aG=0,aB=0,aW=0, domKey='void', domW=-1;
  for (let row=r0; row<=r1; row++) for (let col=c0; col<=c1; col++){
    const key = terrainAt(col,row);          // outside grid => 'void'
    const ox = Math.max(0, Math.min(x1,(col+1)*TILE) - Math.max(x0,col*TILE));
    const oy = Math.max(0, Math.min(y1,(row+1)*TILE) - Math.max(y0,row*TILE));
    const w  = (ox*oy)/footArea;
    const c  = TERRAIN_RGB[key];
    aR+=w*c.r; aG+=w*c.g; aB+=w*c.b; aW+=w;
    if (w>domW){ domW=w; domKey=key; }
  }
  return { rgb:{ r:aR/aW, g:aG/aW, b:aB/aW }, dominantKey:domKey, dominantW:domW };
}
```
Standing dead-center on one tile → pure reference (easy match). Straddling a seam → muddy blend no single terrain hex matches → deliberate positioning skill tax. Cover objects never enter this — cover contributes only via §2.4.

### 2.2 Perceptual match → `matchQuality` (redmean, verified vs real hexes)

```js
function redmean(a,b){ const rb=(a.r+b.r)*0.5, dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;
  return Math.sqrt((2+rb/256)*dr*dr + 4*dg*dg + (2+(255-rb)/256)*db*db); } // ~0..765
function matchQuality(paint, ref){
  const d=redmean(paint,ref);
  const t=clamp01((d-D_PERFECT)/(D_EXPOSED-D_PERFECT));
  return 1 - t*t*(3-2*t); }                  // smoothstep, 1=perfect
```
Calibration (final): grass/grass 1.00 · moss/grass 0.75 · foliage/grass 0.56 · sand/dirt 0.62 · ice/snow 0.46 · concrete/rock 0.28 · white/grass 0.00.

### 2.3 Paint crawl (the skill window)

```js
function updatePaint(dt){                     // currentPaint chases targetPaint
  for (const ch of ['r','g','b']){
    const step=PAINT_SHIFT_SPEED*dt;
    currentPaint[ch]+=clamp(targetPaint[ch]-currentPaint[ch], -step, step);
  }
  shifting = maxChannelDelta(currentPaint,targetPaint) > SHIFT_DELTA_EPS;
}
```
Full 0→255 swing ≈ 0.85 s; adjacent-shade tweak ≈ 0.15 s. `matchQuality` **always uses `currentPaint`** — you are literally the wrong color while shifting. All paint inputs (SV drag, hue, hex, preset, MATCH/eyedropper) write `targetPaint`; the body never snaps.

### 2.4 Stillness, cover, concealment, conspicuity

```js
function updateStillness(dt, speed, onIce, inWater){
  let m = smoothstep(MOVE_STILL_MAX, MOVE_FULL, speed);   // 0..1 movement amount
  if (inWater && speed>MOVE_STILL_MAX) m = Math.max(m, WATER_RIPPLE_FLOOR);
  const Star = 1 - m;
  let tau = (Star < S) ? STILL_ATTACK : STILL_RECOVER;
  if (onIce) tau *= ICE_SETTLE_MULT;           // harder to settle on ice
  S += (Star - S) * Math.min(1, dt/tau);
  return m;
}
function coverBonus(px,py){
  let best=0;
  for (const o of coverObjects){               // pre-filtered LoS-blockers list
    const d=distPointToObjectEdge(px,py,o);
    if (d<COVER_RADIUS) best=Math.max(best, COVER_MAX[o.type]*(1-d/COVER_RADIUS));
  }
  return best;
}
function concealment(mq,S,cb,terrainCap){
  let base=Math.min(Math.pow(mq,GAMMA_M)*Math.pow(S,GAMMA_S), MAX_CONCEAL_OPEN);
  let c=base + cb*(1-base);                     // cover fills the remaining gap
  return Math.min(c, CONCEAL_HARDCAP, terrainCap);
}
function conspicuity(conceal, m, shifting){
  return clamp01((1-conceal) + MOVE_BEACON*m + (shifting?SHIFT_SHIMMER:0));
}
```

### 2.5 Terrain caps (by `dominantKey`)

```js
function terrainMatchCap(k){ return k==='lava'?LAVA_MATCH_CAP : k==='void'?0 : 1; }
function terrainConcealCap(k){ switch(k){
  case 'lava':return LAVA_CONCEAL_CAP; case 'void':return 0;
  case 'water':return WATER_CONCEAL_CAP; case 'crystal':return CRYSTAL_CONCEAL_CAP;
  default:return 0.99; } }
```
Movement mults from `MOVE_MULT`. Lava applies `LAVA_DOT=2` hp/s. Void is impassable (collision, §5.3). Ice uses momentum integration (§5.3) which keeps `S` low.

### 2.6 "Why was I spotted?" (always answerable)

```js
function spottedReason(mq,m,S,domKey){
  if (domKey==='lava'||domKey==='void') return "Out in the open — you can't hide here";
  const colorMiss=1-mq, unsettled=1-S, top=Math.max(colorMiss,m,unsettled);
  if (top===m       && m>0.25)         return "You moved";
  if (top===colorMiss&&colorMiss>0.25) return "Your color didn't match the ground";
  if (top===unsettled&&unsettled>0.25) return "You hadn't settled yet";
  return "A scanner passed directly overhead";
}
```

### 2.7 Per-step camo order (produces `player.conceal`, `player.C`, `player.mq`, `player.m`, `player.S`)

```
1 updatePaint(dt)
2 ref = terrainReference(px,py)
3 mq = min(matchQuality(currentPaint, ref.rgb), terrainMatchCap(ref.dominantKey))
4 speed=|vel|; onIce=(ref.dominantKey==='ice'); inWater=(ref.dominantKey==='water')
5 m = updateStillness(dt, speed, onIce, inWater)
6 cb = coverBonus(px,py)
7 conceal = concealment(mq,S,cb, terrainConcealCap(ref.dominantKey))
8 C = conspicuity(conceal,m,shifting)
9 player.{mq,S,m,conceal,C}=… ; blend≡mq ; detectability≡C
```

---

## 3. COLOR PICKER + MATCHER UX (Paint Studio)

`paintHSV = {h,s,v}` is the **single source of truth**. Derive on every change: `PAINT=hsv2rgb(paintHSV)` (0–255) → `targetPaint=PAINT` (body crawls, §2.3) → `paintCss=rgb2hex`. Only the hex field edits RGB directly, then back-converts to HSV once on commit. Init to grass `#4E8C4A`.

### 3.1 Persistent HUD (always on, independent of Studio)

- **Match Meter** — top-center, `220×34`, 12 px below top edge. Three redundant channels (colorblind-safe): fill bar width `= displayed% of mq`, ramp red `#D2452A` (<50) / amber `#E0A030` (50–84) / teal `#3AC0A0` (≥85); big centered `NN%`; word label `EXPOSED / BLENDING / HIDDEN`; grayscale-readable fill pattern (diagonal hatch when EXPOSED, solid when HIDDEN). Smooth: `displayed += (mq*100 - displayed)*0.25`.
- **Detection meter** — shows `max UFO suspicion on you` (0–100%); turns red past ENTER_CHASE.
- **Screen-edge vignette** pulses red at intensity `(1-conceal)` whenever any UFO's footprint overlaps you.
- **PAINT button** — bottom-center `56×56` circle, 20 px from bottom, filled with `paintCss` + brush glyph. Long-press (400 ms) = instant MATCH without opening.

### 3.2 Studio panel (canvas-drawn overlay, screen-space, `360×300` logical)

Anchored bottom-center 90 px above bottom edge; dim backdrop `rgba(6,10,20,.72)`; rounded 14 px; scales by `min(1, vpW/400)` on narrow phones. Panel-local coordinates:

- **SV square** `(16,40) 200×200` — X=Saturation 0→100, Y=Value 100→0. Pure-hue background + white→transparent horizontal + transparent→black vertical gradients; ring cursor (white ring + black ring double-outline). Drag to set S/V.
- **Hue strip** `(232,40) 28×200` — vertical rainbow h 0→360; horizontal bar cursor.
- **MATCH button** `(300,40) 52×52` teal. Below: **split swatch** `(300,98) 52×40` left=`currentPaint` (labeled "YOU"), right=footprint reference (labeled "GROUND"). Under it live `match NN%` (28 px).
- **HEX field** `(16,250)` — focuses a hidden `<input inputmode="text" pattern="[0-9A-Fa-f]{0,6}">`; live-updates on valid keystroke, commit on Enter/blur, invalid reverts.
- **RGB readout** `(120,250)` — `R,G,B` read-only.
- **Reticle toggle** `◎` `(300,250) 48×20` — off = MATCH samples under player; on = spawns a world crosshair draggable up to 6 tiles, to pre-sample ground you're about to enter; auto-hides 3 s after last move or on close.
- **Preset row** `(16,274)` — 16 swatches `40×20` in `PRESET_ORDER` (8×2). Tap sets `targetPaint` to that terrain hex (the "cheat sheet"). 2-letter terrain initial on hover/long-press.

### 3.3 The MATCH decision (FINAL)

MATCH sets `targetPaint = round(terrainReference(samplePos).rgb)` — the **honest exact answer**. The body then **crawls** there (§2.3), so it is not instant and not perfect-on-press. No cooldown; the crawl time + `SHIFT_SHIMMER` exposure + the stillness requirement are the skill and the rate-limit. Experts can still hand-tune via SV/hue if the seam blend isn't ideal. `samplePos = reticleOn ? reticlePos : playerPos`. SFX chirp on fire.

### 3.4 Open/close + slow-mo

| Input | Open Studio | Close | Instant-MATCH (no open) |
|---|---|---|---|
| Keyboard | `Tab` / `P` | `Tab`/`P`/`Esc` | `Q` |
| Mouse | PAINT button | PAINT/backdrop/✕ | — |
| Touch | tap PAINT | ✕ / backdrop | long-press PAINT (400 ms) |
| Gamepad | `Y` | `Y`/`B` | `RT` |

**Slow-mo:** while Studio open in **PRACTICE**, sim runs `dt*=0.35` with a "SLOW-MO" ribbon; in **SURVIVE**, no slow-mo. Instant-MATCH fires from any state, no slow-mo. Studio input: gamepad L-stick→SV cursor, R-stick X→hue, D-pad cycles presets. Keyboard `[`/`]` hue ±5, `,`/`.` value ±4, `-`/`=` sat ±4, `1`–`8` (+Shift 9–16) presets.

### 3.5 Studio state machine

```
CLOSED ─(P/Tab/Y/PAINT-tap)→ OPEN_IDLE
OPEN_IDLE ─pointerdown SVsq→ DRAG_SV ─up→ OPEN_IDLE
OPEN_IDLE ─pointerdown hue→ DRAG_HUE ─up→ OPEN_IDLE
OPEN_IDLE ─MATCH→ (targetPaint=ref) OPEN_IDLE
OPEN_IDLE ─hex focus→ EDIT_HEX ─enter/blur→ OPEN_IDLE
OPEN_IDLE ─preset tap→ (targetPaint=hex) OPEN_IDLE
any ─(Esc/✕/backdrop/Y/B)→ CLOSED
// Instant MATCH (Q/RT/long-press) fires from CLOSED too, no state change.
```

---

## 4. Not a section — reserved. (Difficulty lives in §1/§6, scoring in §9.)

---

## 5. INPUT, MOVEMENT & COLLISION

### 5.1 Unified `InputState` (consumed by whichever role the local player holds — hider today)

```
InputState = { move:{x,y} /*unit-ish*/, creep:bool, paintToggle:edge, matchNow:edge,
               pause:edge, confirm:edge, back:edge, navX:edge, navY:edge, debug:edge }
```
Sources merged each frame: **Keyboard** WASD/arrows move, Shift=creep, `E`/`Tab`/`P` open, `Q` match, `Esc`/`P` pause, `H` debug. **Touch** left virtual joystick (spawns wherever a pointer lands in the left play-area half, outside the panel; radius 60, deadzone 8), right-side hold-zone = creep, on-screen ⏸/ⓘ/PAINT/MATCH buttons. **Gamepad** L-stick move (deadzone 0.15), RT creep, X open, LB/RT match, Start pause, Back debug.

### 5.2 Control map (round + menus)

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | WASD/arrows | left virtual stick | L-stick |
| Creep (hold) | Shift | right hold-zone | RT |
| Open Studio | E / Tab / P | PAINT button | X / Y |
| Instant MATCH | Q | long-press PAINT / MATCH btn | LB / RT |
| Pause | Esc / P | ⏸ button | Start |
| Debug HUD (Practice) | H | ⓘ toggle | Back |
| Menu nav / confirm / back | arrows / Enter / Esc | tap / tap / ‹Back | D-pad,L-stick / A / B |

### 5.3 Movement integration (per sim step)

```
dir = normalize(input.move); base = input.creep ? PLAYER_CREEP : PLAYER_WALK
mult = MOVE_MULT[dominantKey] ?? MOVE_MULT._default
desiredVel = dir * base * mult
if (dominantKey==='ice') vel += (desiredVel - vel)*min(1, dt/ICE_MOMENTUM_TAU); // slide
else                     vel = desiredVel;                                       // crisp
// integrate with collision:
tryMove(px, vel.x*dt, 0); tryMove(py, 0, vel.y*dt);   // axis-separated
if moved this step: facing = atan2(vel.y, vel.x)      // else retain last facing
```
`tryMove` blocks the circle (r=PLAYER_RADIUS) against **void terrain cells** and **`wall` cover cells** only (all other cover is walk-through, blocks LoS not movement). Resolve per-axis so you slide along walls. Never let the player rest centered on a void cell.

---

## 6. BOT UFO SEEKER AI

One scan footprint per UFO: a circle on the ground centered under it, radius `SCAN_R` (per tier). Sensing is continuous in every state except COOLDOWN. States change *movement*, not whether it senses. UFOs fly above ground: they ignore walls/cover for movement, clamp to map bounds. The AI's **only** gameplay input is `player.C` (§2) plus positions and the cover grid (for LoS).

### 6.1 Agent model

```
Ufo = { x,y, vx,vy, heading, state, suspicion, lastSuspect:{x,y}, lastSuspectConf,
        beamCharge, targetId, patrolPath, patrolIdx, scanPhase, reacquireTimer,
        cooldownTimer, controller /* SeekerController, §10 */ }
```

### 6.2 FSM (thresholds constant across tiers; tiers scale rates/speeds/radii)

```
PATROL ─susp≥0.35→ SCAN ─susp≥0.60→ INVESTIGATE ─susp≥0.85 & LoS→ CHASE ─d<BEAM_R & LoS→ BEAM
  ▲       │susp<0.15                  │ giveup timer→ COOLDOWN      │susp<0.45→ INVESTIGATE
  └───────┴──────────────────────────┴─────────────────────────────┘   BEAM breaks→ CHASE
COOLDOWN ─timer done→ PATROL
```
- **PATROL** follow `patrolPath` at `PATROL_SPD`, reroll every `PATROL_REROLL`s. **SCAN** decelerate to `SCAN_SPD`, orbit 40 px around `lastSuspect`, sweep-line telegraph speeds up. **INVESTIGATE** steer to `lastSuspect` at `INVEST_SPD`; on arrival (`d<SCAN_R*0.5`) 1.2 s hover-sweep; `GIVEUP_TIME` while suspicion falls → COOLDOWN. **CHASE** full lock at `CHASE_SPD` toward live target while LoS holds; else decay to last-seen; `susp<DROP_CHASE`→INVESTIGATE; `d<BEAM_R`→BEAM. **BEAM** brake to hover, spring-track at `BEAM_TRACK_SPD`, charge beam (§6.5). **COOLDOWN** hover, beam off, suspicion decays 2×, ignores detection for `COOLDOWN_TIME`.

### 6.3 Sensing (per step, per UFO not in COOLDOWN)

```
d = hypot(player-ufo)
if d>SCAN_R: signal=0
elif !losClear(ufo,player,coverGrid): signal=0     // any LoS-blocking cover tile between = occluded
else: prox = smoothstep(0,1, clamp(1 - d/SCAN_R,0,1));  signal = player.C * prox
if signal>NOISE_FLOOR:
   suspicion += SUSPECT_GAIN * signal * dt * (spawnGraceActive?0.5:1)
   k=clamp(signal,0.1,1)*BELIEF_TRACK
   lastSuspect += (player - lastSuspect)*k*dt;  lastSuspectConf=max(lastSuspectConf,signal)
else:
   suspicion -= SUSPECT_DECAY * dt;  lastSuspectConf -= 0.5*dt
suspicion=clamp(suspicion,0,1)
// CHASE/BEAM lock-inertia: while los && d<SCAN_R, pin suspicion≥0.9 (no flicker)
```
`losClear` = DDA over tiles from scan center to player; occluded if any traversed tile holds a LoS-blocking cover object. Partial credit: player within 10 px of an open tile with clear LoS counts as visible (no pixel-perfect seam hiding).

### 6.4 Steering & patrol

```
steer(ufo,target,maxSpd): heading=turnToward(heading, atan2(dy,dx), TURN_RATE*dt);
  spd=min(maxSpd, dist/ARRIVE_DT); vel=(cos,sin)*spd; pos+=vel*dt   // arrival slow-in
```
Patrol path: score walkable non-void tiles by openness `min(distToNearestCover,6)`, weight `1+open²`, sample 5–8 waypoints, nearest-neighbor tour from spawn; advance on `d<SCAN_R*0.4`, wrap; reroll every `PATROL_REROLL`s. Seeds from the round RNG (deterministic).

### 6.5 Beam charge (order: break checks BEFORE charge — clean re-hide always wins)

```
if target left BEAM_BREAK_R        → CHASE (beamCharge persists, drains)
elif !los { reacquireTimer+=dt; if>REACQUIRE_TIME → CHASE } else reacquireTimer=0
if target.C < BEAM_HOLD_C          → CHASE          // repaint+freeze escapes the lock
elif in BEAM & los & C≥BEAM_HOLD_C: beamCharge += (1/LOCK_TIME)*dt; if≥1 → ABDUCTED
else beamCharge -= BEAM_DRAIN*dt
beamCharge=clamp(beamCharge,0,1)
```
Three escapes: outrun `BEAM_BREAK_R` (needs speed vs the UFO's track lag), break LoS behind cover within `REACQUIRE_TIME`, or re-hide `C<0.05`. **PRACTICE:** `LOCK_TIME=Infinity` — beam never completes; on reaching BEAM it flashes "SPOTTED" + buzzer, holds 2 s, then loses interest (drops to INVESTIGATE with suspicion halved).

### 6.6 Detection verification (unified `C`, NORMAL constants — must hold)

- Matched+still, 3 tiles (96 px) from center of `SCAN_R=176`: `C=0.05`, `prox=smoothstep(0.454)=0.43`, `signal=0.021 < NOISE_FLOOR` → **never detected.** ✔
- Same spot, **walking** (`C=1.0`): `signal=0.43`; time to ENTER_CHASE 0.85 = `0.85/(1.8·0.43)=1.10 s` → spotted in ~1.1 s. ✔
- Walking directly under center (`prox≈1`): `0.85/1.8=0.47 s` → caught fast. ✔
- Creeping matched (`C=0.43`), 3 tiles: `signal=0.185` → to INVESTIGATE 0.60 = 1.8 s (usable to reposition, risky under a live scan). ✔
- Foliage-on-grass (mq 0.56, `C=0.53`), still, 3 tiles: `signal=0.228` → draws investigation in ~1.5 s (teaches "close ≠ matched"). ✔

### 6.7 Coordination (HARD only)

Shared belief: any UFO with `suspicion≥ENTER_INVEST` broadcasts `lastSuspect`; idle PATROL/SCAN UFOs within `COORD_RANGE=480` set `lastSuspect` and bump `suspicion=max(own,0.5)`. Separation (PATROL/SCAN/INVESTIGATE only): if `dist(A,B)<SCAN_R*1.4`, add repulsion `∝(1-dist/(SCAN_R*1.4))`. Flanking: a 2nd investigator offsets its target by `perp·SCAN_R*0.8`.

### 6.8 Mandatory fairness HUD (death must be earned)

Everything the AI reasons about is drawn: scan footprint (faint fill + rotating sweep line under cover so occluded wedges render darkened), per-UFO suspicion ring (green<0.35 / yellow / orange / red≥0.85) with a "huh?" blip on crossing ENTER_SUSPECT, personal `C` meter + a thin link line to any sensing UFO when `signal>0`, and a lock-on reticle that tightens `BEAM_R*2.2→BEAM_R` over 0.35 s with rising whine before BEAM charges.

---

## 7. RENDERING, CAMERA & JUICE

All gameplay math in world px; canvas backing store scaled by DPR only at the `setTransform` boundary. `dpr=min(DPR_CAP, devicePixelRatio||1)`.

### 7.1 Camera (recompute zoom on resize only)

```
zoomBase = min(vpW,vpH) / (TARGET_VISIBLE_TILES*TILE);  zoom = clamp(zoomBase, ZOOM_MIN, ZOOM_MAX)
// follow (per frame, dt-independent):
d=dist(player,cam); if d>CAM_DEADZONE { t=1-exp(-CAM_STIFFNESS*dt); cam += (player-cam)*t }
// clamp so void never enters (center small maps):
halfW=(vpW/2)/zoom; cam.x = worldW<=vpW/zoom ? worldW/2 : clamp(cam.x, halfW, worldW-halfW)   // y analogous
// shake (screen px): shake.mag=min(shake.mag+amount, SHAKE.max); shake.mag*=pow(SHAKE.decay,dt)
```
World transform (with DPR): `ctx.setTransform(zoom*dpr,0,0,zoom*dpr, (vpW/2 - cam.x*zoom + shake.x)*dpr, (vpH/2 - cam.y*zoom + shake.y)*dpr)`. Screen→world for picking/sampling inverts this.

### 7.2 Terrain cache (once per map load)

`OffscreenCanvas(worldW,worldH)` (fallback `<canvas>`). Per tile: base hex, deterministic dither `d=((hash%13)-6)/6*DITHER_AMP` via `shade(hex,d)`, 2 tiny noise dots, grid baked at `rgba(255,255,255,0.04)`. Largest map 74×54 = 2368×1728 ≈ 16 MB — acceptable. Per frame = one `drawImage(terrainCanvas,0,0)` under the world transform (GPU clips). Dither ±6/255 is below the perceptual threshold that would let a player cheat detection (which samples base hex, not pixels).

### 7.3 Fixed render-loop order (per frame)

```
1 accumulate: acc += min(realDt, MAX_FRAME_DT); while acc>=DT_FIXED { stepSim(DT_FIXED); acc-=DT_FIXED }
2 clear: setTransform(dpr,0,0,dpr,0,0); fill bg
3 apply WORLD transform (§7.1, with render-interpolation alpha=acc/DT_FIXED on entity positions)
4 drawImage(terrainCanvas,0,0)
5 footstep ripples
6 cover: cull to visible tile-rect +1; shadows then shapes (editor shape language)
7 repaint particles (pooled)
8 chameleon (teardrop; outline+shadow fade with conceal; eye-alpha floor 0.5 self-visibility)
9 per UFO (culled by SCAN_R-expanded rect): scan footprint → beam → saucer
10 abduction FX if active
11 reset to SCREEN transform (dpr only)
12 vignette blit → scanline pattern → HUD panels/meters/threat pips/reason
13 Studio overlay (if open) → Match Meter is always drawn in HUD
14 requestAnimationFrame(loop)
```

### 7.4 Entities & juice

- **Chameleon:** rounded teardrop pointing at `facing`, fill = `paintCss` (drawn verbatim). Drop shadow α `0.35*(1-conceal)`, outline α `0.85*(1-conceal)^1.5`, eye α floored at 0.5 so the local player never loses their avatar even at conceal→1. At conceal→1 only the ground-matched fill + ghost eye remain.
- **Footstep ripples:** when `speed>0.5*TILE/s`, spawn amber ring every 0.18 s at the rear; `R=r0+age*TILE*2.2`, α `0.30*(1-age/0.5)` — a movement tell that reinforces "stillness = safety."
- **UFO:** radial-gradient cyan scan disc + rotating scan ring (`scanPhase+=2.2*dt`), tractor beam disc (pulsing) when locked, saucer hull+dome+3 blinking rim lights drawn last with a ground shadow (fakes altitude).
- **Repaint puff:** 10 particles in the new paint color, `shake.mag+=2.5`, one-frame white ring.
- **Abduction (1.4 s):** accelerating spin `phase²*22`, shrink to ~8%, lift `-TILE*2.2`, alpha fade, stretched cyan beam column, 14 amber sparkles at apex, `shake.mag=14` at start → then `CAUGHT`.

### 7.5 Perf rules

Zero hot-path allocation (particle pool cap 128 ring buffer; cache vignette + scanline pattern gradients once; precompute `paintCss` only on change). Cover culled by visible tile-rect — never iterate all ≤74×54 cells at runtime (downtown has 296 walls; filter the object list by rect). LoS/AI use squared distances. `dt` clamp (`MAX_FRAME_DT`) means a hitch never launches the camera or the sim. Budget: 1 terrain blit + ~40 culled cover + ≤3 UFOs + ≤128 particles + HUD ≪ 4 ms on a mid phone at DPR 2.

---

## 8. SESSION / MODE / MENU FLOW

### 8.1 App state machine

```
BOOT → TITLE → MODE_SELECT → LEVEL_SELECT → DIFFICULTY_SELECT → ROUND → SUMMARY → (LEVEL_SELECT|TITLE)
                                    ↑______(PRACTICE skips DIFFICULTY_SELECT)______|
```
All menus canvas-drawn (single-file, uniform touch/gamepad). Generic `Menu={title,items[],index,onBack}` + `drawMenu`/`handleMenuInput`; LEVEL_SELECT is a custom card grid using the same input helper.

### 8.2 Screens

- **BOOT** (≤1500 ms, non-blocking): `fetch('maps/levels.json')`. Success → manifest `[{file,name,display,loaded:false,data:null}]` (confirmed real shape). Failure (`file://` / unhosted) → `BAKED_MAP` only. Audio deferred to first gesture. Auto-advance to TITLE.
- **TITLE:** animated title (hue-cycling chameleon, drifting UFO beam), items **Play → How to Play (overlay) → Mute toggle**. Footer: "v0.1 offline" + best-time teaser from localStorage.
- **MODE_SELECT:** **PRACTICE / ZEN** (no fail, no timer, debug HUD) → LEVEL_SELECT (`pendingMode='PRACTICE'`, skips difficulty). **SURVIVE** (1–3 UFOs hunt, outlast timer, one abduction ends it) → LEVEL_SELECT. **HEAT** greyed "Coming soon".
- **LEVEL_SELECT:** responsive 2–3 col cards; thumbnail = map terrain rendered 1 px/tile to a cached offscreen (lazy-fetch that map's JSON on first scroll-into-view; shimmer until loaded; cover as faint dots). Per-card PB badge for `(level,mode,diff)`. Always-present "Prototype Meadow (baked)" card guarantees offline play. On select: `await loadMap(entry)` (per-map fetch error → inline "using baked map" + `BAKED_MAP`); PRACTICE→ROUND, SURVIVE→DIFFICULTY_SELECT.
- **DIFFICULTY_SELECT** (SURVIVE): EASY / NORMAL / HARD, each showing knobs inline ("UFOs 2 · 120s · normal scan"). Confirm→ROUND.
- **SUMMARY:** §9.

`BAKED_MAP`: valid scanner-map, 40×30, mostly grass with dirt/water/rock/sand patches, ~12 cover objects, 1 hider spawn center + 4 seeker spawns at edges, stored RLE and expanded at boot.

### 8.3 ROUND nested state machine

```
enter → COUNTDOWN (3→2→1→GO, 3.0 s, UFOs frozen, camera on player)
COUNTDOWN done → PLAYING
PLAYING: metrics accrue (only here); timer counts down (SURVIVE); UFOs sense/move; SPAWN_GRACE first 1.5 s.
   ├ beamCharge≥1 (fail on) → CAUGHT     (never in PRACTICE)
   ├ timer==0 (SURVIVE)     → TIMEOUT (win)
   ├ pause                  → PAUSED
   └ (PRACTICE) End Practice→ LEVEL_SELECT
PAUSED (sim frozen, audio ducked): Resume · Restart · Toggle Debug(if allowed) · Mute · Quit
   ├ Resume → RESUME_COUNTDOWN (0.8 s micro-countdown; grab timer resets only if lock <50%)
   └ Quit   → TITLE
CAUGHT → abduction cutscene 1.4 s → outcome=LOSE → SUMMARY
TIMEOUT → "TIME!" + UFOs retreat 1.2 s → outcome=WIN → SUMMARY
```
Single authoritative clock: fixed-timestep accumulator, frame dt clamped to `MAX_FRAME_DT`. `visibilitychange` (tab hidden) → auto-PAUSE if PLAYING. Pause always replays a countdown (can't dodge an imminent grab). Spawns: player at a `role:'hider'` point; UFOs at `role:'seeker'` points (cycle if `UFO_COUNT` > available; all maps have 5 seeker + 16 hider).

---

## 9. SCORING, GRADING, PERSISTENCE

Metrics accrue only in PLAYING (`blend≡mq`, `detectability≡C`):

```
survivalMs; blendAccum += mq*dt; lowDetectMs += dt if C<WELL_HIDDEN_C(0.30);
streakBestMs = longest span with C<STREAK_C(0.35) & not spotted;
spottedCount (UFO suspicion crossing ENTER_CHASE 0.85 on you);
nearMisses (entered BEAM, escaped before beamCharge=1);
timeMovingMs / timeStillMs.
```
```
avgBlend = blendAccum / survivalSec
base=survivalSec*10; blendBonus=round(avgBlend*500); hiddenBonus=round(lowDetectMs/1000*6)
streakBonus=round(streakBestMs/1000*8); missBonus=nearMisses*150; spotPenalty=spottedCount*40
winBonus = survivedToTimeout ? (300 + diffIndex*200) : 0
score = max(0, base+blendBonus+hiddenBonus+streakBonus+missBonus - spotPenalty + winBonus)

survRatio = survivedToTimeout ? 1 : clamp(survivalSec/timerSec,0,1)
quality   = 0.5*avgBlend + 0.3*(lowDetectMs/max(1,survivalMs)) + 0.2*clamp(streakBestMs/30000,0,1)
perf      = 0.6*survRatio + 0.4*quality   // grade via GRADE thresholds → S/A/B/C/D/F
```
**SUMMARY:** banner "ESCAPED"/"ABDUCTED" + stamped grade, animated count-up stats (time, avg blend %, longest streak, near-misses, times spotted, score), PB compare vs localStorage (`NEW BEST!` gold ribbon + confetti + arpeggio, else greyed "Best … (grade)" + delta). Buttons: **Retry · Change Level · Menu**.

**localStorage** (try/catch → in-memory fallback so the game always plays):
```
LS_BEST     = { "level|mode|diff": { bestScore, bestSurvivalMs, bestGrade, plays, updated } }
LS_SETTINGS = { muted, lastMode, lastLevel, lastDiff }
```

---

## 10. MULTIPLAYER-FORWARD SEAM (build offline, don't wire net)

- **SeekerController interface** — every UFO holds one; `think(ctx) → { move:{x,y}, scanAt:{x,y}|null, beam:bool }`. `ctx` is a read-only view (`self`, `worldTime`, `dt`, `percepts`, `map:{grid,isCover,terrainAt}`). Round loop: `for each ufo: applyIntent(ufo, ufo.controller.think(view(ufo)))`. `BotSeeker` ships now; `HumanSeeker`/`RemoteSeeker` drop in later with zero engine change.
- **Determinism** — sim = pure fn of `(state, intents, dt)`; **seeded RNG only** (`mulberry32(seed)`, seed in RoundConfig); no `Date.now()`/`Math.random()` in sim. Enables Restart replay and future host-authoritative net.
- **Snapshot stubs** — `serializeRoundState()/applySnapshot()` round-trip `{hider,seekers,timer,seed}`; used today by Pause/Restart, tomorrow the net payload.
- Roles come straight from `spawns[].role` (`hider`=chameleon, `seeker`=UFO) — the scanner map is already the shared content contract.

---

## 11. AUDIO (Web Audio synth, no files)

Deferred `AudioContext`, `resume()` on first gesture. Master gain honors `muted` (persisted). Cues: PATROL low drone (volume ∝ nearest-UFO proximity), SCAN ping, CHASE pulsing alarm, BEAM whine (pitch ∝ `beamCharge`), relief unlock chord (suspicion < EXIT_SUSPECT), MATCH chirp, repaint puff, UI move/confirm/back blips, SUMMARY sting + NEW-BEST arpeggio. All oscillator/gain graphs, envelopes ≤0.3 s, hard cap simultaneous voices at 12.

---

## 12. FILE PLAN — ordered sections of `index.html` (write top-to-bottom)

The file is published by wrapping your content in `<!doctype html><head>…</head><body>` — but this is a **standalone game file served by http**, so write a full normal HTML document. Sections in order:

1. **HTML skeleton** — `<!DOCTYPE html>`, `<meta viewport … user-scalable=no>`, `<canvas id="game">`, one hidden `<input id="hex">`, nothing else in the DOM.
2. **CSS** — reset; `html,body{margin:0;height:100%;overflow:hidden;background:#0E1220}`; `canvas{display:block;touch-action:none}`; `user-select:none`; hidden-input off-screen styling; `-webkit-tap-highlight-color:transparent`.
3. **JS — Constants** (§1): all tunables, `TERRAIN_HEX`→`TERRAIN_RGB`, `COVER_COLOR`, `COVER_MAX`, `DIFF`, `PRESET_ORDER`, `BAKED_MAP` (RLE).
4. **JS — Utils:** `clamp/clamp01/lerp/lerpHue/smoothstep`, `hsv2rgb/rgb2hsv/rgb2hex/hex2rgb`, `mulberry32`, `redmean`, math helpers.
5. **JS — Map load/sample:** `loadLevels`, `loadMap` (+ baked fallback + RLE expand), `terrainAt`, `terrainReference` (§2.1), `buildTerrainCache` (§7.2), cover list + `losClear` DDA, thumbnail renderer.
6. **JS — Color/camo math** (§2): `matchQuality`, `updatePaint`, `updateStillness`, `coverBonus`, `concealment`, `conspicuity`, terrain caps, `spottedReason`, per-step order.
7. **JS — Input** (§5): keyboard, pointer/touch (virtual joystick + hit-test order), gamepad → `InputState`; movement + collision `tryMove`.
8. **JS — Picker UI** (§3): `paintHSV` source-of-truth + derivation, Studio FSM/layout/draw/interaction, MATCH/eyedropper/reticle, presets, hex input binding, Match Meter HUD, slow-mo hook.
9. **JS — Bots** (§6): `Ufo` model, patrol gen, sensing/suspicion, steering, FSM `updateState/moveForState`, beam, coordination, `SeekerController`/`BotSeeker`, per-tick update.
10. **JS — Render** (§7): camera math + transforms, terrain blit, ripples, cover cull+draw, particles, chameleon, UFO, abduction FX, vignette/scanline caches.
11. **JS — HUD** (§3.1, §6.8, §9): meters, threat pips, `signal` link line, reason text, PRACTICE debug overlay.
12. **JS — Round/Session loop** (§8–§10): App FSM + menus, `RoundConfig` build, ROUND sub-FSM, fixed-timestep accumulator, scoring, localStorage, snapshot stubs.
13. **JS — Audio** (§11): synth voices, first-gesture unlock, mute.
14. **JS — Boot** (§12): canvas/DPR sizing + resize handler (recompute zoom), kick `loadLevels`, start `requestAnimationFrame` loop, wire first-gesture `audio.resume()`.

---

## 13. TOP-5 IMPLEMENTATION PITFALLS & HOW TO AVOID THEM

1. **Color-space / sampling correctness.** Never sample the *dithered terrain-cache pixels* with `getImageData` for matching — that reads the ±6 noise and desyncs from what the AI judges, and thrashes perf. **Always sample the base hex from `map.terrain[row][col]` via `terrainReference` (footprint AABB).** Compare in plain sRGB integers with `redmean` (no linearization). One sampler feeds both the camo math and the eyedropper — they must be the same function or detection and the UI will disagree.

2. **Terrain redraw perf.** Redrawing ≤74×54 tiles every frame will tank a phone. **Pre-render the whole world to one OffscreenCanvas once per map load** (grid + dither + noise baked in), then one `drawImage` per frame under the world transform (GPU clips the offscreen). Cap DPR at 2. Cull cover by the visible tile-rect (downtown has 296 walls — never iterate the full object list unfiltered). Cache vignette/scanline gradients once.

3. **Touch + pointer-event correctness.** Use unified Pointer Events with `touch-action:none` + `preventDefault` (passive:false) to kill page scroll/pinch-zoom. **Capture per `pointerId`**, allow two simultaneous (one on SV square, one on hue). Hit-test order: when the Studio is open it claims pointers that start inside its rect first; only pointers starting *outside* the panel spawn the virtual joystick / drag the reticle. Offset the SV cursor +18 px above the fingertip so the thumb doesn't hide the target. Gamepad polled each frame (no events).

4. **Straddling-cell sampling.** The footprint spans up to 4 tiles; reading only the center tile makes seams lie and desyncs eyedropper from detection. Use the **area-weighted AABB blend** (§2.1) with `dominantKey` driving terrain rules, `void` for out-of-grid. This makes seam-standing a real (intended) skill tax and keeps MATCH honest (it samples the exact same blend it must then match).

5. **Making "caught" feel fair.** Death must be legible and escapable. Enforce: fixed-timestep sim (a frame hitch must never teleport you into a beam), `SPAWN_GRACE` 1.5 s half-gain, every AI signal drawn (scan footprint, occluded wedges, suspicion rings, `signal` link line, tightening lock reticle with audio tell), three concrete BEAM escapes with the `C<0.05` re-hide check ordered **before** charge, `spottedReason` surfaced on every suspicion spike and on abduction, and pause always replaying a countdown so it can't be abused either way. If the player can always answer "which of match / stillness / cover / distance failed me," the game is fair.

---

**Consistency guarantees baked in:** one `TILE=32`, one `PLAYER_WALK=150`, one detection pipeline (`C` from §2 → AI in §6, aliases `blend`/`detectability` for §9), one MATCH mechanic (exact ref + crawl), one difficulty vocabulary (PRACTICE/EASY/NORMAL/HARD), one timestep (fixed 60 Hz, seeded RNG), one camera (adaptive follow). Every number above is final and mutually verified. Hand this document to the engineer as the single source of truth.