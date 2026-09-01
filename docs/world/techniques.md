<!-- tier: 2 trigger="an art is used, taught, described, refused, or compared to another art; anybody asks what somebody at a given height can actually do" -->

# What an Art Can Do

The ladder of arts, and the one axis on it that escalates **in kind** rather than in
magnitude.

**The failure mode this exists to prevent:** a top rung that is the bottom rung with more
zeroes on it. Grade says how late and how costly an art is. `reach` says how many people
it lands on. The dice say how hard. All three are quantities, and a catalog built only out
of quantities produces somebody at the top of the world throwing a bigger version of what
a bandit throws. The whole progression then means one thing - the numbers got larger - and
a reader who has understood that has understood the entire top of the ladder from the
bottom of it.

The field is `addresses`, on `TechniqueSchema` in
[`../../src/schema/cultivation.ts`](../../src/schema/cultivation.ts), and the ladder,
floors and guards are defined in the block above it. Everything below describes what is
already in that file. Nothing here adds a rule.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [The question the ladder asks](#the-question-the-ladder-asks) | describing what somebody can do at a given height |
| &nbsp;&nbsp;[The bands narrow as they rise](#the-bands-narrow-as-they-rise) | somebody asks why the top of the ladder has so few rungs, or two adjacent high rungs are compared |
| &nbsp;&nbsp;[A wide swing is not a rung](#a-wide-swing-is-not-a-rung) | an art lands on many people at once and somebody takes that for height |
| [What is different at each step, in practice](#what-is-different-at-each-step-in-practice) | the player watches somebody far above them act, or asks what a realm actually buys |
| [The top rung](#the-top-rung) | **Tier 1** - every turn |
| &nbsp;&nbsp;[Why it is not a larger `settled` art](#why-it-is-not-a-larger-settled-art) | **Tier 3** - never injected |
| &nbsp;&nbsp;[The three things a decree cannot say](#the-three-things-a-decree-cannot-say) | a decree is attempted and its limits are being tested |
| &nbsp;&nbsp;[The word at the top three rungs](#the-word-at-the-top-three-rungs) | somebody at one of the last three rungs states a thing about the world |
| [How it composes with the two axes that already exist](#how-it-composes-with-the-two-axes-that-already-exist) | comparing an ancient art to a modern one, or a manual to a fighting art |
| &nbsp;&nbsp;[`class` - and this one is an invariant, not a guard](#class---and-this-one-is-an-invariant-not-a-guard) | somebody expects their cultivation manual to escalate in kind, or a manual is compared to a fighting art |
| &nbsp;&nbsp;[`era` - and this one is the guard that matters](#era---and-this-one-is-the-guard-that-matters) | an ancient art and a modern one of the same height are set against each other |
| &nbsp;&nbsp;[Ancient is a paradigm, not a date](#ancient-is-a-paradigm-not-a-date) | anybody asks where an art was written, or why nothing above the Lid looks like what is taught down here |
| &nbsp;&nbsp;[A modern immortal art is possible, ill-suited, and would belong down here](#a-modern-immortal-art-is-possible-ill-suited-and-would-belong-down-here) | an art written above the Lid turns up down here, or somebody asks whether immortals write elemental arts |
| &nbsp;&nbsp;[A discrepancy the catalog has not caught up with](#a-discrepancy-the-catalog-has-not-caught-up-with) | **Tier 3** - never injected |
| &nbsp;&nbsp;[Where the six ancient arts actually sit](#where-the-six-ancient-arts-actually-sit) | **Tier 3** - never injected |
| [The archive, and what a house holds that it cannot use](#the-archive-and-what-a-house-holds-that-it-cannot-use) | the player is deciding whether to join a faction, or has found a book nobody there can read |
| &nbsp;&nbsp;["They know it works"](#they-know-it-works) | a house asserts a shelved book works when nobody there can open it |
| &nbsp;&nbsp;[Three rules](#three-rules) | **Tier 3** - never injected |
| &nbsp;&nbsp;[The two reasons a house ends up in this state](#the-two-reasons-a-house-ends-up-in-this-state) | a house's library has outrun its living teachers, or a lineage has had a thin generation |
| &nbsp;&nbsp;[The starkest case, which nobody authored](#the-starkest-case-which-nobody-authored) | a house with no vein and no accounts reliably turns out strong disciples |
| [And what runs out](#and-what-runs-out) | somebody is practising an art with an upkeep, or an elder predicts how far somebody will get |
| [Related](#related) | **Tier 3** - never injected |

---

## The question the ladder asks

<!-- tier: 2 trigger="describing what somebody can do at a given height" -->

Not *how big is the effect*. **What is the effect allowed to be about.**

That question has a small number of answers, they are ordered, and the higher ones cannot
be reached from the lower ones at any magnitude.

| | Addresses | Opens at | What that means |
|---|---|---|---|
| 1 | **body** | Qi Condensation | A body. Yours, or the one in front of you. Elemental, immediate, over when it is over. |
| 2 | **place** | Nascent Soul | A place, and a span of it. It landed on a location instead of a person. |
| 3 | **condition** | Body Integration | What a place is *like* rather than who is standing in it. The qi in a valley, what the weather over a province does, whether an art of a given element works here at all. |
| 4 | **settled** | the last crossing | What is already fixed about somebody: a name that was given, an oath sworn, a debt inherited, a span granted, a death already decided. |
| 5 | **decree** | True Immortal | A statement, and the world is obliged. |

The exact ordinals are `ADDRESS_ORDINAL_FLOORS`. Do not restate them anywhere - they are
anchored to realm boundaries and to `LAST_CROSSING_ORDINAL`, and a number copied into
prose goes stale silently.

### The bands narrow as they rise

<!-- tier: 2 trigger="somebody asks why the top of the ladder has so few rungs, or two adjacent high rungs are compared" -->

Twenty-one rungs, then twelve, then eleven, then two, then one. Nobody arranged that; it
falls out of anchoring the floors to realm boundaries, and it is the corridor thesis from
[`escapes.md`](escapes.md) arriving on a second axis. What a cultivator is permitted to
address gets rarer the higher they go, and the last two steps are almost nothing wide.

### A wide swing is not a rung

<!-- tier: 2 trigger="an art lands on many people at once and somebody takes that for height" -->

`several` is a headcount, not a subject. Two palms struck together hard enough to tear the
air between them lands on three people at ordinal nine and is still addressing three
bodies. Only `field` - which the schema defines as *landing on a place rather than a
person* - crosses onto the second rung. This matters because otherwise every roadside art
with a broad stroke in it would be claiming a height it has no business at.

---

## What is different at each step, in practice

<!-- tier: 2 trigger="the player watches somebody far above them act, or asks what a realm actually buys" -->

**body → place.** The art stops needing somebody to aim at. A mountain is named that is
not there and allowed to fall; whoever was underneath is underneath. This is the step most
of the catalog has already taken and it is the step a reader finds least surprising.

**place → condition.** Nobody is the target. The target is the *terms* everybody in that
space is operating under, and people are affected the way people are affected by a
drought. A cultivator here does not fight a valley's defenders; they change what the
valley is, and the defenders discover that the thing they trained for does not work in it.

**condition → settled.** The subject stops being physical. An oath is not in a place. A
name is not made of qi. No `condition` art of any size reaches a fact - widen a drought as
far as you like and it never becomes a thing that unmakes a promise. And a `settled` art
is frequently *smaller* than the rung below: one person, no display, nothing visible from
a distance, and afterwards something about them is no longer the case.

It has no reduced version. You cannot slightly sever a name. An art here either reaches
the fact or it does not, which is why there is nothing beneath its floor that is a weaker
attempt at the same thing.

**settled → decree.** See below. This is the step the whole ladder exists for.

---

## The top rung

<!-- tier: 1 -->

> **An immortal states a thing and the world is obliged.**

Not a metaphor and not an intensifier. There is no target, no medium, no delivery and
nothing that has to already be there.

### Why it is not a larger `settled` art

<!-- tier: 3 -->

A `settled` art operates on a fact that is **already there**. It needs a name that was
given, an oath that was sworn, a death that was decided. Everything it can do is bounded
by what the world has already fixed, and no amount of magnitude widens that bound: an
infinitely powerful art for severing names still cannot reach a person who was never
named.

A decree has no such requirement. It states a thing, and the statement becomes the case -
about somebody who was never named, about a place nobody has visited, about a condition
nobody had thought to fix.

> The rung below **edits** the record. This one **writes** it.

The test, when you are looking at an entry and are not sure which rung it belongs on:
**ask what had to already be true for it to work.** If the answer is anything at all, it
is a `settled` art with a large number on it and it belongs a rung down. A decree answers
nothing.

### The three things a decree cannot say

<!-- tier: 2 trigger="a decree is attempted and its limits are being tested" -->

None of these is a balance patch. Each is an existing rule of the setting arriving on the
axis of the word.

**It cannot speak a rung.** A statement that somebody is at an ordinal, or is above the
Lid, or is not, does nothing - because a rung is not an opinion the world holds about a
body, it is what the body *is*. This is `WHAT_AN_ART_BUYS` in
[`../../src/engine/cultivation/realms.ts`](../../src/engine/cultivation/realms.ts) read
from the other side: an art is worth most of a rung inside a realm and nothing at all
across the Lid, at any mastery. A decree is an art. It buys what an art buys, and holding
one makes nobody stronger.

**It cannot be amended.** It is spoken inside `BREATHS_IN_THE_LOWER_REALM` - ten to
fifteen - and the speaker is gone before the world has finished complying. Nothing can be
added, corrected, revoked or explained afterwards, by them or by anybody. Every ambiguity
in the sentence resolves the way the world resolves it rather than the way it was meant,
and the record of decrees spoken below the Lid is substantially a record of that going
badly. **It is the one power in the world that cannot be adjusted after use.**

**It cannot govern.** The world obeys the statement, not the speaker. A decree that would
need somebody to keep judging it receives no judgement at all - it gets the flat reading,
for ever. Fifteen breaths is enough to fix a fact and is not enough to hold a province,
and a fixed sentence cannot administer one afterwards.

That last one is why the world below survives the existence of the rung, and it is the
same sentence the engine already says about retaliation from above the Lid: it can only
answer, once, very fast, and then it is gone whether it finished or not.

### The word at the top three rungs

<!-- tier: 2 trigger="somebody at one of the last three rungs states a thing about the world" -->

The clearest worked example in the setting, and most of it was in the catalog before the
ladder existed. The **same act** - a person states a thing about the world - at the last
three rungs:

```text
the last crossing   It is heard. The heavens are not obliged, the record of
                    outcomes is not encouraging, and it is not empty either.
False Immortal      It is heard, and answered, and the answer is no.
True Immortal       The world is obliged.
```

Two rungs, three categorically different outcomes, and no quantity anywhere in the
progression. The middle one is not a flourish: **being refused is what a False Immortal
is**, said in the vocabulary of the word instead of the vocabulary of the crossing. And
the first is the Word of Continuance, which has been in the catalog all along - *spoken
over someone whose death has already been decided, it argues*.

---

## How it composes with the two axes that already exist

<!-- tier: 2 trigger="comparing an ancient art to a modern one, or a manual to a fighting art" -->

This ladder does not replace `class` or `era`. It cuts across both.

### `class` - and this one is an invariant, not a guard

<!-- tier: 2 trigger="somebody expects their cultivation manual to escalate in kind, or a manual is compared to a fighting art" -->

**A cultivation manual addresses the practitioner, at every rung, for ever.** What you
practise to rank up never escalates in kind; only what you *use* does. The catalog already
said this, in the note on the one gathering canon that sits at the very top of the ladder
and still lands on exactly one person - the person practising it.

So the address ladder is a property of dao arts alone, and the highest book in the world
is still a book about a breath.

### `era` - and this one is the guard that matters

<!-- tier: 2 trigger="an ancient art and a modern one of the same height are set against each other" -->

Modern is elemental and scales to the horizon. Ancient is categorical: it moves a resource
between bodies, it puts spears in the ground somebody else can pick up, it takes a piece
of ground out of the world, it makes a second body. See [`ancient.md`](ancient.md), which
is the authority on that distinction.

**An ancient art must never buy a higher rung on this ladder.** If it did, old art would
be strictly better and the whole era axis would collapse into *old is stronger* - which is
the exact failure `ancient.md` exists to prevent. The floors bind both eras identically.

### Ancient is a paradigm, not a date

<!-- tier: 2 trigger="anybody asks where an art was written, or why nothing above the Lid looks like what is taught down here" -->

The field is called `era` and that name misleads. **Ancient names a kind of art, not a
century.** Something composed above the Lid this morning is ancient, because that is the
idiom of the place it was composed in.

The mechanism is rate of change. **The immortal realm is closer to the prosperous age than
the lower world is, because it changes slowly.** The paradigm never ended up there; it
simply persisted. Down here it did end, and what replaced it was forced rather than
chosen: a poorer, faster world, short of everything the categorical line consumes, made do
and developed the elemental one instead. So the two idioms are not early and late. They
are *two places*, one of which moves.

That has a consequence worth stating plainly, because it is the opposite of what the word
*ancient* suggests:

> **New ancient arts are still being written.** They are being written above the Lid, by
> people who are not old, in the only idiom that suits where they live.

### A modern immortal art is possible, ill-suited, and would belong down here

<!-- tier: 2 trigger="an art written above the Lid turns up down here, or somebody asks whether immortals write elemental arts" -->

Not impossible. **Ill-fitting.** Somebody above the Lid could compose in the elemental
idiom, and the result would sit badly exactly where it was made - an art built for a world
of veins, weather and scarcity, made somewhere none of that is the constraint.

And its natural destination is downward, into the world whose paradigm it actually belongs
to. That is not a hypothetical the setting has no vocabulary for. **The delivery route
already exists** and is ordinary: `MANUALS_MAY_EXCEED_THE_LID` says a manual is paper and
may be rated anywhere, and a True Immortal sending writings down is the whole of the read
channel at that rung. Every part of the machinery is in place.

It has simply never happened. What it would take is not only the understanding, but
somebody above the Lid **willing to compose in an idiom that does not suit where they
live, for the benefit of a world they left**. That is a question about a person rather
than about a capability, which is why the answer has been no for as long as anybody has
records.

If one ever came down, it would be earth-shaking - and not because it would be strong.
Because it would be the first art from up there that the world below was actually built to
receive.

### A discrepancy the catalog has not caught up with

<!-- tier: 3 -->

Under the rule above, the six arts written for the rungs above the Lid should be `ancient`
by construction, whatever date is attached to them. **They are currently all filed
`modern`** - measured, not assumed: six arts above the Lid, six modern, none ancient, and
the `ancient` set tops out ten rungs below the Lid.

That is an artefact of how `era` is resolved rather than a design position. It comes from a
hand-authored set of six ids in `techniques.ts` that was never extended upward, and
everything outside that set defaults to `modern`. All six read categorical and all six are
elementless, so nothing about them resists the reclassification.

Recorded here rather than quietly corrected, because the technique catalog is owned
elsewhere. The prose states the rule; the data has not been changed to match it yet.

### Where the six ancient arts actually sit

<!-- tier: 3 -->

The six arts currently filed `ancient` are the top of the **categorical** line *below the
Lid*, and the ladder has to *account* for them rather than sit beside them. It does, and
four of the six land on the first rung:

| Art | Addresses | Why |
|---|---|---|
| Hundred-Pace Step | body | It moves one body - the practitioner's - to somewhere it was not. |
| Vessel-Borrowing Palm | body | It takes a resource out of one body and puts it into another. Two bodies, and nothing else. |
| Sixteen-Thread Command | body | It makes *one person* act. |
| Hollow Second Body | body | A second body is a body. |
| Sealed Field of the Shut Hour | place | It takes a piece of ground out of the world, for an hour. |
| Thousand-Spear Summoning | place | The spears are still standing in the ground afterwards, holding a line. |

None of them reaches past its rung, and the Sixteen-Thread Command lands **two steps
below** the ceiling its height would allow - which is the clearest demonstration in the
catalog that being ancient buys nothing on this axis. What is ancient about these is *what
they do to the thing they address*, never *what they are allowed to address*.

And that is precisely why the decree reads as the rung **above** them rather than as a
different idea. A second body is still a body. A sealed hour is still a place. Every one of
the six needs a subject that is already there - a body to move, a body to take from, a
person to command, a piece of ground to seal.

> The categorical line does extraordinary things to subjects that are there. The top rung
> is the one that does not need a subject.

---

## The archive, and what a house holds that it cannot use

<!-- tier: 2 trigger="the player is deciding whether to join a faction, or has found a book nobody there can read" -->

Four states, and they are worth keeping apart, because they are four different problems
and only one of them is solvable.

```text
abandoned          The era moved on, by choice. It works; nobody wants the bargain.
lost               The method survives, the material does not. Involuntary.
no surviving copy  The last copy is gone, and the reason is stated per art.
dormant            Present, complete, proven, and unperformed. Nothing is missing
                   except somebody who can do it.
```

`DORMANT_ARTS` in
[`../../src/data/cultivation/faction-character.ts`](../../src/data/cultivation/faction-character.ts)
is the fourth, and it is the least dramatic and the most useful, because it makes an
institution's **history load-bearing in the present**.

`production` already records the gap between what a house can reliably turn out and what
it once could. For most of the catalog that gap is atmosphere. A dormant holding converts
it into an object: the person at the peak practised something, the archive kept it, and it
is still on the shelf. **A house at the bottom of a long fall is therefore a better
prospect than its roster looks**, and that is a fact a player can act on.

### "They know it works"

<!-- tier: 2 trigger="a house asserts a shelved book works when nobody there can open it" -->

This is not hedged and it is not a rumour. It is deliberately unlike a sect's ancestral
claim - which is two fields precisely because houses frequently do not know what they are
claiming. Here they do. Somebody in the house did it, it is written down with names and a
year, and the house will say so without embellishment and without apology.

If it reads as *it is said that*, it is in the wrong table.

### Three rules

<!-- tier: 3 -->

1. **Never on the teach list.** `teaches` is a house's entire *working* library. A shelved
   book nobody can open is not a living transmission and must not create one.
2. **Out of reach in fact, not in policy.** The art stands above the best living hand in
   the building. Nobody is refusing anybody.
3. **Learnable.** Every holding says what it would take, because a destination nobody can
   reach is scenery - and a house that cannot use a thing has very little reason to be
   precious about it. Several of these are cheaper to obtain than arts a quarter as good.

### The two reasons a house ends up in this state

<!-- tier: 2 trigger="a house's library has outrun its living teachers, or a lineage has had a thin generation" -->

**A Dao house** is a lineage, and thousands of years of one principle sit on whoever
happens to have been born. There is no way to hire around a thin generation, so the
archive routinely holds the far end of a road the family is no longer walking. The houses
are not distressed about this the way a sect would be; it is the form working as designed.
And it lands where it should: the fourth rung of the address ladder operates on names,
oaths, debts and fates - which is to say on exactly what a Dao house has spent five
thousand years understanding. **They are the only kind of institution that could have
written one down.**

**A sect** with a deep foundation holds what its peak practised. The temple that produced
somebody who crossed still has what that person was reading.

### The starkest case, which nobody authored

<!-- tier: 2 trigger="a house with no vein and no accounts reliably turns out strong disciples" -->

A temple that keeps no accounts, takes intake every other institution has refused, sits on
ground it chose for having no vein, and reliably turns out Foundation Establishment. Its
founder crossed. Writings came back down.

So there are three sets of writings from above the Lid, on a shelf, in the poorest
institution in the province, and no monk in twenty-six centuries has got past the opening
of any of them. The Abbot will hand them to anybody who asks and does not care whether he
is believed.

That fell out of the production table meeting the transmission rule at the top rung. It is
what the setting produces when its own tables are read together.

---

## And what runs out

<!-- tier: 2 trigger="somebody is practising an art with an upkeep, or an elder predicts how far somebody will get" -->

Some arts consume something the world is short of, and the shortage is now something the
engine produces rather than something the catalog believes.

`masteryCeilingFor` in
[`../../src/engine/cultivation/upkeep.ts`](../../src/engine/cultivation/upkeep.ts) reads
the world's remaining supply and returns the mastery it carries somebody to. **It is an
upkeep nobody can meet, never a rule saying you may not.** The art works. Nobody is
refused anything. The jars are empty, and the practitioner is holding a book they can read
and cannot go further into.

This exists so that an elder who says *you will not cultivate this past the fifth level,
there is not enough of it left on the ground anywhere* is **right**. A world whose experts
are demonstrably wrong is a world whose experts a player learns to stop listening to,
which is a worse loss than any single mechanic.

The counterpart survives, and it is the whole *you must be somebody* design: whoever **is**
supplied goes further, and goes exactly as far as their supply goes. There are two such
arrangements in the world - a dead man's stocked cellar, metered deliberately to a point
past where anybody would tell you you could get and short of the end, and one house
quietly holding a remnant it has never acknowledged. Both are authored. Neither is a rule.

---

## Related

<!-- tier: 3 -->

- [`ancient.md`](ancient.md) - the era axis, and the failure this page inherits its shape from
- [`escapes.md`](escapes.md) - the corridor above the middle, which this ladder narrows in parallel
- [`dao-houses.md`](dao-houses.md) - accumulated knowledge as a form of power, and why the archive matters
- [`immortals.md`](immortals.md) - the two rungs above the Lid and what the breaths cost
- [`the-late-age.md`](the-late-age.md) - why so much of this is on a shelf rather than in a hand
