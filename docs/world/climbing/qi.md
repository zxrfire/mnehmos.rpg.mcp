<!-- tier: 2 trigger="always relevant; the compressed form is Tier 1 in NARRATOR-CORE.md" -->

# Qi

What qi is, why its distribution organises the entire world, and what a spirit stone
actually is. The compressed always-loaded version of this file is in
[`NARRATOR-CORE.md`](../NARRATOR-CORE.md); everything here is the fuller account.

Mechanically this is the ambient system - see
[`../../src/engine/cultivation/README.md`](../../../src/engine/cultivation/README.md).

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [The world and the ceiling](#the-world-and-the-ceiling) | the player learns about ascension, the Lid, or the top of the ladder |
| [Qi is a resource, and it is not evenly distributed](#qi-is-a-resource-and-it-is-not-evenly-distributed) | **Tier 1** - every turn |
| &nbsp;&nbsp;[Thin regions have a ceiling](#thin-regions-have-a-ceiling) | the player is in, from, or asking about a qi-poor region |
| &nbsp;&nbsp;[And qi is contested](#and-qi-is-contested) | territory, sect conflict, a massacre, or competition over a region is in play |
| [Qi density, read mechanically](#qi-density-read-mechanically) | **Tier 1** - every turn |
| [Spirit roots: how your body takes qi](#spirit-roots-how-your-body-takes-qi) | character creation, talent, or a manual's element is in play |
| [Related](#related) | **Tier 3** - never injected |

---

## The world and the ceiling

<!-- tier: 2 trigger="the player learns about ascension, the Lid, or the top of the ladder" -->

The world is one enormous planet, and above it there is a ceiling.

Cultivators call it different things depending on who taught them, but everyone who gets
high enough agrees on the shape of it: there is a limit to how far the world will let a
person rise, and past that limit is somewhere else. Ascending means going through. Almost
nobody does.

Below the ceiling, everything runs on **qi**. What is above it is
[`immortals.md`](./immortals.md).

---

## Qi is a resource, and it is not evenly distributed

<!-- tier: 1 -->

Qi is the ambient spiritual energy cultivators draw in, refine and store. It is not
metaphorical and it is not infinite. It pools in **spiritual veins** - features of the land
the way ore bodies are - and its density varies enormously from place to place.

This single fact organises the entire world.

| Density | What it means to live there |
|---|---|
| **Rich** | A vein beneath you. Cultivation is fast, breakthroughs are survivable, and somebody already owns it |
| **Ordinary** | Progress is possible and slow. Most inhabited land |
| **Thin** | Progress is agonising, and there is a hard ceiling on how far anyone here will ever get |
| **Dead** | Nothing. Old battlefields, tribulation scars, places something drained |

**The great sects are old because they sit on rich veins, and they sit on rich veins
because they are old enough to have taken them.** That is the whole of their history in
one sentence, and it is why sect territory is the most fought-over property in the world.
A sect that loses its vein does not decline gracefully; it stops producing cultivators
within a generation and is absorbed by whoever took it.

### Thin regions have a ceiling

<!-- tier: 2 trigger="the player is in, from, or asking about a qi-poor region" -->

In a genuinely qi-poor region, a cultivator does not merely progress slowly. They
**stop**. There is not enough ambient qi to condense, and no amount of talent, discipline
or years will manufacture it. Whole provinces exist where nobody has passed Qi
Condensation in living memory and the local understanding of cultivation is that the
higher realms are stories.

This is the single most common reason a life goes nowhere, and it has nothing to do with
the person. Getting *out* of a poor region - to a sect, a city, a rented cave on a decent
vein - is the first real goal of most cultivators who ever amount to anything.

### And qi is contested

<!-- tier: 2 trigger="territory, sect conflict, a massacre, or competition over a region is in play" -->

Here is the part everyone knows and nobody says at dinner: **a region supports only so
many cultivators.** Qi drawn by one person is not available to another. A valley that
comfortably carries thirty cultivators carries three hundred badly, and everyone in it
progresses more slowly for every additional person.

Which means the arithmetic is available to anyone who looks at it. Fewer competitors is
more qi. A sect that quietly limits its own intake is being prudent. A sect that culls a
rival's outer disciples is being efficient. And every so often somebody works out that a
massacre is an investment, and does it, and it *works* - the qi is genuinely freer
afterwards.

Nobody defends this out loud. The Dao houses have language for it, the righteous sects
have prohibitions against it, and the practice is old, well understood, and never quite
stamped out. Some of the richest ground in the world is rich because of what happened on
it.

---

## Qi density, read mechanically

<!-- tier: 1 -->

The ambient system is the qi system. When the engine reports an ambient state, this is
what it means, and the narrator should describe it this way:

| Engine state | The world |
|---|---|
| **thin** | Drawn down, or never rich. Cultivating here is chewing on nothing - half rate, and breakthroughs suffer. Most of the world is thin, and some of it is hopeless |
| **normal** | Ordinary inhabited land. Progress is possible and unhurried |
| **dense** | A vein close to the surface, or ground nobody has worked. Somebody owns this, or somebody is about to |
| **spirit_tide** | A surge - a vein shifting, a seal failing, a season turning over. Everyone within a hundred li feels it, sects mobilise, and it does not last |

**Spirit stones** are qi compressed until it holds its shape. They are money, they are
fuel, and they are the only way to cultivate somewhere the ambient qi will not support
you - which is why a poor cultivator's stones are never savings. They are the difference
between progressing and not. What they buy, and who sets their price, is
[`economy.md`](../things/economy.md).

---

## Spirit roots: how your body takes qi

<!-- tier: 2 trigger="character creation, talent, or a manual's element is in play" -->

A spirit root is the shape of the aperture you draw qi through - decided before you were
born, unchangeable, and worth more than any effort you will ever make. The roots
themselves, the four innate attributes, and what each draw actually costs are in
[`../../src/engine/cultivation/README.md`](../../../src/engine/cultivation/README.md).

The point that belongs to the world rather than to the engine: **talent is not earned,
cannot be improved, and is the largest single thing you are handed - about a third of the
story, and not more than that.**

That sentence used to read "decides nearly everything", and the measurement does not
support it. Over 720,000 birth-weighted lives through `simulateLife`, the share of
variance in how far a life gets:

| Factor | Share | |
|---|---|---|
| spirit root | 29% | dealt at birth |
| foundation quality | 25% | earned in the life |
| depth of what was comprehended | 22% | earned in the life |
| Insight | 10% | dealt at birth |
| origin tier | 0.8% | dealt at birth |
| Fortune | 0% | dealt at birth |

So the root is the biggest single term and it is not most of the answer: the foundation
you establish and how deeply you comprehend anything are together worth more, and both are
things that happen after you are born. A root sets the ceiling on the climb rather than
walking it for you.

What does not change is the shape of the population. The overwhelming majority of people
who ever try to cultivate draw a muddled root, get nowhere, and die at eighty having spent
their lives on it anyway. A player who draws a muddled root in a poor region has drawn the
real experience of this world.

## Related

<!-- tier: 3 -->

- [`NARRATOR-CORE.md`](../NARRATOR-CORE.md) - the compressed always-loaded version
- [`the-late-age.md`](../history/the-late-age.md) - why most of the world is thin now
- [`economy.md`](../things/economy.md) - what spirit stones buy
- [`sects.md`](../houses/sects.md) - who holds the veins
- [`../../src/engine/cultivation/README.md`](../../../src/engine/cultivation/README.md) - the ambient system in code
