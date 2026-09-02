# `src/engine/birth`

Where a run opens, and whose child it opens as.

Two files:

- `birth.ts` - `drawBirth(seed)`, which turns the origin axis into starting
  values. This is the one function most callers want.
- `spending-a-word-to-place-a-child.ts` - the favour that skips an admission
  bar, which is the other half of what a name is worth and is described in
  [`docs/world/houses/origin.md`](../../../docs/world/houses/origin.md). It answers two
  questions: which doors a family's word would open that the applicant's own
  ordinal does not, and what it costs to spend one on your own child.

## Why it exists

The origin axis was designed, tabulated and measured before it was ever wired
in:

- `src/engine/cultivation/origin.ts` - the frozen tier table and what a tier is
  worth. Pure, and it puts nobody anywhere.
- `docs/world/houses/origin.md` - what privilege buys and what it must never buy.
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
   cultivation progress, no rank index, no foundation and no insight, and no
   field may be added that could carry one. A Hollow Court Seat's child opens
   at ordinal zero like everybody else. The shape is the enforcement, exactly
   as it is in `origin.ts`.

   **It does carry membership, and membership is not rank.** `raisedInside`
   says whose a person is; nothing on the object says what they have done. The
   two were run together here until the owner asked for a member from birth,
   and separating them is what made the request answerable without softening
   anything: a child of a Dao house's line is on its roll and on no rung, and
   `RaisedInside.stillToClear` carries the house's own floors, unmodified, so
   the claim is checkable rather than assertable. See "A member from birth"
   below.
2. **The ground is a floor, never a band nobody else can reach.** The band is
   drawn from the world's own geology weights and then floored by the family's
   holding. Half the world is thin whoever your parents are, and a poor birth
   on good ground is the design rather than a leak - see the note on
   `WORLD_AMBIENT_WEIGHTS` in `origin-odds.ts`, which explains what pinning
   every unplaced life to thin ground would falsify.
3. **No branch on a tier key, and none on a faction id.** There is none in
   `birth.ts` and there must never be one. Being born into the strongest house
   in the world is the same weighted draw over the same catalog as being born
   on a hillside. Which houses can carry a bloodline follows from
   `intakeRouteOf` - `'adoption'` is a roster that is a lineage - and which
   houses nobody can be born inside follows from `NO_PLACE_FOR_THEIR_OWN`. Both
   are facts about the catalog, and if the catalog changed the answers would
   change with it.
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

## A member from birth

Three of the eight tiers describe growing up inside a house and, until this
package was wired for it, none of them put anybody in one. Measured over 400
births before the change: 147 in a city, 112 in a market town, 77 in a village,
43 in a **sect town** and 21 in a hamlet, and **not one at any of the 34 sect
seats the world builds**. A sect town is a town beside a house. It is not the
house.

Two facts do the work, and keeping them apart is the whole of the design.

**Where the run opens** is `familyHouse.whereTheyLive`. A retainer household, a
Dao house's own blood, an apex member's child and a ward all live on the
house's ground and open there, at the name the world's own seeder gives it - a
test pins the two strings against each other, because a location the world has
never heard of reads exactly like a working game until somebody looks around. A
cultivating clan holds its own vein and its own hall, so it opens in a town like
everybody else.

**Whether the roll carries them** is `familyHouse.onTheRoll`, and it is
membership rather than rank:

| Route | Who | What was skipped |
|---|---|---|
| `by blood` | A Dao house's own child. Its roster **is** a lineage - `sects.ts`: "A house does not recruit; it has children" | Nothing. A lineage's door is adoption, and adoption is for outsiders |
| `by taking` | A ward the house took in | The admission bar, and somebody is carrying the obligation for it - that is `spendAWord` |
| `null` | An apex member's child, a retainer's child | Nothing. They stand at the same gate as somebody who walked up the mountain |

**Being on a roll is not being on a rung**, and the state already existed:
`Cultivator.sectId` with a null `sectRank` and no `sect_members` row, which
`entities.ts` has always printed as "at no rank in it". Nothing new is stored
anywhere. `RaisedInside.stillToClear` carries the house's floors from
`the-three-floors-a-house-admits-at.ts` untouched, and a test asserts it equals
what that file says rather than anything shorter.

Played, at The House of the Bound Word: *"On the roll of The House of the Bound
Word"*, and `promote` answers *"there is nothing to be promoted from ... the
first rung opens at Qi Condensation Layer 6, and they stand at Qi Condensation
Layer 1."* At the Azure Cloud Pavilion, born on its ground: *"Serves no house."*

**Raised in is not born of.** The two are identical for membership, standing,
the name somebody answers to and the ladder in front of them, and different for
the line. An adopted child carries the house's name and not its blood, the
world writes the lineage edge and never the surname, and nothing here adds a
`wasFostered` flag - `a-child-their-own-house-will-not-keep.ts` explains why a
boolean would throw the asymmetry away. What it produces instead is a fact
sitting in the records that the name says nothing about, and **standing is what
makes it worth retrieving**: nobody pulls a record on a nobody, and a record
unread for forty years becomes worth reading the moment the person it names is
somebody. It surfaces as hearsay, so it can be early, wrong, exaggerated or
denied, and it cuts both ways - a house may want to claim a famous son it gave
away, and he may not want claiming.

## OPEN: a house seat can stand on ground an origin may not buy

`MAX_ORIGIN_AMBIENT` is `normal`, and its argument is good: thin to dense is a
fourfold multiplier, larger than the gap between the best spirit root and the
worst, so an origin that handed out dense ground would be a bigger term than
talent.

A seat birth reaches past it, and this is measured rather than suspected. Of
the 34 seats the world builds, **15 stand on dense or better** - the Azure Cloud
Pavilion's ground reads density 89. `ambientFor` prefers the world location's
own density over anything a birth reports, so a run that opens at a seat opens
on the house's real vein, and a played apex-child run was told the air is
*"thick enough to notice on the first breath"*.

Both halves are defensible and they disagree. `dao_house_bloodline`'s own
description promises "a vein under the compound"; `MAX_ORIGIN_AMBIENT` says an
origin may not put anybody on one. Three things bound the exposure and none of
them settles it:

- **Anybody may walk to a seat.** `seedSectGround` sets `thresholds.entry` to
  zero, so the ground is not something the birth uniquely reaches - what the
  birth buys is being there on the first day instead of walking.
- **The deep ground inside a house is rank-gated separately.**
  `groundEntitlementFor` shares the chambers out by rank index, and a born
  member's is -1.
- **It is about four births in ten thousand**, which moves no distribution and
  is not an argument that it is correct.

Reported rather than resolved, per the rule for two places that disagree.

## The design constraint this must not break

From `docs/world/houses/origin.md`:

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
  [`docs/world/houses/origin.md`](../../../docs/world/houses/origin.md), which is where that
  goes when it is built.
- **No relationship row is written.** The house is a knowledge row and a
  membership, and there is still no "your father is an elder" edge anywhere -
  which is the next thing a born member wants and the thing that would make the
  reveal above reachable from a run rather than only from the register.
- **`regionOfPlace` does not resolve a seat.** It matches against
  `REGIONS[].places`, and a house's ground is built by the world seeder rather
  than listed there, so `seedStartingAwareness` contributes nothing at all for a
  birth inside a house. `seedKnowledge` writes the province row itself for that
  case; the border provinces a settlement-born child hears named are still
  missing for a seat-born one.
