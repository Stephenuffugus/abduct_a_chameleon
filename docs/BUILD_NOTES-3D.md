# BUILD NOTES — the 3D game (read this first when resuming)

Last updated: **2026-07-20, end of session** (tip commit `cc35026`). This is the living record of
what we're building, how it works, and where every external thing comes from. The older
`HANDOFF-3d.md` is a predecessor document and partially stale; trust this file first, then
`HANDOFF-v02.md` for the 2D game's history.

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
zip/drive links and NOT curl-friendly. To inspect a GLB without a browser:
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
   There are NO automated tests for the 3D file (WebGL); the 15 jsdom suites cover the 2D game.

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

Priority queue (owner-aligned):
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
