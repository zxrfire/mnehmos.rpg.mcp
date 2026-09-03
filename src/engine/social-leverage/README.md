<!-- tier: 3 -->

# Working On A Person

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected
> into a narration prompt.

A cultivator should be able to work on a person the way they work on a wall, and
it should sometimes be ugly, because this is a world with demonic sects in it.
This directory is the mechanism: seduction, bribery, deception and threat as one
resolver with real odds, real costs, and marks that outlive the moment.

Read this before changing anything in `src/engine/social-leverage/`.

## Why it is not in `engine/social/`

`engine/social/` is **storage**, and its charter forbids three things this
directory needs: scoring, weighting, and reading the ladder. So the two sit
side by side. This one decides; that one remembers. Every record produced here
is written in `social/`'s own types - an `ObligationInput`, a `Relationship` -
and nothing here persists anything itself.

```text
engine/social/            what the world remembers.  No scores, no ladder.
engine/social-leverage/   what happens when somebody tries.  Both.
```

## Five outcomes, and the fifth is a proposal

`resolveAttempt` returns `taken`, `turned`, `countered`, `refused` and `reported`.

**`countered` is the one that took longest to arrive and its absence was load-bearing.**
Above the cash line this world does not sell things, and what moves people instead is a
favour owed, another singular thing, an oath or a name - every one of which is a
*negotiation*. A resolver whose only failure states were *no* and *no, and they told
somebody* had nowhere to put one, so a player who found the right holder of the right object
and put down the wrong thing got the same sentence as somebody who had insulted them. The
whole barter tier was unreachable in play while the refusals correctly named what would have
worked.

It fires on one condition and needs no new input: `theyWantSomethingFromYou`, a term this
resolver has priced since it was written. Somebody with an open want the person in front of
them could move does not close a door - they say what they would take. It leaves **nothing**
behind: no grudge, no tie, no report. Being told a price is not being refused, and a
counter-offer must never make asking again harder.

## What it would take, and the one model of what somebody needs

`what-somebody-would-take-for-a-thing-they-will-not-sell.ts` prices a barter-tier trade. Two
rules and neither is negotiable:

- **There is no list of currencies and there must never be one.** Everything on the table is
  asked one question - *how high does it carry the person receiving it?* - and nothing
  anywhere branches on what kind of thing it is. A tenth acceptable medium needs no code. The
  test walks ten media the module has never heard of and asserts they resolve identically.
- **A trade that lands moves the row; it never copies one.** The completed trade goes through
  `transferPossession` in `engine/world/possessions.ts` - the same function `immortal-world.ts`,
  `legacy.ts` and the repair dose use - with `transfersOwnership`, because a house that sold a
  thing does not still own it. The first version inserted a pouch row and left the shelf alone,
  so the same house could be traded with twice and the world **manufactured** a heaven-grade
  pill out of nothing. That is not untidiness: the legitimate supply of top-grade material is
  empty as arithmetic (2373 deaths over six seeds and forty years, none at the heaven band or
  above), so any duplication is the entire supply. `items.md`'s *"it is worth it exactly once"*
  is enforced here rather than described. **The provenance link is the point, not the
  bookkeeping** - the house it came off, the day, and the terms - because an object that arrives
  with no history is the signature of something stolen.
- **This directory cannot answer what somebody NEEDS.** That is
  `engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.ts`, which reads goal rows and
  derives urgency from the settling and lifespan clocks. `howTheyAreHoldingIt` takes *its*
  return type as an argument and is the only way to build the holder's side, so there is no
  second reading of a goal row here and no way for the two to drift. **A present need is a
  refusal at any figure; a reserved one is a price you have not met.**

## The rule this directory was most at risk of breaking

`src/web/actions.ts` states it:

> `intent` is a free-ish label, and it is safe precisely because NOTHING in the
> engine branches on it to decide an outcome. The moment a line of code reads
> `if (intent === 'bribe')` to pick a result, the design has failed.

**No function in this directory has ever seen the player's intent string.** What
it reads instead is `Approach.leverage` - the existing closed enum in
`schema/cultivation.ts` saying what is actually on the table - to which one
member was added: `attachment`, alongside `coin`, `favour`, `debt`, `name`,
`sect`, `force` and `secret`.

That single enum member is the whole of the schema change, and it is what makes
this not-bespoke. Seduction is priced by the machine that already prices a purse
and a threat. Take the leverage away and there is no seduction system left over.

## Charm works everywhere. The fallout is what differs

The design owner's ruling, and the load-bearing sentence for the whole
directory. `an-attempt-to-move-somebody.ts` reads **no faction and no
alignment at all**: a righteous elder, a demonic cultivator and a free-port
factor are resolved by the same function against the same terms, and there is
nowhere in this world somebody cannot be asked. A test pins it.

Everything that varies is downstream, in `what-a-house-will-do-about-it.ts`,
and it asks two questions that are **allowed to disagree**:

| | will it back you running one | what it does when done to one of its own |
|---|---|---|
| **righteous** | forbidden, for the channels that use a person | takes it up. One person's account becomes the house's |
| **demonic** | supplies it, and may have set the task | prices the member. You were moved and did not notice |
| **neutral** | prices it against the exposure | collects it. Leverage, not vengeance |
| **no house** | tolerated - a wanderer answers to nobody | nothing |

A righteous house refusing is not a moral gesture. It is a rule with a price: a
righteous cultivator running one is doing it *without their house*, which means
no leverage supplied and a second exposure waiting.

## What a purse is worth

`stonesOffered` was a documented field on the resolver's own contract that
nothing in `oddsOf` read. A bribe named a sum, was refused without one, and was
debited on a take - and the sum changed nothing about whether it landed. That is
the softening the agency rule forbids, in its most invisible form: the player
believes they bought something and the world's answer was identical either way.

The `purse` term is three constraints and no fourth:

- **Priced against them.** `earningsPerYear(subject.ordinal)` - the same income
  curve the world seeds every purse in it from - so a hundred stones is a year of
  a gate guard's life and a rounding error to an elder, and what a sum is worth
  is asked once and answered in one place.
- **Saturating.** `years / (years + PURSE_HALF_AT_YEARS)`. A year of their own
  income is half the ceiling, ten years is 0.9 of it, a thousand is 0.999. Past
  a point the problem is not the price.
- **Reaching only as far as money reaches.** `PURSE_REACH` damps it by the ask:
  full weight on `a_courtesy` - the seat in a queue, the look the other way, the
  introduction, the release from a house - and one twentieth on `a_betrayal`,
  which is a door left open rather than a price. `docs/world/things/items.md` holds the
  line this sits under: above a certain kind of thing, cash is not the medium at
  all, and no figure changes that.

`PURSE_MAX` is 0.2, deliberately under one realm of standing and under a tie at
full strength. Money is a term and it is never **the** term.

## The ground is a term too, and it is the one that is only half wired

The design owner's ruling:

> And the trust system, it should also depend on WHERE YOU ARE. a righteous sect's town
> is much easier for you to trust in than a demonic sect town.

`ground-trust.ts` is that term. Measured before it existed, with one sentence put to three
people on one seed: the odds breakdown was term-for-term identical on a righteous house's
ground, on a demonic house's ground and in a town the register carries with nobody's name
against it. **The same stranger saying the same thing was worth the same everywhere in the
world.**

**It is not an alignment table**, and that is the whole of the design. The question asked is
not what kind of house holds the ground - it is what that house DOES when somebody is
wronged on it, which is `whenItIsDoneToOneOfOurs` and is called rather than copied. So the
axis is recourse, the reach table is keyed on `HouseResponse` and not on an alignment, and a
fourth alignment tomorrow changes that one function and this one inherits it.

That also settles the ordering, and it is the catalog's rather than anybody's taste:

```text
taken_up                  a house, and it answers for you             +GROUND_MAX
collected                 a house, and it records                     +a quarter of it
the_record_does_not_say   the record leaves it open                   nothing at all
unheld_inside_a_province  no address for this ground; the apparatus
                          that makes addresses is a few days away     -a quarter of it
the_member_is_priced      an address that will not answer             -0.6 of it
none                      nobody answers for anything. The floor      -GROUND_MAX
```

**A VACUUM sits below a demonic house**, because `THE_BLOWN_GROUND.whatItMakesTrue`
argues it at length: the neighbours tolerate houses that eat their own disciples because
those houses answer a letter, keep a compound at a fixed address and can be arbitrated
against. Recourse is the axis and a demonic house is a correspondent.

**But that argument is about a vacuum, not about unheld ground generally**, and reading it
as the latter was a real defect. `GroundHolding` resolves FOUR answers and its own docstring
says they are not interchangeable - *"`unrecorded` ... is NOT the same as unheld, and a
caller that treats it as such has invented a vacuum out of a missing row"*. `theGroundUnderYou`
passed only `ranked: holding === 'held'`, so three of the four collapsed onto the floor:
The Blown Ground and Scarwater produced a byte-identical `why` and identical weights, and
Scarwater is a ford town inside a province with a survey, a bench, a Ledger and an assay
house. **Measured on a seeded world: of 435 people alive, 204 stood on ground that is not
held and every one of them was priced as eleven days of sand - 113 of them on ground the
record merely does not describe.**

The ordering extends the catalog's own argument rather than inventing a scale beside it.
What a piece of ground buys a stranger is *an address that can be made to answer*, and the
six rows are how much of one there is. `the_record_does_not_say` is not on that scale and
prices at **zero**, because a missing row is not evidence - the same ruling `AttemptInput.where`
already makes one level up, where a caller that does not know where it is weighs nothing.

### The same fact read from the other end: a threat

The design owner, asked whether the sign should flip:

> I agree, the more lawless somewhere is, the more credible the threat.

**One property read two ways, not two properties.** Recourse is the axis in both cases and
what changes is who it protects:

| | the question | nobody answers, so |
|---|---|---|
| **trust** | if this person lies to me, would anybody make them pay? | their word is worth less |
| **a threat** | if this person does what they promise, would anybody make them pay? | the promise is worth more |

**It keys on the LEVERAGE, never on a verb.** `force` is the enum member meaning *the credible
ability to take it*, and it is the same field the world simulation already fills for every
manoeuvre any NPC runs - so this is one rule through one resolver for the player and everybody
else, and a verb added tomorrow that puts force on the table gets it with no code. There is no
branch on `coerce` anywhere and there must not be one.

**And the threat reading is not the trust reading negated.** Two rows land where a mirror
would not have put them:

```text
                          trust    a threat
taken_up                  +0.12      -0.12
collected                 +0.03      -0.03
the_member_is_priced     -0.072     -0.024
the_record_does_not_say        0          0
unheld_inside_a_province  -0.03     +0.018
none                      -0.12      +0.12
```

- **The alignment distinction largely collapses.** `the_member_is_priced` is a ruling about a
  house that will not avenge a member who was *outwitted*, and being outwitted is not what a
  threat is - the same file calls a demonic house "dangerous to belong to and not only to
  cross". A body that holds ground and can be crossed deters force about as well as any other,
  so it sits beside `collected` and stays NEGATIVE. What matters to somebody weighing a threat
  is whether anybody holds this ground at all.
- **Scarwater is not the mirror of Scarwater.** The un-appointed keepers of an unheld ford have
  more reason to move against violence - it is exactly what stops the road working - than to
  vouch for somebody they do not know, so it is worth less to a threatener than it costs a
  stranger.
- `the_record_does_not_say` is zero in both directions, for the same reason in both: a missing
  row is not evidence either way.

**The tie damper is trust's alone.** What makes a threat credible is what would happen to the
person making it, and thirty years of acquaintance does not change that.

**Still a term.** `GROUND_MAX` is one number for both readings - two caps would be two designs -
and the odds floor and ceiling are untouched. Lawless ground makes a threat more credible and
never certain.

**`secret` is the open question** and is deliberately left on the trust side rather than
guessed at. Blackmail is a promise to speak, so lawless ground should make it more credible;
against that, what a secret is worth is the damage disclosure does to standing, and where
nobody is on a register there is less standing to damage. The owner has not been asked.

`GROUND_MAX` is 0.12 - under a realm of standing, under a tie, under a purse and under a
disposition - and the term is damped by whatever tie the subject already holds, because the
ruling is about a STRANGER. Somebody who has known you thirty years reads you the same in a
market town and in a demonic house's forecourt.

Where it comes from is `engine/world/ground-holder.ts`: the `controllingFactionId` column
walked up the containment chain, then `PREFECTURES` in the region catalog - which carries
`seat`, `places` and a `heldByFactionId` documented in place as *"null is a real answer...
ground the record carries with no name against it"*, and which **nothing in `src/` had ever
read** - then the region's own `politics`.

### It binds the world and not yet the player, which is half a feature

`the-world-changing-on-its-own.ts` fills `AttemptInput.where` at both of its
`resolveAttempt` calls, so every manoeuvre any NPC runs on any other is now priced on the
ground it happens on. **`GameService.pressSomebody` in `web/game.ts` does not**, and until it
does this is the repo's commonest defect with the arms reversed: a rule that binds NPCs and
not the player. The file was held by another agent when this landed. What it needs is two
lines beside the `theirTie`/`ledger` block already there:

```ts
where: theGroundUnderYou(
    whoHoldsTheGround(world.state.locations, effectiveLocationId(...)),
    statusesInArea(world.state.statuses, world.state.locations, locationId, day)
),
```

and, for the sentence rather than only the number, `theGround: ground.why` on the
`whatTheAskCameTo` call - `saying-what-an-ask-cost-and-how-likely-it-was.ts` already names
the term in the mechanical channel without it.

### And the player is never told which ground they are standing on

The other half, and the worse one, because the term is already moving the player's odds off
a fact the game will not say. `whoHoldsTheGround` has two callers in `src/` and both are in
the NPC simulation; the played `look` never asks it and `ask` does not route to it. Measured
on a fresh run, which opens at the Meet on **The Blown Ground** - so a player stands on the
one province in the world nobody holds, on turn one, and cannot find out:

```text
"I ask who holds this ground"   an NPC, and the resolve failed: "a sentence with a hole in it"
"who holds this ground"         `destinations`, which answered with the realm ceiling
"whose ground is this"          the same
"who is in charge here"         `sect`, which answered about the PLAYER's affiliation
"who do I complain to here"     unclear
```

[`web/ground-holder-lines.ts`](../../web/ground-holder-lines.ts) is the answer, built to the
shape of `ground-status-lines.ts` beside it: it volunteers where nobody holds the ground and
answers whichever of the four it is when asked, and every reading names a route out of being
wronged rather than only carrying a lower number. **It has no caller yet** - the two it needs
are in `game.ts` and `actions.ts`, both held elsewhere - and the hunks are with the
coordinator.

## Two people at the same rung of the same house are not the same door

The design owner's ruling:

> some people are greedy some generous, this should be part of their character -
> **kind elders exist just as greedy demonic cultivators exist.**

The second clause is the constraint, and it is a constraint on the model rather
than a note about flavour. **Disposition must not be predictable from alignment.**
The righteous/demonic axis in this world is about method and permission - see the
table above, which is entirely about what a house supplies and what it takes up -
and it is not about being nice. A model that let a demonic robe imply a tight fist
would flatten the most interesting thing about the setting into a colour code, and
it would do it invisibly, because every individual result would still read
plausibly.

`how-freely-somebody-parts-with-what-they-have.ts` is the whole of it, and it
takes **a person's id and nothing else**. There is no parameter through which an
alignment, a faction or a rung could reach it. What comes back is one number on
-1..+1, triangular, so most people are ordinary about this and the ends are
uncommon without being absent.

**Nothing switches on a personality, because there is no personality to switch
on.** AGENTS.md forbids enumerating what NPCs do, and greed and generosity are an
example of a disposition rather than the set of them - so the shape has to be one
where a tenth kind of person costs no code. The inversion that gets there is to
stop asking *what kind of person is this* and start asking *how heavily does what
a thing costs them weigh with them*, then multiply. A tenth kind of person is a
different number with a different sentence beside it.

The `disposition` term is shaped like `purse` and for the same reason:

- **Drawn from the subject when the caller does not supply it.** `Party.openHandedness`
  is an override, not the source. Two callers reach `resolveAttempt` - the played
  game and the world simulation - and a field either could forget is a field one
  of them will forget.
- **It discounts cost, not danger.** `AskWeight` runs two quantities up one scale:
  what a thing COSTS them at the bottom and what it RISKS them at the top.
  Generosity is about the first only, so `DISPOSITION_REACH` peaks at
  `a_real_favour` and falls to a tenth at `a_betrayal`. A generous person hands
  over the book; a generous person is not one rung likelier to end their own
  standing.
- **`DISPOSITION_MAX` is 0.18** - over half a purse, because who somebody is
  should outweigh what a stranger happens to be carrying, and under both a realm
  of standing and a tie at full strength, because otherwise the world turns on a
  coin the player cannot see.

**And it has to be visible, not only arithmetic.** A term in an odds breakdown is
legible to somebody reading the mechanical channel and invisible to somebody
reading the sentence, so the module also owns two readings of the same number:
what somebody is like, said among the facts before the outcome, and what a no from
*this* person is like, said in the refusal. Measured in a played run, two neutral
Standing Grants at the same rung in the same town, asked the same thing on the
same day by the same cultivator, came back at **8 in a hundred against 2** - and
the engine channel said why, term by term: *"how freely this particular person
parts with things added 9 points"* against *"cost 11 points"*, with every other
term identical.

## The four outcomes

Two is not play.

```text
taken     they did it, and the tie or the obligation is real
turned    they did it AND took hold of you.  The bribe that buys somebody
          who then owns you back - a debt written the other way
refused   they said no, and now they know what you tried
reported  they said no and it reached their house
```

## Romance and using somebody are the same move until the numbers diverge

The tie written is **directed**, because `relationships.ts` is directed, and the
asymmetry is the entire mechanic:

- **their** side grows every time the attempt lands
- **your** side grows *only when you asked for nothing*

So a player who keeps coming back without wanting something ends up in a mutual
tie, and a player who does not ends up holding a strong one-way attachment they
can spend. The difference between courting somebody and working them is whether
you ever came back empty-handed, and it falls out of the arithmetic rather than
being declared anywhere.

## Being turned down and being found out are different injuries

`an-attempt-to-move-somebody.ts` writes refusals at `slight` or `serious` and
**can write nothing heavier**. Everything `grave` and `unforgivable` is written
by `when-somebody-works-out-what-you-did.ts`. That gap is the design.

The discovery is its own dated event with its own roll, because the years in
between are years the player spent believing it had worked cleanly. It can
never fire: somebody dying still attached and still wrong about it is a
legitimate outcome and the commonest one.

The consequence layer is `grudges.ts`, unchanged - the aggrieved party holds it,
the way `combat-manage.ts` writes a feud, and it is inherited on death like
everything else in that ledger.

## Both halves of the game

The repo's commonest defect is a system that binds every NPC and never reaches
the played game, or the reverse. The same resolver runs on both:

- **the player** - through `GameService.interact`, which before this returned
  `outcome: 'refused'` and *"Attempt recorded; outcome not resolvable yet"* for
  every approach ever made.
- **the world** - `leverage_applied` and `leverage_understood` in
  `world/the-world-changing-on-its-own.ts`.

`scripts/probe-does-anybody-actually-work-on-anybody.ts` is the guard on the
second half, and it earned its place: it found **four** separate gates that each
independently held the world's rate at zero, none of which any test caught.
See that file and the comments at the two templates.

## A fight two people arranged is the same shape

The directory's charter is *what happens when somebody tries*, and it is not
only about persuasion. `going-further-than-an-agreed-bout-allowed.ts` answers
the same question for a spar, a duel, a challenge - and it obeys the same rule
as `an-attempt-to-move-somebody.ts`, in the place that rule matters most.

The design owner's ruling, from AGENTS.md:

> **Kill somebody during an agreed bout and you will obviously face
> consequences.**

Nothing stops you. The bout runs through `resolveConfrontation` with the same
goal, the same exchanges, the same wounds and the same death gate a killing
runs through, and there is no path anywhere by which the word "spar" changes
what a body suffers. **The wound was identical. The meaning was not**, and the
whole of the difference is a downstream table in this directory.

|  | crippled | killed |
|---|---|---|
| **open terms** | `serious` | `grave` grudge |
| **agreed terms** | `grave` | `unforgivable` **blood feud**, and standing off the actor's own house |

Three things about it are load-bearing:

- **`terms` is a closed value set by the parser**, beside the verb, exactly the
  way `Approach.leverage` is - so nothing here has seen the player's sentence,
  and `combat.ts` and `combat-manage.ts` mention neither the type nor the
  module. A test reads both files and requires that to stay true.
- **An arrangement names the actor on its own.** The dead one's people know who
  they went to meet, so an empty courtyard is no protection and the account
  opens at full weight with nobody watching. That is why there is no
  body-on-the-low-road line here and why witnesses only price what the actor's
  own house has to have a position on.
- **It writes the record the loser's PEOPLE hold, and never the loser's own.**
  `seedObligations` in `cultivation/combat.ts` owns that one and is unchanged.
  For a killing it correctly writes nothing - the dead hold nothing - and the
  mistake was that nobody else was ever asked.

### And "their people" means their family as well as their house

The mistake above was half-fixed for a while, and the half that was missing was
the commonest case in the world. `theirHouse` was the only party this function
was ever told about, so a killing outside a ranked house opened **no account
with anybody**. Measured by playing, on a pinned world: a cultivator killed two
people in front of eight witnesses and the `obligations` table held **zero
rows**, while `interact` opened one for a robbery every single time. The world's
own report of the same killing named an heir on the way past.

So the heaviest thing a player could do to somebody was the one thing that left
nothing on the ledger. That is the agency rule's *softening* in its most
invisible form, and it is worse than the visible kind: the player believes they
made a choice and the world silently declined to charge them.

`theirPeople` is the fix and it is `whatADeedLeaves`'s own field arriving one
module earlier - *heavy, and they have people: their family carries it at the
same weight*. Four rules:

- **Only where the loser died.** That is exactly `principalCannotHoldIt`: the
  dead hold nothing, so an account that would have been theirs has nowhere else
  to go. Somebody ruined and living already holds their own from the resolver,
  and whether their brothers hold one too is a separate ruling.
- **The family imposes no floor.** `severityWithHouse` raises a floor an
  INSTITUTION imposes. What the brother holds is exactly what the table said the
  deed was worth, and the table is still the only place severity is decided.
- **Both kinds of party at once.** `heldBy` names the house and the people
  together, at one weight, because `grudges.ts` is explicit that inheritance
  does not discount.
- **Somebody with nobody still leaves nothing**, and that stays reachable. It is
  the cheapest killing in the world and it is a fact about who they were rather
  than a discount to whoever did it.

### And a war death is the same event, because it goes the same way

This was written down here as an absence first - *a war death leaves an
inherited tie in `WorldState` and never an obligation row* - and the design
owner's ruling on the absence was the right one:

> this is bespoke. a war death is still a grudge. fix it.

**And the reason it was bespoke is the reason to read this paragraph.** Both
paths already met: `war-melee.ts` and the played killing both write their dead
through `whatTheConfrontationDidToThem`. What differed is that **each caller
assembled the ledger rows itself**, so only the one somebody had got round to
writing had any. A world could fight for five hundred years and the ledger would
not contain one of its dead - which meant the world was full of killers no
record knew about, and the reading in `personal-alignment.ts` was measuring the
player alone.

So the assembly moved into {@link theAccountsAFightOpens}, beside the decision
it renders, and both callers hand it the same `WhatFollows`. **A war is
`terms: 'open'` and needs no special case to be so**, because this directory's
own definition is that open is *the absence of an arrangement, not a declaration
of hostility* - and two houses at war have promised each other nothing. Every
rule above applies unchanged: only where the loser died, no floor from a family,
house and kin at one weight, and somebody who left nobody leaves nothing.

**The rows come out rather than going in**, because there is no obligation
ledger in `WorldState` - the layer hands social rows to its caller the way it
already hands back estates and heirs. They travel on `PressureEvent.opens`, out
through `PlayAdvanceResult.accounts`, and are written in
`advanceWorldForCultivator`, which is where they must be: **two front doors
advance a world**, the played turn and the MCP tool that `ADMIN advance_days`
runs through, and writing it in the web layer left the operator surface silently
not writing. That is exactly how the first attempt was found to be wrong.

**Measured before it was wired**, because a tick writes at scale: over five
hundred years on two seeds, 118 and 105 war dead leaving 154 and 148 rows. The
ledger holds a world's worth of war dead without noticing. Played over three
hundred years afterwards: **202 rows off 111 deeds** - 1.8 rows per death, which
is the dedupe working - 160 `grave` and 42 `serious`, and **39 people on the
ledger as killers of whom 20 read demonic**.

**One consequence worth watching.** A war now ends with a generation of people
holding something against each other's houses, which is either the best thing in
this directory or unmanageable, and only a long soak will say which. What it is
NOT is free: a house that fights for a century is a house a great many people
have an account with, and `whenItIsDoneToOneOfOurs` already routes those to the
institution.

## Reading order

```text
an-attempt-to-move-somebody.ts          the odds, the four outcomes, the marks
how-freely-somebody-parts-with-what-they-have.ts
                                        one number per person, from their id and
                                        never from their house
what-a-house-will-do-about-it.ts        the alignment split, entirely downstream
when-somebody-works-out-what-you-did.ts the delayed discovery and its grudge
going-further-than-an-agreed-bout-allowed.ts
                                        the same job for an arranged fight
what-a-deed-leaves.ts                   any deed at all, in either direction,
                                        priced by what it cost rather than by
                                        what it was called
what-would-settle-an-account-this-heavy.ts
                                        which of the ledger's own discharges a
                                        record can afford, and what walking out
                                        of an arrangement costs
what-a-house-does-when-it-catches-you.ts
                                        the three axes of a reprisal, in the
                                        order that makes them separable
personal-alignment.ts                   what a PERSON is, off the ledger of what
                                        they have done rather than off whose
                                        roll they are on
being-hunted.ts                         which of the people holding something
                                        against them can use it, and which have
                                        only written the name down
```

## A person's alignment is a question about their ledger, not a field on their house

The design owner:

> you should be able to get to 44 using plain english, as a neutral, righteous, or
> demonic/evil cultivator.
>
> also note that these are independent of techniques - you could cultivate a righteous
> sect's technique and be evil, you'd just be hunted down (or too powerful for them to
> touch you)

`SectAlignmentSchema` is a field **on a sect** and it stays there. What was missing is that
a PERSON had no alignment anywhere at all: `web/game.ts` reads one in six places and every
one of them is `mySect?.alignment ?? null` on a `Party` - all six correctly asking a
question about a HOUSE, and none of them a statement about the person. So a cultivator was
whatever their roll was, and a cultivator on no roll was nothing whatever.

`personal-alignment.ts` is the second, different source for the same three words when the
subject is a person, and **it is derived rather than stored**, on the same argument the
shelf-against-roster reading makes about a house: *where a person sits is a question, not a
property*, and what somebody IS changes every time they do something.

**The axis is not this file's invention.**
`data/cultivation/demonic-sects-and-what-they-are-willing-to-do.ts` already answers what
makes a demonic body demonic, and its answer is **who pays, and did they agree** - stated in
the same breath as *not cruelty, not power, and not how much the province dislikes them*.
`docs/world/houses/asking.md` gives the other half: the axis is about **method and
permission**, and is not about being nice. Both of those are already two fields on a deed -
`Deed.paidBy`, and the fact that a thing taken out of a person is a thing they did not hand
over - and the ledger has already written that direction down in a word:

```text
favor                 held BY the person who paid.  They bore it, for somebody else.
grudge / blood_feud   held ABOUT the person who took.
```

So the reading is a kind and a severity and nothing else. It does not read a cause
(`grudges.ts`: *if you ever find a switch on one of these values deciding an outcome, that
switch is the bug*), and there is nowhere in the signature to put a faction, a rung, a realm
or a technique - the same shape `how-freely-somebody-parts-with-what-they-have.ts` uses to
keep an alignment out of a disposition, and the reason **practising a house's art makes you
nothing**. `unauthorisedPractice` and `ifCaughtPractising` remain what they say they are:
questions about permission, checked and unchanged.

Four rules, and each of them was a decision:

- **Righteous is not the absence of wrongs, and no virtue counter was invented.**
  `what-a-deed-leaves.ts` already insists kindness and harm are one scoring function pointed
  two ways *"or the good half quietly becomes decoration"*, so the good side was already
  counted. Somebody with an empty record is **neutral**.
- **It is an ordering, not a net.** Demonic is decided first on what was taken, alone;
  righteous second on what was paid, alone. A murderer who also gives generously is demonic
  and generous. Disposition is a separate axis and stays where it is.
- **Open records only, which is also the road back.** A record leaves the open ledger exactly
  one way - a `Settlement` - so avenged, repaid, compensated, forgiven and proven-false all
  stop counting, and nothing ages, decays or forgives on its own.
- **One deed is counted once.** A deed opens a record for the victim, one per kin, and one
  for the house, and inheritance copies each again. Counting rows would price a victim's
  family size as the actor's character, so rows collapse onto the deed behind them.

`WHAT_MAKES_IT_A_METHOD` is 2 and is used for both directions, because there is one scoring
function: one `unforgivable`, or two `grave`, or eight `serious`, or forty `slight`.

### And being hunted is a state, derived, rather than a row nothing writes

`being-hunted.ts` is the *"you'd just be hunted down"* half, and it is two of the three axes
of `what-a-house-does-when-it-catches-you.ts` imported rather than restated - can the holder
be made to pay for acting, and are you worth the trouble. Alignment is deliberately not
asked: a righteous house hunts exactly as hard as a demonic one.

**The other half is the interesting one.** A house that would move and cannot gets a
sentence rather than silence - *they have written the name down and there is nothing behind
it* - because a refusal names a route including in reverse, and the record is permanent and
inheritable while the gap is not.

What it replaces: `Cultivator.feuds` is a stored JSON array with exactly one writer in the
whole of `src/`, on the MCP combat path. Nothing in the played game has ever written one, so
the sheet said *"No one is currently hunting you"* to a cultivator with a province behind
them. That is AGENTS.md's *a field nothing writes* exactly - not inert, reading as a value.

## A house's answer is a question about its deciders, not a field on the house

The same move as the section above, one rung up, and the design owner's ruling is that it
generalises past sects:

> the thing about sects applies to every organization. Sects are an amalgamation of what
> their upper echelon thinks. same for families, some can pressure or sell off their
> daughter, some won't. the same system should apply for free, based on character traits,
> motivations.

**An institution has no preferences of its own.** `what-a-body-wants-is-what-its-deciders-want.ts`
takes a body's roll and its ladder and answers with what the people who decide in it want.
There is no column saying whether a family sells its daughters and there must never be one -
a flag on a family row is the exact thing the ruling forbids.

**A sect's elders and a family's seniors are one type and one call.** A family here is a
faction whose roll is entered by blood (`intakeRouteOf` answers `adoption` for seven of
thirty-four), on the same ladder, with the same two fields on its members. A second
aggregation for families would be the defect this module exists to remove.

### Two terms, because a baseline nobody can move is a council nobody can bribe

    what they are        `openHandednessOf`, drawn from the person's own id.  Present
                         for every decider in every world with no seeder pass, stable
                         forever, and it already spreads a house's elders from -0.61 to
                         +0.65 across the catalog with nothing authored
    what has been done   the obligation ledger between them and whoever is asking.  A
    to them              favour they owe pulls them toward yes; a wrong they hold pushes
                         them away.  Zero on day one and filling through play

Everything good about an id-derived leaning is the same fact as *nothing can ever change
it*, so the baseline alone would have shipped the ruling's point and bolted it shut. **An
empty ledger at world creation is therefore correct rather than a defect** - nobody owes
anybody anything on day one, and a house's answer drifting as its elders accumulate accounts
with a player is the system working. No bribery verb is built: `resolveAttempt` and
`what-a-deed-leaves.ts` already decide what an approach does and what it writes down, and
this only makes what they wrote legible to a council.

**What was measured, and what it ruled out.** The obvious input was `NpcGoal.priority`. Over
a pinned world 240 of 435 people carry a goal row and **not one of the 77 at an elder rung
does** - the seeder writes goals bottom-up and stops at rank 2. An aggregation over goal
priorities would have answered identically for all 34 houses while reading like a working
mechanism. When that is fixed, goals become a second axis by being passed in as `readingOf`,
not by a branch appearing in the module.

### Three tiers, and the third makes it a loop

    the elders       the weighted mean, by `distributeFollowing`'s own seniority weight.
                     Elders can dislike a thing and be outvoted
    the seat         the head overrules it, reserved to them alone, because one elder
                     must not stop a house
    all the elders   and the seat loses it back when it is ALONE - every elder on the far
                     side of them, not a majority

The third tier is not invented. `data/cultivation/immortal-items.ts` already carries a body
holding a power its own head cannot override - `releaseMode: 'collective_consent'`, *a body
decides, and any member can refuse* - and its `RecordedRefusal.refusedBy` is sixty characters
of authored prose rather than a boolean. Two things are taken from it: that a body's
collective answer binds its own head, and that **a refusal names who and why**. The types are
not, and the module says precisely why in its header.

**Nothing here spends anything.** `leadership.ts` owns what an act against the room costs in
standing; the answer reports `against` so the caller charges it in the one place standing is
kept.

### The scalar is the least useful half

A player's problem under three tiers is not what the house thinks, it is **which elder** -
whether they are trying to buy the answer or to become it. So the answer carries
`whoMovedIt`, at their weight, with what their own history did to them.

And the player has to be able to sit in the room. A decider is `{ id, rankIndex }`; there is
no NPC type in the file, no roster and no lookup, so the player's own id goes in the same
shape at their own weight, and at the top rung they get the overrule and become the person
the unanimity tier can overrule. **A caller that resolves deciders through an NPC-only lookup
makes the player a spectator at their own council.**

## A reprisal has three axes and crossing two of them ruins it

`what-a-house-does-when-it-catches-you.ts` asks three questions and the order is the
content:

1. **Can the offended party be made to pay for acting?** Not "who backs you" - naming it
   that way invites a special case for every unaffiliated party in the world. An elder
   inside a house cannot lay hands on an apex's disciple, because their own house pays for
   what they start; so they complain, and the complaint is `Reach: 'answerable'`, which
   `what-a-deed-leaves.ts` already had a field for. **Backing protects you from exactly
   the people who have something to lose, and is worth nothing against somebody who has
   nothing.** What your own house then does is this same function with the parties moved
   along one - the redirect is recursion, not a second mechanism.
2. **Are you worth the trouble?** Read off `REGARD_BANDS` in the one direction that
   matters, the house looking down. `dismissed` is beneath notice and it is contempt
   rather than leniency: a player far below a house can genuinely get away with things,
   and being told so is information about where they stand.
3. **What kind of house caught you?** And this decides the *kind* only. **The magnitude is
   `whatItWasWorth`, and nothing anywhere branches on an alignment name to pick a severity
   number.** Righteous, neutral and demonic do not punish harder or softer than each other.

What a house takes is an investment question and not an alignment one: the years from
somebody worth keeping, the capability from somebody who had one worth removing and is no
use kept, and nothing at all from somebody who is neither. Both answers are available to
every house in the world.

### The first live caller, and what it demonstrates

`selling-a-copy-of-somebody-elses-art.ts` turns a leaked art into an ordinary `Deed` and
`game.ts` hands it straight to the resolver. It is worth reading as the worked example,
because the three axes produce four different scenes from one call and no branch:

| the seller | what the house does |
|---|---|
| nobody could place it | *nobody can put a name to it*, and no account opens |
| one of their own, seen | the capability. They hold nothing the house has not got |
| an outsider, seen | the years. They hold the copy and the account of who gave it to them |
| standing above the house | *there is a record and there is no reprisal* |

The last row is the one the design owner cares about, and nothing produces it deliberately.
Writing an art out takes having mastered it (`couldWriteOutACopy` in `world/manuals.ts`), so
**the only people who can leak a house's signature are the people it cannot touch** - axis 2
meeting a gate in another directory. The account still opens either way, which is what a
house has against somebody beyond its reach and is not nothing.

**Calibration found while wiring it, and left alone.** `beyond_them` needs a gap of four
rungs, so a former peer of a house's own summit - the owner's *"2 people at 44, one is
pissed, leaves"* - reads `stretch` and is still worth mounting against. Whether a house
should be able to answer a peer is `REGARD_BANDS`' question rather than this file's, and it
is reported rather than retuned from here.

## Kindness and harm are the same machinery pointed two ways

`what-a-deed-leaves.ts` is the general case the two files above it are instances of, and
its single most important property is that **there is one scoring function and both
directions run through it.** A favour owed and a grudge held are the same weight computed
the same way. That is not tidiness: above the cash line what moves people in this world is
a favour owed, so a cultivator who gives things away and teaches for nothing accumulates
something genuinely more valuable than money - and it has to be the identical arithmetic,
or the good half quietly becomes decoration.

**Nothing in it branches on what the deed was.** The cause is carried through untouched
onto the record and never read; what the engine reads is who paid, what it cost against
what the payer had, whether it comes back, and whether a word was given first. A tenth
kind of wrong needs no branch - it arrives with a cost. If a `switch` on a cause ever
appears in this directory deciding an outcome, that switch is the bug.

### How far it reaches, and why that depends on who did it

The escalation is standing on both sides and nothing else:

| | the account that opens |
|---|---|
| the person answers to nobody | it stays between the two of them |
| heavy, and they have people | their family carries it at the same weight |
| the house had something invested in them | the house holds one too, and names the actor |
| ...and the actor answers to a house | the house names **the actor's house**. It is now between institutions |
| ...and nobody can be made to answer | `blood_feud`, written to be **carried** rather than settled |

That last row is the long tail: a wrong nobody could answer becomes a family's history
rather than an event, and reaches a descendant who never met the wronged party through
`inheritOnDeath`'s existing provenance chain. **Allies are named on the record and never
made holders** - a house that stands with another can find it from its own side, and the
engine has not decided on its behalf that it cares.

`knownTo` is the field that makes deniability work, and it is not the witness count. A
principal who is not on that list opens **no account at all**, because a grudge is held
against somebody and they have no name to put on it. What still exists is what the people
who were there carry, which is `truth depends on proximity` at its bluntest.

## Related

- [`../social/README.md`](../social/README.md) - the storage layer this writes into
- [`../cultivation/regard.ts`](../cultivation/regard.ts) - where the standing term comes from
- [`../world/manuals.ts`](../world/manuals.ts) - `ifCaughtPractising`, the pattern the alignment split copies
