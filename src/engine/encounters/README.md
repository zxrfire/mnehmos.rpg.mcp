# `src/engine/encounters/` - things happening to somebody

The contract for this directory. Read it before editing anything here; update it
in the same commit if you change the contract.

## What this is for

A catalog of 109 encounters existed, `randomEvents: true` was passed at three
call sites, and 35 opportunity windows were seeded into every world - and across
1,440 played turns nothing had ever happened to a player. Not one encounter, not
one combat, not one inbox event. Every run was work, provisions, seclusion,
breakthrough, repeat, until starvation or stagnation.

The flag was set, the content was authored, and no path connected them to a
turn. This module is that path.

## The one rule, applied here

> The AI narrates. The engine decides.

Everything below is deterministic and pure: state in, deltas out, no database,
no `src/web`, no I/O. Every roll draws from `forStream(seed, ...)` keyed to an
ABSOLUTE DAY, the same discipline `time-skip.ts` keeps and for the same reason -
a check on day 900 is the same check whether the simulation reached it in one
jump or three hundred.

And the boundary inside the boundary:

| The engine settles | The player decides |
|---|---|
| whether something came, and what | whether to pay, fight, or leave |
| what a hazard cost while they were busy | what to do about anybody standing there |
| what a name is worth as a knowledge record | what to do with the name |

An entry that `interrupts` therefore produces **no automatic deltas at all**.
Bandits on the road do not silently take spirit stones; they are standing there,
and the turn is what happens next.

## Nothing here is bespoke

There is no set piece and no branch on any particular row. An encounter is a
catalog row selected by ordinary predicates over four things the world already
records:

| Predicate | Read from | Where |
|---|---|---|
| rank | `regard.ts` bands over the entry's own `minOrdinal` | `select.ts` |
| activity | what the cultivator is doing | `activity.ts` |
| place | `LocationKind` and `environment.danger` | `activity.ts` |
| direction | the entry's tags and `simEventKind` | `valence.ts` |

If you find yourself writing a rule that applies to one entry, stop. The thing
you want is a tag.

## The five pieces

```
types.ts        the vocabulary. Structural, so nothing imports the world layer
valence.ts      good / bad / neutral, read off columns the catalog already has
activity.ts     exposure, reach, place bias, cadence constants, the door rule
select.ts       the pool and the two-stage draw
tokens.ts       filling {token} slots, and the discovery rule as code
resolve.ts      stance, deltas, the confrontation descriptor, the SimEvent
duties.ts       the summons, the board, scale, the cohort, what refusing costs
passing-a-duty-down-to-somebody-else.ts
                a member hiring their errand out. The board gate is untouched:
                what makes it a trade is that contribution is worth nothing
                off a roll and stones are worth the same to everybody
contact.ts      the people you live with, and how a tie accumulates
suitability.ts  whether the thing you found is for YOU
sendoff.ts      "nothing further for you here", grounded in an assessment
arrivals.ts     the world's own unheard events, offered for arrival
window.ts       the cadence loop. The entry point is rollEncounters()
an-escort-on-the-road.ts
                what a band does to an escorted ship or carriage: withdraws,
                unless it is more than twice the escort
```

## Four things can happen to somebody

| | who starts it | what it is |
|---|---|---|
| an encounter | nobody | the world happening near you |
| an arrival | the world | something already happening, reaching you |
| a summons | an institution | being asked for by name |
| a commission | you | work you went and took off a board |
| a contact | somebody you live with | the texture of belonging |
| an account coming due | somebody holding one against you | `an-account-comes-due.ts`: the holders `whoIsComingForYou` lists, drawn by the weight of what they hold, the curve stated there |

The first two are coincidence. The last three are what makes a membership mean
something, and before them a Dew Servant and a rogue lived identical lives.

## Two cadences, because there are two denominators

A turn spent walking to the next village and a decade spent in a cave are both
"a window of days", and one per-day rate serves neither: rated per day the walk
is eventless and the decade is relentless.

- **occasion** - one check for the act itself, whatever it took. Doing a thing
  is the exposure; the clock is not.
- **span** - one check per `ENCOUNTER_GRID_DAYS` (15) of elapsed time, for the
  part that genuinely is about duration.

## Direction is drawn before the row

The catalog's weights are authored for the time-skip digest, where ruins being
the heaviest block and hostility being the thesis are both correct. Run straight
into play, that gives a life in which the world only ever arrives as a problem,
and a world that only hurts you is exactly as monotonous as one that never
touches you.

So the draw picks a **direction** first and a **row** second. Every one of the
author's relative weights survives intact *within* a direction; no direction gets
to eat the world. The mix belongs to the activity, not the entry - a market is
mostly good news and a sickbed mostly is not - which is why it lives in
`activity.ts`.

A direction with nothing eligible in it forces nothing. Its share redistributes,
and a pool with only bad news in it produces bad news. The floor is on the draw,
never on the world.

## The door

`interrupts` is the entry's own answer and, for anybody out in the world, the
whole answer. A shut door changes it in one direction only:

> A cultivator in seclusion is not participating. Something that came FOR them
> still gets them up - a body at the cave mouth, a formation that failed, their
> own circulation reversing. Everything else required them to go and look, and
> they did not. It is reported when they come out.

That is `interruptsThrough()`, stated over columns the catalog already has, so a
new entry inherits the behaviour without anybody deciding anything about it. It
is also what "you surface to a world that moved" is made of.

`sealed` seclusion lets through a small fraction of an open one (its exposure
in `activity.ts`), because a shut door is not a ward.

**Somebody coming over an account meets the door itself** (`at-a-sealed-door.ts`).
A slight is not worth breaking a door for; anything heavier tries, and their
strength against the door's rung (`src/engine/world/door-materials.ts`: an inn's
planks, a house room by rank, the sitter's own door as reinforced) decides it by
`canUnmake` - not a roll. Reaching it, the door breaks and the fight follows. Otherwise they wait
outside or go, a draw weighted by the account and the holder's temperament; one
still waiting when the sitting ends is at the door
(`whoWasAtTheDoorWhenTheyCameOut`), and one who went leaves a trace without a
name, unless they stood a whole major realm above the sitter.

## Encountering something from above

`docs/world/houses/discovery.md` asks for a particular texture, and it is delivered by
the regard bands rather than by a rule about who is important:

- band `unreachable` or `overmatched` on the **threat** gate -> stance `above`.
  No fight is offered. The engine's line ends "Nothing was required of this
  cultivator and nothing was asked. They were not what any of it was about."
- Being ignored by something enormous is the encounter. There is no branch
  anywhere on faction, title or importance - only on the size of the number.
- The summary does not explain them, because the engine does not know anything
  about them except the gap.

### A measured absence

`beneath` is currently **unreachable through the play draw**. The catalog's
`minOrdinal` and `threatOrdinal` move together, so an entry whose threat is far
below a cultivator has already been culled as outgrown by the rank narrowing
before the draw gets as far as pricing its fight. That is coherent - the world
stops offering you what you have outgrown - and it is written down here so the
empty band is not read as a bug. It is asserted as a unit in
`tests/engine/encounters/window.test.ts` rather than as a population.

## Discovery, as code

The hard rule - never reference an entity the player has no knowledge record for
- is enforced structurally in `tokens.ts`. Nothing in this module composes a
proper noun. Every name is supplied by the caller, and a name may appear in a
summary in exactly two cases:

1. the player already knows it, or
2. a **person in the encounter said it**, flatly, assuming it needed no
   explaining - which is discovery.md's preferred way for a name to enter the
   world, and which emits a `KnowledgeGrant` at stance `suspects` with the source
   recorded honestly and the statement "a name that got said. What it is remains
   unknown."

Anything else gets the unattributed phrase. The consequence still arrives; it
arrives without anybody's name on it.

A guard caught the subtle half of this: a window that had already shut still
produces a summary, and a name in *that* is a rule broken by an event that did
not even happen. `spoken` gates it - nobody said anything to somebody who
arrived four days late.

## Arrival is not a channel

`digest.ts` answers "what would have reached them" and counts what did not. A
live five-year seclusion produced one line reported and thirty-five events
"reached them by no channel at all". That counter is correct and should stay
correct: a world that is mostly none of your business is the design.

What was missing is the other door. A channel is somebody telling you; an
**arrival** is the thing turning up. discovery.md is explicit that this is
allowed and in fact preferred - "the world may act on a player who cannot name
what acted" - so an arrival carries the fact's own authored, name-free
consequence (`unattributedTextOf`), grants nothing, and names nobody.

Arrival is rolled **per candidate fact**, not per day. The world's own event
volume is what decides how often the world reaches somebody: a quiet decade
produces few candidates and few arrivals, a war produces many of both, and
nothing has to be tuned twice.

## Institutional work

`duties.ts` authors no content and holds no rows. A duty is a READING of an
`ENCOUNTERS` row that already exists, over tags the catalog already carries -
`obligation`, `war`, `support`, `quest`, `competition`, `timed`. A parallel
table beside `encounters.ts` carrying the same situations with a payout column
bolted on is exactly the mistake AGENTS.md names, so the situation stays in the
catalog and only the TERMS are computed here.

**Who gets asked** is one rule off the regard bands, and it produces the whole
texture with no branch on faction, title or importance:

```
unreachable / overmatched   the house sends an elder. You never hear about it
stretch / matched / assured you are what they have
beneath / dismissed         it is beneath you, so you are not asked
```

**How the ask is put** is a share of the house's own rank array, so a four-rung
house and a seven-rung house both produce the range: `told` where to stand,
`assigned` a task, `consulted` about what should be done.

**Scale** is the one axis along which a raided caravan and a war differ. Same
mechanic, one number:

| | days | cohort | refusing |
|---|---|---|---|
| `local` a road, a nest, a caravan | 12-20 | 0 | serious |
| `regional` a beast tide, a secret realm, a vein | 90 | 12, falling with rank | grave |
| `total` the house is at war | 720 | 40, falling with rank | **unforgivable** |

`unforgivable` is reachable only from a member declining a war. Nothing else a
cultivator can turn down is worth that word, and that is deliberate: it is
desertion, and it is meant to be available.

**The cohort is the half that outlives the duty.** Peers at your own rung who
were there, saw what was done, and are still about afterwards is where every
rivalry, debt and witness in this game is going to come from. A house spends its
bottom rungs in quantity and its top rungs singly, which is also why the bottom
rungs are where the survivor stories come from.

**Access is the half of membership that is not danger.** A trial ground, a
sealed site, a front: places a rogue cannot go and things a rogue cannot be
given. That is the sect being worth a lifetime, stated in gameplay rather than
in prose. A rogue may still take contract work off a board and is paid the same
stones - the only thing they cannot be paid in is contribution, because there is
no ledger they are on. That difference IS the membership.

## The roll that is not the house roll

`what-a-house-will-teach-somebody-it-has-not-taken.ts` is the other end of the
ladder from `what-a-house-asks-of-somebody-it-cannot-order.ts`. That file answers
"the house has run out of rungs for you"; this one answers the question under
the whole bottom of the world, which is that a teacher is one of the two ways
past a manual's ceiling and a nobody has nobody to ask.

**A house takes guest students on purpose, and it is not charity.** Two reasons
and both are the house's own interest:

- **A pipeline.** An admission bar tells a house somebody's rung. A year of
  watching them work tells it what they are like, and for the six dao houses -
  where the only door is adoption - it is the only instrument there is.
- **It costs them nothing, because they hold the best back.** A house can afford
  to teach an outsider its lower material precisely *because* the deep material
  is behind membership. Nobody fears a guest leaving; the guest was never shown
  the thing worth stealing.

**Where the line between shallow and deep comes from.** Not a policy and not a
number invented here. `copiesOf` in `engine/world/manuals.ts` already bands a
shelf by how many copies of each book a house physically keeps - eight to twenty
of the intake primer, three to seven of the working road, two or three of the
inner shelf, one at the top. So a house lends a guest from what it holds in
quantity and never from what it holds in ones, and the deepest thing on a shelf
is closed by construction whatever that shelf's height.

**Which is why not every house takes guests**, with no flag and no branch: a
house takes them when its shelf reaches above the line it can afford to show.
Measured over the catalog, 16 of 34 bodies do, including six of the seven dao
houses - the Jade Register Hall does not, because its whole working shelf stops
at the intake primer and there is nothing behind it to protect.

**What a guest gets is access and nothing else.** No rung, no stipend, no
contribution, no protection at a crossing and no backing in a quarrel. The house
spends teaching time. `WHAT_A_GUEST_PLACE_IS_NOT` is never empty and rides on
every read, because the position has a specific vulnerability that has to be
legible before somebody accepts it: a guest is away from their own protection
among people who owe them nothing.

**And a guest keeps their own house.** Not a transfer, not a secondment, not a
defection - so `docs/world/climbing/past-the-ceiling.md`'s departure economy does not fire
at all, and the host is not poaching. What the home house has instead is a view,
read off two columns it already carries: it `forbids` a place at somebody it is
feuding or contending with, `sends` somebody where its own production record says
it is short of a book, and otherwise `permits`.

The write is a flag, not a membership row - `sect-guest.ts`. Its nearest
neighbour is `FLAG_GUEST_OF` in `sect-politics.ts`, the guest ELDER, which is
this arrangement inverted: there the visitor is stronger than the house and sells
presence; here they are weaker and buy access.

## The people you live with

Obligations and access are not what makes a sect feel like somewhere you live.
That is the senior sister who comes to check whether you are still breathing,
the rival at your own rung who has decided something about you, the elder who
remembers your name, and the junior who resents that you were promoted.

There is no contact catalog either. `members.ts` already holds 164 people per
world with names, rungs, ranks, and five fields this lives on - `role`,
`wants`, `fears`, `detail`, and the `rivalry` / `teaching` objects. That is a
cast. `contact.ts` decides which of them turns up and what it does to the
record, and it authors no person, no grievance and no line of dialogue.

**What kind of contact it is, is derived** from their role and where they stand
relative to you. Somebody above with something bounded to give offers it
(`instruction`); somebody above with nothing to give still notices you are not
about (`checked_on`); a grievance is `friction` at your rung and `resentment`
from below; a peer who is good company is `company`; anybody else brings house
business. No branch names a person, so adding a member to `members.ts` gives
them a social life for free.

**Contact upward is initiated by them.** The first version of this file cut off
anybody more than eight rungs away, which deleted the "elder who remembers your
name" case entirely - in every real roster the people with something to teach
are exactly the people far above you. It is now a weighting: `unreachable`
×0.15, `overmatched` ×0.6, peers ×1, `beneath` ×0.4, and only `dismissed`
(seventeen or more rungs below) is dropped, because that is not a social life,
it is somebody told to stay out of your way.

**Most contact does not stop the game.** Company is not a decision, and halting
play for it would make belonging feel like an interruption, which is the
opposite of the point. Only an offer and a challenge hand control back.

### Accumulation is the whole point

The failure this exists to avoid is a world of first meetings. Every contact
carries a `tie` describing what it does to the `relationships` row for that
pair, and `createRelationship` derives a stable id from the pair, so the caller
reads, applies and writes back. Meeting somebody twelve times over forty years
is one relationship with twelve events on it.

Strength rises with diminishing returns - the step is scaled by the room left -
so a tie deepens fast and then slowly, which is how they work and which stops
forty years of company reaching certainty by year three. The type moves up a
deliberately short ladder as it goes:

```text
sect_mate  ->  senior_brother / friend  ->  master        (warm, and rare)
sect_mate  ->  faction_rival -> rival    ->  enemy         (the other way)
```

Short on purpose: most people in a house stay sect-mates for three hundred
years, and the handful who do not are the story. `attitude` stays in plain
words per the social layer's contract, so a strong tie and a hostile attitude -
the bitter former disciple - remain expressible together.

The `relationships` and `relationship_events` tables have existed since the
social migration with nothing writing to them. `recordContact` in
`src/web/encounters.ts` is the first writer.

### And a summons has a mouth

An order carries very differently from a named elder who has an opinion about
you than from "the sect". `Duty.spokenBy` is somebody senior on the house's own
roster; with no roster supplied it is null and the institution speaks, which is
right for a notice on a board and wrong for everything else.

One bug worth recording, because the fix reads as the wrong choice: the summons
used to force the entry's `{faction}` slot to the summoning house. On
`enc-plague-village` that slot means *the body that has not sent anybody*, so
forcing it produced "Azure Cloud Pavilion has not sent anyone" immediately
followed by Azure Cloud Pavilion sending this cultivator. The house is now
named once, in the duty line, where it unambiguously means the party asking.

### The board is for disciples, and an elder can still read it

Two rungs of one rule, and the rule is AGENTS.md's: *not having the standing to
do something is not the same as seeing nothing.*

**The wall carries its own top rung, not the reader's.** `whatAHouseHasOnItsBoard`
generated one pitch - whoever was standing in front of it - so at ordinal 40 in
a house whose strongest NPC stands at 41 the board measured 0 offers and 7
refusals: every row was pitched at the elder, and `howAnAskReaches` correctly
routed all of them to word of mouth. `reachOfTheRest` is the house minus the
reader, `theTopOfTheWall` reads the same boundary `howAnAskReaches` already
draws, and a reader above it gets that notice too. After: 7 offers, pitched at
29 and 38.

**A wall does not decide who is worth its work.** `summonable` answers *would the
house spend this person on this*, which is the question when the house is
choosing and the wrong one off paper. `takeableOffAWall` keeps the refusal for
what is pitched above the reader and drops it for what is under them. Taking
one is never priced differently: the design owner's word is that an elder taking
a disciple's notice is *met with an eyebrow*, and an eyebrow is the narrator's
job.

### And taking it is said to somebody

The eyebrow has a face. The design owner: *"to take a mission YOU HAVE TO REPORT
IT TO SOMEONE, THE MISSION HALL WHICH THE MISSION ELDER IS RESPONSIBLE FOR.
EITHER REPORT TO THAT ELDER OR TO A DISCIPLE WORKING IN HIS HALL."* Taking work
off a wall was a solo act against a piece of paper, so there was nobody for
anything to be noticed by, and `pitchedWellBeneath` rode `completeDuty`'s
settlement line - saying it after the fact and to nobody.

The gap was structural. An office in this engine is a ROOM, and
`whoIsInChargeOfWhat` filtered on `sealed`; `RoomPurpose` had 21 rooms and no
mission hall, so the missions elder was named in `docs/world/houses/discovery.md`
and in three refusal strings with nowhere to stand. A hall disciples walk into to
take work cannot be a locked room, so `office` had to stop being `sealed` before
the room could exist at all. Three changes, all in `architecture.ts` and
`what-an-elder-is-in-charge-of.ts`:

- `office` is its own column, equal to `sealed` on every purpose that existed
  before, so the deal is unchanged.
- `mission_hall` sits at **depth 0.3**, under every other office. Load-bearing:
  offices sort deepest-first and are dealt round robin, so a room inserted ABOVE
  the others shifts all of them, which is what the reverted ancestral hall did.
- `who-works-in-an-elders-hall.ts` reads who WORKS in a room as well as who is
  over it. A post is a sub-job, not a rung - nothing there touches `rankIndex` -
  and `remitOf` is two values rather than a table of favours: the holder DECIDES
  about a room, the staff HANDLE what passes through it. That is what makes a
  hall open when the elder is out, and it is the whole mechanism behind bribing
  a hand for something that passes through their room.

`THE_ROOM_WORK_IS_POSTED_IN` sits beside the board for the same reason
`THE_ROOM_COMPLAINTS_GO_TO` sits beside the reporting module: which room is a
system's front door is that system's fact, not the architecture table's.

### And an elder is asked to go out with the juniors

The more likely elder scene, per the design owner: a peer or the patriarch asks
somebody senior to accompany disciples who have taken work beyond the sect's
ground.

Nothing generates it. The occasion is a posting the board already made at a
junior's rung - the same row the change above put on the wall - and the party is
`whoTheHouseCanSend` read against the roll, which is the pass the world uses for
parties the player never sees. `whatAHouseWouldSendYouOn` keeps the
`wellBeneathYou` rows and `window.ts` drops the ones the house has nobody for,
because the roll lives there and `duties.ts` is arithmetic over one person's
standing.

`Duty.takingOut` names them; `cohort` is set to the same count, because "5 of
the house alongside" beside eight named people was one fact kept twice. The ask
is `word_of_mouth` by construction, `spokenBy` is the asker rather than a
carrier on this one row, and declining costs standing through the path
`pending-summons.ts` already owns. Measured at ordinal 40 over 60 seeds: 3 asks,
0 escorts before, 2 after.

## Suitability, and why anybody leaves the cave

Comprehension and consumables are suited to a PERSON. A manual you cannot read
teaches nothing however long you sit with it; a pill outside its band does
nothing. A cultivator sealed in a sect library with everything money can buy
still only climbs if they happen to be suited to what that library holds - which
is the province of the prodigy, and is why everybody else goes out. They are not
looking for treasure. They are looking for a fit.

That one fact converts three things:

- **danger** stops being an obstacle and becomes a wager. You go into the ruin
  because what fits you might be in there, and nobody can tell you in advance
- **a miss** becomes a real outcome. Finding something excellent and useless to
  you is a good encounter, not a failed one
- **rumour** becomes an economy. "A fire-root manual, three provinces over" is
  worth more than stones, and only to a fire root

**The miss must be legible.** The most important line in `suitability.ts` is the
one that says a thing is fine and is not for you. A player holding a
heaven-grade manual with no idea why nothing is happening has been cheated by
the interface, not by the world - so every verdict states which axis missed, and
`unsuited` says outright that sitting with it will teach them nothing.

Reach and fit are kept apart on every verdict, because "too far above you" and
"not written for you" are different facts, and collapsing them loses the one
that matters.

## The send-off

There is a rung where sitting in a cave stops working. The game can present that
as a wall of failed rolls, or somebody the player knows can look at them and say
to go. Same mechanic, opposite feeling - and the second teaches the suitability
rule from a character rather than from a refusal message.

It does **not** fire off an ordinal. A master would know because a master is
higher on the ladder and can read a student, so the trigger is an assessment,
and the quality of the assessor is the quality of the answer:

```
far above      they see it exactly, and they are right
at their rung  they see something is wrong, and misread it about 12% of the time
below          they are guessing, and are wrong about 35% of the time
```

Being wrong is a feature. A master who sends a student who was doing fine costs
them years, which is the most expensive currency in the game, and it makes
leaving a bad teacher a real decision rather than an ungrateful one. Whether the
read was right is engine-only and never reaches a narrator: the player finds out
by spending the years.

No master means nobody is assessing you, so nobody tells you and you find out by
failing. `unattachedSignFor` is the lonelier equivalent - a body well off the
road who evidently sat in one place a long time and then stopped - granting the
same direction through a worse channel, recorded as `inferred` rather than
`told`. The asymmetry falls out; it is not a special case.

Both are refusable. Staying is a choice, and a player who sits in the cave until
they die of old age has chosen a legitimate ending.

## What it produces, measured

All figures from `tests/engine/encounters/`, at the constants currently in
`activity.ts`. They are asserted as **bands**, and the band is the design claim:
if a change moves one out of its band, that is a decision to be argued for here,
not a band to be widened.

| | measured |
|---|---|
| a year of ordinary life (40 turns, mixed activities) | 6.3 encounters - 2.6 good, 2.0 bad, 1.6 neither |
| of those, decision points handed back | about half |
| a twenty-year seclusion, live world and a house | 2.8 things, of which 1.3 arrived from the world |
| ... interrupted at all | 90% of the time |
| ... first interruption | around year 8 |
| a summons, for a member in active play | 1.2 a year |
| a summons, for a rogue | never, at any rung |
| contact with your own house, in active play | 5.5 a year, 1.6 of them stopping the day |
| ... across a twenty-year seclusion, by locatability | 2.1 `known`, 1.4 `private`, 0.5 `hidden` |
| a twenty-year **sealed** seclusion | nothing, always |
| distinct catalog rows seen in 25 played years | more than 25 |
| Fortune 0 vs Fortune 3 over 660 events | 75 -> 15 missed windows, 10 -> 38 passed by, **same event count** |

### Seclusion is a curve, and a short one looks like nothing

Reported because it has already caused one false alarm. On a BARE run - no world
loaded, so no arrivals, and no house, so no summons - the odds a seclusion
produces nothing at all are:

| span | events | completely empty | interrupted |
|---|---|---|---|
| 1 year | 0.15 | 86% | 7% |
| 5 years | 0.66 | 45% | 31% |
| 10 years | 1.10 | 21% | 49% |
| 20 years | 1.65 | 5% | 74% |
| 40 years | 2.12 | 0% | 96% |

A five-year seclusion returning nothing is therefore the single most likely
outcome, and is not evidence of broken wiring. The 90% and year-8 figures above
are for twenty years with a live world and a membership; the bare twenty-year
figure is 74%. Judge the wiring on a twenty-year sample, or on many five-year
ones.

The Fortune row is the doctrine holding: luck generates opportunity, not
success. It moves whether a thing arrives and whether a window is still open,
and it never touches damage, a resolution, or a capability gap.

## What this module does not do

- **It does not resolve combat.** Pricing needs no database; resolving needs
  artifact rows and a battle history the pure layer does not hold. A hostile
  encounter comes back as a `Confrontation` - gap, count, damage multiplier,
  whether walking away is available - for the caller to put through
  `resolveMelee`, or not, because the player was handed control back. Where
  somebody comes at the player with nothing on offer, the web layer opens the
  ordinary standing fight with them as aggressor
  (`src/web/when-somebody-comes-at-you.ts`).
- **It does not write knowledge.** It returns `KnowledgeGrant[]` shaped to spread
  into `KnowledgeGate.learnIfNew` with a holder and a day added.
- **It does not invent people.** The cast is supplied. An encounter that needs a
  person and is handed an empty place produces a person-free fact instead.
- **It does not advance the clock, apply deltas, or persist anything.**

---

## Where else to look

- [`../cultivation/README.md`](../cultivation/README.md) - what an encounter is calibrated
  against: rung, regard, injuries, and what a house will spend on somebody.
- [`../../data/cultivation/README.md`](../../data/cultivation/README.md) - the authored side:
  `encounters.ts`, `why-a-house-puts-a-party-on-the-road.ts`, `contingencies.ts`, and the
  faction tables that decide who asks whom.
- [`../world/README.md`](../world/README.md) - where an encounter lands.
  `who-goes-out-for-a-house-and-what-comes-back.ts`, `opportunities.ts`, `gatherings.ts` and
  `who-is-on-the-road-with-you.ts` are the world-scale versions of the same events.
- [`../social-leverage/README.md`](../social-leverage/README.md) - the seam between a duty and
  a favour. `what-a-house-asks-of-somebody-it-cannot-order.ts` sits in THIS directory and is
  where the two meet: once a house cannot order somebody, the price, the refusal and what it
  leaves behind are all worked out over there.
- [`../social/README.md`](../social/README.md) - an arrival is only an encounter if somebody
  notices it. `arrival-exposure-read.ts` here meets `presence-recognition.ts` and
  `what-they-can-place-about-you.ts` there.
- [`../../web/README.md`](../../web/README.md) - `web/encounters.ts`,
  `web/what-is-posted-on-the-wall-here.ts` and `web/what-is-live-for-you-here.ts` are how any
  of this reaches a player.

