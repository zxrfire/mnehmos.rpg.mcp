<!-- tier: 2 trigger="an object changes hands, is bought, sold, copied, spent, hidden, or refused; or somebody asks what a thing is worth or how many exist" -->

# Items

Everything in the world that can be held. Manuals, pills, artifacts, materials, the
comprehension pieces that are gone once understood.

Read alongside [`economy.md`](economy.md), which covers price, ownership and provenance, and
[`manuals.md`](manuals.md), which covers books as a special case of everything below.

<!-- tier: 3 -->

## Sections

| Section | The scene it answers |
|---|---|
| [Counted or tracked](#counted-or-tracked) | Anything changes hands, and you have to store it |
| &nbsp;&nbsp;[Why that line falls where it does](#why-that-line-falls-where-it-does) | Somebody asks why the cheap things restock and the good ones do not |
| [What money cannot buy](#what-money-cannot-buy) | Somebody tries to purchase something above the line |
| [Why a holder keeps what they cannot use](#why-a-holder-keeps-what-they-cannot-use) | A house sits on something useless to it |
| [Spent is not gone](#spent-is-not-gone) | An object is consumed, and somebody asks about it later |
| [Holding is a signature](#holding-is-a-signature) | Somebody is seen with a thing that is not theirs |
| [Scarcity is measured, not authored](#scarcity-is-measured-not-authored) | Deciding how many of something exist |
| [The almanac and the ledger](#the-almanac-and-the-ledger) | Deciding which surface a fact about an object belongs on |
| [How rare a medicine should be](#how-rare-a-medicine-should-be) | Pricing or placing anything that repairs a cultivator |
| &nbsp;&nbsp;[Who is allowed to make it](#who-is-allowed-to-make-it) | A medicine is refined, or somebody asks why a grade is rare |
| &nbsp;&nbsp;[The tier nobody here makes](#the-tier-nobody-here-makes) | An immortal-grade object is held, wanted, asked for, or refused |

---

## Counted or tracked

<!-- tier: 2 trigger="an object is created, stored, or transferred, and the question is how many there are" -->

**The single decision that governs every item in this world.** Some things are a quantity;
some are a row with a history. Getting it wrong in either direction is expensive:

> **Track the fungible and the tables become useless and the queries slow. Aggregate the
> singular and the world forgets things it should never forget.**

**Counted.** Made, bought, spent and replaced constantly, and nobody cares *which one* you
took. A holder and a number is the whole of what needs storing. Low and middling pills are
here - they churn enormously - and so are a house's twenty intake primers, which are one
fact about the house rather than twenty facts.

**Tracked.** Each one is a row with a holder, a provenance and a story about how it was got.
Artifacts, high-tier pills, single-use comprehension materials, and any manual scarce enough
that *which* copy it is matters. The test is not value in stones. It is **whether the
movement of this specific object is an event somebody should be able to find out about two
centuries later.** If yes, it is a row.

The engine already draws this line and it should not be redrawn. `possessions.ts` has both
shapes: `makeResourceLot` for a quantity that came from somewhere worth remembering - *the
108 stones out of an abandoned mine are one row; the stones somebody was paid last week are
not tracked at all* - and `makeObject` with a `significance` that gates whether provenance is
kept at all. `mundane` things deliberately get none.

**Use `significance` as the switch.** It exists for exactly this and adding a second field
beside it is how two sources of truth start disagreeing.

### Why that line falls where it does

<!-- tier: 2 trigger="somebody asks why cheap goods restock forever and good ones do not, or a grade's supply is being decided" -->

The rule above says which shape to store a thing in. This says **why the boundary sits
where it does**, and it is not an authoring convention. It is what one production rule
produces.

The rule is that **a cultivator cannot work with materials above their realm.** Mortal
grade is worked at Qi Condensation, earth at Core Formation, heaven at Void Refinement, and
above that by nobody who lives here. So the supply of a grade is not a decision. It is the
size of the population standing at its rung, and that population is the pyramid seen from
the production side:

> **Only the bottom of the ladder has enough hands to produce indefinitely.**

That single sentence gives the whole of the counted/tracked boundary:

- **Cheap things are counted** because everybody who cultivates at all can make one. A
  house's shelf of them is a number that goes back up. Nobody cares which one you took,
  because another is being made somewhere this afternoon.
- **Good things are rows** because the hands that could have made one are few enough to
  name. Where a dose could only have come from a few dozen people in the world, *which*
  dose it is and how it got here is exactly the thing somebody should be able to ask about
  two centuries later.

And it lands the claim two sections down - that a thing is cash-priced exactly where it is
fungible and barter-only exactly where it is singular, and that if those two boundaries
ever drift apart one of them is wrong. **They cannot drift now**, because both follow from
the same gate: a grade nobody can restock is a grade no market can quote.

Read the number rather than trusting this paragraph.
`tests/engine/world/how-many-people-can-make-a-grade-of-medicine.test.ts` counts the makers
of each grade off a seeded world. Measured, on a world of 587 living cultivators: 587 can
work mortal-grade materials, 89 can work earth, 30 can work heaven, and nobody at all can
work what is above it. Retake the figure rather than quoting this one - it moves with the
catalog - but the shape is what the ruling predicts.

The engine's own three answers - `who-can-refine-a-grade-of-medicine.ts` on who may make
it, `buying-and-bartering-pills.ts` on what may be priced, and `possessions.ts` on how
it is stored - are written independently and agree, which is the sign they are all reading
one fact rather than three conventions.

---

## What money cannot buy

<!-- tier: 2 trigger="somebody tries to buy something rare, or asks the price of something nobody sells" -->

There are two economies and the boundary is not a price, it is a **kind**.

**Below the line, things have prices.** Common manuals sell at a market stall next to the
cooking pots. Early breakthrough pills are bought and sold for spirit stones by anybody who
has stones. This tier is what keeps an unbacked nobody from being locked out of cultivation
entirely, and it is why a poor cultivator's first real decision is whether the money goes on
a book or on food.

**Above it, cash is simply not the medium.** Not "expensive" - *not for sale*. The people who
hold these things do not need money, and offering it reads as not understanding what you are
looking at. What moves them instead:

- **A favour owed.** An obligation from somebody at a height your house cannot reach is worth
  more than any price, and it is worth it **exactly once**. Houses hold objects for decades
  waiting for the right person to need one.
- **Another singular thing.** A rare artifact, a technique nobody else teaches. Barter
  between parties who both have everything money buys.
- **Nothing at all**, because it is not moving. See below.

The line between the tiers should be the *same* line as the counted/tracked one. A thing is
cash-priced exactly where it is fungible and barter-only exactly where it is singular. If
those two boundaries ever drift apart, one of them is wrong.

---

## Why a holder keeps what they cannot use

<!-- tier: 2 trigger="a house holds something nobody in it can use, and somebody asks why they do not sell it" -->

The obvious move is to sell. A material calibrated to a height your best disciple will never
reach is dead capital, and somebody two provinces over would pay enormously. Houses hold
these for centuries anyway, and the reasons are not sentiment - each produces a different
institution:

- **Afraid to sell.** Putting it on a market announces that you have it, and announces the
  day it leaves your walls with a small escort. A weak house holding a valuable thing is not
  rich, it is *quiet*. The fear is specific: not of being robbed, but of the bloodbath that
  starts when three interested parties learn about each other.
- **A rainy day.** Held against a future they can name - a succession, a war they expect, a
  disciple who is eleven. This house has a plan and the object is in it.
- **Tribute.** Owed upward. A subsidiary holding something its backer would want does not own
  it in any sense that matters; it is holding it until asked, and the asking is a matter of
  time.
- **A favour not yet spent.** Waiting for the right person to need it.

A holder who could actually *use* the thing has no reason here and carries none. The question
only exists where the object is beyond its holder.

---

## Spent is not gone

<!-- tier: 2 trigger="something is consumed, and later somebody investigates what a house once had" -->

**A consumed object leaves its row behind.** Single-use comprehension materials are the sharp
case - once it goes into your head it is gone, nobody can lend one, nobody can share one, and
a house that spends one on the wrong disciple has spent it - but the record of *that house
having held one and used it on that person* is precisely the sort of thing somebody should be
able to discover two hundred years later.

An object that vanishes cleanly from the record is an object nobody can ever be asked about,
and being asked about it is most of what makes it matter.

The same applies to loss. A house that cannot account for something should have a record that
says so, and the gap between what the record claims and what is in the room is one of the best
things a world can hold. **An inventory read from a list rather than from the shelf is a house
that has decided not to look.**

---

## Holding is a signature

<!-- tier: 2 trigger="somebody is seen with, or practising, something that is not theirs" -->

Objects are not anonymous. Practising an art is visible and knowledgeable people recognise it
on sight, so a manual off a black market works exactly as well as the real one and is
**evidence for as long as you keep climbing on it** - which is the rest of your life, because
putting it down means starting again.

**What happens when they catch you is decided by whose it is**, not by the theft:

- **A demonic house** may simply kill you. There is no process to fail and nobody to explain
  yourself to.
- **A righteous house** asks where you got it. Worse in one direction and better in the
  obvious one: there is a conversation, it has a right answer, and they want your *source*
  far more than they want you. You may walk away having given up somebody else.
- **A neutral house** prices it. A loss to be recovered or a lever to be used, depending on
  what you are worth to them.

So the risk is **not the same risk**, and the same decision is correct for different people.
A rogue with no house, no standing and no prospects is being offered a real ladder against a
danger they were already carrying, and many of them take it knowingly. That is why the
forbidden things stay in circulation however many people are killed over them.

---

## Scarcity is measured, not authored

<!-- tier: 3 -->

How many of something exist is a fact you should be able to *read off the world*, not a
number somebody chose. Two worked examples, both of which came out of the catalog rather than
out of anybody's judgement:

**Every cultivation manual above the Void Refinement line is taught by exactly one house.**
Nobody decided that. It fell out of counting, and it is why "common" is now defined as *how
widely a thing is held* rather than *how high it carries* - the two coincided by accident
until the shelves were filled in, and then the old definition started calling the province's
standard crossing somebody's private property.

**Copies fall steeply with what a book carries**, for a reason rather than a curve: anybody
who reached Void Refinement is already an exception, so the pool of people who could copy such
a thing is tiny. Scarcity at the top is a consequence of the ladder's own shape.

When you need a count, look for the fact that already implies it. A number with a measurement
behind it survives the next content pass; one that was chosen does not.

---

## The almanac and the ledger

<!-- tier: 2 trigger="a fact about an object has to be shown to somebody, and the question is where it goes" -->

The counted/tracked line above decides how an object is *stored*. This one decides where it is
*shown*, and the two are the same line seen from the reader's side. There are exactly two
questions a person can have about an object, they are different questions, and a surface that
tries to answer both answers neither:

> **The almanac says what a thing IS. The ledger says WHO HAS IT.**

**The almanac** is what kinds of thing exist in the world at all, and a description of each. A
reader opens it to find out what something is - what a soul-quenching needle does, what makes a
third-grade furnace different from a second. Its rows are kinds, and **no holder appears here.**
A kind is not owned by anybody; that is what makes it a kind.

**The ledger** is which specific things exist right now and who is holding them, with the
provenance that says how they came by it. A reader opens it to find out who has what. Its rows
are objects with histories - the `makeObject` and `makeResourceLot` rows, the ones whose
movement is an event somebody should be able to find out about two centuries later.

The failure is always the same and it is worth naming, because it does not look like a bug: a
surface drifts into the middle, listing kinds *and* gesturing at holders, so it is no longer a
reference (it does not describe everything that exists) and not yet a record (it cannot tell you
who has one). Both readers leave without their answer, and the page reads as merely *dense*
rather than as *wrong*, which is why it can sit there for months.

Two consequences worth holding on to:

- **The two lines are related and they are not the same line.** This one was overstated when
  it was first written here, and the register caught it: a **counted** thing still has a holder.
  A house's twenty intake primers are one fact about the house, and *whose* twenty they are is
  exactly the sort of thing the ledger should say. So the ledger carries rows AND counts held
  against named bodies. What is exclusive to tracked rows is **provenance** - the history of how
  this particular object came to be where it is. Aggregate the singular and you lose that
  history; you never lose the holder.
- **A singular thing has both, and they must not repeat each other.** The almanac describes the
  kind once; the ledger names the holder and the history. When a fact is duplicated across the
  two, the copies drift, and the reader learns not to trust either.

---

## How rare a medicine should be

<!-- tier: 2 trigger="a medicine is created, priced, stocked, or refused; or somebody asks how to mend an injury" -->

**Scarcity follows what the injury COSTS, not how alarming it sounds.** That is the whole rule,
and it puts the obvious-sounding answer the wrong way round often enough to be worth stating.

Two questions decide where a medicine sits:

> **Does the wound take a rung from you, or only a life?**
> **And how high does the medicine have to reach to act on this patient?**

**A wound that does not block advancement is a SURVIVAL problem, and its medicine belongs at the
common end.** Meridian injuries are the worked example: a cultivator carrying torn meridians
still climbs - the rung is not withheld - what the injury does is threaten to kill them. So
mending them should be *obtainable*. A young cultivator with a minor one should manage it
easily; a badly torn one should be a matter of cost and effort rather than a hunt.

**The genuinely rare medicines are the ones that give back a ceiling.** Anything that repairs a
damaged foundation, restores something structurally lost, or lifts a hard block on advancement
is buying back a *rung*, and that is the scarce article. Those are the ones that should be
hard to find, expensive out of proportion, and often not for sale at all.

The second axis is the patient. **A medicine has to reach the height of the person it acts on**,
and the ladder thins as it climbs - the same principle already governing books, roads and
teachers. So mending a Qi Condensation cultivator's meridians is ordinary work, and mending the
same wound at Nascent Soul is not.

Together those give a matrix with a live corner and a dead one, and **both corners are correct**:
a beginner with a minor wound fixes it in an afternoon, and somebody high up with a serious one
is facing something genuinely hard to obtain. The second failing is not the system breaking -
it is why sects, favours and inheritances matter.

Above the line, [`economy.md`](economy.md)'s rule applies unchanged: the top-tier repair does not
carry a price, it moves on a favour owed or on barter or not at all.

**And a cure being rare is never the same as a cure being invisible.** Whatever cannot be had
must still be *nameable*: somebody who cannot afford the medicine should be told what would mend
them and why it is out of reach. A refusal that does not name its cause is indistinguishable
from a missing feature - which is how the commonest cause of death in a playtested build turned
out to have no reachable cure at all, while the formula for it sat in the catalog the whole time.

**Both halves of the rule are enforced in the same place now, which they were not.** The
severity and the patient's height decide the grade, and until recently only the mortal
physician asked - so a sixty-stone mortal pill closed a crippling tear one turn after a
physician had refused the same wound by name. `what-grade-of-medicine-a-wound-needs.ts` is
the ladder and both the physician and the pill read it.

### Who is allowed to make it

<!-- tier: 2 trigger="a medicine is refined or attempted, or somebody asks why a grade of medicine is rare" -->

Everything above is the DEMAND side: what a wound needs. This is the supply side, and it is
the reason the good grades are hard to come by at all.

> **A cultivator cannot work with materials above their realm. That is what makes the
> higher grades rare** - not their price, and not anybody choosing to write down a small
> number.

| grade | realm required to make it |
|---|---|
| mortal | Qi Condensation |
| earth | Core Formation |
| heaven | Void Refinement |
| immortal | nobody in this world |

Three things follow, and the third is the one that keeps getting lost:

- **The maker stands above the patient.** Mortal grade is *pitched at* Foundation
  Establishment and *made at* Qi Condensation; heaven grade is pitched at Nascent Soul and
  made at Void Refinement. So a house that can treat its own elders is a rarer thing than a
  house that can pay for treatment, and that gap is most of what an alchemist is worth.
- **The count is readable.** How rare heaven grade is equals how many people stand at Void
  Refinement, which is a number on the register rather than a decision. See
  [why that line falls where it does](#why-that-line-falls-where-it-does).
- **This is a different ladder from the one above it, and they must not be collapsed.** Who
  may MAKE a grade is answered by the refiner's realm. What grade a WOUND needs is answered
  by the severity and the patient's realm. A Core Formation alchemist refines earth-grade
  medicine and may be carrying a crippling tear that only heaven grade closes; both
  sentences are true of the same person in the same hour.

### The tier nobody here makes

<!-- tier: 2 trigger="an immortal-grade object is held, wanted, asked for, or refused" -->

**Immortal grade is not made on this side of the Lid at all.** It is sent down, and the
supply in the world is what has been sent - finite, shrinking, and one fewer every time
anybody spends one.

The exception is a single event and it is catastrophic for the one who performs it: an
immortal may come down and will it. [`immortals.md`](immortals.md) is the authority on that
crossing and on how long it can last, which is a matter of breaths. It costs the descending
immortal cultivation condensed over ages, it is one of the few ways an immortal actually
dies, and **it holds for every immortal-grade medicine without exception.** Nothing else
produces one.

**The catalog is [`../../src/data/cultivation/immortal-items.ts`](../../src/data/cultivation/immortal-items.ts),
and it is the authority.** It is deliberately not summarised here, because two copies of a
fact are two things to keep true - see [the almanac and the ledger](#the-almanac-and-the-ledger).
What a reader of this file needs to know before going there:

- **These are not priced and must never be.** A price would imply the economy reaches them
  and it does not. The great auction house has never listed one; the Consortium declines to
  assay them, on the stated grounds that an assay implies a rate.
- **Their own higher/middle/lower grading is not the grading in this section.** Up there,
  grade is what an ancestor can afford to send, which tracks how long they have been
  across - a fact about the sender, not about a maker's realm. It is the one place the rule
  above does not apply, and it does not apply because nothing below makes them at all.
- **Getting one is two entirely different problems depending on who holds it**, and that is
  the interesting part. One holder has a living person who could decide to say yes, so it
  is a social and political problem. The others are bodies that count an unreplenishable
  line item to the unit and require a quorum, where any one voice refuses and rank does not
  help - *there is a form; it has been submitted; the answer was no.* That is arithmetic
  rather than a lever, and there is no version of it where the right person is found and
  enough pressure applied.

`structural-repair-medicine.ts` carries the same rule for the medicine that gives back a
ceiling, in the same words: cannot be made here, sent down, and the number in the world is
what has been sent.
