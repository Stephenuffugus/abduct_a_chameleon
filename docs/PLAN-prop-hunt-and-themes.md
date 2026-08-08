# PLAN — Prop Hunt, Themes, and the Serious Generator
### Abduct a Chameleon 3D · drafted 2026-08-08 · status: PLAN, not started
Stephen's brief: *"im too focused on the painting aspect, what if we incorporated
the prop hunt style too where people could turn themselves into an object perhaps
3 times per game to change what they are and run and hide. it would make having
more diversity around maps better and we could have themes or something so not
everything is always on the map and we could make it really deep with a lot of
unique things and create a serious generator to make our levels incredible. if we
plan how to build it the best we can take our time doing so."*

This is the plan. Take-our-time mode: one phase per session, one variable at a
time, every phase gated before the next starts. Everything below is anchored
against the live file (`abduct-3d.html`, branch `salvage`, HEAD ae624f5).

---

## PHASE 0 VERDICT — Stephen's test round (2026-08-08)

He played. Four notes, each now an acceptance bar for this plan:

1. **"A lot of structures all look the same, kind of boring layout."**
2. **"I can't stand on rocks, roofs, or awnings."**
3. **"There's not a lot of detail."**
4. **"The sound effects are really primitive."**

⛔ **Caveat that reframes 1-3: he tested a month-stale deploy.** The live
github.io build (main, `c141c22`) predates the ENTIRE structures era — probe
showed zero occurrences of `mergeStaticWorld`/`addRoofBridges`. No mantle
rule, no standable roofs, no staircase fixes, no L-shaped blocks, no face
detail (windows/trim), no awnings, no plank bridges. `salvage` fast-forwards
`main` cleanly (0 divergent commits) and the suite was 17/17 green at its
tip. **Deploy, then re-test 1-3 against the real build.**

What stays true even on the new build:
- **Standability directive (his call, from the test):** rocks, roofs, and
  awnings must all hold a player. Roofs: standable on salvage via stairs +
  mantle — re-verify by hand. Rocks: `jump3d` proves boulders perch, but
  verify every placed rock VARIANT and scale registers (a rock whose top
  exceeds `STAND_MAX_TOP 2.0` silently becomes a wall). Awnings: currently
  "never a solid" BY DESIGN plus the canopy free-win concern — **overruled by
  the director's test**; make awning slabs platforms (tops ~2.2-2.6m sit
  under the 2.75 jump apex; perch-as-ground camo already prices standing on
  one). A gated change with its own climb3d cases.
- **Sameness/detail:** the composition gap is real and is exactly Phases 1
  and 6 (themes, grammar, districts, landmarks, the unused building kit).
  His note confirms their priority order.
- **Audio is now a phase of its own** (see build order): the synth SFX eras
  out. And in the mimic mode sound is load-bearing gameplay, not polish —
  prop movement noise is a TELL, so footsteps/scrapes need positional,
  material-aware audio before Phase 3 ships.

---

## 0. Why this fits (and was already half-written-down)

Two receipts from our own repo:

1. The Aug 02 level-design round measured that **the best hiding place in this
   game is already a crowd of similar objects** — paint crate-brown, stand among
   five crates, and a hunter looking straight down has to pick you out of six
   identical shapes. Morphing INTO the crate is that finding made first-class.
2. `docs/BUILD_NOTES-3D.md` §6 has **"the survey photograph" ranked #2** in its
   own idea queue: the ship photographs the valley on arrival, objects are
   removed, hiders must BECOME the missing objects, and the hunter plays
   spot-the-difference against the photo. Prop hunt is not a bolt-on here; it
   is where this game's design was already heading.

It also answers the "too focused on the painting aspect" worry without touching
what makes the game ours: painting your own body stays the signature verb;
mimicry becomes the second stealth system, with a hard budget.

## 1. The mode, rules first (defaults chosen — veto anything)

**MIMIC (working name — real names are Stephen's).** A hider ability in every
round, not a separate mode.

1. **3 morph charges per round** (his number). Morphing INTO a prop costs a
   charge; reverting is free but takes ~1s with a visible puff + audible pop.
   Barrel → run → crate = two charges.
2. **You pick from the map's own prop vocabulary** — a wheel of 6-8 types drawn
   from the round's THEME (§2), never a free catalog. Not on this map = can't
   become it.
3. **Props can move** — slowly, and it is LOUD in earshot. Consistent with the
   sweep design: moving is the one thing that gives you away.
4. **In prop form you cannot paint, stick, or jam.** One stealth system at a
   time.
5. **The morph moment is exposed** (0.8s flash + puff). Morph behind a wall,
   not in the alien's face. A lie must be catchable at creation.
6. **Stun-hit while in form = forced revert + revealed** (no charge refund).
   Beam catch works on a prop-form player like any player once locked.

**Seeker counterplay — NO NEW VERB.** Both existing tools extend, and the decoy
already proved the pattern (`dropDecoy` 7750: beam-locking a decoy pops it and
self-inflicts overheat + battery dump):

- **Airborne: the beam is the probe.** The beam lock engages on ANY prop —
  player-prop or real — with the identical lock ring for `LOCK_TIME 2.2`. On
  completion: player → caught as normal; real prop → pop + `overheat 3` +
  battery dump, exactly the decoy rule generalized. The lock LOOKING the same
  on both is what keeps the beam from becoming a free fake-detector.
- **On foot: the stun shot is the probe.** Shoot a suspect prop: player →
  stunned + revealed; real prop → loud DUD every hider can hear, and the
  `STUN_CD 9` is burned. Wrong guesses cost time and broadcast you.

**The honest tells** (a lie you can never be caught in is a cheat — house law).
A prop-form player is findable by skill, never by HUD:
1. **Placement.** Real props sit in motivated groups the generator built (§4).
   A barrel alone in open grass is a player's choice, and it shows.
2. **Company.** The theme bank is small and learnable; a prop type that appears
   once on the whole map is worth a probe.
3. **Breath.** Within ~3m a player-prop has a subtle sway. Close inspection
   beats guessing from the saucer.
4. **The morph moment + movement noise** (rules 3 and 5).
Later, at high skill: **the survey photograph** (Phase 7) makes placement
memory the deepest tell of all.

**Scoring — one channel, no second economy.** Prop form publishes a
PLAUSIBILITY score on the existing `camo` state: stillness (reuse the
`stillness` machinery, 9420) × in-company factor (≥1 real instance of your
prop type within ~6m — one distance check against the map's prop list). Then
everything downstream just works: `earnTick` (7774) pays only while a seeker is
within `EARN_SEE_R 26` with LOS and score > `CAMO_HIGH 0.55` — parked safely in
a corner a prop earns nothing; sitting in the open while the alien stalks past
earns stars. The bot's sight (`visibility = 1 - camo`, 7823) reads it too.
Rendering IGNORES camo while in form — a translucent barrel is nonsense; a
prop is always fully opaque, that is the point.

**Physicality (v1 defaults):** a prop-form player registers a dynamic solid at
their position (never through `mergeStaticWorld` — it is per-player, added and
removed on `form` state). Not a platform in v1 — nobody stands on you yet
(perch rules, `STAND_MAX_TOP 2.0`, stay untouched). The sweep (`fireEchoScan`
8097) still counts you as occupancy — prop form does not beat the scan, hiding
well within the pinged block does.

**The lone-hider note.** The Aug 02 open question — a solo hider has no answer
to the stun — gets softer here: charges are a second resource to break a losing
chase. Re-test before deciding more.

**HUD.** The hider already ran out of thumbs (nine verbs, five slots). MORPH
joins the contextual-slot system; the prop wheel replaces the paint palette
while in form. `hud3d` budgets (8% sight line, 1% dead centre) and `reach3d`
gate the buttons.

## 2. Themes — "so not everything is always on the map"

Today there are two independent variety axes: `GEN_THEMES[9]` (2198, terrain
recipe, picked by seed) and `MOODS[6]` (1936, sky/fog/lights, picked by map
name hash). A THEME PACK becomes the third axis, layered on `GEN_THEMES`:

- a **prop bank subset**: 8-14 prop types on the map out of the master library
  (~85 CC0 GLBs already load via `PROP_URLS` 6353). Small enough to learn in a
  round — which is what makes spotting the odd prop a knowledge skill.
- a **palette**: theme tints through the existing hue arrays + `_fillMats`
  shared-material cache; `draws3d` budget (300) is law and `mergeStaticWorld`
  (3520) is what buys it — every static prop stays `userData.mrg = 1`.
- a **grammar**: anchor groups and adjacency (§4).
- 1-2 **landmarks** for orientation and callouts ("by the well").
- Moods stay independent — any theme can be any night.

First six themes (working names): MARKET (stalls, crates, baskets, awnings),
HARBOR (barrels, coils, nets, bollards), JUNKYARD (wrecks, tires, drums,
pallets), GARDEN (pots, hedges, wheelbarrows, planters), CAMPSITE (tents,
logs, coolers, lanterns), RUINS (fallen columns, urns, rubble).

**Free ammunition already in the repo:** `assets/building/` — 22 CC0 building
GLBs (houses, shop_2story, tower_watch, garage, chimney) — is wired to
NOTHING; most of `assets/playground/` likewise. BUILD_NOTES has been asking
for a placement system for them since before the favela. Theme packs are that
placement system: themed structure silhouettes land here, against the
RENDER-BUGS quality bar ("no two buildings sharing a silhouette in one frame").

**Decoy parity law (gated):** every prop type on the morph wheel exists
naturally ≥3 times on the map. A morph option with no real siblings is an
instant spot and must be impossible by construction.

## 3. What the mode must NOT break (load-bearing constraints, verified)

1. **`hasLOS` gates the catch, not camo** (`detectAbductions` 8805). Camo is
   cosmetic + bot-sight + scoring. Prop form rides the same three channels and
   leaves the catch geometry alone.
2. **`platforms` vs `solids` have different rules** (perch = top ≤
   `STAND_MAX_TOP 2.0`; stairs excluded from the generic solid pass; canopies
   deliberately above it). The dynamic prop-player solid must respect
   `resolveWalls`' mantle rule (9449) so a crate-form player on a stair apron
   doesn't wedge anyone.
3. **The door rule has been paid for three times.** Any new placement pass
   reserves doorways + stair approaches, and ends with the flood fill against
   the REAL `solids` (`repairReachability` 3628), never a re-implementation.
4. **Determinism with zero bytes on the wire**: scatter is `hash2` (UINT32,
   3858) / `mulberry32(mapName)`. Theme placement must be too. The morph
   itself is per-player state (a new `form` key next to `pose`/`camo` at
   `SEND_HZ 15`) — events, not streams.
5. **Map payload already strains Playroom global state** (30-50 KB JSON,
   HANDOFF §7.3). The deeper generator RLE-encodes the terrain before
   publishing — do this FIRST in Phase 1, it is the plumbing the rest sits on.
6. **Do not reach for InstancedMesh for props** — measured three ways, it
   loses to the extent-aware static merge (documented negative result, 3606).

## 4. The serious generator (v2) — composition, not sprinkles

Everything from the structures rounds stays (shared-wall blocks, L-shapes,
BSP rooms, spanning-tree doors, stairs + mantle, plank bridges, awnings,
doorway/approach reservation, static merge). v2 adds the layer Stephen keeps
asking for by name — composition — inside `makeRandomMap` (2228) and
`buildWorld` (2940):

- **Anchor → group → filler grammar.** Props stop scattering and start
  belonging: a stall anchors crates and baskets; a bench faces a path; bins
  cluster at a corner; drums line a wall. This is the RENDER-BUGS 🎨 bar,
  stated and never met: *"props exist in motivated groups… never as isolated
  single objects."* The litter pass already learned it ("piles only, no
  strays"); v2 applies it to everything. Grammar is DATA per theme, not code.
- **Districts.** 2-3 zones per map with different densities (dense block core,
  loose yard, open ground between) so maps have places rather than texture.
- **Landmarks.** 1-2 one-off set pieces per map — navigation, callouts, and
  what screenshots are made of. The unused building kit earns its keep here.
- **Silhouette variety** continues (stepped skylines, L-arms, and now themed
  structure shells).
- **Budgets are law**: draws3d 300; prop counts come from the theme through
  the shared-material merge.

**Gates (new, joining the 17-green suite; run ONE AT A TIME — 2-core law):**
- `themes3d` — N seeds × each theme: decoy parity holds; ≥85% of props belong
  to a motivated group (an orphan quota, because a little chaos is honest);
  bank coverage (every type present, none dominant).
- `morph3d` — the ability's state machine: charges decrement exactly on
  transform; revert free; beam-on-real-prop pops + overheats; stun-on-real-
  prop duds + burns cooldown; stun-on-player reveals; `RESTUN_LOCK 25`
  respected; morph impossible while stunned/held; camera sane at prop scale;
  the dynamic solid appears/disappears with form.
- Existing gates re-run per theme: `ground3d` (0 stranded, ≥97% connected,
  two-tone ≥25%, overhead ≥5%), `climb3d`, `draws3d`, `hud3d`, `reach3d`,
  `combat3d`.
- **worldshots per theme read by eye** stays the ritual no gate replaces —
  wide shot, street shot, worst angle on purpose.

## 5. Build order (one phase = one session, gated before the next)

- **PHASE 0 — A HUMAN ROUND (before any new code).** The standing ⛔: nobody
  has played a clean round of the current build. Stephen + Jessie + daughter
  play; watch: does START feel like it did something, can an eight-year-old
  tell she is stunned, does the ping make you search the block. Collect: what
  "more pads" means, and the shape of the player-built-structures idea. No
  point building a second stealth system on an unplayed first one.
- **PHASE 1 — THEMES (generator only, no new mechanics).** RLE the map
  payload, then theme packs + grammar + districts + landmarks + the building
  kit + `themes3d` + per-theme worldshots. Ships visible map diversity on its
  own even if the mode slips.
- **PHASE 1.5 — STANDABILITY + AUDIO (Stephen's test-round list).**
  Rocks/roofs/awnings all hold a player (directive above), plus the audio
  pass: CC0 recorded SFX bank to replace the primitive synths, per-mood
  layered ambience, positional material-aware footsteps/scrapes (they become
  the mimic tell), stingers for sweep/stun/beam/morph. Gate: climb3d rock +
  awning cases; audio reviewed by ear like worldshots by eye.
- **PHASE 2 — MORPH SOLO.** The ability vs the training bot (bot learns to
  probe: prefers props out of company or that it saw move). `morph3d`,
  `reach3d`, `hud3d` hold. Playable alone the day it lands.
- **PHASE 3 — FAIRNESS + ECONOMY.** Plausibility scoring through the `camo`
  channel, in-company bonus, probe-tax tuning, `balance.mjs` gains a PROP bot
  alongside WALKER/PAINTER.
- **PHASE 4 — MULTIPLAYER.** `form` as reliable player state, beam/stun probe
  branches host-checked, spectate shows forms, two-phone family test before
  calling it done.
- **PHASE 5 — GENERATOR POLISH.** More themes, more grammar, set-piece
  landmarks; contact sheets per theme read against the composition bar.
- ~~PHASE 6 — player-built structures~~ **RETIRED 2026-08-08, his answer:**
  *"I wanted people to be able to blend in better. adding prop hunt abilities
  touches this."* The underlying want was blending, and the mimic mode IS
  that. No separate build system.
- **PHASE 6 (deep endgame) — THE SURVEY PHOTOGRAPH** (BUILD_NOTES #2, already
  canon-fit): the ship photographs the map on arrival; the seeker can consult
  the photo; spot-the-difference becomes the master-level tell. Also unlocks
  **group camo** (BUILD_NOTES #3): the photo shows three crates, so it takes
  three of you.

## 6. Open calls for Stephen (defaults run unless vetoed)

1. Mode + theme names (working titles throughout).
2. Props move slowly-and-loudly (default) vs frozen-while-prop.
3. "3 times per game" read as: 3 transforms in, reverts free (default).
4. Probe punishments: beam→overheat (decoy rule) + stun→dud+cooldown
   (default) — harsh enough?

Answered 2026-08-08: "more pads" — no preference, dropped. Player-built
structures — folded into the mimic mode (see retired Phase 6).
