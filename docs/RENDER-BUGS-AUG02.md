# The world, actually looked at — 2026-08-02

Stephen, after the family playtest:

> *"i can see through the floor, the water seems to turn into a bright light and theres just an
> empty void around the levle. all the items are strewn around all disjunct. buildings look the
> same and everything looks random and sloppy."*

Twelve automated gates were green while all of that was true. **Not one of them opens its eyes.**
`test/worldshots.mjs` now shoots the angles a player reaches — including the ones nobody would
choose — and the images are the deliverable. Run it and *look*:

```
cd test && node worldshots.mjs ../abduct-3d.html /tmp/aac-shots
```

---

## ⭐ ONE ROOT CAUSE EXPLAINS THREE OF HIS FOUR REPORTS

**The sky dome's brightest band is BELOW the horizon, and there is no ground out there to cover it.**

`MOODS[].sky` is a five-stop gradient painted top-to-bottom onto the dome
(`abduct-3d.html`, `applyMood`). Every mood ends on a *bright warm* stop:

| mood | top stop | **bottom stop** |
|---|---|---|
| deepnight | `#0B0F2B` | **`#C46A4E`** |
| emberdusk | `#160A14` | **`#E8894A`** |
| bloodmoon | `#12060C` | **`#D2543F`** |
| moonrise  | `#05070F` | `#8FA6C8` |

That gradient is correct for a sky — real skies brighten toward the horizon. It assumes the
**ground takes over at the horizon line**. It does not. The map is a finite `mapCols × mapRows`
terrain grid and past its edge there is *nothing*, so you see the dome's lower half: a big
bright orange wash.

Look at `10-water.png` and `08-edge-of-map.png` — the bottom third of both frames is a solid
orange field with a hard edge against the terrain. That is not fog and it is not water.

So:
- **"empty void around the level"** → the dome below the horizon. ✅ exactly what he saw
- **"the water seems to turn into a bright light"** → the bright dome band meets the blue water
  plane at the map edge. The water is not glowing; the thing *behind* it is. ✅
- **"i can see through the floor"** → every gap in the terrain grid shows the same dome. ✅

**The fix is not to darken the sky.** It is to give the world a ground that reaches the horizon:
a large disc or plane at `y ≈ -0.05` in a muted terrain/fog colour, extending past `fog.far`,
with the horizon rings sitting on it. Then the dome's bright band is doing its actual job
(lighting the horizon) instead of being the horizon.

---

## ⛔ CONFIRMED SEPARATELY: THE FLOOR HAS NO UNDERSIDE

`11-under-floor.png` — camera at `y = -3.2` looking up. You see **sky through the ground**, and
the terrain tiles that are visible read as floating slabs. The ground is a grid of tiles with
no skirt and no sealed underside, so anywhere the camera dips below `y=0` — a slope, a jump, a
falling body, the saucer descending to the new 4.5m floor near a dip — the world has no bottom.

A ground skirt fixes this and the void above in one change.

---

## ⛔ COLOUR / MATERIAL BUGS THAT MAKE IT READ AS "SLOPPY"

From `09-horizon.png` and `01-player-eye.png`:

1. **A building renders as a single flat untextured grey slab** filling a third of the frame
   (`01-player-eye.png`). No windows, no edges, no material variation — it reads as a hole in
   the world, not a building.
2. **A wall renders pure black** from a grazing angle (`09-horizon.png`, left third). No light
   reaches it at all; at night that is an unlit void with a hard edge.
3. **A tree canopy renders bright coral/salmon** (`09-horizon.png`, upper left) — it reads as
   fire, not foliage. There is a second one lower in the same frame.
4. **A ground decal renders bright magenta** (`09-horizon.png`, bottom centre).

⚠ 3 and 4 need checking against the palette before assuming they are bugs — they may be
intentional variety that simply reads wrong at night. But coral is not in `TERRAIN` and no
foliage entry is near it, so a wrong index or a wrong colour space is likely.

---

## 🎨 "BUILDINGS LOOK THE SAME" AND "ITEMS STREWN AROUND DISJUNCT"

This is the composition complaint and it is **not a bug** — the generator scatters, it does not
compose. In `10-water.png` the back row is the same dark-red brick building repeated with the
same silhouette, and crates, barrels and bushes sit at unrelated positions with nothing tying
them to each other or to the ground.

A quality bar to build against (needs Stephen's sign-off on the specifics):
- no two buildings sharing a silhouette within one frame
- props exist in **motivated groups** — a bench faces a path, bins cluster at a corner, crates
  stack against a wall — never as isolated single objects on open ground
- every terrain meets another through a transition band, never a hard polygon edge
- nothing is visible from under the floor
- the horizon is never empty

The litter pass on 2026-08-02 already learned half of this: *"one can in a field is not detail,
it is debris"* — litter was moved to piles only. **The same rule was never applied to props,
crates, barrels or buildings.**

---

## Order to fix (his call, 2026-08-02: render bugs first)

1. **Ground skirt to the horizon** — kills the void, the bright-light water and the see-through
   floor together. One change, three reports.
2. **Seal the terrain underside.**
3. **The four colour/material bugs above** — check each against the palette first.
4. **Composition** — needs the quality bar agreed before any code.
