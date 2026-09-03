<!-- tier: 2 trigger="an object changes hands, is bought, sold, copied, spent, hidden, or refused; or somebody asks what a thing is worth or how many exist" -->

# Items

Everything in the world that can be held. Manuals, pills, artifacts, materials, the
comprehension pieces that are gone once understood.

Read alongside [`economy.md`](./economy.md), which covers price, ownership and provenance, and
[`manuals.md`](../climbing/manuals.md), which covers books as a special case of everything below.

<!-- tier: 3 -->

## Sections

| Section | The scene it answers |
|---|---|
| [Does it have a history](#does-it-have-a-history) | Anything changes hands, and you have to store it |
| &nbsp;&nbsp;[A price and nothing else](#a-price-and-nothing-else) | Somebody buys a meal, or a province stops selling grain |
| &nbsp;&nbsp;[An amount somewhere](#an-amount-somewhere) | Somebody forages, hunts, or buys a common book |
| &nbsp;&nbsp;[One thing with a history](#one-thing-with-a-history) | An object is worth being asked about two centuries later |
| &nbsp;&nbsp;[Nothing moves up](#nothing-moves-up) | Somebody proposes refining, upgrading, or promoting a thing |
| &nbsp;&nbsp;[Provenance is testimony](#provenance-is-testimony) | Two houses disagree about where a treasure came from |
| &nbsp;&nbsp;[Why that line falls where it does](#why-that-line-falls-where-it-does) | Somebody asks why the cheap things restock and the good ones do not |
| [What money cannot buy](#what-money-cannot-buy) | Somebody tries to purchase something above the line |
| [Why a holder keeps what they cannot use](#why-a-holder-keeps-what-they-cannot-use) | A house sits on something useless to it |
| [Spent is not gone](#spent-is-not-gone) | An object is consumed, and somebody asks about it later |
| [One thing breaks the way everything breaks](#one-thing-breaks-the-way-everything-breaks) | Anything somebody owns is broken, holed, worn out, or mended |
| [Holding is a signature](#holding-is-a-signature) | Somebody is seen with a thing that is not theirs |
| [Scarcity is measured, not authored](#scarcity-is-measured-not-authored) | Deciding how many of something exist |
| [The almanac and the ledger](#the-almanac-and-the-ledger) | Deciding which surface a fact about an object belongs on |
| [How rare a medicine should be](#how-rare-a-medicine-should-be) | Pricing or placing anything that repairs a cultivator |
| &nbsp;&nbsp;[Who is allowed to make it](#who-is-allowed-to-make-it) | A medicine is refined, or somebody asks why a grade is rare |
| &nbsp;&nbsp;[The tier nobody here makes](#the-tier-nobody-here-makes) | An immortal-grade object is held, wanted, asked for, or refused |

---

## Does it have a history

<!-- tier: 2 trigger="an object is created, stored, or transferred, and the question is how many there are" -->

**The single decision that governs every item in this world**, and the question to ask is
not "is this valuable". It is **whether the thing has a story anybody could be asked about.**
Getting it wrong in either direction is expensive:

> **Track the fungible and the tables become useless and the queries slow. Aggregate the
> singular and the world forgets things it should never forget.**

There are **three** answers, not two, and each line is where it is for a different reason:

| | What is stored | What moves it |
|---|---|---|
| **A price and nothing else** | no row anywhere | events in the world |
| **An amount somewhere** | a number, per holder and per place | people taking it and people making it |
| **One thing with a history** | a row with a holder and a provenance | somebody's decision, and it is an event |

The code's terms for the last two are **counted** and **tracked**, and they are load-bearing
in `possessions.ts` and everywhere that reads it. They are also a poor name for the
distinction they draw, which is why the prose above does not lean on them: **both are
recorded, and both are counted.** A counted thing is fully accounted for - a character's row
says they hold three, a place's row says how many are still in the ground. What it does not
have is an identity or a past. Nobody who reads this should ever conclude that counted means
untracked and go off to give every bowl of millet an id.

### A price and nothing else

<!-- tier: 2 trigger="somebody buys food, board or a robe, or a province stops being able to sell something" -->

**Most of what anybody buys has no row anywhere, and must not.** A bowl of millet, a night's
board, a robe. No count on the holder, no stock in the place, no arithmetic on the purchase.
Modelling how much grain a province holds would cost more than every question it could
answer, and there is no story in a bowl of millet for anybody to ask after.

That is not to say nothing happens to it. A place has an availability and a price, both of
which move - and what moves them is never anybody buying one.
[`economy.md`](./economy.md#what-restocks-a-thing) is the authority on that and on why the
direction of causation is the whole distinction between this tier and the next.

### An amount somewhere

<!-- tier: 2 trigger="somebody forages, hunts, buys a common manual, or asks how much of a thing a place still has" -->

**Cultivator materials are a number, per holder and per place.** Furs off a Qi Condensation
beast, low-grade herbs, low and middling pills, and a house's twenty intake primers, which
are one fact about the house rather than twenty facts. Fungible - any one is any other - and
nobody asks where a particular one came from, because there is nothing to ask.

The thing that makes them worth storing at all is the opposite of the tier above:

> **Taking is what moves the number.**

So a place holds a count as well as a person does, and the ground half of that is
[`what-a-place-still-has-in-the-ground.ts`](../../../src/engine/world/what-a-place-still-has-in-the-ground.ts) -
one number per place, per kind, per grade, going down when people take from it. What puts
each kind of counted thing back, and why a district can be worked out while a stall cannot,
is [`economy.md`](./economy.md#what-restocks-a-thing).

**This tier is not about materials, and common manuals are the case that proves it.** They
are produced in quantity by people nobody can name, because
[a copy is not a parting](../climbing/manuals.md) - so a person holds three and a stall has
some, and which copy it is has no meaning. **Which means the line into the next tier, for a
book, is not grade.** It is whether the thing can be copied at all, which is the same fact as
whether anybody would notice one leaving. `betrayalOfSelling` in `manuals.ts` is the four-rung
scale that already decides it, and its top two rungs do not move at any price.

### One thing with a history

<!-- tier: 2 trigger="an object is singular, and the question is whether it deserves its own row" -->

**Each one is a row with a holder, a provenance and a story about how it was got.**
Artifacts, high-tier pills, single-use comprehension materials, any manual scarce enough
that *which* copy it is matters. The test is not value in stones. It is **whether the
movement of this specific object is an event somebody should be able to find out about two
centuries later.** If yes, it is a row.

The engine already draws this line and it should not be redrawn. `possessions.ts` has both
shapes: `makeResourceLot` for a quantity that came from somewhere worth remembering - *the
108 stones out of an abandoned mine are one row; the stones somebody was paid last week are
not tracked at all* - and `makeObject` with a `significance` that gates whether provenance is
kept at all. `mundane` things deliberately get none.

**Use `significance` as the switch, through `keptAs`.** The field exists for exactly this,
adding a second one beside it is how two sources of truth start disagreeing, and comparing to
`'mundane'` by hand is the same defect spread over more files.

### Nothing moves up

<!-- tier: 2 trigger="somebody proposes refining, upgrading, improving or promoting an object, or asks whether a material can be raised a grade" -->

**Which side of the line a thing is on is settled when it comes into existence, and it never
crosses.** A counted thing is counted for as long as it exists; a tracked thing was tracked
from its first day. Nothing earns its way into having a history by being valuable or famous,
and nothing loses one. The same is true of grade, and the rule and its one downward exception
belong to [`economy.md`](./economy.md#what-restocks-a-thing).

Two things follow that are about objects rather than about stock, and they are this file's.

**Why the rule is load-bearing rather than bookkeeping.** This is a world running on
inherited things it cannot reproduce - see
[the tier nobody here makes](#the-tier-nobody-here-makes) - and if objects could be improved,
the Late Age premise would not survive the first competent craftsman. The premise is not a
statement about the past. It is a constraint on what a maker can do today.

**And a newly crafted tracked object is unusual in exactly one respect: its provenance is
clean.** Somebody made it, it is known who, and it is known when. In a world where a great
many of the great objects arrive with no story anybody can produce, a thing with a documented
maker is a different kind of possession - and the difference is worth more than the craft.

### Provenance is testimony

<!-- tier: 2 trigger="somebody asks where an object came from, two accounts of one object disagree, or a provenance has to be checked" -->

**Provenance is not a ledger. It is what people remember and repeat.** Memory drifts, gets
flattered, confuses two similar objects, and improves in the retelling. A house can be
entirely sincere and entirely wrong about where its treasure came from, and there is no
authority anywhere that can settle it.

Four things follow, and they are the interesting half of what a tracked object is:

- **A confident provenance and a true one are different things**, and nothing in the world
  reliably separates them.
- **It can be contested.** Two houses with incompatible accounts of the same object, both
  honest.
- **It degrades**, with time and with the death of witnesses, the way all old knowledge here
  does - recognisable in fragments and partly right.
- **It can be checked, at a cost.** That is the axis [`trust.md`](../houses/trust.md) is
  entirely about: a signal is worth what the other party cannot check, and a provenance is
  the same shape.

The machinery for a true thing distorted in transmission already exists and must not be
rebuilt: `rumours-and-what-they-get-wrong.ts` is the whole subject, and `KnowingStage` in
`src/engine/social/discovery.ts` is how anything becomes known at all.

**And a tracked object's story is not always a gap.** `HOW_A_FORTY_FIVE_EXISTS` in
`artifacts.ts` names two routes and only one of them is anonymous: a sent-down piece comes
with a founder, a year and a witness, and a shard comes with a place where something happened
that nobody recorded. Both carry the same tag on the same kind of row, so **the object does
not tell you which of the two you are holding.**

This is also what sharpens the line one tier down: **a counted thing has no story to be
wrong about.** Being able to be honestly mistaken about it is part of what makes a tracked
thing tracked.

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

**And there is a verb for it.** For a long time there was not, and the absence was the
sharpest illustration in the repo of a refusal naming a door nobody built: `see a physician`
on a crippling meridian tear named the medicine, named its grade, said *"nobody sells one of
these for stones"* and listed the three things that would move somebody - and **nothing in
the game accepted that sentence.** Every heaven-grade and above cure was nameable, priced,
seeded onto real houses, and unobtainable.

The player asks what it would take (*"I need xyz, what's your price?"*) and puts something
down that is not money. Two rules govern how it is priced, and both are this file's own:

- **The medium is whatever answers the want, and there is no list of them.** Everything on
  the table is asked one question - *how high does it carry the person receiving it?* - so an
  art, an artifact, an oath, a service, a name, information and a placement for somebody's
  child are all priced by the same line of code. Anything the engine has no row for is worth
  what the person offering it is worth, which is this file's own sentence about an obligation
  from somebody at a height your house cannot reach. **A tenth medium needs no code.**
- **The bar is the object's own rung**, not a number anybody chose, which is
  [scarcity is measured, not authored](#scarcity-is-measured-not-authored) applied to price.

`what-somebody-would-take-for-a-thing-they-will-not-sell.ts` is the arithmetic and it
deliberately cannot answer what somebody NEEDS - that is one model, in
`what-an-open-need-does-to-an-ask-and-to-a-price.ts`, and this consumes it. A **present** need
is a refusal at any figure; a **reserved** one is a price you have not met.

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

## One thing breaks the way everything breaks

<!-- tier: 2 trigger="a spirit boat, a sword, a carriage, a formation plate or a spirit tool is broken, holed, worn out or mended; or somebody asks what a war costs a house physically" -->

Asked how spirit boats come apart when two sects go to war, the design owner answered in one
line: **no bespoke logic, the same way that a sword breaks.** There is one resolver -
[`object-damage.ts`](../../../src/engine/world/object-damage.ts) - and its input type carries
no kind of object at all, so a rule that applies to hulls and not to blades cannot be written
without widening a signature somebody would have to argue for.

What it reads is what any thing has: the rung it was made at, and the rung of whatever was put
through it. The gap between the two is the whole answer, and it is
[`whether-a-weapon-survives-being-used.ts`](../../../src/engine/cultivation/whether-a-weapon-survives-being-used.ts)'s
arithmetic rather than a second copy of it - within a realm it holds, past two it is not a
chance, and the band between is a roll.

Two things follow that this file already believes:

- **Breaking is not one outcome.** A thing can be *holed* - worth a rung less, carrying a dated
  scar, and mendable by a hand that reaches its rung. A thing holed more often than anybody
  mended it ends as *a spirit tool with the qi long gone out of it*, which is the Late Age's own
  phrase and is the state a child's toy is in. Past that it is *ruined*, and only at the very top
  of the ladder does it leave pieces.
- **Counted things cannot be damaged.** They stop existing. There is nowhere to write the scar,
  because a holder with three carriages does not have three carriages one of which has a hole in
  it - which is [Does it have a history](#does-it-have-a-history) arriving at its own conclusion
  rather than being set aside. A tracked hull carries the hole, the date and the cause, and
  [Spent is not gone](#spent-is-not-gone) applies in full: the row outlives the object either way.

And breaking somebody's thing is a wrong done to a person, priced by
[`what-a-deed-leaves.ts`](../../../src/engine/social-leverage/what-a-deed-leaves.ts) from what it
cost them against what they had - so an apex losing one of forty and a failing house losing its
only hull are the same deed at very different weights.

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

Above the line, [`economy.md`](./economy.md)'s rule applies unchanged: the top-tier repair does not
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
immortal may come down and will it. [`immortals.md`](../climbing/immortals.md) is the authority on that
crossing and on how long it can last, which is a matter of breaths. It costs the descending
immortal cultivation condensed over ages, it is one of the few ways an immortal actually
dies, and **it holds for every immortal-grade medicine without exception.** Nothing else
produces one.

**The catalog is [`../../src/data/cultivation/immortal-items.ts`](../../../src/data/cultivation/immortal-items.ts),
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
