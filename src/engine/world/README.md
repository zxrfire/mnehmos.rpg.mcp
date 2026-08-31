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

## Reading order

```text
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
```

## Related

- [`../README.md`](../README.md) - implementation philosophy and the five pillars
- [`../cultivation/README.md`](../cultivation/README.md) - realm classes, time-skip, scars
- [`../social/README.md`](../social/README.md) - belief, grudges, secrets
- [`../../storage/README.md`](../../storage/README.md) - how these tables are migrated
- [`../../../docs/world/`](../../../docs/world/) - the setting these mechanics express
