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

**One row of this audit has since been answered, and it is worth reading as the model for
the rest.** `perceive` was `absent` at every rung from Qi Condensation to Body Integration
when this was written. It is now `built` from ordinal 15 up, and the thing worth copying is
not the feature - it is that it needed **no grant, no new predicate and no capability
class.** It is one number keyed on the ordinal, consumed by a verb that already ran, at the
point where the answer changes what the player does next. The three capabilities this
document already calls genuinely enforced have exactly that shape, and the fifteen inert
grants do not.

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
| 1 | perceive | **built** | `what-you-can-see-from-up-there.ts`. Ordinal 15 - `gale-riding-sword-flight`'s own requirement - is where a cultivator gets off the ground, and the discovery layer stops being entirely a matter of being told. The horizon at first flight is two travel days: your own province and nothing past it, since the shortest stated road is six. Consumed by `destinations` in `game.ts`. **The first perception capability keyed to a realm that a living player actually reaches** - `reads_formations` at Void Refinement is grant-gated and therefore off |
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
| 1 | perceive | **built, twice** | `READS_A_VEIN = 17` in `what-you-can-tell-about-the-ground.ts`: the surveyor's figures for a vein, where Foundation gets the crowding and Qi Condensation gets a feeling. And the sight horizon keeps growing - about four days of road here, still short of anywhere else |
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
| 1 | perceive | **built** | Ordinal 22 is `thousand-li-cloud-tread` - "sustained flight at the height where the air thins and the birds stop" - and the horizon reaches about twelve travel days, which is the near provinces and not the far ones. The first rung at which a cultivator sees ground outside the province they are standing in |
| 2 | survive | **built** | `soul_persists` and `prepared_vessel` in `CLASS_GRANTS`; `tradition.ts`'s `SOUL_PERSISTS_FROM_ORDINAL`; the whole `existence.ts` state set; `prepared_vessel` neutralises `body_lethal`, `crushing`, `pressure`. Note that `soul_persists` as a *grant* is inert - the work is done by the ordinal check in `tradition.ts` |
| 3 | do | **built** | `ADDRESS_ORDINAL_FLOORS.place = 21`. An art stops needing somebody to aim at. This is the only place on the ladder where "what you can do" changes in kind and the change is enforced |
| 4 | asked of | **absent** | Zero summons entries pitched at or above 21. `duties.ts` has nothing to offer anybody above Core Formation |
| 5 | risk | **built** | Possession meets resistance, reconstruction costs, a remnant is not the person, `soul_state`, `identity_continuity` |
| 6 | opportunity | **absent** | Nothing. An eight-hundred-year lifespan changes no economic position anywhere in code |

---

## Deity Transformation - ordinal 25 to 28

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **built, and it arrived on its own** | *"Spiritual perception extends across a region rather than a field"* is the cultivation README's claim, and ordinal 26 is where the sight horizon first covers the widest road in the world (34 days). **Nothing was tuned to make that land here.** The curve is two anchors off the flight arts and one growth constant; the realm it saturates at is where it saturates. What is still absent is anything that perceives a PERSON at range - this channel gives geography and deliberately gives nothing else |
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

#### And in a fight: the body ADAPTS to whatever you lean on most

The tribulation body is not a fixed resistance profile. **It adapts, during the fight, to
whatever is being used against it most.** Hit it with fire long enough and fire stops working.
That is a mechanic rather than a stat, and everything else about the realm falls out of it.

> **Repetition stops working. Variety is the counter.**

**Two layers, and both are needed.** They do different jobs and neither substitutes for the
other:

| Layer | What it is | When it applies |
|---|---|---|
| **The elemental floor** | Broad, shallow, inherent. The tribulation body itself: they have started *being* the elements, because a tribulation is a natural law | Always on, before anybody has thrown anything |
| **The adaptation** | Narrow, deep, learned. One close against one kind of harm | Grows during the fight, moves when what you lean on moves |

The floor is why the ordinary weapon barely works at the summit - almost everybody arrives
carrying an element. The adaptation is why leaning on *anything* stops working.

**Both layers speak the same vocabulary, which is what makes them one design rather than two.**
The floor covers the **elemental damage types** - fire, cold, lightning and their neighbours -
and the adaptation closes **one type**, whichever is arriving most.

That also explains, without a special case, why ancient arts and the deep daos work up there:
**a strike out of karma, a working on the mind, or harm that is simply force never went under
the floor to begin with.** They are not exempt from the adaptation - lean on one and it closes
like anything else - but they start above the floor rather than under it, which is the whole of
their advantage and is a much smaller claim than "they bypass a tribulation body".

**And it can only adapt to ONE thing at a time.** This is the constraint that makes the whole
capability precise, bounded and playable, and it should be the first thing anybody implementing
it reads. The body closes one door - whichever it is being hit with most - and while that door
is shut, every other one is open.

**The grain is one KIND OF HARM, and this is the part most easily got wrong.** It adapts to
**fire**, not to elements. To **cutting**, not to swords and not to one sword road. To **what
mind control does**, which is not what a blade does. Hitting it with an ancient art teaches it
the injury that art inflicts, not ancient arts as a class and not that art by name. See the key
section below: the body never sees the technique.

**So the counter is a near-even split: 51% of one thing and 49% of another.** The body adapts to
the majority; the minority keeps landing at full effect for the entire fight. That is a real
piece of play, discoverable at the table, and it is worth stating in exactly those terms because
it teaches the mechanic faster than any description of it.

**And because the key is the kind of harm, the split works between any two KINDS.** Fire and
water is a working answer - one burns, one does not. **Two sword roads are not**, however
different the two schools look on paper: both cut, so the body has only ever felt cutting and
closes against it once. That is the test to apply to any pair, and it is not "are these two
different arts" but **"do these two hurt differently"**.

That is the fight-sized version of a rule the setting already holds about whole lives: a narrow
life makes a narrower cultivator. Here it takes an afternoon rather than three centuries, and it
is the same lesson - **the person who only ever learned to do one thing is the one it stops
working for first.**

##### It is still very strong, and the counter has a price

Nothing above weakens the realm, and it is worth saying because a mechanic described mostly by
its counter starts to read like one.

**People lean on what they are best at.** So *most-used* is *best*, and a tribulation body closes
against precisely the opponent's strongest move - which is the single most valuable thing a
defence can do. It is not a generic damage reduction; it is a defence that finds the worst thing
coming at it and shuts that.

**And running the counter costs you.** To hold a 51/49 split you have to spend half the fight
using your **second-best** kind of harm, against somebody at the summit of the ladder. That is
the price, it is a real one, and it is what keeps the capability strong without making it
invincible: **the answer exists, and taking it means fighting worse.**

##### Where it comes from, which is the same organ

The tribulation body is not a combat feature that happens to help at a crossing. **The crossing
is its origin.**

The lightning of a tribulation arrives strike after strike after strike - the same harm, poured
on, repeated past any reasonable endurance. **That is what a tribulation body is for and how it
works: it adapts to the lightning while the lightning is happening**, and that is what makes the
crossing survivable at all. What walks out the other side is an organ that has learned to do that
to *anything*.

So everything it does in a duel is the same organ pointed at a person, and the resemblance
between "survives the tribulation" and "your best move stops working" is not a coincidence or an
extension. **It is one mechanism, described from two ends.** A tribulation body is a function of
a tribulation, and a tribulation is a natural law.

**Switching moves the adaptation, and that is the whole texture of the fight.** Lead with fire,
get adapted to, switch to the sword - and the body must give up its fire adaptation to close
against the sword, at which point fire opens back up again. A fight against a tribulation body is
a running argument about what you are *mostly* doing.

**This is also why it never becomes invulnerability, and the guarantee is structural rather than
numerical.** The defence is bounded by construction: it can only ever hold one door shut. That is
a far stronger guarantee than a floor on damage, because a floor has to be maintained by whoever
touches the numbers next and a one-slot defence cannot be tuned into invincibility by accident.
Nothing in this world is invincible, and here that follows from the shape of the mechanism
instead of from anybody remembering it.

**It adapts to ANYTHING, not only to elements. Settling that explicitly, because whichever this
file says is what somebody will build.**

The narrower reading - that it adapts to elements and non-elemental arts bypass it - was the
earlier one, and it is wrong for three reasons:

1. **It needs three rules where one will do**: an elemental resistance, a non-elemental
   exemption, and a list of what counts as exempt.
2. **It makes the exemption permanent**, so a weapon art would keep working for ever, which
   makes "bring the right key" the answer and removes the interesting demand.
3. **It contradicts why the resistance exists at all.** A tribulation body is at home in the
   elements *because a tribulation is a natural law*, not because elements are a category it was
   issued a defence against. Nothing in that reasoning stops at the elemental.

Under the general reading everything the setting has said stays true, and stops being three
facts:

- **Elements are what nearly everybody has**, so elements are what a tribulation body has
  usually already adapted to. *That* is why the ordinary weapon is the one that barely works at
  the summit - a consequence now, not a separate rule.
- **An ancient art, a weapon, a strike out of karma work because they are unexpected and
  unrepeated**, not because they are exempt. Lean on one and it dies too.
- **The deep roads gating on `weapon`, `formation`, `body` and `void` are still exactly the
  right things to hold up there** - not because they bypass anything, but because they give you
  **somewhere else to go when your first approach stops working.**

**Their own element is where they start.** A fire cultivator's tribulation body is hardest of
all to burn, and under this model that is an initial condition rather than a fourth term: they
have been living inside that element for centuries, so the adaptation to it is already made when
the fight begins. That keeps the owner's earlier "extra less from the element of their own
cultivation" intact without a special case.

**Adaptation is per fight and resets.** Deliberate, and worth stating because the alternative is
tempting and wrong: a body that kept every adaptation for ever would end up immune to
everything, which breaks the rule below. What it learns, it learns about this fight.

**It is resistance and never immunity.** Two of them fighting still ends with somebody dead,
given enough time. If the numbers ever make two of them unable to hurt each other at all, the
numbers are wrong.

**And this is what actually explains the days-and-nights duel** - better than a multiplier did.
Two transcendents do not fight for days because each blow is small. They fight for days because
**every approach stops working once either of them has leaned on it**, and both keep having to
find another thing to do. The length comes out of the exchange rather than out of a constant.

**Note what it rhymes with.** AGENTS.md already carries the owner's principle that a repetitive
strategy should cost you, stated about a whole life. The tribulation body is that same idea
compressed into a single fight: repetition stops working, and the cultivator with one narrow art
is the one it stops working for first.

##### It is still killable, and this is the part to design against

The owner has said *"resistance, not immunity"*, *"a transcendent fighting another one will
still die, eventually"*, and *"it still doesn't make you invincible"* - three times, unprompted.
That is a very good indicator of where an implementation goes wrong, so it is written here as
constraints rather than as tone:

- **One slot, always.** The structural guarantee above, and the one that does the real work: a
  body that can only shut one door can never shut them all, however the numbers move.
- **Adaptation costs exposure and time.** The window before a door closes is real, and something
  big and fast can land inside it. A body does not learn an art it has been hit with once.
- **It reduces and never eliminates.** Even a fully adapted approach still does something.
  Otherwise a long enough fight converges on a stalemate nobody can break, which is precisely
  the failure being warned about.
- **The calibration matchup stands** (see below): twenty elemental Grand Ascension cultivators
  against one early Tribulation Transcendent is survivable and not winnable. Twenty is not
  enough to kill. A much smaller number with genuine variety is.

##### The two numbers, and the window "most" is measured over

The mechanic is one slot holding **what it is adapted to** and **how far that adaptation has
closed**. Three things have to be decided, and they are the whole of the tuning:

| Decision | The proposal, and why |
|---|---|
| **What "most" means** | **Recent exchanges, not the whole fight.** A whole-fight tally lets the opening minute decide the rest of it and makes switching pointless, because early history outweighs what is happening now. A short trailing window keeps the fight dynamic and makes a mid-fight switch actually move the defence, which is the texture the mechanic is for |
| **How long to close** | **Several exchanges of sustained majority**, not one. Long enough that a burst can land inside the window, short enough that leaning on one art is punished within a single fight rather than across a campaign |
| **How long to let go** | **Re-targeting is what releases it.** Rather than a second independent timer, the slot decays while something else dominates and re-aims once it has emptied. That gives switching a real cost - you spend the decay before the new door starts closing - and it keeps one slot genuinely one slot |

Decay-then-re-aim is the choice worth defending: two independent timers would let a body hold a
closing adaptation *and* an old one at once, which is two doors by the back way and exactly the
thing the one-slot rule exists to prevent.

The actual figures are not chosen here, because they are not choosable without measurement: they
have to be fitted to the calibration matchup below, together with the HP pool.

##### What the body adapts TO, which is the one thing to get right

**The body does not learn the ART. It learns the INJURY.**

That single sentence is the whole of it, and it dissolves a problem this section previously spent
four paragraphs failing to solve. A tribulation body has no idea what technique is being used on
it and does not classify techniques at all. It knows what **kind of harm keeps arriving**, and it
closes against that.

Every case the design owner gave falls straight out of it:

| Case | Why |
|---|---|
| Not all elements - it adapts to **fire** | Fire burns; cold does not |
| **Two sword roads are one thing** | Both cut. The body has only ever felt cutting |
| Ancient mind control and ancient sword generation are **two** | One does something to the mind; the other opens you |
| It might adapt to **sharp and not to blunt** | Slashing and piercing are not bludgeoning |
| *"one type of trauma"* | The rule, in the owner's own words |

**So there is no technique taxonomy to invent, and no family field either.** The engine already
carries the exact vocabulary, in `BaseDamageTypeEnum` (`src/schema/base-schemas.ts`):

```text
slashing  piercing  bludgeoning
fire  cold  lightning  thunder
acid  poison  necrotic  radiant
psychic  force
```

**Key the adaptation on the damage type of the incoming harm.** Nothing is added, and every one
of the owner's cases is expressible in what is already there.

**Retracting what this section said an hour ago**, because a wrong answer with reasoning attached
is worth more than a silent edit. It proposed keying on `element ?? id`, and proposed adding an
optional `familyId` to techniques so that variants of one road could be declared to share. Both
are **wrong and neither should be built.** They were solving the problem of classifying arts,
which is not the problem: the body never sees the art. The `familyId` field in particular would
have been a new taxonomy for somebody to maintain, invented to answer a question the damage-type
enum had already answered. It is also worth recording that the reasoning which produced it -
measuring `subject` and finding it too coarse and too sparse - was perfectly sound and aimed at
the wrong target entirely.

**The gap this leaves, and it is real:** the taxonomy exists but **cultivation arts are not mapped
onto it.** `grep` finds no `damageType` on a technique or anywhere in `schema/cultivation.ts` -
`BaseDamageTypeEnum` is retained substrate that the cultivation layer has never used. So before
adaptation can be implemented, an incoming art has to be able to say what kind of harm it does.
The cheapest honest route is derivation from what arts already carry rather than a new authored
field on 138 rows:

```text
element   metal wood water fire earth lightning ice   (7, on 69 arts)
subject   alchemy weapon movement life_death body      (on 52 of the other 69)
```

Several map with no judgement at all - fire to `fire`, lightning to `lightning`, ice to `cold`,
`subject: weapon` to the sharp types, `subject: alchemy` to `poison`. Others genuinely need a
decision, and **that decision is content and belongs to the owner, not to whoever implements
this**: what harm does a wood art do, or a movement art, or one of the 17 arts carrying neither
element nor subject. Derive where it is obvious, ask where it is not, and default the remainder
to something explicit rather than letting them all collapse into one bucket - because arts that
share a bucket are arts the body cannot tell apart, which is the one-slot rule leaking again.

**Never key adaptation on `era`, on `domain`, or on the technique id.** All three are the same
mistake - classifying the art instead of the harm - and `era` additionally trips the guard in
`schema/cultivation.ts` that stops the axis collapsing into "old wins".

##### What this buys the rest of the setting

**The deep roads were already domain-gated away from the elemental, and nobody arranged it.**
The seven roads that reach cap 45 gate on `void:2`, `weapon:3`, `formation:3`, `body:3`,
`void:3`, `life_death:3` and `time:3`. **Not one gates on element.** The roads that carry you to
the summit are the roads whose understanding still works there.

It also explains why the top of the ladder cares about dao at all. Below it a road is simply a
road. Above it, **a second road is a second thing to do when the first one stops working** - and
that is a far better reason to seek understanding than "the gate asks for it". What the summit
rewards is not the right road; it is having more than one.

**Ancient arts: unteachable by design, not by omission.** Measured across all 34 houses, which
between them shelve 87 distinct arts: **not one of the 15 ancient arts is on any shelf.** That
has been read as a content gap. It is not - it is the point. An art that answers a tribulation
body cannot be enrolled for and has to be **found**, which is what the deep ruins and the closed
ground are for, and which joins that whole body of work to the summit for the first time.

Note what an ancient art is worth under adaptation, because it is easy to overstate: it is not a
key that opens the body. **It is one more thing nobody there has leaned on yet** - and it stops
working too, if you lean on it. Its value is that hardly anybody has one, so hardly anybody has
made the body learn it.

**Objects, for the same reason.** A weapon is another approach, held rather than learned, so it
is a door somebody can open who has only one art of their own. [`items.md`](items.md) already
says that above a certain grade an object moves on a favour owed rather than a price, and the
register already tracks who holds which artifact at what grade. **This is why.** At the summit
the answers are variety, and the two ways to buy variety are an art found in closed ground and
an object that is not for sale.

##### Why they cannot be mobbed, which is the discontinuity at the top

The resistance does not act alone. **A tribulation body also comes with an enormous HP pool**,
and the two together produce the one place on the ladder where **numbers stop winning.**

Everywhere below it, numbers win, and should:

> Twenty cultivators at a realm's Perfection against one at its Early is a loss for the one,
> at every realm up to and including Grand Ascension.

**At Tribulation Transcendence that stops being true, against elemental attackers.** Twenty
Grand Ascension cultivators throwing elements at one early Tribulation Transcendent do not
reliably kill them: every blow is reduced, and the pool it is chipping at is very large.

And the outcome is specific, and is the practical face of *resistance rather than immunity*:

> **You might not win, but you could get out.**

Not victory. Twenty of them can drive somebody off, deny them the ground, and make the fight
unwinnable. What they cannot reliably do is **finish** them. That is a better result than either
"the transcendent wins" or "numbers still win", and it is what the tribulation body is *for*: it
is the reason a body at that height cannot be mobbed.

**And the counter is sharper here, because twenty of them is not twenty kinds of harm.** An army
of elemental cultivators is, to a tribulation body, very nearly *one* attacker repeated - they
all burn, so the floor covers them and the slot closes against the one type arriving most. **Two
opponents who hurt you differently are worth more than twenty who hurt you the same way.**

**So somebody at the summit has more to fear from one well-equipped enemy than from an army of
ordinary ones** - which is exactly the shape the setting wants at the top, and it now falls out
of the mechanism instead of being asserted.

**This is the calibration target.** When the numbers are chosen, they must land that matchup:

| Setup | Required outcome |
|---|---|
| 20 Grand Ascension, elemental, vs 1 early Tribulation Transcendence | Survivable, not winnable. They get out |
| Same, but the numbers make the transcendent win | **Too strong.** Reduction or pool is too high |
| Same, but twenty reliably kill them | **Too weak** |
| 2 whole transcendents, elemental, given long enough | Somebody dies. It has to end |

Record the chosen figures here when they are picked. Nobody tuning them later can recover this
target from the code, and without it they will be tuned against something else.

##### The imperfect version

**Same structure, degraded** - which is a much better expression of the wound than a flat damage
penalty, because it leaves the shape of the capability intact and makes it fail in a way somebody
can exploit on purpose.

An imperfect tribulation body **adapts worse**, in any of three ways that can be combined:

- **Slower to close.** The window before a door shuts stays open longer.
- **Quicker to lose it.** The adaptation decays faster once you stop leaning on that thing.
- **Never fully closes**, or never closes against some things at all.

The third is where the setting's word *weakness* lives, and it is the one that makes hunting one
of them a real activity. A whole tribulation body closes every door eventually; **this one leaves
some open permanently.** So the fight against an imperfect one is winnable by finding **the thing
it never learns** - which is a thing to discover, worth knowing, worth paying for, and worth a
lifetime of hiding by the person who has it.

##### The hook, specified but NOT built

`combat.ts` is contended, so this is written down rather than implemented.

**State.** One slot per combatant, living for the duration of the fight and discarded with it -
deliberately not persisted, since a body that kept every adaptation for ever would end up immune
to everything. The slot holds an **adaptation key** and **how far it has closed**, plus a short
trailing record of what the defender has been hit with.

**Per incoming attack, in damage resolution, where the art is already known:**

- **Key it** on the **damage type** of the harm arriving - a `BaseDamageType`, never the
  technique, its element, its id or its era. This needs the mapping named in the grain section
  above, which does not exist yet and is the one real prerequisite.
- **Apply the elemental floor** whenever the defender is at Tribulation Transcendence or above
  and the incoming damage type is one of the elemental ones. Always on, independent of the slot.
- **Apply the adaptation** on top, when the incoming type matches the slot's type, scaled by how
  far it has closed.
- **Then update the slot** from the trailing window: grow if the dominant key still matches,
  decay if it does not, and re-aim once it has emptied.

**Invariants, and each of these is a way the mechanic has already been observed to want to go
wrong:**

- **One slot. Never two.** The whole guarantee against invulnerability is structural, and it
  lives in this line.
- **Never reduce to zero**, floor and adaptation combined. The fight has to be able to end.
- **A single hit teaches nothing.** Adaptation costs exposure and time, or a burst can never land.
- **Decay-then-re-aim, not two timers.** Two independent timers would let a body hold an old
  adaptation while closing a new one, which is two doors by the back way.
- **Calibrate against the matchup**, not against a feel for the number: twenty elemental Grand
  Ascension against one early Tribulation Transcendence must come out survivable and unwinnable.
  The HP pool is the other half and must be fitted together with the reduction, since either
  alone can be made to pass and fail it. **Record the chosen figures in this document.**
- **`imperfect-tribulation-body` changes the slot's behaviour, not the damage.** Slower growth,
  faster decay, a cap below full, or a damage type it can never close against. Deriving which
  type it cannot learn from something already on the cultivator - their root or their road -
  keeps it deterministic and adds no catalog field.
- **Do not** key any of this on `era`, on `domain`, on `element`, or on the technique id. The
  body learns the injury, not the art.

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
