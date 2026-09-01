<!-- tier: 2 trigger="the player finds, researches, enters or leaves closed ground - a ruin, a sealed cave, an inheritance, an abandoned seat - or asks who built one and why" -->

# Closed ground

The category, the economy behind it, and the clock that drives both.

This document is the home of the **inheritance economy**. It used to live in
[`immortals.md`](immortals.md) under "What immortals leave behind", and it was filed there
for a reason that no longer holds: divesting before the end is something people do at
**every rank**, and an ascension is only the largest instance. Leaving it under immortals
made the ordinary case look like a footnote to the exceptional one, which is backwards.

What stays in `immortals.md` is what is genuinely specific to crossing the Lid - that
nothing goes through it except the cultivator, and that this is *why* an ascension divests
at all. The economy is here.

---

## Why the category is called closed ground

"Ruin" is a plain English word that was doing work for something which now spans an
abandoned sect mountain, an inheritance somebody about to ascend left addressed to a
claimant, and a dead man's one-room cave. **Two of those three are not ruined and nobody
would call them that.** An inheritance left by somebody preparing to cross is in perfect
order; a cave whose owner died in it is exactly as its owner left it.

What they have in common is a door, something behind it, and nobody currently coming out.
So the term names the closing rather than the damage.

The name was chosen to match the register this setting already writes in - the Ninefold
Ledger, the Measured Span, the Unlit Gate, the Deep Survey, the Girdle of Nine Stones -
none of which reaches for grandeur. It is deliberately **not** "sealed ground": `sealed` is
already a boolean on every location, `sealed_domain` is already a location kind, and
`sealed-ancestors.ts` is already a catalog of people behind doors. A fourth meaning of that
word would have been unreadable inside a month.

Two sub-terms, for the ends of the scale, and they are what people in the world say:

| Term | What it is |
|---|---|
| **a shut cave** | One room, one door, one person, a lifespan that ran out behind it. The smallest thing that qualifies and the commonest. |
| **an empty seat** | A house's mountain with nobody in it. Halls, wards, a road that used to go there, and more than one person's worth of history. |

Code: [`RuinCharacterSchema` and `WHY_CLOSED_GROUND`](../../src/data/cultivation/inheritance-trials.ts).

---

## A ruin is typically more epic than a cave

The correction that shaped this document. A dead cultivator's sealed cave is real and it is
**the bottom of a scale**, not the model for the category. The word should mostly conjure
something with scale to it: a mountain a house held for six centuries and then left.

Scale is mechanical, not decorative. It decides what is inside, how many parties it takes,
whether a house can simply claim it, and whether its existence is public
(`WHAT_SCALE_DECIDES`):

| Scale | Parties | A house can claim it | Publicly known |
|---|---|---|---|
| `one_room` | 1 | no | no |
| `a_building` | 1 | no | no |
| `a_compound` | 3 | yes | yes |
| `a_mountain` | 8 | yes | yes |

A one-room cave is looted by a wandering rogue in an afternoon. An empty seat is an
expedition, an argument between houses about who owns it, and a thing provinces remember
the year of.

---

## Where closed ground comes from

**A floor, not a taxonomy.** The origins below are a starting point and the list is
expected to grow; nothing in the engine assumes it is complete. These are not the same kind
of place, they should not read the same, and they are not entered for the same reasons.

### Abandoned by a house

**The archetype, and it stays first-class.** A house held a mountain for six centuries and
then stopped existing - lost a war, lost its vein, lost its line, or ran out of people -
and what is up there is what nobody had time or reason to carry out. There is no message,
no addressee, no trial calibrated for a worthy successor, and no intent to discover.

- **Nothing was chosen for you.** The contents are the residue of ordinary institutional
  life: a hall's worth of unremarkable manuals, the disciples' quarters, the storerooms,
  and among it, sometimes, whatever the evacuation could not carry. An inheritance is
  curated; this is a spill.
- **The danger is decay and occupancy, not a test.** Collapsed halls, wards still running
  with nobody maintaining them, and whatever has been living there since. It cannot be
  passed by being worthy, because nothing there is judging.
- **Its history is public.** Somebody remembers this sect. It is on old rolls, it had
  rivals, and the reason it fell is a fact people can be asked about. This is the only kind
  you can **research before you go**.
- **It is contested.** A mountain is real estate. Houses argue about who owns an abandoned
  seat in a way nobody argues about a dead man's cave.

The world produces these itself. When the simulation destroys a sect, the seat is left
standing with everything the fall implies.

### Left addressed - an inheritance

**Deliberate, and a completely different object.** Somebody arranged for what they had to
be found later, by the right person, and addressed it rather than merely leaving it lying
there. It can carry conditions on who may take it, a trial rather than a hazard, a message,
an intent.

> The danger in an abandoned hall is decay and whatever moved in. The danger in an
> inheritance is that the person who built it **meant to sort applicants**, and you may not
> be who they were sorting for.

An inheritance that is just a ruin with better contents has thrown away the only thing that
makes it interesting.

### A door nobody opened again

The small end. One person, one door, a lifespan that ran out behind it, everything they
owned still inside, and nobody told. The formation holds for a while after the person
behind it stops being alive.

### And more

`overrun_at_work` (a working site caught in the middle of an ordinary day),
`what_the_catastrophe_made` (nobody built it and nobody left it), `fought_over_and_left`
(two parties stopped each other and neither came back to collect). Expect additions.

---

## Divesting: the economy, generalised

**Nothing goes through the Lid except the cultivator.** They know this well in advance, and
they act on it - so the years before a crossing are spent divesting: selling, gifting,
burying, sealing and arranging artifacts they will not need, manuals they will not read
again, spirit stones that will buy nothing where they are going, and above all
**inheritances**, deliberately constructed, deliberately hidden, deliberately gated, left
for whoever proves worth them.

This is the author of the world's entire inheritance economy. It is why sealed caves have
trials in them, why the trials are **calibrated rather than merely lethal**, and why a
manual three grades above anything taught is sitting behind a door with a riddle on it.
Somebody put it there on purpose, on their way out, knowing they would never come back to
check.

### But it is not an apex behaviour

**Leaving something behind is an ordinary act that the apex does spectacularly.** Anybody
who can see the end coming - an ascension, a lifespan running out, a war they do not expect
to survive - arranges what they have for whoever comes after, at whatever scale they happen
to have. A Foundation-rung elder with three manuals and a cave does exactly what an
ascending cultivator does, three orders of magnitude down.

So the **distribution is the design, and it is not authored.** Every realm is a bucket and
the low buckets are enormous, therefore:

- The world is **thick** with modest, unremarkable, half-decayed arrangements left by people
  nobody has heard of - a sealed room with one good manual and a note, a cache under a
  marker, a trial that was calibrated for a disciple and is now trivial.
- It holds a **bare handful** of the great ones.

If the only inheritances were the epic kind, the category would be a lottery the player
mostly never touches. Because there are many small ones, it is a texture the player lives
in, and the great one is a rumour with a rate behind it.

### One rule from the bottom of the ladder to the top

What the person had decides **the contents, the danger, the quality of the formation, and
therefore how long it lasts before decay opens it.** No tiers are hand-authored. And it
makes the calibration automatic: a builder calibrates for a successor like themselves, so a
trial is hard at the rung it was aimed at and easy for anybody well above it.

### The player is inside this distribution, not outside it

They will find the small ones constantly and a great one rarely. And when the player is old,
or about to cross, **leaving one themselves should be something they can do** - the legacy
machinery already survives a death and gets dug up by the next run, so half of that loop
exists.

---

## It is not just refillable

Both halves of the model are true at once, and they are true of **different parts of the
stock**.

- **The deep past is finite and cannot be made again.** Whatever the vanished eras left is
  a fixed quantity, and every one opened is gone from it forever. Producing another
  requires having been an institution or a person of that era, and that era is over.
- **The refill happens at the near end.** People dying and ascending *now*, at their own
  scale - and what that produces is **modern**: smaller, shallower, and made by people the
  current ladder can account for.

A world where prospecting eventually turns up another peak-era inheritance has quietly made
the past infinite, and the past is the one thing that is not. Discovery keeps happening
*and* the great ancient things still run out.

---

## Formations weaken, and that is the clock

Code: [`how-far-gone-a-formation-is.ts`](../../src/engine/world/how-far-gone-a-formation-is.ts).

Two things decide how long a formation holds and no others: **who set it** and **how long
ago**. There is no faction branch and no site-specific constant - a patriarch's seal and a
bandit's are the same function of the same two numbers, and what is different about the
patriarch is the ordinal. The half-life rises steeply with the rung, because each realm is
roughly four times the last.

This single fact makes closed ground one system rather than three:

- **It is why the reserve arrives on a schedule.** The wards on a dead cultivator's cave
  hold, and then they do not. A cultivator at ordinal 12 becomes findable about forty years
  after they stop; one at ordinal 30 stays shut for roughly two thousand. That is why deep
  ground is the ground nobody has been able to *get into* rather than the ground nobody has
  found.
- **It is why an inheritance becomes a ruin.** An inheritance's trial *is* a live
  formation. As it weakens the sorting fails, and a trial built to admit only the worthy
  stops being able to refuse anybody. **A decayed inheritance is a ruin precisely because
  its formations no longer enforce the intent.**
- **It sets the difficulty curve honestly.** A recently sealed place is nearly impossible
  and holds everything; an ancient one is enterable by ordinary people and has been picked
  over by them. Dangerous-and-empty and intact-and-lethal are both real.

### Intent is a separate axis from age

Given enough time an inheritance and a ruin converge, and they converge **with a cause**.
But a place with no intent never had any to lose: an abandoned seat is `never_addressed` on
the day it empties and `never_addressed` five thousand years later. Decay moves `addressed`
to `lapsed` and touches nothing else.

The best discovery beat in the game falls out of this: **finding out that the ruin you are
looting was a message, and that you are not who it was for.** That is only available
because the two are one kind of place.

---

## A sealed door is not a ward

From outside, a live cultivator's sealed cave and a dead one's sealed cave are **the same
object**: a door somebody put a formation on and did not open again. A prospector cannot
tell which they are looking at, and the only way to find out is to open it.

So **sealing makes you look like treasure**, and closed-door seclusion is not free. One
person's ruin delve is another person's very bad afternoon.

The odds of getting into a sealed cave and the odds of getting into an old ruin are **the
same number**: `oddsOfGettingThroughTheDoor`. Anything that wants a second one is wrong.
`isSomebodyStillAliveInThere` answers the occupancy question and is **engine-only** - it
must never reach a prospector's view, because the whole point is that it cannot be known
from outside.

---

## A ruin is a specific unfinished story

The generative question is not "what tier of ruin is this". It is **what happened, who
died, who left, and what could they carry?** Answer those four and the contents, the
intactness, the sealed rooms and the survival of the records all fall out - and they fall
out differently each time, which is what stops these reading as one place with a reskin.

| How it ended | The place it leaves |
|---|---|
| **The leadership died in battle** | The vault is *intact* and the rest is stripped, because the people who could reach it are the reason there was a hurry. Nobody left alive knew how to open it or was authorised to. |
| **They evacuated** | What remains is what nobody could carry: heavy things, fixed things, buried things, and everything needing a rank that had already died to move. An evacuation is a filter, and the filter is portability crossed with who was still alive. |
| **It stopped receiving instructions** | A branch when the seat was destroyed elsewhere. Never the prize, so nearly whole - it simply ran down. Nothing dramatic happened here, and the records survive because nobody thought to destroy them. |
| **It dissolved** | Big, central, everybody knows where it is, and nothing is broken. People stopped coming. |

The sealed vault is the sharpest case: it is a **separate piece of closed ground inside a
picked-over mountain**, running down on its own schedule at the rung of the people who
sealed it. The day its formation finally fails is the day the only intact thing in the
mountain becomes reachable. That is a good century for somebody.

---

## The reserve, and why it does not run dry

Code: [`how-the-world-keeps-finding-more-ruins.ts`](../../src/engine/world/how-the-world-keeps-finding-more-ruins.ts).

The design owner's model, exactly:

> more ruins are discovered. they're a nonrenewable resource, but think of fossil fuels, we
> always find more oil.

**Nobody is making ruins.** The stock is finite in principle. What is not finite in
practice is what has been *found*, because the world has never looked at most of its own
ground and never will. So the rate is governed by how hard and how widely people are
looking, not by a countdown to an empty list.

- **Discovery is effort.** Parties out looking in a province. A province with nobody in it
  finds nothing however much is under it.
- **The easy finds come first.** Ground is banded by depth and effort goes to the
  least-worked band anybody can reach.
- **Diminishing returns.** A hyperbolic decline on what has already been found - steep,
  then a very long flat tail, and never zero. Only the endowment reaches zero.
- **Capability opens ground that was always there.** A band nobody can survive is a band
  nobody is looking in. When the ladder produces somebody deeper, the rate steps back up.
  This is deepwater, not new oil.
- **A province can be worked out while its neighbour is barely touched.** Effort
  concentrates where the people are, so populous provinces pick over first and the empty
  frontier stays rich.

**Discovery is not opening.** Finding a place adds it to the standing reserve; opening it
consumes one. Those were the same event, which is why the supply ran out - a party cannot
open a sealed hall nobody has located.

### Measured

Real catalog, three seeds, event budget raised so the harness is not the constraint:

| | before | after |
|---|---|---|
| openings/century over 1000y | 5.0 - 6.0 | 9.7 - 10.5 |
| openings/century over 5000y | 1.2 - 1.5 | 4.1 - 5.0 |
| last fifth of a 5000y run | **0.0, 0.0, 0.0** | 1.1 - 3.7 |
| still in the ground at 5000y | 709 of 709 | 512 - 528 of ~709 |

The old world stopped finding anything and the new one is still finding, still declining,
and has not exhausted its provinces.

---

## See also

- [`immortals.md`](immortals.md) - what crossing the Lid is, and why an ascension divests.
- [`sects.md`](sects.md) - how a crossing's recency drives prestige, and how a sect an
  ancestor left is holding a parting gift.
- [`economy.md`](economy.md) - what separates an inheritance from a grave, which is a
  profession's worth of distinction.
- [`ruins.md`](ruins.md) - the authoring guide for a single site: the four axes,
  convergence windows, and the variety test.
- [`the-late-age.md`](the-late-age.md) - what made the deep past, and why it cannot be
  made again.
