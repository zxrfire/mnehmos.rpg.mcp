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

**How a house decides who rises** (`promotion-inside-a-house.ts`, pinned by
`a-house-promotes-by-realm-then-merit.test.ts`):

1. **Two gates.** The rung's realm bar, and its merit minimum. Merit is service
   the house counts - a posting or a sending served to term, attention given,
   work taken off its board (`a-disciple-takes-work-off-the-board.ts`), and a
   thing it wants handed in (`what-a-house-gives-merit-for.ts`) -
   held on `NpcRecord.merit` against one house, in the units of a player's
   `contribution`, and the minimum is the player's own curve,
   `requiredContributionForRank`. Somebody tall enough who has not served is
   blocked `not_enough_merit`.
2. **Then the order.** A whole major realm up wins. Within a realm, merit; being
   chosen counts as merit there and never across a realm. Then the rung, then
   the id.
3. **The elder band seats as many with an office as there are offices** left
   after the posts above it. Past that, somebody a whole realm above the elder
   bar who has the merit is made an elder with no office, up to
   `NO_OFFICE_ELDERS_PER_OFFICE` of the house's offices and never fewer than one;
   past that they are blocked `no_room_without_office`. A house with no office
   rooms built keeps the halving seats.

The outside half of that path - an elder brought in rather than raised, priced
by `externalElderCost` and drawn from people who can teach the house's arts -
is not built. The background has no store of standing to charge the price to.

**And going is the half that is not built.** `why-somebody-walks-out-of-a-
compound.ts` has the right reason in it - `'nothing in the hall is theirs'`,
whose own comment reads *"No room, no office, and nothing in the purse"* - but
its condition is `factionRankIndex <= 0 && spiritStones < NOTHING_PUT_BY`, the
BOTTOM of the ladder. It fires for a penniless outer disciple and can never
fire for the case the comment describes and the owner named: somebody who is
strong, is worth a chair, and finds every chair taken.

That is one of the genre's commonest departures - the talented disciple who
leaves because the house has nowhere to put them. **It is now built, as a second
reason rather than a new condition on the first**: `'the house has no room for
them to rise'` fires for whoever `assessPromotions` names in `blocked`, at any
rung, and presses harder the longer they have waited and the further past the
bar they stand (`being-held-back-in-a-house.ts`). The bottom-rung reason is left
as it was, because it is about something else - a purse, not a chair. Measured
over four seeds and five hundred years, departures doubled at every rung and the
elder rungs did not thin further; the figures are in that file.

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
tagged `recruits`), **already climbs them** (`applyAdvancement`, on a review
cycle, for everybody alive below the Lid and never the player), and already
promotes them (`applyPromotions`, gated on a free seat and on the rung's realm
bar). Born, taken in, risen, promoted: all four steps of an elder coming up
from somebody nobody had heard of are there and all of them run.

**So the defect is throughput, not a missing mechanism**, and that is a
different investigation. A fifth of every ladder is empty at a century with all
three passes running, so some link in the chain does not keep pace with
deaths at the top - and the honest first question is WHICH link, measured,
rather than which pass to add. There are four candidates and they fail
differently: too few born, too few taken in, **too few climbing high enough**,
or seats that exist and are never dealt.

**Both sides of this are slow, and that is the whole difficulty.** The owner:
*"those people live a long time"*, and then the correction worth having -
*"elders don't often die, but it's also HARD to hit elder, right? but they do
die in expeditions, taking people out to ruins, old age, fights, etc."*

So neither half is negligible. A Nascent Soul cultivator at two hundred has
eight hundred years left, so **age is the slowest of the exits** rather than
the main one - but expeditions, ruins and fights take elders steadily, and they
are the people a house sends when something matters. And the supply is
genuinely constrained: reaching an elder rung is hard, so a chair does not
refill simply because somebody is available.

**The question is therefore a balance rather than a culprit**, and a ladder
emptying over a century could be losses outpacing a slow intake, a slow intake
failing a normal loss rate, or people leaving a chair without dying at all.
Measure all three before concluding; the instinct is to look only at who is
coming up, and at least one exit is known to be broken.

**And keep two different decays apart, because they have been conflated here
and they have different causes.** The owner: *"posted away elders aren't lost
though."* Quite right - somebody on a posting still holds their rank and is
still the house's. What they are not is STANDING THERE.

- **Presence decay** - people exist, hold their chairs, and are somewhere else.
  This is what the 207 of 306 down to 42 of 363 measures, and it is what breaks
  the gate, the courtyard read and hosting. Postings never recalled was the
  cause for the people a house opened with, and is fixed - see below. What is
  left of it is people who joined since and were enrolled where they stood.
- **Roster decay** - the house genuinely has nobody at a rank. This is what a
  fifth of every ladder empty at a century measures, and it is what breaks
  promotion and who can be sent.

A posted-away elder fills a rank slot and empties a seat. So the two figures
answer different questions, and a fix for one need not move the other. Say which
you are measuring.

Start with the ways somebody leaves a chair while still alive, because those
are the ones that should not be happening at all:

- **posted away and never recalled.** Fixed. Every writer of an away activity
  took wherever the person was standing as home, so a party that drafted
  somebody out of a posting wrote the town as home, and a posting ended wherever
  they had been. A posting now ends at the house, and somebody already away keeps
  the home that errand holds (`whereTheyGoBackTo`). Summed over six seeds at a
  century, members at their own seat went from 341 of 3050 to 697 of 3054 and
  houses unable to answer their gate from 80 of 236 to 19 of 239; rank and
  elder slots empty did not move beyond seed noise, **because this was presence,
  not loss** - the house still had them. What remains off the seat is recruits:
  `applyRecruitment` enrols people where they stand and nothing brings them in.
  `probe-does-a-posting-bring-anybody-home.ts` carries the figures
- **killed.** The world's own passes take people, and the party pass dominates
  the ones that do
- **walked out.** A blocked senior can now leave for being one - see the
  walk-out section above. Over five hundred years it doubled departures and did
  not thin the elder rungs further, so it is a flow rather than a drain

Then the deaths that are supposed to happen - expeditions, ruins, fights, and
age last - measured as a rate rather than assumed to be small.

And then the climb. Promotion is gated on the rung's realm
bar, so a house can hold an empty elder chair, a queue of candidates and a
working promotion pass, and still seat nobody - because nobody has climbed far
enough to qualify. A measurement from elsewhere this session is suggestive: the
pool the world's own passes draw from runs a median of 9 and a 99th percentile
of 21, against elder rungs that want considerably more. `applyPromotions` returned no seats for the head
rung, on the grounds that a head is a succession rather than a promotion, and
there was no succession machinery anywhere. Measured over 2,500 years on one
seed, the head rung took in nobody and the catalog houses went from 38 heads
to 0. The head's chair is now one seat: it fills from the rung below only when
it stands empty. See `a-house-fills-an-empty-head-from-the-rung-below.test.ts`.

**What follows for anything that fills a post:** never fail for want of a
candidate inside the slice, and prefer the slice when it can answer - a
disciple the player has actually met rising to an elder's chair is worth more
than a stranger doing it. When it cannot, the person who takes the chair is
somebody who was always there and had not been worth a row until now.

**And such a person is ROLLED, never listed**, at a rate that comes off how big
the house is said to be. The owner: *"minting is rng, it's not hardcoded"*, and
*"it falls out of the narrative size of the world/sect."*

**It is rare, and it is a promotion into EXISTENCE.** Because the top barely
decays, chairs seldom come free, so this happens occasionally rather than
constantly. And when it does, the owner's framing is the one to build to: *"we
simulate the sect has x outer and x inner disciples, and ONE OF THEM INEVITABLY
BECOMES AN ELDER - that person is now a real NPC."*

So nothing is conjured. The hundreds were always there as a number; one of them
was always going to rise; and the moment they do, they stop being part of a
count and start being somebody with a name a player can ask after. **The row is
created at the moment the person becomes worth knowing, not at the moment they
come into being.** That is the slice widening by one, and it is the only time
it widens.

Note that "minting" is a convenient word rather than a new mechanism: what
happens is the world bearing and enrolling somebody, which it already does
yearly.

**What is built of this, and what is not.** A house whose compound stands and
sleeps people nobody models, and whose roll is short of `aRollWorthModelling`,
has one of its own outer disciples come forward each year, at rank 0
(`a-house-takes-in-one-of-its-own.ts`). Everything above rank 0 is still
climbed. And a house is judged, not its slice: it falls when it cannot pay, or
when its roll is empty and it has nobody else - no compound, or a compound a
conquest made a ruin (`whetherAHouseHasFailed`). The real size used is the
dormitory the compound was built with (`howManyAHouseReallyHas`), which does
not yet move with the house's fortunes; the tracked number below is still to
build.

### Track the house's real size, and let the odds fall out

**A house should carry its FULL size as a number that moves over time**, and the
chance of somebody rising into a chair comes off it. The owner: *"you should
probably track the full size of a sect, and this is just a # that changes with
time, so the odds of minting these higher ranks falls out."*

So the modelled dozen is the slice, and beside it sits the count of everybody
else - five hundred, or forty - which grows and shrinks as the house prospers,
loses a war, stops recruiting or closes its door. A big house restocks its
elders readily because it has hundreds coming up; a small one cannot, and that
is a fact about the house rather than a dial. **The number is the input and the
odds are the output.** Do not tune the odds directly.

This supersedes an earlier note in this file which said to read the size
`a-house-raises-its-own.ts` derives rather than adding a number. That
derivation exists to size the SLICE and answers a different question: how many
rows are worth holding. How many people the house actually has is not
recoverable from it, and the two should not be made to stand in for one
another.

### And the person who rises may be somebody you know, or you

**The pool is not only the unmodelled.** The owner: *"and can also be minted
from an npc that you already know or you yourself."*

So when a chair comes free the candidates are, in order of what they are worth
as a story: **the player**, somebody the player has met, somebody on the roll
they have not, and only then a person drawn out of the count. A disciple whose
name the player learned at a gathering becoming an elder is worth far more than
a stranger doing it, and **the player being the one promoted is the whole point
of having a ladder at all.**

Which means this cannot be a pass that only creates people. It is a pass that
FILLS A CHAIR, and creating somebody is what it does when the better answers
are unavailable.

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

## Word travels back to the house

A house has people out in the world all the time: stationed in a town, posted
to a watch, out with a party, recruiting in a province. The design owner:

> *"you can imagine people out on a sect have communication talismans"*
> *"that also gives a way for the people the sect stations out to report back"*

So **a house hears from its people without waiting for them to walk home.**
The channel is a **communication talisman**: a slip keyed to where it answers
(the house's hall, a master, a named person), burnt once, carrying a short
message the same day. It is the third kind of act a slip holds, beside a
strike and a teleportation talisman, see `a-talisman-is-one-act-somebody-already-paid-for.ts`
- **but it is counted, not tracked**. The owner: *"these are too common and
single use, don't bother making them tracked, they're just counted"*. A house
keeps a stock of them, hands a few to whoever it sends or stations away, and
burning one takes one off the count; nothing is left in the world. *"You just
have a fungible stack."* Each slip is **marked with a house** and answers to it, so a stack
is fungible within one house's mark. **Anyone at Foundation or above can make
them**, and **making them for the house is service that earns merit**, the same
as any other task off the board.

**And the house comes to them.** *"The house sends people to give you more
stack, check up on you, every once in a while, if you are out in a posting."*
The visit is an ordinary sending with that reason, and what it finds - alive,
hurt, gone, what they have seen - reaches the house the same way a burnt report
does. It is also how a house learns about somebody who never sent word.

What comes back is a fact the house then holds, through the ordinary knowledge
and fact path, and not a store of its own:

- **a stationed or posted member reports what they see** where they are posted:
  a death, a door opening, a threat, a rival moving
- **a party in the field reports** a death, a find, or a call for help
- **a recruiter reports a recruit**, and the house then expects them

### A recruit is expected, and arrives

Rulings from the same night, which the talisman is one link of:

- **you join where you are recruited**, and you do not get your token, your
  robes or your life lamp until you reach the house - *"so you don't really
  have proof"*. A house has an infinite stock of robes.
- **the recruiter burns a communication talisman to inform the Internal Affairs
  Elder**, who keeps the life lamps, **and the house expects the recruit by
  name**. At the gate a new
  arrival says who recruited them and where, and is let in on that: *"the sect
  verifies because the person that went back talked to the elder managing life
  plates, the sect expects them"*.
- **on arrival they are entered** - robed, a token where their rung carries
  one, a life lamp lit in the Life Lamp Hall - **and they move into the
  compound**.
- after that, a member with no token (the bottom rung carries none) passes the
  gate **in the house's robes and on a face somebody there knows**; an unknown
  face in robes is stopped and asked, which is also exactly how a disguise
  works.
- **with no report - the recruiter died first, or has not got back - the recruit
  is questioned by the Internal Affairs Elder**: *"the house still knows the
  recruiter went to the area and knows what their standards are, right?
  Questioned and allowed if matched, else rejected."* The house reads what it
  already holds - whose the recruiter is, where they were then, its own
  admission bar - and keeps nothing new for it.
- **nobody joins a house out of thin air**: *"Houses hold selection ceremonies
  at their sect grounds too. They aren't open 365 days a year. They send people
  out looking for seedlings, and open up recruitment once every x years."* A
  player is taken on by somebody out looking for disciples, at a selection at the
  house's grounds, or at the intake its paper names, and whoever did it is their
  recruiter. See `when-a-house-takes-people-on.ts` and `src/web/who-takes-you-on.ts`.

## Where the rest of this is written down

- `src/engine/world/README.md` - the passes that seed and move a house's people
- `src/data/cultivation/README.md` - the catalogs the shape is read from,
  including `ranks`, the postings a house holds, and `GUEST_ELDERS`
- `src/data/cultivation/false-immortals.ts` - `THE_OFFICE`, on the two senses of
  protector and why a vacancy there means something
- `src/data/cultivation/sects.ts` - the header rule that `elderRungOf` is the
  top three rungs and must not be re-derived from a fraction
- `src/engine/world/a-talisman-is-one-act-somebody-already-paid-for.ts` - what a
  slip holds, including word sent home

