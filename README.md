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
- **⛯ Time Attack · Beacon Run** — bank 5 scattered beacons before the clock runs out; each is a mini hide-and-hold.

### Abilities (Survive / Heat)
| | Key | What it does |
|---|---|---|
| ❄ **Freeze** | hold `Space` | Root in place, settle instantly, push concealment near-perfect |
| ⚡ **Dash** | `Ctrl` | Burst reposition — but you flare up briefly |
| 👥 **Decoy** | `C` | Drop a painted twin that steals a UFO's attention |
| 💨 **Ink** | `V` | A cloud that blocks a hunter's line of sight |

### Controls — a comfortable, mode-based scheme (built for tablets)

Three modes, always shown by a **MODE pill** (top-left) that's also your one-tap way back to Move:

- **🕹 Move** — drag the **move side** as a floating analog stick: **push gently to *sneak*, far to *walk*** (the
  knob shows SNEAK/WALK). Drag the **other side** to **pan the camera** and peek toward the ships; it springs back,
  or tap **⌖ recenter**.
- **🎨 Paint** — tap **🎨**: you strike a pose, stop, and paint yourself in the Studio (live coach, one-tap
  **MATCH**, 2-tone). Tap the pill, 👁, or empty space to leave.
- **👁 Inspect** — tap **👁**: the camera pulls back to the **hunters' top-down view** so you can see whether you
  actually blend, then nudge your position. Tap 👁 / Esc when done.

| | Keyboard / Mouse | Touch |
|---|---|---|
| Move (analog speed) | `WASD` / arrows · hold `Shift` = sneak | drag move side (light = sneak) |
| Look around | drag mouse on action side | drag the other side |
| **Paint** mode | `E` / `Tab` / 🎨 | 🎨 |
| **Inspect** mode | `I` / 👁 | 👁 |
| **Match** (sample ground) | `Q` | **MATCH** |
| Pose · Abilities | `[` `]` `R` · Space/Ctrl/C/V | 🕺 · ❄ ⚡ 👥 💨 |
| Back out one mode · Pause | `Esc` | MODE pill · ⏸ |

**Performance** is tunable in Settings (Auto / Smooth / Full) and auto-scales if a device struggles, so it stays
smooth on modest tablets.

**The skill:** your painted color is compared to the terrain under you (real perceptual color metric),
tone by tone. A close match + stillness + hugging cover makes you nearly invisible; moving always gives
you away. **Match** samples the exact ground color, but your body *crawls* to it — timing matters. Every
"spotted" tells you *why*, so getting caught feels fair.

**Living Camo:** the Paint Studio *coaches* you — it shows your **NOW** vs **AIM** match and names the one
nudge that closes the gap (*warmer, lighter, more vivid…*), then chimes when you vanish. Standing on a
**terrain seam** (grass meeting dirt), a single flat color can't match both halves — flip on **2-tone camo**
and paint each half its own terrain color to disappear where one color can't. The instant you melt in you
feel a soft **blend-snap**; hold a perfect blend on new ground to fill your **Blend Book** and earn **biome
mastery medals**.

### Comfort & unlocks
- **Settings** (title or pause): master/SFX volume, **motion** (full/reduced/minimal), **screen shake**,
  **photosensitive-safe**, **colorblind** palettes + meter glyphs, **high contrast**, **text size**,
  **haptics**, **left/right-handed** touch layout.
- **Wardrobe**: unlock cosmetic head accents (antenna, shades, crown, halo), **biome mastery medals**, and
  extra **poses** by playing — all cosmetic, none break your camo (they fade as you hide). The **Blend Book**
  logs every terrain you've truly vanished on; blend all of a biome's terrains to earn its medal.
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
