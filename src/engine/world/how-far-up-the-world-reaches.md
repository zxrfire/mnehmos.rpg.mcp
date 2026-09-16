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

## Attention, in the world's own passes

Guidance is attention given to a set, and a master with disciples and a hall
lecture are one mechanic: a person whose activity is `teaching` with the set in
`withIds`. `who-is-given-attention-this-year.ts` writes it each year - masters
to the disciples standing with them (closed), and a lecture inside a house's
compound to whoever is there (open). `guidanceFor` pays a listener only for
attention given where they stand, thinned by the set's size
(`ATTENTION_THINS_AS`), and the teacher pays
`TEACHING_TAKES_THIS_MUCH_OF_A_TEACHERS_YEAR` whatever the size. An art crosses
a shelf's gap only through a teacher at this who has finished it, at one chance
in `yearsToWriteOutACopy` a year. A book of a grade that runs out is read off
its own row, and a house's reading of one is a fact in the ledger.

Measured with `scripts/probe-does-a-house-keep-its-shape.ts`, seed `shape-a`,
2,500 years, control against this: people above 29 went 31 to 42 and 31 to
41, above 35 went 14 to 21 and 14 to 25. Neither a drain nor a pile-up.

## Where the code does not match this yet

Recorded 2026-09-16. Delete a line when it is fixed.

- **A splinter mints its library from memory.** `librariesCarriedOutBy` makes
  a fresh book row for every art its founders hold, mastered or not, at full
  uses. For heaven and above that is a book the world did not have.
- **A player cannot write out a copy to give away.** The world's masters write
  copies for their house's shelf, and the player can sell a copy, but there is
  no verb for writing one out for a disciple.
