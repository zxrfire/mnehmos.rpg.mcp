# Making places and factions feel different

<!-- tier: 3 -->

An authoring guide, not narrator material. Tier 3 throughout: never auto-injected, read
by humans and by agents writing a new region, faction, or compound. The in-play facts it
produces reach the narrator through `qi.md`, `sects.md` and `architecture.md`.

An authoring guide. Read before writing a new region or faction.

The failure mode this exists to prevent: every province is "sects, mountains, a market and
some ruins" with the proper nouns swapped, and every sect is "an alignment, a rank ladder
and a rivalry". Both are technically populated and completely interchangeable.

## Regions

### The strongest lever: a different framework, not different furniture

The most effective way to make somewhere feel genuinely other is to change **how
cultivation itself works there**, not what the local sects are called. A place with its
own method, its own way of measuring progress, or a path that simply does not exist
elsewhere is unmistakable from the first paragraph.

**One ladder, always.** This is a hard constraint, not a preference. There is a single
realm ladder and `realmOrdinal` is universally authoritative. A region's fourth stage
*is* Core Formation, whatever the locals call it, and the engine never carries a second
progression system, a parallel scale, or a conversion table between ladders.

What varies is the **vocabulary and the method**, not the rungs:

- **A different method.** Somewhere that reaches the same ranks by something other than
  drawing ambient qi - through carving, through beasts, through inherited debt, through
  cold, through a substance the rest of the world regards as waste. Same ordinals,
  different road.
- **A different name for every rank**, and a local theory to go with it. Locals may deny
  the equivalence outright - insisting their third stage is nothing like Core Formation -
  and be wrong, or be pointing at something real that the standard vocabulary flattens.
- **The translation is the content.** Outsiders map local ranks onto the ladder, the
  mapping is contested, scholars disagree, and a confident mismatch gets people killed.
  A visitor who reads a local title as one rank lower than it is has made an ordinary
  and fatal mistake.
- **A path that exists nowhere else**, because the thing permitting it is local and
  cannot be moved. It still climbs the same ladder; it just has a door nobody else has.
- **A missing path.** Somewhere an entire discipline is impossible - no formations work,
  or nobody can body-temper, or alchemy will not hold - so local cultivators reach the
  same ranks lopsidedly, and are strange to fight.

Mechanically all of this is expressed as **modifiers over the shared ordinals**: different
rate curves, different deviation risks, different bottlenecks, different insight
opportunities, different costs. Never a second ladder.

### Two traditions, one ladder

Stronger than local vocabulary, and the thing worth building toward: a world can hold
**two genuinely different cultivation traditions at once**, and the difference between
them can be the oldest quarrel in it.

The constraint is unchanged - **one ordinal ladder**. Both traditions climb the same
rungs and a fourth-stage practitioner of either is Core Formation. What differs is not
the scale but the **affordances**:

- **Different method**, so different bottlenecks, different deviation risks, different
  costs. Same ranks, arrived at sideways.
- **Different metaphysical properties**, which is the part with real mechanical teeth.
  The existence states are not uniformly available: one tradition may be unable to take
  another body but able to rebuild its own from an intact soul, while the other can do
  the reverse. Two cultivators at the same rank can therefore have *entirely different
  answers to being killed*, and knowing which you are facing is worth more than knowing
  their rank.
- **Recognisable on sight.** A practitioner of one tradition should be identifiable to a
  practitioner of the other immediately - bearing, presence, what their qi does in a
  room. No investigation required; it is the first thing anyone notices.
- **A war behind it.** The two traditions are not neighbours who differ politely. One
  arrived, or one was here first, and the conflict reshaped the map - a coastline, a
  scattering of continents, a border that is a scar. The geography still records it, and
  both sides teach a different account of who started it.

**Walking both is exceptional.** It should require something unusual - an artifact, an
inheritance, a physical peculiarity, an accident - and be rare enough that most
practitioners of either tradition have never met someone who did. A dual practitioner is
not simply stronger; they are *strange*, and both traditions have opinions about them.

Do not build a third tradition. Two is a quarrel; three is a taxonomy.

### One governing fact

Give a region a single physical fact that everything else follows from, and derive the
rest rather than listing features. *The vein runs vertically, so the powerful live
downward and status is depth.* *Nothing rots here, so the dead are furniture.* *The qi
comes in tides, so cultivation is seasonal and the whole society is built around a
calendar.*

A reader should be able to hear the governing fact and predict three other things about
the place.

### Commit to one register

Pick a sensory identity and hold it: what it smells of, what the light does, what sound is
always present, what colour dominates, what the food is. A region that is *white and
silent* and a region that is *red and loud* are distinguishable in one sentence, and every
scene inherits it for free.

### Vary the things that are easy to leave uniform

- **Social organising principle.** Nineteen competing sects is one model. A single hegemon
  with patronage instead of rivalry is another. An auction house that outranks every sect.
  Clans with no sects at all. Wandering individuals and no institutions worth the name.
- **Relationship to death.** Burial, burning, keeping corpses, feeding them to something,
  or refusing to acknowledge it.
- **The local taboo** - the thing you must never do here, which visitors do by accident.
- **The threat model.** Somewhere the danger is beasts; somewhere it is people; somewhere
  it is the ground itself; somewhere it is a formation nobody can turn off.
- **Naming conventions.** Names from one region should be audibly not from another.
- **Time.** How long a day is, how a year is counted, how long people expect to live.

### Contrast beats addition

Two regions that differ sharply are worth more than five that blur. When adding a place,
the question is not "what else could exist" but **"what does crossing this border change
about how you live"** - and the answer must be concrete enough to write a scene about.

## What is true of a place right now

Everything above is a place's permanent character - the things that are true of it in
every century. The other half of making one province not another is that **things are
true of a place for a while and then stop being true**: a famine, a pass shut for the
winter, a beast tide running, a district worked out, a blockade, a war on the ground a
house stands on.

That layer is
[`what-is-true-of-a-place-right-now.ts`](../../../src/engine/world/what-is-true-of-a-place-right-now.ts),
and its own header carries the mechanics. What belongs here is what an author has to
decide when writing one.

### The causation direction is the whole point

**Mundane goods are never counted.** Nobody tracks how much grain a province holds, and
consumption does not move a mundane good. A thousand travellers buying meals does not
cause a famine. **A famine causes the meals to stop.**

So when you want somewhere to be short of something, do not write a quantity. Write the
event, and let availability be read off it. The status carries what is simply not to be
had here while it is true, and there is no ledger behind that list.

This is also the boundary with counted stock, which is a different thing and is counted:
cultivator materials in a district are a number that goes down when people take them.
*That district being worked out* is the status; the count reaching bottom is not.

### Four things to decide, and one of them is the one that gets forgotten

- **What is true**, in the sentence the world says about the place.
- **What caused it.** Always. A status that appeared from nowhere undoes the rule that a
  beast tide is a symptom of something that changed on the ground - and that the houses
  which treat one as a monster problem rather than a survey problem are the ones it
  happens to twice. Two kinds of cause exist and they are the same field: **a war is
  caused by somebody choosing, a drought by nothing choosing.** Fill in who decided it,
  or leave that empty. Nothing in the engine branches on which you wrote.
- **What was visible beforehand.** The ordinary animals went first and went far. Measured
  output fell before anything was seen and was filed as a survey error. Herds that do not
  share ground were seen sharing it. These are what anybody who reads ground can observe
  while understanding nothing about why, and they are the difference between a world that
  surprises people and a world that ambushes them.
- **When it is looked at again.** This is the one that gets forgotten, and forgetting it
  is worse than leaving the status out: a famine that never lifts is a worse bug than no
  famine. The date is not a promise about when it stops - a war has no such date - it is
  the day somebody decides whether it is still true.

### What is true, what is visible, and what anybody has worked out are three things

Write all three separately and never collapse them. The status is the truth; the signs
are what is observable; and what a given person has worked out is `KnowingStage` in the
social layer, which is the only knowledge ladder in this repo and must not acquire a
second one.

The important flag is whether **anybody local has worked the cause out**, which is
usually no. That is a ceiling on hearsay rather than on truth: asking around gets a
visitor as far as the signs, and somebody who wants the reason has to go and read the
ground themselves.

**And what a status DOES is not gated on any of it.** A famine stops the millet for a
traveller who has never heard the word. Knowing buys the reason, the warning and the way
out - never the effect.

### It has to be sayable

A place where something is wrong says so in prose. It never silently returns different
numbers and leaves somebody to work out why the millet cost four times what it cost last
year.

## Factions

A faction needs more than alignment, a rank ladder and a rivalry list.

- **A practice you can see.** What their disciples' hands look like. How they greet. What
  they eat. What they refuse to do that nobody asked them about. The thing an outsider
  notices in the first ten minutes.
- **A grievance and a fear.** What they think was taken from them, and what they are
  quietly afraid of. Both drive behaviour without being announced.
- **A specific way of being late.** Every institution here is operating a fraction of what
  it inherited. *Which* fraction is character: nine formation nodes of forty-one lit, a
  library they can no longer read, a rank whose duties nobody remembers, a hall built for
  two hundred holding eleven.
- **An internal disagreement.** A faction that agrees with itself is scenery.
- **Something they are wrong about.** A belief they hold with complete confidence that is
  false, and traceable.
- **A different unit of value.** One counts spirit stones, one counts favours owed, one
  counts names on a wall, one counts years of service. This alone changes every
  negotiation they enter.

## The test

For a region: *name three things that are true here and false one province over.*

For a faction: *describe them in one sentence that could not be said about any other
faction in the catalog.*

For a status: *name what caused it, what somebody standing here would have noticed
beforehand, and the day the world looks at it again.*

If any of the three is hard, the thing is not finished.
