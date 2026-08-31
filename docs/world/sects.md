<!-- tier: 2 trigger="the player is dealing with a sect, a faction, or one of the standing powers" -->

# Sects

Sects as political institutions rather than quest hubs: hierarchy, internal factions,
succession, what an ancestral record is worth, and the five standing powers of the region.
Load this whenever a sect or faction is in play.

The catalog that models all of this is
[`../../src/data/cultivation/README.md`](../../src/data/cultivation/README.md).

---

## Sects are institutions

A sect is not a quest hub. It has hierarchy, elders, disciples, resources, territory,
rules, internal factions, treasures, techniques, enemies, allies, political interests,
secrets, and succession problems.

Members' interests conflict. One elder protects the sect; another builds their faction; a
disciple wants to become an elder; another wants revenge on a rival. The sect behaves like
a political organisation, because it is one.

Resources are scarce - spirit stones, pills, herbs, cultivation grounds, caves,
inheritances, techniques, artifacts, rare beasts, secret realms - and scarcity is what
generates conflict. Two sects want the same vein. Two disciples want one inheritance. An
elder quietly favours their own. A talented disciple becomes politically dangerous because
several factions want to own them.

Cultivation should also be **embedded in society**, not confined to mountaintop hermits:
alchemists, formation masters, merchants, craftsmen, teachers, officials, military
cultivators, researchers, administrators, healers, explorers. That is what makes an
economy exist. See [`economy.md`](economy.md).

Every sect in this world is *late*. None of them built what they live in - see
[`the-late-age.md`](the-late-age.md).

### What a sect is for, from the disciple's side

The single most valuable thing a sect offers is protection at a crossing. A sect that has
decided a disciple is worth protecting spends real resources on their realm boundary:
formations, elders holding them steady, pills nobody at that realm could afford. **This is
most of why anyone tolerates a sect, and the sect will tell you exactly what it cost.**
The mechanism it is protecting against is in
[`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md).

---

## Ancestral records and the millennial offering

<!-- tier: 2 trigger="a sect's standing, prestige, ancestry, or vault is in question" -->

Every sect keeps records of its ancestors. For almost all of them this is genealogy and
hagiography: a wall of names, a founder's sword nobody can draw, a hall of tablets to
people who have been dead for two thousand years and are not coming back.

**A handful of sects have an ancestor who is still alive.**

Someone who crossed, went through, and is on the other side of the Lid right now. This is
the single largest determinant of a sect's standing in the world - larger than its current
strongest member, larger than its territory, larger than its vein. A sect with a living
immortal ancestor is not treated as a strong sect. It is treated as a sect that might, at
some point, be answered.

Roughly once a millennium - or when the need is bad enough to justify spending the
principal - such a sect hosts an **offering**. It costs an appalling amount: rare
materials, the sect's accumulated reserves, sometimes the working artifact that makes the
channel possible at all. The whole institution bends around it for years beforehand.

And what comes back is **a few words**.

Sometimes fewer. Sometimes nothing, and the sect spends the next century arguing about
whether the ancestor is dead, uninterested, or was never there. What does come back is
usually short, frequently oblique, and occasionally reorganises the region - a name, a
warning, an instruction nobody understands for two hundred years, permission.

### Two kinds of ancestor

An ancestral asset comes in two forms, and they behave completely differently.

| | **Ascended** | **Dormant** |
|---|---|---|
| Where | Through the Lid, gone | Still in the world - sealed, entombed, or nine hundred years into seclusion |
| Contact | A millennial offering, and a few words back | They can be **woken** |
| Cost | The sect's principal | Usually irreversible; they may have little time, little lucidity, or be spending the last of themselves |
| Effect | Information, a warning, permission | Immediate, direct, and catastrophic for whoever caused it |

The dormant kind is what makes *"I could kill this disciple - but what happens afterwards?"*
a real question. A sect with eleven disciples and something sealed under its mountain is
far more dangerous than a sect with three hundred and nothing, and outsiders frequently
cannot tell which is which, because sects lie about both.

Waking one is a **break-glass** decision. It generally ends them: whatever is left is spent
doing the thing it was woken for. So the question a sect under threat actually faces is
never "can we win" but "is this worth the ancestor" - and that is a judgement its elders
can get wrong in both directions. Waking one to settle a border dispute is how a sect
becomes a footnote.

### Recency is most of the prestige

Having an ascended ancestor is not a binary. **What matters is how recently they left**,
because nothing goes through the Lid with them - so the years before a crossing are spent
divesting, and the sect is where most of it goes.

A sect whose ancestor crossed a few centuries ago is therefore holding a **parting gift**:
a reserve artifact, a manual, a technique nobody in the world can teach, left behind by
someone who no longer needed any of it. That sect is not merely old and respected. It is
*currently* formidable, its ancestor may still take an interest, and everyone knows both
facts.

The last confirmed crossing in the world was centuries back. Whichever sect that ancestor
came from is the preeminent institution of the present age, and is treated accordingly -
not because its living cultivators are the strongest, but because of what is in its vault
and who might still be listening.

Prestige from an ancestor decays over the ages that follow:

```text
recent          the parting gift is intact, the ancestor may still answer,
                and everyone in the world knows the sect's name
several ages    the gift has been spent, lost, or quietly stolen; the offerings
                return less; the claim is still true and still worth something
ancient         records, a hall of tablets, and an assertion nobody can verify
```

Which is why the middle of that curve is where the politics live. A sect whose gift is
gone but whose claim is intact has every incentive to keep the claim unexamined - and a
rival has every incentive to have it examined.

Consequences worth building on:

- **Sects lie about this.** A claimed immortal ancestor is the cheapest prestige in the
  world if nobody can check, and verifying such a claim is exactly the sort of service a
  Dao house sells - and exactly the sort of thing worth killing to keep unverified. See
  [`dao-houses.md`](dao-houses.md).
- **An offering is a world event.** Preparations are visible for years, rivals know the
  date, and the sect is at its most vulnerable and most valuable in the same week.
- **The player can be present for one.** Being an outer disciple during an offering is the
  kind of thing a cultivator tells people about for the rest of their life, usually
  inaccurately.
- **And if the player ascends,** their own sect inherits this. Descendants and disciples
  may spend a millennium saving up to ask them a question - which is the far end of the
  loop, and worth reaching.

### Immortal lineages

Sects and clans are also counted by how many immortals they have produced. The counting,
and what a recognised branch of an immortal clan can expect, are in
[`immortals.md`](immortals.md).

---

## The standing powers

<!-- tier: 2 trigger="one of the named powers appears, is invoked, or is being traded with" -->

- **The Stonewright Consortium** - neutral, mercantile, and the closest thing the world
  has to a functioning state. They refine raw qi into spirit stones and set the exchange
  rate, which means they set the price of everything, including the price of a vein. Not
  evil; simply incapable of seeing a region as anything but yield.
- **Lantern Hall** - righteous. Archivists. They record what the crossings take: the
  names, the faces, the people who are no longer remembered by anyone who knew them.
  Their position is that a world which requires its best to cut away everything they
  loved is a world eating itself. They are hard to argue with, and it has made them very
  unpopular.
- **The Severed** - demonic path, and the most coherent argument in the setting. Their
  reasoning: the crossings will take everything eventually, so take it yourself first, on
  your own terms, at a time of your choosing. They cut their own bonds, memories and
  names *in advance*. They climb faster than anyone. What arrives at the top is not
  really a person and does not pretend to be.
- **The Hollow Court** - Grand Ascension cultivators who reached the Lid and refused to
  go through. Nothing left to take, therefore nothing left to threaten. Functionally
  immortal, functionally inert, and the only people left who can afford to be honest.
  What a good number of the oldest of them actually are is in
  [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md).
- **The Kiln Wardens** - they guard the deep vein at the world's root, which is either
  still running or has not been checked in a very long time. They do not explain
  themselves and they do not recruit.

## Related

- [`dao-houses.md`](dao-houses.md) - the other kind of formidable faction
- [`immortals.md`](immortals.md) - what is on the other end of an offering
- [`economy.md`](economy.md) - what a sect's scarcity actually trades in
- [`people.md`](people.md) - why the elders want incompatible things
- [`../../src/data/cultivation/README.md`](../../src/data/cultivation/README.md) - the sect catalog

## Sects are a pyramid, and the pyramid is the vein network

Factions are not a flat list of rivals in one province. They stack, and the stack is held
together by **who controls the water**.

```text
an apex institution            ancient, holds the vein system entire
  its courts / branches        each administers one arterial vein
    the sects beneath them     each holds a single vein, at sufferance
      unaffiliated locals      hold nothing, and are tolerated
```

A subsidiary sect does not own its vein. It **holds** one, on terms, from something above
it - which is why the pyramid is stable without constant war, and why losing your patron
is worse than losing a battle. The parent does not need to attack a disobedient sect. It
needs only to stop renewing.

This also answers a question the vein economy raises: if a sect that loses its vein
collapses within a generation, why is the map not permanently on fire? Because most sects
are not competing for veins at all. They are competing for **standing with whoever grants
them**.

## Moving up: the feeder relationship

The pyramid is not sealed. **A generation's outstanding disciple is selected upward.**

That is the legitimate route out of a small sect, it is rare, it is competitive, and it is
the single most consequential thing that can happen to a promising cultivator - which is
why inter-sect competitions matter enormously to everyone except the people at the top,
for whom they are recruitment.

The detail that makes this land, and it must not be softened:

> **You arrive at the higher sect at the bottom.**

Whatever you were below - core disciple, prodigy, the one everyone had heard of - you enter
the parent institution as its lowest rank, among people who have been there for a century
and regard your old sect as a farm. Your reputation does not travel. Your rank does not
travel. Your contribution certainly does not travel.

It is a promotion that feels exactly like a demotion, and it should. The player who worked
twenty years to be selected should spend their first month being nobody again, and the
world should be entirely unapologetic about it.

## At the top, rank stops tracking realm

Small sects rank by cultivation, because cultivation is all they have to rank by.

**Apex institutions do not.** Everyone below a high realm is simply *a disciple*, and
standing inside that vast undifferentiated class is decided by something else - service,
sponsorship, results, an assigned mark of station that has nothing to do with your qi. A
Core Formation cultivator can be junior to a Foundation Establishment one and there is no
contradiction, because the thing being ranked was never their power.

This is the most disorienting thing about arriving, and it is worth playing straight: the
one number the cultivator has spent their whole life raising suddenly does not determine
where they stand.

## Guest elders

There is a third relationship besides member and outsider: the **guest elder** - a
powerful cultivator affiliated with a sect without belonging to it, providing services in
exchange for resources or protection, and keeping their independence.

Useful because it gives a sect access to power it does not own, and gives a strong
individual a patron without a lifetime of obligation. Both sides know it is transactional.
Both sides are usually right to be slightly nervous about it, and a guest elder walking out
during a crisis is not a betrayal in any way anyone can formally object to.

## The unbacked

Not everyone is in the stack. Some sects hold no vein from anyone, answer to nobody, and
pay for it continuously.

What being unbacked actually costs:

- **Nobody arbitrates for you.** Inside the pyramid a dispute goes upward and somebody
  rules on it, usually badly and usually late, but it gets ruled on. Outside it, a
  disagreement is settled by whoever is stronger, immediately.
- **Your talents have no route up.** No parent means no selection, so a genuinely gifted
  disciple either stays and wastes it, or is poached - and poaching an unbacked sect's
  best disciple costs the poacher nothing, because there is no patron to offend.
- **You are the obvious thing to absorb.** When a backed sect needs to show growth, it
  takes from the people with no one to complain to.
- **Your qi is whatever you can hold.** No granted vein, so: a poor one nobody wants, a
  contested one you defend continuously, or none, and you buy stones like everyone else.

How they survive anyway, and each of these should exist somewhere:

- **Too poor to be worth taking.** Absorption costs something; being not worth the cost is
  a defence, and a humiliating one to rely on.
- **Too remote.** Distance still works in a world where travel is slow and most powers are
  administering a river, not a map.
- **Useful to everyone and aligned with no one.** A sect that repairs formations, ferries
  goods, or treats injuries can be worth more unowned than owned - and knows it, and
  trades on it carefully.
- **Holding something.** A dormant ancestor, a unique art, a site nobody else can operate.
  Nothing deters absorption like an unknown quantity under the mountain.
- **Under an arrangement that is not patronage.** A standing agreement with a Dao house, a
  guest elder who would be annoyed, an old oath somebody still honours.
- **Simply not worth the trouble yet.** The most common answer, and the least comforting.

**Independence is a real value and a real vanity.** Some unbacked sects are proud of it,
say so, and are respected for it in a slightly pitying way. Others are unbacked because
they were thrown out, or because their patron was destroyed and nobody picked up the
lease, and would take a backer tomorrow if one were offered.

For a player, an unbacked sect is the most *available* institution - lower admission bar,
faster advancement, genuine responsibility early - and the ceiling arrives sooner and
harder than anywhere else. Rising fast in a sect with nowhere to send you is its own kind
of trap.
