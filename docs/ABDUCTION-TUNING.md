# Why abduction never happened, and what changed

Stephen, 2026-08-02: *"it also takes a really long time to actually be abducted and I was
basically able to just run in a line back and forth and avoid getting abducted."*

He was right, and it was worse than he thought. This is the measurement, the cause, and the
fix. Gate: `test/runner.js`.

---

## 1. It was not a tuning problem. The constant was unsatisfiable.

A pursuing saucer skips `steer`'s arrival damping and turns at `TURN_RATE*2 = 6.4 rad/s`, so
its minimum turning circle is `BEAM_TRACK_SPD / 6.4`. To hold station over a moving target,
that circle has to fit inside the beam ring:

> **ceiling:** `BEAM_TRACK_SPD < 6.4 * BEAM_R`

And to stop the target simply walking out of the ring before any charge accrues:

> **floor:** `BEAM_TRACK_SPD > PLAYER_WALK * max(MOVE_MULT)` = `150 * 1.10` (ice) = **165**

At the shipped `BEAM_R = 26` the ceiling was **166.4**. A legal window **1.4 px/s wide**, and
none of the three shipped values sat in it:

| | BEAM_TRACK_SPD | verdict |
|---|---|---|
| EASY | 118 | under the floor: beam can never charge against a walker |
| NORMAL | 155 | under the floor |
| HARD | 180 | over the ceiling: 28.1px turning circle orbiting a 26px ring |

That is why every previous attempt to fix this by turning the speed dial up failed, and why
raising HARD's speed made it *worse*. Hunt mode had already hit the same wall and quietly
widened its own ring to `HUNT_BEAM_R = 34`; the hider-side ring never got the same treatment.

## 2. The saucer was jousting, not tracking

Traced live under an active beam on NORMAL, the gap between ship and player went:

```
27 -> 60 -> 69 -> 34 -> 12 -> 100 -> 42 -> 53 -> 11 -> 62 px
```

The ring was sweeping over the player like a searchlight instead of sitting on them. Cause:
in pursuit the ship flies flat out at a point it is already almost on top of, shoots straight
through, and because velocity is locked to `u.heading` it then has to fly a half-circle to
come back, losing about 85px each time. Charge only accrues inside the ring, so it kept
resetting.

The old code had a comment explaining why arrival damping was removed (it made a chaser
*slower* than a walking player inside 48px). Both things were true; the answer is neither.

## 3. What changed

| | before | after |
|---|---|---|
| `BEAM_R` / `BEAM_BREAK_R` | 26 / 64 | **34 / 72** |
| EASY `CHASE_SPD` / `BEAM_TRACK_SPD` | 155 / 118 | **190 / 166** |
| NORMAL | 192 / 155 | **220 / 174** |
| HARD | 228 / 180 | **250 / 182** |
| pursuit steering | flat out, jousts through | **station-keeping** |
| chase aim | pure pursuit (tail chase) | **closed-form intercept**, faded to zero near the ring |
| other ships | resume patrol | **cutoff**: intercept on the player's velocity |
| dash | free +31 px/s sustained | **0.5s recovery at 0.55x** |
| `LOCK_TIME` | 2.4 / 1.7 / 1.1 | unchanged |

**Station-keeping** is the important one: with the target's velocity known, the ship's speed
becomes `min(maxSpd, targetSpeed + dist/0.15)`. It matches velocity and parks, it can never
be slower than its target (the target's own speed is the floor, which is exactly the bug the
old comment described), and it cannot overshoot.

**Intercept, not a fixed lead.** Aiming a constant L seconds ahead is the obvious idea and it
is wrong: at L=1.5 the ship aims 225px past a walking player and never enters the ring at
all. The closed-form solution of `|P_rel + V_t*t| = V_s*t` is exact for a straight-line
runner and self-limits as the ship closes. It is faded to zero inside `2*BEAM_R` or the ship
leads itself in front of the player and has to turn around.

**The cutoff** is the answer to "back and forth" specifically. One saucer on your tail is a
race you win by being faster in a straight line. A fleet does not have to follow you: any
ship that is not the chaser flies a hard intercept on your current velocity. Running a
readable line now runs you into somebody. It converts *how fast are you* into *how readable
are you*, which is the skill the game is actually about.

## 4. Measured, in-game, by test/runner.js

Seconds from the ship committing to a chase until abduction. Clean room: the runner is in
verified open ground with no cover within 150px, the ship is pinned one scan radius directly
behind, and after that the ship gets no help at all. (Round seeds come from the wall clock,
so the first version of this gate swung between 5.7s and never on identical code. Control the
variables you are not measuring.)

| | straight, before | straight, after | back-and-forth, before | back-and-forth, after |
|---|---|---|---|---|
| EASY | **never** (20s cap) | 6.5 - 10.3 | **never** (26s cap) | 9.9 - 17.9 |
| NORMAL | never in 16s | 4.5 - 4.9 | never in 20s | 5.9 - 7.5 |
| HARD | 13.6 | 3.1 - 3.7 | 5.7 | 3.6 - 5.2 |

## 5. What deliberately did NOT change

Nothing in the detection path. `SCAN_R`, `SUSPECT_GAIN`, `SUSPECT_DECAY`, `NOISE_FLOOR` and
the whole `player.C` chain are untouched, so a well painted, settled hider is trip-wire
identical to before. `runner.js` asserts this directly as a counter-gate: a matched, settled
player in cover with a saucer parked 40px overhead is never caught and **never even
escalates to a chase** (`maxSusp = 0.00`). Without that assertion, every number above could
have been satisfied by simply making the hunters brutal, which would delete the game instead
of fixing it. The escape stays where the game wants it: cover, paint and stillness, plus ink,
tongue, burrow and the `C < BEAM_HOLD_C` re-hide. Not footspeed.

**1v1 is explicitly excluded.** The human hunter's ship has no turn-rate limit at all (its
velocity comes straight off the peer's intent), so it never had the bug, and widening its
catch circle by 71% of area while speeding it up would wreck the one mode Stephen already
calls random. It is pinned to `NET_BEAM_R`, `NET_TRACTOR_R` and `NET_CHASE_BASE`, all frozen
at the pre-retune values. Versus mode gets tuned on its own evidence.
