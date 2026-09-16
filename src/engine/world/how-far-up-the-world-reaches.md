# How far up the world reaches, over a long time

How many people stand near the top of the ladder, how that number is meant to
move over the ages, and which two levers control it. This is about this world
rather than about working in this repo, so it lives here.

Read alongside:

- `a-house-and-who-is-in-it.md` - who a house holds, and why a thin roll still
  has to produce an elder now and then
- `README.md` in this folder - the passes that move people up and take them out

## What healthy looks like

> **A few people very far up, rare enough that getting there is a story, and
> that number swinging over the ages instead of trending one way.**

Both ways of getting this wrong make a boring world, and the design owner named
both:

- **Collapse.** Every run ends with nobody above 29.
- **Inflation.** A run ends with a thousand people at 44.

The number does not have to hold still. Cultivators have golden ages and dark
ages, and a dark age where every house declines together is correct. The test
of a slump is whether it **has a cause** and whether it **turns**. Perfect
equilibrium is not the goal either. It only has to hold long enough that a
player never notices it drifting, so a world that blows up at 100k years is
fine.

### Measuring it

- **Count people above thresholds** (29, 35, 41), not just the tallest person
  alive. The tallest person can look fine while the population under them has
  evaporated or piled up.
- **Measure any fix in both directions** over a horizon long enough to see it
  overshoot. The obvious cure for a drain pushes toward inflation, and a change
  that stops the top thinning can quietly crowd the peak after a few thousand
  years.

## How an upper art spreads

There are three ways an art reaches a new person. One limits itself and the
other two are the levers.

| way | what bounds it | where it is stated |
|---|---|---|
| **found** in a ruin | the book runs out: one reader for immortal or chaos, three for heaven, unlimited below | `USES_A_MANUAL_OF_THIS_GRADE_HOLDS` in `what-a-manual-has-left-in-it.ts` |
| **taught**, master to disciple | how long the lesson takes | `yearsToWriteOutACopy` in `manuals.ts` |
| **copied out** by a master, for a disciple, the house shelf, or sale | how long writing it out takes | `yearsToWriteOutACopy` in `manuals.ts` |

**A ruin is not a runaway lever.** A find makes at most one person at the top,
and that is the healthy shape: someone who got there as a story.

**Teaching and copying are the levers.** Neither spends a use, because the
master carries the art, so nothing but time stops one master handing an upper
road to a whole house. The design owner's rulings:

- teaching is **not a fast thing at all**
- copying a later art **takes a decent chunk** of the master's life
- **both get harder the higher the art goes**

Both read the one span, `yearsToWriteOutACopy`: two months for a primer, nine
years for the deepest road. To tune how fast upper arts spread, change that
curve and nothing else. It is not `monthsToCopy`, which prices a copyist's flat
labour on paper, and `manuals.ts` says why the two must not be merged.

## Where the code does not match this yet

Recorded 2026-09-16. Delete a line when it is fixed.

- **The background teaching path has no span.** `applyBookAcquisition` hands
  out `newlyEntitled` (`manuals.ts`), which gives a house member a shelf art
  the moment anyone alive in the house holds it at the rung it needs. The
  teacher need not have finished the art, and one teacher can teach any number
  of people in a year. The player's lesson already takes the span.
- **An NPC reading a found book spends no use.** The reader in
  `what-a-ruin-has-on-its-shelves.ts` adds the art without touching the use
  counter, so the one-reader rule holds for the player and not for the world.
- **A player cannot write out a copy to give away.** The world's masters write
  copies for their house's shelf, and the player can sell a copy, but there is
  no verb for writing one out for a disciple.
