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
| [What money cannot buy](#what-money-cannot-buy) | Somebody tries to purchase something above the line |
| [Why a holder keeps what they cannot use](#why-a-holder-keeps-what-they-cannot-use) | A house sits on something useless to it |
| [Spent is not gone](#spent-is-not-gone) | An object is consumed, and somebody asks about it later |
| [Holding is a signature](#holding-is-a-signature) | Somebody is seen with a thing that is not theirs |
| [Scarcity is measured, not authored](#scarcity-is-measured-not-authored) | Deciding how many of something exist |
| [The almanac and the ledger](#the-almanac-and-the-ledger) | Deciding which surface a fact about an object belongs on |

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

- **A fungible thing has an almanac entry and no ledger row.** Nobody tracks which low-grade
  pill it is, so there is nothing for the ledger to say. Asking the ledger about it is asking a
  question the world has deliberately declined to store - and that is a correct answer, not a
  gap to be filled in.
- **A singular thing has both, and they must not repeat each other.** The almanac describes the
  kind once; the ledger names the holder and the history. When a fact is duplicated across the
  two, the copies drift, and the reader learns not to trust either.
