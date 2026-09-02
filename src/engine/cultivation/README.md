<!-- tier: 3 -->

# The Cultivation Engine

> **Tier 3 - reference.** Design rationale and the contract of the code beside it. Read by
> humans and by agents doing design or implementation work. Never auto-injected into a
> narration prompt. The narrator's always-loaded text is
> [`../../../docs/world/NARRATOR-CORE.md`](../../../docs/world/NARRATOR-CORE.md).

The realm ladder and everything that is a function of it: talent, progress, breakthrough,
the price charged at every realm boundary, foundation quality, tribulation, the last
crossing, existence states, and the five ways a run ends. Read this before changing
anything in `src/engine/cultivation/`.

Everything in this directory is a **pure function of state plus a seeded stream**. No
database access, no I/O, no MCP concerns. The runtime agent narrates what comes out of
here and decides none of it. See [`../README.md`](../README.md) for the engine-wide
implementation philosophy, and [`../../../context.md`](../../../context.md) for the
authority rule this is an expression of.

Balance constants live in `src/schema/cultivation.ts` and nowhere else. Import them.

---

## Realm is social reality, not a stat

A cultivator's realm decides social status, political influence, resource access, who
will speak to them, who fears them, who wants to recruit them, who wants them dead, which
territories they can safely enter, and which opportunities exist at all. A Core Formation
cultivator lives in a materially different world from a mortal - not a better-equipped
version of the same one.

But strength must not eliminate politics. A weaker character survives through alliances,
deception, preparation, reputation, sect backing, formations, treasures, poison, escape
techniques, information, and by exploiting conflicts between stronger cultivators.

Upsets must be **possible and exceptional**. A weaker cultivator can win through superior
technique, an artifact, preparation, terrain, ambush, poison, a formation, numbers, or by
exploiting an existing injury. Routinely - no. Never - also no.

## Realms are qualitative

Never model cultivation as `realm 1 = 100 power, realm 2 = 200`. Ask instead: *what is
possible at this realm that was fundamentally impossible before?* A breakthrough can
change physical capability, lifespan, perception, soul, energy quality, movement,
environmental resistance, available techniques, strategic options and influence.

A realm sets a broad **capability ceiling**; it does not determine actual strength. Within
a realm, internal progression is real, and two cultivators at the same stage can differ
enormously by cultivation method, foundation quality, comprehension, techniques, body,
soul, artifacts, experience, resources, preparation, information and environment.

A peak cultivator of one realm can threaten the weakest of the next. **Large realm gaps
must remain nearly insurmountable.** A character several major realms below another should
generally be helpless in a direct confrontation - their options are to flee, hide,
negotiate, seek protection, exploit terrain, use a specialised counter, manipulate another
faction, prepare, or avoid detection entirely. Exceptions are rare and earned. Cleverness
must not casually dissolve the hierarchy.

---

## Spirit roots: how your body takes qi

A spirit root is the shape of the aperture you draw qi through - decided before you were
born, unchangeable, and worth more than any effort you will ever make.

- **Single roots** (metal, wood, water, fire, earth) draw one flavour cleanly and waste
  nothing. Roughly two people in five are born to one, and every one of them knows what
  they are worth.
- **Dual conflicting roots** (water-fire, metal-wood) draw two energies that fight each
  other on the way in. This is qi deviation: not a rare accident but a standing condition,
  a low fever that never resolves.
- **The triple root** (metal-wood-earth) holds three links of the overcoming cycle in a
  row. Metal cuts wood, wood breaks earth, and the chain never closes - so exactly one of
  its three elements, earth, can be cultivated cleanly. Most people who hold it spend
  years finding out which one that is.
- **The quad root** (metal-wood-earth-water) is the same chain one link longer, with fire
  absent. The absence is worth nothing. A root is judged by what it holds, and this one
  holds four things at once.
- **The five-element muddled root** draws everything and keeps almost none of it. It is
  the single most common draw in the world.

  Counted together, the mixed roots - three, four and five elements - are better than a
  third of all births. The overwhelming majority of people who ever try to cultivate hold
  one of them, get nowhere, and die at eighty having spent their lives on it anyway.
- **Mutated roots** draw something that should not be there at all. **Lightning** is
  devastating, and there are almost no manuals for it because almost nobody who had it
  lived long enough to write one. **Ice** takes as readily as it gives.

Talent is not earned, cannot be improved, and decides nearly everything. The engine rolls
it once and locks it. A player who draws a muddled root in a poor region has drawn the
real experience of this world.

The scarcity of manuals for mutated elements is made true in the technique catalog, not
in this directory - see [`../../data/cultivation/README.md`](../../data/cultivation/README.md).

### Origin: the third dealt thing

A cultivator is dealt a spirit root, four attributes, and **a place to have been born
into**. `origin.ts` owns the third, on the same terms as the first two: rolled once from
the run seed, permanent, and with no tool anywhere that changes it. Nine births in ten are
a farm in a thin county - no teacher, no manual, no vein, and nobody to vouch for you -
and roughly one in twenty-five thousand arrives by one of the three routes at
the top of the table: a Dao house's own blood, an apex sect member's child, or a
child somebody spent a word to place at a house that would have refused them.

The hard rule is that **an origin buys inputs and never rank**. There is deliberately no
field on `OriginTier` that could confer a realm, progress, admission, or a rank inside an
institution, and the Hollow Court's own admission text is the statement of it: a Void
Refinement floor and evidence you could cross, and nothing else counts, which explicitly
includes being somebody's child. What it buys instead:

| Input | What it actually is |
|---|---|
| **Resources** | Stones, and therefore pills, and therefore a seclusion that is a plan rather than a way to starve. Priced at `PRICE_GROWTH_PER_ORDINAL`, which is set to the ladder's own 1.35 rank-cost growth on purpose: a fortune then buys a fixed number of rungs rather than a fixed fraction of the road, and it is gone by the low twenties. |
| **Placement** | A sect that will take you at an age when it matters. `entryRankIndex` is 0 for every tier, and `placementsWithinReach` never waives an institution's own `admissionOrdinal`. |
| **Access** | Which comprehensions exist for this person at all - expressed as `DiscoveryContext` rows through the `AccessSource` set in `understanding.ts`, never through a mechanism of origin's own. A thin-county birth reaches its own root and nothing else. |
| **Standing** | Somebody's word. A capacity, spent rather than kept. |
| **Survivable risk** | A bounded, exhaustible addition to the odds of surviving somewhere lethal. It never touches what is in the ruin. |

`MAX_ORIGIN_AMBIENT` is `normal`, and that ceiling is load-bearing: thin to dense is a
fourfold multiplier on cultivation rate, larger than the gap between the best spirit root
and the worst, so an origin that handed out dense ground would outweigh talent. A family
removes the *risk* of a thin hillside. A sealed vein is found, not given.

The claim that this axis lives or dies on - **visible in the opening position, and not in
the outcome distribution except at the very top** - is measured rather than asserted, in
[`../world/origin-odds.ts`](../world/origin-odds.ts).

### The four innate attributes, in-world

| Attribute | What it actually is |
|---|---|
| **Might** | How much qi your body can hold before it starts holding you. |
| **Insight** | How quickly you can read a life you did not live. Manuals are other people's memories; comprehension is archaeology. |
| **Fortune** | Whether the chances that come your way are worth anything. It can be zero, and for most people it is. |
| **Charm** | Whether people see you, or see where you came from. |

---

## Trajectories are non-linear

Progression must not read as `XP -> XP -> next realm`. The shape to support is:

```text
slow cultivation -> setback -> opportunity -> rapid development
    -> bottleneck -> catastrophe -> adaptation -> new path
```

Consequences the engine must actually model:

- **Talent is not destiny.** Ordinary aptitude plus persistence, opportunity,
  comprehension, unusual techniques, resources and extreme circumstance must be a viable
  road to the top. The muddled-root run has to be *winnable*, not merely survivable.
- **Foundation has quality and history**, not just a rank. It can be stable, unstable,
  damaged, exceptional, incomplete, transformed, sacrificed, or rebuilt. Two cultivators
  at the same ordinal may have very different futures, and the engine must be able to say
  why.
- **Experience is a form of power.** Surviving hardship should produce mechanical
  consequences: judgement, combat experience, caution, ruthlessness, knowledge, enemies,
  reputation, changed relationships.
- **Loss branches rather than subtracts.** Cultivation destroyed should open a search for
  another path - a new mentor, a new technique, a new faction, new enemies - not simply
  reduce a number.
- **Power creates problems.** Gaining it must generate attention, enemies, political
  obligations, resource requirements, faction interest, jealousy and reputation. Power is
  never purely beneficial.

### Foundation quality

`foundation.ts` owns the Foundation Establishment crossing at ordinal 12 -> 13, and
everything above it is built on whatever got laid down there. A cultivator who spent two
years finding a dense-qi cave, bought the right pill, healed their meridians first and
crossed unhurried is not slightly ahead of one who crossed in a ditch with three torn
meridians because something was chasing them. They are on a different curve for the rest
of the run.

Quality is a permanent multiplier on cultivation rate, a permanent modifier on
breakthrough odds, and - because a crossing reaches into structure - a modifier on the
price of advancement. A damaged foundation is not a debuff that wears off. It is what the
rest of the life is built on.

None of it is rubber-banded. The assessment reads preparation, ambient qi, injuries,
pills, talent and one seeded sample. It does not know how the run is going and it does
not care.

## Power is composite, not a single number

Realm is the spine, but it must never be the whole of a character's capability. Model
power as a composite of at least: energy/cultivation base, **physical body**, **soul**,
**comprehension**, techniques and secret techniques, artifacts, weapons and armour,
bloodline or physique, innate abilities, **battle experience**, movement and defensive
capability, and environmental compatibility.

**Two cultivators at the same realm must be able to differ enormously in what they can
actually do**, and the engine must be able to say exactly why.

### The body is a real path

Body cultivation is a legitimate route to power, not a passive defence stat. It can raise
strength, durability, speed, regeneration, senses, resistance, longevity, and the ability
to survive hostile environments - and a specialised body should fundamentally change what
combat and exploration look like, not just add armour.

### Comprehension is separate from accumulation

Keep three quantities distinct:

```text
cultivation quantity   (how much you have accumulated)
cultivation quality    (how good your foundation is)
understanding          (what you actually comprehend)
```

A character with enormous accumulated energy and poor understanding hits a wall that no
amount of further accumulation clears. A character with extraordinary comprehension
advances rapidly the moment they find the right insight. Understanding must unlock
*qualitatively different* abilities - never be a second experience bar with a different
name.

Progression through knowledge is therefore real progression: learning that what you
believed about cultivation was incomplete can unlock techniques, paths, regions,
factions, and explanations for things that already happened to you.

### Bloodlines and physiques: potential, not destiny

Inherited gifts create meaningful differences between characters. They also routinely
come to nothing: a character with an extraordinary physique can still die, lack the
resources to use it, choose the wrong path, become politically isolated, or never
understand what they have. Conversely an ordinary character can reach extraordinary
heights through persistence, comprehension, opportunity, and unconventional methods.

### Battle experience is tracked

A veteran and a novice at identical cultivation must not fight identically. Track combat
experience, tactical knowledge, familiarity with specific techniques and opponents, and
the ability to exploit a weakness.

### A weapon's grade decides whether it survives being used

`whether-a-weapon-survives-being-used.ts`, consumed by `resolveExchange`.

The contract, in the order it binds:

1. **Realm is an absolute gate on unmaking.** Your rung must reach the object's rung.
   Nothing carried, rolled, prepared or brought gets past it. This is the *same* law that
   gates making - `PILL_GRADE_REALM` and `pillBandOrdinal` are it in the pill grades' own
   units - because breaking a thing is working with it, and there must not be two rules.
   It is also what makes the immortal band unmakeable by anybody below the Lid without
   anybody writing that down.
2. **Inside the gate, ability decides**, and ability is the composite power `assessPower`
   already produces. **Do not add a stat for this.** A superior opponent who is hurt,
   exhausted, fighting bare or standing on empty ground breaks fewer blades, and that is
   the point: a stronger opponent is not a machine that deletes your equipment.
3. **One quantity, no table.** `realmsBetween(what it was swung into, what the weapon is
   worth)`. Within a realm the weapon is fit; past two it is not a chance. A tenth case is
   a tenth pair of numbers and must need no branch.
4. **Passive and active are readings, not kinds.** The same subtraction against the body
   alone and against the whole person. `chance - passiveChance` is what they did. There is
   deliberately no flavour enum and a third flavour must arrive with no code.
5. **Everything below the immortal grade is ruined, not shattered.** `ruin` in
   `world/possessions.ts`, never `shatter`. Fragments are tracked rows, and a world where
   every broken sabre mints two of them is a ledger full of rubble.
6. **The record survives the object.** A ruined thing keeps its row, its owner, its claims
   and every link of its provenance, and gains one more saying where it ended.

**Nothing here decides who may hold what, and nothing may be added that does.** The reason
a Core Formation cultivator is not walking around with an object rated forty-five is not a
rule - it is that somebody stronger wants it, and a forty-five cannot be broken by anybody
below the Lid, so the only way it leaves a weak holder is that somebody comes for it. The
distribution is a consequence. Enforcing it directly is the mistake this design exists to
avoid.

---

## Fortune's rule

Fortune must **not** be a percentage added to winning.

```text
high fortune    more opportunities, useful coincidences, better timing,
                encounters that happen to be survivable, discoveries
low fortune     missed windows, bad timing, the resource already taken,
                the wrong person present, arriving four days late
```

Luck must never override causality. A lucky weak cultivator does not randomly kill someone
far above them. What their luck does is arrange that **the elder's attention is elsewhere
at the moment they run** - which is the genre-correct expression of it, and far more
interesting than a modifier.

Stated as the code states it: **Fortune may influence which of the branches the world
already permits occurs, and when.** It biases timing, presence, availability and
coincidence. It must never manufacture a branch, never soften a resolution, and never
reach into a probability that represents a real capability gap.

```text
legitimate     the patrol arrives twenty minutes later; the herb happens to grow
               nearby; the elder takes the other road; the treasure has not already
               been taken; the window is still open
illegitimate   an encounter the world says is lethal resolves as survivable;
               a weak cultivator's luck kills a strong one; an outcome that
               contradicts an established fact or a capability threshold
```

Concretely, Fortune moves whether an opportunity is drawn, whether it is still available
when reached, and whether a passing danger arrives on top of the cultivator or goes past.
Once something has arrived, Fortune has no further say: it does not touch the damage, the
severity, the deviation roll, the breakthrough, or the tribulation. It is deliberately
absent from `breakthrough.ts` and present in `time-skip.ts` and `toll.ts`.

---

## Long actions are interrupted, not fast-forwarded

`cultivate for ten years` must never mean *skip 3,650 days and compute the endpoint*. The
events during the action are the content:

```text
day 74    a breakthrough
day 181   an injury
day 400   someone discovers the location
day 622   a sect war reaches the region
day 900   the spiritual vein collapses
day 1200  continue, or not?
```

The skip runs until something worth stopping for happens, hands control back, and lets the
player decide whether to continue. This is also how "the world does not wait for you"
becomes true rather than merely stated - the interruptions are the world arriving.

`time-skip.ts` implements this in adaptive chunks keyed to an absolute day index, so the
chunking provably cannot change the outcome. The world-clock counterpart, which fires
dated consequences and applies durable rates, is
[`../world/README.md`](../world/README.md).

---

## Why you still have to eat

Qi feeds the meridians. It does not feed the body.

Until a cultivator obtains a **Grain Abstinence Pill**, the flesh keeps its mortal
arithmetic: it wants food, it starves without it, and it dies on schedule. A Qi
Condensation cultivator who forgets to eat dies exactly as fast as a farmer who forgets
to eat, and considerably more embarrassingly.

This is why the hunger clock exists mechanically and why the Grain Abstinence Pill is a
genuine mid-game goal rather than a convenience item. Half the deaths in this world are
logistical.

### The pantry is priced before the door shuts, not after

`assessProvisioning` in `survival.ts` answers "what will this stretch of days do to them"
using the same constants `consumeFood` in `time-skip.ts` will later burn. Any caller
about to run a long skip is expected to ask it first, and to refuse in its own voice when
the answer is bad - the way `attemptBreakthrough` refuses insufficient progress *before*
the attempt rather than reporting it afterwards.

There are **three** outcomes, not two, and conflating the middle one is how this was
missed for a while:

| Outcome | When | What the skip does |
|---|---|---|
| `fed` | belly + pack cover the whole stretch | runs its length |
| `ejected` | food runs out partway, and there is a belly or a ration at the door | stops on the day it runs out, alive; the rest of the request is thrown away |
| `fatal` | entered with an empty belly **and** an empty pack | no interrupt is left to fire - dead on day `STARVATION_TURNS` whatever duration was asked for |

The third row is deliberate and stays deliberate. `simulateTimeSkip` seeds
`starvationAnnounced` from the entry state, on the grounds that somebody already starving
has been told once; the consequence is that the second command of a pair is the lethal
one, and the second command is the obvious one to type after being ejected. This is not a
bug in the skip. It is the reason callers must price the stretch first.

`assessProvisioning` is **not** a rescue. It never shortens a seclusion, never feeds
anybody, and never caps what may be asked for. Starving in a sealed cave stays reachable.
What it removes is walking into it with no figure attached.

`tests/engine/cultivation/provisioning.test.ts` checks every projection against a real
`simulateTimeSkip` run, because a projection validated against a restatement of the code
it projects is worth nothing.

## Settling: death by standing still

Refining never finishes. A cultivator who stops advancing does not merely stagnate - the
qi already inside them keeps working, and with nowhere left to go it begins working on
*them*. The body greys. The memory thins in the same way an ascended one's does, but with
nothing gained for it.

`stagnationYearsForOrdinal(ordinal)` at one rung, and the process finishes. That is fifty
years through Qi Condensation and Foundation Establishment, where `STAGNATION_YEARS` is
the floor, and a fifth of the realm's own span above them - a hundred at Core Formation,
twenty thousand at Tribulation Transcendence. Do not write the fifty down anywhere: it is
the floor, it is true for the first two realms only, and every copy of it that has ever
been made in this codebase has quietly become a lie about the other seven.

This is called **settling**, and it is the most common death among cultivators who survive
long enough to have a choice about it. And it *is* a choice: somebody may stop striking,
consolidate, and live the span out at the rung they reached. The clock is the deadline on
that decision, not a fuse - what it does at the end is make the decision for anybody who
declined to make it. The engine calls it death by aging. The world calls it becoming
furniture.

## The five deaths

`survival.ts` is the **only** place in this layer that decides a cultivator is dead.
Combat, breakthroughs, deviation and the time-skip all produce damage, injuries and
counters; they hand the resulting state to `survival.ts` and it returns a `DeathCause` or
`null`. In a permadeath game with no reload, five modules each allowed to set
`alive = false` eventually produce a ledger that disagrees with itself.

```text
combat_defeat          hp reaches 0 and no caller said what took it
obviously_fatal_choice a fight forced below SUICIDAL_HP_FRACTION
starvation             STARVATION_TURNS consecutive turns at 0 satiety
lifespan_exhausted     age reaches the realm's lifespanYears
stagnation_aging       stagnationYearsForOrdinal(ordinal) without advancing a rank
```

Injuries do not heal on their own. There is no long rest and no overnight recovery: an
injury stays untreated until a pill, a healer or a long seclusion clears it, and while
untreated it drags on the cultivation rate, on breakthrough odds, and on what a blow
actually lands. That is the ratchet. A run does not end because one bad roll killed you; it
ends because five months ago you took a torn meridian, kept cultivating anyway, and every
roll since has been worse than the last.

### `untreated_injuries` was on that list, and is not

It was the commonest death in the game. It is retired, by ruling:

> torn meridians should not kill, they don't make you bleed out. it should be the same as
> a torn muscle irl. very VERY annoying, but you don't die. but you probably lose combat
> effectiveness of some sort or maybe cultivation speed (but not comprehension).

Two clauses produced it, both now gone from `evaluateDeathConditions`: forcing a fight at
the threshold, and simply standing still for `BLEED_OUT_TURNS` days. Measured on the
sampled strategy with the food problem bought off, so the wound was the only thing left
that could end anybody, **fifteen of fifteen runs died of it** - median age 21, median peak
ordinal 2 of 47 - and all three stretch lengths gave identical results because the ninety
day clock fired inside the first stretch whatever its length. A wound that ends every life
before it has begun is a wall in front of the content rather than a hazard.

`docs/world/climbing/injuries.md` is the spec, including the split it turns on: **channel wounds**
(`permanent: false` - torn meridians, scorched channels) impair and never kill, while
**wounds of the cultivation** (a broken foundation, a cracked core, an unformed nascent
soul) take a rung back through `blocksAdvancement` and the broken statuses. The two are not
one scale with a bigger number at the end, and removing the lethality did not touch the
second family - it was never on the clock, because `bleedingInjuryCount` has always
excluded permanent wounds.

**What a channel wound takes instead.** All of it was already built and some of it was not
being read:

| What it takes | Where |
|---|---|
| Cultivation rate, up to 90% of it | `computeCultivationRate`, the `untreated_injuries` factor |
| Breakthrough odds | `computeBreakthroughOdds` |
| What a blow lands - slower, less accurate | `resolveExchange`, via `CombatantPower.channelWoundPenalty` |
| General capability in a fight, offence and defence | the `condition` line of `assessPower` |
| Risk of the next deviation | `RISK_PER_UNTREATED_INJURY` |

The combat term is expressed in the **damage roll** rather than as a lock on what may be
attempted, and that is a rule rather than a detail. A wounded cultivator keeps every art
they know and may attempt anything they could attempt whole; what a wound takes is the
quality of the execution. Gating a verb behind a wound is the banning failure, and it
invites a player to route around it by rephrasing. Degrading the outcome cannot be routed
around.

**And comprehension is untouched.** There is no injury term in `understanding.ts`, in
`dao.ts`, or anywhere insights are earned or priced, and adding one would be wrong. A
wounded cultivator still thinks clearly: they cannot push qi properly, and there is nothing
wrong with what they can see.

**What survived the removal.** `bleedingTurns` and `BLEED_OUT_TURNS` are kept as an
odometer rather than a clock - how long the channels have been open, which is a true fact
about a body and is what a player is shown in place of a countdown. Nothing reads them to
kill anybody. `LETHAL_UNTREATED_INJURIES` is a deprecated alias for
`CRIPPLING_UNTREATED_INJURIES`, the same number under a name that describes what it now
does: the point at which the body has stopped coping.

**And one thing that had to come off with it.** Open channels at that threshold used to
block HP recovery outright, which was defensible while such a cultivator was dead in ninety
days anyway. With the death retired it was the amplifier on a loop - a wound raises
deviation risk, a deviation costs HP and leaves another wound, and the repair was switched
off - and the wall did not come down so much as change its name: `untreated_injuries` fell
to 0 of 15 while `qi_deviation` rose to 15 of 15. A torn muscle does not stop a bruise
closing.

**What still ends a run that never treats anything.** Deviations do, years in rather than
in a season. That is the wound to deviation to wound cascade rather than the wound itself,
it runs on `RISK_PER_UNTREATED_INJURY` which is a separate ruling with its own guard in
`root-cliff.test.ts`, and it has not been retuned here. Measured against the same strategy
that *does* treat its wounds: median age at death 47 against 27, median peak ordinal 9
against 2, and six of fifteen runs surviving the whole probe. The medicine ladder is what
that difference is made of.

### Lifespan is not a straight line

Higher realms generally extend life, but lifespan is also moved by injuries, techniques,
environment, physique, treasures, and breakthroughs both successful and failed. Some low
cultivators die unusually young. Some very powerful ones die despite enormous remaining
longevity. Some ancient things persist far past any reasonable expectation.

---

## The Price of Advancement

Crossing from one realm into the next is not only a matter of accumulated qi. At every
**realm boundary** - never on the small steps between sub-ranks - the crossing demands
that something be cut away.

Every tradition explains it differently. Some call it the heart demon, some call it
severance, some simply say a person cannot carry everything they were into what they are
becoming. What it means in practice is the same: at a boundary, a cultivator may lose
something that mattered.

- a person who knew them stops knowing them
- a memory they were using to stay themselves
- a technique they had mastered, gone as if never learned
- at the highest crossings, their name

**It is rolled, not certain, and it is not fair.** The odds move:

- **Fortune** shifts them. The attribute that can legally come up zero decides whether the
  crossing takes an interest in you.
- **Sect elders can stand between you and it.** A sect that has decided a disciple is worth
  protecting spends real resources on their crossing - formations, elders holding them
  steady, pills nobody at that realm could afford. This is most of why anyone tolerates a
  sect, and the sect will tell you exactly what it cost.
- **Preparation matters.** The right pill, a stable site, dense qi, an unhurried crossing.
  People who break through in a cave they chose live differently from people who break
  through in a ditch because something was chasing them.
- **Some pay in advance.** There are paths whose entire argument is that the price will be
  taken eventually, so it is better taken deliberately, on your own terms, at a time you
  choose. They climb fast. What arrives at the top is not really a person, and does not
  pretend to be.

So some cultivators cross four realms and lose nothing, and know they were lucky, and are
insufferable about it. Others lose a brother at Foundation Establishment and are never
touched again. The path is soaked in blood, but it is not evenly distributed blood - and
the ones who got through clean rarely believe luck had anything to do with it.

**What is taken is never chosen by the cultivator.** The engine selects from what the run
actually accumulated: real bonds with real people, real memories, real techniques. Then
they are told. The horror is that it is legible - you can read the ledger and see the
shape of who you used to be.

This is why the powerful tend toward hollow. Someone at Void Refinement has crossed five
boundaries and rolled five times. Some of them still have a family. Most do not. Ask one
what their mother's name was and watch which kind you are talking to.

The faction that decided to pay this price in advance, on purpose, is the Severed - see
[`../../../docs/world/houses/sects.md`](../../../docs/world/houses/sects.md).

## Breakthrough

`breakthrough.ts` is the centrepiece: the only moment where accumulated advantage converts
into rank, and the only routine moment where a run can simply end. Three rules shape it.

1. **The engine shows its work.** Every modifier is itemised and the deltas sum exactly to
   the final chance, so the UI can print `0.33 base, -0.06 injuries, +0.08 insight`
   without recomputing anything, and a player who dies can see why the odds were what they
   were.
2. **Never 0%, never 100%.** Clamping to the open interval is not a numerical nicety, it
   is the genre. The heavens are never certain and never merciful. When the clamp bites it
   appears as its own line so the arithmetic stays auditable.
3. **Realm boundaries are a different kind of event** from sub-rank steps, and are where
   the Price of Advancement falls.

Fortune contributes nothing to these odds. See Fortune's rule above.

## Tribulation

At the last realm, the Lid stops ignoring you.

Heavenly tribulation is not a divine judgement on virtue. It is structural: the Lid
testing whether the hole you are about to punch is worth the cost of sealing it behind
you. The lightning is the seam discharging. It is not personal, and it is not survivable
by being a good person.

Cultivators who fail tribulation do not leave bodies. They leave a **scar** - a patch of
ground where the qi never returns, permanently dead, useless to everyone forever. The map
of the world is pocked with them. Every scar was somebody's entire ambition.

Scars are geography, and geography is stored: see
[`../world/README.md`](../world/README.md).

---

## What each realm actually makes possible

A realm is a **capability class**, not a damage multiplier. For every rank above Core
Formation the question the engine must be able to answer is: *what is possible here that
was fundamentally impossible one realm ago?*

Everything below is **potential, not entitlement.** A cultivator has access to their
realm's class; whether they hold any particular capability within it depends on
specialisation, preparation, technique, and what they were willing to pay. Two Deity
Transformation cultivators can be wildly different. Nobody gets the whole list.

These map directly onto the capability predicates in
[`../world/README.md`](../world/README.md) - most of them change what `can survive`,
`can understand` and `can force` return, and several change which environments are
enterable at all.

| Realm | The line it crosses |
|---|---|
| Core Formation | The reference point: a complete cultivator, mortal in kind |
| Nascent Soul | The soul persists without the body |
| Deity Transformation | Stops drawing qi in and starts displacing it |
| Void Refinement | Stops needing ambient qi at all |
| Body Integration | Stops having a seam to attack |
| Grand Ascension | Can read and handle the Lid |
| Tribulation Transcendence | The Lid answers back |
| Immortal | Over the Lid, or through it |

### Core Formation - the reference point

The golden core is a complete, self-sustaining engine. Sects negotiate rather than
recruit. Everything above this is measured against it, and everything below it is, in the
end, a person.

### Nascent Soul - the soul persists without the body

The threshold where `body destroyed = dead` stops being true. Possible here, conditionally:
surviving the destruction of the body, holding consciousness outside it, occupying another
body where circumstances allow, rebuilding a body, leaving a remnant, and soul techniques
proper.

None of it is automatic and all of it has conditions - a compatible vessel, a treasure, an
environment, preparation made in advance. Most Nascent Soul cultivators who die simply
die, because they had not arranged otherwise.

**Environmentally:** can enter places that kill the body, provided the soul has somewhere
to go.

### Deity Transformation - displacing qi instead of drawing it

Body and soul merge. The cultivator stops being a thing that *draws* ambient qi and
becomes a thing that *moves* it. Consequences:

- Ambient density changes measurably in their vicinity. Standing somewhere for a long time
  alters the site, which is why their old dwellings are worth finding.
- Presence alone suppresses lower cultivators - not an attack, a pressure. A Qi Condensation
  cultivator in the same room may be unable to circulate at all.
- Spiritual perception extends across a region rather than a field.
- Ordinary means stop being able to find or follow them.

**Environmentally:** thin regions cease to matter. They carry their own conditions.

### Void Refinement - no longer dependent on ambient qi

Refining the self against emptiness, which produces the single most consequential change
on the ladder: **they no longer need ambient spiritual energy to sustain cultivation.**

In the Late Age, where most ground is thin because it has already been drawn down, this
decouples a cultivator from the scarcity the entire world is organised around. It is why
the few who reach it stop participating in the economy, and stop being describable.

Also possible: short-range spatial folding, entering sealed and dead domains that nothing
else survives, reading regional formation structure as a whole rather than node by node,
and projecting a partial presence somewhere they are not.

**Environmentally:** dead zones, tribulation scars and voids open up - the places that are
lethal *because* there is nothing there.

### Body Integration - no seam to attack

Soul and body become indivisible, and damage changes meaning. There is no longer a
division between the two to exploit: soul attacks find nothing separable, and destroying
parts of the body does not remove parts of the person.

They are their own vessel, which makes the Nascent Soul survival tricks trivial for them
and largely unnecessary. Their physical presence alters terrain passively rather than
deliberately.

**Environmentally:** forbidden zones, corrupted regions and contaminated ground stop being
hazards. Very little in the world is still *environmentally* dangerous to them.

### Grand Ascension - reading the Lid

The last realm of this side. Everything about it points upward, and for the first time the
Lid is a thing that can be examined rather than assumed.

Possible: perceiving the seams directly; deliberately making or unmaking spiritual veins;
sealing and unsealing domains; perceiving causal and karmic structure that the Dao houses
spend millennia studying indirectly; leaving inheritances that survive ages intact.

Their attention is itself a hazard. Being *noticed* by one has consequences before
anything is done to you.

**Environmentally:** they are no longer gated by places. They gate places.

### Tribulation Transcendence - the Lid answers back

The approach to the crossing. Every breakthrough from here draws heavenly tribulation,
because the Lid has begun accounting for the hole they intend to make.

Possible: opening the Lid partially, which is what a portal actually is; suppressing or
provoking another's tribulation; persisting through ages in stasis; leaving remnants so
complete they are nearly the person.

Their deaths leave permanent geography. The failure scars on the map are mostly theirs.

### Immortal - over the Lid, or through it

The only realm nobody climbs into. It has two rungs, ordinals 45 and 46, and the single
attempt made from Tribulation Transcendence Perfection lands on one of them: False
Immortal at 45, True Immortal at 46. Neither rung leads to the other.

True Immortal is the top of the ladder and the end of the run - outside the simulation,
and outside the reach of everything in it, which is why the world's opinion of them is
entirely posthumous rumour. False Immortal is on the ladder and very much inside the
world's reach, which is the whole difficulty it presents.

## Two rules that keep this from becoming a power fantasy

**Capability is not invulnerability.** Every realm above Core Formation is *harder* to
kill in specific, enumerable ways, and none of them is unkillable. The counters get more
exotic as the realms climb - a Body Integration cultivator has no seam, so you attack
their obligations, their sect, their disciples, their karma, or you wait; a Void
Refinement cultivator needs nothing, so you take away the thing they wanted instead. The
higher the realm, the more the answer moves out of combat entirely.

**And nobody at any of these realms is common.** The overwhelming majority of cultivators
in the world die inside Qi Condensation. Everything on this page describes a handful of
people on a continent, most of whom the player will only ever hear about.

---

## What a rung buys in body

The third curve `realms.ts` owns, beside power and lifespan, and the one contract nobody
else may implement: `maxHpForOrdinal` and `maxQiForOrdinal` are **the only derivation of a
cultivator's pools anywhere in the codebase.** Everything that mints or advances somebody
goes through them, because the alternative has already happened - the world's NPCs were
built with the ordinal in the formula, the played cultivator was not, and a run reached
False Immortal holding a newborn's 50 HP and 30 qi.

**A major realm doubles the body, against power's fourfold.** That gap is the point: force
outruns the vessel by two every realm, so climbing never accumulates enough body to stop
dying. It is [nothing is invincible](../../../AGENTS.md) written as a curve.

Three things follow, and each is pinned by
`tests/engine/cultivation/what-a-rung-buys-in-body.test.ts`:

- **The doubling is calibrated, not chosen.** `GRADE_QI_BANDS` prices arts by grade and
  `GRADE_ORDINAL_BANDS` says which rung each grade opens at. The qi ceiling rises about
  x3.5 every eight rungs, which is a doubling every realm. Get this wrong downward and
  part of the technique catalog is unreachable by everybody alive - which is what it was.
- **The curve is continuous.** A realm's Perfection lands exactly on the next realm's
  Early, so a rung buys body and a crossing buys none on its own. Power is deliberately the
  other way round; there the step *is* the hierarchy.
- **The pool decides no fight.** `resolveExchange` charges damage as a share of the
  defender's own maximum, so a rung-matched pair settles in the same number of exchanges at
  either end of the ladder. That invariant is what makes the pool safe to grow at all, and
  it is the thing that breaks if damage is ever made an absolute number.

---

## Existence is multi-valued once cultivation is profound

At low realms, `body destroyed = dead`. High cultivation breaks that equivalence, and the
simulation must stop modelling a person as *one body plus one row plus one continuous
physical existence*.

A cultivator is a **persistent identity that may occupy several physical states over
time.** This is not a separate magic system - it is a consequence of cultivation becoming
profound, and it is kept to a small authoritative field set:

```text
existence_state   alive | physically_dead | soul_preserved | remnant | sealed
                  | possessing | reincarnated | reconstructed | missing | unknown
body_id           which body, if any, this identity currently occupies
soul_state        intact | damaged | fragmented | fading
cultivation       what survived the transition, which is often not all of it
identity_continuity  how much of the original person this actually is
```

The engine decides whether a transition is legal. The narrator interprets it.

### Nascent Soul is the threshold

Nascent Soul is not "the next realm with bigger numbers." It is the qualitative change
where the soul can persist without the body, and it is the gate below which most of these
states are simply unavailable. Above it a cultivator *may* survive severe bodily
destruction, hold consciousness outside the body, occupy another body under the right
conditions, rebuild a body, or leave a remnant.

**Not every Nascent Soul cultivator can do all of it.** Capability depends on
specialisation, preparation and circumstance.

### Survival is conditional, never automatic

Advanced cultivation must not become automatic immortality. Surviving one's own death may
require soul strength, a compatible vessel, a specific treasure, a suitable environment,
resources, a technique, outside assistance, luck, or - most often - having prepared in
advance. **A powerful cultivator can still die permanently, and most do.** The purpose is
not immortality; it is to make death, identity and survival more interesting as
cultivation deepens.

### The transitions are real state changes

If a cultivator possesses a body, the engine changes `body_id`, ownership and control, and
resolves the outcome. It is never narrated over an unchanged database. **Possession is
also not perfect control**: it can meet resistance, incompatibility, outright rejection,
partial control, cultivation loss, personality conflict or soul injury. A powerful soul
does not make every vessel suitable.

**Reconstruction** may cost the original physique, cultivation, meridian integrity,
appearance, or memories. The rebuilt body is rarely identical.

**Reincarnation is not respawn.** It produces a genuinely new life. Whether memory,
cultivation, karma, traits or relationships carry across depends on circumstance, and
recognition - by the reincarnated person or by anyone else - is a discovery, not a given.

**A remnant is not the person.** A remnant will, projection, obsession, recorded
consciousness or inheritance guardian may say *"I was the founder of this sect"* without
being the founder's consciousness. That distinction must be preserved in state, because
it is frequently the whole point of the encounter.

### Missing and unknown are load-bearing

`missing` and `unknown` are not placeholders for a decision the engine is avoiding. They
are correct answers. If a cultivator vanishes into a ruin, the engine does not have to
decide whether they are alive, and the world may hold several beliefs at once - died,
soul escaped, reincarnated, in seclusion, sealed, became a remnant - with the truth
genuinely unresolved until something settles it.

```text
year 50     a powerful cultivator disappears
year 500    still missing
year 2000   civilisation treats them as long dead
year 4000   a sealed body is found
year 4020   they wake, with their memories, relationships and grudges intact
```

### Absence is not removal

A character does not need to be present to matter. Their inheritance, remnant, disciples,
descendants, enemies, artifacts, techniques, karma and reputation keep acting on the
world. **Death does not remove someone from the simulation; it changes their mode of
existence.**

---

## The last crossing: True Immortal and False Immortal

Tribulation Transcendence is not the summit. It is the approach to it.

At the end of that realm sits one final attempt - the crossing that actually goes through
the Lid - and it resolves three ways rather than two. `immortal_status` records which:
`none`, `false_immortal`, or `true_immortal`.

Two of those three outcomes move the ordinal, and they move it to adjacent rungs of the
same realm:

| Outcome | Ordinal | Rank name |
|---|---|---|
| Attempt made from | 44 | Tribulation Transcendence Perfection |
| Survived, incomplete | 45 | False Immortal |
| Completed | 46 | True Immortal |
| Struck down | - | dead, and a scar on the map |

`immortal_status` is kept alongside the ordinal rather than replaced by it, because the
rank says where somebody stands and the status says the Lid has already been opened
against their name. It is the status, not the ordinal, that bars the re-attempt.

### The price, and why most people at the last rung never summon anything

The crossing is priced by `LAST_CROSSING_TAX` in `realms.ts` at **three times** the untaxed
rung, against **2.5** for every other realm boundary. That is not a wall being made harder;
it is a different kind of obstacle.

At every other boundary the tax buys a wall: a rung that costs several times the one below
it, which a cultivator either gets through or does not, and can strike at again next
century. Ordinal 44 is not a wall. The price is a sum of qi so large that gathering it
consumes roughly **seven eighths of the settling clock the rung grants** - for a cultivator
in perfect condition, with the best root the world deals, standing on a sealed vein. Anyone
who arrived worn cannot pay it at all.

Two consequences follow, and they are the whole shape of the top of the ladder:

- **Reaching the last rung is not the same as attempting the crossing.** A great many
  people stand at Tribulation Transcendence Perfection for a hundred thousand years and
  never summon anything, because the arithmetic never comes out. They are not failing.
- **It is one shot.** `LAST_CROSSING_PROGRESS_LOSS` is 1: a failed crossing burns the
  entire accumulation, not a quarter of it. The qi was not dispersed, it was thrown at the
  Lid and kept. A cultivator who survives a failed crossing is standing on the same rung
  with nothing in them and no clock left to gather it again.

So there is a fourth ending, and the world is full of it: **stranded**. Alive at 44, the
price spent, the Lid unopened, and no prospect of another attempt. A good number of the
people the world politely describes as having "reached the top and refused to step through"
are in that state.

### Declining

Standing at the last rung is a **question**, and `assessLastCrossing` in `breakthrough.ts`
is the engine answering it without deciding it.

It is roll-free and read-only. It returns the summon odds, the strike count and per-strike
survival, the completion chance, and the four end-to-end probabilities - True Immortal,
False Immortal, dead, stranded - which sum to one, plus the years the cultivator has left
and the whole itemised modifier list. A caller can put that in front of a player, or use it
to drive an NPC, and the answer will be the same arithmetic the mountain is about to use.

The engine does not decide. A decision the engine makes for you is not a decision you made,
and this is the one moment in a run where that matters most. What the engine does is make
sure the choice is informed, and make declining a real position rather than a failure of
nerve: a cultivator who is old, worn, and looking at a one-in-five chance of going through
is choosing between a hundred thousand years as the most powerful thing in a province and a
coin flip against a scar in the ground. Plenty of them sit down.

`hierarchy.ts` has recorded that distinction in its courts all along - `highWaterMark.end`
is `attempted` or `declined`, Yun Baiheng against Shen Guyi - and until this existed nothing
in the engine could produce either.

### True Immortal

The hole is punched, and the cultivator goes through it. This is the top of the ladder and
the end of a run in the only way that is not a death. Lifespan stops being a number that
means anything.

It is also, structurally, the moment the crossing collects in full. Everything the price
of advancement had been taking in instalments comes due at once: whatever the cultivator
still had, they do not take with them. What falls back is the spirit tide that a whole
region will remember as a golden year, and which the cultivator will never know they
caused.

Nobody currently alive has done this. The last confirmed crossing is centuries back, and
it is remembered for the tide rather than the person.

What an immortal run consists of after that point is deliberately light, and lives in
[`../../../docs/world/climbing/immortals.md`](../../../docs/world/climbing/immortals.md).

### False Immortal

The half-failure, and the more interesting outcome.

The tribulation is survived. The hole is opened. But the crossing does not complete - the
seam closes early, or the body will not follow the soul, or something on the other side
declines to take them. What is left stays on this side of the Lid, permanently.

A False Immortal is:

- **Enormously powerful.** Stronger than anything at Tribulation Transcendence, because
  part of the transformation did happen - and ranked accordingly, at ordinal 45. They sort
  into the ordinary power table above every cultivator still under the Lid; there is no
  separate accounting for them and there should not be.
- **Permanently barred.** The Lid has already been opened once against their name and will
  not open again for them. Ordinal 46 is one rung up, legal, and shut. They cannot
  re-attempt, and everyone who understands what they are knows it.
- **Not immortal.** Their lifespan is vast and it is finite, and they can count it. They
  will die on this side, having been most of the way through.
- **Incomplete in a way that shows.** Something did not come back. What is missing varies
  and it is never nothing.

This is the Hollow Court's real membership. Those who "reached the top and refused to step
through" is the polite version of the story, and some of them did choose it - but a good
number of the oldest and quietest ones tried, and are what came back. They do not correct
the polite version.

A False Immortal is therefore one of the most dangerous things in the world and one of the
most stuck. They have nothing left to lose, no way forward, and a great deal of time to
think about it. They make excellent patrons, excellent enemies, and the most reliable
sources of true history in existence, because they were there.

**And they do not stay.** Three hundred thousand years with the one thing you were built
for permanently shut against you is not a retirement, it is a sentence, and almost none of
them serve it sitting still. They go looking - down old seams, past the edge of anywhere
with a name, at whatever might be an answer - and going looking is what kills them. Their
span is not what ends them; the search is.

This is why the world holds one of them and not a crowd. The crossing produces False
Immortals at a perfectly ordinary rate; **residence** is production times how long they
stay, and they stay on the order of five centuries out of three hundred millennia. Lu Sheng
is not the only one the world ever made. He is the one who is still here, which is the most
interesting fact about him and the reason he is worth writing down. The arithmetic is
`immortalStock` in [`../world/ladder-odds.ts`](../world/ladder-odds.ts), and the setting
side of it is [`../../../docs/world/climbing/immortals.md`](../../../docs/world/climbing/immortals.md).

### Failure, and the near-miss beside it

The remaining outcomes are the ordinary ones. Cultivators killed by the last crossing leave
a scar and nothing else - `FAILURE_TABLE.lastCrossing` is the most lethal column in the
game, because a tribulation you summoned and cannot hold does not simply disperse. And
those who survive it are stranded at 44 with the price gone, which is described above and
is the commonest of the four endings for anyone who was not in perfect condition when they
went up.

### What the numbers actually are

Measured over 3,000 whole lives at the very best conditions the schema can express - a clean
single root, the maximum draw, a sealed vein, an exceptional foundation, three deep
insights, a pill on every attempt and every wound treated:

| Ending | Share |
|---|---|
| False Immortal | 38.6% |
| True Immortal | 12.7% |
| Struck down somewhere on the ladder | 26.1% |
| Alive, stopped short | 22.6% |

One thing the table does not contain, and cannot: **it never carries a wound.** "Every wound
treated" is one of the stated conditions, so the population being measured is the one that
can always afford a physician - the harness treats every wound the moment stones allow,
which at the maximum draw is always. The figures are still correct for what they claim and
still silent about the runs that cannot afford a healer, which is most of them. That
silence has grown MORE important rather than less: untreated channel wounds no longer end
a run outright, so the untreated population is now one that survives and is permanently
worse rather than one that dies quickly, and nobody has measured it.

Two things about that table matter more than the numbers in it.

**It is a conditional distribution.** It is P(outcome | everything went right), and
everything going right is the rarest thing in the setting. Roughly a third of all spirit
roots are dealt with a hard ceiling at ordinal 32; a sealed vein cannot be found by looking;
comprehension needs a teacher or a text that most provinces do not contain. The rarity of
an immortal lives in the conjunction, not in the roll, and it is supposed to.

**False Immortals outnumber True ones three to one.** That is `MAX_COMPLETION_CHANCE = 0.25`
doing exactly one job: of the crossings that survive the lightning, three in four do not go
through. The Hollow Court is three times the size of the company on the far side, and it is
that way because the seam closes, not because those people were worse.

---

## Reading order

```text
realms.ts        the ladder every other system is a function of; owns MAX_ORDINAL
                 and the three curves a rung moves: power, lifespan, and the body
spirit-roots.ts  the talent you are dealt once and never redraw
origin.ts        the third dealt thing: where you were born, and what it supplies,
                 and the income curve every price in the game is quoted against
buying-and-bartering-pills.ts
                 which pills have a cash price and which only ever move for a
                 favour; one threshold, decided by grade, that also decides
                 whether a pill is stored as a count or as a row
rng.ts           seeded named sub-streams; why replays are stable
ambient.ts       where you cultivate, and why the world does not shimmer
cultivation.ts   progress accrual - an itemised rate, applied per day
injuries.ts      the ratchet: damage that does not heal, and scar tempering
foundation.ts    why two cultivators at the same ordinal diverge
existence.ts     what happens when "body destroyed = dead" stops holding
deviation.ts     cultivation going wrong inside the body
toll.ts          the price of advancement, charged at every realm boundary
breakthrough.ts  the centrepiece; the only routine way a run ends well
tradition.ts     the two roads, and their opposite answers to being killed
combat.ts        confrontation: the categorical gap, composite power, earned upsets
regard.ts        the same ladder, outside a fight: how the world answers, by how
                 far above or below the ask somebody is standing
survival.ts      the death engine; the ONLY place death is decided
time-skip.ts     the long-simulation primitive
```

## Regard: the ladder outside combat

`combat.ts` had been reading the ladder correctly for a long time and nothing else was. Measured
across a sixteen-position by thirty-ask sweep, twenty-three of the thirty asks returned an
identical answer at every rung: `I gather what herbs I can find` gave a False Immortal at ordinal
45 exactly what it gave a beginner at ordinal 0 - seven days bent over the ground, one stalk - and
`I take any work I can get` was strictly *worse* at height, because above the mortal ceiling the
answer was an empty list with no reason attached.

The cause was uniform. Every content catalog already carries exactly one number saying what rung
it is pitched at - `harvestOrdinal` on a herb, `minOrdinal` on a job or an encounter,
`requiredOrdinal` on a manual, `ordinal` on a beast - and every one of them was being used as a
floor and for nothing else. So the fix is one quantity and one table:

```text
gap  = asker's ordinal - the rung the record is pitched at
band = the row of REGARD_BANDS whose window contains gap
```

Seven rows, in `src/schema/cultivation.ts`, carrying every multiplier an ordinary resolver needs:
how much comes back, how long it takes, what it costs, and what a fight there does. There is no
per-catalog rule and there must never be one. A record that wants a different answer moves its
gate or sets `span` on its own optional `regard` column; it never grows a branch.

**It refuses at both ends, and gives a reason at both.** `unreachable` is the ask being over their
head. `dismissed` is the ask being beneath them - nothing here is worth their time, everyone
present can see what they are, and nobody opens that conversation. An empty list with no reason
attached is the bug this replaces, so any resolver that narrows a pool is expected to report what
it dropped and why (`refusalsFor`, `workWithheldFrom`).

**Two bands, because there are two answerers.** The world meets you as your apparent rung; the
ground meets you as your real one. So `offered`, `refused`, `priceMultiplier` and the reaction
come off the *social* band (apparent ordinal plus approach pressure), and `yieldMultiplier`,
`durationMultiplier` and `damageMultiplier` come off the *physical* band (real ordinal, no
pressure at all). A disguised elder is offered a porter's job like anybody else and carries the
load in a tenth of the time, because the sacks do not care what the room believes.

**What the narrator may supply.** An `Approach` - intent, tone, leverage, audience, a concealed
rung, patience, a witness - is context, never an outcome. The engine reduces the whole of it to
two bounded numbers: an apparent ordinal, and a pressure clamped to `APPROACH_PRESSURE_LIMIT`
rungs either way. Threatening a herbalist does not make the mountain give up a better flower.

`combat.ts` is where the two rules at the top of this page - "large realm gaps must remain
nearly insurmountable" and "upsets must be possible and exceptional" - stop being prose. Two
major realms apart it returns `no_contest` and the list of things that would actually work; one
realm apart it can be overturned only by an `Edge` the cultivator genuinely brought, and the
product of everything they brought is capped strictly below a two-realm ratio. It never declares
anyone dead: it reports damage, injuries and whether the finishing requirement for that person
was met, and hands the resulting state to `survival.ts`.

## Related

- [`../README.md`](../README.md) - engine-wide implementation philosophy and the five pillars
- [`../world/README.md`](../world/README.md) - capability predicates, environmental gating, time
- [`../../data/cultivation/README.md`](../../data/cultivation/README.md) - the content the engine resolves against
- [`../../../docs/world/climbing/qi.md`](../../../docs/world/climbing/qi.md) - what qi is, and why density decides everything
- [`../../../docs/world/history/the-late-age.md`](../../../docs/world/history/the-late-age.md) - why the ladder has a practical ceiling it did not used to have
