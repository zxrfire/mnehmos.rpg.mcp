<!-- tier: 3 -->

# Capability Gaps by Realm

> **Tier 3 - design work.** Never auto-injected. This is an audit of what each rung on the
> ladder actually makes possible, measured against the code, and a record of where the
> setting's prose is ahead of the engine.

The question this answers is not *"what ability goes at Foundation Establishment"*. It is
*"what should becoming Foundation Establishment MEAN to the player"* - and then, separately,
which part of that meaning already exists somewhere in the engine under another name.

The failure it exists to prevent:

> *"Foundation Establishment unlocked! +20% formation efficiency."*

A capability that changes what the player **chooses** beats one that changes what they
**roll**. Wherever a realm or an attribute currently only scales a number, this document
says so and proposes the affordance instead.

The companion statements live in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) (what
each realm makes possible, from Core Formation up) and
[`../../src/engine/world/README.md`](../../src/engine/world/README.md) (the five capability
predicates). Neither of those is an audit; both assert. This one counts.

---

## The method

Six questions per realm. For each, one of three verdicts:

| Verdict | Means |
|---|---|
| **built** | There is a named function or constant keyed on the rung, and something consumes it |
| **indirect** | The behaviour exists, produced by a system that is not about realms - regard bands, location thresholds, content pitched at a rung. It works, and nobody would call it a realm capability |
| **absent** | The engine has no answer. Sometimes correctly |

**Read every `built` that rests on a `CapabilityGrant` as "the code path exists and does not
fire."** See the correction below: no live cultivator holds any grant, so a row whose evidence
is a grant name is describing machinery rather than behaviour. The verdicts are left as
written rather than downgraded in place, because the thing worth seeing is *which* capability
was believed to exist and on what evidence - but do not read one as a working feature.

The six:

```text
1  perceive      what becomes legible that was not
2  survive       what stops killing them
3  do            what becomes possible in KIND, not in magnitude
4  asked of      what an institution may now put to them
5  risk          what can now happen to them that could not before
6  opportunity   what economic or social position opens
```

---

## What the measurement says before any of the prose

Counted off the live catalogs and `capability.ts`, not asserted.

| Realm | Capability grants available (cumulative) | Encounters pitched in band | Recipes | Techniques |
|---|---|---|---|---|
| Qi Condensation (0-12) | **0** | 81 | 10 | 24 |
| Foundation Establishment (13-16) | **0** | 7 | 5 | 18 |
| Core Formation (17-20) | **0** | 6 | 3 | 14 |
| Nascent Soul (21-24) | 2 | 2 | 3 | 13 |
| Deity Transformation (25-28) | 4 | 1 | 5 | 10 |
| Void Refinement (29-32) | 8 | 1 | 5 | 9 |
| Body Integration (33-36) | 10 | 0 | 3 | 13 |
| Grand Ascension (37-40) | 14 | 1 | 3 | 6 |
| Tribulation Transcendence (41-44) | 15 | 0 | 4 | 10 |
| Immortal (45-46) | 15 | 8 | 0 | 8 |

Three facts fall straight out of that table and they reframe the problem.

**Twenty-one of the ladder's rungs share one capability class and one technique address
band.** `CLASS_GRANTS.mortal` and `CLASS_GRANTS.core` are both `[]`, and
`ADDRESS_ORDINAL_FLOORS.body` is `0` while `place` opens at `21`. So on both of the engine's
two "what can this person do in kind" axes, ordinal 0 and ordinal 20 are the same answer.
Nearly half the ladder is one undifferentiated block.

**Fifteen of the fifteen grants are unreachable from a live cultivator.**

This section said *"six of the fifteen are declared and inert"* and that was a **counting
error, corrected here rather than quietly fixed** because the wrong number is more dangerous
than no number: it reads as a short list of gaps in a working layer, and it invited building
on top of one that does not run.

What it counted was **declarations** - which grant strings appear in `CLASS_GRANTS` and
whether any module mentions them. The question it should have asked is **what a cultivator
can hold**, and the answer is nothing at all:

```text
heldGrants(actor)  =  grantsAvailableAt(actor.realmOrdinal)  ∩  actor.heldGrants
```

`capabilityActorFor` (`src/server/consolidated/cultivation-perception.ts`) is the only place
in the repo that builds a `CapabilityActor` from a real `Cultivator`, and it hardcodes
`heldGrants: []`. Its own comment says why, and the comment is correct and honest:

> *"`heldGrants` is deliberately empty. A realm is a capability class and a class is
> POTENTIAL ... Nothing in this engine stores an acquired grant yet, so claiming one here
> would be the tool inventing capability."*

So the intersection is empty for every real cultivator, and **every consumer downstream of it
is off**: `judge` reads `heldGrants(actor)`, which is what `gates_places` and
`reads_formations` are special-cased inside; `neutralisedHazards` reads `heldGrants(actor)`,
which is the whole of `GRANT_NEUTRALISES` and therefore every `NEUTRALISED_HAZARD_RELIEF`
subtraction; and `convergence.ts` tests `actor.heldGrants` directly for `PIERCE_GRANT`.

The four grants this document called **built** - `prepared_vessel`, `carries_own_ambient`,
`no_ambient_needed`/`enters_dead_zones`, `no_seam`/`immune_contamination`, `gates_places`,
`reads_formations`, `spatial_folding` - are built in the sense that the code path exists and
is correct. None of them fires for anybody. **A grant-gated capability is a no-op that
reviews as a feature**, and that is the trap this correction exists to close.

Two things are genuinely implemented and are *not* affected, because neither routes through
grants:

- **Soul persistence, and only through one door.** `tradition.ts`'s
  `SOUL_PERSISTS_FROM_ORDINAL` feeds `killRequirement`, which `combat.ts` consults inside
  `assessPower` to set `bodyIsEnough` and `remnant: 'soul'`, and `combat-manage.ts` surfaces
  at the moment of a killing blow. At ordinal 21 and above, destroying the body really is not
  enough. This is the one realm capability the engine enforces against a living person, and it
  works precisely because `soul_persists` as a *grant* is bypassed.

  **But the module that would actually resolve it is uncalled.** `existence.ts` carries the
  whole apparatus - `PROFOUND_EXISTENCE_STATES`, `canEnterExistenceState`,
  `resolveBodilyDestruction`, the survival roll, `identityContinuity`, the soul-state costs -
  and `canEnterExistenceState` and `resolveBodilyDestruction` **have no caller anywhere in
  `src/`**. Only the tests call them. What the rest of the repo imports from that file is its
  state predicates (`hasBody`, `isGoingConcern`, `isTerminal`, taken by `survival.ts`) and its
  separate Lid-transit half (`canExistBeyondTheLid`, `evaluateLidTransit`,
  `resolveDescentStrikes`, taken by `game.ts` and `above.ts`).

  So Nascent Soul's `survive` verdict is wrong twice over rather than once: the grants that
  name it are unreachable, AND the machinery that would carry it out is never invoked. In the
  live game, surviving the destruction of your body is a **sentence in a combat readout**
  saying the body was not enough - nothing computes what happened to the soul afterwards.
- **`suppresses_lesser`, `makes_veins`, `seals_domains`, `reads_lid`, `opens_lid`** are not
  implemented at all, grants or otherwise. That part of the original count stands.

A related and smaller miscount, same cause: the **Nascent Soul "do"** verdict below calls
`ADDRESS_ORDINAL_FLOORS.place = 21` *"the only place on the ladder where what you can do
changes in kind and the change is enforced"*. `addressCeilingForOrdinal` has exactly one
caller - `addressIsLegal`, against a technique row's `requiredOrdinal`. It is a **catalog
invariant**, checked when content is validated. It gates what a technique row may declare,
not what a person may do, and no runtime path consults it about a cultivator.

**That question has now been answered: realm capability is something the engine ENFORCES.**

It was a real design question rather than an implementation detail - it decided whether a realm
confers anything or merely describes something - and the ruling is that it confers. Two things
follow, and they bind everything below this line:

- **A capability with no consumer is not finished.** The same rule as a module nothing calls,
  applied to the layer that produced the lesson.
- **Enforcement is what makes a failed crossing mean anything.** If capability is only asserted,
  a crippled nascent soul and a whole one are the same person with different prose - which is
  the softening the agency rule exists to forbid.

So `capabilityActorFor` returning `heldGrants: []` is a **defect to fix**, not a constraint to
design around. A grant earned by reaching a realm should be held, and asked about by running
code at the point where the answer changes an outcome. The three capabilities already enforced -
`SATIETY_BURN_BY_REALM`, `triggersHeavenlyTribulation`, and `killRequirement` through
`assessPower` - are the shape to copy: consulted by code that already runs, at the moment it
matters. Build the smallest version that is actually asked a question, not the largest one that
type-checks.

So the shape of the deficit is not "the low realms are empty and the high realms are full".
It is **the whole capability layer is thin, and the low realms are where that is most
visible because nothing else covers for it.** Up top the content catalogs are thin too;
what covers the high realms is `regard.ts`, `combat.ts` and the price curve.

**The bottom of the ladder is the best-served part of the game, not the worst.** 81 of 112
encounters, 10 recipes, 24 techniques, all five commission-board entries and six of eight
summons entries are pitched inside Qi Condensation. Whatever is wrong at ordinal 4, it is
not a shortage of things to do. The dead zone is **13 through 20** - past the content, short
of the grants.

### And one measurement that confirms the setting, after one that did not

`sects.md` and `realms.ts` both say Core Formation is where *"sects stop recruiting you and
start negotiating with you."* Read against `rankRealmBand` in `members.ts` - the only number
in the catalog that says what rung a house may seat a given realm at - over all 32 houses:

```text
ordinal 12   19 houses would recruit,  6 court,  3 defer,  4 turn away
ordinal 13   17 recruit,              10 court,  3 defer
ordinal 16    8 recruit,              14 court,  8 defer
ordinal 17    6 recruit,              12 court, 12 defer      <- the crossover
ordinal 20    0 recruit,               9 court, 21 defer
ordinal 24    1 recruit,               1 court, 29 defer
```

**At Core Formation Perfection no house in the world has a disciple's place for you.** The
prose is right, it is right at the rung it names, and nothing was tuned to make it so.

*Recruited* is a rung below the house's elder line; *courted* is an elder's rung, because
offering somebody leadership is a negotiation whatever it is called; *deferred to* is the
top rung or past the whole ladder, where nothing the house says is an instruction. The
elder line is `elderRungOf` from `leadership.ts`, so a four-rung court and a six-rung
pavilion are handled identically.

**The retraction.** The first version of this section reported the opposite - *"at Core
Formation Perfection, twenty-three of thirty-two houses would still take you in at the
bottom"* - and concluded the crossover landed in Deity Transformation and the prose should
move. That was a harness error of exactly the kind `AGENTS.md` warns about, and it was in
the question rather than in the data. It asked for the **lowest** rank whose band could
still *hold* the cultivator (`maxOrdinal >= ordinal`), which for a house with a high
`powerOrdinal` is rank 0 at almost any realm, because those bands are wide. The question an
institution actually asks is the **highest** rung the person's weight justifies
(`minOrdinal <= ordinal`), and asking it that way produces the table above. The wrong
reading is preserved here because a number nobody can trace is worth less than a number
with its retraction attached, and because the two differ by a factor that would have got
the setting rewritten.

---

## Qi Condensation - ordinal 0 to 12

The floor. A mortal with a party trick.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | Nothing opens at a rung. What you can see is a knowledge question (`social/knowledge.ts`, `discovery.md`), not a realm one - and at this realm that is right |
| 2 | survive | **built** | `SATIETY_BURN_BY_REALM.qi_condensation` is `1` - full mortal arithmetic, ~50 days of belly. `BARREN_GROUND_CEILING = 12`: thin ground cannot carry anybody past this realm. Location `entry`/`survival` thresholds and `standingConsequence` price hostile ground in HP per day |
| 3 | do | **built** | The whole verb surface: gather, sell, refine (recipes open at ordinal 0), work, market, join a house, learn techniques, take commissions. 24 techniques and 10 recipes in band |
| 4 | asked of | **built** | `duties.ts`: 6 of 8 summons entries and all 5 commission entries pitched here. Summons need membership; the board does not |
| 5 | risk | **built** | Deviation, injuries that never heal, starvation, settling, stagnation. The named deaths are all reachable here - though not `untreated_injuries`, which is retired: a channel wound impairs and never kills. See `docs/world/injuries.md` |
| 6 | opportunity | **built** | Market, foraging, `quoteSale` through the regard margin, stipend, `origin.ts`'s income curve |

**Nothing is needed here.** The realm is complete and it is the densest part of the game.

---

## Foundation Establishment - ordinal 13 to 16

The game's first true gate, and currently the emptiest crossing on the ladder relative to
what the setting claims for it.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | Nothing |
| 2 | survive | **built** | `SATIETY_BURN_BY_REALM.foundation_establishment = 1/24` - a full belly goes from fifty days to **something over three years**. This is the single most concrete thing 13 buys and it is a genuine decision change: a multi-year seclusion stops needing a supply chain. Lifespan 100 -> 200. And you are past `BARREN_GROUND_CEILING`, which is a precondition rather than a new place opened |
| 3 | do | **absent** | `CLASS_GRANTS.mortal = []`. Technique address band unchanged. 18 techniques and 5 recipes newly in reach - a supply increase, not a new kind of act. No residence, no formation-laying, no artifact-making, no realm-keyed disciple-taking |
| 4 | asked of | **absent** | 1 of 8 summons entries pitched in band, 0 commissions. Membership is still the gate, and 29 of 32 houses still seat you at the bottom |
| 5 | risk | **built** | The **Price of Advancement** first falls here: `price-of-advancement.ts` returns 0 below `FOUNDATION_ORDINAL`. The first severance is the first realm boundary, and it is the strongest thing 13 currently means. Also `the-world-changing-on-its-own.ts` puts you in the `disappearance` pool from 13 |
| 6 | opportunity | **indirect, and posthumous** | `time.ts` sets a death fact's visibility to `regional` at `>= 13`; `legacy.ts` marks you `notable` for a house's ancestral hall at `>= 13` and puts a `formation` hazard on your grave. **All three fire on death only.** The engine already believes ordinal 13 makes a person regionally visible, and the only way to find out is to die |

### What Foundation Establishment should mean, and what each would cost

The worked list, with the verdict on each:

| Meaning | Verdict | Note |
|---|---|---|
| A permanent cultivation residence | **absent** | `settleAbode` exists and is **immortal-layer only** (`immortal-world.ts`). Below the Lid a cultivator has nowhere that is theirs, no place to store anything, nothing to defend. The generic machinery is all present - locations have owners, objects have `locationId`, `evaluateAccess` gates a door - so this is a call site, not a subsystem |
| Basic formations | **absent** | There is no formation system anywhere. `'formation'` is a hazard string, a `CapabilityModifierSource`, and a location affinity. Nothing lays one |
| Storing and manipulating qi in more sophisticated ways | **built, invisibly** | This *is* the satiety table and the progress curve. It needs saying, not building |
| Establishing a personal inheritance | **absent for the living** | `legacy.ts` builds a gated grave when you die. Divestment before a crossing is named in `price-of-advancement.ts` as the author of the whole inheritance economy and there is no verb for it |
| Taking disciples | **indirect** | `leadership.ts` grants it at the **elder rung of a house**, derived from `ELDER_RUNG_FRACTION`. Not keyed to realm, and unavailable to anybody outside a house |
| Being a recognised local cultivator | **indirect** | `regard.ts` bands move with the ordinal, so prices, yields, refusals and reactions all change. Nobody remembers your name; the room simply prices you correctly |
| Surviving environments mortals cannot | **built** | Location thresholds, `standingConsequence`, the satiety table |
| Making artifacts and medicine rather than buying them | **half built** | Medicine: fully built, and **not a Foundation capability at all** - `alchemy-manage.refine` opens at recipe `requiredOrdinal`, and three recipes sit at ordinal 0. Artifacts: absent. There is no forge verb and no crafting path to `artifacts.ts` |

---

## Core Formation - ordinal 17 to 20

The realm the setting says the most about and the engine says the least.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | Nothing |
| 2 | survive | **indirect** | `SATIETY_BURN_BY_REALM.core_formation = 1/120` - roughly sixteen years of belly. Lifespan 500. No environment opens |
| 3 | do | **absent** | `CLASS_GRANTS.core = []`. Address band still `body`. `realmClassForOrdinal` returns `'core'` and the class carries nothing |
| 4 | asked of | **was absent, and was the largest single gap in the audit** | `summonsPool` returns `[]` when `membership` is null. `petition`, `posture`, `seal` and `offer` are gated on `rankIndex` inside a house and never on realm - `src/web/standing.ts` says so in as many words: *"Every gate in this file is on the RANK"*. So a Core Formation cultivator with no house could be asked for nothing by anybody, and could ask nothing of anybody. Now answered by `what-a-house-asks-of-somebody-it-cannot-order.ts` |
| 5 | risk | **indirect** | `legacy.ts` scales your death fact to `regional` at `>= 17`. Nothing while alive. "Power creates problems" is stated in the cultivation README and modelled at no rung |
| 6 | opportunity | **indirect** | The regard bands. That is the whole of what changes at 17 |

**The lore claim, mechanically:** *"you are no longer merely a person in the world, you are
an institutionally relevant individual."* The engine had one direction of that arrow
(`duties.ts` - the house asks you for work, if it owns you) and none of the other. Political
attention, discipleship offers, sect negotiations, territorial claims, inheritance requests,
alliance offers and founding a house are all variations on **an institution putting terms to
somebody it cannot command**, and there was no object in the engine that represented one.

`src/engine/encounters/what-a-house-asks-of-somebody-it-cannot-order.ts` is that object. It
is the mirror of `duties.ts`, authors no content, names no faction, and derives every part
of an offer from a column the house already carries: the rung from `rankRealmBand`, its pay
from `stipend[]`, what the house can shield from `powerOrdinal`, what accepting costs from
`rivals` and `ambition.contestedWith`. The most valuable thing on the table is
`sectProtection` - the 0..1 input `computePriceOdds` has taken since it was written, worth
`MAX_SECT_PROTECTION` and the single largest relief at a realm boundary, which until now
only a membership rank could supply. A house cannot shield past its own reach, so the strong
houses' offers are worth more and their terms are worse, and that is the decision.

What is still absent at Core Formation: perception, environment, and any realm-keyed change
to what an art may be about.

---

## Nascent Soul - ordinal 21 to 24

The best-implemented boundary on the ladder, and the model for what the others should look
like.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | |
| 2 | survive | **built** | `soul_persists` and `prepared_vessel` in `CLASS_GRANTS`; `tradition.ts`'s `SOUL_PERSISTS_FROM_ORDINAL`; the whole `existence.ts` state set; `prepared_vessel` neutralises `body_lethal`, `crushing`, `pressure`. Note that `soul_persists` as a *grant* is inert - the work is done by the ordinal check in `tradition.ts` |
| 3 | do | **built** | `ADDRESS_ORDINAL_FLOORS.place = 21`. An art stops needing somebody to aim at. This is the only place on the ladder where "what you can do" changes in kind and the change is enforced |
| 4 | asked of | **absent** | Zero summons entries pitched at or above 21. `duties.ts` has nothing to offer anybody above Core Formation |
| 5 | risk | **built** | Possession meets resistance, reconstruction costs, a remnant is not the person, `soul_state`, `identity_continuity` |
| 6 | opportunity | **absent** | Nothing. An eight-hundred-year lifespan changes no economic position anywhere in code |

---

## Deity Transformation - ordinal 25 to 28

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | *"Spiritual perception extends across a region rather than a field"* is stated in the cultivation README and implemented nowhere. There is no regional perception call |
| 2 | survive | **built** | `carries_own_ambient` neutralises `thin_qi`. `SATIETY_BURN_BY_REALM.deity_transformation = 0` - **starvation stops being reachable**, which is the removal of one of the five deaths and is a genuine categorical change |
| 3 | do | **declared and inert** | `suppresses_lesser` is in `CLASS_GRANTS` and is read by nothing. Presence-as-suppression does not exist |
| 4 | asked of | **absent** | |
| 5 | risk | **absent** | |
| 6 | opportunity | **absent** | *"Standing somewhere for a long time alters the site, which is why their old dwellings are worth finding"* - described, and nothing writes it. The location layer would take it without a schema change |

### What the realm confers, and what a failed transformation keeps

**A Deity carries their own conditions with them - everywhere, continuously, in every
direction.** That is the whole of it, and `carries_own_ambient` is the right name for it. The
conditions are not somewhere they go; they are something they bring, and they do not stop
bringing it.

**A failed transformation keeps the ability and loses three separate properties of it:**

| Property | A full Deity | A failed transformation |
|---|---|---|
| **Range** | Whatever they are standing in | Much shorter |
| **Duration** | Continuous. It does not stop | Channelled, for a limited time, and then it burns out |
| **Coverage** | Every direction at once | Directional. It comes off a fist or a leg, not a sphere |

They are not a lesser Deity in general. They are a Deity who has to *spend* something to be
one, briefly, in one direction at a time.

**Note the shape, because it recurs above this realm and the engine cannot currently express
it.** `carries_own_ambient` is a boolean grant: you have it or you do not. The failure mode
here is not the absence of the grant, it is the same grant with a radius, a clock and an arc
on it. A capability layer that can only say yes or no cannot say this.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **built** | `reads_formations` is special-cased in `judge`: up to 8 ordinals off `understand` where the subject carries the `formation` hazard. The only perception capability keyed to a realm anywhere in the engine |
| 2 | survive | **built** | `no_ambient_needed` and `enters_dead_zones` between them neutralise `thin_qi`, `dead_zone`, `void`, `sealed_qi`, `scar` |
| 3 | do | **built** | `spatial_folding`, consumed by `convergence.ts` as the escape from a closing window - and deliberately short-range, so it narrows as the window wanes. The one grant with a real consumer outside `capability.ts` |
| 4 | asked of | **absent** | |
| 5 | risk | **absent** | |
| 6 | opportunity | **indirect** | The README calls `no_ambient_needed` *"the single most consequential grant on the ladder"* because it decouples a cultivator from the scarcity the world is organised around. That decoupling is real in the cultivation-rate arithmetic and has no economic expression: nothing anywhere makes such a person a different kind of trading partner |

### What the realm confers, and what a partial refinement keeps

Two things: **folding space**, and **independence from ambient qi**. Refining the self against
emptiness is what buys both.

**A partial refinement is the clearest case in the setting of a capability that degrades rather
than switching off**, and it degrades differently in each of the three:

| | A full refinement | A partial refinement |
|---|---|---|
| **Spatial folding** | Held | **Denied outright.** The one binary of the three |
| **Surviving scars and voids** | Any of them | **The weak ones only.** What a full refinement walks into unbothered still kills this one |
| **Ambient qi** | Needs none at all | **Still needs it - a great deal less.** Reduced, never removed |

So the road is open to thin ground and closed to the deep places, and they are cheaper to keep
than anybody below them and not free. The middle row is the one worth designing carefully: it
is not "survives voids: false", it is a lower bar in the same units the location layer already
prices hazards in.

---

## Body Integration - ordinal 33 to 36

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | |
| 2 | survive | **built** | `no_seam` neutralises `soul_pressure`/`soul_suppression`; `immune_contamination` covers corrosive, contaminated, corrupted, poison, plague, forbidden. The widest hazard coverage on the ladder |
| 3 | do | **built** | `ADDRESS_ORDINAL_FLOORS.condition = 33`. Arts stop addressing who is standing there and start addressing what the place is like |
| 4 | asked of | **absent** | |
| 5 | risk | **indirect** | The cultivation README's own counter - *"you attack their obligations, their sect, their disciples, their karma"* - is representable through `social/` and is nowhere connected to the realm |
| 6 | opportunity | **absent** | |

### What the realm confers, and what a failed integration keeps

**No seam, and no soul to strike.** Body and soul are welded from the sinew inward until there
is no join anywhere to get at, which is why the ordinary ways of ending somebody stop working.

**A failed integration still has a seam, and still has a soul to attack.** One place did not
close, and everything about how they fight is built around not being touched there.

**But most of it IS stitched, and that half matters as much as the first.** This is an
impairment among the great, not a demotion: a failed integration remains far stronger than
anybody below the realm, and reading the wound as "not really Body Integration" gets it exactly
backwards. They are Body Integration with one way in. The whole difficulty they present is that
finding it is hard and knowing it is worth a great deal.

---

## Grand Ascension - ordinal 37 to 40

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **declared and inert** | `reads_lid` is read by nothing |
| 2 | survive | **built** | `gates_places` zeroes every location requirement except `understand`. No longer gated by places |
| 3 | do | **misnamed, and inert** | `makes_veins` and `seals_domains` are read by nothing, and they are now also **wrong**. See the redefinition below: a Grand Ascension does not make spiritual veins. Both grant strings need renaming before anybody implements against them |
| 4 | asked of | **absent** | |
| 5 | risk | **absent** | *"Their attention is itself a hazard. Being noticed by one has consequences before anything is done to you."* Nothing models being noticed |
| 6 | opportunity | **absent** | |

### What the realm confers - REDEFINED, and this supersedes the row above

The design owner has restated what this realm is for, and it is not what `CLASS_GRANTS` says.
**They do not make spiritual veins.** Anything written against `makes_veins` or `seals_domains`
is written against a capability this realm does not have.

What a Grand Ascension actually does is two things, and both are about the world rather than
about themselves:

**1. The technique draws the qi, not the cultivator.** Their arts reach out into the world
around them, and the arts themselves take qi in - the cultivator is no longer the thing doing
the drawing. The visible consequence is that **standing near one changes how everybody else
cultivates**: near a Grand Ascension of fire, a fire cultivator advances faster. Not as a
favour, and not as something aimed at them. It is simply what the neighbourhood of such a
person is like.

**2. They leave lasting works of their element on the land.** They can create things on the
earth, of their element, and those things **remain long after the maker is gone.** This is a
distinct kind of persistence from a spiritual vein and must not be modelled as one: a vein is
ground that produces qi, and this is a made thing that stays made.

### What an unfulfilled ascension keeps

**Everything, imperfectly, and briefly.** They can still do both halves - the works still get
made, the presence still reaches out. What they cannot do is make any of it last: **their
abilities burn out a great deal sooner**, so what a full Grand Ascension leaves permanently, an
unfulfilled one leaves temporarily.

The setting's own worked example, and worth keeping because it is exactly the kind of event the
world should be able to produce without anybody authoring it: **an angry Grand Ascension puts a
giant flaming ball on the ground next to a rival sect as a warning.** It is real, it is theirs,
everybody can see it - and unlike the works of a whole one, it will not be there in a century.

---

## Tribulation Transcendence - ordinal 41 to 44

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **absent** | |
| 2 | survive | **built, inverted** | `triggersHeavenlyTribulation` fires on entry, on every step within, and on exit. This is the one realm where the boundary makes you *less* safe, and it is fully implemented |
| 3 | do | **declared and inert** | `opens_lid` is read by nothing. `ADDRESS_ORDINAL_FLOORS.settled = LAST_CROSSING_ORDINAL` does fire at 44 |
| 4 | asked of | **absent** | |
| 5 | risk | **built** | `FAILURE_TABLE.lastCrossing`, `LAST_CROSSING_PROGRESS_LOSS = 1`, scars as permanent geography, and the **stranded** ending. `assessLastCrossing` makes declining a real position. The most complete decision in the game |
| 6 | opportunity | **absent** | |

### What the realm confers, and what an imperfect tribulation body keeps

The document has been reading this realm as *"survives tribulation"*, which is the requirement
rather than the capability. **A tribulation body is what a cultivator must have to withstand
the lightning at all** - and what it leaves them with afterwards is much larger than that.

**They gain resistance to all the elements, lightning included, and they begin to BE the
elements** - regardless of what they cultivated on the way up. A fire cultivator who comes
through does not stay a fire specialist who is merely tough. Put one of them anywhere: in ice,
in earth, in a sea of lightning, in the sea. **They are perfectly at home.** The reason is
structural rather than a matter of degree: a tribulation body is a function of a tribulation,
and a tribulation is a natural law.

**An imperfect tribulation body is incomplete**, and the incompleteness shows in exactly one
way: **they cannot remain in those places indefinitely.** They can go anywhere a whole one can
go, and they cannot stay. Their tolerance runs on a clock where a full transcendent's does not,
and they have a weakness where a full one has none.

**This is the largest single thing missing from the capability layer**, and it is worth saying
plainly because it reframes the top of the ladder: it gives **environmental hazards a meaning at
the top rungs that they currently do not have.** At present the hazard machinery peaks at Void
Refinement and Body Integration and then stops mattering, and `gates_places` at Grand Ascension
zeroes location requirements outright - which now looks like it was put one realm too low and
one degree too absolute.

#### And in a fight: the elemental is the thing that stops working

The mechanical face of being at home in every element, and it is one rule:

> **A tribulation body resists the elemental. Everything else goes through it.**

Two terms, and both matter:

- **Less damage from every element**, uniformly. That is being at home in all of them.
- **Extra less from the element of their own cultivation**, on top. A fire cultivator's
  tribulation body is hardest of all to burn.

**It is resistance and never immunity.** Two of them fighting still ends with somebody dead,
given enough time. The days-and-nights duel is the *result* of a large reduction applied to real
damage, not of a fight that cannot be won - so if the numbers ever make two of them unable to
hurt each other at all, the numbers are wrong. **State them in this document when they are
chosen**, because the duel length is the point and somebody who does not know that will tune
them on some other basis.

**Why the duel is long:** everybody who gets that high got there on some road, and at the summit
the ordinary weapon is the one that barely works. Nobody writes that scene. It falls out of the
reduction.

**And the counter is anything that is not elemental.** Not a list of exceptions - a rule with
examples. An ancient art, a weapon art, a strike out of the dao of karma: all three go through
for the same reason, which is that none of them is made of an element. Stating it as a rule
rather than a list matters, because a list goes stale the moment somebody adds a domain and the
rule will not.

##### The field to read, which is NOT the one the rule is phrased in

The rule is naturally stated as *"resists the element domain"*, and `InsightDomain` really does
carry `element` alongside `weapon`, `body`, `formation`, `alchemy`, `karma`, `life_death`, `time`
and `void`. **But `domain` is the wrong field to implement against, and the catalog says so:**

```text
arts by dao domain (138 arts)
  none 113 | body 5 | element 5 | void 4 | life_death 4
  formation 3 | time 2 | karma 1 | weapon 1
```

Only 25 arts carry a dao domain at all and only **5** carry `element`, so a resistance keyed on
`domain` would resist five arts in the world. The field that says what an attack is *made of* is
`element`, which is populated and splits the catalog nearly in half:

```text
elemental 69 | elementless 69
  ancient  15 arts, 15 elementless (100%)
  modern  123 arts, 54 elementless (44%)
```

The two axes are genuinely different rather than redundant, and one row proves it: **Clear
Terrace Ascension Canon gates on `weapon:3` and is `element: metal`.** A non-elemental dao can
produce an elemental art. **So read `element`.** The domain framing is the correct description
of the rule and `element` is the column that carries it.

**Read `element`, never `era`.** The guard in `schema/cultivation.ts` is explicit that an ancient
art must never simply be stronger, or the era axis collapses into "old wins". It does not
collapse here: elementless arts exist in both eras, and at ordinal 37+ there are 20 modern arts
of which 15 are already elementless. An ancient art is *always* an answer and never the *only*
one, which is the correct shape. Do not oversell it.

##### What this buys the rest of the setting

**The deep roads were already domain-gated away from the elemental, and nobody arranged it.**
The seven roads that reach cap 45 gate on `void:2`, `weapon:3`, `formation:3`, `body:3`,
`void:3`, `life_death:3` and `time:3`. **Not one gates on element.** The roads that carry you to
the summit are the roads whose understanding still works there.

It also explains why the top of the ladder cares about dao at all. Below it an elemental road is
simply a road; above it, it is the one thing that stops working on the people you are now
fighting. That is a far better reason to seek understanding than "the gate asks for it".

**Ancient arts: unteachable by design, not by omission.** Measured across all 34 houses, which
between them shelve 87 distinct arts: **not one of the 15 ancient arts is on any shelf.** That
has been read as a content gap. It is not - it is the point. An art that reliably answers a
tribulation body cannot be enrolled for and has to be **found**, which is what the deep ruins and
the closed ground are for, and which joins that whole body of work to the summit for the first
time.

**Objects, for the same reason.** A weapon is not elemental either, so a body that shrugs off
fire and lightning can still be *cut* - and the thing that cuts it is an object somebody has to
be given. [`items.md`](items.md) already says that above a certain grade an object moves on a
favour owed rather than a price, and the register already tracks who holds which artifact at
what grade. **This is why.** At the summit the answers are an ancient art, found in closed
ground, or an object, which is not for sale.

##### The imperfect version

Both terms are diminished, and the second one is where the setting's word *weakness* lives. A
whole tribulation body is at home in everything **equally**; an incomplete one is not, so its
resistance should be **gapped rather than merely lower**. A uniformly smaller number says
"slightly worse" where the setting says "has a hole in it", and the hole is the whole point: it
is what somebody hunting them would go looking for, and what they would spend a life hiding.

##### The hook, specified but NOT built

`combat.ts` is contended, so this is written down rather than implemented. It belongs in damage
resolution, where the incoming art is already known:

- **Read** the incoming technique's `element` (null means elementless), and the defender's realm
  ordinal, own element, and untreated wound list.
- **Apply**, when the defender is at Tribulation Transcendence or above and the incoming art has
  a non-null `element`: a uniform reduction, plus a further reduction where the incoming element
  matches the defender's own. Elementless arts are unreduced at any rung.
- **Never** reduce to zero. The fight has to be able to end.
- **Differ** for `imperfect-tribulation-body`: both terms shrink, and the resistance gains a gap
  rather than staying flat. Deriving which element leaks from something already on the
  cultivator - their root or their road - keeps it deterministic and adds no catalog field.
- **Do not** key any of this on `era` or on `domain`. See above for both.

---

## Immortal - ordinal 45 to 46

The brief's realm list stops at 41-44. There are two more rungs; `MAX_ORDINAL` is 46. They
are not a realm anybody buys into - `isRealmBoundary` returns false for 45 -> 46 and the
single crossing from 44 lands on one of them - so the six questions read differently, and
mostly they are already answered.

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **built** | `readTwoWays` - a newcomer is measured both against the world they left and the world they arrived in |
| 2 | survive | **built** | Tribulation and lifespan both stop. Two hazard rates remain (`advanceImmortalLayer`), and `MAX_PERIL_RELIEF` is deliberately short of 1 |
| 3 | do | **built** | `ADDRESS_ORDINAL_FLOORS.decree = 46`. `settleAbode`. `sendAcross` through a channel object |
| 4 | asked of | **built for 45** | 8 encounters pitched in band. A False Immortal is inside the world's reach and that is the whole difficulty they present |
| 5 | risk | **built** | `BREATHS_IN_THE_LOWER_REALM`, the descent tribulation, death above written as a secret fact that settles nothing below |
| 6 | opportunity | **built** | `immortalStanding` scores tenure, ancestry, house, allies and holdings, and a newcomer scores zero on every axis |

### What separates the two rungs, which is the whole of the tier

**A True Immortal's word is law.** Not persuasive, not enforced, not backed by the ability to
carry it out personally - it simply becomes true. They say a Tribulation Transcendence comes
here, dies, and leaves what it was carrying, and that is what happens. They declare a house to
have blown up and it blows up.

Two constraints, and they are the whole of the constraint:

- **It must be physically possible.** Law does not make the impossible happen; it selects among
  things that could occur.
- **It happens as soon as that possibility allows** - not instantly by fiat, but at the first
  moment the world can deliver it.

**A False Immortal cannot do this at all.** Their words do not do things and cannot reach
natural law. What they have instead is a very good imitation: **they put law into a working**,
and the working carries it for a while. A bird made to navigate to a place will go there - and
it eventually runs out.

So the split between 45 and 46 is not a difference of degree in power. It is:

> **Law embedded in a made thing, which expires, against law spoken, which is simply true.**

That is also why a False Immortal is inside the world's reach and a True one is not, which the
`asked of` row above already records from the other direction.

The measured result the design should generalise from: **75 missed windows against 15, with
identical event counts.** Fortune is not "your luck stat makes your numbers bigger", it is
*"your life contains more opportunities"*. Counting where each attribute is read:

| Attribute | Files in `src/engine/` that read it | What it currently does | The affordance it should have |
|---|---|---|---|
| **Fortune** | 14 | **Already an affordance.** `time-skip.ts` and `price-of-advancement.ts` move whether an opportunity is drawn, whether it is still there when reached, whether the danger arrives on top of you. Deliberately absent from `breakthrough.ts` | Nothing needed. This is the model |
| **Insight** | `understanding.ts`, `breakthrough.ts`, `capability.ts` | Half an affordance. `discoverableInsights` genuinely gates *which comprehensions exist for this person* - that is an affordance. But `standingFor` in `capability.ts` reduces it to `ordinal + insight * 2` on the `understand` predicate, which is a number | *"You notice something in the inscription nobody else understood."* The machinery is already there and unused: `CapabilitySubject.comprehensionKeys` are **absolute** - hold the key and you read the door at any realm. Insight should be able to *produce* a comprehension key from an encounter, not add two ordinals to a comparison |
| **Might** | `combat.ts`, `capability.ts` | A number, twice. `ordinal + might` on the `force` predicate, and a term in `assessPower` | *"You survive attempting something your body should not have survived."* The survival layer has no attribute input at all. Might should buy a bounded, exhaustible number of survivals of things that were priced lethal - the exact shape `origin.ts` already uses for `survivableRisk`, which is the precedent and is generic |
| **Charm** | **0** | Read in exactly two places in the whole repo, neither of them the engine: `sect-manage.ts` as an admission gate (`minCharm`), and `web/asked.ts` as a stated margin. It is the least-implemented thing in the game | *"The elder remembers your name."* The social layer already stores relationships, and `gatherings.ts` already writes ties with the fact id that produced them. Charm should decide whether a one-off contact **persists as a row** - not how well a conversation goes |

Charm is the clearest case in the audit of a dealt attribute that is a number and nothing
else, and the fix does not need a new subsystem: `relationships.ts` is already the store,
and "did this encounter leave a row behind" is already the question it answers.

---

## Recommended order

Ranked on how much each changes the *kinds of story* the simulation can produce, per unit
of new machinery. Nothing here is bespoke; every item reads columns that already exist.

1. **An institution putting terms to somebody it cannot command.** Core Formation's missing
   half, and the mirror of `duties.ts`. It is the largest gap, it is stated in the setting,
   it produces decisions rather than bonuses (which terms, from which house, knowing the
   rivals are watching), and it rides on `opportunities.ts` windows, so a Fortune-rich
   cultivator gets more approaches and a Fortune-poor one misses them - the measured result
   the design already likes, applied to politics.

   **Done, as arithmetic:** `src/engine/encounters/what-a-house-asks-of-somebody-it-cannot-order.ts`.
   **Not done, and next:** the draw site. It is `attemptSummons` in `window.ts`, which is
   where a summons already becomes an occurrence that interrupts a time-skip. An approach
   should arrive the same way and on a Fortune-weighted chance, and it should carry a window
   that closes - a house that put terms to somebody and was not answered does not ask twice,
   which is already what `Approach.declining` says. Held out of this change because
   `window.ts` and the encounter payload types are in flight.
2. **A residence below the Lid.** `settleAbode` generalised off the immortal layer. Gives
   Foundation Establishment a place, a store, and something to lose. Locations, objects and
   access gates are all already generic; this is call sites and a migration.
3. **A decision about `heldGrants`, before any grant work at all.** This was *"the five inert
   grants - cheapest possible win, the class arrays already carry them and the predicates are
   already the right shape"*, and that was wrong for the reason the correction above gives:
   implementing `suppresses_lesser` or `makes_veins` would wire them to `heldGrants`, which is
   empty for every cultivator, so the work would produce nothing observable and would look
   finished. The cheap win is not cheap; it is unreachable.

   **Now ruled on: capability is enforced.** So the order inverts. Make the actor hold what
   reaching a realm has earned it, so that a grant can be asked about at all; then add denials
   one at a time, each at a consumer that can be named. Do not implement a grant that nothing
   will ask about - that is the same mistake in a new coat, and it is how this layer got here.

   The one piece of the old design worth keeping is the distinction it was built on: a realm
   confers POTENTIAL, and some capabilities are still arranged for rather than given. A
   prepared vessel is arranged; being at home in ice is not. Those are different questions and
   only the first needs anybody to have gone and done something.
4. **Charm as persistence.** One question - does this contact leave a relationship row -
   answered against a store that already exists.
5. **Divestment as a verb.** The engine already names it (`price-of-advancement.ts`) as the
   author of the entire inheritance economy, and `legacy.ts` already builds gated graves.
   Only the living-cultivator entry point is missing.
6. **Formations.** The biggest build, the least leverage relative to its cost, and the one
   most likely to become a stat. Do it last, or not at all.

Explicitly **not** recommended: filling `CLASS_GRANTS.mortal` and `CLASS_GRANTS.core` with
grants. Six of the fifteen that exist are inert already. Adding two more empty arrays' worth
of strings would make the audit worse, not better.

---

## Related

- [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) - what each realm makes possible, asserted
- [`../../src/engine/world/README.md`](../../src/engine/world/README.md) - the five predicates, environmental gating
- [`techniques.md`](techniques.md) - what an art may be ABOUT, by height
- [`sects.md`](sects.md) - houses as institutions
- [`understanding.md`](understanding.md) - the axis that is not accumulation
