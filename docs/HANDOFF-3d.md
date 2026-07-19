# ABDUCTEE — Handoff for Claude Code

You're taking over a working prototype of a browser multiplayer game. This document is everything you need to understand it, run it, and continue it. Read `README.md` too — it's the player/dev-facing overview; this file is the engineering deep-dive.

---

## 1. What this is

A free-to-play, browser hide-and-seek game. **Hiders** are simple white humanoid figures who camouflage against the terrain by standing still; **seekers** pilot UFOs, hover over hiders, and abduct them with a tractor beam. It's meant to ship on the open web (the studio's own site — deliberately *not* Roblox), monetized later via cosmetics/ads.

**Stack (intentional constraints):**
- **Three.js** for 3D rendering, loaded from CDN. No build step.
- **Playroom Kit** for multiplayer (rooms, lobby, matchmaking, state sync). Loaded from CDN.
- **Single-file client** (`index.html`) — the studio's established pattern. Keep it that way unless there's a strong reason not to.
- Maps and tools are separate data/scripts, not code baked into the client.

**Do NOT** rewrite this into a framework/bundler project or port it to another engine without the owner's sign-off — the single-file, no-build, web-native approach is a deliberate choice.

---

## 2. Repo layout

```
index.html                  ← the game (currently named abductee-game.html — RENAME to index.html)
scanner-level-editor.html   ← SCANNER: standalone top-down level editor (paint terrain, place cover/spawns, export JSON)
README.md                   ← player/dev overview
HANDOFF.md                  ← this file
tools/generate-levels.mjs   ← Node script: generates the themed maps + manifest
maps/
  greenwood.json  dunes.json  tundra.json  downtown.json  xeno.json  bog.json
  levels.json               ← manifest the game's level-picker reads
```

Everything is self-contained. Characters, audio, and effects are generated in code (no external asset files yet), so the game runs the instant it's served.

---

## 3. How to run

**Local dev (fastest, zero services):**
```bash
npx serve            # or: python3 -m http.server
```
Open the localhost URL. Playroom runs in **dev mode** on localhost with no game ID. Open the URL in **2+ browser tabs** (or use Playroom's on-screen **Add a Player**) to start a round. A single player can roam in the "waiting" warmup but rounds need 2+.

**Hosted / production:**
1. Playroom requires a **game ID** off localhost. Register the game at the Playroom dashboard and set it in the `insertCoin({ gameId: '...' })` call in `index.html` (search for `insertCoin`).
2. Serve over **https** (Playroom needs a secure context). GitHub Pages, Netlify, or Cloudflare Pages all work. The `maps/` folder must be served alongside `index.html` so the fetch-based level picker works.

**This game cannot be validated in a sandbox/preview** — it needs a real host (WebSocket to Playroom) and 2+ clients. Test on localhost with multiple tabs, or on a real host.

---

## 4. Architecture

### Client vs. host
Every player runs the same client. Playroom designates one client as **host** (`isHost()`). The split:

- **Movement is client-authoritative.** Each client computes its own position from input and publishes it. This is responsive but trust-based — see Limitations.
- **Game logic is host-authoritative.** The host runs role assignment, the round timer, scoring, and abduction validation (range + line-of-sight raycast + a sustained lock). It writes results to shared state; everyone reads.

`loop()` → if host, `hostTick(dt)` (authoritative sim) then `clientTick(dt)` (local movement, rendering, camera, HUD, audio). Non-hosts run only `clientTick`.

### Multiplayer state shape (Playroom)
This is the contract. **Per-player** state (`player.setState(key, val, reliable?)` / `player.getState(key)`):

| Key | Type | Writer | Notes |
| --- | --- | --- | --- |
| `xf` | `{x,y,z,yaw}` | that client | transform, ~15 Hz, unreliable |
| `role` | `'seeker'\|'hider'` | host | reliable |
| `abducted` | bool | host | reliable |
| `lock` | 0..1 | host | abduction progress, unreliable |
| `beam` | bool | that (seeker) client | reliable |
| `camo` | 0..1 | that (hider) client | ~15 Hz |
| `pose` | pose key | that client | reliable |
| `spawn` | `{x,z,alt}` | host | set at round start, reliable |
| `score` | number | host | reliable |

Profile: `player.getProfile()` → `{ name, color:{ hex } }`.

**Global** state (module `setState(key,val,reliable?)` / `getState(key)`), written only by host:

| Key | Type | Notes |
| --- | --- | --- |
| `map` | SCANNER map object | the active level, synced to all |
| `mapV` | int | bump to force everyone to rebuild the world |
| `phase` | `'waiting'\|'playing'\|'intermission'` | |
| `roundId` | int | increments each round; clients snap to spawn on change |
| `roundEnds` | ms timestamp | round hard end |
| `interEnds` | ms timestamp | intermission end |
| `winner` | `'seekers'\|'hiders'\|null` | |

### Round flow (host)
`waiting` (need ≥2 players) → `startRound()` assigns roles (rotates by round so everyone takes turns), teleports players to spawns, sets `roundEnds` → `playing`. During `playing`, `detectAbductions()` runs; round ends when all hiders are abducted (seekers win) or the timer expires (survivors score) → `intermission` → next round.

### Abduction (the one piece to keep correct)
Host-side, per beaming seeker × non-abducted hider: horizontal distance ≤ `BEAM_RADIUS` **and** a clear line-of-sight raycast (`hasLOS`, against `losMeshes`). Sustained contact accumulates a per-hider lock timer; at `LOCK_TIME` the hider is marked `abducted` and the seeker scores. This is the beginning of server authority — when you migrate to Colyseus, this logic moves server-side largely intact.

### Rendering
- **Terrain** is one vertex-colored ground mesh built from the map's terrain grid (each cell = 2 tris). `terrainKeyAt(worldX,worldZ)` maps world position → terrain key (used for camo color and terrain effects). NOTE: three.js color management is on; `THREE.Color` already stores linear-sRGB, so don't call `convertSRGBToLinear()` on colors you hand to it (that double-converts — it was a bug we fixed).
- **Characters** are procedural jointed figures (`buildDoorGuy`) with a pose system (`POSES` table + `applyPose`). Skin is white; camo lerps white→terrain color and drops opacity. A small profile-color visor keeps players distinguishable.
- **Cover** meshes (`addCover`) all block line-of-sight; `wall` also blocks movement (AABB in `solids`, resolved by `resolveWalls`).
- **Audio** is fully synthesized via Web Audio (`ensureAudio`, `tone`, `noise`, `SFX`, `beamSound`) — no files. The `AudioContext` resumes on first user gesture (key / pointer / gamepad button).

### Input
Keyboard+mouse (pointer-lock look) **and** gamepad (`gatherGamepad` polls the Gamepad API; works without pointer lock, which is why it also works on a phone with a controller). Both feed the same movement/look code.

---

## 5. The map/level system

**SCANNER format** (produced by the editor and the generator):
```json
{ "format":"scanner-map", "version":1, "name":"...", "grid":{"cols":N,"rows":M},
  "terrain":[[key,...],...],                    // row-major; y=0 is the first row
  "objects":[{"x":X,"y":Y,"type":coverKey}],
  "spawns":[{"x":X,"y":Y,"role":"seeker"|"hider"}] }
```

**Vocabulary — keep these three in sync (game `index.html`, editor `scanner-level-editor.html`, generator `tools/generate-levels.mjs`):**
- Terrain keys: `void grass dirt water rock concrete foliage metal sand snow ice mud moss lava ash crystal`
- Cover types: `tree boulder crate barrel wall cactus dead_tree ice_spike alien_pod`

The host picks a level from an on-screen picker (reads `maps/levels.json`, fetches the chosen map, publishes it via `map`/`mapV`). Drag-drop onto the game window also loads a one-off map (host only). Adding terrain/cover/levels means editing all three files' tables/configs.

**Regenerate maps:** `node tools/generate-levels.mjs`. Edit the `THEMES` array to add/change levels.

---

## 6. Tunables

Top of the `<script>` in `index.html`: `TILE`, `SEEKER_PER`, `SEND_HZ`, `HIDER_SPEED`, `UFO_SPEED`, `UFO_MIN_ALT`/`UFO_MAX_ALT`, `SENS`, `BEAM_RADIUS`, `LOCK_TIME`, `ROUND_SECONDS`, `INTERMISSION`, `CAMO_RAMP`, `CAMO_MIN_OPACITY`, `PLAYER_RADIUS`, `ABDUCT_POINTS`/`SURVIVE_POINTS`, `ABDUCT_ANIM`. Poses live in `POSES`; terrain colors in `TERRAIN`.

---

## 7. Known limitations & honest caveats

1. **Movement is client-authoritative — this is the #1 thing to fix for a real launch.** A modified client could teleport a hider or fake a position. Abduction is host-validated, but positions feeding it are self-reported. Fix = server authority (see roadmap task 1).
2. **Host-authoritative-via-a-player** (Playroom's model) means the host player has some trust and there's ~1 tick of latency on abduction. Fine for casual; Colyseus fixes it for ranked.
3. **Map payload size.** Levels are published through Playroom global state as a full 2D terrain array (~30–50 KB JSON). It works at current sizes but will strain if maps get much bigger — consider run-length encoding the terrain before publishing if you scale up.
4. **No accounts or persistence.** Poses reset each session; there's no cosmetics ownership. That needs an auth+DB layer (roadmap task 2).
5. **Audio is synthesized placeholders** — functional game feel, not final sound design.
6. **Water/lava** are gameplay-light (water slows, lava slows + blocks camo). No damage/health system.
7. **Characters are code primitives.** Swapping in real CC0 models + Mixamo animations is a planned upgrade (see README "Swapping in real assets").
8. **No anti-griefing / moderation.** If you add chat or UGC map uploads, that's a moderation surface the studio owns — build reporting/review before enabling.

---

## 8. Roadmap — prioritized next tasks

### Task 1 — Server authority (Colyseus) — HIGHEST PRIORITY for launch readiness
Stand up a Colyseus server (Node) and move the authoritative sim off the host client.
- Server owns: player positions (validated against speed/bounds), roles, round state, abduction (port `hostTick`/`detectAbductions`/`hasLOS` — the collision/LOS meshes can be reconstructed server-side from the map, or do simpler geometric LOS).
- Client sends **inputs** (or rate-limited positions the server sanity-checks), receives authoritative snapshots, interpolates.
- Keep Playroom or replace it — decide based on whether you still want its lobby/matchmaking. A clean option: Colyseus for the authoritative room, its own matchmaking.
- **Acceptance:** a client that lies about its position can't move faster than `HIDER_SPEED`/`UFO_SPEED` or teleport; abductions only register with genuine range+LOS+lock computed server-side.

### Task 2 — Accounts + cosmetics (the revenue path)
- Add auth + a database (Supabase or Firebase are the low-lift picks) shared across the studio's games.
- Persist per-account **unlocks**: poses (the picker already exists — gate entries behind ownership), plus new cosmetic axes: **UFO skins** for seekers (recolor saucer/dome/beam — high-visibility, no gameplay impact, ideal first paid cosmetic) and hider **visor/emblem** variants (must NOT break camo — keep the body white).
- **Acceptance:** unlocks persist across sessions per account; a store/inventory screen; cosmetics render for all players via synced state.

### Task 3 — Real assets
- Load a CC0 low-poly humanoid (Kenney/Quaternius) via `GLTFLoader`, keep it white for camo, and drive poses from Mixamo clips instead of the primitive `POSES` rotations. Kitbash CC0 environment props for cover.
- **Acceptance:** characters and props look intentional; camo still reads from overhead; file sizes stay reasonable for web.

### Task 4 — Content & polish
- More levels (extend `THEMES`), water/lava consequences (e.g., lava briefly stuns), a real main menu / settings (audio volume, sensitivity, invert-look), sound design pass, spectator UI improvements, mobile on-screen touch controls as a gamepad fallback.

---

## 9. Conventions & how-tos

- **Add a pose:** add an entry to `POSE_KEYS` + `POSE_NAMES` + a function in `POSES` (sets joint rotations). It appears in the picker automatically.
- **Add a terrain type:** add a key→color in `TERRAIN` (game), a swatch in the editor's `TERRAIN` array, and use it in the generator. All three must agree.
- **Add a cover type:** add a branch in `addCover` (game), an entry in the editor's `OBJECTS`, and reference it in the generator. Decide if it blocks movement (push an AABB to `solids`) — everything blocks line-of-sight by being in `losMeshes`.
- **Add a level:** edit `THEMES` in the generator and run it, or hand-build in SCANNER and drop the JSON in `maps/` + add it to `levels.json`.
- Keep new gameplay state on the documented state keys; host writes authoritative state, clients write only their own.

---

## 10. External references

- Playroom Kit — https://joinplayroom.com (docs: https://docs.joinplayroom.com)
- Three.js — https://threejs.org
- Colyseus — https://colyseus.io
- Free assets (all license-clean): Mixamo (poses/anims, free/royalty-free for commercial), Kenney & Quaternius (CC0 models). **License rule:** CC0 = use freely no credit; CC-BY = credit; avoid CC-BY-NC / CC-BY-SA / GPL for commercial. Check each asset before shipping.

---

Start with **rename `abductee-game.html` → `index.html`**, serve locally, open two tabs, and play a round to see the whole system in motion. Then pick a roadmap task. Good luck.
