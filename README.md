# Abduct a Chameleon 🎨👽

A **top-down**, moonlit-noir hide-and-seek game. You're a little **person** (a plain white figure)
who **paints their body** to match the ground — a full color picker + a one-tap **color matcher** —
then **holds still** to melt into the terrain until only two eyes remain. Alien **UFOs** sweep the
map with scanning beams, hunting anything that doesn't blend in; get caught in a tractor beam and
you're abducted. Or flip it: **BE the alien** and hunt AI chameleons yourself.

Runs **offline in the browser** — no login, no build step, no app store. Multiplayer-ready
architecture underneath for a future live version.

> The characters are deliberately minimal white/black figures (the *hider* is a person; the
> *alien* is the same body with a bigger head). The earlier 3D prototype is kept as `abduct-3d.html`.

---

## Play it

Serve the folder over http (it fetches `maps/`):

```bash
python3 -m http.server 8000      # or: npx serve
```

Open **http://localhost:8000/** → **Play**. It also runs off `file://` (falls back to a baked level).

### Modes
- **Practice / Zen** — no fail, free-roam. Learn to paint & blend. (`H` toggles a debug readout.)
- **Survive** — 1–3 UFOs hunt you; outlast the timer (Easy / Normal / Hard — Hard UFOs coordinate).
- **Heat · Endless** — one UFO, difficulty escalates forever, more hunters join. Survive as long as you can.
- **Daily Challenge** — one seeded run per day; same map/seed for everyone.
- **🛸 Hunt** — *you fly the UFO.* Scan to reveal hidden chameleons, fly over them to abduct. Catch them all.
- *Time Attack — coming soon.*

### Abilities (Survive / Heat)
| | Key | What it does |
|---|---|---|
| ❄ **Freeze** | hold `Space` | Root in place, settle instantly, push concealment near-perfect |
| ⚡ **Dash** | `Ctrl` | Burst reposition — but you flare up briefly |
| 👥 **Decoy** | `C` | Drop a painted twin that steals a UFO's attention |
| 💨 **Ink** | `V` | A cloud that blocks a hunter's line of sight |

### Controls
| | Keyboard / Mouse | Touch |
|---|---|---|
| Move | `WASD` / arrows | drag the left half (virtual stick) |
| Creep (slow, sneaky) | hold `Shift` | hold the right half |
| Paint Studio | `E` / `Tab` / 🎨 | tap 🎨 |
| **Match** (sample ground) | `Q` | **MATCH** button |
| Pose (hold while hiding) | `[` `]` / `R` | 🕺 button |
| Abilities | Space / Ctrl / C / V | ❄ ⚡ 👥 💨 buttons |
| Hunt: scan pulse | `Space` | **SCAN** button |
| Pause · Mute | `Esc` · `M` | ⏸ · 🔊 |

**The skill:** your painted color is compared to the terrain under you (real perceptual color metric).
A close match + stillness + hugging cover makes you nearly invisible; moving always gives you away.
**Match** samples the exact ground color, but your body *crawls* to it — timing matters. Every
"spotted" tells you *why*, so getting caught feels fair.

### Comfort & unlocks
- **Settings** (title or pause): master/SFX volume, **motion** (full/reduced/minimal), **screen shake**,
  **photosensitive-safe**, **colorblind** palettes + meter glyphs, **high contrast**, **text size**,
  **haptics**, **left/right-handed** touch layout.
- **Wardrobe**: unlock cosmetic head accents (antenna, shades, crown, halo) and extra **poses** by
  playing — all cosmetic, none break your camo (they fade as you hide).
- Off-screen **threat arrows** point to nearby hunters; a first-run tutorial explains the basics.
- **Drag a SCANNER `.json` onto the window** to instantly play-test a custom map.

---

## Design a level — SCANNER

`scanner-level-editor.html` is a standalone top-down level editor. Paint terrain, drop cover and
spawns, and **Export** a `scanner-map` JSON. Regenerate the six shipped themed maps with:

```bash
node tools/generate-levels.mjs      # writes maps/*.json + maps/levels.json
```

The **terrain palette** (each is a color you can paint yourself to match) and **cover types** are
shared across the game, the editor, and the generator — keep them in sync if you add any.

---

## Repo layout

```
index.html                  ← the game (top-down, offline, single file)
scanner-level-editor.html   ← SCANNER — top-down level editor
maps/                       ← 6 themed levels + levels.json manifest (generated)
tools/generate-levels.mjs   ← regenerates the maps
docs/
  BUILD_SPEC.md             ← the master design/build spec this game was built from
  HANDOFF-3d.md, README-3d.md  ← the original 3D multiplayer prototype notes
abduct-3d.html              ← the earlier 3D multiplayer prototype (reference)
```

## Map format (`scanner-map` v1)

```json
{ "format":"scanner-map", "version":1, "name":"greenwood",
  "grid": { "cols":72, "rows":54 },
  "terrain": [["grass","water", "..."], "..."],       // row-major, one key per cell
  "objects": [{ "x":12, "y":7, "type":"tree" }],       // cover; blocks line-of-sight
  "spawns":  [{ "x":3, "y":4, "role":"seeker" },        // UFO start points
              { "x":20, "y":15, "role":"hider" }] }     // chameleon start points
```

**Terrain:** `void grass dirt water rock concrete foliage metal sand snow ice mud moss lava ash crystal`
**Cover:** `tree boulder crate barrel wall cactus dead_tree ice_spike alien_pod` (all block sight; `wall` also blocks movement)

---

## Roadmap

- **Now:** offline top-down single-player — paint-to-blend camouflage, color picker + matcher,
  bot UFO hunters, Practice + Survive, scoring & local bests. Runs fully offline.
- **Next:** wire up multiplayer (the sim already isolates a `SeekerController` seam and a seeded,
  deterministic fixed-timestep so a human/networked seeker can drop into the UFO role a bot fills
  today), plus accounts/cosmetics and real art.

Tunables & the full design live in `docs/BUILD_SPEC.md`.
