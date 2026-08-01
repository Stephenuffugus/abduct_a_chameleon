# PLAN — the wait becomes playable, and the Files become earned

Written 2026-08-01 after Stephen played the build. Two notes, ten seconds in:

> *"we need options for people to play while they wait for the hiders."*
> *"i like the story notes but they need to be earned. starting with all 1000 is just dumb and id
> never want to read them but if i found them each game id read them if displayed as they came."*

Both are right, and the second one is a diagnosis of a real mistake: I shipped a **library**. A NEXT
button that walks 880 pages is a menu, and nobody reads a menu. The pages are only worth anything
if arriving at one is an **event**.

---

## The one idea that solves both notes

**The wait is where you EARN the pages.**

The hunter's 120 seconds stop being dead time *and* stop being a reading room you can binge. They
become a calibration screen: you are shown a still frame with a painted body hidden in it, and you
tap where you think it is. Get it right and a case file page is **recovered and shown to you right
then** — the page is the reward, delivered at the moment it means something.

That is one build that answers both notes, trains the exact skill the next 150 seconds demand, and
is the same render-a-frame technology his SURVEY PHOTOGRAPH idea needs later.

---

## PART A — the Files become earned

### The rule
`filesRead` currently means "seen". It becomes `filesFound` and means **owned**. The reader shows
**only what you own**, in the order you found them. With none, it says so and tells you how to get
one. `NEXT PAGE` becomes navigation of *your* archive, not of the bank.

### How a page is recovered
| Source | Pages | Why |
|---|---|---|
| **Calibration hit** during the wait | 1 per correct spot, **cap 3 per wait** | the main tap, capped so it is not farmable |
| **Field recovery** — a wreck/canister object in the world you walk over | 1, **2–3 spawn per map** | gives a reason to explore, which also serves map variety |
| Survive a round as hider | 1 | the round itself should pay |
| Abduct a hider as seeker | 1 | both roles pay |
| Clear the practice range (6 of 6) | 1 | solo has a path too |

Ballpark: an active session yields roughly **5–12 pages**. 880 pages is then a genuinely long tail
— which is correct, because a collection you can finish in a week is not a collection.

### The moment of recovery
A page arriving is a **card that slides in and holds**: `PAGE 412 RECOVERED`, the thread tag, the
heading, the body, and `47 of 1000`. It is the same card the reader uses, so there is one design.
Dismiss it or let it sit. This is his *"displayed as they came."*

### What changes in code
- `FILES_KEY` `aac3d_files_read` → `aac3d_files_found`, storing `[{n, t}]` (page + when) so the
  archive can be ordered by discovery. **Migrate the old key silently** rather than wipe it.
- `filesPick()` inverts: no longer "prefer unread from the whole bank", instead
  `recoverPage()` picks an unfound page at random and adds it.
- `filesNext()/filesPrev()` walk `filesFound` only.
- Reader empty state: *"No pages recovered yet. Calibrate your scanners, or find a wreck."*
- ⚠ Keep the read-modify-write merge and the storage listener. Two tabs clobbering a collection is
  the same bug that once destroyed 4,000 stars, and a collection is worse to lose than a counter.

---

## PART B — the wait becomes playable

Three options, tabbed, on the same screen. **CALIBRATION is the build; the other two are the tabs
around it.**

### 1. CALIBRATION — spot the hider (the main event)
A still frame with one painted body in it. Tap where they are.

- **Generation:** reuse `makePracticeBody()` — it already paints a body to its surroundings at a
  chosen accuracy. Place one in the live world at a random spot, point a **separate camera** at it,
  `renderer.render()` to a render target, read it back to a canvas, then **remove the body and
  restore the camera**. One extra render per puzzle, off the main view.
- **Difficulty ramps within the wait:** puzzle 1 uses accuracy 0.24 (sloppy, findable in a second),
  puzzle 3 uses 0.04 (near perfect). Same spread the practice range already proves works.
- **Scoring:** tap within a radius of the body = hit. Hit pays a page (cap 3). Miss costs nothing
  but time — no punishment on a screen you are stuck on anyway.
- ⛔ **It must leak nothing.** The frame is rendered from a camera pointed at a body WE placed, not
  at a real hider, and it is a still, not a feed. Never render the live scene from a free camera
  during the hide phase.

### 2. CASE FILE — read what you have recovered
The current reader, restricted to `filesFound`, ordered by discovery.

### 3. PAINT DRILL — stretch, only if 1 and 2 land well
A swatch appears; match it with the wheel inside N seconds; scored. Trains the other half of the
game. Cheap because the studio's colour maths already exists. **Not in the first build.**

### Where else this screen appears
The same panel serves the **7s intermission** and a **caught hider spectating**. Both are dead time
today. One build, three placements.

---

## Build order (tomorrow)

1. **Files → earned** (Part A). Small, self-contained, no rendering work. Ship it first so the rest
   has something to pay out.
2. **The recovery card.** The arrival moment. Also small.
3. **Field recovery pickups** in the world — a wreck model from the 106 already downloaded, 2–3 per
   map, walk-over. Reuses the litter placement pass.
4. **CALIBRATION.** The render-to-texture puzzle. The real work, and the piece that proves the
   technique the survey photograph will need.
5. **Tabs** on the wait screen, then the same panel wired into intermission and spectate.
6. Gate it: extend `test/paint3d.mjs` family with `files3d.mjs` — pages are only readable once
   owned, recovery persists across a reload, the cap holds, and the calibration frame renders.

---

## Numbers I will pick unless you say otherwise
- Calibration cap: **3 pages per wait**
- Field wrecks: **3 per map**, one page each, respawn each round
- Calibration difficulty ramp: **0.24 → 0.12 → 0.04**
- Tap tolerance: **~7% of screen width**

## Decisions that are yours
1. **Should pages ever be re-readable from a "codex", or only in the order found?** (I lean: a
   codex of what you own, sorted by page number, because 880 unordered cards gets unusable.)
2. **Should the hider get anything during the 120s?** They are busy painting, so my instinct is no —
   but you have played it and I have not.
3. **Do wrecks show on the seeker's scanners?** Makes them contested rather than free.
4. **Is 3 pages per wait too generous or too mean?** Feel beats arithmetic here.

## What I am NOT doing
- Not touching `HIDE_SECONDS = 120`. That is your ruling and the wait is now worth having.
- Not adding new mechanics beyond this list until you have played it again.
