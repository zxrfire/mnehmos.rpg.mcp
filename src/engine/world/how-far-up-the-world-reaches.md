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

**The finder decides.** Whoever carries a book out reads it, where it carries
them further than the merit turning it in would buy, or turns it in to their
house whole (`applyWhatThePartyCarriedOut`, `what-a-house-gives-merit-for.ts`).
A rogue reads or keeps.

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

<!-- tier: 2 trigger="a master gives or withholds attention, or somebody asks what guidance is worth and what it costs the teacher" -->

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

**A master's year is a desk or a lesson, not both.** A copy that outlasts the
year it was started in is the master's activity (`thingId` names the art,
`untilDay` is the day it lands), and a master at a desk is not free to teach.
The years a copy takes are drawn once at the desk with the odds the yearly
roll had. Before this, a master wrote and taught in the same year for free.
Measured 1,000 years on `shape-a` and `shape-b` against a frozen control:
people above 29, 35 and 41 within the noise at every century; library rows
written out equal on one seed and 9% fewer on the other; masters' closed
sets of attention roughly half. The attention a tie carried is stamped on
both ends (`lastAttentionOnDay`) and read as recent within
`ATTENTION_IS_RECENT_FOR_DAYS`.

## A lecture, open and closed

<!-- tier: 2 trigger="somebody gives or sits in a lecture, a master calls their own disciples in, or a house asks what teaching is worth" -->

A lecture is not a thing of its own. It is the attention above with a different
set in it - one `teaching` activity, the people in `withIds` - and everything
else is derived from that row rather than stored beside it. There are two
shapes and the set is the whole of the difference.

**Open: the house holds one, and whoever is inside hears it.** Routinely rather
than rarely, and not every year, because the most advanced person free in a
compound has their own cultivation to see to: the share is
`A_HOUSE_LECTURES_THIS_SHARE_OF_YEARS`. The speaker is the most advanced of the
house who is free that year, and it reaches whoever of the house is inside the
compound - any rank, and a guest. The lecture hall adds no rule of its own about
who may listen; who can reach the room is the access chain's answer, the same as
for every other room.

**Closed: the master calls their own to where they live.** The design owner:
*"closed lectures fall out because the master calls his disciples to his cave
abode or room."* So a closed lesson is not held in the hall. It is held on
ground of the master's own, or else in the room their rung is lodged in, and a
set is closed when every one of the world's people in it holds a master tie to
the teacher. Neither fact is stored: both are read back off the one row, so no
pass has to remember to write a room. The player holds no ties the world writes,
so somebody the player sits in on a lesson with is left out of the question of
whether the set is closed.

**What a listener gets, and what the speaker spends.** A listener is paid only
for attention given where they are standing, thinned by the size of the set
(`guidanceFor`, `guidanceMultiplier`). The speaker pays the same share of their
year whatever the size, so a hall of two hundred costs what one disciple costs -
which is why an open lecture is the cheap way for a house to raise everybody at
once, and why it is still worth a master's while to teach three people in a
room. And a master's year is a desk or a lesson, not both: see the section
above.

**What it is worth to the house.** Giving attention is service and the house
counts it as merit: the errand rate for the days given, times the house's OWN
people in the set, thinned by the same share the listener's side is thinned by.
So a lecture with strangers in the room is paid for the members in it and not
for the strangers, and a master teaching their own disciples is paid the same
way a player giving a talk is.

Where each half of this is applied:

- `who-is-given-attention-this-year.ts` - the yearly pass that writes both sets,
  and the bar for being free to give a lecture against the lower bar for being
  free for your own
- `an-npc-striking-at-the-next-wall.ts` - what the attention is worth to the
  person given it, and what it leaves of the teacher's own year
- `where-a-master-takes-their-own-disciples.ts` - whether a set is closed, and
  where a closed lesson is found
- `architecture.ts` - the lecture hall itself
- `what-a-house-counts-in-somebodys-favour.ts` - what the house credits for it

## Where the code does not match this yet

Recorded 2026-09-16. Delete a line when it is fixed.

- **A player cannot write out a copy to give away.** The world's masters write
  copies for their house's shelf, and the player can sell a copy, but there is
  no verb for writing one out for a disciple.
