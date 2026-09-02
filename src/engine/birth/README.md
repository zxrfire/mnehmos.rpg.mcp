# `src/engine/birth`

Where a run opens, and whose child it opens as.

Two files:

- `birth.ts` - `drawBirth(seed)`, which turns the origin axis into starting
  values. This is the one function most callers want.
- `spending-a-word-to-place-a-child.ts` - the favour that skips an admission
  bar, which is the other half of what a name is worth and is described in
  [`docs/world/origin.md`](../../../docs/world/origin.md). It answers two
  questions: which doors a family's word would open that the applicant's own
  ordinal does not, and what it costs to spend one on your own child.

## Why it exists

The origin axis was designed, tabulated and measured before it was ever wired
in:

- `src/engine/cultivation/origin.ts` - the frozen tier table and what a tier is
  worth. Pure, and it puts nobody anywhere.
- `docs/world/origin.md` - what privilege buys and what it must never buy.
- `src/engine/world/origin-odds.ts` - the harness that measures whether the
  design's central claim still holds. Its closing line was "nothing here feeds
  back into the simulation".

Nothing turned any of that into a starting position, so every run opened at the
same address, with the same purse, knowing the same two names.

This directory is the join, and it is deliberately the only one. It reads the
tier table and the content catalogs and returns ordinary values - a place, a
purse, a house, some knowledge rows. Everything downstream reads those values
without knowing an origin exists.

## The contract

1. **An origin buys inputs, never rank.** `Birth` has no realm ordinal, no
   cultivation progress, no sect id, no sect rank, no foundation and no
   insight, and no field may be added that could carry one. A Hollow Court
   Seat's child opens at ordinal zero, unattached, like everybody else. The
   shape is the enforcement, exactly as it is in `origin.ts`.
2. **The ground is a floor, never a band nobody else can reach.** The band is
   drawn from the world's own geology weights and then floored by the family's
   holding. Half the world is thin whoever your parents are, and a poor birth
   on good ground is the design rather than a leak - see the note on
   `WORLD_AMBIENT_WEIGHTS` in `origin-odds.ts`, which explains what pinning
   every unplaced life to thin ground would falsify.
3. **No branch on a tier key.** There is none in `birth.ts` and there must
   never be one. Being born into the strongest house in the world is the same
   weighted draw over the same catalog as being born on a hillside; the Hollow
   Court is reachable only because its `powerOrdinal` sits above the top tier's
   `placement.reach`, and if the catalog changed the answer would change with
   it.
4. **Every number comes from somewhere else.** Tier weights, stones, ground
   floor, placement reach and the house bands are all read from `ORIGIN_TIERS`;
   the geology weights come from `schema/cultivation.ts`; the places and houses
   come from `src/data/cultivation`. This module owns no balance constant.
5. **Knowledge is the only channel for "who you know".** A court's child can
   name houses a farm child cannot because they were seeded more rows, gated by
   `placement.reach` and nothing else. There is no special case in the
   knowledge gate and there must not be one.
6. **Deterministic in the run seed**, through `forStream`, in four named
   sub-streams that do not consume from one another - so adding a fifth later
   cannot perturb a seed that has already been played.

## The design constraint this must not break

From `docs/world/origin.md`:

> A privileged origin should be visible in the run's opening position and not
> visible in its outcome distribution, except at the very top where it is one
> required term among several.

`tests/engine/birth/birth.test.ts` pins the opening-position half directly and
re-measures the outcome half through `measureOriginOutcomes`. If a change here
makes a good birth reliably produce high-realm cultivators, that file is where
it should fail.

## The favour, and why it lives here

`placementsWithinReach` in `origin.ts` applies two hard conditions: the house is
within the family's reach, and the applicant already meets the house's own
admission ordinal. A child has an ordinal of zero until they have cultivated, so
at the age the top tier places its children the second condition throws away
every house with a bar above the floor - and what survives takes anybody. The
greatest name in the province buys a place its holder could have had by walking
up. `tests/engine/birth/spending-a-word-to-place-a-child.test.ts` pins that
directly, because it is the defect the favour exists to fix and the prose used
to describe it as though it were the feature.

`placementsAWordWouldOpen` is the counterpart and is deliberately **disjoint**
from `placementsWithinReach`: a house appears in exactly one of the two lists,
so the difference between them is what the word was worth.

Three rules bind this file the way the six above bind `birth.ts`:

7. **No bar is altered and no ordinal is conferred.** Every answer is derived
   from `favourStanceOf`, which is derived from `SECT_ADMISSION`, so there is no
   second copy of anybody's admission figure here. A word buys the gate; the
   receiving house's ladder is climbed from the bottom.
8. **The two doors stay apart.** `doorsOf` exists because exactly one house has
   a probation door as well as a membership bar, and collapsing them has been
   done twice. The membership bar has never moved; the probation door is the one
   people come through; and that house's own standing is above every origin's
   reach, so it is at once the most open door in the setting and the only one
   nobody can be let through. It is already open and needs no opening.
9. **Deltas out, nothing written.** `spendAWord` returns rows for the social
   ledgers - one obligation, one tie, one knowledge row held by one person - and
   commits none of them. There is deliberately no public-belief row: a word is
   spent between two people and the child is not told.

## Who calls the favour half

`spendAWord` had no caller outside this package for as long as it existed, which made it
documentation with a type signature. It has one now:
`src/engine/world/a-child-their-own-house-will-not-keep.ts` is the fostering decision layer,
and `applyDemography` in `the-world-changing-on-its-own.ts` runs it every year of every
world. NPCs place children on somebody's word, the destination comes off the fosterer's own
ties rather than any list, and every placement measured skipped an admission ordinal the
child did not meet - which is exactly what this module says a word is for.

Nothing in `spendAWord` changed to make that work. The world layer supplies the asker, the
person asked and the day; this package answers whether the house's bar moves and writes the
rows.

## What is not here yet

- **Age does not vary.** A run opens at 16 wherever it opens. `placement.atAge`
  says a great house places its children at seven, and nothing reads it - which
  also means `spendAWord`'s extreme and intended case, the newborn, is not
  reachable from `drawBirth` yet.
- **A player has no children.** `spendAWord` takes a `childId` and does not care
  where it came from. For NPCs the world layer already supplies kin ties through
  `engine/world/the-ties-an-ordinary-life-produces.ts` and now spends words with
  them; for the player character there is no equivalent, so the family case is
  implemented and not yet reachable from a run. That is the one thing this
  module is waiting on.
- **And a run cannot OPEN as a fostered child.** The world produces them - a
  person on a house's roll who did not meet its bar and does not know whose word
  put them there - and `drawBirth` deals no such hand, so the player cannot be
  one. See "Opening as a fostered child" in
  [`docs/world/origin.md`](../../../docs/world/origin.md), which is where that
  goes when it is built.
- **A birth house has no seat to be born at.** The catalog records a faction's
  territory in prose rather than as a place name, so the house a family belongs
  to does not currently decide where the run opens. Both are drawn, and they
  can disagree.
- **No relationship row is written.** The house is a knowledge row and nothing
  more; there is no "your father is an elder" edge anywhere.
