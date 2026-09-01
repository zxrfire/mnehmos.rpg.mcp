<!-- tier: 3 -->

# Architecture

An authoring guide. Read before you add a compound, a room purpose, or a house style.

The failure mode this exists to prevent is not "the rooms are boring". It is the one that
was actually measured, twice:

1. **There was nowhere to stand.** A seeded world held 65 locations. Nesting bottomed out
   at depth 1 - a province, and places in it. The Azure Cloud Pavilion, the house with a
   newly ascended immortal and an entire storyline attached, was one node called *grounds*
   with two roads out of it. No scripture pavilion. No ancestral hall. No vault.
2. **Then there were thirty-two of the same building.** The first thing anyone reaches for
   after (1) is a template: gate, courtyard, hall, library, vault, done, times thirty-two.
   That is worse than one node, because it looks finished.

Everything below is aimed at (2). The machinery for (1) was already in `locations.ts` and
had been for a long time.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [The rule this file is under](#the-rule-this-file-is-under) | **Tier 3** - never injected |
| [What is generated, and from what](#what-is-generated-and-from-what) | the player is inside a sect compound, a hall, a vault, or any interior |
| &nbsp;&nbsp;[Precincts come from the house's own rank ladder](#precincts-come-from-the-houses-own-rank-ladder) | the player moves between precincts, or a compound's internal ladder is in question |
| &nbsp;&nbsp;[Rooms come from what the house does](#rooms-come-from-what-the-house-does) | the player is looking for a particular room, or asks what a house's buildings say about it |
| &nbsp;&nbsp;[The sealed ceiling is a place](#the-sealed-ceiling-is-a-place) | a house's sealed one-off power is asked after, or the player finds the vault it sleeps in |
| &nbsp;&nbsp;[Formation nodes are objects, and dark ones are doors](#formation-nodes-are-objects-and-dark-ones-are-doors) | the player is at a compound's perimeter, or looking for a way in that is not the gate |
| [House style](#house-style) | the player is looking at a building, a ruin, or trying to identify who built something |
| &nbsp;&nbsp;[Elemental architecture is a function of intake, not of occupants](#elemental-architecture-is-a-function-of-intake-not-of-occupants) | a building's element is read off it, or somebody assumes a house is built to suit its people |
| &nbsp;&nbsp;[Where the style is allowed to bend](#where-the-style-is-allowed-to-bend) | a senior figure's own residence is entered, or status is being read off a building |
| &nbsp;&nbsp;[The style is the archaeological fingerprint](#the-style-is-the-archaeological-fingerprint) | somebody tries to identify who built a ruin from what is left standing |
| [Access is a chain, not a door](#access-is-a-chain-not-a-door) | the player is trying to get into somewhere they may not be allowed |
| [Knowledge of a room is not a flag on the room](#knowledge-of-a-room-is-not-a-flag-on-the-room) | the player is somewhere they have not been before, or asking about a place |
| [What this deliberately does not model](#what-this-deliberately-does-not-model) | **Tier 3** - never injected |
| &nbsp;&nbsp;[Ruin wings are a separate model, on purpose](#ruin-wings-are-a-separate-model-on-purpose) | **Tier 3** - never injected |
| [Adding a compound](#adding-a-compound) | **Tier 3** - never injected |
| [Adding a room purpose](#adding-a-room-purpose) | **Tier 3** - never injected |
| [Adding a `LocationKind`](#adding-a-locationkind) | **Tier 3** - never injected |
| [The test](#the-test) | **Tier 3** - never injected |

---

## The rule this file is under

<!-- tier: 3 -->

> **Nothing is bespoke, and that applies to space.**

There is no per-faction table anywhere in `src/engine/world/architecture.ts`, and none may
be added. There is a test that greps the module for a quoted faction id and fails if it
finds one. Every compound comes out of one function reading columns that already exist.

A house is distinctive because **its numbers are**, in the same fields every other house's
numbers are in. If you want a house to have something nobody else has, the thing you want
is a **number in an existing column**, or - at most - a **new column that every house has
and most houses have zero in**.

---

## What is generated, and from what

<!-- tier: 2 trigger="the player is inside a sect compound, a hall, a vault, or any interior" -->

A compound is a tree of ordinary `LocationRecord`s. Nothing about an interior is a special
kind of object.

```
region                                    depth 0
└── <House> grounds            sect_seat  depth 1
    ├── the outer disciple precinct       depth 2   one per rank
    │   ├── the forecourt      hall       depth 3
    │   └── the practice yard  hall       depth 3
    ├── the core disciple precinct        depth 2
    │   ├── the scripture pavilion hall   depth 3
    │   └── the vein chamber   chamber    depth 3
    ├── the patriarch precinct            depth 2
    │   ├── the ancestral hall hall       depth 3
    │   │   └── the chamber under it vault depth 4
    │   └── the treasury       vault      depth 3
    └── the north node         chamber    depth 2   outside the walls
```

### Precincts come from the house's own rank ladder

<!-- tier: 2 trigger="the player moves between precincts, or a compound's internal ladder is in question" -->

**One precinct per entry in `CatalogFaction.ranks`.** Nobody chose four tiers or five. A
house with four ranks gets a four-precinct compound; the Azure Cloud Pavilion has six
ranks and gets six walls. The bars are interpolated from `admissionOrdinal` at the outer
wall to `powerOrdinal` at the inner one, which is the same span the sect gate was already
calibrated over.

This is the single highest-value decision in the file, because **variety becomes automatic
and is driven by data that already varies**. It is also the thing that makes status
physically manifest: an outer disciple walks a shared yard and a Patriarch has a precinct
that six people have been inside.

### Rooms come from what the house does

<!-- tier: 2 trigger="the player is looking for a particular room, or asks what a house's buildings say about it" -->

`roomsFor()` is one function, and every line in it reads a column:

| Column | What it decides |
|---|---|
| `recruits` | A house that takes no applicants has no dormitory and no refectory |
| `formationIntegrity` | Whether the books are on shelves (`scripture_pavilion`) or behind a lock nobody can open (`archive`) |
| `governance` | A house that answers to somebody has a room to be answered in |
| `tributeStonesPerYear` | Something owed needs somewhere it is counted before it leaves |
| `holdsVein` | A house on a vein has a chamber over it |
| `production` | A house that can still make things has a workshop and a treasury |
| `specialities` | A physician house gets an infirmary; an alchemical one gets a furnace floor |
| `sealedCeilingOrdinal` | A house with something asleep has somewhere to keep it |
| `powerOrdinal`, `inherited` | How big the rooms are, against how many people are in them |

Measured over the real catalog: **30 distinct compound shapes across 32 houses**, 16 to 29
rooms each, mean 24.8. Two pairs collide. That is the number to keep an eye on when you
add a house - if it lands on somebody else's shape, its columns are too close to theirs
and the fix is in the content file, not here.

### The sealed ceiling is a place

<!-- tier: 2 trigger="a house's sealed one-off power is asked after, or the player finds the vault it sleeps in" -->

`sealedCeilingOrdinal` had been on `CatalogFaction` recording the one-off power a house
holds asleep and spends once, and **that thing was asleep nowhere.** It is now a `vault`
under the ancestral hall, sealed, with all four thresholds at the sealed ancestor's own ordinal
and a `keyId` on it. Six houses in the seeded world have one; they are the only locations
at depth 4, which is the honest shape - the world goes that deep in exactly six places.

### Formation nodes are objects, and dark ones are doors

<!-- tier: 2 trigger="the player is at a compound's perimeter, or looking for a way in that is not the gate" -->

`formationNodesTotal` over `formationNodesLit` had been read only as a ratio. A node is a
thing at a point on the perimeter. A **lit** one carries the `formation` hazard. A **dark**
one is a hole in the ward, and it carries a `seam` link that lands inside a precinct
without passing the gate.

This is what turns a compound's condition from description into tactics. Nine nodes lit of
forty-one does not merely mean the house is poor; it means the house is **porous**, and
which wall the holes are in is decided by which nodes went dark, drawn once per house from
the compound stream. Measured on the Azure Cloud Pavilion: an ordinal-12 cultivator is
barred at the Sword Elder gate and, coming through the dark south-west node, stands in the
Pavilion Master's residence - `surviving`, which is to say alive and unable to do anything
there. **The hole gets you in. It does not give you standing.**

---

## House style

<!-- tier: 2 trigger="the player is looking at a building, a ruin, or trying to identify who built something" -->

**An institution has a design language. An individual expresses themselves.**

One vocabulary of materials, one idiom, applied across the whole compound. Precincts
differ in *quality and privacy*, never in *style* - that is what makes a compound read as
one place built by one body over centuries. A disciple's residence inside a sect looks
like every other residence in that sect regardless of the disciple's spirit root, because
the sect built it and built them all the same way.

A rogue cultivator carving their own cave is the other case entirely. There was nobody
else to answer to, so their root shows.

### Elemental architecture is a function of intake, not of occupants

<!-- tier: 2 trigger="a building's element is read off it, or somebody assumes a house is built to suit its people" -->

The rule, and it is derivable rather than declared:

> **A house is elemental exactly as far as the house itself is elementally narrow.**

`preferredRoots` in `SECT_ADMISSION` already says who a house will take, and the
distribution across the catalog is real. `elementalIntensityOf()` reads it as:

```
narrowness  = 1 / (number of distinct elements the house will admit at all)
curriculum  = the dominant element's share of the manuals it teaches,
              with elementless arts in the denominator and not the numerator
intensity   = narrowness x (0.6 + 0.4 x curriculum)
```

**Intake is a ceiling on the curriculum, not a peer of it.** A house that takes every root
cannot have elemental buildings however single-minded its library is, because an earth
disciple's residence there is a standard courtyard. A house that admits nothing but a
mutated ice root is ice all the way down.

The first version of this weighted intake and curriculum together and put **seven** houses
in the absolutist band, including the Azure Cloud Pavilion - whose intake is metal-heavy,
whose library is metal end to end, and which *also* takes dual roots and puts uncultivated
mortals on probation to find out what they are. Its courtyards are courtyards. Counting
admitted elements instead gives the shape the catalog actually has:

| Band | Houses | What the buildings do |
|---|---|---|
| `>= 0.66` absolutist | **2** | The element decides the idiom. Cave abodes all the way down |
| `>= 0.28` coloured | **5** | Ordinary buildings; the element is in the trim and stops there |
| `< 0.28` neutral | **25** | Resolutely ordinary. Variety has to come from somewhere else |

**The 25 are the real test of a generator.** Anyone can make an ice court look like an ice
court. If your neutral houses are interchangeable, the generator is not working, and the
fix is wealth, region, governance, alignment, condition and age - not a splash of element.

### Where the style is allowed to bend

<!-- tier: 2 trigger="a senior figure's own residence is entered, or status is being read off a building" -->

Seniority buys deviation, and **the deviation is itself a rank signal** - a player can read
status off architecture before anybody tells them a rank.

- In a **broad** house there is a style to deviate from, so an elder's private residence is
  where element finally shows. `HouseStyle.deviation` is `'element'`.
- In a **single-root** house there is nothing to deviate from, because everybody is the same
  element. Rank has to be signalled by space, privacy and how many arrays around you are
  lit. `HouseStyle.deviation` is `'scale'`.

This is a forcing function against a one-trick generator, and it is why the field exists.

### The style is the archaeological fingerprint

<!-- tier: 2 trigger="somebody tries to identify who built a ruin from what is left standing" -->

The same representation is read from both ends: **generation uses it to build,
identification uses it to recognise.** Every location the generator produces carries
`data.styleTags`, a flat list of facets, so `provenance.ts` can match against it without
importing anything from the architecture module.

Facets decay in a fixed order, and this is where the interesting asymmetry comes from:

```
lost first   ornament:            hung on a wall, and worth taking
then         upkeep:              every ruin is dark; "dark" names nobody
then         trim: precision:     roofs, sills, and the finish on them
last         idiom: material: scale: element:      the ground
```

Measured across the 32 houses, treating each as a ruin and asking how many houses match
the surviving evidence as well as the best one does:

| Age | Field size |
|---|---|
| new | 1 to 5, mean 2.9 |
| old | 1 to 8, mean 4.3 |
| ancient | **1 to 10, mean 6.1** |

The two single-root courts narrow to **one candidate** from an ancient ruin: the rock is
the rock, and a house that admitted one root is named centuries later by its own walls.
`house-held-names` and `house-measured-span` narrow to **ten**. Telling *which* ordinary
house built an ordinary ruin is therefore the genuinely hard expert skill, and nobody had
to assert that anywhere - it falls out of the decay order.

---

## Access is a chain, not a door

<!-- tier: 2 trigger="the player is trying to get into somewhere they may not be allowed" -->

`evaluateAccess` answers one location. An interior is a chain of them, so
`reachThrough(path, query)` walks a caller-supplied path and returns **the first thing that
stops them** - not the worst thing on it.

That distinction was measured. The first version reported the sealed vault three courts
further in as the obstacle and hid the gate, which tells a player about a door they were
never going to reach. Being stopped at the inner gate and being stopped at the vault door
are different pieces of information and the player needs the first one.

Two rules that follow, and both are load-bearing:

- **A door inside a compound is a door.** The wall was the bar. A room's `entry` is zero
  unless it is a `vault` with its own lock; what a room gates is *working* there
  (`operational`), which is how somebody stands in an archive they cannot use. Copying the
  wall's number onto the room made `reachThrough` redundant and made a dark node worthless.
- **Somebody who went around a wall was never charged for it.** `reachThrough(..., {
  enteredAt })` waives the `entry` bars up to the point they arrived inside. Survival and
  operational still apply, because a hole in a wall does not confer standing.

The path is the caller's, and that is the whole point: the caller decides whether they came
through the gate or through a dead node, and the function does not care which. There is no
special rule for a break-in; it is a different path through the same function.

---

## Knowledge of a room is not a flag on the room

<!-- tier: 2 trigger="the player is somewhere they have not been before, or asking about a place" -->

> **Knowledge follows engagement, not altitude.**

A house engages with its own compound and an outsider does not, however senior. So
`roomStageFor(room, viewer)` takes a viewer and returns a `KnowingStage` from the social
layer's existing ladder - there is no second discovery model here and none may be added.

Two inputs, doing different work:

- **Rank buys the front of the house.** A high rank places every obvious room at once,
  because those are the rooms rank is exercised in.
- **Years buy the back of the house.** An unobvious room is learned by being in the
  building, and **rank does not substitute.** The right to be somewhere and the knowledge
  that it is there are different facts.

Measured on the Azure Cloud Pavilion's locked archive:

| Viewer | The practice yard | The archive |
|---|---|---|
| A visiting elder, four realms up, no years | `named` | `unaware` |
| Their own outer disciple, twenty years | `known` | `known` |
| Their own Sword Elder, two years | `known` | `placed` |

The twenty-year junior knows the archive is there. The house's own elder has every right to
walk into it and does not know it exists. The first version gated `known` on rank and could
not express that at all.

---

## What this deliberately does not model

<!-- tier: 3 -->

Absences shape a system as much as rules do, and an unwritten absence gets mistaken for an
oversight.

- **No hour-of-day room state.** This engine's clock runs in days and years - the normal
  player move is "I enter seclusion for two years", and the drift audit walks five
  centuries. A room that differs at 8am and midnight is state nothing will ever read. What
  *does* vary is the day, and `OpeningCycle` already expresses it: a house that hears
  petitions three days in thirty is `{ periodDays: 30, openDays: 3 }`, not a note.
- **No NPC schedules.** The world already simulates people at scale. Rooms **read** where
  NPCs are. A second scheduler in the location layer would drift from the real one, which
  is the "second combat system in the prose layer" mistake wearing different clothes.
- **No dimensions, with one exception.** Nothing reads a room's length. Something reads
  `capacity`, because *a practice yard cut for six hundred that holds ninety* is one of the
  strongest facts in the sect catalog and it is capacity against occupancy. Capacity is
  stored. Every other measurement is not.
- **No stored atmosphere.** A room does not store its smell, its light, its floor material
  or its furniture, because nothing in the engine reads any of them. They are derived at
  description time from purpose x style x condition through the seeded RNG, which gives
  unlimited texture at no storage cost and - unlike a stored adjective - is reproducible
  from the seed. There is a test asserting those keys are absent from `data`.

### Ruin wings are a separate model, on purpose

<!-- tier: 3 -->

`provenance.ts` has `RuinWing`, and it is **not** an interior in this sense and should not
be merged with one. A wing is a JSON blob in `location.data.wings` whose load-bearing field
is `depthDays`, and its whole job is to price an expedition against a convergence window
that is always shorter than the site is deep. It is a **scheduling abstraction for
extraction over time**. A precinct is a **place with thresholds that somebody stands in**.

The two do share one thing and it is the thing that matters: **house style**. A ruin's
architecture is evidence of who built it, and `styleTags` is the representation both ends
read. That is the unification worth having. Merging the wing model into the room tree would
buy nothing and would put a convergence clock inside a doorway.

---

## Adding a compound

<!-- tier: 3 -->

You do not add a compound. **You add a house to `sects.ts` and the compound follows.** If
the compound that comes out is wrong, the fix is a column on the house, not a special case
here.

The columns that most change what comes out, in rough order of effect:

1. `ranks` - the number of walls and the whole status ladder
2. `recruits` - whether there is an intake at all
3. `compound.formationNodesLit / Total` - how porous it is, and where
4. `preferredRoots` - whether the buildings are elemental
5. `compound.inherited` + `powerOrdinal` - whether it fits the people in it
6. `governance`, `alignment`, `production` - the working rooms and the finish

## Adding a room purpose

<!-- tier: 3 -->

Each purpose in `RoomPurpose` has a spec that decides behaviour: its `LocationKind`, where
it sits on the precinct ladder, how obvious it is, whether it concentrates qi, whether it
starts sealed, and what it is cut for. **Adding a purpose that behaves identically to an
existing one is decoration.** If you want a different name for the same behaviour, give the
existing purpose a different name in `roomName()` - which is already keyed off the house's
idiom, so a carved compound has a *reading cut* where a terraced one has a *scripture
pavilion*.

## Adding a `LocationKind`

<!-- tier: 3 -->

Four interior kinds exist and each changes a behaviour:

| Kind | What it changes |
|---|---|
| `precinct` | The rung the access chain is walked over. Explicitly not a settlement, so the crowding and birth passes do not count the same people once per wall |
| `hall` | Carries a schedule. Qi is whatever the ground gives |
| `chamber` | The only **open** room above its parent's `qiDensity`, and therefore the only one being crowded out of costs anything |
| `vault` | Sealed at creation with a `keyId`, calibrated at the mastery bar. What a house keeps rather than uses |

A fifth would need to change something these four do not. **The identity of a room is
`data.purpose`, which is content; the kind is only what the engine switches on.**

---

## The test

<!-- tier: 3 -->

For a region, `making-places-different.md` asks: *name three things that are true here and
false one province over.* The indoor version is harder and it is the one that matters,
because the easy elemental cases pass anything:

> **Show a reader two rooms from two different compounds with the names removed. Can they
> tell which house built which?**

If both rooms are from single-root houses, this is free and proves nothing. Run it on two
of the twenty-five neutral houses. If the answer is no, the house styles are decoration and
the difference has to come from somewhere the generator actually reads - wealth, condition,
what the house answers to, what it can still make, and how badly the building fits the
people in it.

The second test, for a compound rather than a room:

> **Walk the compound top to bottom and name the one thing that would be different if the
> house had one more rank, or one fewer lit node.** If nothing would change, the compound
> is a template with the numbers painted on.
