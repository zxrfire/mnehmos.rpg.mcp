# `src/engine/birth`

Where a run opens, and whose child it opens as.

One file, `birth.ts`, and one function anybody outside this directory should
call: `drawBirth(seed)`. It turns the origin axis into starting values.

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

## What is not here yet

- **Age does not vary.** A run opens at 16 wherever it opens. `placement.atAge`
  says a great house places its children at seven, and nothing reads it.
- **A birth house has no seat to be born at.** The catalog records a faction's
  territory in prose rather than as a place name, so the house a family belongs
  to does not currently decide where the run opens. Both are drawn, and they
  can disagree.
- **No relationship row is written.** The house is a knowledge row and nothing
  more; there is no "your father is an elder" edge anywhere.
