<!-- tier: 3 -->

# The World Layer

> **Tier 3 - reference.** Design rationale and the contract of the code beside it. Never
> auto-injected into a narration prompt. The narrator's always-loaded text is
> [`../../../docs/world/NARRATOR-CORE.md`](../../../docs/world/NARRATOR-CORE.md).

Places, the five capability predicates, opportunity windows, the historical record,
lineage, possessions, NPC records and the world clock. Read this before changing anything
in `src/engine/world/`.

Storage, retrieval, time, randomness and state updates. That is the whole remit. **There
is deliberately no simulation here**: no NPC tick loop, no behaviour trees, no political
engine, no consequence propagator. A world advances because dated consequences fall due
and durable rates get multiplied out, not because thousands of agents were stepped. See
[`../README.md`](../README.md) for why.

Three rules hold across every module in this directory:

- **Randomness belongs to the engine.** Everything stochastic derives from the world seed
  through `forStream`, because a reasoning engine asked to pick a number picks the one
  that suits the story it is telling.
- **Belief is not stored here.** Ground truth and the surviving record are; what any given
  person knows, believes or suspects lives in
  [`../social/README.md`](../social/README.md) and references facts by id.
- **Nothing reads the player.** There is no branch anywhere in this layer that scales an
  outcome to how a run is going.

---

## Depth, not scale: one planet, understood further down

The single most important structural property, and the one easiest to get backwards:

> **The world does not become larger. The player's access to it becomes deeper.**

The simulation begins on **one enormous planet**, and that is an implementation and
complexity constraint rather than a hard limit on what reality contains. It holds multiple
continents, enormous oceans, isolated civilisations, thousands of sects and clans, vast
wilderness, forbidden regions, ancient ruins, hidden peoples, secret realms, spatial
anomalies and unexplored territory. A player should be able to spend an entire cultivation
career on it and never run out of world.

**Do not predefine an escalating cosmology.** There is no authored ladder of
planet → galaxy → universe. Whether anything exists beyond this world is *unknown*, not
settled - and it is discovered, if ever, through events: a portal beneath a ruin, a
catastrophe that turns the planet hostile, the remnants of something that plainly came
from elsewhere. A higher realm grants greater capability; it never teleports anyone into a
larger world.

Its depth comes from geography, ancient history, hidden regions, powerful factions, lethal
environments, secret realms, sealed domains, portals, ancient formations, lost
civilisations, powerful individuals, and - above all - information the player does not
have.

Progression does not move the character to a bigger map. It changes what they can
perceive and survive on the map that was always there:

```text
a low cultivator sees        a dangerous mountain
a stronger one sees          a spiritual vein
a stronger one still sees    an ancient formation beneath the mountain
a very powerful one finds    the mountain is one node of a formation spanning the region
```

The mountain never changed. The character's ability to perceive reality did.

What the player should feel, repeatedly:

```text
"I became stronger."
    -> "I can survive somewhere I could not before."
        -> "Things are happening here I did not know existed."
            -> "Someone vastly stronger has been shaping events around me."
                -> "I finally understand what was happening."
                    -> "I am strong enough to shape events myself."
```

And then, still: *"the people I knew before still matter."* The protagonist does not
become the centre of reality. They become one of the people capable of shaping it.

### The one exception: ordinal 46 is a place

There is exactly one point where progression is also *geographic*, and it is the
top of the ladder. Reaching True Immortal does not make somebody a louder version
of themselves in their starting province - it **moves them**, through the Lid,
onto a second layer of the same world.

That is a layer, not a bigger map, and the distinction is the one this section is
about: nobody up there has a higher ordinal, because 46 is the highest ordinal
there is. The far side is a different **environment** and a different **society**,
not a higher tier of the same ladder.

```text
layers.ts          two layers, ordered, and the single statement of what crosses
                   the Lid - for people, objects, manuals and information, in
                   both directions
immortal-world.ts  the far side: materialised on contact, ascension as a
                   transition, standing, what still kills, and its clock
```

`layer` is a stored field on locations, factions, NPCs and actors, defaulting to
`mortal`. Everything else stays in one place: one roster, one history ledger, one
lineage graph, one object table, one clock. Splitting the immortal world into its
own containers would have been the hard reset the design forbids, because
descendants, grudges, debts and provenance chains are all keyed by id and half of
them would stop resolving the moment somebody crossed.

**What changes is access.** Nothing below True Immortal can exist above the Lid;
nothing goes up with an ascending cultivator, which is what fills the world with
deliberately built inheritances behind deliberately calibrated doors; and coming
back down buys `BREATHS_IN_THE_LOWER_REALM` and draws the heaviest tribulation in
the game, which is why nobody above the Lid rules anything below it. The object
ceiling is the same rule applied to things: `OBJECT_CEILING_BELOW_THE_LID`, with
manuals exempt because paper does not let anybody strike at the rung it is rated
for.

#### The landing is not where anybody stays

`ensureImmortalLayer` materialises a seam, a landing that "nobody owns and everybody arrives
at", and five houses. For a long time that was the whole of the far side for a newcomer,
which made ascension read as an ending with a field attached. It is not: somebody who comes
through **settles**, quickly, and `settleAbode` is that.

An abode is an ordinary location - `kind: 'cave'`, the genre's own word for a cultivator's
dwelling and a kind with no faction implication, rather than a new member of `LocationKind`,
because a type widened for one case is the bespoke rule this design forbids. It hangs off the
landing, its id is keyed on the resident so settling twice is settling once, and what it is
FOR falls out of the generic systems: objects have a `locationId`, people have a
`locationId`, and being findable is `evaluateAccess` against thresholds like anywhere else.
What it is *worth* is that it is theirs, on a layer where `immortalStanding` scores a
newcomer zero on every axis and holdings is one of them.

#### The parting gift is the line

`sendAcross` requires a channel object carrying `LID_CHANNEL_TAG`, and nothing in the
codebase created one - so the only reliable connection between the layers was written,
tested and impossible to open. `ascend` now marks the parting gift as one on the way out,
which is what the setting has always said a channel is made of: a house that holds something
left by the one who crossed is a house that receives, and a house that holds nothing hears
nothing. It is a property of the OBJECT rather than of the house, which is why it is set
there and not on the faction - and it cuts both ways, because the gift is also what a rival
would have to take to cut the line.

#### Both readings of an immortal have to be true at once

The reason the layer exists. Measured against the world they left, a newly
ascended immortal is beyond comprehension. Measured against the world they
arrived in, they are a newcomer with no lineage, no standing, no allies and
unremarkable cultivation. `readTwoWays` computes both rather than asserting
either: the lower reading is a division over the living roster, and the upper is
a rank among residents.

The second half works because **the ladder ends**. Everybody above the Lid stands
at 46, so cultivation is not a differentiator up there at all - it is the entry
ticket, and a newcomer's is identical to a founder's. Standing is made of axes
this layer already stores for the world below: tenure, ancestry, a house, allies
and holdings. A newcomer scores zero on every one. No second power ladder was
invented, and none may be.

#### Two things still kill, and no more were added

Ascension removes exactly two: heavenly tribulation is behind them, and lifespan
stops being a number. Everything else applies. `advanceImmortalLayer` draws
against two hazard rates - environment and politics, the two the setting names -
at absolute fifty-year intervals, so the pass is decomposable and costs one draw
per resident per interval. Standing buys relief and never buys safety
(`MAX_PERIL_RELIEF` is deliberately short of 1), because a permanent apex nothing
can remove is the one thing this layer must not produce.

Death above is written as a secret fact and settles nothing below. There is no
signal across the boundary: the engine records `afterCrossing` because it is
allowed to know things the world cannot, and nothing that renders to a player may
read it. A house whose channel has gone quiet knows exactly as much as one whose
ancestor is standing up there ignoring it.

#### Immortal-era play stays thin, and pressure stays below

There is no second progression system, no second economy and no second survival
layer up there, and there must not be. `pressure.ts` is filtered to the mortal
layer at every selection site for the same reason: politics above the Lid has
been running uninterrupted for a very long time and is not something a
fifty-five-events-per-century budget gets to reorganise.

#### A measurement that corrected the prose

"Qi at densities the lower world cannot produce" cannot mean a bigger number. The
density scale runs 0..1 *by definition* - 1.0 is the richest ground the world has
ever carried - and a sealed ruin and a worked vein below both already reach it.
What is true is where the figure sits and how much of the map holds it: the age
below runs about a third and only ever falls, the places at the ceiling are a
small minority, and every one of them is sealed or contested. Above, the ceiling
is the floor, over the whole layer, unguarded. `immortalWorldShape` reports both
halves.

#### Higher layers, later or never

`WORLD_LAYERS` is an ordered array and every function is written against its
index rather than the literal keys, so a third layer would be a data change.
**Do not make one.** One mortal world plus one immortal world is sufficient, and
scale is not what this design is short of.

### Expansion is earned by events, never granted by rank

If the world ever grows beyond the planet, it grows because something happened:

- **A spatial discovery.** A portal beneath a ruin. It might lead to another region of the
  same planet, a sealed realm, an ancient battlefield, the ruins of an extinct people, or
  somewhere genuinely else - and **nobody knows which until they investigate**. Portals can
  be stable, unstable, one-way, lethal, politically controlled, or destroyed.
- **A planetary catastrophe.** Continents fracture, oceans move, spiritual energy
  collapses, a planet-scale formation fails, an ancient thing wakes, a war ends a
  civilisation. Survivors may migrate, settle elsewhere, follow an older civilisation's
  route out, or stay and try to live in what is left. If this happens it is a **major
  historical transition**, not a routine advancement.
- **Contact.** Another cultivation civilisation, an unrelated human one, a non-human one,
  the remnants of an old inter-world empire, or people who have never heard of this planet.

### Scale is not power

Discovering somewhere new must never imply that everyone there is stronger. A civilisation
found elsewhere might be weaker, stronger, declining, prosperous, isolated, hostile,
spiritually different, structurally different, or unaware that cultivation exists at all.
The player finds out; they are never handed a power ranking.

### Nothing gets discarded

If the player ever leaves, the place they came from is **not** a tutorial world that stops
mattering. Their family is there. Their enemies are there. Their descendants, their
faction, their reputation and their history are there - and it keeps changing in their
absence, so returning after a long time means returning somewhere different.

Avoid this failure mode entirely:

```text
new world found -> old characters irrelevant -> old factions irrelevant
  -> new world holds stronger NPCs -> repeat
```

The correct shape adds without deleting:

```text
new world found + the old world remains + old relationships remain
  + old history remains + new opportunities appear
```

This is the same rule as characters persisting after they are surpassed, applied to
places. See [`../../../docs/world/people.md`](../../../docs/world/people.md).

### None of this is a required ladder

```text
village -> city -> sect -> region -> continent -> planet -> elsewhere
```

is a range of possibilities, **not** a progression everyone walks. Most cultivators remain
regional their whole lives. One player might be caught up in a planetary catastrophe;
another might fall through an inter-world portal by accident while looting a ruin; another
might farm spirit herbs in one valley for two centuries and die there. The simulation
follows circumstance, not a script.

### Implementation: simulate what matters, generate the rest on contact

Keep detailed state only for currently relevant locations, discovered locations, important
NPCs, known factions, important historical events, discovered worlds, active portals, and
persistent player relationships. Everything else stays abstract until something makes it
real, at which point it is generated and *then* persisted. The rule is stated in full in
[`../README.md`](../README.md).

---

## Locations carry environment, not just a name

A location is an environmental modifier. Keep it lightweight:

```text
spiritual_density | danger | resources | climate | political_control
special_rules | known_secrets | historical_scars
```

so that "cultivate for ten years" resolves differently in a city, in wilderness, on a
spirit mountain, on a poisoned battlefield, inside a ruin, in sect territory, or in a
forbidden zone.

### Environment interacts with cultivation

A cultivator's capability is contextual. A poison specialist is stronger in a corrupted
region; a fire cultivator near a volcanic vein; a soul cultivator weaker inside a
soul-suppressing domain; a sword cultivator inside an old sword formation. This is what
makes geography mechanically real, and it pairs with the entry / survival / operational /
mastery thresholds below: *where* you are changes *what you are worth*.

### Environmental gating

Power decides which environments a character can enter and operate in. A location carries
four thresholds:

```text
entry        can set foot in it at all
survival     can remain without dying
operational  can act, fight, search, cultivate there
mastery      can manipulate the environment itself
```

Crucially, **specialised techniques, artifacts, physiques or knowledge modify these
thresholds.** A lower-realm specialist may survive somewhere a stronger generalist cannot.
That is what keeps specialisation valuable and stops realm from being the only axis.

#### The bars have to bite, and for a long time they did not

`evaluateAccess` answers "what level are they at". Nothing answered "so what", and the
result was that the whole system was decoration. Measured in a live run: an ordinal 0
cultivator inside a compound whose bars read entry 15 / survival 19 / operational 23 /
mastery 25 walked in, cultivated for seven months, gained a full rank and was never
touched. The paragraph above said "below survival you get in and die" and there was no
code path that could make it true.

`standingConsequence` is that path. It turns an assessment into the two currencies a span
is actually paid in - HP per day, and whether progress accrues - and the caller hands
those straight to `simulateTimeSkip` through its `hostility` field. Three distinct
failures, and they read differently on purpose:

| Level | What happens |
|---|---|
| `barred` | Turned away. No time passes, and the refusal names both bars, because that sentence is how a player learns the ladder of places exists |
| `lethal` | Admitted, and the ground takes `HOSTILE_GROUND_HP_PER_RUNG` of max HP per day per rung below the survival bar, capped so nothing is instant. Control comes back rather than a run quietly ending in a hole |
| `surviving` | Admitted, alive, and the ground gives up nothing at all. Progress is zero for the whole span |

The engine holds no map, so the map layer prices the gap and passes down two numbers and a
reason; `survival.ts` remains the only place a death is decided. And the affinity system's
`thresholdOffset` finally does something observable: a water root stands on ice that kills
a generalist at the same rung, and `AccessAssessment.applied` itemises why.

### The qi scale: 1 to 100, and the Hollow Court holds the 100

`qiDensity` on a location is an integer 1..100 (`qi-scale.ts`). It used to be a 0..1
fraction, which is the same information at a tenth of the resolution: the default
birthplace read 0.3475 and the best ruins read 1.0, so almost every difference a player
could act on lived in a decimal place nobody was ever shown.

That mattered because of what thin ground does to the ladder. Rank 16 costs 30,803
qi-units; fifty years of unbroken seclusion at half rate produces about 25,429. On thin
ground the ladder becomes unclimbable somewhere around ordinal 16, permanently, for every
run - so "go somewhere better" is the whole of the middle game and the scale it is decided
on should be legible.

Two numbers, deliberately different, and one conversion between them:

| Field | Range | Means |
|---|---|---|
| `qiDensity` | 1..100 | GEOLOGY. What the vein holds |
| `environment.spiritualDensity` | 0..1 | USABILITY. What somebody standing there can draw |

A sealed ruin is 100 and 0.05 at the same time, and that gap is the whole economy of
exploration. `qiFraction` is the only conversion; nothing else may divide by 100.

The four ambient bands are unchanged and are still **drawn per window from the usable
density** rather than read off it, so a rich vein still sometimes reads thin. That
variance is weather over fixed geology and must not be flattened.

Nothing below the Lid exceeds 100, and the 100 is **derived rather than named**:
`sectGroundDensity` measures a faction against the strongest faction in the catalog, which
today is the Hollow Court at ordinal 44. Unseat it, rename it, or write something stronger
and the top of the scale moves with the arithmetic instead of being left pointing at a
house that no longer deserves it.

### A sect is a place

Every seated faction holds a `sect_seat` location of its own (`sectGroundId`), a child of
its region and linked to it by an ordinary road. This closed a gap that made membership
nearly worthless: the engine would tell a new disciple that "being on their roll and being
on their ground are two different things" and then provide no way to ever reach the
ground, because a sect was a row in `sect_members` and nothing else.

Everything about the ground is derived from columns the faction already carries, so there
is no sect-specific rule anywhere:

- **`qiDensity`** from `powerOrdinal` against the catalog's apex. A sect holds the best
  ground it can hold, and `powerOrdinal` is exactly how much it can hold. Floored at the
  region's own density, so a weak sect in a thin province honestly offers a disciple
  nothing but a stipend.
- **thresholds** `entry` and `survival` are 0 - anyone may walk up to a gate and stand in
  the forecourt. `operational` is the admission bar, which is what makes the gate mean
  something: a rogue can stand there and cannot work there. `mastery` is the sect's own
  power.
- **`discovered: false`** A sect's ground is a name you have to be given. The knowledge
  gate does the rest, and it is the right gate - it was never broken, it was only never
  opened.
- **`affinities`** from `formationIntegrity`: a compound still running its own arrays
  answers to somebody who can read them.

### Secret realms and portals

The planet contains secret realms, pocket dimensions, sealed domains, isolated spaces,
ancient ruins and portals. A portal is never merely fast travel - it leads somewhere with
its own spiritual conditions, ancient inhabitants, strange rules, rare resources, unique
creatures, sealed beings, lost inheritances, cultivation suppression, temporal anomalies,
or an unfinished ancient conflict.

A secret realm is not a dungeon. It has its own history, previous inhabitants, factions,
ecosystem, rules, resources, mysteries and changing conditions. **NPCs enter secret realms
independently of the player**, and may return with things the player wanted.

A single realm can involve many power levels at once - outer regions for lower
cultivators, inner regions for mid, a centre for the strong, a sealed core holding
something ancient. What makes this work is **interdependence**: lower-level participants
must hold something the powerful cannot simply replace - a specialised technique, a unique
artifact, a passage only they can enter, historical knowledge, an unusual physique, the
ability to activate a particular formation.

---

## Capability is a question, not a gate

The engine must never answer an intent with *"your realm is too low, this action is
unavailable."* It answers what happens **when you try**, which is a different question and
a better one.

Five separate predicates, and they come apart:

```text
can attempt      is the action physically initiable at all
can survive      will the attempt kill you
can succeed      can it actually work
can understand   will you comprehend what you found, or what happened to you
can force        can you impose the outcome over resistance
```

A Foundation Establishment cultivator **can attempt** to enter an ancient ruin. Whether
they **survive** it is a different predicate, and whether they **understand** what is
inscribed on the wall is a third. A weak cultivator **can attempt** to rob a Core Formation
elder; the simulation must permit the attempt and let circumstances - preparation, terrain,
the elder's attention, who else is present, what the thief knows - decide the outcome.

This is also the **anti-hallucination primitive**. When the narrating agent asks "can they
do this," the engine returns these five answers as facts, and the agent narrates from them.
It removes the situation where a model quietly decides an action is possible because the
story would be better that way. `assessCapability` therefore returns a structured result
with the arithmetic itemised and a stated reason per predicate, never a bare boolean.

Specialised techniques, artifacts, physiques and knowledge modify each predicate
independently: a lower-realm specialist may survive where a stronger generalist cannot,
and may understand what a stronger one cannot read.

`attempt` fails only for **physical** reasons: a sealed door and no key, a window that is
shut, being dead, not being there, a barrier that genuinely will not open for someone of
that weight. It is never failed because the action is unwise, because the target is
stronger, or because the odds are bad. Those are answers to the other four questions.

A realm is a **capability class**, and a class is *potential*. Whether a cultivator holds
any particular grant within it is separate state. The realm-by-realm statement of what
each class makes possible lives in
[`../cultivation/README.md`](../cultivation/README.md).

---

## Opportunities have windows, and close

Every opportunity carries a temporal window, and the world does not hold it open:

```text
a spirit fruit ripens        12 days
a secret realm opens         every 80 years
an ancient cultivator wakes  once in 300 years
sect recruitment             annually
a war escalates              over 4 years
```

**The player can simply miss things**, permanently, including things they never learned
about. Missing a realm that opens once a century by four months is a legitimate and
desirable outcome. Someone else may take it instead, and that has consequences.

The point of storing this rather than improvising it is that the window was on the books
before anyone knew whether the player would be there.

### Extraordinary opportunities stay rare

Extraordinary opportunities - a rare treasure, a secret realm, an unusual cultivation
environment, an expert encountered at the right moment, a bloodline awakening - must be
capable of enormous trajectory changes, and must stay **rare**. Most cultivators live
ordinary cultivation lives and never receive one. That is precisely what makes them
extraordinary when they land.

**Exploration is how they are found**, and it must carry risk, preparation, information,
navigation, environmental hazard and competition. Even a powerful character should still
encounter things they do not understand.

What an inheritance *is*, as opposed to when it is available, is in
[`../../../docs/world/economy.md`](../../../docs/world/economy.md).

---

## History: ground truth, and what survives of it

Every significant thing that happens is appended as a dated, attributed, located fact.
`history.ts` owns two of the three layers:

```text
1. ground truth          what actually happened            here
2. the surviving record  what can still be recovered       here (`fidelity`)
3. belief                what a person or the public holds  ../social/
```

`truth` can say **unresolved**, which is what stops the database secretly knowing
everything. See [`../social/README.md`](../social/README.md).

### The world contains things that almost happened

History must record **failed branches** - not alternate timelines, simply possibilities
that did not occur:

- a sect that nearly unified the continent, and did not
- a cultivator who nearly ascended, and died
- a house that nearly recovered its lost discipline, and lost the last holder first
- someone who nearly joined the player, and chose otherwise

These are stored as ordinary history with a near-miss marker. They cost almost nothing and
they are the strongest available antidote to a world that looks built to produce the
player's success. A world where everything that was tried worked is a world with an author
standing visibly behind it.

---

## The world persists, but the world is not immutable

The player is not progressing through a sequence of maps. They are living through the
history of a world that the people inside it can change - including while the player is
not looking.

### The map is not sacred

A location is not a permanent object with a fixed description. It can be destroyed,
abandoned, conquered, rebuilt, forbidden, corrupted, enriched, sunk, raised, split,
merged, sealed off, turned into a secret realm, have its spiritual conditions altered, or
have its ecosystem transformed.

A player must be able to return somewhere familiar and find it fundamentally changed.

### Locations carry their history as state

Every location conceptually holds `origin → historical changes → current state`, and the
player uncovers that history gradually:

```text
Blackwater Valley
  origin           an ordinary river valley
  3000 years ago   a sect established here
  1800 years ago   the sect destroyed
  500 years ago    a battle moved the river
  100 years ago    a merchant city built on the ruin
  now              a half-ruined city beside a corrupted river
```

This is stored state, not lore text. The layers must be separately queryable, because the
current inhabitants may hold competing explanations, the ancient records may be
incomplete, and the true cause may be recoverable centuries later. The schema reflects
that: location history is its own table, and the origin is denormalised onto the location
row rather than stored as change index 0.

### Catastrophes make geography

A sufficiently violent event permanently alters the physical world: a mountain range
broken, a river diverted, a city buried, a sea opened, an island raised, a region split, a
buried structure exposed, an underground world opened, a portal created or destroyed.

**Do not model this as a new map.** Modify the existing world state. The map does not grow
- it scars.

### Forbidden zones are made, not placed

A normal region becomes forbidden *because something happened there*: a battle between
powerful beings, a failed breakthrough, an ancient weapon, the death of something large,
spiritual contamination, dimensional instability, a curse, mass death.

```text
before      a fertile forest
event       an ancient cultivator dies here
after       a forbidden forest
then        plants mutate, beasts turn, the spiritual conditions change,
            ordinary people evacuate, cultivators come to investigate,
            rare resources appear, and nearby factions fight over access
```

And centuries later, the cause is forgotten. A region should sometimes exist in its
present form because of something that happened three thousand years ago that nobody
alive can explain. *"Nobody knows why"* is a legitimate and desirable state of the world -
right up until someone finds out.

### History is physically visible

Broken mountains, dead rivers, craters, ruined cities, abandoned sects, shattered
formations, strange local climates, dead zones, anomalous regions, old battlefields. These
must **affect play**, not merely decorate it - they gate access, hold resources, distort
cultivation, and draw factions.

### Scale of destruction tracks power

Low-level conflicts wreck buildings. Higher ones break mountains. Higher still reshape
regions. Only the very top threatens something planetary - and **not every high-level
fight is automatically apocalyptic.** Escalate the physical consequence with the power
actually involved.

### Change creates power vacuums

Events generate incentives, and incentives reorganise the world:

```text
an old mountain collapses -> buried ruins exposed -> sects investigate
  -> a treasure surfaces -> factions compete -> war -> cultivators migrate
    -> a new city grows where there was nothing
```

NPCs react on their own: they flee, investigate, exploit, defend, conquer, trade, migrate,
ally, betray, take revenge, settle, abandon their sect. **The player does not need to
initiate any of it.**

Change also transforms existing relationships. Two sect brothers whose sect is destroyed
may spend the next ten years each believing the other abandoned them - both alive, both
advanced, both now in different factions, the old event still load-bearing.

### Destruction opens as much as it closes

A destroyed place becomes ruins, a forbidden zone, a treasure site, a pilgrimage site, an
excavation, a new settlement, a battlefield, a secret-realm entrance, or a resource. The
end of a location is a transition, not a deletion.

### The Consequence Test

For every event that claims to be major, the engine and the narrator should be able to
answer all ten:

1. What changed immediately?
2. What changed **physically**?
3. Who benefited?
4. Who lost something?
5. Which factions reacted?
6. Which relationships changed?
7. What new opportunities appeared?
8. What old opportunities disappeared?
9. What rumours spread?
10. What is still true ten years later?

**If an event has no consequences once the scene ends, it was not a major event.** Either
give it consequences or stop calling it one.

The feeling to produce:

> *"The world I knew is still here, but it isn't the same world any more."*

---

## Catastrophe: the player lives in history, and does not own it

Some history happens because of the player. Some happens around them. Some happens despite
them. And some is so far beyond them that surviving long enough to see the outcome is the
entire achievement.

### Three kinds of world event

Computed per observer, never stored.

| Kind | The player's position | How they encounter it |
|---|---|---|
| **Historical** | Not alive, or not yet involved | Ruins, survivors, records, scars, descendants, political consequences |
| **Concurrent** | Alive, elsewhere | Rumour, messengers, refugees, sect announcements, merchants, shifted trade, changed borders |
| **Witnessed** | Physically present | Directly - and usually far beyond their power to affect |

All three must be able to occur. Only the third involves the player at all, and even then
involvement is not the same as participation.

### The player is not the centre of catastrophe

A world-scale event can occur when the player did nothing, was pursuing something else,
was in the wrong place, was far too weak to matter, or never learned it was coming. **The
world does not wait for the protagonist**, and it does not schedule its disasters around
their readiness.

### Powerlessness is valid gameplay

Witnessing a conflict between vastly stronger beings must not suddenly make a low
cultivator capable of joining it. The honest shape of that encounter:

```text
a distant sound -> a mountain goes -> an aura that stops the body working
  -> the understanding that something is very wrong -> flight
    -> the terrain changing while you are still in it -> barely surviving
```

**That is a successful encounter.** Survival is sometimes the whole of it, and the engine
must be willing to end an event with the player having achieved nothing but living.

Do not guarantee a reward. A catastrophe *may* leave trauma, knowledge, rumours,
reputation, opportunity, enemies, a cultivation insight, or a relationship with a
survivor. It may also leave nothing but the fact that you are still breathing.

### Observed is not understood

The player may see the sky change, a mountain break, a city stop existing, a portal open,
an aura arrive, an old formation wake, or a region turn - and have no idea what caused
any of it. The truth should be recoverable *later*, sometimes much later, sometimes never.
This is where mystery comes from, and it must not be spoiled by a narrator explaining the
event as it happens.

### Witnessed events write real state

If the player watches a mountain be destroyed, the database records **the mountain is
destroyed** - not "the player saw a dramatic scene." The location's state changes, its
history gains an entry, and every downstream consequence follows from that record.

This is the same authority rule as everywhere else: narration describes a state change
that actually happened.

### Lived memory and world record can diverge

The player remembers: *"there used to be a mountain here."* A character born later says:
*"there has never been a mountain here."*

**Both are correct**, and the engine must be able to hold both at once - ground truth, the
world's surviving record, and what any given person believes are separate layers. The
player's lived history is real even when the world has forgotten it. Occasionally the
player will be the only remaining witness to something, and that is a form of knowledge
worth having.

Mechanically: the destruction is a fact with `fidelity: lost` in `history.ts`, the
player's memory of it is a record in `memory.ts`, and the younger character's belief is in
the social layer's belief store.

### One catastrophe seeds years of world activity

```text
powerful beings fight -> a mountain is destroyed -> an old ruin is exposed
  -> factions find it -> treasure hunters arrive -> a town grows to serve them
    -> a sect claims the territory -> conflict
```

A single witnessed disaster should be capable of generating months or years of subsequent
world movement, none of which requires the player.

### The long arc

Over a very long run, the player's relationship to events of this scale should change:

```text
helpless witness -> survivor -> participant -> influential actor
  -> someone capable of causing one
```

That progression is earned across a lifetime and is never promised. Most cultivators stop
at the first step, having survived one bad afternoon that they will describe, inaccurately,
for the rest of their lives.

---

## Lineage

The minimum viable version: a parent/descendant edge between characters, plus what travels
down it - bloodline traits, family reputation, inherited enemies, inherited resources, and
inherited obligations. There is no genetics model, no trait expression rules, no breeding:
those would be a simulation, and this layer does not simulate.

This is what makes long time-skips land. A player returning after two centuries finds their
disciple's descendants running a city, or finds someone hunting them for something an
ancestor did. Without the edge, a century skip has nothing to attach consequence to.

Factions are holders of memory in the same way people are: a faction remembers that its
elder was saved, its disciple was killed, its artifact was stolen, or that someone refused
an alliance - and it still remembers generations later. *"Your name is still recorded in
our ancestral hall"* should cost one row.

`heirsOf` produces the array the social layer's `inheritLedgerOnDeath` consumes. Grudges,
debts and oaths themselves belong to [`../social/README.md`](../social/README.md).

---

## Possession, ownership, and where things came from

**Possession is not ownership.** Keep four things separable:

```text
possession              who is physically holding it
ownership               whose it actually is
claim                   who asserts a right to it
knowledge of ownership  who knows any of the above
```

A player who finds an ancient artifact possesses it. An extinct clan's surviving
descendant may hold a legitimate ancestral claim. Neither may know about the other. That
gap is a situation, and situations are what this engine is for. Collapsing the four into
one `ownerId` field deletes every one of them.

**Significant resources carry provenance** - not every spirit stone forever, but anything
that matters:

```text
108 spirit stones     source: an abandoned mine     found: day 180
                      previous owner: unknown

an old sword          source: a dead cultivator     acquired: inheritance
                      previous owner: named, and remembered by their sect
```

This is what makes stolen goods, disputed inheritances, faction claims, investigations and
century-old karmic consequences possible without a separate system for each. The economic
consequences are in [`../../../docs/world/economy.md`](../../../docs/world/economy.md).

---

## NPC records and goals

NPCs are small durable records, not simulated agents. The whole required shape is eight
fields: identity, cultivation, location, faction, goals, relationships, history (fact ids)
and memories (memory record ids).

Goals are five fields, not psychology:

```text
goal | priority | progress | obstacles | deadline
```

*Avenge a father. High. Has identified the killer's faction. Insufficient strength. No
deadline.*

Three hundred years later that goal can still be live. And if its holder dies, **the goal
becomes legacy state** - a disciple continues the revenge, a descendant inherits the
grudge. That is the continuity the whole design is aiming at.

Existence is multi-valued, and `missing` and `unknown` are correct answers rather than
placeholders. The state set is defined in
[`../cultivation/README.md`](../cultivation/README.md). Why NPCs must be protagonists of
their own lives is in [`../../../docs/world/people.md`](../../../docs/world/people.md).

---

## Time is a mechanic, not a calendar

Characters age. Sects change. Generations replace each other. Enemies die and their grudges
are inherited. Cities grow, factions collapse, techniques are lost, treasures are
rediscovered.

A ten-year retreat must genuinely change the world. The player must be able to vanish for
decades and return to a substantially different one.

Long life is bittersweet: outliving friends, watching generations die, losing touch with
where you came from, growing detached, accumulating enemies, becoming isolated.

### The player is not the world's clock

Major events happen while the player is in seclusion, travelling, inside a secret realm,
injured, or busy elsewhere. **They will miss things, permanently, and that is correct.**
They return and the world has moved.

There is no single predetermined timeline. A different faction winning produces different
territory, different resources, different people rising, and different conflicts - and the
divergence is irreversible.

### `advanceTime(state, days)`

Moves the world clock and returns what changed. It does **not** simulate anybody. It does
exactly four things:

1. moves the date;
2. fires the **scheduled** consequences that fell due in the span;
3. applies the **durable** processes that were running, as a rate times a span;
4. hands back enough state for the LLM to reason about what happened.

Every cost is a function of how much is **on the books**, never of how many days passed:
scheduled effects are `O(effects due)`, durable processes are one multiplication each, and
lifespans are one pass over NPCs because a death date is stored. That is why a thirty-year
seclusion is cheap.

The player-facing counterpart - a long action interrupted by the events inside it - is the
time-skip primitive in [`../cultivation/README.md`](../cultivation/README.md).

---

## Gatherings: the chosen of allied houses meet each other

`gatherings.ts`. The world simulated deaths, births, goals, grudges and disasters and its
people never **met**: measured before this module existed, 221 inherited grudges after five
centuries and not one of them originating in two people who had been in a room together.

A gathering is an event that puts a defined set of people in one place for a defined time
and produces outcomes that persist. Four kinds, differing in what they write:

```text
meeting      introductions. Ties, and nothing else. The floor and the commonest.
challenge    resolveConfrontation with intent 'subdue'. The interesting endings are
             the ones where nobody-gets-hurt fails, and the one where the gap turns out
             to be categorical - which opens a GOAL, and goals inherit.
competition  ranked on assessPower times a seeded showing. Moves resources.prestige,
             and can select the winner UPWARD into the host house at its lowest rank.
expedition   several houses' chosen enter a site and are scored on the HAUL (wings
             worked, weighted by depth - rewards spreading out) or on a PROOF (who
             reaches a named room first - rewards reading the place, because
             identifyBuilder either places the builder or does not).
```

Three rules bind it, and they are the ones worth checking before changing anything here:

- **Who is allied comes from `FactionRecord.standing` and nowhere else.** Seeded from the
  catalog's `rivalIds` and `parentFactionId`. `ALLIED_STANDING` is `pressure.ts`'s own
  `rivalsOf` threshold with the sign flipped, so the two questions cannot drift apart.
  There is no alliance table and there must never be one.
- **Exclusion is the point.** A house with no living `chosen` sends nobody; a house nobody
  is allied to is never invited; a host that cannot pay `HOSTING_COST_PER_HEAD` does not
  gather. Measured, the difference is 2.2 cross-house ties per head for somebody who was in
  the room at least once against 0.17 for a chosen who never was.
- **Outcomes are readable later.** Every relationship row a gathering writes carries the
  gathering's fact id in `factIds`, so "did this tie begin at a gathering or at a death" is
  answerable from the row alone two centuries afterwards. `write()` moves an existing
  standing rather than replacing it, so a polite afternoon cannot overwrite a blood feud.

Scheduled from `applyPressure` on the same yearly line as `applyAdvancement` and
`applyRecruitment`, and deliberately **not** in the weighted event table - for the reason
`applyConvergences` gives, a calendar that only fires when the year had a slot free is not
a calendar.

`scripts/audit-gatherings.ts` measures the rate, the supply of attendees, where
relationships originate, whether the same houses always win, and what exclusion costs.

---

## Reading order

```text
layers.ts        two layers, ordered; what crosses the Lid in either direction
history.ts       ground truth and what survives of it; near-misses; unresolved
locations.ts     origin -> changes -> current state, separately queryable
capability.ts    the five predicates, answered together, with reasons
opportunities.ts dated windows that open and close whether or not anyone is watching
possessions.ts   possession / ownership / claim / knowledge, plus provenance
lineage.ts       the parent-descendant edge and what travels down it
npc-state.ts     NPCs as small durable records; goals outlive their holder
memory.ts        durable memories, search, and the LLM-driven compression write path
world-state.ts   the authoritative store; plain serialisable data, pure mutations
time.ts          advanceTime: what fell due, what was running, what was missed
manuals.ts       who holds a book, and who a house has decided is worth its top shelf
gatherings.ts    the chosen of allied houses meet; meetings, bouts, rankings, sites
immortal-world.ts the far side: arrival, standing, perils, and its own clock
```

## Related

- [`../README.md`](../README.md) - implementation philosophy and the five pillars
- [`../cultivation/README.md`](../cultivation/README.md) - realm classes, time-skip, scars
- [`../social/README.md`](../social/README.md) - belief, grudges, secrets
- [`../../storage/README.md`](../../storage/README.md) - how these tables are migrated
- [`../../../docs/world/`](../../../docs/world/) - the setting these mechanics express

---

## Ruins, convergence, and chains of forced choices

Four modules landed together and are one subject observed at different moments. The
authoring guide is [`../../../docs/world/ruins.md`](../../../docs/world/ruins.md); this is
the contract.

**`cascade.ts` - the world changing itself, in more than one step.** `pressure.ts` fires
events that are complete on their own, which is right for institutional churn and wrong
for the thing the setting is actually about: a house is destroyed, its survivors choose,
and one of the options is the gravest thing a house can do. Each step's options are
produced by the state the previous step left. **There is no branch anywhere on a faction
id, a tier or a title**, and a protector spending itself on an enemy's ground is `expend` -
the generic option "spend the whole of an asset at a target, once" - priced off the
asset's own ordinal. The exposure that follows is *derived*: `couldDieToADisaster` is
asked of each person actually standing there, so `catastrophe.ts`'s three tiers reproduce
themselves without the table being read.

**`provenance.ts` - four axes that must stay independent.** `identifyBuilder` never reads
wing state and `wingsOf` never reads provenance. If those cross, the axes have collapsed.
Everything lives on `location.data` as flat scalars plus one JSON string, so no
`LocationRecord` field, migration or repo changed, and a site seeded before the module
existed reads as anonymous and untouched - the honest default.

**`convergence.ts` - the consequence half of `OpeningCycle`.** That field has been on the
record since the location layer was written and nothing in play consumed it. The escape
from a closing window is `spatial_folding`, an existing Void Refinement grant, and its two
properties do all the work: it is too high for anybody who explores ruins, and it is
short-range, so it narrows as the window wanes and fails when it would matter most. **Do
not add a consumable version.**

**`ruin-mechanics.ts` - the test for anything added here.** *Does it change what the player
knows, what they are, or what the rules of the place are - rather than how much damage
they take?* If it is a number, it belongs in the encounter layer.

### Two guards that were paid for by measurement

- **A region is a container and must never be a catastrophe's target.** `faction_founded`
  seats a splinter at its founder's location, which can be a region node, so `expend` was
  forbidding whole provinces. `birthplacesIn` then found nowhere habitable, births stopped
  dead, and the world aged out: 486 living at year 400, 250 at 450, **1 at 500**, with the
  roster frozen and 3,206 of 3,207 people dead. `zone_forbidden` has always filtered to
  `wilds` and `vein` for exactly this reason. The guard is now stated at both consumption
  sites.
- **A wing's `sealed` is a separate door from the site's.** Deriving wings from
  `location.sealed` meant breaking a site's outer seal left a place nobody could enter any
  part of. Only the deepest wing is separately sealed; whether the site is shut is
  `evaluateAccess`'s question.

### The measurement, and what it is

[`scripts/audit-standoff-drift.ts`](../../../scripts/audit-standoff-drift.ts) runs the
standoff question against a **live world** at day 0, 50, 200 and 500. This is deliberately
not `playtest-conspiracy.ts`, which reads the catalogs and answers identically every time.

**Equilibrium is the initial condition, not an invariant.** A seeded world at day zero must
read the way the setting says it reads; a world that has run forward is *expected* to
differ, and a tilt that produces a war is the system working. What would be a defect is a
figure that moves with nothing to point at - so the audit prints the causes beside the
rate (seals still held, ground forbidden, ruins in existence). If the rate moves while
those hold flat, something changed in the combat arithmetic and that is a different
finding.

