# THE ABDUCTION FILES — canon sheet

**Status: SETTLED and building.** Every call below is made and the bank is being
written against it. Stephen can veto any name or dial later and the pages get
swept, but nothing waits on a sign off.
Written 30 July 2026 to answer one question: what does the hunter read during
the sixty seconds the chameleon spends hiding?

The answer is a dossier. One page per wait. A thousand pages eventually, read
completely out of order, that add up to the whole story of why anyone is
abducting a chameleon in the first place.

---

## The one idea

**The aliens are not conquerors. They are losing their colours, and they think
the chameleons know how to choose.**

Everything else follows from that. It makes the hunter sympathetic, it makes the
hider precious rather than prey, and it explains the game's central verb: you
paint yourself to match the ground, which to them is the holiest act there is.

## The five facts that must never contradict

1. **The species is the Vell.** Tall, pale, fixed in colour. They see far more
   colour bands than we do, and they are losing them one band at a time.
2. **Their world is going grey.** They call it the Colour Drought. It has run
   for four hundred years and nobody knows why.
3. **The ship is the Long Patience.** A research barge, not a warship. The beam
   is a specimen lift with a bad reputation.
4. **Changing your own colour is, to a Vell, a moral art.** No Vell has ever
   done it. A chameleon does it before breakfast without being asked.
5. **Subjects are catalogued and returned.** Mostly. The gap between mostly and
   always is where the story lives.

## The voice

Our narrator is **Junior Cataloguer Oon**, who is earnest, badly overworked, and
slowly working out that the mission is wrong. Oon is funny by accident, never on
purpose. Oon writes about a toad the way a tired person writes about a toad.

Rules for every page: forty to ninety words. Self contained, because the reader
gets them shuffled. Concrete images over ideas. Warm. No dashes anywhere in
player copy. No real brands, no real people. General audience.

## The four threads

| Tag | Thread | What it is |
|---|---|---|
| `FR` | FIELD REPORTS | Oon's own log. Procedure, mishaps, and the growing doubt. |
| `SF` | SUBJECT FILES | One page per creature taken. Designation, where, and one vivid thing it did aboard. |
| `HW` | THE HOMEWORLD | The Colour Drought, the Vell, and the reason for the mission. Revealed in fragments that never fully resolve. |
| `IW` | INTERCEPTED WHISPERS | Chameleon folklore about the lights in the sky. The other side of the glass. |

## Deliberately unresolved

Do not answer these anywhere in the thousand pages. They are the engine.

- What actually causes the Colour Drought.
- Whether the chameleons understand they are being studied. Oon suspects they
  do and are playing along, which is worse.
- What happens on the pages between "catalogued" and "returned".
- Who is still funding the Long Patience after four centuries.

## Calls made (veto any of them later and the bank gets swept)

1. **Names: the Vell, the Long Patience, Junior Cataloguer Oon.** Chosen for
   being short, sayable and unowned.
2. **Tone: funny on the surface, sad underneath.** Oon never jokes on purpose.
   The melancholy is in what Oon does not say. This suits googly eyes better
   than misery would.
3. **The returns are mostly returns.** Nothing on screen shows a creature harmed.
   The unease comes from the paperwork, never from cruelty.
4. **The bank grows in batches** and the validator gates every one. No page ever
   ships that breaks the length band, the dash rule or the uniqueness checks.

## Format

Pages live in `pages/files-N.js`, 250 per chunk, each assigning into
`window.AAC_FILES`. One page is `{n:412, t:'HW', h:'THE COLOUR DROUGHT', b:'...'}`.
`tools/validate_pages.mjs` enforces the length band, the banned characters, the
unique numbers and the unique openings.
