# ABDUCTEE

A free-to-play, browser-based multiplayer hide-and-seek game. **Hiders** are simple white figures who paint themselves to blend into the terrain; **seekers** fly UFOs and try to catch them in a tractor beam. Built to run on the open web (no app store, no platform cut) using Three.js for rendering and Playroom Kit for multiplayer.

Self-contained, no build step:

| Path | What it is |
| --- | --- |
| `index.html` | The game (Three.js + Playroom Kit). Rename `abductee-game.html` to this. |
| `scanner-level-editor.html` | **SCANNER** — a top-down level editor. Paint terrain zones, place cover and spawns, export a map as JSON. |
| `maps/*.json` | Six ready-made large themed levels + `levels.json` (the picker manifest). |
| `tools/generate-levels.mjs` | The level generator. Run it to (re)build the themed maps or add your own. |

## Quick start

Multiplayer can't run from a `file://` URL — serve the folder over http:

```bash
npx serve          # or: python3 -m http.server
```

Open the localhost URL. In the Playroom lobby, pick a name + color and launch. To get a second player, **open the same URL in another tab** or use Playroom's built-in **Add a Player**. With 2+ players a round starts automatically — one becomes the UFO, the rest are hiders.

For a real deployment, register a game at [Playroom](https://joinplayroom.com) to get a `gameId` and pass it to `insertCoin({ gameId: '...' })`. Running without one uses dev mode, which is fine for local testing.

## Controls

**Keyboard + mouse** — click the scene to capture the mouse (`Esc` releases).

- **Hider:** `WASD` move · mouse look · `E` toggle camouflage · `Q` / `[` `]` cycle pose
- **Seeker (UFO):** `WASD` fly · `Space` / `Shift` altitude · hold **mouse** to beam · `V` toggle overhead / third-person

**Controller** (plug in and press a button — no need to capture the mouse):

- Left stick move · right stick look · **RT** beam · **A** camo · **X** pose · **Y** view · **RB/LB** altitude

## How it works

- **Client** (Three.js, in `index.html`) renders the world and reads input. Movement is client-side for responsiveness.
- **Multiplayer** runs through Playroom Kit — rooms, lobby, matchmaking, and per-player state sync — so there's no server to run yourself for the prototype.
- **The host is authoritative for game logic.** One player's client runs role assignment, the round timer, scoring, and — critically — abduction validation (range + line-of-sight raycast + a sustained beam lock). Seekers can't fake a hit.
- **Camouflage** samples the terrain under a hider; standing still ramps blend up (color-match + fade), moving breaks it. It's synced so seekers see the blended look.

### The SCANNER map pipeline

Design a map in `scanner-level-editor.html`, export the JSON, then **drag it onto the game window (as the host)** — it syncs to every player and rebuilds the world. A sample map is baked in so the game runs standalone. The format:

```json
{
  "format": "scanner-map", "version": 1,
  "name": "greenwood",
  "grid": { "cols": 72, "rows": 54 },
  "terrain": [["grass","water", ...], ...],   // row-major, maps 1:1 to the UFO's overhead view
  "objects": [{ "x": 12, "y": 7, "type": "tree" }],
  "spawns":  [{ "x": 3, "y": 4, "role": "seeker" }, { "x": 20, "y": 15, "role": "hider" }]
}
```

**Terrain surfaces** (each is a camouflage color): `void grass dirt water rock concrete foliage metal sand snow ice mud moss lava ash crystal`.
**Cover types:** `tree boulder crate barrel wall cactus dead_tree ice_spike alien_pod` — all block line-of-sight; `wall` also blocks movement. `water` and `lava` are cosmetic terrain (no collision yet).

## Levels

Six large, open, themed maps ship in `maps/`, each tuned so hiders have terrain worth blending into:

| Level | Setting | Blend into |
| --- | --- | --- |
| `greenwood` | Dense forest | grass / foliage |
| `dunes` | Desert flats | sand / dirt / rock |
| `tundra` | Frozen north | snow / ice — the white figures nearly vanish |
| `downtown` | City blocks (walls) | concrete / metal |
| `xeno` | Alien world | moss / crystal, with lava hazards |
| `bog` | Sunken swamp | mud / foliage, lots of water |

The **host picks the level** from the top-of-screen picker between rounds (it reads `maps/levels.json`); everyone loads it. Drag-drop still works for one-off custom maps.

**Make more levels:** edit the `THEMES` array in `tools/generate-levels.mjs` and run `node tools/generate-levels.mjs` — it regenerates every map plus the manifest. Or hand-build one in SCANNER and drop it in `maps/`.

## Tuning

All gameplay constants live at the top of the `<script>` in `index.html`: round length, beam radius, lock time, camouflage speed, movement speeds, seeker-to-player ratio, points. Poses are defined in the `POSES` table — add one and it appears in the picker automatically.


## Swapping in real assets (all free, all license-clean)

The white figures and poses are built in code so the game stays self-contained. To upgrade:

- **Characters:** drop in a CC0 low-poly humanoid from [Kenney](https://kenney.nl) or [Quaternius](https://quaternius.com) (public domain, commercial use, no attribution) and load it with Three.js's `GLTFLoader`.
- **Poses / animations:** [Mixamo](https://mixamo.com) (free, royalty-free for commercial games) — each unlockable pose can be a Mixamo clip. You bake them into the game; you can't resell the raw files.
- **Map props:** kitbash from CC0 environment kits (Kenney Nature/City, Quaternius) instead of modeling.

**License check before shipping:** CC0 = use freely, no credit. CC-BY = credit required. Avoid CC-BY-NC (no commercial use) and CC-BY-SA / GPL (can force share-alike / open-source). Code deps here — Three.js and Playroom — are permissively licensed.

## Status & roadmap

**Working now:** shared 3D world, real-time movement, white posable characters + unlockable poses, camouflage, host-validated abduction beam, full round loop with role rotation + scoring + spectator, SCANNER map loading, keyboard/mouse + controller.

**Next:**
1. **Server authority** — graduate the netcode to [Colyseus](https://colyseus.io) so movement is validated too (anti-cheat). Only the abduction is host-authoritative today; movement is still client-reported.
2. **Accounts + cosmetics** — a separate auth + database layer (Supabase / Firebase) to own pose/skin unlocks and drive revenue.
3. **Polish** — audio, a custom lobby, and swapped-in CC0 art.

## Credits

- [three.js](https://threejs.org) — MIT
- [Playroom Kit](https://joinplayroom.com) — multiplayer layer
