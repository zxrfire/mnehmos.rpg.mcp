<!-- tier: 3 -->
<!-- no-catalog: a design ruling about how the engine is built, not a description of a catalog -->

# What the genre does, and whether we model it

The tropes this setting runs on, both signs, with what already exists beside them.
Companion to the "Read the genre before you read the sentence" section of
[`../../AGENTS.md`](../../AGENTS.md), which is the rule; this is the list.

Two things govern everything below.

**The engine does not grade, so the list has two halves and they must weigh the same.**
天道无情. A rescue and a killing are both acts with effects. If the generous half of this
document is thinner than the cruel half, or pays off more reliably, the engine has grown
an opinion. Mercy in this genre is a *risk*, not a reward: the enemy you spare comes
back. An engine that makes mercy safe has taken a side.

**Alignment gates the RESPONSE, never the act.** A righteous sect's senior brother can
attempt anything on this page. What differs is what his house does when it finds out -
and a righteous house punishing its own more harshly is already modelled by
`ifCaughtAtSomethingTheHousePunishes` and `whenItIsDoneToOneOfOurs`. There is no branch
anywhere that stops somebody acting because of what they are.

---

## Taking

| Trope | Where it stands |
|---|---|
| **Furnace / cauldron** (爐鼎) - drawing another cultivator off | `an-art-that-needs-two-people.ts` + `furnace-technique.ts`, complete. **THE SENTENCE reaches a coercion; the MECHANIC still has no caller.** This row used to say "Reachable now via `coerce/furnace`" and that was measured false: `COERCION_INTENT_PATTERNS` does route the phrasing, and `CoercionIntent` in `how-a-player-says-each-coercion.ts` holds only `submit | hand_over | talk | tame | swallow`, so `combat-verbs.ts` acts on `hand_over` and `swallow` and prints the rest as a label. `useFurnaceTechnique` has zero importers in `src/`. What is reachable is a submission with the word furnace written next to it. |
| **Primal yin / yang** (元阴/元阳) - taking what somebody has only once | Not modelled. The shape it should take is now built once, next door: `physiques.ts` is this ruling carried out, and a one-time thing beside a person is the same shape as a permanent one. It is a PROPERTY OF A PERSON, not part of any one act: a one-time thing they either still hold or do not. It does NOT require a furnace rite - a forced marriage takes it, a willing wedding night takes it, the furnace art takes it and converts it. So it belongs beside the person and is read by whatever consumes it, never owned by the module that happens to consume it most. Making it a furnace field would be the bespoke version. |
| **Special physique** (体质 / 灵体) - the body somebody is BORN as | `engine/cultivation/physiques.ts`. **Modelled now.** The same ruling as primal yin above, carried out: a property of a person, read by the cultivation rate, the lifespan ceiling and the furnace draw, owned by none of them, and nothing anywhere branches on which one it is. It is what gives the furnace and primal-yin paths a target with a CAUSE - a body worth crossing a province for - and what somebody carrying it knows about themselves. Reachable both ways: your own on your own sheet, somebody else's only once you have stood in front of them. |
| **Crippling cultivation / taking a core** | Parser reaches it; `attack` and `coerce/hand_over` both route. The core is a realm boundary already. |
| **Forced marriage** | **Reachable now** via `coerce/marry`. Read as `propose` at every tier before this pass - the forcing was deleted on the way in. |
| **Forcing something down somebody's throat** | `coerce/swallow`, already there. |
| **House extermination** (灭门) | See "Acts over a set" below. This is the reachability question, not a new verb. |
| **Body snatching** (夺舍) | Not modelled. Sits directly on the permadeath rule and should be designed against it rather than beside it. |
| **Soul search** (搜魂) - tearing memories out, usually destroying the person | Not modelled. A read verb with a body count. |
| **Slave seals, soul contracts** | `seal` exists as a verb; binding a person's obedience does not. |
| **Blood arrays** - many mortals spent for one cultivator's gain | Not modelled. **Distinct from a sacrifice technique**, and the distinction is the design owner's: an array spends people who are simply *there*; a sacrifice technique requires FORCED CULTIVATION - the subject has to be made to cultivate, which is the furnace path with a different ending. Mortals are ordinal 0 and already exist. |
| **Corpse refining** - bones and remains into weapons, pills, puppets | Remains-as-objects is anticipated by `ground-that-teaches-a-road.ts`. The making is the crafting surface's problem. |
| **Face-slapping** - public humiliation | The grudge ledger already models the return. Whether the humiliation itself is reachable is worth checking. |
| **Stealing an opportunity** - reaching an inheritance first | Sites and trials exist. Whether somebody else was owed it does not. |

## Giving

Each of these must be as mechanically consequential as anything above, and none of them
may be safer for being kind.

| Trope | Where it stands |
|---|---|
| **Karmic debt repaid decades later** | Accounts already span years. A debt is the same row as a grudge with the sign reversed. |
| **Taking a disciple off the street** | The master-disciple tie is the genre's strongest bond and it is a LEVER, not a warm feeling. Check what `teacher` already reaches. |
| **Sworn brotherhood** | `oath` exists. |
| **Giving away a treasure you needed** | `give` exists. What it costs the giver later is the question. |
| **Sparing an enemy** | Must be priced as a risk. If a spared enemy never returns, mercy is free and the engine is rewarding it. |
| **A mortal family sheltering a wounded cultivator** | Mortals exist at ordinal 0. What they are owed does not. |

## Acts over a set

Design owner's ruling, and it is the general rule for every set-shaped sentence -
"everyone here", "his family", "the whole sect":

> The act **completes over the reachable subset**, and the turn says what it did not
> reach. It is not refused, and it is not silently truncated.

The two gates that decide reachability already exist and neither is moral:

- **Co-location.** `attack` requires the target to be present.
- **Discovery.** You can only name somebody you have heard of.

So "I exterminate his family" kills the ones you know of who are standing there, and
the rest live - because you do not know where they are and you are not there.

**And the remainder is gated by the same knowledge the act was.** The design owner's
correction to an earlier draft of this section, and the part that makes it honest: *you
may not know what it did not reach.* Somebody who knows of four cousins and kills one can
be told about the other three. Somebody who knows of none is told nothing - and does not
find out whether they finished. Compute the remainder against what this cultivator has
heard of, never against the world. A count taken from the world hands somebody the census
their own ignorance was supposed to deny them, inside a sentence about a killing.

The refusal text must not read as moral. *"You cannot do that"* is wrong. *"You know of
four of them; one is standing here; the rest are somewhere in Cloud River territory"* is
right. The remainder is also the better story: the cousins two provinces away now hold
an account and know the name.

### Built, and where each half lives

| | |
|---|---|
| the reading | `theSetThisNames` in [`src/web/acts-over-a-set.ts`](../../src/web/acts-over-a-set.ts). Pure, over the words. Four ways of naming a set - the square, somebody's own people, a house, a rank - and one expansion behind all four, because a branch that fires for families and not for other sets is the mistake this ruling exists to prevent. |
| the gates | `theSetAsThisCultivatorKnowsIt`, same file. The two that already exist, as predicates: `isPresent` is co-location and `hasHeardOf` is `knowledge.ts`. Presence is its own discovery for the square and nowhere else - a face you cannot name is still a face you can swing at. |
| the remainder | `whatTheActDidNotReach`, same file, and **null is the important return**. `TheSetAsKnown` has no field for the set as the world holds it, which is the enforcement rather than a rule written beside one - the same device as `Sighting`, which has no name field. |
| the act | `attackOverASet` in `combat-verbs.ts`, which runs each reachable member through the ordinary single-target `attack` against the world the member before them left, and stops where the world stops it. |

**It is one costly act.** `a-sentence-can-be-more-than-one-call.ts` spends at most one a
turn and asks which comes first where a sentence holds two; the expansion happens in the
engine, after the plan is fixed, so the budget sees a single `attack` step whose target is
a description and nothing in that law changes. The reason it should be one is
`oneClauseIsOneAct`'s: *"which of these six first?"* asks the player to re-say a sentence
they already said as one act.

**A fight is still played rather than reported.** Where a member becomes a contest that is
still standing, the loop stops there, that member is the fight the player is in, and the
rest of the set is named. Where the gap settles a member one-sidedly - the extermination
case - it settles and the loop goes on.

Two things found by building it, both worth having written down:

- **A family cannot produce a remainder on turn one.** `applyHouseholds` puts a household
  in ONE place, so across nine seeded worlds every living kin tie of anybody standing in a
  square was also standing in it. A `kin_of` remainder needs a world that has since moved
  somebody; a house is split by construction and shows the same mechanism today.
- **A relationship row outlives the person on the end of it**, which is what makes an
  inherited grudge possible - and the first version of this reported a woman dead since
  world creation as a member of the family the act did not reach. A corpse is not a person
  the set was ever about, and the filter is `status === 'alive'`, the same one `npcsAt` and
  `npcsInFaction` already apply.

And the vocabulary: *"I exterminate his family"* reached `unclear` while *"I kill his
family"* routed correctly, so 灭门's own words - exterminate, wipe out, slaughter,
massacre - are now in the attack table. A reader that can say the one-person version of an
act and not the many-person version has taken a side.

Played on a pinned world: `tests/web/an-act-over-a-set.test.ts`.

## The dao heart, which is where both halves of this document are charged

**Modelled.** `engine/cultivation/what-a-crossing-asks-of-the-dao-heart.ts`, read at every
realm boundary by `breakthrough.ts` and by every door onto one - the played strike, a
seclusion, a road, a site, the MCP path. Not read by the world simulation yet; see the
cultivation README for why that is a measurement rather than an edit.

心魔 heart demons and 道心 the dao heart are the one place where this document's two halves
meet a number, so they are the one place the *neither half may be safer* rule can be got
wrong invisibly. Two ways to get it wrong, both easy:

- if regret feeds heart demons, sparing an enemy is punished at the next wall;
- if a clean ledger buys a clean crossing, the engine is rewarding virtue.

**So what is counted is not what a deed was. It is whether it is finished** - `status`, a
word the obligation ledger already stores. Cause is not read, direction is not read, and
mercy and revenge close a record equally well: `forgiven` and `avenged` buy exactly the
same thing at a wall, and a test asserts it.

Each road pays in a different currency, and that is what makes them comparable rather than
graded:

| Road | What it costs | Where |
|---|---|---|
| Spare them | an account that weighs at every wall until settled, and CAN be settled | the crossing, and then whatever they ask |
| Finish them | their kin and house hold it instead, hereditary, and `inheritOnDeath` does not discount | the crossing, forever, plus whoever comes |
| Conceal it | nothing at the wall - nobody is a party to a nameless account - and somebody is on the road looking | `theSearchItOpens`, and the day a name attaches it arrives whole |

The demonic-cultivation position is genuinely expressible here rather than being the
punished one: act, finish it, accept it, and the wall has nothing to ask. What it does not
buy is quiet.

**And it is a cost, never a bar.** A heart demon does not halt anybody - only a realm's own
break does. The mechanic makes a wall dearer and closes no road.

## Structure

Neutral furniture, listed so nobody proposes it as new: closed-door seclusion emerging
into a changed world; tribulation at a breakthrough; inheritance trials; life-and-death
bouts; the hidden master in a mundane role; the written-off disciple who was not; an old
weak cultivator beside a young strong one; reputation arriving before you do.


---

## A taking is decided by ownership, not by vocabulary

The design owner's ruling, and it settles a class the parser cannot settle:

> Saying "take" about something that is not yours - and is not genuinely free, like an
> apple in the middle of nowhere - is stealing.

**Measured**, against ollama/gemma4:31b on a corpus of politely-worded takings:

| said | reached | should have |
|---|---|---|
| "I relieve him of his purse" | **`give`** | a taking |
| "I collect what I am owed from his rooms" | `sect` | a taking |
| "I pick up the manual on my way out" | `buy` | a taking |
| "I help myself to what is on the rack" | `interact` | a taking |

The first is the worst outcome the reading layer can produce: the player tried to rob
somebody and the engine was told they handed something over. `narrator.ts` has a hard
guard against a model turning a gift into a theft, for exactly the reasons in its own
docstring - opposite signs on every consequence - and this is that failure running the
other way, through the deterministic table where nothing was watching.

The same corpus made the parity check fire: takings reached a verb 77% of the time
against 100% for givings, 23 points apart. **A reader that routes polite-surfaced takings
as benign acts has an opinion the engine does not have**, and it is the one this document
exists to prevent.

**Why no vocabulary fix works.** There is no hostile word in any of those sentences.
"Take", "collect", "pick up", "help myself" are the ordinary words for handling your own
possessions, and they have to keep working for the case where the thing IS yours.
Enumerating polite theft verbs is the treadmill: the next player writes "I make free
with", and the list grows forever while the class stays open.

**Where it actually resolves.** `engine/world/possessions.ts` already holds possession,
ownership, claim and knowledge, and `ownership-transfer.ts` already has the three routes
title moves by. So the question "was that a theft" is one the WORLD can answer and the
sentence cannot. The reading layer's job is to route a taking to the resolver that asks;
deciding theft in the parser is deciding it from the wrong evidence.

Three states, and only the middle one is a theft: **yours** (nothing happened), **theirs**
(a taking, with everything that follows), **nobody's** (a find - the apple in the middle
of nowhere, which must stay free or the world becomes a museum where nothing may be
picked up).

### Built, and where each half lives

| | |
|---|---|
| the reader | `whatATakingNames` in `verb-pattern-table.ts`. It recognises that a taking was said and hands over what was named; it does not decide whose. It routes to `interact` with `intent: 'take'`, which asserts nothing. |
| the decision | `src/web/a-taking-is-decided-by-ownership.ts`. Pure: evidence in, one of three answers out. Nothing is rolled, because whose a thing is is not a matter of chance. |
| the theft | unchanged. Where the world answers *theirs*, `GameService.interact` rewrites the intent to `steal` before anything else reads it, so `resolveAttempt`, `whatALiftTook`, `whatTheyDoAboutBeingWronged` and `createObligation` are reached exactly as a sentence with the word in it reaches them. |

**The order of evidence is the design.** The world's own rows are asked first and the
sentence second, because a row is a fact and a possessive is a claim: somebody who says
"his sword" over a sword they are already holding is holding their own. The sentence is
consulted only where the world has no row to answer with - a purse is a number on a person
and has none - and even then it supplies *somebody else's* and never who. Who is whoever
the world says is standing here, which is what `interact` with no target has always meant.

**The find is a real acquisition.** A tracked row nobody holds and nobody owns, standing
where you are, comes off the ground through `transferPossession` with `how: 'found'`.
Possession moves and ownership does not, on this route as on every other, so a claim
surfacing a century later reads off the provenance where it was picked up.

**And a taking that reaches nothing is not a permission.** The report says nothing of that
description is anybody's here, and names what is. That is a fact about the record, not a
rule about what may be done, and the world still has no opinion.

**What the reader defers to, and why the list is short.** Every row below the taking row
that owns a portable-thing noun is deferred to by name rather than by ordering: swallowing
a pill, a prize behind a door, a journey on a carriage, an offer across a counter, a house's
own shelf, and the theft row itself - which keeps every sentence it already read. The
taking row exists for the class that says nothing, and relabelling a working sentence
would have been churn rather than a fix.

Played on a pinned world, once for each state:
`tests/web/a-taking-is-decided-by-ownership.test.ts`.


---

## Beauty is a fact of the body, and Charm is not it

The design owner wants jade beauties (玉人), so the world needs a **beauty** term. The
attribute block already carries Might, Insight, Fortune and **Charm**, and these are two
different things that a single stat would flatten:

| | what it is | can it change |
|---|---|---|
| **Charm** | how somebody carries themselves - what they do with a room | practised |
| **Beauty** | what they look like | born, like a spirit root |

So beauty belongs with the born properties - beside a spirit root and a physique, rolled
once and not re-rolled - and Charm stays what it is. A cultivator who is plain and
formidable and one who is beautiful and graceless are both ordinary people in this
setting, and one stat cannot say either of them.

**What reads it.** Whatever already reads Charm-shaped inputs: the social-leverage
resolver, what a house would take for a match, how somebody is received before they have
said anything. Nothing branches on a beauty VALUE - the same rule as everywhere else -
and taking beauty away must leave an ordinary person with no residue.

**Both directions, and every sex.** This is the same constraint the furnace path already
holds: `worksBetween` takes sex as a parameter and does not branch on which way round it
is. Beauty is a term about a person, not about women, and it must be as readable on a
sect head as on a disciple. It opens doors and it also **marks somebody out** - which is
the honest half, and the one that connects it to the rest of this document: a beautiful
cultivator with a yin physique is a person other people have plans for, and that is a
fact about the world rather than a judgement about her.

**What it must not become.** A second Charm, a hidden social-success multiplier, or a
gate on any act. It is a fact people read off somebody, priced by the same machine that
prices a purse or a threat, and the engine has no opinion about who is worth more.


---

## The dao heart is consistency, not virtue

Heart demons already exist as a breakthrough result. The question is what feeds them, and
the design owner put the hard part precisely:

> You give them something else - you do a bad thing. But that depends on your own moral
> code. If you are a person who doesn't view it as a bad thing, it isn't a heart demon.
> Which makes it kind of hard.

It is hard because the engine has no moral code and must not grow one. 天道无情: it does not
decide what was bad, so it cannot decide what should trouble you.

**The way out is to measure a deed against your own record rather than against a standard.**
道心 is conviction in a path. So a heart demon is not "you did wrong". It is **you did
something that was not you**.

| | |
|---|---|
| killed a hundred times, kill again | consistent - no demon |
| never killed, then kill | contradiction - a demon |
| shielded juniors for a century, then abandon one | contradiction - a demon |
| consistently ruthless | a CLEAN dao heart |

The deed ledger already holds everything this needs, and nothing in it is graded. What is
being read is deviation from a path, which is a fact about a record, not a verdict.

**What it produces, all of it genre-correct:**

- The first killing is the hard one and the hundredth is nothing.
- The demonic cultivator is stable - which is exactly what the genre says of them - and
  pays in a different currency, being hunted.
- The restrained cultivator is stable too, until they compromise once, and that is what
  breaks them.
- Somebody who oscillates suffers most. 道心不稳, the unstable dao heart, becomes a
  mechanic instead of a label.

**And it is symmetric, which is the requirement.** Sparing an enemy costs the ruthless
cultivator a crossing; killing costs the merciful one. The engine never says which was
wrong, only that it was not you. A design where the merciful accumulate demons and the
ruthless do not has smuggled in a moral code with the sign flipped, and is wrong for the
same reason the other direction would be.

### A contradiction is a transition, not a verdict

The design owner's correction to the version above, and it fixes a real flaw in it:
*"character development shouldn't automatically be a Dao Heart failure."*

A pacifist who concludes *I was wrong, there are times when killing is necessary* has not
failed. **He has changed his Dao.** The dangerous part is the crossing between the two, not
the act that started it:

```text
contradiction  ->  doubt  ->  reflection  ->  resolution  ->  a STRONGER dao heart
```

rather than `contradiction -> -10 morality`, which is a morality system wearing a hat.

**So a dao heart evolves, and the later ones are stronger for having been tested.**

> "I protect everyone."
> Thirty years later: "I cannot protect everyone."
> A hundred years after that: "I protect those under my protection, even if Heaven itself
> opposes me."

The third is a stronger Dao than the first, because the first was inherited and the third
was paid for.

### How the engine reads "resolution" without holding an opinion

It does not judge whether somebody reconciled it well. **Resolution is subsequent
consistency**: the contradiction stays open until later conduct settles which way they went.

- Kill once and never again: the act is never reconciled and the contradiction stands open.
- Kill, and go on killing: the new path is real and the heart closes around it.
- Oscillate: it never resolves, and that is 道心不稳 - the worst outcome, and correctly so.

Still pure record-reading. Nothing is graded; what is measured is whether a life coheres.

### What it looks like to a player

**Dao Heart: 87% stable** - and the number is not a virtue score. It is how well somebody's
acts, beliefs and choices have settled into something they actually hold. A saint and a
butcher can both read 90%.

Which gives the genre's own conclusion, and it should be true in the engine too:

> The most terrifying cultivators are not the most powerful. They are the ones who have
> reached "I know exactly what I am", because they are extraordinarily difficult to shake.

That is a mechanic: a settled heart resists what would break an unsettled one, and the
resistance is earned by having been tested rather than by having been careful.

### The open question

A fresh cultivator has no record, so nothing early can contradict anything. That is arguably
right - somebody young is still becoming, and their first path is inherited rather than
chosen. But it means the opening stretch of a run silently sets a path, and a player never
told that has had something important happen to them off-screen. It also means the first
real contradiction, whenever it lands, is the moment their Dao stops being their teacher's.

---

## A sect's Protector is usually a beast, and the arrangement has to be earned

The design owner: a Protector for many sects is a **beast, probably ordinal 29 or above**,
and the beast has to be friendly to the sect.

`beasts.ts` today says a beast has *"no manual, no teacher, **no sect** and no pills"*, and
sits on the best ground it can hold.

**That line is the thing to change, not to work around.** The design owner's ruling:

> Change the language about no sect. Maybe the beast and the sect are long-term friends.
> That's a xianxia thing.

It is - the guardian the founder befriended, that has been on the mountain for a thousand
years, that the disciples grew up around. An earlier draft of this section had the
arrangement as a cold standoff between two things that could not remove each other, and
that is too cynical and rules out the version the genre actually uses most.

So a Protector bond is a real relationship with a history, and it can be any of several
things - a debt, a friendship, a founder's oath, or a truce that hardened. What it is NOT
is ownership: the beast does not take orders, which is why a sect will not discuss it and
why it cannot simply be told to fight.

The ground premise still does the work of explaining WHY they are in the same place - a
beast sits on the best ground it can hold and a sect wants the best ground it can hold, so
they were always going to meet. What happened after that meeting is the history, and it
varies.

**When you change `beasts.ts`'s line, change it honestly**: the point that file was making
is that a beast has no *transmission* - no manual, no teacher, no institution, no method
that was taught to it. That remains true of a beast with a friend in a sect. It is the
"no sect" clause specifically that overreached.

### A beast's element is what it IS, not what it rolled

The design owner: *"foxes are fire - just hardcode by species."*

A fox is fire the way a fox has four legs. It is written in the catalog beside `kind`, it is
the same for every fox, and no RNG touches it. The genre agrees - 火狐 fire fox, 雷鹏 thunder
roc, 玄武 black tortoise - and so does this repo's own rule against inventing a system where
a fact will do.

Spirit roots already carry the seven elements (earth 6, metal 7, wood 7, water 6, fire 5,
ice 2, lightning 2). Beasts carry `kind` - breath, concealment, defence, endurance,
movement, perception, strength - which is a capability axis and not an element, so there is
currently nothing on a beast for a sect to align to.

**Sects should carry elemental character too**, at two strengths that behave differently: a
sect that takes ONLY lightning roots turns everybody else away, and one that PREFERS fire
weights rather than gates. And an aligned Protector is *"if available"* - only six beast
kinds sit high enough, so an unaligned Protector has to stay possible or the pairing becomes
a hunt for a coincidence.

Nothing anywhere branches on which element it is. A sect's element and a beast's are values
compared to each other, never switched on.

### Rarity is the beast population, not a dial

AGENTS.md: rarity is a population statement, not a price. Measured in the catalog today:

| | |
|---|---|
| beast kinds at ordinal 29+ | **6** |
| beast kinds below 29 | 13 |
| sects | **35** (this said 38; `SECTS.length` is 35) |
| of the six, ones that can end up in a chair | **2** |
| houses that get a Protector | **3** |

There are not enough high beasts for many sects to have one, and that is the whole answer.
The rate is not chosen: it is **how many high-ordinal beasts happen to be sitting on ground
a sect also wanted**, which lands on a handful. Do not add a probability for this. If the
number comes out wrong, the thing to change is how many such beasts the world holds or how
much top-tier ground there is, because those are facts about the world and a percentage is
not.

**Measured, once the pairing existed.** Four of the six at 29 or above cannot end up beside
a house, and each for a reason the catalog already stated rather than one written for this:
the Leviathan and the sealed ancestor are `sealed_only` and a compound is not inside closed ground;
the Reader is `indifferent` to veins, which is the catalog saying it never ends up beside
anybody; and the Thing Under Nine Peaks is `demonic` - it is drinking the Ascetic Order's
vein, which is why the ground is contested rather than why it is held. That leaves the White
Ape with the Azure Cloud Pavilion and the Millennial Tortoise with the Clear River Fordhall,
both on a shared element. The third chair is not a beast at all: the Nine Abyss Flame Sect
seats the Kindler, its own ancestor sealed at strength, which `sealed-ancestors.ts` was
already calling `kind: 'protector'`.

`src/engine/world/house-protector-pairing.ts` is the derivation and it takes no seed.

### What it gives the game

- **A legible deterrent.** `assess` already reads a standing, and the categorical-gap rule
  already makes a contest across four realms a no-contest. So a player can find out that
  the mountain has something at 33 on it, and understand exactly what that means, without
  being told what to do about it.
- **A reason a sect is where it is.** The ground was worth it, and the beast is the price
  they pay for it.
- **Something to lose.** A Protector that dies, leaves, or is turned is a sect suddenly
  standing on ground it cannot hold - and every neighbour can read that as easily as the
  player can.


---

## Ambiguity is an answer, and asking is a free turn

The design owner:

> At some point we can accept ambiguity means ambiguity, and the LLM should ask to clarify.

This repo already believes it in one place and should believe it generally.
`a-sentence-can-be-more-than-one-call.ts` records the ruling for a sentence holding two
costly acts - *"if the model is told this it should ask which to do first, because it can't
do both"* - and the reasoning there is the whole argument:

- **Asking costs nothing.** A question is a free turn.
- **Guessing costs the player their life.** The wrong verb spends days, a wound, or the run.
- **The question is not a refusal.** Nothing failed. The turn understood the sentence, which
  is the opposite of the failure the reading layer exists to remove.

So: **where a sentence has two readings and the engine cannot tell which, say both and
ask.** Not "the thought does not resolve" - that is the answer for a sentence with no act
in it, and the wrong answer for a sentence with two.

Two things keep it honest:

- **Ask in the player's own terms, never in enum names.** A list of verbs is a parser
  asking; a game asks *"the elder, or the one beside him?"*
- **Do not ask when one reading is obviously right.** A question every third turn teaches
  the player the game does not understand them, which is worse than an occasional wrong
  guess. The bar is genuine ambiguity - and everything in this document about binding
  pronouns, plural pointing and ownership exists so most sentences never reach the question.


---

## Taking a disciple is not modelled, and it is the largest hole on the giving side

Measured: `planDiscipleIntake` in `engine/cultivation/leadership.ts` is a SECT running an
intake. `spending-a-word-to-place-a-child.ts` is placing a child at a house. **There is
nothing for one person taking another as their disciple** - the master-and-disciple tie,
which the genre treats as the strongest bond a cultivator has.

So `I take him on as my disciple` reaches no verb. It used to reach `attack`, because
`take on` is in `ATTACK_SUBJECT_VERBS` and means picking a fight; that misroute is fixed and
what is left is an honest gap.

It matters more than one sentence because of what it would carry:

- It is the tie an extraction talisman travels along - you give one to **your own**, and
  that is the whole reason the deep rooms are gated socially rather than by money.
- It is the obligation behind "their enemies become your enemies".
- It is what makes hiding a junior's talent, taking the blame for one, or teaching them just
  enough to be useful into acts with a price rather than sentiments.

Everything it would need exists: obligations, standing, the knowledge gate, and a favour
ledger that already carries `shielded_crossing` and `spared` as causes.
