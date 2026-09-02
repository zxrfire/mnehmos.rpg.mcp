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
places. See [`../../../docs/world/houses/people.md`](../../../docs/world/houses/people.md).

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
[`../../../docs/world/things/economy.md`](../../../docs/world/things/economy.md).

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

### A played deed is a fact like any other, and the ledger points at it

**Every write goes through `appendWorldFact`, never `appendFact`.** The world-level append
cannot skip the back-link, so the fact lands on the record of everybody it names and the
people who were standing there are drawn from the place. `who-was-there-when-it-happened.ts`
holds the measurement that made it necessary.

The same rule binds the played game, and for a long time it did not. Of the 28 exported
functions in this directory that append a fact, four were reachable from anywhere else in
`src/` and three from a player action - an abode above the Lid, a descent, and a killing.
Everything else a player did that the world should contain went into the SQLite obligation
ledger and nowhere else, so a house held a robbery grudge and the world did not contain the
robbery. That is a missing writer on one side of every propagation system in the repository:
`circulating`, `buildPlayerDigest` and every hearsay path read `state.history.facts` and
nothing else.

`a-deed-enters-the-world-as-a-fact.ts` is the write path for a deed, in either direction.
Two rules on it:

- **The weight is decided exactly once.** A caller writing a record that already carries a
  severity passes that severity through; a caller that has decided nothing hands over a
  `Deed` and `../social-leverage/what-a-deed-leaves.ts` prices it, off cost against what the
  payer had. Supplying both is refused by the type.
- **The fact and the account are two views of one event, not two memories.** The fact is
  written first so it has an id, and that id goes on the obligation's `triggeringEventId` -
  a column `grudges.ts` has indexed since the social migration and which nothing in
  `src/web/` had ever set, because there was never a fact to point at.

Opening an account is still the obligation ledger's job. A deed that warrants no grudge gets
the fact and no grudge.

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
consequences are in [`../../../docs/world/things/economy.md`](../../../docs/world/things/economy.md).

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
their own lives is in [`../../../docs/world/houses/people.md`](../../../docs/world/houses/people.md).

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

### And the player is on the invitation list

Every attendee is drawn from `chosenOf`, which reads `state.npcs`. Below the Lid the
player had no `NpcRecord` at all, so they were not rarely invited - they were **absent from
the list the invitation is drawn from**, at every rung and in every house, and none of the
above could include the person playing.

`src/web/the-player-as-a-row-the-world-can-invite.ts` puts one row there, with the **same
id as the cultivator**, following the shape `residentAbove` already uses above the Lid so
that lineage, grudges, obligations and provenance keep resolving against one identity. It
is refreshed from the authoritative `Cultivator` at the top of every turn and again at the
end of it: the sheet is the source and the row is a projection of it, in that order.

**The row is not the world's to move.** It carries `PLAYER_ROW_TAG`, and the four passes
that decide something *for* a cultivator skip it:

```text
applyAdvancement       Would climb the ladder a second time - the player's rung is
                       time-skip.ts's - and would chronicle a breakthrough that never
                       happened.
the lifespan pass      time.ts.  Would declare the player dead mid-run and write it
                       into the world's own history.
applyRecruitment       Would enrol them in a house they never walked into. Which house
                       somebody is in is a decision taken at a gate.
applyBookAcquisition   Would hand them a manual they never earned, which is the defect
                       manuals.ts exists to close, running the other way.
```

Those four and no others. Everything else - being met, ranked, resented, owed something,
named in somebody's goal, seated at a gathering - is left alone deliberately, because it
is the whole point of the row existing.

Two of those guards are also what keeps a world *reproducible*. The refresh undoes any
record the world writes to this row, so on correctness alone the advancement and lifespan
guards would be enough - a fact appended to the chronicle is the only thing a refresh
cannot take back. But `applyRecruitment` and `applyBookAcquisition` both draw a random
index over the roster, so a row sitting in their candidate lists shifts every draw after
it and quietly reseeds the world. **Any pass that samples the roster by index needs this
guard even where the write itself would be harmless.**

---

## Absence: the world noticing that somebody is gone

`when-somebody-does-not-come-back.ts`. Seclusion is this game's core loop and until
this module it cost exactly the days it took. Everything above makes things happen while
a cultivator is sealed in a cave - elders die, borders move, houses fold, juniors are
promoted - and none of it was **about** the person who was not there. The events were
already happening; they were not happening **to** the player.

An **absence** is a dated object: who was gone, from when, who saw them go, who was told,
and a snapshot of every tie that pointed at them on the day they left. Once a year it
lets the people holding those ties reach the conclusions time actually forces, and on
return it reports what is materially different.

The product is not "relationships decay". It is that **several parties end up holding
different, dated, sincerely-believed accounts of the same absence, and at most one of
them is right**:

```text
truth (engine)          in seclusion under Stone Fall, alive throughout
the enemy who watched   knows      witnessed   still alive, still in there
the sect                believes   inferred    died, year 47
the register            believes   read        struck out, year 47
the woman who waited    believes   inferred    he left and did not come back
```

None of that needed a new table. `KnowledgeLedger.disagreementsAbout(claimKey)` already
returned exactly this shape and had nothing to return, because nobody was writing the
rows. Every account is an ordinary `knowledge.ts` record on `fate:<id>`, with a stage from
`discovery.ts`, and the register is a `public` holder like any other - a document with its
own date and its own author, which outlives everybody who agreed with it.

Four rules bind it:

- **Events, never a meter.** There is no abandonment score. Somebody who stopped waiting
  did so on a day, after a stated number of silent years, and what changed is a closed
  `reunion` goal, a rewritten tie carrying the fact id that did it, a chronicle fact, and
  a knowledge row. Ask the world "how much has she given up on him" and it has no answer;
  ask "did she stop, and when" and it has a date. This does not violate the social layer's
  ban on decay: that layer is storage and must never shrink a record, and this is the
  world layer, whose job is to make dated events happen from seeded rolls exactly as
  `pressure.ts` does.
- **Waiting is a `reunion` goal.** `GoalKind` has carried `'reunion'` since `npc-state.ts`
  was written and nothing had ever produced one. Using it rather than a new field means
  waiting **inherits**: `settleNpcDeath` hands unfinished goals to an heir with the
  generation counter bumped, so a childhood friend's grandchild can still be looking.
- **Telling people is the lever.** Waiting requires having been informed, and both clocks
  are halved for somebody who was told where the absentee went. Patience factors take the
  **smaller** of whatever applies rather than the product, because loving somebody and
  having been told by them are the same reason to keep a door open, and multiplying them
  produced a world where the people who mattered most cost you least.
- **Nothing about the player.** The absentee is an id and a name, and nothing branches on
  whether they have an `NpcRecord`. The same pass serves a sealed player and the ordinary
  `disappearance` event, whose own chronicle line already read "treated as dead by
  everyone except one person" without anybody ever having been that person.

### Two things measurement changed here

- **`settleNpcDeath` inherited only the enemies.** It took a tie at standing `<= -0.4` and
  dropped everything above it, so grudges outlived their holders and friendships died with
  them - eighteen inherited grudges after five centuries against zero inherited
  friendships. Five hundred years of that is a family that accumulates nothing but debts
  owed against it. The bar is now symmetric on `GRUDGE_STANDING` / `FRIENDSHIP_STANDING`,
  and household and teaching kinds pass down as `ally`, because an heir did not marry
  their parent's spouse - what descends is the obligation. `worldShape` counts the two
  sides separately so the asymmetry is visible if it ever returns.
- **The world had almost nobody to lose, and now it has.** Measured on a seeded world
  after 120 years: 73 ties among 498 living people, of which 33 were enemies, 19 rivals,
  and exactly **6** at or above the standing the engine calls a friendship - with no
  households and no teaching lines anywhere, because the only kinds the world produced
  were `ally / rival / enemy / acquaintance`. Every duration run reported `0 of 4 ties
  expecting a return`, so the whole pass was correct and inert. It was written down rather
  than tuned around: lowering the waiting bar until the number moved would have made a
  shortage of relationships look like a working mechanic. The bar was not lowered; the
  supply was built, and it is the next section. The same world now holds about **4 live
  ties per head**, flat across five centuries, and the most-connected person has **nine**
  people expecting them back. `scripts/audit-absence.ts` reports the seeded case at 120
  and 500 years alongside the controlled cast, and the controlled table is still the one
  that measures the mechanism rather than the supply.

---

## The ties an ordinary life produces

`the-ties-an-ordinary-life-produces.ts`. The supply side of the section above, and the
answer to the finding in it. The rule the whole file holds:

> **Nothing here is authored between two named people.** Every tie is a by-product of
> something the world was already doing and already had state for.

| Source | What it was already doing | The tie it never wrote |
|---|---|---|
| Births | `applyDemography` picks a living parent and writes a lineage edge | `parent` / `child` / `kin`, and the second parent when there is a household |
| Households | Two unattached adults standing in the same place | `spouse` - the only tie above `DEFINING_STANDING`, and the only one an absence can replace |
| Teaching | `manuals.ts` carries somebody over a gap in a shelf via "somebody in the house who holds it" | `master` / `disciple` - the same person, named |
| Service | People at the same rank in the same house, year after year | `acquaintance` deepening slowly to `ally`, capped below the line at which anybody waits a lifetime |
| Promotion | `assessPromotions` returns everybody it could not raise, and why | `rival` on the person who took the seat, for `outranked` only |

Births write theirs inside `applyDemography`, which has the parent in hand. The other four
run once a year off `applyOrdinaryLifeTies`.

---

## A child their own house will not keep

`a-child-their-own-house-will-not-keep.ts`. Fostering, and the first consumer of every one
of those ties that is not a household: **who somebody knows is what decides where their
child ends up.**

It is not a faction mechanic and the module names no faction. Two reasons put a child
somewhere other than their parent's house, and they are opposites:

| Reason | Where it comes from | Concealed? |
|---|---|---|
| `the bar` | the parent's own house does not lower its admission ordinal for anybody, including its own | no - the placement is open, the NAME is not |
| `no door` | nobody joins the parent's house at all; arrival is by appointment to a posting | no |
| `the birth` | the household will not own it | yes, and the shame and the concealment are one record |

The first two are read off `howAChildAtZeroGetsIn`, which derives from `SECT_ADMISSION` and
the favour catalog - so a change to a house's stance moves this with it and there is no list
of factions anywhere in the file. The third is a rate on a circumstance
(`BORN_OUTSIDE_THE_HOUSEHOLD`, applied only where the parent already has a spouse) and
produces a `shame.ts` record.

Four rules the file holds:

1. **The destination comes off the person, never off a list.** `HOLLOW_COURT_FOSTERAGE`
   used to carry four sect ids. It does not any more, and nothing may put them back: a
   cultivator asks somebody *they* have a tie to, so two members of one house with different
   friends place their children in different places.
2. **The placement is `spendAWord` and is not reimplemented.** The engine half of the
   admission favour existed with no caller outside its own package; this is its caller.
3. **The favour is spent, not read.** An open obligation the fosterer holds is SETTLED by
   the placement - `resolution: 'repaid'` - so it leaves the ledger and cannot carry a second
   child. Somebody with nothing to spend gets the placement and now owes one instead.
4. **The child is not told.** The lineage edge is written and the personal `parent` tie is
   not, so an heir still inherits down a line whose name they do not hold. There is no
   `wasFostered` boolean, because a boolean throws away the asymmetry that is the whole
   content of the fact.

`applyDemography` runs it every year. Measured over six seeds at five hundred years: 229
placements, 138 of them from a birth and 91 from a bar, **229 of 229 entering a house whose
admission ordinal the child did not meet**, across fifty-odd sending houses and as many
receiving ones.

### And one thing that does not happen

A house may attach TERMS to a child it sent away - a rung, and a deadline to reach it by.
Exactly one house in the catalog does, and `applyFosterageReturns` gives that assessment once,
at the first of the two moments. It has never fired in a seeded world. Measured: the terms
were reached once in twelve seeds of five hundred years, and that child died at 100 at
ordinal 12; once more in three seeds of two thousand, dead at 200 at ordinal 13.
`lifespanForOrdinal` is 100 below ordinal 13 and 200 below 16, against a deadline of 250 - so
**nobody who has not already climbed well past the bar lives to be assessed at all.** That is
the gate's own stated intent arriving as a measurement rather than a claim, and it is written
here rather than tuned away. The pass is driven directly by
`tests/engine/world/a-child-their-own-house-will-not-keep.test.ts` instead of waiting for a seed
to produce the case.

### Who teaches you is what a house's name actually buys

The teacher is **the lowest-ranked person in the house who can actually carry this
student**, and that single rule - with no branch anywhere on how good the house is -
produces two completely different social textures.

A child admitted at rank 0 to an apex sect is not taught by an elder. They are taught by
that house's outer disciples, and an apex's outer disciples are formidable people because
`rankRealmBand` prices a rank against what the house can produce. The search stops one rung
up and the tie is near-peer. A farmer's child at a small sect is taught by its elders,
because a shallow shelf (`admissionOffer` forces `a_teacher` at one book) puts a high
`requiredOrdinal` on the only thing the house holds and nobody below the elders meets it.
The search climbs, and the tie is deep and vertical.

Measured at 120 years, and this table is the evidence rather than the arrangement:

```text
  house             lines   teacher rank   teacher ordinal   rank gap   teacher gone
  apex   (>= 33)       20           2.85              19.0       0.90              8
  court  (25-32)       45           2.38              14.4       0.69             13
  sect   (17-24)       69           2.06               3.9       1.07             49
  small  (< 17)        15           1.00               2.3       0.20             10
```

**A near-flat rank column beside a steep ordinal column is the finding.** The teacher is a
near-peer everywhere; what changes with the house is who that near-peer is. Instruction
from the apex's rank-2 outer disciple stands at ordinal 19; instruction from the small
sect's rank-1 elder stands at 2.3.

Two things follow, and both are consequences of that table rather than rules of their own:

- **A favour buys the teachers, not the rank.** A favour high enough to skip an admission
  bar can place somebody at the Frostmirror Court, which admits at Foundation
  Establishment and would otherwise refuse them - and they still enter at the bottom. What
  the favour buys is the ordinal column. The Azure Cloud Pavilion is the exception and
  should stay one: its bar is already 0 and it refuses nobody, so a favour is worthless
  there and a child arrives on exactly the terms a farmer's child does, with the same
  formidable teachers.
- **Each tier's floor is stocked from the tier below's ceiling.** An apex's outer
  disciples are substantially people who were the chosen at a court, taken upward -
  `gatherings.ts` already moves a competition winner into the host house at rank 0 with
  the `chosen` tag stripped, and because relationships live on the person's own record
  they arrive still holding their ties to the house they left. The claim is about
  *proportion*, not composition: most people at the bottom of an apex walked in the gate.
  **Measured, this does not currently show up in the connectedness figures** - ties per
  head at 120 years run apex 3.12, court 4.24, sect 5.02, small 4.92, so the apex is the
  *least* connected band, because its members are largely catalog figures seeded at a seat
  with no local household. Selection upward fires about five times per fifteen hundred
  world-years, which is far too rarely to shape anything. The mechanism is real and the
  effect is not yet measurable.

### Four bounds, because inflation is worse than shortage

A world where everybody has twenty friends is worse than one with six.

- A household stops at `SIBLINGS_PER_HOUSEHOLD` children, read off the parent's own
  relationship rows. Unbounded, one long-lived cultivator became the parent of forty.
- A teacher carries `STUDENTS_AT_ONCE`, counted against students still alive and still in
  the house. `members.ts` gives every teaching figure three limits and the third - what a
  straight answer costs them - is the one that binds.
- The marriage and service rolls are per-year chances, not sweeps, and service deepens an
  existing tie before opening a new one.
- **A student is paired once.** When the teacher is promoted, posted or dies, nothing
  replaces them - 49 of 69 sect-band students at 120 years have a teacher who is gone.
  Being abandoned by the person who was teaching you is an outcome, not a bug, and it is
  part of why some people end up with nobody.

At 120 years the result is 4.13 live ties per head with 19 of 498 people holding no living
tie above the friendship standing; at 500 years, 4.04 per head and 22 of 503. Flat.

### Two defects this exposed, both invisible until there was something to lose

- **`settleNpcDeath` overwrote the heir's own relationships.** `upsertRelationship`
  replaces `kind` and `standing`, and the primary heir is normally a child of the
  deceased - so the deceased's other children are the heir's siblings and the deceased's
  spouse is the heir's other parent, and every one of those rows landed on a tie the heir
  already held, converted it to `ally` and thinned it by fifteen percent. A son inherited
  his own mother as an acquaintance of his father's. It also compounded: 4,691 ties among
  498 living people, climbing every generation. An account is now inherited only where the
  heir has no view of their own, which is the honest reading - you inherit the strangers
  who now have a claim on you.
- **Founding produced only enmity, so the alliance graph decayed to nothing.** A splinter
  got two edges at `-0.5` and nothing in the yearly pass ever created a positive one, so
  the graph could only lose partners to dissolution. Over five thousand years allied pairs
  went 4, 3, 1, 1, 0, 0, 0 while houses churned healthily throughout. Gatherings found the
  same hole from the other side - 13 of 15 alliance edges had a dissolved partner, its
  circles ran 11 down to 1 - and a circle needs two houses that can stand each other, so
  the institutional shortage was producing the personal one. A schism now also writes
  `SYMPATHY_AT_A_SCHISM` between the splinter and everybody the parent has wronged
  (`rivalsOf`), deliberately just under `ALLIED_STANDING`: being glad somebody embarrassed
  your rival is the beginning of an alliance, not one.

### Cost

Ties are the classic O(people-squared) trap and nothing here compares two arbitrary
people. Each pass does bounded work per house or per drawn person off **one** walk of the
roster - the `Roster` is built once a year by `applyOrdinaryLifeTies` and threaded
through. That is not a precaution: four passes each taking their own walk of `state.npcs`
(which holds the dead and is four thousand records deep by year 500 behind five hundred
living people) turned `audit-gatherings.ts`'s cost row from a flat 0.4-0.5 seconds per
hundred simulated years into 0.5 rising to 0.7 across five centuries. A rising row is the
exact thing that column exists to catch. With the shared walk it is flat again and matches
the figure from before any of this existed.

---

## A house may fall. The ladder may not.

The two halves of that sentence are different facts and the code collapsed them into
one for a long time, which is how a genuinely broken world passed for a Late Age.

**A house declining is the setting working.** Houses lose their ground, fail to replace
an elder, are destroyed in a war. Measured on a seeded world at five hundred years, half
the thirty-two houses it starts with are gone, and that is correct.

**The world's standing distribution declining is not the same fact and was never
wanted.** Measured before the change this section documents, one seed at three thousand
years:

```text
  band     mortal   qi   found  core  nascent  deity  void  body  grand  trib
  people      120  345      13     3        1      1     0     0      0     0
```

96% of the living at or below Qi Condensation, four consecutive empty bands above the
middle, and every person in the top three bands a survivor of the seeding rather than
somebody who climbed. That is unreplaced attrition wearing a Late Age's clothes.

### The mechanism: literacy was seeded once and never manufactured again

`manualsOf` reads `teaches` off the content catalog, keyed by the id of a house somebody
wrote by hand. Every house the world **founds for itself** - `faction_founded`, which is
the ordinary way institutions replace each other - has no catalog entry, so it read back
an empty shelf and could teach nobody anything for as long as it stood. Institutional
churn was therefore a one-way ratchet on the world's knowledge, and the three columns
move together:

```text
  years   houses standing   holding a shelf   books held by the living
      0                32                30                         68
    500                40                11                         46
   1500                31                 7                         29
   3000                47                 5                          6
```

With no reachable ceiling the flow up the ladder stops, and a distribution with no inflow
can only erode toward the rung people enter at.

**`shelfOf(state, factionId)` is the fix, and it is this file's own rule applied.** The
header of `manuals.ts` already says a manual is an object with a holder and a count, and
`seedSectLibraries` already puts every catalog house's working library into
`state.objects`; nothing read them back. A house's shelf is now the catalog's statement
**union what the house is actually holding**, and `librariesCarriedOutBy` writes the
library a founded house starts with - the copies its founders walked out with, read off
`techniqueIds` the world was already storing. There is no branch anywhere on whether a
house is a catalog house or a founded one, and at seeding the two sources are identical,
so every seeded world reads exactly as it did before.

### The second half: a schedule is not a sample

`applyAdvancement` drew `living / 40` people at random each year. Over a hundred-year Qi
Condensation lifespan that leaves a seventh of everybody never looked at, and it bites
hardest at ordinal 12 to 13, where lifespan goes from a hundred years to two hundred:
somebody whose walk would carry them across at ninety and who is not drawn in their last
decade dies at a hundred having been able to cross the whole time. Measured at three
thousand years, **356 of 492 living people were standing below the ordinal the rules
already granted them** at their own age, ceiling and rank. The distribution was being
produced by a coin rather than by the ladder.

It is now a rotation: the roster is sliced by a stable hash of the id and one slice is
walked per year, so every living person is reviewed once every `ADVANCEMENT_REVIEW_YEARS`
whatever else happens. Nothing about it is stochastic, so nothing about it draws on the
world seed.

The two together, same seed, three thousand years:

```text
  band     mortal   qi   found  core  nascent  deity  void  body  grand  trib
  before      120  345      13     3        1      1     0     0      0     0
  after        23  340      79    33       23      4     1     1      0     2
```

and at five hundred years across six seeds every band from Foundation Establishment to
Void Refinement is occupied, 69-80% of the world stands at or below Qi Condensation, and
81-143 of the people above it were born after the seeding. `tests/engine/world/
demography.test.ts` pins both halves; `scripts/probe-who-refills-each-band.ts` is the
measurement, and it splits every band into survivors and arrivals because a band held
entirely by survivors is a band that is dying however healthy its headcount reads.

**What was deliberately not changed.** The life-walk itself is not the wall and was left
alone: run with no ceiling at all it reaches ordinal 45 given the years, and the ceiling
is what people were short of. The apex is still not a procedural product - `seedNamedFigures`
and `seedFactionApex` instantiate it, for the reason stated in `seeding.ts` - and nothing
here makes advancement easier at any rung.

## The world produces its upper ladder rather than inheriting it

The section above ends with "the apex is still not a procedural product", and that
sentence stopped being acceptable the moment somebody asked where the giants come from
after the seeded ones are gone. This section is the answer, and it is three changes.

### 1. The world never rolled a breakthrough

`applyAdvancement` advanced NPCs with `deriveOrdinal`, and its own comment said what that
is: *not a behaviour model - the same closed-form derivation seeding uses*. A derivation
answers "given this talent and this age, where would somebody plausibly be", and used as
a progression rule it has three properties that between them decided the shape of the
whole world. **It only rises**, so nobody had ever got worse at cultivating. **It never
hurts**, so no failure, no wound and no death at a wall - the entire tribulation-and-wounds
layer was unreachable from the world. And **it saturates**, because it walks one life
against one lifespan and stops where that life stops, however many centuries the person
then lives. An ordinal 33 with five thousand years of span whose walk finished at age
three hundred had forty-seven centuries the derivation never priced.

`attemptBreakthrough` was called only by measurement code. Now, when the derivation has
nothing further to give and the person is still below what their book and their province
permit, the world strikes at the wall for real - same odds, same failure table, same
boundary trial, same wounds, same death. See `an-npc-striking-at-the-next-wall.ts`.

**A rung has two clocks and they are not the same clock.** `lastAdvancedOnDay` is the
settling clock: how long somebody has been stuck here at all, and a plateau longer than
the realm allows ends the climb permanently. `accumulatingSinceDay` is how much of the
next rung's requirement they are holding. A failed crossing burns progress, so it moves
the second and leaves the first alone. Without the distinction a failure at a high rung
costs nothing but a review cycle and somebody who reached the wall once strikes at it
every twelve years until it opens, which turns a thousand-year crossing into a formality.

**The last crossing is not this pass's.** `applyLastCrossing` owns ordinal 44 and runs it
on the clock the crossing actually takes. Left unguarded the strike pass reached it every
eight hundred years or so, forty times too often, and it emptied the apex: measured over
five thousand years without the guard, both seeded Tribulation Transcendence figures were
gone and the world's ceiling stood at 38.

### 2. Nobody stands above their own book, including the apex

`manualCeilingOf` is a hard stop for every cultivator in the world and the people the
catalogs place at the top were exempt from it, because a house's shelf is not what its
patriarch cultivates. Measured at seeding, the mean book held by the world's Tribulation
Transcendence figures capped at **ordinal 11.5**. Two people at 44 practising a canon that
runs out at 11 is not somebody anybody can believe in, and it is the whole reason the apex
could teach nothing: nothing it held reached itself.

`roadThatCarriedThemHere` reconstructs the missing fact rather than granting a favour -
the lowest-capping manual in the ordinary catalog that reaches where they already stand,
by the same four filters `roadTheyFound` uses.

### 3. A master writes it out for the people behind them

The designer's mechanism, and it was half-built: `canReproduce` has always said who may
write a book out, and nothing called it. So a library could only shrink - `faction_fell`
takes shelves out of circulation, `technique_lost` takes the last living holder of an art
out of the world, and no pass put one back. `applyManualCopying` is the pass.

It is the apex mechanism and not a flavour pass. The catalog holds one cultivation manual
carrying to ordinal 41 and three carrying to 45, and the deepest shelf in the world stops
at 37 - so before this the only route from Grand Ascension to Tribulation Transcendence
anywhere in the simulation was `applyFoundRoads`, a one-in-nine-hundred yearly roll halved
for every realm above Foundation. Luck alone, with nobody teaching anybody anything, which
is exactly the case the designer says should be almost impossible. The other half of that
sentence had no implementation, because there was nothing for anybody to be shown.

### Transmission is the axis, and all three of its terms were already in the engine

| Term | Where it lives | What it decides |
|---|---|---|
| the book | `reachableCeilingFor` | a hard stop. Reaching 41 needs a book that carries there, and those sit on four shelves in the world |
| the master | `guidanceMultiplier`, read off the `master` tie `applyTeachingLines` writes | up to half again on the rate, and only from somebody standing above you |
| the clock | `yearsNeeded` against `stagnationYearsForOrdinal` | whether the rung fits inside the realm's allowance at all |

Half again on the rate is the difference between arriving at the wall and settling one
rung short of it, which is why a master decides outcomes here rather than merely speeding
things up.

### The measurement

One seed, before and after, same machine, `scripts/probe-does-the-world-produce-its-apex.ts`.
The parenthesised figure is how many of that count were not present at world creation.

**Read that column with care - it is not a turnover measure**, and reporting it as one was
a mistake this section made and the bucket model below corrects. After ten thousand years
essentially the whole living population postdates the seeding whatever the ladder is
doing, so the figure says "the seeded cohort has died", which it always will. What it is
good for is the ORIGINAL question - a band standing at 12 people none of whom postdate the
seeding is a band with no inflow at all - and it is useless for asking whether the inflow
is now too fast. For that, see *Every realm is a bucket*.

```text
                 above 29        above 33       above 37   at 41+   wounded  halted
  before  5,000y  12 (10)         8 (6)          3 (2)      1 (0)    0        0
          10,000y 14 (12)         7 (5)          3 (2)      1 (0)    0        0
  after   5,000y  20 (19)        10 (9)          1 (0)      1 (0)   59      1-4
          10,000y 28 (27)        15 (14)         3 (2)      1 (0)   48      1-4
```

The upper middle of the ladder roughly doubles, which is the half of this that was wanted:
the bands above Deity Transformation had an inflow of nearly zero and now have one. The
apex itself barely moves here - 1 to 2 people at 41+ - and the count that shows it moving
at all is further down, because a band read as 41-44 misses somebody who crossed the Lid
by succeeding.

**The wounds are the point, not a side effect.** A real wall produces real failures, and
the wounds layer is what a failure leaves, so the world getting more broken is wanted.
Broken statuses now appear on NPCs - `crippled-nascent-soul`, `partial-refinement`,
`cracked-core` have all been observed on living people - and one to four cultivators at
any time are carrying `incomplete-cultivation`, which is the row this figure was measured
against under its former key. That is the population the setting most wanted and
could not produce.

They are not frozen. `canAttemptBreakthrough` applies the structural gate **only at a
realm boundary**, so a halted cultivator keeps climbing sub-ranks inside the realm they
are standing in and roughly doubles in strength across it. What they cannot do is leave
it. A long life at a rung, getting steadily stronger and going nowhere, is a different and
better thing than a corpse on the settling clock.

**Two reconciliations with the crossing taxonomy, both deliberate.** The five outcomes the
design states are written down as `CROSSING_RESULTS` with `classifyCrossingResult`; the
world layer does not read the taxonomy because it does not narrate, it applies deltas, and
`success` / `death` mean the same thing under both namings while `arrivedBroken` and
`crossing.halted` are read separately.

And `FAILURE_PROGRESS_LOSS` was left alone. The design says a failure loses the qi
outright; the engine takes 25/50/75% by severity. Flipping it to a total loss was measured
rather than argued about, over 3,000 lives per band on three seeds:

```text
                   Foundation   Core    Nascent  Deity   Void      Grand
  25/50/75%  dense    44-46%     18.0%    7.3%    2.4-2.8% 0.5-0.8%  0.03-0.07%
  total      dense    38-39%     14.3%    5.7%    1.8-2.3% 0.5-0.6%  0.03-0.07%
  25/50/75%  normal   14.4%       3.7%    0.9%    0.27%
  total      normal   10.5%       2.7%    0.6%    0.18%
```

It costs the BOTTOM of the ladder a quarter of its throughput and does not move the top at
all - the origin sweep's share reaching ordinal 41 went 0.462% to 0.457%. The reason is
structural: at a high rung the limit is the settling allowance's total span rather than
the number of attempts that fit in it. So it is not a lever for making the apex harder,
which is what it would have been reached for. It is a global balance change to every
ordinary cultivator's life including the player's, and it belongs to the design owner.

**Cost.** 0.97 seconds per simulated century at 500 years and 4.6 at 5,000, against 0.61
and 3.95 before. The growth with horizon is the world's own accumulated history and object
table rather than this pass, and it is present in both columns.

### The dao gate would freeze this world, and that is measured rather than feared

`canAttemptBreakthrough` reads `roadsWalked(cultivator.insights)`, and an NPC record has no
insight list - so a subject built without one answers ZERO roads walked at every rung
forever. While `DAO_GATE_FROM_ORDINAL` sits above the ladder that costs nothing. The
moment it comes down onto Nascent Soul it stops every NPC in the world crossing while
leaving the player untouched, which is the world-binds-NPCs-and-not-the-player split this
repo keeps finding, running the other way.

`roadsWalkedBy` closes the categorical half of it without inventing state: **the roads you
have walked are the roads in your hands.** Every technique in the catalog already declares
a `domain` drawn from the same enum an insight uses, and `techniqueIds` is what an NPC has
spent a life practising. Degree is the shallowest, because `roadsWalked` does not read
degree and claiming depth the world never modelled would hand every NPC an odds bonus no
event in their life paid for.

**It is not enough, and the numbers say by how much.** One seed at 1,500 years, roads
actually held against what the curve asks at the wall out of each band:

```text
  band            people   mean roads   needed at the wall   would pass
  Core 17-20          28         1.18            1             28 / 28
  Nascent 21-24       20         1.30            2              5 / 20
  Deity 25-28          7         1.86            3              0 / 7
  Void 29-32           2         2.50            4              0 / 2
  Body 33-36           3         2.00            5              0 / 3
  Grand 37-40          1         3.00            6              0 / 1
```

An NPC holds one road and a couple of arts, so two or three domains is the ceiling of what
practice alone supplies, and the curve wanted six by Grand Ascension. Switched on as it
stood, nothing in the world would ever have crossed ordinal 28 again.

### The other half is ground, and the gate is now live

`how-a-cultivator-comes-by-a-road.ts` is the supply. The missing half was that a player
accumulates comprehension from EVENTS - a ruin, a phenomenon, a teacher who did not have
to, nearly not being - and the world ran all four and wrote none of them down.

**It is derived, not stored, and that is the design rather than a shortcut.** The gate's
own doctrine is *access, not effort*: the requirement names what must be IN REACH, never
what must be done. So `roadsInReachOf(state, npc)` is a pure read of world state, no field
added to `NpcRecord` and no migration - and it has a property storing could not express,
which is that the answer moves when the world moves. A disciple promoted to Inner gains a
road the day the promotion lands; a house that loses its ground loses the road for
everybody in it at once, and the people who already crossed on it keep their rungs, because
a rung is banked and a road is not.

Four channels, and every one of them costs something:

| Channel | What it is | What refuses you |
|---|---|---|
| Practice | `roadsWalkedBy` - the domains of the arts in your hands | Nothing; but it cannot reach past three, and `alchemy` is taught by no technique in the catalog |
| Held ground | Nine named places a house controls | Membership, then STANDING. This is what forty years of sweeping buys |
| Open ground | Seven standing open in a province | Geography. You are born where you are born, and no province has all eight roads |
| Buried ground | Four inside ruins | Nobody has dug it out yet. `BURIED_GROUND_FOUND_PER_YEAR` is 0.0015, so a world at year 300 is genuinely poorer than the same world at 1500 |
| A material | Single-use, spent once on one person and gone | There are 39 in the world and no house makes more |

**One rule answers for the world and for the player, and it used to be two.**
`howSomebodyStandsToAGround(ground, who)` is the whole of who a ground teaches. It takes
four scalars and never an `NpcRecord`, because the player is not one, and
`daoGroundsInReachOf` is now a filter over it rather than a rule of its own. The second
copy lived in `server/consolidated/cultivation-support.ts`: it wrote the floor, the
membership check and the standing check out again against the CATALOG while this file ran
the same three against the LOCATION table, and it calls the same function now.

What the rule returns is three things rather than one, because knowing where a thing is and
being able to read it are different facts. `knowsWhereItIs` is what makes somebody able to
TELL you - the cart drivers of the Quiet Marches have crossed the Grinding Ford for six
hundred years and the row says nobody there thinks of it as cultivation - and `shortBy` is
the first thing a visitor is missing, in the order they meet them: found, then in the
province or of the house, then let in, then able to read it. That ordering is what makes it
a refusal somebody can act on rather than a boolean, and
[`../../web/ground-that-teaches-a-road.ts`](../../web/ground-that-teaches-a-road.ts) turns
each reason into a sentence naming what would change it. Measured before it existed:
`daoGroundsInReachOf` had **no caller anywhere in `src/web` or `src/server`**, so every one
of these places bound the simulation and nobody holding the controller.

The material channel is the one exception to "in reach", and it has to be: the object is
consumed, so the road has to survive it. It does, because `spend` marks the row rather than
deleting it, and this module reads the road back off the spent row. **The record of who
used one is the comprehension.** `spendMaterialsOnTheBlocked` is the pass that spends them,
at most one per house per year, on the most senior member who is actually stopped at a wall
for want of a road the house is holding.

The catalog is `data/cultivation/places-that-teach-a-dao.ts`. Every row seeds as an
ordinary `LocationRecord` - `cave` when held, `wilds` when open, `secret_realm` when buried,
so `gatherings.ts` already sends expeditions to the buried ones. Not `sect_seat`, which
carries the one-seat-per-faction invariant, and not `ruin`, which must point at a seeded
prior age. **A ground is in a province: no province, no ground.** Seeding a place whose
region the catalog does not have planted twenty orphans in the test fixture world and moved
events that had nothing to do with comprehension.

**Measured with it live**, `scripts/probe-can-the-world-feed-the-dao-gate.ts`, four seeds
at 800 years:

```text
  band            people   mean roads   needed   would pass   arrivals
  Core 17-20          87      1.71          1     87 / 87       100%
  Nascent 21-24       66      2.67          2     47 / 66       100%
  Deity 25-28         36      3.36          3     22 / 36        81%
  Void 29-32          26      4.12          4     15 / 26        46%
  Body 33-36          21      3.81          5      9 / 21         0%
  Grand 37-40          5      4.20          5      2 / 5          0%
  Trib 41-44           6      4.17          5      2 / 6          0%
```

Two things in that table are load-bearing and neither is the headcount.

**The curve's cap came down from 8 to 5, and it is a measurement.** Nobody in any band on
any seed holds seven roads. Six is held by an eighth to two fifths of the people who get
that high. So the old top of the curve - 6 into Tribulation Transcendence and 7 at the last
crossing - was not a hard gate, it was a rung nobody could ever attempt again. The number of
domains the schema DEFINES is a fact about the schema; only what the world can put in
somebody's reach may bound a requirement. See `MOST_ROADS_THE_WORLD_SUPPLIES`.

**And run the gate-off arm before concluding anything about the apex.** The same probe with
`DAO_GATE_ENFORCED` false, three seeds at 800 years, gives bands of 62 / 43 / 21 / 20 / 20 /
2 / 5 against 58 / 44 / 18 / 18 / 20 / 3 / 5 with it on. The distributions are the same to
inside the noise INCLUDING at the top, and arrival shares move by single points. The gate is
not what limits this world's apex and never was - the settling clock, the manual ceiling and
the span are. It is one edit and one command to check, and it is the only way to tell a gate
that bites from a world that was already that shape.

### Every realm is a bucket

The model the ladder is tuned to, in the designer's words: *"think of it as a bucket with
an input and an output. the bucket always has some volume to it but its shifting"*, and
the scope in theirs as well - *"each cultivation stage"*. Nine buckets, and they are
**chained**: the outflow of one is the inflow of the next, minus whatever dies or settles
on the way. Nothing here can be tuned in isolation.

**The arrivals share is a diagnostic, not a target.** An earlier pass in this section
reported "90-95% of the people above Void Refinement arrived rather than being seeded" as
good news. It was not even a turnover measure - it counts everybody not present at world
creation, and after ten thousand years that is essentially the whole living population
whatever the ladder is doing. The same figure read 82-94% *before* the change it was
offered as evidence for. The designer's correction was blunt and correct: arrivals should
be hard, cultivation should not be easy, and a bucket whose entire contents turn over
inside the measurement window is being flushed rather than filled.

`scripts/probe-the-bucket-at-each-realm.ts` measures the three numbers the share falls out
of, by tracking band membership by id across century snapshots. Note it counts the LIVING:
nothing in the engine resolves `missing`, so an extant count accumulates every person who
ever walked off, and measured that way Foundation Establishment "grew" by 206 over forty
centuries in a world whose headcount never moved.

**The finding, and it was the outflow.** Two seeds, forty centuries after a five-century
warm-up. `stay` is volume over outflow, and the column that matters is what fraction of
the realm's own granted span that is:

```text
  realm                    volume   inflow  climbed   ended    stay   of span
  Qi Condensation           378.6   378.63    32.86  345.81     1.0     100%
  Foundation Establishment   55.2    49.66    11.88   37.84     1.1      55%
  Core Formation             33.1    17.95     6.35   11.14     1.9      38%
  Nascent Soul               17.5     7.63     2.45    5.17     2.3      23%
  Deity Transformation       10.3     3.04     0.99    2.16     3.3      16%
  Void Refinement             5.3     1.15     0.40    0.65     5.0      10%
  Body Integration            6.2     0.39     0.04    0.39    14.6      15%
  Grand Ascension             1.5     0.05     0.00    0.03    61.0      20%
  Tribulation Transcendence   0.6     0.00     0.00    0.03    24.0       2%
```

Residence as a share of span falls monotonically with height. Qi Condensation lives out
100% of its hundred years; Void Refinement gets 10% of its five thousand. **A realm's
lifespan is the whole of what a high realm buys, and something was cancelling it.** The
cause column said what: at Void Refinement 44% of departures were "killed by a person" and
33% "killed when a house came" - 77% violence against 10% of age.

**The mechanism: `killing` drew the victim first, uniformly from everybody alive.**
`couldKill` kept the killer commensurate so no result was ever absurd, but the RATE was: a
Void Refinement cultivator was picked as often as a Qi Condensation one while having fifty
times the span to lose. Drawing the KILLER first inverts it with no rule about tiers and no
exception for anybody - a killing needs somebody who can do it, most people are at the
bottom, so most killings happen there, and somebody at Grand Ascension has perhaps one
person in the world who could reach them. `couldKill` is still the gate, so the guarantee
`demography.test.ts` pins is untouched.

```text
  realm                     stay % of span      "killed by a person"
                            before   after      before   after
  Qi Condensation             100%    100%          2%      3%
  Foundation Establishment     55%     56%          5%      4%
  Core Formation               38%     39%          -        -
  Nascent Soul                 23%     26%         13%      -
  Deity Transformation         16%     20%         23%      -
  Void Refinement              10%     15%         44%      8%
  Body Integration             15%     14%         32%      -
  Tribulation Transcendence     2%      9%         50%      0%
```

The bottom two bands do not move, which is the check that this is a statement about how
many people can reach whom rather than a protection granted to rank. Void Refinement's
volume goes 5.3 to 7.8 and its inflow falls from 22% of the band per century to 13%, with
residence rising from 5.0 to 7.7 centuries - a slow-in, slow-out bucket holding a steady
volume, which is the shape the model asks for. Tribulation Transcendence departures are
now 100% the tribulation, which is one of the four ends the design permits.

**Settling and structural breaks are outflows that do not remove anybody.** A settled or
broken cultivator stays in the band forever and stops feeding the one above, so they pad
the volume while the upward outflow goes to zero. That is meant to happen and it is why
the probe reports `climbed` and `ended` separately, and counts `stuck` beside them: a band
whose volume is mostly stuck reads healthy and is feeding nothing.

### Two things this does not fix, written down so they are not mistaken for design

**The world produces a Tribulation Transcender about once in several thousand years, and
counting the band at 41-44 hides it.** Two things had to be measured properly before that
sentence could be written, and both had been getting the answer wrong.

The first is that crossing the Lid REMOVES somebody from the band by succeeding. A count
that stops at ordinal 44 reads a graduation as a failure to produce. Measured over four
seeds at 5,000 years, counting 41-44, 45 and 46 separately:

```text
  seed   standing 41-44   at 45   at 46   ever at 41+   of whom arrived
   a          2 (1 new)      0       0         3               1
   b          1 (0)          0       0         2               0
   c          0              1       0         2               0
   d          1 (1 new)      1       0         3               1
```

So two of four seeds produced somebody at the apex who was not placed there, and two hold
a False Immortal at ordinal 45 that a 41-44 count reports as an empty band. That is
roughly one arrival per world per five thousand years, which is the "one in a generation
unaided" rarity the design asks for, on the harsh side of it.

The gate is `heaven-conversing-primordial-canon`, the only manual in the catalog carrying
from ordinal 37 to 41, which sits on no house's `teaches` list. A house acquires it only
when somebody already at 38 or above writes it out, so the road to the top exists in the
world exactly as long as somebody who walked it is alive to reproduce it. That is a
legible, self-limiting reason for the Late Age rather than a defect - but it does mean the
apex is one death away from closing, and it is worth a designer's eye.

**What ends somebody at the top, and whether the world can name it.** The design's rule is
that nothing ORDINARY may kill a Tribulation Transcender - a sect war, a conspiracy, a
chosen sacrifice or the tribulation itself, and not attrition. Measured across four seeds
at 5,000 years, every apex death the world produced was one of two things: killed by a
named person (the killing template already refuses a killer more than
`CASUAL_KILL_MAX_GAP` rungs below, so the killer is a peer rather than a pool), or a
tribulation they called down and could not hold - ordinals 40 to 44 summon lightning at
every step, so a death at a wall there IS the tribulation. The world can also express
institutional violence and does: `Killed when the Azure Mist Court came` accounts for a
tenth of deaths at 29 and above. What it cannot currently express is a conspiracy or a
chosen sacrifice, and that is an absence rather than a gap to fill quietly.

Below the apex the picture is different and worth a look. Across 69 deaths at 29+ on one
seed over 5,000 years: 12 of age, 25 killed by a named peer, 9 in a house coming for
another house, 5 of an old wound, 4 of a breakthrough that did not hold, 3 at a wall. That
is not a pool - every one of those has a name or a cause - but the share dying of age at a
rung whose span is thousands of years is worth someone checking.

**Nothing in the engine reproduces a house's ARTS.** Splitting the "distinct books held by
the living" measure into roads and arts corrects an earlier finding: the collapse from 68
to 13 is almost entirely arts. Cultivation roads hold at 13-17 across five thousand years
both before and after this change. House arts go 58 to zero by year 5,000 in both columns,
because `newlyEntitled` hands out roads only and `artsOf` reads a static catalog list keyed
on a house somebody wrote by hand - so a founded house has none and never will, and a
catalog house's arts die with the last person who was granted them. Copying does not reach
them: `canReproduce` defines mastery as standing at the manual's `cap` and an art has none.

## Reading order

```text
layers.ts        two layers, ordered; what crosses the Lid in either direction
history.ts       ground truth and what survives of it; near-misses; unresolved
locations.ts     origin -> changes -> current state, separately queryable
capability.ts    the five predicates, answered together, with reasons
opportunities.ts dated windows that open and close whether or not anyone is watching
possessions.ts   possession / ownership / claim / knowledge, plus provenance
lineage.ts       the parent-descendant edge and what travels down it
reading-a-lineage-off-a-name.ts
                 what a surname is worth against a house's roll. Corroboration
                 at best; only a reserved name settles anything, and an absent
                 one is a question rather than a verdict
recognising-whose-art-you-just-watched.ts
                 the trust hierarchy's strongest check, gated on BOTH axes -
                 realm for whether the demonstration can be perceived at all,
                 KnowingStage for whether the reader has a reference for it.
                 Answers where an art was LEARNED and never whom anybody serves
npc-state.ts     NPCs as small durable records; goals outlive their holder
a-catalog-person-and-their-world-row.ts
                 the one id a catalog person is known by. `seedNamedFigures`
                 mints their world row as `npc-` plus their catalog id, and
                 the knowledge layer was keying the same human being under
                 both; this owns the mapping in both directions so the two
                 cannot drift. The reverse is a catalog LOOKUP and never a
                 prefix strip - `npc-95` is a procedural NPC
memory.ts        durable memories, search, and the LLM-driven compression write path
world-state.ts   the authoritative store; plain serialisable data, pure mutations
time.ts          advanceTime: what fell due, what was running, what was missed
manuals.ts       who holds a book, what shelf a house actually has, and who it
                 has decided is worth the top of it
gatherings.ts    the chosen of allied houses meet; meetings, bouts, rankings, sites
what-people-are-saying.ts
                 the ledger in the mouths of people who were not there: one fact
                 rendered from fields that may have been swapped on the way, by a
                 named teller who always tells it the same way
the-ties-an-ordinary-life-produces.ts
                 households, teaching lines, shared service and being passed
                 over - the supply of people who would notice you were gone
a-child-their-own-house-will-not-keep.ts
                 fostering: whose house will not keep their child, who they ask
                 instead, and the favour that is spent to skip a gate
when-somebody-does-not-come-back.ts
                 an absence as a dated object; who stops waiting, who writes you
                 off, and the incompatible accounts that survive it
immortal-world.ts the far side: arrival, standing, perils, and its own clock
what-a-sea-crossing-costs.ts
                 a crossing is not a road with a different number on it: a
                 commit point, a season that closes it, a duration that is a
                 distribution, water as the binding constraint, and a chest
                 that is the only ground there is
```

### A sea crossing is a different kind of link, and the engine still cannot read it

`what-a-sea-crossing-costs.ts` is one half of a gap `regions.ts` recorded and this
directory owns the other half of. `LinkKind` here is `road|path|tunnel|gate|portal|seam`
and `seeding.ts` links **every** region connection as `'road'`, so in a seeded world an
eleven-day cart road and a thirty-four-day open-water passage are the same object with
different numbers on them.

The five differences that make a crossing its own kind are now mechanisms rather than
atmosphere - a commit point past which turning back is not shorter, a season that shuts
the route without anybody deciding to, a duration that is sampled rather than fixed,
water counted by the cup rather than food, and a stone burn that is the whole of
cultivation because there is no vein under open water. None of them is reached by
ordinary travel today.

What it would take is two lines in files that conflict badly when shared: one `crossing`
member on `LinkKind`, and one ternary at the `linkLocations` call in `seeding.ts` that
picks it for a connection whose kind is `sea_crossing`. `crossing` would be the only link
whose `open` flag is set by the world rather than by a holder or a key, which is what
`OpeningCycle` already exists to express, and `laneIsOpenInMonth` is now the function that
would answer it. `SEA_CROSSING_ENGINE_GAP` in that module is the machine-readable record.

## Related

- [`../README.md`](../README.md) - implementation philosophy and the five pillars
- [`../cultivation/README.md`](../cultivation/README.md) - realm classes, time-skip, scars
- [`../social/README.md`](../social/README.md) - belief, grudges, secrets
- [`../../storage/README.md`](../../storage/README.md) - how these tables are migrated
- [`../../../docs/world/`](../../../docs/world/) - the setting these mechanics express

---

## Ruins, convergence, and chains of forced choices

Four modules landed together and are one subject observed at different moments. The
authoring guide is [`../../../docs/world/places/ruins.md`](../../../docs/world/places/ruins.md); this is
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

**`how-far-somebody-can-fold-space-and-what-it-costs.ts` - the same grant, doing the thing
it is actually for.** Range in walking days, growing with the rung: one province over at
Void Refinement, the whole map by ordinal 38, and nothing at all below the floor. **The
scarce thing is not power, it is knowing where the far end is** - a fold needs a fix, and
there are exactly two, ground somebody has stood on and something they have seen. There is
no third for being told or being sold one, because a bought fix is the Wide Age
true-distance table and the House of the Measured Span has spent five thousand years
failing to reproduce it. `convergence.ts` is the one place the reach does not grow with the
rung, and `PIERCE_REACH_DAYS` carries the reason.

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


## A house's road decides which roots can be in it, and how high

Two seeded facts used to be rolled independently of the seat they were being placed
into. Both are now conditioned at placement, and both keep the underlying table exactly
as it was for everybody being BORN.

- **Origin** - `where-the-seeded-population-was-born.ts`. Measured before: 89.4% of the
  seniors of apex bodies born `thin_county`, and nobody at all in a living population of
  2,538 born into a high tier.
- **Spirit root** - `what-root-a-seeded-house-member-has.ts`. Measured before: root fit
  with the house's own road was 58-65% at EVERY rung, flat, and 53.3% at ordinal 37 and
  above - the worst band in the world. A house's own Sword Elder could not practise its
  own sword road about half the time, on every seed.

The rule needs writing nowhere in the lore: **people self-select, and houses select.**
Nobody spends a life on a road their root refuses, and no house raises somebody to Sword
Elder who cannot practise the sword. The mismatch is not forbidden, it is what does not
survive to the top.

Four regimes, all derived from the catalog at run time so a sect added later lands in the
right one with nobody editing a list:

| Regime | From | What happens above rung 0 |
|---|---|---|
| `single_road` | one distinct element across the whole shelf | a refused root is not there - the house can teach nothing else |
| `stated_roots` | `SECT_ADMISSION.preferredRoots` | strong but SOFT. `preferredRoots` is who a house recruits, not a bar |
| `several_roads` | more than one element | soft, and capped by the secondary road's own ceiling |
| `no_road` | nothing elemental | the lottery, untouched |

Alignment is an **input**, never a rule written per house: a demonic shelf is a trophy
cabinet rather than a lineage, so it never hard-filters and its seniors may each have come
up a different road. It is also where the roots a single-road house would only take as
servants actually get seated, which gives the mismatch an outflow instead of a dead end.

**Rung 0 is never conditioned, in any regime.** Two facts turn out to be one rule: an
outer disciple among hundreds may be anything because nothing has filtered them yet, and
more than half the ladders in the catalog open with a rung that is not a cultivating rung
at all - `Sword Servant`, `Dew Servant`, `Herb Boy`. That rung now has a population and a
reason, and `assignFactionRoles` keeps refused roots on it rather than promoting them.

`CatalogFaction.teachesRoads` carries each road's ceiling beside its element, because a
house is a shelf rather than an art: somebody who can only walk a secondary road has a
real career with a real end to it, and it is their root that put it there.

The decay is **derived, not calibrated** - `1 - CONFLICTING_TECHNIQUE_RISK` from
`deviation.ts`, read as one road-ending event per rung at the conflict's own price. The
gradient falls out and nobody wrote it: 1.0 at rung 0, 0.19 at 13, 0.006 at 40.

`scripts/probe-can-a-houses-people-read-its-own-books.ts` reports all of it, including the
reverse failure - whether the world's ROOT histogram has tilted toward whatever the big
houses teach. It has not: the derived population sits within half a point of the table.

One thing the engine does not answer yet. `OVERCOMES` maps lightning and ice to null, so
`conflictsWithRoot` refuses them to NOBODY and an ice or lightning road reads as open to
the whole world. The narrowness of the Frostmirror Court and the Storm Tyrant Court is
therefore not in the conflict rule at all - it is in `preferredRoots`, which is exactly
why `stated_roots` is a regime and why reading only the element would have missed the two
narrowest houses in the world.

### The root figures above, re-taken and partly retracted

The before-and-after quoted for the root fix, and in the commit message of `5ccbaab`,
was **never a clean back-to-back**. The "before" arm was measured while nine elemental
roads were sitting uncommitted in the tree; `47094b8` then landed them, and only the
"after" arm was re-taken against the new catalog. So the two halves of that table were
read off two different worlds.

Found because a peer chased the same hazard from the other end and said to check. Re-taken
properly - `seeding.ts` reverted to `5ccbaab^` and restored in ONE command, both arms on
the current catalog. `catalog.ts` was deliberately left in place across both arms: the
`teachesRoads` addition is additive and the old seeder contains zero references to it, so
reverting the seeder alone isolates the behavioural change.

| measure | before (clean) | after | as first reported |
|---|---|---|---|
| root fit, ord 0-6 | 58.9 | 71.6 | 58.0 |
| root fit, ord 7-12 | 61.0 | 75.0 | 63.1 |
| root fit, ord 13-20 | 62.7 | 75.4 | 62.7 |
| root fit, ord 21-28 | 60.0 | 67.8 | 64.3 |
| root fit, ord 29-36 | 77.1 | 82.9 | 77.1 |
| root fit, ord 37+ | 53.3 | 100.0 | 53.3 |
| top 2 rungs | 63.9 | 76.4 | 65.5 |
| holds the house's own road | 39.1% | 46.1% | not measured |
| refused, above a closed servant rung | **50** | **0** | after only |
| refused by their house's road | 481 | 159 | not measured |

The conclusion is unchanged and slightly stronger than first claimed - the real gap in the
middle bands was wider than the contaminated reading showed. The headline is identical to
the digit: an apex band that was the WORST in the world at 53.3% now reads 100%.

**And one term is doing nothing.** `reachableCeiling` - the secondary-road ceiling - moves
the population it was written for by ~1 person: "standing above every road they can walk"
reads 145 before and 143 after, and 40 in both arms inside closed houses. It is a correct
rule that is currently inert, because it only bites on `several_roads` houses and almost
every secondary road in the catalog is elementless, which suits everybody and therefore
caps nobody. It will start doing work when secondary roads become elemental with lower
caps, and until then the module header should not be read as if it were load-bearing.

**The origin figures were checked for the same defect and are clean**: 20.84% of placed
figures high-born, 0.00% of the derived population, 35.56% of apex seniors, all reproducing
to the digit on the current tree. Origin conditioning keys off realm ordinal rather than
member content, so the `members.ts` churn underneath it never moved the result.

The lesson generalises past both fixes, and it is a sharper version of the one already in
AGENTS.md. **A single measurement off a shared tree is already a measurement of somebody
else's unfinished work**, and it does not announce itself - both these readings looked
entirely reasonable. Green bars are necessary and are not the measurement: keep the rows,
and compare them.

### Which term actually moves the ladder: the fit, or the filter?

Both fixes left an explanation standing that neither of us had measured - that the upward
shift in the realm histogram comes from fitting the MAJORITY to a road they can read, while
the hard filter merely removes people whose contribution was already zero. Two people
arriving independently at the same explanation is the condition under which both stop
looking, so it was worth an arm that separates them.

Three arms, one command, identical seeds throughout so the differences are PAIRED:

| arm | top 2 rungs fit | ord 37+ fit | Qi Condensation @500y |
|---|---|---|---|
| **A** no conditioning at all | 63.9% | 53.3% | 64.06% |
| **B** soft fit conditioning only, hard filter and servant rule OFF | 72.9% | 93.3% | 62.38% |
| **C** full | 76.4% | 100.0% | 60.22% |

**On fit, the soft term does nearly all the work.** Ordinal 37 and above goes 53.3% to
93.3% with no hard filter anywhere; the filter buys the last 6.7 points to reach a clean
100%. So the headline result of the root fix does not depend on excluding anybody - the
reweighted draw alone very nearly gets there, and the filter is what makes it absolute at
the top rather than what makes it happen.

**On the ladder, the shared explanation is wrong in its specific claim.** It predicted A→B
would be the large term and B→C roughly nothing. Measured, B→C is the LARGER of the two
(-2.16 against -1.68). The filter is not histogram-neutral.

The reading that survives is a refinement rather than a replacement: both terms are the
same mechanism at different strengths. Pinning refused roots to the servant rung does not
merely park people who were going nowhere, it improves the COMPOSITION of the pool that
gets promoted, and a better-composed pool climbs better. That is still a fit effect; it is
just fit acting through who is eligible rather than through who reads what.

Caveat, stated because the numbers invite over-reading: the fit columns are 5 seeds and the
Qi column is 3. The A > B > C ORDERING is paired on identical seeds and is safe; the
magnitudes are not, and unpaired seed-to-seed spread on this measure has been seen at 5
points. Do not quote -2.16 as a constant.
