<!-- tier: 2 trigger="the player is trading, buying, looting, grave-reading, or disputing who owns something" -->

# The Economy

Scarcity, what things cost, who is holding what and whose it actually is, and the two
kinds of site a body-robber can find. Load this when the player is trading, looting, or
arguing about ownership.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [Scarcity is the engine](#scarcity-is-the-engine) | the player is priced out of something, or asks why anybody bothers digging |
| [What restocks a thing](#what-restocks-a-thing) | stock runs out, a place is worked over, or somebody asks why the cheap things come back |
| [Spirit stones](#spirit-stones) | spirit stones change hands, or somebody is cultivating where the ambient qi will not support them |
| [What things cost](#what-things-cost) | a price is quoted, or the player asks what something is worth |
| [Possession, ownership, and where things came from](#possession-ownership-and-where-things-came-from) | ownership of an object is disputed, or the player acquires something significant |
| [Graves and grave-readers](#graves-and-grave-readers) | the player is looting a body, entering a sealed site, or considering grave-reading as a profession |
| &nbsp;&nbsp;[A grave is not an inheritance](#a-grave-is-not-an-inheritance) | the player is standing in front of an opened site and does not know which kind it is |
| &nbsp;&nbsp;[Inheritances as a mechanism](#inheritances-as-a-mechanism) | an inheritance is being opened, designed, or claimed |
| [Related](#related) | **Tier 3** - never injected |

---

## Scarcity is the engine

<!-- tier: 2 trigger="the player is priced out of something, or asks why anybody bothers digging" -->

Resources are scarce - spirit stones, pills, herbs, cultivation grounds, caves,
inheritances, techniques, artifacts, rare beasts, secret realms - and **scarcity is what
generates conflict**. Two sects want the same vein. Two disciples want one inheritance. An
elder quietly favours their own. A talented disciple becomes politically dangerous because
several factions want to own them.

The ultimate scarce good is qi itself, and it is contested in the plainest possible sense:
qi drawn by one person is not available to another. See [`qi.md`](../climbing/qi.md).

Cultivation is **embedded in society** rather than confined to mountaintop hermits:
alchemists, formation masters, merchants, craftsmen, teachers, officials, military
cultivators, researchers, administrators, healers, explorers. That is what makes an
economy exist at all.

## What restocks a thing

<!-- tier: 2 trigger="stock runs out, a place is worked over, or somebody asks why the cheap things come back" -->

[`items.md`](./items.md#does-it-have-a-history) decides how a thing is **stored** - a count, or a
row with a history. This is the question that decides how it **comes back**, and it is a
different question with a different answer, because two things stored identically can refill
by completely different means.

There are three tiers and the first is the one people forget, because there is nothing to
find in the code:

**Not modelled at all.** A bowl of millet, a robe, a night's board, a mortal sword. These have
**a price and an availability, and never a count** - the board in
[`../../src/data/cultivation/mortal-world.ts`](../../../src/data/cultivation/mortal-world.ts)
carries no quantity anywhere on it, on purpose. Nobody works out how much grain a province
holds. **What moves this tier is events, not consumption:** a thousand travellers buying meals
does not cause a famine, and a famine causes the meals to stop. So the way to make millet
scarce is to do something to the province, never to decrement anything.

**Counted, out of the ground.** Herbs, beast materials, ore. A number per holder and per place,
no id and no history. It falls when people take it and it grows back, which means **a district
can be worked out** - a hillside picked over stays picked over until it recovers, and where
somebody has been is legible from what is not there any more. This is the only tier where
taking has a physical consequence for the place.

**Counted, out of labour.** Common manuals, cheap pills, ordinary talismans - anything made in
quantity by people nobody can name. It restocks by somebody's months rather than by any
season, so **it cannot be exhausted the way a hillside can**: emptying a stall does not empty
the world, it raises what the next copy is worth until writing one out is worth somebody's
time again. The cost of a common manual is already computed this way - it is what the copyist
gave up - which is why the price moves with the depth of the book and not with anybody's
opinion of it.

**Tracked.** One object, one id, a provenance. It does not restock at all; it moves. See
[possession, ownership, and where things came from](#possession-ownership-and-where-things-came-from).

Two rules cut across every tier:

- **Grade is fixed when a thing is made and never moves.** Nothing is upgraded, and nothing
  earns its way from counted up into tracked by being valuable or famous. An earth-grade
  carriage is an earth-grade carriage for its whole existence. **The only movement is
  downward**, and it is the ordinary rule that a piece is worth one rung less than the whole -
  `shardPower`, applied identically to a shattered sabre and to a shattered immortal weapon.
- **Crafting creates, it does not promote.** A recipe consumes counted stock and produces a
  *new* thing whose grade is whatever that thing is. Refining does not raise the ingredients;
  it spends them. You can make more tracked objects this way, and each one is a new individual
  whose provenance starts at its making rather than continuing anybody else's.

## Spirit stones

<!-- tier: 2 trigger="spirit stones change hands, or somebody is cultivating where the ambient qi will not support them" -->

Spirit stones are qi compressed until it holds its shape. They are money, they are fuel,
and they are the only way to cultivate somewhere the ambient qi will not support you -
which is why a poor cultivator's stones are never savings. **They are the difference
between progressing and not.**

The Stonewright Consortium refines raw qi into stones and sets the exchange rate, which
means they set the price of everything, including the price of a vein. See
[`sects.md`](../houses/sects.md).

## What things cost

<!-- tier: 2 trigger="a price is quoted, or the player asks what something is worth" -->

Price follows grade, and grade is one legible axis across every catalog. Three rules govern
the shape of it:

- **Buying advancement always costs more than buying survival.** Within a grade, the
  things that touch progression - breakthrough odds, cultivation progress, lifespan, and
  freedom from having to eat - sit at the top of both the value and the danger ranges.
- **Refinement adds value.** The combined market value of a recipe's ingredients is
  strictly less than the pill's, otherwise no alchemist would exist and the ingredient
  market would be the whole economy.
- **Grade is a statement about who can MAKE the thing, and that is where the price comes
  from.** A cultivator cannot work with materials above their realm - mortal grade at Qi
  Condensation, earth at Core Formation, heaven at Void Refinement, and above that by
  nobody living below the Lid. Price does not rise with grade because somebody decided
  higher should cost more. It rises because the population that could supply the market
  shrinks at every rung. [`items.md`](./items.md#who-is-allowed-to-make-it) carries the
  derivation and the measured counts.

That third rule is what puts the cash line where it is. Mortal and earth grade are bought
and sold openly, because enough hands make them for a market to restock. Heaven grade and
above are not for sale at any figure - and the reason is not that stock is short, it is
that the price exceeds what the income of the rank the thing serves could ever accumulate,
so no cash sum is a rational trade for one. What moves one is a favour owed, another
singular thing, or nothing at all. And **immortal grade carries no price in either
direction**, because a price would imply the economy reaches it at all: see
[the tier nobody here makes](./items.md#the-tier-nobody-here-makes).

Pills are the only reliable way to undo damage in this game, and they are the reason a
run's economy exists at all. Higher-grade medicine is also more poisonous, so spamming it
at a low realm is a way to die of the cure. The actual bands are in
[`../../src/data/cultivation/README.md`](../../../src/data/cultivation/README.md).

---

## Possession, ownership, and where things came from

<!-- tier: 2 trigger="ownership of an object is disputed, or the player acquires something significant" -->

**Possession is not ownership.** Keep four things separable:

```text
possession              who is physically holding it
ownership               whose it actually is
claim                   who asserts a right to it
knowledge of ownership  who knows any of the above
```

A player who finds an ancient artifact possesses it. An extinct clan's surviving
descendant may hold a legitimate ancestral claim. Neither may know about the other. **That
gap is a situation, and situations are what this engine is for.**

**Significant resources carry provenance** - not every spirit stone forever, but anything
that matters:

```text
108 spirit stones     source: an abandoned mine     found: day 180
                      previous owner: unknown

an old sword          source: a dead cultivator     acquired: inheritance
                      previous owner: named, and remembered by their sect
```

This is what makes stolen goods, disputed inheritances, faction claims, investigations and
century-old karmic consequences possible without a separate system for each. A karma house
is one of the few institutions that can read the whole chain - see
[`dao-houses.md`](../houses/dao-houses.md). The storage model is in
[`../../src/engine/world/README.md`](../../../src/engine/world/README.md).

Techniques and recipes carry a coarser provenance of their own - `taught`, `ruin` or
`grave` - and it decides whether a thing can be bought at all or only dug up. See
[`../../src/data/cultivation/README.md`](../../../src/data/cultivation/README.md).

---

## Graves and grave-readers

<!-- tier: 2 trigger="the player is looting a body, entering a sealed site, or considering grave-reading as a profession" -->

Cultivators die carrying everything they own.

There are no banks worth the name and nothing worth leaving at home, so a cultivator's
possessions travel on their body: their storage pouch, their artifacts, the manual they
were part-way through, the pills they were saving for a crossing they never attempted. When
they die somewhere remote - and most of them die somewhere remote - all of it stays where
they fell.

**Grave-reading** is the profession built on that fact. It is disreputable, extremely
profitable, and the fastest way for a low-realm cultivator to obtain something they have no
business owning. It is also how someone at Qi Condensation stumbles onto the remains of
somebody who died at Nascent Soul and finds a thing that will either make them or kill them
inside a year. Usually the latter.

And robbing the dead attracts attention. Sects keep records of where their people fell.
Families remember. Some of what looks abandoned is being watched, and a few of the richest
sites in the world are baited.

### A grave is not an inheritance

<!-- tier: 2 trigger="the player is standing in front of an opened site and does not know which kind it is" -->

Knowing which you are standing in front of is most of the skill.

| | **A grave** | **An inheritance** |
|---|---|---|
| Origin | Involuntary - someone died here, carrying what the crossings had not yet taken | Deliberate - someone arranged this before ascending |
| Contents | Whatever they happened to be carrying: fragments, names, a face, a debt | Chosen, curated, often the best of what they had |
| Protection | Whatever settled or grew up around it since | Designed trials, gates, conditions of worth |
| Attitude | Indifferent | Intended for *someone*, and frequently opinionated about who |

**An inheritance can refuse you. A grave never does** - which is exactly why graves kill
more people. Nothing about a corpse's belongings is calibrated to the person who finds
them.

### Inheritances as a mechanism

<!-- tier: 2 trigger="an inheritance is being opened, designed, or claimed" -->

An inheritance is never "a chest containing experience." It is a mechanism for
transmitting power and knowledge across ages, and it should be capable of changing a
cultivator's entire trajectory. It may carry techniques, treasures, bloodline alteration,
knowledge, trials, a cultivation environment, restrictions, or legacy obligations.

It should also carry friction: compatibility requirements, hidden costs, incomplete
information, traps, guardians, time limits, and **competing claimants**.

Who builds them, and why they are gated rather than merely lethal, is
[`immortals.md`](../climbing/immortals.md). When they are available, and why extraordinary
opportunities must stay rare, is in
[`../../src/engine/world/README.md`](../../../src/engine/world/README.md).

## Related

<!-- tier: 3 -->

- [`qi.md`](../climbing/qi.md) - the scarce good underneath every other price
- [`the-late-age.md`](../history/the-late-age.md) - why digging beats cultivating for most people
- [`sects.md`](../houses/sects.md) - who sets the exchange rate, and who holds the veins
- [`immortals.md`](../climbing/immortals.md) - the author of the inheritance economy
- [`../../src/data/cultivation/README.md`](../../../src/data/cultivation/README.md) - the value and grade bands
