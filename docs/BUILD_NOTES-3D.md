# BUILD NOTES — the 3D game (read this first when resuming)

Last updated: **2026-08-01**. This is the living record of what we're building, how it works, and
where every external thing comes from. The older `HANDOFF-3d.md` is a predecessor document and
partially stale; trust this file first, then `HANDOFF-v02.md` for the 2D game's history.

> **⛔ NEXT SESSION STARTS HERE: `docs/PLAN-the-wait-and-the-files.md`.**
> Stephen played the 8/01 build and gave two notes ten seconds in: the wait needs something to
> PLAY, and the story pages must be **earned** — *"starting with all 1000 is just dumb and id never
> want to read them but if i found them each game id read them if displayed as they came."*
> The reading room I shipped is a LIBRARY, and nobody reads a menu. The plan turns the wait into
> the place you earn pages (spot-the-hider calibration), which answers both notes with one build
> and proves the render-a-frame technique the SURVEY PHOTOGRAPH needs later.
>
> Still true and still untested: the other seven 8/01 changes. `docs/PLAY-THIS-FIRST.md` is the
> test list — is the two-tone tax fair, is the jump height right, is the litter too busy.

> **Shipped since the 7/20 body of this doc** (read the commit messages, they carry the detail):
> per-terrain speed/settle effects (`TERRAIN_FX`), the Kenney nature scatter that made every
> walkable cell have something to paint, a settings panel (sensitivity / invert Y / volume), a
> persisted career (`aac3d_career`), and on **8/01** the paint-studio softlock + the colour-space
> bug below. There is now ONE automated test for this file: `test/paint3d.mjs` (`npm run paint3d`).

---

## 1. What we're building

**`abduct-3d.html` is the main product** — a single-file, no-build, browser 3D hide-and-seek game
in the spirit of MECCHA CHAMELEON (the June 2026 Steam hit): hiders run around in third person,
pick a spot, snap to the abductors' top-down view (`V`) to check themselves, and **paint their own
body** in a studio (`E`) to match the ground and landmarks. Seekers fly UFOs and tractor-beam
anyone they spot. The 2D game (`index.html`) is finished, live on the Skywolf portal, and frozen.

Owner directives that stand: plain white/black bathroom-sign humanoids (not a chameleon creature);
color-match quick paint + adjustable color wheel; snap poses; unique objects all over the maps;
randomly generated levels; penalties for beam guess-spam; small completely-unique mechanics;
landscape fullscreen phone play; hand-customized levels eventually; **work solo, no agent swarms,
be frugal with tokens; use existing free assets instead of building from scratch**.

## 2. Where everything external comes from (all CC0, no attribution required — see CREDITS.md)

| Asset | File(s) | Source | How fetched |
|---|---|---|---|
| Rigged character (76 anim clips) | `assets/characters/character.glb` | KayKit **Character Pack: Adventurers** (Knight), github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | `curl` the raw.githubusercontent.com file under `addons/kaykit_character_pack_adventures/Characters/gltf/` |
| Crate, crates-stack, barrel, boulder(=rubble), pillar, chest, table | `assets/props/*.glb` | KayKit **Dungeon Remastered**, github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0 (`addons/.../Assets/gltf/`, note double ext `*.gltf.glb`) | same |
| Statue, tree (tree currently unused) | `assets/props/statue.glb`, `tree.glb` | **Kenney** Starter-Kit-Basic-Scene, github.com/KenneyNL/Starter-Kit-Basic-Scene (`sample/Mini Arena/Models/GLB format/`, URL-encode spaces) | same |
| Grass tufts (decoration) | `assets/props/grass.glb`, `grass_small.glb` | **Kenney** Starter-Kit-3D-Platformer, github.com/KenneyNL/Starter-Kit-3D-Platformer (`models/`) | same |

Sourcing playbook that worked: KayKit and Kenney both mirror packs on GitHub with **direct raw
file URLs** (curl-able, scriptable) — quaternius.com and kenney.nl main-site downloads are
zip/drive links and NOT curl-friendly.

⭐ **2026-08-01 — the playbook was too pessimistic. Two more paths, both verified (200 + `glTF`
magic on every file, licence text read not assumed):**
| Source | What it gives you |
|---|---|
| `github.com/Kenney-CCO/Kenney-CCO.glb` | **366 flat single-file GLBs** of Kenney's 3D library |
| `github.com/trebeljahr/quaternius-showcase` | **all 33 Quaternius packs**, `public/glb/<pack>/` |
Also fine: `KenneyNL/Starter-Kit-City-Builder`, `beep2bleep/FreeAssetsByKenneyNLandQuaternius`
(Platformer Kit), `lalomorales22/threejskate` (Mini Skate).
⛔ **Still rejected:** KayKit City-Builder / Restaurant / Furniture / Halloween — gltf + bin +
shared texture, **zero GLBs**.
⛔⛔ **There is NO CC0 playground equipment in GLB anywhere on GitHub** — no swing, no see-saw, no
slide, no roundabout. Only itch/marketplace zips. That is why ours are primitives. Do not re-search.
⚠ Models from these mirrors reference `Textures/colormap.png` **relative to their own folder** —
copy it in beside them or the loader logs an error per model.
106 files live under `assets/{clutter,street,playground,flower,building}/` (3.6MB); **46 are wired**,
the **21 building pieces are downloaded but NOT PLACED**, and 57 more verified variants are listed
in the session's `asset-manifest-extras.json` if the scatter wants more. To inspect a GLB without a browser:
`node -e` read the file, `JSON.parse` the chunk at offset 20 (length at offset 12) → lists
animations/meshes/nodes/materials. Checked and rejected: KayKit City-Builder (gltf+bin pairs, no
trees), Space-Base (no saucer), Halloween/Hexagon (listing failed), Kenney platformer/racing kits
(no standalone tree). **No usable tree GLB exists in these repos** — and our procedural tree stays
anyway (see invariant below).

## 3. Integration invariants (do not break these)

1. **Color belongs to the game, not the asset.** Cover props get their materials REPLACED by the
   per-instance palette (`instMat`/`maybePattern` + `*_HUES` tables) and register `addTarget`
   with that exact color. That's the camouflage gameplay. This is why the Kenney tree (single
   mesh, baked colormap atlas — canopy color can't be palette-exact) was rejected; procedural
   trees remain correct.
2. **UV re-projection at load.** KayKit ships palette-atlas UVs. `loadCharacter()` and
   `loadProps()` re-project UVs (front box projection over the bbox: canvas top = head/prop top)
   so the 128×128 paint canvas and the striped/checkered pattern textures render sensibly.
   Exception: `DECO_KEEP_UV` set (grass) keeps original UVs + original material — decoration only.
3. **Fallbacks stay.** If any GLB fails to load, `buildDoorGuy` (capsule rig) and the primitive
   cover shapes take over silently. Never delete them.
4. **Per-player rigs** are `SkeletonUtils.clone` of the one loaded scene (shared geometry); each
   player gets ONE painted `MeshStandardMaterial` (`makePaintSkin` canvas → `CanvasTexture`)
   which also drives camo opacity fades. Locomotion: `Running_A` vs pose clip, chosen by
   per-frame position speed (works for local + remote, zero extra net state).
   Poses are clip-backed: `POSE_KEYS idle/sit/lie/dead/tpose/cheer` → `POSE_CLIP` names.
5. `CHAR_FACING = 0` const — flip to `Math.PI` if the character visibly runs backwards
   (untested on a real screen; no browser in this sandbox).
6. **Editing ritual**: python3 heredoc patch with `assert old in s` + uniqueness guards, then
   regex-extract the `<script type="module">` body → `node --input-type=module --check`.
   The 15 jsdom suites cover the 2D game and cannot touch this file (WebGL). The one 3D test is
   `test/paint3d.mjs` — headless Chrome + swiftshader. **Run it after any UI change here.**
7. ⛔ **Colour space.** `THREE.Color` stores **linear-sRGB**; a 2D canvas gives you **sRGB bytes**.
   Never compare them directly. `matchFor` did for months, so a *perfect* paint scored 65% and
   `camoLevel = stillness × match` could never pass the bot's 0.70/0.75 gates — the reward for
   painting well was unreachable dead code. Convert with `t.getRGB(out, THREE.SRGBColorSpace)`.
   Symptom to watch for: a number that should be 100 sitting stubbornly in the 60s.
8. ⛔ **This game is played on a landscape phone, so every panel must FIT ~430px of height.**
   The paint studio was anchored `top:50%` + `translateY(-50%)` at its natural 703px and put both
   of its exits off-screen; a phone has no `E` key, so the only escape was a reload. Any panel with
   an exit gets its header/footer **pinned** (grid areas) and scrolls its middle. Breakpoints go on
   the panel's real measured height, not a guessed phone width. And measure at **more than one**
   height — the `?`-over-🎨 collision only reproduces at 390 and 375, not 430.

## 4. The mechanics stack (all shipped, all live)

- **Hide model**: `camoLevel = stillness × matchFor(myAvg, x, z)`; match vs nearest paint-target
  landmark within radius, else terrain color; opacity `1 - cl*(1-CAMO_MIN_OPACITY)`.
- **Nerve scoring (P33, the reference's soul)**: you EARN only while a seeker is near, looking,
  and seeing nothing (`EARN_SEE_R`, LOS-checked); taunt (`T`) = ×3 earn window, real bait.
- **Beam battery (P31)**: beam drains, catches refund, empty = 3s overheat → guess-spam penalty.
- **Wet paint (P34)**: 15s after painting, moving drips colored spots on the world.
- **Echo scan (P34)**: seeker `G`, costs battery, 8s delay, pings anything that MOVED in the zone.
- **DECOY (P37)**: hider `F`/B-button/👥, 18s cd — drops a frozen copy with your exact paint +
  pose, camouflaged by the same math with stillness=1. Never moves → echo scan is silent on it.
  Seeker beam-locking it for `LOCK_TIME` pops it: they self-inflict overheat=3 + battery dump
  (state event `pop` {owner,t}); owner hears a win jingle. Net shape: player state `decoy`
  {x,z,yaw,pose,avg,t} (null clears); rotation to seeker role auto-clears.
- **Random worlds**: `makeRandomMap(seed)` — themed terrain blobs, 2 seam strips (2-tone lanes),
  walled buildings with a door, furnished interiors (crate/barrel/chest/table), 4–8 scattered
  landmarks (pillar/chest/table/statue), ≤220 grass tufts. Solo default is a random world
  (`ensureMapPublished`); 🗺 chip has 12 authored maps + 🎲.
- **Phone mode**: tap-to-start → fullscreen + landscape lock; dual sticks; touch buttons
  🎨👁🕺📣👥 / BEAM / SCAN / ▲▼; `body.touch` CSS declutters.
- **Solo**: training bot UFO; phase-undefined counts as lobby so movement/painting work alone.

## 5. Ship + deploy flow

- Work on branch **`glowup`** → commit → `git checkout main && git merge --ff-only glowup &&
  git push origin main` → back to glowup. GitHub Pages serves **main / root**.
- **Live/testing URL** (mutable, updates ~1–2 min after push):
  `https://stephenuffugus.github.io/abduct_a_chameleon/abduct-3d.html`
- **Frozen portal URL** (append-only, what the Skywolf portal iframes — do not touch):
  `https://stephenuffugus.github.io/abduct_a_chameleon/releases/v3.0.0/abduct-3d.html`
  NOTE: the frozen snapshot predates `assets/` and P33–P37 — when the owner okays it, cut
  `releases/v3.1.0/` INCLUDING `assets/` + `maps/` and give the studio manager the new URL
  (iframe needs `allow="fullscreen"`). githack URLs are NOT frameable (x-frame-options).
- Multiplayer = Playroomkit (CDN, no server of ours). The 2D game's relay (`server/relay.mjs`,
  `render.yaml`) is separate and untouched.
- Verify a deploy: `curl` the live URL for a new marker string; assets should return 200.

## 6. Where we left off + tomorrow's shortlist

Owner's last playtest: "kind of working" — movement fix + rich default world + real character +
props + decoy all shipped SINCE then and are awaiting their next test. Watch for feedback on:
character facing (flip `CHAR_FACING` if backwards), character scale/read, prop scale, decoy feel.

### Ranked queue as of 8/01 END OF DAY

**0. HE PLAYS IT.** Eight changes, none tested. Everything below is guesswork until that happens.

1. **The random map generator itself.** This is the real variety job and the biggest single win
   left. Authored maps carry the walls (downtown 296, ruins 262); **random maps have almost none**,
   so a random world reads thin next to downtown no matter how much we scatter on it. Marks and
   litter can only decorate what the generator builds. Wanted: alleys, doorways, low walls to
   vault, gaps between crates, roof edges, pipe runs — STRUCTURE, not texture. The 21 downloaded
   building pieces are the kit; they need a placement system.
2. **The survey photograph** (his idea, crystallised — see the note below). The ship photographs
   the valley on arrival, then objects are removed; hiders must BECOME the missing objects, and the
   hunter plays spot-the-difference against the photo. Makes camo into object mimicry with no morph
   tech, makes group camo native (the photo shows three crates, so it takes three of you), and is
   straight out of the Abduction Files canon. Cheap: render ONE frame from a fixed camera before
   the hiders enter.
3. **Group camo** — two or more hiders close together scored as one silhouette. The research says
   MECCHA has **no designed co-op hiding at all**; stacking is only an emergent meme. This is a
   genuine gap in the market leader, not a copy.
4. Unlocks (career is still five read-only numbers); portal earn-bridge (3D posts nothing).
⚖️ Parked by Stephen: metallic/roughness sheen matching, until he has played it.
⚖️ Open: his clone musing is MECCHA's (3 clones, any found counts as you). **We already have
DECOY** and ours is inverted — it baits the seeker into an overheat. Risk-variant is his call.

### Ranked queue as of 8/01 (surveyed against the live file, all solo-testable on a phone)

The constraint that outranks everything: **Stephen and Penny test this themselves, usually ALONE,
usually on a phone.** A feature that needs a lobby of strangers cannot be judged by them, so it
delivers nothing this week. That is why the studio softlock jumped the queue on 8/01.

1. **Two-tone match** — score head/torso against the nearest prop and legs against the ground, so
   one flood-fill stops being a perfect disguise. This is the first real *decision* the paint
   system would have, and the 2D game already ships the same idea (`test/twotone.mjs`, "P8 Split
   Camo") so there is an oracle to port. ⚠ `pavg` is on the wire and decoys + remote camo read it,
   so it needs a second field with a fallback, plus a bot retune.
2. **A real solo round** — the solo branch is literally one line (`players.length < 2` → stay in
   `waiting`, return), so alone there is no clock, no goal and no end: an endless sandbox whose own
   banner says "Second player = real rounds". `botTick` is already fully local (it self-disables at
   2+ players), so a run — prep window, clock, star target, escalating bot tier, end card banking
   to `careerRound()` — can be built **local-only with zero `setState`** and cannot touch a real
   lobby. Do NOT route it through the shared `phase`/`active` machinery; that is the one change in
   this file that can genuinely desync multiplayer.
3. **The seeker's blindfold.** `HIDE_SECONDS = 120` is Stephen's own ruling (7/29: "minimum 2
   minute window") and should NOT be shortened — but `#hidewait` is an opaque `#04070f` panel over
   the whole screen, so in a 1v1 the hunter stares at black for two solid minutes every round.
   Fix the *experience*, not his number: let them fly for recon with hiders un-rendered, or give
   the wait a terrain-only map view. ⚠ Whatever you do must leak nothing about hider positions —
   wet-paint drips and snow tracks are world decals and would give spots away.
4. Unlocks — `careerRound()` is one call away from a `checkUnlocks3D()`, and `CAREER.{caught,
   rounds,bestHidden}` mirror the 2D ladder almost field-for-field. Nothing is gated behind the
   career today; it is five read-only numbers.
5. Portal earn-bridge — the 2D posts `{sws:'earn',game:'abduct',event,value}` on `daily_streak` /
   `first_blend` / `round_win`; the 3D posts nothing at all.

Older queue (still valid, lower priority now):
1. **Game modes** — Infection (caught hiders become seekers), Double, Reverse Chicken Race —
   host round logic in `hostTick`; the reference's fan favorites.
2. **Room-scale interior maps** — MECCHA's maps are furnished rooms; our building system +
   chest/table/pillar props are the starting kit. Hand-crafted level format next
   (owner wants hand-customized levels; SCANNER editor + `maps/levels.json` is the pipeline).
3. **Portal earn-bridge for 3D** — 2D already posts `{sws:'earn',game:'abduct',event,value}`;
   wire the same postMessage events into the 3D round funnels, deliver event list to the studio
   manager through the owner.
4. More asset mining as needed: KayKit Restaurant/Furniture Bits (interiors!), City-Builder
   (needs gltf+bin pair handling), Quaternius via manual download if ever needed.
5. Bigger lobbies / hider free-cam between rounds / clone-size tricks — reference gaps, lower priority.
