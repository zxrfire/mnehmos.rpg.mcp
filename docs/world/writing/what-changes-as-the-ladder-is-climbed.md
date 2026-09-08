<!-- tier: 3 -->
<!-- no-catalog: this is a craft note about register, not about any catalog. The rungs it is organised by live in realms.ts, and the reads it names live in the web layer. -->

# What changes as the ladder is climbed

Calibration notes, taken by reading across the whole arc of published work in
this genre rather than by taste. No source is named here, for the same reason no
source is named anywhere in this repo: the design is an amalgamation and citing
one work misrepresents it.

The repo's existing voice rules are good and they are **calibrated to the bottom
of the ladder**. Read a chapter from the start of a long work and then one from
near its end and they do not obey the same rules. That is the finding, and it
matters because a run spends its early hours at Qi Condensation and its late
ones somewhere else entirely, against one unchanging narrator.

---

## The unit of narration changes

At the bottom it is **one person with one physical problem**: tracking an
animal, killing something to eat, getting to a place before dark. Weather and
ground are established first and the person is narrowed to afterwards.

Through the middle it becomes **a faction**: who is on whose roll, who is owed
what, which hall a matter has been sent up to.

High up it becomes **a polity or an age**: a race, an army, an era, a treasure
that covers a region. Individuals are referred to by class rather than by name,
and years of consequence are summarised in a clause.

And then it comes back. Late chapters still spend whole scenes on two people in
a room noticing that a third is behaving oddly. **Scale oscillates; it does not
escalate monotonically.** A narrator that gets grander every rung and never
returns to a quiet room has the shape wrong.

## How a person is read changes

| rung | what a stranger is read off |
|---|---|
| bottom | clothing and its condition, and what is lying next to them |
| middle | rank, house, and who defers to them |
| top | what class of being they are |

At the bottom nobody perceives a rank, so nobody states one: a man is read off a
worn robe, a limp, an empty sleeve, or the three corpses beside him, and the
reader draws the conclusion. This is what `whatTheyCanPlaceAbout` is for and the
engine already holds it.

**The game currently reads everybody the same way at every height** - a standing
comparison against the player - which is right for none of the three rows.

## Power comparison is a high-rung register, not a defect

`AGENTS.md` and the narrator prompt ban power-level exposition outright. That
ban is correct at the bottom, where nobody can perceive a rung and saying one
aloud is the engine leaking.

It is not what the genre does at height. Late chapters state plainly that a
particular art could shake a particular class of being, and rank one named
ability against another. At that point the vocabulary IS the world's own: people
who can perceive rungs talk about rungs.

**This wants a ruling rather than a quiet change**, because the ban also serves
the discovery gate: the engine withholds other people's ranks from a player who
cannot place them. The two rules are entangled and only one of them is about
register. See `docs/world/houses/discovery.md`.

## Exposition is permitted at height, and only there

The show-never-explain rule is a low-rung rule and a good one: nobody explains
the world to somebody who has just left their village, because in the world
there is no such job.

High up, that changes. Chapters late in a long work will spend paragraphs on
where a class of technique came from, which era made it, and what it costs the
people who use it. The reason it works there and not at the bottom is that the
character has become somebody who would be told - and the cost is always stated
with the history, never the power alone.

## The costs are graded, and the grading is the content

Whenever a strong thing is introduced late, its price is introduced in the same
breath, and the price scales with the strength. The stronger the art, the worse
what it does to the person using it.

This repo already has the machinery: grades, the toll, permanent wound rows, a
foundation that can be set wrong. The note here is about EMPHASIS. A late-rung
answer that states a capability without stating what it costs is missing the
half the genre thinks is interesting.

## Humour survives to the top

It is not a low-rung flavour that burns off. The same work that opens on a
village celebrating that the protagonist has finally left is still making jokes
at its own hero's expense a thousand chapters later, while he is fighting things
that could unmake a region.

`tone.md`'s humour section is tier 1 for this reason. It was tier 3 and never
reached the narrator, which is why the prose read as uniformly bleak.

## What this suggests, in order of confidence

1. **Certain.** The register is not one register. Anything that reads the same
   at Qi Condensation and at Tribulation Transcendence is wrong at one end.
2. **Certain.** A person read should change what it reads them off as the rung
   climbs. Clothing and circumstance low, rank and house middle, class of being
   high.
3. **Likely.** The power-exposition ban should become rung-aware rather than
   absolute, without loosening the discovery gate. Needs a ruling.
4. **Likely.** Scale should be allowed to come back down. A quiet room is a
   correct late-game scene.
5. **Worth testing.** Late-rung answers that name a capability should name its
   price in the same answer.
