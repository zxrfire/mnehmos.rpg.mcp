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

**Six of the fifteen grants that do exist are declared and inert.** Grepped across `src/`:
outside `capability.ts` itself, exactly one grant is read by any other module -
`spatial_folding`, by `convergence.ts` as `PIERCE_GRANT`. Of the rest, `prepared_vessel`,
`carries_own_ambient`, `no_ambient_needed`, `enters_dead_zones`, `no_seam` and
`immune_contamination` do one thing each: subtract `NEUTRALISED_HAZARD_RELIEF` from a
`survive`/`succeed` requirement when a matching hazard string is on the subject.
`reads_formations` and `gates_places` are special-cased inside `judge`. And
**`soul_persists`, `suppresses_lesser`, `makes_veins`, `seals_domains`, `reads_lid` and
`opens_lid` are consumed by nothing anywhere.** (Soul persistence itself is implemented -
by `tradition.ts`'s `SOUL_PERSISTS_FROM_ORDINAL` and `existence.ts` - just not through the
grant that names it. The other five are not implemented at all.)

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
| 5 | risk | **built** | Deviation, injuries that never heal, starvation, `BLEED_OUT_TURNS`, settling, stagnation. Five named deaths, all reachable here |
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

---

## Void Refinement - ordinal 29 to 32

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **built** | `reads_formations` is special-cased in `judge`: up to 8 ordinals off `understand` where the subject carries the `formation` hazard. The only perception capability keyed to a realm anywhere in the engine |
| 2 | survive | **built** | `no_ambient_needed` and `enters_dead_zones` between them neutralise `thin_qi`, `dead_zone`, `void`, `sealed_qi`, `scar` |
| 3 | do | **built** | `spatial_folding`, consumed by `convergence.ts` as the escape from a closing window - and deliberately short-range, so it narrows as the window wanes. The one grant with a real consumer outside `capability.ts` |
| 4 | asked of | **absent** | |
| 5 | risk | **absent** | |
| 6 | opportunity | **indirect** | The README calls `no_ambient_needed` *"the single most consequential grant on the ladder"* because it decouples a cultivator from the scarcity the world is organised around. That decoupling is real in the cultivation-rate arithmetic and has no economic expression: nothing anywhere makes such a person a different kind of trading partner |

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

---

## Grand Ascension - ordinal 37 to 40

| # | Question | Verdict | Where it lives |
|---|---|---|---|
| 1 | perceive | **declared and inert** | `reads_lid` is read by nothing |
| 2 | survive | **built** | `gates_places` zeroes every location requirement except `understand`. No longer gated by places |
| 3 | do | **declared and inert** | `makes_veins` and `seals_domains` are read by nothing. Making and unmaking spiritual veins is the most economically consequential act in a setting whose entire scarcity is veins, and it is a string in an array |
| 4 | asked of | **absent** | |
| 5 | risk | **absent** | *"Their attention is itself a hazard. Being noticed by one has consequences before anything is done to you."* Nothing models being noticed |
| 6 | opportunity | **absent** | |

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

---

## Attributes: the same test, applied to the four dealt numbers

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
3. **The five inert grants.** `suppresses_lesser`, `makes_veins`, `seals_domains`,
   `reads_lid`, `opens_lid`. Cheapest possible win at the top of the ladder: the class
   arrays already carry them and the predicates are already the right shape.
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
