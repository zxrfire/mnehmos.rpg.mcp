# How many people a house has, and who they are

Who the engine models of a sect, how they are arranged, and what the words
mean. The rule lives here rather than in `AGENTS.md` because it is about this
world rather than about working in this repo; `AGENTS.md` links to it.

Read alongside:

- `src/data/cultivation/README.md` - the catalogs this is read from: `ranks`,
  the postings a house holds, `GUEST_ELDERS`, and `THE_OFFICE`
- `src/engine/world/README.md` - the passes that seed a house's people and move
  them about afterwards

> **A roster is who a player could come to know. It is not how many the house has.**

Both numbers are true and they answer different questions. The sect's real size
is what the **prose** says; the roster is what the **engine** holds. The design
owner:

> *"a sect probably has hundreds of outer and 100 inner, but you really only
> interact with a few."*
> *"think, ur in a company, even if it's huge, you only know like 10-20 people
> tops. same idea."*

A reader who finds a house with four outer disciples on its roll has not found a
house of four people. They have found the four a player would meet. This is
`theWorldForgetsTheMortalDead` one level up: **the engine models what can be
played with.** Do not "complete" it.

**And the arithmetic is the other half of the argument, for when somebody
proposes a more realistic roster.** Thirty-eight houses at five hundred members
each is nineteen thousand people. The world holds about eight hundred and fifty
today, and three thousand simulated years of it already takes half an hour to
soak. Twenty-two times that is not a richer world, it is a world nobody can run
a test against - and every one of those rows would be a person no player ever
meets, drawn by a pass, aged by a pass, killed by a pass and swept by a pass.

So the slice is not a compromise forced by performance, and it is not
performance dressed as design either. The two reasons agree: **the people worth
computing are the people somebody could meet**, and it happens that computing
only those is also the only version that runs.

## The size

**Ten to twenty modelled people per house**, and it is a guideline rather than a
number to hit - *"this isn't a hard rule"*, *"some can have more some can have
less"*. An apex may run richer; a guard posting may hold three. What matters is
that a figure is chosen for what a player can hold in their head rather than for
what a sect would really have, and that **houses still differ from one another**
for reasons the catalog already states.

Before tuning any bound that governs parties or postings, check whether the
roster is the thing that is wrong. The owner: **"3 people out is fine if the
sect has 15 people."** The same party that looks like a house emptying itself at
a roll of 7 is an ordinary errand at 15.

## The shape: narrow at the bottom, complete at the top

A sect's hierarchy really is a pyramid. **A roster is not that pyramid - it is a
narrow vertical slice through it**, because that is the shape of what one person
knows:

> *"your skip skip or skip skip skip in a company manages like a BUNCH of
> people. you know your skip skip and skip skip skip but not everyone they
> manage, so it doesn't have to be strictly pyramidal, just vaguely."*

**The slice keeps the pyramid's shape because it is DRAWN FROM one.** The owner:
*"you SEE a thin slice, but that thin slice is made from the population
pyramid."* That is why a roster comes out bottom-heavy without anybody
enforcing it, and why the aggregate across every house is a pyramid nobody
computed. The pyramid is the population; the slice is a sample of it; the
sample inherits the shape without the engine having to instantiate the
population to get it.

Which is also the whole economy of the arrangement. Sample from a pyramid and
you get the narrative shape of a pyramid for the cost of a dozen rows a house.
Instantiate the pyramid and you get the same shape for nineteen thousand.

So the roster is two different things stacked, and they are **not** governed by
the same rule:

- **The bands are SAMPLED.** Outer, inner, core. A few out of hundreds, because
  those are who a player happens to meet. Vaguely pyramidal - more low than
  high - and never a strict taper.
- **The postings are COMPLETE.** Everyone in a sect knows who the punishment
  elder is, so a player must be able to deal with them. Not sampled, not
  tapered, not conditional on how big the roll is.

An empty middle is the failure this section exists to prevent. Measured once:
a seven-rung ladder gave rung 3 its first seat at a roll of 26 and rung 5 at
162, so **rungs 2 to 5 were empty in every house in the world** while the ladder
looked correctly shaped. The middle is where the genre lives - inner and core
disciples competing, being passed over, being promoted - and it is load-bearing
for the conclave and slot designs, where choosing three people for a place means
little if the choice is between outer disciples and elders with nobody between.

`sects.ts` already warns about the cause in its own header: **"`elderRungOf`
reads this shape: the elders are the top three rungs, floored at index 2...
Nothing should re-derive it from a fraction."** A rank population computed as a
proportion of the roll is the defect.

## The words

The design owner's definitions, which are exact and should not be paraphrased:

> *"an office = an elder with a posting"*
> *"an elder = a rank"*
> *"a protector = a rank"*
> *"a guest elder is an external elder without an office"*
> *"an external elder joining is just an elder"*
> *"non office holding elders don't have to exist"* - **it MIGHT**

| word | what it is |
|---|---|
| **rank** | a position in the order of precedence. Outer, inner, core, elder, and so on. `ranks` on the catalog row |
| **posting** | a job somebody does - punishment, discipline, a conclave seat, a watch in a town. Named per house by the catalog, and **not an elder's thing**: see below |
| **office** | **an elder WITH a posting.** The pairing, not a third category |
| **elder** | a rank. On the roll, posting or no posting |
| **guest elder** | an **external** elder with no posting, **typically of another tradition** - somebody who does not practise your sect's arts. Deliberately **not on the roll**: `GUEST_ELDERS` carries a `traditionId` saying exactly that, and `travel-verbs.ts` already states guests are not in the house's roll |

Three consequences, each of which someone has tried to model as a special case
and none of which is one:

1. **What must be occupied is a sect's POSTINGS.** The occupant is an elder by
   construction, so there is no separate seniority rule to write.
2. **An elder with no posting needs no flag.** Not required, **not forbidden**.
   *"It might."* A rule that removes them is the same error as one that demands
   them, with the sign flipped.
3. **An external elder who joins is just an elder.** No hybrid, no
   guest-holding-a-post. Being a guest was only ever the state of having no
   posting, so taking one ends it and nothing converts.

   **But joining is gated, and the gate is the arts.** A sect has arts it
   prefers - `teaches` on its catalog row - and an elder teaches juniors, so
   somebody who cannot teach the house's shelf cannot hold a posting in it. The
   owner: *"if they become an elder, they obviously ought to practice your
   sect's arts... doesn't make sense for an elder elder to be unable to teach
   the sect's arts to juniors."* **That is why a guest stays a guest**, and it
   is the same rule as the copy gate elsewhere in this engine: you pass on only
   what you have taken to its end.

   `GUEST_ELDERS` shows the arrangement working and its price. Shen Yiao sits at
   the Azure Cloud Pavilion, has drawn a blade for them twice in forty years,
   and takes cave rent and silence in return - while the row's own `hostRisk`
   says *"she is stronger than the Pavilion Master, is not bound by its rules,
   and the disciples have begun going to her rather than to the Sword Elders,
   which nobody has said out loud."* A guest is useful, unbound, and not a
   member.

It is the military arrangement: rank is what you are, a posting is what you do,
and a Colonel between commands is still a Colonel.

**And a posting is not an elder's thing.** Juniors hold them too - **the gate
guard**, a disciple sent to sit in a town and watch, the sect missions where
somebody is the house's eyes. An office is an elder with a posting; a posting
on its own is just a job, and anybody can be given one.

**A posting rotates, and the post is the continuous thing rather than the
person.** The catalog's Frostmirror watch reads as one person standing in a
town for a hundred and ninety years and it is not: *"it's one but not
necessarily the same one... they never advance cuz they get swapped out for the
next Core Formation disciple."* One body in the post at a time, changed out
when they outgrow it, and the watch unbroken behind them. A tour can still run
decades, because Core Formation is a long realm.

**What is shared is that the post outlives the person. What ends a tour is
not the same at both ends of the ladder:**

- **a junior leaves a posting by OUTGROWING it** - they advance, and advancing
  is what takes them out of the chair. Nobody advances in the post because
  that is the exit
- **an elder holds a posting until they GIVE IT UP** - the owner: *"elders are
  typically until you wanna give it up."* Tenure, not rotation. It ends when
  they stand down, or when they die

So a pass that fills posts can share its filling, and must not share its
emptying. A junior's chair comes free on a breakthrough; an elder's comes free
on a decision or a death - which is also why the covering question matters more
at the top: an elder's seat empties without warning.

**The Kiln Wardens and the Deeproot Court are rotations too, and that is
already modelled - do not restate it here.** `PostingSchema` in
`src/data/cultivation/governance-and-water-rights.ts` is the record: who may
appoint, what a posting is worth from below and from above, where an appointee
goes afterwards, what being passed over does, and what a completed term buys in
a promotion queue. The schema's own header explains why those two bodies are
the exception and why the schism was possible at all - *"a posting is a thing
that can be reposted. A sect cannot be."* Read it there.

**The gate guard is the one to keep in mind, because a measured bug already
depends on it.** A house with nobody on the gate tells a visitor *"nobody of the
house is out here to ask"*, and that was found by a test failing rather than by
anybody looking. So "a house keeps somebody who could host a guest" is not a
special rule about hospitality - **it is the gate-guard posting being filled**,
which is the same rule as every other posting. If a house cannot answer its own
door, look for an empty posting before inventing anything.

**Most outer and inner disciples have none.** A posting on a junior is the
exception and should stay one - the owner: *"most outer and inner disciples
don't, only few do."* Treat it the way the bands are treated: a few out of the
sampled many, rather than a property everybody carries. If a pass finds most of
a house's juniors posted somewhere, that pass is wrong.

## `protector` is a rank, it is not an office, and it is outside the chain

**A protector has no posting**, so it is not an office and no posting rule
reaches it. What it is instead, in the owner's words:

> *"well the sect patriarch can't really order the protector around"*
> *"but neither can the protector order the sect patriarch around"*
> *"the protector just has one job and answers to the survival of the sect as a
> whole. hence, outside."*
> *"but in prestige it's equal to patriarch or higher"*
> *"(protector is usually stronger too, maybe a retired patriarch)"*

So a protector is **outside the order of command in both directions**, and **at
or above the patriarch in prestige**. Two different axes, and they must be kept
apart: command is who may order whom, prestige is what somebody is worth being
seen with.

**Which means `sects.ts` reaches the right conclusion by a reason it states
wrongly.** Its header keeps the protector's chair out of `ranks` because *"an
office is not a position in an order of precedence"* - and a protector was never
an office. But it genuinely does not belong in `ranks`, because `ranks` is a
chain of command and a protector stands outside one. **Leave it beside the
ladder.** Correct the sentence if you like; do not move the arrangement to
match it.


And before touching anything protector-shaped, read `THE_OFFICE` in
`src/data/cultivation/false-immortals.ts`. The word does two jobs. At an
ordinary sect it is a strong veteran who stays in the compound - *"the dude who
comes to your sect in the time of need"* - and it is filled and unremarkable. At
the top of the world it is **reserved** for a False Immortal and has stood empty
for eight hundred years on purpose:

> *"a house with a vacant protector's chair is not short of strong people, it is
> declining to pretend that a strong person is the same thing."*

So an empty protector's chair is content, not a gap. Do not fill it, cover it,
or promote into it. That entry also records an earlier draft getting this wrong
by re-deriving a chair from a crossing count, which *"counts departures and
vacancies together, and the two are opposite outcomes."*

## A chair that is not there is not a chair

Slots are finite and strength does not manufacture one. The design owner, asked
whether a curated figure's stated rank should be exact or a floor:

> *"i mean, if there's no slots, there's no slots?"*
> *"maybe you have an op guest elder with no slots (so they get pushed out) and
> they just stay as a no office elder"*
> *"or they wanna leave"*

So a stated rank stays a **floor** rather than becoming exact. The floor cannot
invent a seat, because the seats are capped independently - a house keeps up to
three elder posts and never more than the band below it holds. Somebody strong
arriving where there is no room does not displace anybody and is not promoted
into thin air. They are an elder without an office, or they go.

**And going is the half that is not built.** `why-somebody-walks-out-of-a-
compound.ts` has the right reason in it - `'nothing in the hall is theirs'`,
whose own comment reads *"No room, no office, and nothing in the purse"* - but
its condition is `factionRankIndex <= 0 && spiritStones < NOTHING_PUT_BY`, the
BOTTOM of the ladder. It fires for a penniless outer disciple and can never
fire for the case the comment describes and the owner named: somebody who is
strong, is worth a chair, and finds every chair taken.

That is one of the genre's commonest departures - the talented disciple who
leaves because the house has nowhere to put them - and the engine currently
cannot express it. Whoever takes it should read the reason's comment first: the
sentence was written for the right rule and the condition was written for a
different one.

## A slice is not a closed population

**The people who fill a chair are mostly people nobody has heard of.** The
design owner:

> *"the game still needs to simulate an elder rising (most likely from someone
> you haven't heard of), or else the top will thin out over time"*

This is the consequence that makes the slice work, and getting it wrong is how
a world quietly dies at the top. If promotion can only move somebody who is
already on the roll, then a house with four modelled disciples has four
candidates for the rest of time, and every death at the top is a permanent
loss. **Measured: a fifth of every ladder stands empty at a century, elder
rungs included, and members standing at their own seat fall from 207 of 306 to
42 of 363.**

The unmodelled hundreds are not absent. They are unrendered. So when a chair
comes free and nobody in the slice can take it, **the house produces somebody
who was always there and had not been worth a row until now** - which is also
exactly how it reads in the genre. An elder nobody has heard of is the ordinary
case, not a cheat: you were never going to have met all five hundred.

**And the pipeline for this already exists - do not write a minting pass.** The
world already bears people (`the-world-changing-on-its-own.ts` creates rows at
runtime), already enrols them (`applyRecruitment`, yearly, over every house
tagged `recruits`), and already promotes them (`applyPromotions`, gated on a
free seat and on the rung's realm bar). Birth, intake, promotion: the three
steps of an elder rising from somebody nobody had heard of are all there and
all running.

**So the defect is throughput, not a missing mechanism**, and that is a
different investigation. A fifth of every ladder is empty at a century with all
three passes running, so something in the chain does not keep pace with deaths
at the top - and the honest first question is which link, measured, rather than
which pass to add. `applyPromotions` deliberately returns no seats for the head
rung, on the grounds that a head is a succession rather than a promotion, and
nobody has yet found the succession machinery a comment in that file refers to.
That is the first place to look.

**What follows for anything that fills a post:** never fail for want of a
candidate inside the slice, and prefer the slice when it can answer - a
disciple the player has actually met rising to an elder's chair is worth more
than a stranger doing it. When it cannot, the person who takes the chair is
somebody who was always there and had not been worth a row until now.

**And such a person is ROLLED, never listed**, at a rate that comes off how big
the house is said to be. The owner: *"minting is rng, it's not hardcoded"*, and
*"it falls out of the narrative size of the world/sect."*

Note that "minting" is a convenient word rather than a new mechanism: what
happens is the world bearing and enrolling somebody, which it already does
yearly. And no sect row carries a member count today, so the size to read is
the one `a-house-raises-its-own.ts` already derives - the ladder, the house's
standing, whether it recruits, and how long it has stood. **Read that rather
than adding a number**; a second measure of how big a house is would be a
second measure of how big a house is.

 The world already bears people off a seeded stream, and a
new elder is drawn the same way - deterministic for a given seed, different
between seeds, and nobody's authored fallback. A hand-written list of
understudies would make every world produce the same replacement elder, which
is the opposite of what the catalog's authored figures are for: **those are
fixed because they are facts about the world, and everybody else varies because
they are not.**

## The shape has to survive time passing

Seeding the shape right is a **day-one** property, and the world then runs for
centuries. People die, are killed, walk out, cross the Lid. Measured on a
neighbouring question: **members standing at their own seat go from 207 of 306
at world open to 42 of 363 at a hundred years.** A shape that is only seeded
rots.

So a vacancy has three steps, and the middle one is the interesting one:

1. a posting's holder dies or leaves
2. **somebody senior covers it** - the way an acting officer does. This is
   deliberately visible: a house whose patriarch is also acting punishment elder
   is a house under strain, and that is a fact a player can find, a rival can
   read, and the power index can price. Silent succession hides the same event
3. **the house then fills the chair** - by promoting from within, or from
   outside via `GUEST_ELDERS`, who are exactly the pool of elders with no posting

Covering should look temporary, who covers should be derived from the ladder
rather than always the patriarch, and **a house can run out of people to cover
with** - which is a real outcome rather than an error, and means the house is
failing.

## Where the rest of this is written down

- `src/engine/world/README.md` - the passes that seed and move a house's people
- `src/data/cultivation/README.md` - the catalogs the shape is read from,
  including `ranks`, the postings a house holds, and `GUEST_ELDERS`
- `src/data/cultivation/false-immortals.ts` - `THE_OFFICE`, on the two senses of
  protector and why a vacancy there means something
- `src/data/cultivation/sects.ts` - the header rule that `elderRungOf` is the
  top three rungs and must not be re-derived from a fraction

