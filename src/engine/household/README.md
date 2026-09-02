<!-- tier: 3 -->

# `src/engine/household`

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected
> into a narration prompt.

A match, a household, and what comes of one. Read this before changing anything
in this directory.

## The whole of this directory is a join

**Almost nothing here is a new mechanism.** Marriage and family in this world are
what the existing pieces already imply, and what was missing was a caller. Four
of the five things a match needs were built, argued out in detail, and had
**no consumer anywhere in `src/`**:

| What | Where it already lived | What called it before this |
|---|---|---|
| the price of something singular its holder will not sell | `social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.ts` | the barter verb, for objects only |
| a binding as a settlement, and its `marriage_pact` oath | `social-leverage/what-would-settle-an-account-this-heavy.ts` | **nothing** |
| what walking out of an arrangement costs | same file, `whatWalkingOutOfItCosts` | **nothing** |
| what a line does across a generation | `world/hunting-a-spirit-beast.ts`, `bloodlineTierForChild` | **nothing**, tests aside |
| what a refusal leaves | `social-leverage/what-a-deed-leaves.ts` | combat and leverage |

So the test for anything added here is the one the directory was written under:
**if a rule exists only to make marriage work, it is in the wrong place.** Go and
find the thing that already implies it.

## What a house is actually buying, and it is rarely money

Two axes, and only one of them is a number.

- **The rung.** What a house gives up is what the person carries somebody to,
  which is their own rung. That is the one scale the whole engine prices on, and
  `whatItWouldTake` does the arithmetic unmodified. **There is no price table in
  this directory and there must never be one** - what can be put down is
  `OnTheTable[]`, which carries a label nothing branches on and one number.
  Stones, an art, a manual, a material, a favour owed, protection, a debt
  forgiven, a place found for a sibling, an alliance: all the same two fields, and
  a tenth kind of offer needs no code.
- **The line.** `bloodlineTierForChild` reads both parents and nothing else. A
  line steps down where one parent carries it and the other does not, holds where
  both do, and is gone in three generations. There is no dilution constant
  anywhere in this repo and there must not be one.

Everything a house wants falls out of those two, with nothing authored per house:

| the house's line | what it is short of | what moves it |
|---|---|---|
| held - it has spares | nothing it cannot buy | the ordinary price, met on the one scale |
| wasting, spares left | a carrier for the line | the match itself, and it will price its own decay |
| wasting, **last carrier** | itself | nothing. A present need is a refusal at any figure |

That last row is the insular clan, arriving for free.
`hunting-a-spirit-beast.ts` predicted it in as many words - *"a family whose line
is wasting has a REASON to marry its own, so the world grows insular bloodline
clans"* - and this is the code that makes it so. It is also why people run: a clan
that will not marry out is a clan whose members do not get to choose.

## Three parties, and the disagreement is the content

The head of the house, the parents, and the person are three answers that may
point opposite ways.

- **the house** is answered on the price.
- **the parents** are answered on the **line**, because that is the fact that is
  theirs: a house counts carriers and a parent is looking at their own
  grandchildren. Where there is no line either way they are answered on the gap,
  in `REGARD_BANDS`' vocabulary, and they balk only at the two ends -
  `PARENTS_BALK_AT`, pinned by a test.
- **the person is deliberately not answered here.** Whether somebody can be moved
  is `an-attempt-to-move-somebody.ts`, which reads no faction, no alignment and
  nothing about who either party is, and which already leaves a door open at two
  percent. **A second model of consent would be a second model of consent.**

`onlyThePersonIsLeftToAsk` names the state where both answered parties agree and
the person has not been asked. That is the state that produces somebody running,
and naming it is what lets a caller reach the running path without inferring it.

## No asymmetry, in any direction

**This is a hard requirement and it is checked mechanically.**

Both sides of a match are `APartyToAMatch` - the same type, the same fields, in
both directions. Who proposes, who is proposed for and whose house is asked are
positions in a call, not properties of a person. Two tests hold it:

- the swap test, which runs a match both ways round and asserts the line the
  children carry, the step-down and the price are identical;
- a scan of every identifier and string literal in this directory against a
  gendered vocabulary, which fails on a single occurrence.

## What a match writes, and what leaving costs

Four things, all of which already existed:

```text
the tie        two `spouse` rows, both directions, at SPOUSE_STANDING - the
               constant the world's own household pass already uses
the word       an `oath`, cause `marriage_pact`, held by the person bound
               about the house holding them to it.  Same direction as
               `settleItWithABinding`, so one walk-out function reads both
the roll       a lineage roster is entered `by blood`, which is already how a
               child becomes a member from birth.  It confers no rung
the standing   a fact between two houses, emitted for the register to hold
```

`bound` is a parameter and not a rule, because both cases are real: a match a
house extracted binds the person it was extracted from, and a match two people
wanted binds nobody - and a match that binds nobody writes no oath, so there is
nothing to break. That is the ordinary case and `whatWalkingOutOfItCosts` says so
itself: *"most arranged marriages in this world settle nothing"*.

**Leaving refuses nothing.** The ledger half is `whatWalkingOutOfItCosts`, called
and not reimplemented - the old account reopens at its own weight and its own
date, and a second record opens with `broken_oath` and the leaver's own name on
it. What this directory adds is the part about a roll rather than a record: they
were on it by blood and are not now, so they stand outside the house's own lowest
door, read through `doorsOf`. **A runaway's road and a rogue's road are the same
road**, and the only instrument that moves a bar is a word from somebody high
enough.

It is one implementation for everybody. A player matched by their own house and
running from it, and somebody running from a clan that will not marry out, are
the same call.

## Two routes, and the order of consent is the whole difference

```text
family first   the house answers before there is anything between the two
               people.  A no is an answer to a question and costs nobody.
person first   the two of them arrive with something already made.  A no is
               not declining a proposal - it is taking away a thing that
               exists, and it writes a grudge against the house.
```

**The gate is categorical and must not become a threshold.** It is not that a
refusal after a yes is heavier. It is that an ordinary refusal opens *nothing at
all*: houses refuse constantly and must be able to without accumulating enemies,
or the world fills with records that mean nothing. `aRefusalOpensAnAccount` reads
the route and nothing else, and a test asserts that a `family first` refusal with
everything on the table still writes no row.

What was staked decides how heavy. `promised` is the step that already existed
for a word given first, and the person's yes is exactly what the house overrides.

In play the route is read off the ledger rather than off the sentence: two people
with a tie at `DEFINING_STANDING` or a `spouse`/`lover` row have something between
them, and a house answering now is answering about a thing that exists.

## A family's approval is worth what the family can make stick

The same axis the reprisal layer is built on, arrived at from the other side, and
`canTheyBeMadeToPayForActing` is **called** rather than reimplemented - with the
family in the aggrieved seat and the suitor's own backing as what it would be
acting against.

|  | family that cannot act | family that can act |
|---|---|---|
| **suitor backed / out of reach** | the refusal changes nothing | they can be pressed |
| **suitor unbacked** | a negotiation | elope, or give up |

Three of the four are other people's modules and none is written here:

- **pressing them** is coercion - `resolveAttempt` with leverage on the table. A
  match agreed under threat is a match *plus a wrong*, and the wrong is priced by
  the ledger. **There is no marriage-specific pressure mechanic.**
- **eloping** is running with two people in it and a pursuer who can act. The
  pursuit is the reprisal machinery, the debt is the ledger, the talk is the
  rumour layer, and being unbacked afterwards is what the world already does to
  anybody with no house.
- **giving up** is a real outcome and not a failure state. Somebody who wanted
  this, could not have it, and knows exactly why is the ordinary result of being
  outmatched in a world built on being outmatched.

And the grid runs in every seat: the player can be the strong suitor disregarding
a family, the weak one choosing between going anyway and letting it go, the person
deciding whether to go, or the head of the strong family deciding what to do.

## Whether the person goes along with it is derived, never stored

**No `compliance` number, no obedience axis, no `willAcceptArrangedMatch` flag.**
A field that existed only to answer this would be invisible to anybody reading the
person, and would be a second measure of somebody beside the ones the world keeps.

What already differentiates people is what they **want** and who they already have
a **tie** to, and both are on the roster:

```text
a tie at DEFINING_STANDING toward somebody else   will not have it, hardest
a want the match forecloses                       will not have it
a want the match serves                           goes along with it
nothing of theirs in the way                      goes along with it, and the
                                                  sentence says that is not
                                                  obedience
```

Two people handed the same arrangement answer differently, and a reader of either
one's entry could have guessed - which is the test. `DEFINING_STANDING` is read
from `world/when-somebody-does-not-come-back.ts` and not restated.

## A refusal is a deed

`what-a-deed-leaves.ts` prices any deed at all off what it cost the payer
**against what they had**, and it branches on nothing about what the deed was. So
there is no refusal severity table here. What is supplied is the fraction and the
`promised` flag, and being told yes and then refused is heavier than being
refused - which that module has said since before anybody thought about marriage.

**Not every refusal opens an account, and that needs no constant.** Somebody who
put nothing down and had been given no word has lost nothing, so there is nothing
to record. Somebody who put down something singular, or who had been told yes,
has. Both facts are already on the table in the negotiation.

## A child

The far end is entirely `engine/birth/`. **A child of a match enters through that
path and not a parallel one**, so nothing here writes a birth, a placement or a
rung - `birth.ts`'s first contract rule is that an origin buys inputs and never
rank, and a child of a match is subject to it exactly as anybody else is.

What was missing is the near end, and it is three answers:

- **What the years cost**, and there is no new clock and no penalty. A decade
  spent raising somebody is a decade not spent cultivating, and the time-skip
  primitive already charges for time. What this adds is the honest reading:
  `years / lifespanForOrdinal(their rung)`. **The same twelve years are most of a
  mortal-band life and a rounding error at the top of the ladder**, which is why
  houses at height have generations and a thin-county family has one child who
  works. Nothing was authored for that; it is what `realms.ts` already says.
- **Whose the child is**, read off `intakeRouteOf` exactly as `birth.ts` reads it.
  Two lineages and the child is of both, and **the name is then a thing the two
  houses settle** - the engine says so rather than defaulting, because a default
  there would be a rule about which parent counts.
- **What they carry**, from `bloodlineTierForChild`, called and not copied.

`YEARS_BEFORE_A_CHILD_CAN_BE_PLACED` is `CULTIVATION_BEGINS_AT_AGE`, re-exported
rather than restated. A shorter stretch is not refused - it is reported as what it
is, which is a child somebody else finished raising.

## Putting a favour on the table

`aFavourOwedPutOnTheTable` is four lines and it closes the gap the ledger's credit
side has always had: an obligation owed **to** somebody was a scoreboard entry
that could never be spent. A word is worth the rung of whoever owes it - the
pricing module's own header says so - and it is singular, because a word from one
named person is spent once.

That is what makes the rogue case work. Somebody with no house has no ordinary
route to place a child or to be taken seriously in a negotiation, so **a favour is
the only road**, and it is finite, and spending it here means not spending it on
their own advancement.

## Related

- [`../social-leverage/README.md`](../social-leverage/README.md) - the resolver
  that answers whether a person can be moved, and the pricing this directory uses
- [`../birth/README.md`](../birth/README.md) - what a child is, and the roll they
  are born onto
- [`../world/hunting-a-spirit-beast.ts`](../world/hunting-a-spirit-beast.ts) -
  `bloodlineTierForChild`, and the argument for why a line wastes
