<!-- tier: 2 trigger="the player is near, entering, researching, buying access to, or asking about a ruin, a sealed site, an old compound or a convergence" -->

# Ruins

An authoring guide, in the shape of [`making-places-different.md`](making-places-different.md)
and [`ancient.md`](ancient.md). Read it before you add a ruin, and before you narrate one.

**The failure mode this exists to prevent:** the anonymous untouched hole. A map of
identical sealed doors with loot behind them, differing only in the size of the number.
That is a dungeon, not a world, and it is what ruins were before this document.

The organising principle is the same one that makes
[`inheritance-trials.ts`](../../src/data/cultivation/inheritance-trials.ts) work:
**variety**. No two trials test the same thing, and no two ruins should be the same kind
of place. What follows is the set of axes that make them differ, and every one of them is
a column the engine already reads.

---

## The four axes

<!-- tier: 2 trigger="a ruin is being described, compared, or chosen between" -->

A ruin is not one number. It is a point in four independent spaces, and almost every
combination is a different game.

| Axis | Question | Where it lives |
|---|---|---|
| **Provenance** | How much is knowable about **who left it**? | `provenance.ts` - `documented` / `attributed` / `rumoured` / `anonymous` |
| **Depletion** | How much has already been **gone through**? | `provenance.ts` - per wing: `untouched` / `probed` / `picked_over` / `stripped` |
| **Age** | How long ago did it **stop being lived in**? | `provenance.ts` - `new` / `old` / `ancient`, derived from its own change history |
| **Control** | Who holds the door **now**? | `provenance.ts` - `unclaimed` / `held_on_paper` / `held_on_the_ground` |

**They are independent and the code keeps them so.** A site whose builder is named in
somebody's records, picked over twice, with one sealed wing nobody has opened, inside a
prefecture a house holds on paper only, is a far better place than an anonymous untouched
hole - and it is four ordinary field values, not a special case.

`identifyBuilder` never reads wing state and `wingsOf` never reads provenance. If those
two ever cross, the axes have collapsed back into one and the guide is broken.

### Reading a ruin is a skill, and it is not a realm

<!-- tier: 2 trigger="somebody tries to identify who built a site, or the player meets an expert reader" -->

Somebody with the learning looks at a site and names the house that built it. Somebody
without stands in front of the same wall and cannot. The read runs through
`assessCapability`'s `understand` predicate, where **comprehension keys are absolute** -
so a scholar with the right notes places a ruin that a cultivator four realms above them
cannot. That is a genuinely different kind of cultivator, and it is the first mechanical
edge that belongs to a [dao house](dao-houses.md) rather than to a fighting sect.

Two rules that keep it honest:

- **A failed read is informative, never blank.** Anybody sees that it is old, that it is
  large, and that somebody built it. What a failed read returns is *the name of what is
  missing* - "somebody's archive names the house that built this; you would need the
  reading, or somebody who has it." That is an instruction to go and find a person, not a
  wall.
- **Placing the builder never hands over the contents.** It hands over **habits**: what a
  house like that valued, how it built, where it would have put the things worth sealing.
  That narrows the search and prices the risk. It cannot tell you the vault is still full,
  because somebody may have been through it last century - which is precisely why the two
  axes are separate.

### Knowledge follows engagement, not altitude

<!-- tier: 2 trigger="what a house or person knows about a site is in question" -->

The sharpest thing in this document, and the one that cuts against intuition.

**The strongest power in the region may know less about a given ruin than a middling house
three provinces away**, because that house has been sending people in for two hundred
years and the apex has never once looked. Height is not omniscience. What a house knows is
the residue of what it has *done*.

So ruin knowledge is a **relation** - this knower, this site, this much - and never a
global flag on the site. A ruin thoroughly documented by one house and a complete blank to
the strongest power in the world is the normal case.

It also makes a **wrong answer** possible, which is much more interesting than a scale
running from ignorant to correct. A house with one expedition's worth of engagement holds
a confident, partial picture and will brief its disciples on a site it has seen a tenth
of. `knownAxes` calls that `confidentlyPartial`.

---

## Convergence: a ruin is not a place you can go

<!-- tier: 2 trigger="a ruin's window is opening, closing, or being waited on" -->

**It is a place that is periodically reachable.** The window opens, it is short, and if
you are still inside when it closes you are inside until it comes round again - which for
most sites is longer than most cultivators have.

`OpeningCycle` has been on `LocationRecord` since the location layer was written.
`convergence.ts` is what it is *for*.

- **The clock is hard.** Every day inward is a day you must also spend coming out, so the
  deepest anybody can be and still walk out is half the remaining window. The decision is
  continuous rather than made once at the entrance, and it is a much better pressure than
  a monster.
- **Overstaying is not a hazard, it is arithmetic.** `resolveOverstay` compares the period
  against what the person has left. A cultivator for whom four centuries is a nap survives
  it and comes out into a world that did not wait, which is a good outcome and a rare one.
- **Nobody ever clears a ruin.** The far rooms are not guarded; they are out of reach of
  anybody who also intends to leave. That is why sites are picked over and never emptied,
  and it means the sealed wing nobody has opened is often simply the one furthest from the
  door. **The loot is bounded by geometry, not by a rule.**

### The escape hatch is real, and self-cancelling

<!-- tier: 2 trigger="somebody is trapped by a closing window, or claims they can leave anyway" -->

There is a way to leave late. `spatial_folding` is a Void Refinement capability grant,
written long before any of this. Two of its properties do all the work:

- **It is high.** Somebody who can fold space is not a person who explores ruins. So the
  way out exists, is real, and **is never available to the person who needs it.**
- **It is short-range**, and distance is what a waning convergence spends. The reach
  scales with how much of the window is left, so it narrows exactly as the situation gets
  worse and reaches zero at the close. **It fails precisely when it would matter most.**

Do not add a consumable version of this. An item that folds space on demand is the same
mechanic with its teeth pulled.

### But somebody might come for you

<!-- tier: 2 trigger="the player is in trouble somewhere and has powerful connections" -->

The rule above is about your own capability. It says nothing about anybody else's, and
somebody who *is* that high might come and get you. `rescuersFor` answers "would anyone",
off the relationship rows that already exist.

**This turns a relationship into a survival asset** - not reputation points, but the
difference between dying in a sealed wing and walking out. The precondition is the whole
mechanic: a master's interest in a student, a debt, a house protecting an investment, an
oath. Each is a different answer and a different price.

Three things keep it honest:

1. **It is legible in advance.** You can ask before you go deeper, which is what makes
   staying one more day a decision instead of a gamble. Somebody with no such tie is
   playing a much tighter game and should feel it.
2. **They may not come.** Qualifying is not committing. And a late call fails on geometry,
   because the reach they are crossing is the same waning distance.
3. **It costs.** A rescue **opens** an obligation rather than settling one. Afterwards you
   owe somebody who can reach you anywhere.

### The schedule is its own kind of knowledge

<!-- tier: 2 trigger="the timing of an opening is being sold, guarded, or guessed at" -->

Placing the builder tells you what is inside. Knowing the cycle tells you *when you can
go*. Two different scholars, both worth having, and neither substitutes for the other - a
properly equipped expedition is three people rather than one person with three advantages.

---

## Loot is a record, not a table

<!-- tier: 2 trigger="the player is searching a site, or wondering why the entrance is bare" -->

**The gradient is not authored. It is inherited.** Everybody who came before faced the
same clock: in, take what is near the door, out before it shut. So the shallows are bare
and the value is deep.

**And only where people have been.** This is the qualifier that matters:

```text
known, visited often    shallows stripped, value deep. The gradient at its steepest.
known, rarely reached   partial - somebody got in once and took what was by the door
unknown, never found    NO GRADIENT. Value sits wherever the builders left it,
                        including at the entrance.
```

Which makes the first chamber **evidence**, readable by anybody with no scholarship at all:

- **A stripped entrance says people have been here.** Truer than any record.
- **An untouched entrance in a *known* ruin is alarming.** Everybody could have come and
  nobody did - or nobody came back. `firstChamberTells` deliberately declines to pick
  between those two readings, because the world does not know either.
- **An unknown ruin with value at the door is the find of a lifetime**, and the player
  knows it in the first minute without being told.

**Deeper is different in kind, not merely dearer.** The shallows hold what is portable and
obvious. The depths hold **what somebody sealed rather than carried** - still there not
because nobody wanted it, but because taking it was never the fast part. The deepest room
is the last thing anybody ever reached, which is where the ancient tier's finite placed
stock belongs.

---

## Not every ruin is ancient, and the world makes more of them

<!-- tier: 2 trigger="a recent disaster has left a site, or a ruin's age is in question" -->

A sect destroyed last century is a ruin. The differences fall out of the other axes rather
than needing to be authored:

- **Its provenance is usually documented**, because people watched it happen. A new ruin
  needs no scholar; an old one is unreadable without.
- **It holds modern wealth.** Somebody's treasury, ordinary elemental manuals, their
  stores. No extinct material, because the people who lived there were of this age.
- **It may have no convergence at all** - a place you can simply walk to. That is the
  sharpest mechanical difference between new and ancient, and it is the reason to go to
  the ordinary one.
- **Somebody alive may have been there before it fell**, which is a source of information
  no ancient ruin can have.

**And the world's own events create them.** A house destroyed, a seat abandoned, a
headquarters a protector was spent on - each leaves a place. The set of ruins is not fixed
at seeding: measured over 500 years, a seeded world goes from 12 ruins to 32. A player who
secludes for a century comes out to find somewhere that did not exist when they sat down.

---

## Access: disciples only, a fee, or a task

<!-- tier: 2 trigger="a house controls the way in, and the player must pay, join, or serve to enter" -->

A known site on a predictable cycle inside somebody's territory is an **asset**, and a
house that can reach it decides who goes in.

- **Disciples only** is the strongest concrete argument for joining a house this game has.
  Not a rate multiplier - access to somewhere nobody else may go.
- **A fee**, priced against what a cultivator at the bottom actually earns, and the first
  thing worth spending stones on that is not consumed.
- **A task**, which is the interesting one: it does not close when you come out. A house
  that sends you in on their errand has an interest in what you find. It also means
  somebody with no standing and no money can still get through the door, which keeps the
  whole system from being a pure wealth gate. Model it as a duty, never as a new
  mechanism.

**Charging is not controlling.** `regions.ts` separates what a house holds `onPaper` from
what it holds `onTheGround`. A ruin in a catchment somebody holds on paper only is the
best case in the set: they will bill you and they cannot stop you. Going in anyway is a
whole style of play, and it composes with the clock - because the holder knows the
schedule too.

**An unclaimed ruin is precious**, and the reason nobody is charging you is itself
information.

---

## A stripped ruin is empty of things and full of understanding

<!-- tier: 2 trigger="the player enters a site everybody agrees is finished" -->

The one destination in this game that asks nothing of you.

Comprehension **cannot be looted**. [`understanding.md`](understanding.md) is explicit that
insight cannot be bought, granted by rank, or handed over - so a site that has nothing left
to take still has everything it ever had to *understand*, and the hundredth visitor gets
exactly what the first one did.

This matters beyond the theme. Almost everything else in this setting is gated on being
somebody: backing, standing, a stocked inheritance, a person who would come for you. **A
safe, exhausted, well-known ruin is a real option for somebody at the bottom**, and it is
the sort of place a poor cultivator would actually visit.

Two things to keep honest:

- **"Deemed safe" is a judgement, not a fact.** The world believes it is safe because many
  people have come back, which is evidence and is not proof. The reputation and the
  thresholds are stored separately and are allowed to disagree. Preserve the rare case
  where the assessment is wrong.
- **What is comprehended is about the place.** A manual teaches a method; a ruin teaches
  what happened *in it* - the house that fell, what they were doing, what killed them. So
  two different ruins do not teach the same thing.

---

## Mechanics that change the terms

<!-- tier: 2 trigger="the player is inside a site that does not behave like an ordinary place" -->

> **A ruin mechanic changes the terms of engagement. It does not add a number.**
> It changes **what the player knows**, **what they are**, or **what the rules of the
> place are**.

A trap is a subtraction from hit points and the encounter layer already prices those.
`ruin-mechanics.ts` holds four that pass the test, and all four are engine-resolved and
deterministic - same seed, same maze, same routine, same era.

**The map records rooms, not the relationships between rooms**, because nobody can tell.
Knowledge of a site is a set of nodes with no reliable topology. A bought map is genuinely
useful - it tells you what chambers exist and which are worth arriving at - and genuinely
insufficient, because the edges are unrecordable. The map is **not lying** and the ruin is
**not shuffling**; both of those would be worse. This is why a much-visited site is never
solved: everybody learns the nodes, nobody learns the edges.

**Wearing somebody else's name, in their own era.** Each person takes a body and lives the
place as whoever that was, when it worked - with a rank and obligations that are not
theirs. This is a documented route to a material-gated ancient art, so the engine is exact
about what comes back: **comprehension does**, because it is in the person; **objects do
not**, because the hands are not yours; and **the identity does not come off clean**,
which is the cost, paid on `identityContinuity`. It refuses on a new ruin - there is no
past to stand in that people are not still alive to be asked about.

**The only light is your own qi**, so exploring depletes exactly what the expedition came
to gather, and somebody who spends everything reaching the vault has nothing left to take
it out with.

**The dead are still keeping to a routine**, and what fails is interrupting rather than
fighting. It is a function of the day, so it can be observed once and relied on - which is
what makes it a routine rather than a patrol. And **the place remembers**: it greets a
returning visitor by name and gets the count right, which is the one mechanic here that
grows more unsettling the more competent the player has been.

---

## The variety test

<!-- tier: 3 -->

Before you commit a ruin, answer this in one sentence:

> **Name what this ruin asks of a visitor that no other ruin asks, and say which axis
> makes it so.**

If the answer is "it is harder" or "the reward is better", you have written a room with
loot in it. Go back to the four axes and move one.

Good answers look like:

- *"It asks you to know somebody, because the window is nineteen days and the vault is
  eleven days in."* - convergence.
- *"It asks you to bring a scholar, because it is anonymous and the trials were cut for a
  rung the entrance does not advertise."* - provenance.
- *"It asks you to explain to a house why you were inside their claim."* - control.
- *"It asks nothing. It is stripped, safe, four days' walk, and it is the only place a
  Qi Condensation cultivator can go and come back understanding something."* - depletion.
