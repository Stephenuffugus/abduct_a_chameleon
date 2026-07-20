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

> **New in v0.2 "Photo Loop":** plant yourself, free-look at the hunters' altitude with pinch/scroll **zoom**,
> then tap 🎨 to **hold the shot** and paint inside your framed view — seamless lock → look → zoom → hold →
> paint → unlock. Plus 6 new expansion maps, XP levels, challenges, and new cosmetics.

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

### Controls — the Photo Loop (built for tablets)

Three modes, always shown by a **MODE pill** (top-left) that's also your one-tap road ALL the way back to Move.
The loop that makes the game: **plant → look → zoom → hold the shot → paint → unlock**. One law makes it
seamless: *hops between Look and Paint never move the camera; only returning to Move does.*

- **🕹 Move** — drag the **move side** as a floating analog stick: **push gently to *sneak*, far to *walk***.
  Drag the **other side** to **peek** the camera; it springs back, or tap **⌖ recenter**.
- **👁 Look** — tap **👁** (or just *pinch* / *scroll out*): you plant in place and the camera airlifts to the
  **hunters' altitude**. Drag to look around, **pinch / scroll / ＋－ buttons to zoom** (FAR · SEEKER · NORMAL ·
  CLOSE detents). A threat-aware **YOU** marker means you never lose yourself — and never get cheap-shotted.
- **🎨 Paint** — tap **🎨** from Look and the view is **HELD like a photo** (shutter click, corner brackets,
  📌 on the pill): the studio opens *over your framed shot* with a light dim so you watch your tiny faraway
  self repaint live. Tap empty space to hop back to Look — **framing pixel-identical**. Paint from Move works
  like always (camera pinned on your body).

| | Keyboard / Mouse | Touch |
|---|---|---|
| Move (analog speed) | `WASD` / arrows · hold `Shift` = sneak | drag move side (light = sneak) |
| Look around | drag on action side · **scroll-out = Look** | drag the other side · **pinch = Look** |
| **Zoom** (in Look / held Paint) | scroll wheel · `-` `=` detents | pinch · ＋／－ buttons |
| **📷 Snapshot** (keep your framed shot) | 📷 in the camera cluster | 📷 |
| **Paint** (holds the shot from Look) | `E` / `Tab` / 🎨 | 🎨 |
| **Look** mode | `I` / 👁 | 👁 |
| **Match** (sample ground) | `Q` | **MATCH** |
| Pose · Abilities | `[` `]` `R` · Space/Ctrl/C/V | 🕺 · ❄ ⚡ 👥 💨 (❄ works while Looking) |
| Back one step · all the way home | `Esc` · — | tap empty space · MODE pill |
| Gamepad | right stick pans · dpad zooms · B backs out one step | |

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

### Maps — 12 handcrafted-feel levels

Six original biome maps plus a **serious expansion set** (bigger, denser, each with a hiding identity):
**Riverline** (valley of three bridges), **Sunken Ruins** (flooded walled courtyards), **Cinderfield**
(seam causeways through lava), **Frostharbor** (docks, crate rows, ice floes — the big one), **Scrapline**
(junkyard alleys), **Twin Gardens** (a deliberate 2-tone mosaic playground). Expansion maps unlock along
the XP arc (Lv 2–7); large maps field an extra hunter so patrol pressure stays honest. The level
select groups everything into **named regions** (The Greenwood, The Burning Flats, The White North,
The Grey City, The Otherworld, The Sunken South), each round opens with its map's **title card** —
and each region **hunts differently** (stated right on the card: wide scanners in the dunes, patient
stalkers in the bog, aggressive alley hunters in the city…).

### Progression — XP · challenges · cosmetics

Every scored round pays **XP** (score-based + win bonus) toward levels; the summary shows your gain and
the bar to the next level. **Challenges** (Untouchable, Ghost Hunter, Quick Banker, Marathon Ghost,
Field Guide, Three-Day Ghost, Week of Shadows) grant skins or bonus XP — the wardrobe lists them all
with hints. Playing the **Daily** on consecutive days builds a 🔥 streak (shown on the mode card and
the summary). The wardrobe tracks Level, challenges, ten head accents, biome medals, **trail effects** (Bubbles Lv2 · Sparks Lv6 · Leaves via Marathon Ghost — trails go quiet as you settle, so they never break camo), and the Blend Book.

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

## 🌐 Play Online — 1v1 hider vs hunter

One of you **hides and paints**; the other **flies the ship and hunts with their eyes** — no scanner
online, human perception is the whole game. Title → **Play Online** → one player hosts (gets a
4-letter code), the other joins with it. The hider picks the map; the round is on.

**Hosting it:** the game itself is static (any web host). Multiplayer needs the tiny relay in
`server/`:

```bash
cd server && npm install && npm start     # serves the game AND the relay on :8080
```

One Node process = the whole stack (game + `/ws` relay). Deploy it on anything that runs Node
(Render / Railway / Fly free tiers work). If the game lives on a static host instead, deploy just
the relay and open the game with `?mp=wss://your-relay.example.com/ws`.

Under the hood: the hider's client runs the real, authoritative simulation (the hunter's ship is
driven by the remote player's inputs; detection/beam rules are identical to single-player), the
hunter's client plays Hunt mode against a live human streamed in snapshots with local prediction.
The relay is a dumb pipe — no accounts, no state, no game logic server-side. Verified headlessly:
`cd test && npm run online` boots the real relay + two full game instances and plays a round to the
catch.

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
maps/                       ← 12 themed levels + levels.json manifest (generated)
tools/generate-levels.mjs   ← regenerates the maps (crafted design() API for the expansion set)
tools/validate-maps.mjs     ← contract + playability validator (run after any map change)
docs/
  BUILD_SPEC.md             ← the master design/build spec this game was built from
  HANDOFF-3d.md, README-3d.md  ← the original 3D multiplayer prototype notes
abduct-3d.html              ← the earlier 3D multiplayer prototype (reference)
```

## Map format (`scanner-map` v1)

```json
{ "format":"scanner-map", "version":1, "name":"greenwood",
  "biome": "greenwood",                                  // optional: explicit mood (else inferred from name)
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
