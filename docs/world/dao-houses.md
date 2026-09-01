<!-- tier: 2 trigger="a Dao house is in play, or the player encounters karma, fate, oaths, names, or spatial authority as an institution" -->

# The Dao Houses

Why some ancient factions are formidable without having the strongest individual: houses
that have spent thousands of years understanding one fundamental aspect of reality better
than anyone else alive. Load this when a house is in play, or when the player runs into a
consequence they cannot trace.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [Knowledge accumulated for millennia is itself a form of power](#knowledge-accumulated-for-millennia-is-itself-a-form-of-power) | an old house is weighed against a prodigy, or a faction is formidable without holding the strongest individual |
| [Specialisation is not ownership](#specialisation-is-not-ownership) | somebody claims a house owns or controls a principle |
| [The principle must operate outside combat](#the-principle-must-operate-outside-combat) | a house's principle is brought to bear somewhere other than a fight |
| [Their power should be frightening in a specific way](#their-power-should-be-frightening-in-a-specific-way) | the player is deciding whether it is safe to cross a house |
| [Blind spots and counters are mandatory](#blind-spots-and-counters-are-mandatory) | the player is looking for a way around a house's specialisation |
| [What a karma house can see](#what-a-karma-house-can-see) | karma is read, traced, or invoked against somebody |
| [Houses rise, fall, and rewrite what happened](#houses-rise-fall-and-rewrite-what-happened) | the player is investigating a ruin, a discrepancy in the record, or who used to hold a territory |
| [Discovery, not exposition](#discovery-not-exposition) | the narrator is about to say what a house specialises in |
| [And it outlives its experts](#and-it-outlives-its-experts) | a house's greatest living expert dies, or somebody expects a discipline to die with its holder |
| [Related](#related) | **Tier 3** - never injected |

---

## Knowledge accumulated for millennia is itself a form of power

<!-- tier: 2 trigger="an old house is weighed against a prodigy, or a faction is formidable without holding the strongest individual" -->

Not every formidable faction should be "a sect with stronger cultivators." Some ancient
houses are formidable because of what they understand.

Candidate principles: karma, fate, causality, space, time, life, death, dreams, memory,
names, oaths, order, chaos, severance, creation, destruction, flame, yin and yang, the
sword, souls.

> The strongest faction is not necessarily the one with the strongest individual.

A young prodigy can become enormously powerful. An ancient house has generations,
history, techniques, artifacts, relationships, territory, resources and secrets, and that
accumulated weight has to matter. **Civilisation itself is part of power progression.**

## Specialisation is not ownership

<!-- tier: 2 trigger="somebody claims a house owns or controls a principle" -->

A house does not "own" karma or "control" fate. It understands a principle
extraordinarily well and holds an enormous advantage in it. Everyone else still interacts
with that principle - clumsily, and usually without noticing.

A five-thousand-year-old house holds knowledge a lone genius cannot reproduce overnight,
because it was built the long way:

```text
a founder develops a method -> disciples refine it -> descendants preserve it
  -> artifacts are made -> new techniques are derived -> unique resources accumulate
    -> the house becomes the authority on the subject
```

## The principle must operate outside combat

<!-- tier: 2 trigger="a house's principle is brought to bear somewhere other than a fight" -->

This is the part that is easy to get wrong. A karma specialist must never reduce to
"karma attack, 900 damage." The specialisation should shape how the house touches
civilisation:

| House of | Reaches into |
|---|---|
| Karma | Relationships, debts, oaths, inheritance, family, causal tracking, concealment, severance |
| Fate | Probability, divination, recognising which possibilities matter, seeing events converge |
| Oaths | Contracts, promises, restrictions, sworn agreements, the punishment for breaking one |
| Space | Travel, portals, territory, formations, storage, barriers |

Which is why such houses become **institutions**, not just powers. A karma house ends up
supplying judges, oath witnesses, debt arbiters, inheritance authorities and
investigators. A fate house ends up advising rulers. An oath house ends up holding the
treaties. **Their authority is civil before it is martial.**

This is also why a house is who you go to in order to verify a sect's claimed immortal
ancestor - see [`sects.md`](sects.md).

## Their power should be frightening in a specific way

<!-- tier: 2 trigger="the player is deciding whether it is safe to cross a house" -->

The interesting question is not *can I beat this person*. It is:

> "I could probably kill him. But what happens afterwards?"

Killing a member creates a permanent relationship with the whole house. Breaking an oath
invokes something. Entering their territory means being read by people who understand
that principle better than you do.

## Blind spots and counters are mandatory

<!-- tier: 2 trigger="the player is looking for a way around a house's specialisation" -->

No specialisation may be an automatic win.

- Every principle has a counter: karma against karmic severance, fate against fate
  concealment, oaths against nullification, space against spatial anchoring, souls
  against soul protection. Counters are rare, dangerous, and usually held by a rival
  house.
- Every house is *bad* at things. A karma house may be terrifying at relationships and
  poor at open warfare, alchemy or formations. A fate house may read possibilities and be
  useless in genuine chaos or against someone deliberately disrupting prediction. A space
  house may dominate movement and hold no political influence at all.
- Houses can disagree about reality itself. *Fate decides what happens* against *karma
  decides what must eventually be repaid* against *neither is absolute* is an ideological
  conflict before it is a fight.

And they are not omnipotent: they have enemies, internal factions, political problems,
resource shortages, declining branches, incomplete knowledge, failed techniques, and
ancestors who are simply dead.

## What a karma house can see

<!-- tier: 2 trigger="karma is read, traced, or invoked against somebody" -->

Karma in this world is a **graph of persistent relationships between entities**, not a
score - and it is mostly invisible to the people inside it, crossing generations without
anyone tracking it. A house that studies karma is one of the few things that can see the
whole thread.

The model itself, and the prohibition on ever surfacing it as a reputation number, is in
[`../../src/engine/social/README.md`](../../src/engine/social/README.md).

---

## Houses rise, fall, and rewrite what happened

<!-- tier: 2 trigger="the player is investigating a ruin, a discrepancy in the record, or who used to hold a territory" -->

Ancient factions replace each other. A successor inherits territory, resources,
techniques, enemies, obligations, artifacts and reputation - and frequently rewrites the
record:

```text
official history   "the previous house was corrupt and was rightly destroyed"
the truth          they wanted the territory
   or              the predecessor had found something dangerous
   or              nobody now alive remembers what the quarrel was about
```

The player can uncover the discrepancy between official history, surviving records,
ruins, descendants, artifacts, and what actually happened.

A destroyed house leaves scars regardless: ruins, forbidden techniques, bloodlines,
descendants, artifacts, broken formations, cursed ground, inherited enemies, hidden
disciples, standing oaths, unsettled karma, altered geography. It can matter for thousands
of years after its last member died.

Territory therefore stacks:

```text
an older civilisation -> House A -> House B takes it from A -> B declines
  -> Sect C occupies the ruins -> the present
```

The player first learns only *"Sect C controls this region."* Much later: Sect C is built
on House B's ruins. Later: B took it from A. Later still: A was there to keep something
contained.

The mechanism that stores those layers separately, so each can be uncovered on its own
timetable, is in
[`../../src/engine/world/README.md`](../../src/engine/world/README.md).

## Discovery, not exposition

<!-- tier: 2 trigger="the narrator is about to say what a house specialises in" -->

Never announce that a house studies karma. The player arrives at it:

```text
a relationship that makes no sense -> an event with no visible cause -> rumours
  -> investigation -> an old record -> meeting a specialist -> understanding
```

## And it outlives its experts

<!-- tier: 2 trigger="a house's greatest living expert dies, or somebody expects a discipline to die with its holder" -->

If the greatest living karma cultivator dies, the discipline does not. It survives in
disciples, manuals, artifacts, descendants, sealed inheritances and fragments. A house can
lose its finest expert and remain dangerous, because the thing that made it dangerous was
never one person.

## Related

<!-- tier: 3 -->

- [`sects.md`](sects.md) - the other kind of faction, and what houses sell them
- [`../../src/engine/social/README.md`](../../src/engine/social/README.md) - karma as a graph, secrets, belief
- [`../../src/engine/world/README.md`](../../src/engine/world/README.md) - stacked territory and the surviving record
- [`the-late-age.md`](the-late-age.md) - the wreckage the houses are standing in
