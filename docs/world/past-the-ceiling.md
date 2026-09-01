<!-- tier: 2 trigger="a cultivator has run out of manual, or is deciding whether to go looking for one" -->

# Past the ceiling

What a capped cultivator does next.

A cultivation manual carries a `cap`: the rung past which it cannot take anybody, however
long they practise. `techniqueExhausted` in `src/engine/cultivation/cultivation.ts` returns
true at or past it and the rate factor goes to a multiplier of zero. Not a taper. It stops.

This file is the other half of that. A ceiling with no doors is a bug wearing a design; a
ceiling with doors is the motive engine for the whole game. Every route below is assembled
from machinery that already exists in the repo, and where a route needs something that does
not exist yet, it says so in the [itemised list](#what-each-layer-must-supply) at the end
rather than inventing it here.

Nothing in this file is a new subsystem. The last section is the useful part.

## Sections

<!-- tier: 3 -->

| Section | Loads when |
|---|---|
| [The situation, measured](#the-situation-measured) | **Tier 3** - never injected |
| [The three rules every route obeys](#the-three-rules-every-route-obeys) | a route past a manual's ceiling is attempted, offered, or refused |
| [The routes](#the-routes) | the player is choosing how to get past their manual's ceiling |
| &nbsp;&nbsp;[1. The later volume](#1-the-later-volume) | the player is looking for, buying, or has found a later volume of a manual they hold |
| &nbsp;&nbsp;[1b. The scattered set](#1b-the-scattered-set) | a manual survives only in scattered volumes, or the player holds a gapped set |
| &nbsp;&nbsp;[2. The door that tests fit](#2-the-door-that-tests-fit) | the player finds an inheritance trial, a sealed door, or any test of suitability rather than strength |
| &nbsp;&nbsp;[3. The body](#3-the-body) | the player considers changing their own root or body to fit an art |
| &nbsp;&nbsp;[4. Being shown by somebody above the Lid](#4-being-shown-by-somebody-above-the-lid) | somebody above the Lid offers to teach, or an immortal takes an interest in the player |
| &nbsp;&nbsp;[5. Climbing to the shelf](#5-climbing-to-the-shelf) | the player is earning rank inside a house in order to reach its archive |
| &nbsp;&nbsp;[6. Being let into a house of accumulated knowledge](#6-being-let-into-a-house-of-accumulated-knowledge) | a Dao house or deep-foundation library is opened to the player, or refuses to be |
| &nbsp;&nbsp;[7. Deducing the next volume](#7-deducing-the-next-volume) | the player attempts to write the next stage of a manual themselves |
| &nbsp;&nbsp;[8. Taking it](#8-taking-it) | the player considers taking a manual by force or theft, or is accused of having done so |
| &nbsp;&nbsp;[9. Decreeing the curriculum](#9-decreeing-the-curriculum) | somebody near the top of the ladder changes what may be taught |
| [Not every door is open to everybody](#not-every-door-is-open-to-everybody) | a route is refused, or the player asks why one is closed to them |
| [Searching must be rational, not compulsory](#searching-must-be-rational-not-compulsory) | the player is deciding whether to keep searching or accept the ceiling |
| [Leaving, and what it costs](#leaving-and-what-it-costs) | the player considers changing house, or somebody in the world does |
| [What each layer must supply](#what-each-layer-must-supply) | **Tier 3** - never injected |
| [Related](#related) | **Tier 3** - never injected |

---

## The situation, measured

<!-- tier: 3 -->

The claim this document was commissioned against was "taught books run out at ordinal 29".
That is no longer true and the truth is more interesting. Probed against the live catalog
(`TECHNIQUES.filter(class === 'cultivation')`, asking at each ordinal which manuals have
`requiredOrdinal <= n` and `cap > n`):

| Standing at | Manuals that can carry you further | Provenance | Asks for |
|---|---|---|---|
| 0 - 12 | up to three | taught, many houses | any root; one wants water |
| 13 - 16 | two | taught, five houses | any root; one wants wood |
| **17 - 20** | **one** | taught, three houses | **fire** |
| 21 - 24 | one | taught, seven houses | any root |
| **25 - 28** | **two** | taught | **earth**, or a forbidden method from two demonic houses |
| **29 - 31** | **one** | **ruin**, one trial | any root |
| 32 | two | taught, one house each | fire, or the ruin manual above |
| **33 - 35** | **one** | taught, **one house** | **ice** |
| 36 | two | taught (ice), or a grave | ice, or a forbidden method off a body |
| **37 - 40** | **one** | **parting gift only** | any root |
| 41 - 44 | two | **ruin** and **grave** | any root, both forbidden-adjacent |
| 45 | none, correctly | - | the crossing is not a book |

Read it as a corridor rather than as a ladder. The middle of the world is not gated on
effort at all; it is gated on being the right person standing near the right shelf. Three
of the choke points are single-source and element-locked, one of them at a house that
`sects.ts` already says will not open its library to anybody without a mutated ice root.
Above 37 nothing is taught by anyone.

**The corridor is the design and it is currently unplayable**, because a player who reaches
one of those choke points has no verb that opens any of the doors below. That is what this
document is for.

Two corrections to the record while we are here, both found by reading rather than by
assertion:

- `capOf` is `realmForOrdinal(requiredOrdinal).ordinalEnd + 1`, so a manual carries you
  through its realm and exactly one rung over the boundary. The succession of books is
  therefore a fact about realm geometry, not a tuning choice, and there is no realm
  boundary anywhere on the ladder that a single manual crosses twice.
- The one manual with `cap === null` is legal only because `MANUALS_MAY_EXCEED_THE_LID` is
  true. Paper may be rated anywhere. No object below `OBJECT_CEILING_BELOW_THE_LID` may be.
  That asymmetry is the reason the top prize in the setting is a book and not a sword.

---

## The three rules every route obeys

<!-- tier: 2 trigger="a route past a manual's ceiling is attempted, offered, or refused" -->

### 1. Suitability is personal, and it is not difficulty

A manual not written for your root teaches you nothing however long you sit with it. The
question a find puts to a player is never "is this good" and always "is this for me".
`assessFit` in `src/engine/encounters/suitability.ts` already answers it over five axes
(reach, element, root, comprehension, band) and already returns `unsuited` as a distinct
verdict from `out_of_reach`. Those two must never be collapsed. "Too strong for you yet" is
a schedule; "sound, and not for you" is the game.

Cap and fit are independent, deliberately. A perfectly suited manual still runs out. An
ill-suited one teaches nothing at any height. A route that closes one gap does not close the
other, and no route below is allowed to pretend otherwise.

### 2. The gate is access, not effort

Somebody fully supplied - a house's treasury for pills, its library for manuals - and
genuinely suited, and with the years left, can climb the whole ladder having done nothing
else. That is not a hole. It is the specification. `discoverableInsights` is already
access-shaped: it reads `readableManuals`, `teachers`, `artifacts`, `inheritances`,
`tradition`, `locationTags` and `survived`, and a hermit with none of those reaches their
own root and nothing else forever.

But that road only works if you are a heaven-defying prodigy perfectly suited to what the
house in front of you happens to hold. The corridor table above is the proof: at three
separate rungs the entire world offers exactly one book, and it wants a specific element.
**Hence people go out searching, because they want to find something suited to them.**

### 3. A miss is a legitimate outcome and must be said out loud

Finding something excellent and useless to you is the emotional core of the loop. It is also
the single easiest thing for an interface to get wrong: a player who walks out of a tomb
with a heaven-grade manual and no idea why nothing is happening has been cheated by the
interface, not by the world, and the lesson they learn is to sit longer instead of going
further.

`Suitability.line` and `AccessAssessment.unsuited` exist precisely to carry that sentence.
Every route below must surface them. The narrator may render the sentence; it may never
compose one, and it may never soften a miss into a maybe.

---

## The routes

<!-- tier: 2 trigger="the player is choosing how to get past their manual's ceiling" -->

Nine, and they are different in kind rather than nine difficulties of one thing. The list is
not exhaustive and is not meant to be closed - a tenth is a deliberate act and belongs here
when somebody adds it.

Each is stated as: what it is, what it costs, who it suits, how it fails, and what already
implements it.

---

### 1. The later volume

<!-- tier: 2 trigger="the player is looking for, buying, or has found a later volume of a manual they hold" -->

**What.** Find the next book in the chain. The ordinary case, and the one the cap was
designed to produce: a manual ends one rung over a realm boundary and another manual begins
at exactly that rung.

**Cost.** Travel, years off the lifespan clock, and the risk of wherever it is.

**Suits.** Everybody. This is the baseline and the others are what you do when it fails.

**Fails.** The corridor. At 17, 29, 33 and 37 there is exactly one continuation in the
world, and at two of those it wants an element you may not draw. A found volume also has to
pass `assessFit` like anything else, so the commonest failure is not "could not find it" but
"found it, and it was written for somebody else".

**Implemented by.** `capOf` and the manual chain in `src/data/cultivation/techniques.ts`;
`assessFit` / `bestFor`; the five obtaining routes already enumerated and tested in
`tests/data/cultivation-technique-routes.test.ts` (taught, trial, grave, carving, parting
gift). Nothing new.

### 1b. The scattered set

<!-- tier: 2 trigger="a manual survives only in scattered volumes, or the player holds a gapped set" -->

The best version of "seek out later volumes", and it is already sitting in the repo unused.

`shardPower` in `src/engine/world/possessions.ts` says a piece is one rung below the whole,
at every rung, for everything - "there is no special case at the top of the scale and there
must not be one". Apply the same arithmetic to paper. A canon that exists only as separated
volumes in three different hands is, to whoever holds one volume, a manual capped one rung
lower than the complete work. Collect a volume, the cap rises by one. Collect the set and
you hold the book.

**Cost.** Three separate acquisitions, each with its own owner, price and grudge. The
holders know what they have or they do not, and `knownOwnershipBy` on the object record is
already the field that decides which.

**Suits.** The patient, the trader, the investigator. Notably it suits somebody with no
combat answer at all, because a volume can be bought, inherited or argued for.

**Fails.** The last volume is held by somebody who will not part with it, which is a social
problem rather than a strength one. Or the complete work turns out to be unsuited, and you
now own three quarters of a thing you cannot read - which is a legitimate and quite bitter
outcome, and the interface must say so plainly.

**Implemented by.** `shardPower`, `shatter`, `ObjectRecord.power`, `tags: ['shard',
'from:<id>']`, `knownOwnershipBy`, `claims`, `provenance`. Every field exists. What does not
exist is anything that treats a manual as an object with volumes - see the itemised list.

---

### 2. The door that tests fit

<!-- tier: 2 trigger="the player finds an inheritance trial, a sealed door, or any test of suitability rather than strength" -->

**What.** An inheritance trial. `src/data/cultivation/inheritance-trials.ts` is the largest
finished, tested system in the repo written for exactly this problem, and `THE_THREE_GATES`
is the reason: a door can ask three unrelated questions, and only one of them is about
strength.

- `strength` asks how much you can take. Every such gate carries `noWorkaround`, so nothing
  downstream may invent a clever route.
- `age_and_talent` asks what you have become - years, root grade, foundation quality, an
  attribute, comprehension in a named domain - and every such gate carries
  `strengthDoesNotHelp`. A cultivator four ranks above the requirement fails it flat if the
  years are not there. The schema refuses `fortune` as a talent measure, so a talent gate
  can never quietly become a luck roll.
- `fate` asks nothing about you at all. `characterStat` is `z.null()` on every fate gate, by
  schema, so there is no hidden number to grind.

This is the route that lets a nobody outrun a favoured heir, because two of the three gates
are indifferent to everything a house can buy.

**Cost.** The interior kills people. `outsideViewOf` returns a type with no `interior` key,
so what you are deciding on before you walk in is a marker, a rumour and what the last party
said - which is the correct amount of information and less than anybody wants.

**Suits.** The old, the odd, the unfavoured, the one who has been somewhere nobody could
have scheduled. `age_and_talent` suits a long slow life; `fate` suits an interesting one.

**Fails.** Three different ways, and the difference matters. A strength refusal names a
shortfall you can go and fix. A talent refusal names one you cannot fix today and possibly
ever. A fate refusal must not imply a shortfall at all, because there is nothing to fall
short of and nothing to go and do - most claimants will never satisfy one and cannot be
advised to try.

**Implemented by.** `SITES`, `INHERITANCE_TRIALS`, `GRAVES`, `outsideViewOf`, `enterSite`,
`awarenessOfSite` and `fateEvidenceFor` in `src/web/trials.ts`. Wired. The gap is that a
trial's `prize.techniqueIds` is not currently read as a cap-raising acquisition.

---

### 3. The body

<!-- tier: 2 trigger="the player considers changing their own root or body to fit an art" -->

**What.** What somebody stronger was practising is still on them. The `corpses` and
`corpse_inventory` tables are ordinary substrate and have been there since the fork.

**Cost.** You had to be there, and usually you had to win. Or somebody else won and you
arrived after.

**Suits.** The soldier, the bandit, the scavenger, the battlefield gleaner. It is the one
route with no institutional prerequisite whatsoever, which is why it is the rogue's road -
`rogues.ts` already says of them: no quotas, no contribution points, and no elder with a use
for them.

**Fails.** Overwhelmingly by suitability, and this is the route where that is most
instructive. The manual on a body was written for the person who was carrying it. Killing
somebody four rungs above you and taking their canon is a wonderful afternoon that changes
nothing, and `assessFit` should say so in the same breath as the loot list.

There is a second failure with real texture already documented in `inheritance-trials.ts`:
`WHAT_THE_LIGHTNING_TOOK`. Heavenly tribulation destroys nearly everything a cultivator was
carrying, so a tribulation grave is a short list of things that survived the heaviest event
in the world. Anybody who died in bed leaves a full inventory that nothing has ever tested.
**The rich crypt is usually the weaker one.** Grave-readers know this. Raiding parties do
not, which is why raiding parties go to the rich crypt.

**Implemented by.** `corpses`, `corpse_inventory`, `CorpseRepository`, `resolveMelee`,
`assessFit`, `shardPower` for a volume that took a hit.

---

### 4. Being shown by somebody above the Lid

<!-- tier: 2 trigger="somebody above the Lid offers to teach, or an immortal takes an interest in the player" -->

**What.** The narrowest supply in the world and the only art above the Lid anybody can get
without somebody on the far side taking an interest in them.
`ABOVE_THE_LID_TRANSMISSION.falseImmortal` is unambiguous: he built these himself, there is
no manual because he never had a reason to write one, and a student gets it by being his
student, with no substitute - not a manual, not a sect, not money.

Where he lectures he cuts, and the stone stays. A face of his is a real route
(`allDaoCarvings`), and it is worth much less than the afternoon, which is what the opacity
figures on those entries are for.

**Cost.** One man's attention, spent out of a finite number of years, against motives that
are his and not yours: legacy, spite, or wanting somebody to have understood.
`false-immortals.ts` gives each of them a `LegacyState` and a madness clock, so the person
you are asking is on his own trajectory and may be past being asked.

**Suits.** Whoever he finds interesting, which is not the same as whoever is strongest and
is frequently the opposite.

**Fails.** He cannot receive - he cannot learn another False Immortal's arts and has never
seriously tried - so this rung has no canon, it is one man's, and it ends with him.

**And here is the honest limitation, which must be stated in the fiction rather than
patched:** what he holds are dao arts at ordinal 45, not cultivation manuals. Under
`classOf`, a dao art has `cap === null` because it is not a manual at all. **This route
raises no rank ceiling.** What it buys is understanding, and understanding is what opens
route 7. Anybody who sells this as a way past a cap is selling the wrong thing, and the
refusal text should say which thing it actually is.

**Implemented by.** `false-immortals.ts`, `allDaoCarvings`, `ABOVE_THE_LID_TRANSMISSION`,
`daoGate`, `understandingEffects`.

---

### 5. Climbing to the shelf

<!-- tier: 2 trigger="the player is earning rank inside a house in order to reach its archive" -->

**What.** The manual you cannot get as Outer Disciple is the one taught at Elder. This is
what `sect_members.contribution` is for, and it is the least romantic route in the file and
probably the commonest life in the world.

**Cost.** Decades. Duties (`src/engine/encounters/duties.ts` already pays contribution on
completion, scaled by the rung the duty is pitched at). Obedience, and the fact that the
years spent earning a shelf are years not spent cultivating - the `focusMultiplier` is
already the term that prices this.

**Suits.** The favourite, the joiner, the one born close enough to a house to be let in at
all. `origin.md`'s rule holds: privilege buys inputs and never rank.

**Fails.** In two completely different ways, and both are in the data already.

- **The house's own ceiling.** `production.reliableOrdinal` on the faction catalog is true
  by construction rather than by assertion, because a low-tier house teaches a low-tier
  manual. The Azure Cloud Pavilion reliably produces Core Formation and has not produced
  above Nascent Soul in three centuries. Climbing to the top of that house gets you the top
  of that shelf and the shelf stops.
- **The shelf is not for you.** The Frostmirror Court holds the only complete ice curriculum
  and the only ice-attuned accumulation canon above heaven grade, and it will not open the
  library to anybody without a mutated ice root. The catalog already frames this correctly:
  it is triage rather than arrogance, the arts kill everyone else, and every applicant it
  refuses is somebody it has declined to bury. To a mutated ice cultivator this is the one
  place in the world their talent is not a death sentence. To everybody else it is a closed
  door with a perfectly good reason painted on it.

**Implemented by.** `sect-manage` actions `join` / `promote` / `standing`;
`sect_members.contribution`; `duties.ts`; `SECTS[].teaches`; `guidanceMultiplier` and
`guideFor`.

---

### 6. Being let into a house of accumulated knowledge

<!-- tier: 2 trigger="a Dao house or deep-foundation library is opened to the player, or refuses to be" -->

**What.** `docs/world/dao-houses.md`: a house that has spent thousands of years
understanding one principle better than anybody alive, whose authority is civil before it is
martial, and where adoption is the documented way in. The mechanical hook already exists and
is unused - `DiscoveryContext.tradition`, described in `understanding.ts` as "the principle
of a Dao house the cultivator is INSIDE. Not secret because the words are hidden;
inaccessible because standing where it can be comprehended requires being let in, and they
decide who comes in."

**Cost.** They own you, in the specific sense that a karma house ends up holding your debts
and an oath house ends up holding your word. And the principle narrows you: `NARROWING_PENALTY`
makes what you comprehend deeply the cost of comprehending otherwise.

**Suits.** The scholar, the investigator, the arbiter, the person with no combat answer and
a very good memory. Explicitly it suits somebody a sect would not take, because these houses
select on a different axis.

**Fails.** They decide who comes in, and they have enemies, internal factions, declining
branches and incomplete knowledge. And the principle may not be your road, in which case
being adopted into the House of Oaths gets you a lifetime of very well-informed access to
something `daoMatches` will keep refusing.

**Implemented by.** `DiscoveryContext.tradition`, `discoverableInsights`, `assessAccess`,
`NARROWING_PENALTY`, `daoDistance`, the faction catalog's house entries.

---

### 7. Deducing the next volume

<!-- tier: 2 trigger="the player attempts to write the next stage of a manual themselves" -->

**What.** The prodigy's road, and the only route whose output is definitionally suited to
you, because you derived it from your own road rather than finding it on somebody else's.

The machinery it keys off is `daoOf` and `GRADE_REQUIREMENT` in
`src/engine/cultivation/dao.ts`: `immortal` grade demands `leaning`, `chaos` grade demands
`dao`, and `daoGate` refuses with `no_matching_dao` or `wrong_dao` - "the pages are
perfectly legible and the meaning does not arrive". Turn that around. Somebody who stands at
`dao` in the subject a manual is about does not need the pages: they can write the
continuation.

**Cost.** An insight at degree 4 in the right subject, which is years and access and cannot
be bought. `daoOf` requires `DAO_DEGREE` and `DAO_BREADTH_REQUIRED`, so it is a narrow deep
achievement rather than a broad one, and `NARROWING_PENALTY` means getting there made
everything else harder.

**Suits.** The prodigy, the obsessive, the False Immortal's student, the one who has been in
the same room as a carving they only half understood. Notably it suits somebody with no
resources at all, which is the point: this is the one door money cannot open.

**Fails.** `wrong_dao`. Your road is a road and it is not this one, and no amount of
standing on it produces the other. It should also fail loudly for `leaning`: a leaning is
enough to read an immortal-grade art and not enough to extend one.

**Implemented by.** `daoOf`, `daoGate`, `daoMatches`, `GRADE_REQUIREMENT`, `daoName`,
`insightSuitability`. **The authoring half does not exist.** Nothing anywhere in the repo
creates a technique row at runtime. This is the largest single gap in the file and it is
itemised below.

---

### 8. Taking it

<!-- tier: 2 trigger="the player considers taking a manual by force or theft, or is accused of having done so" -->

**What.** A house's library is what a house's treasury holds. `siphon` already prices the
reserves by rank - `baseReservesFor(stipend)` gives the Azure Dew Sect 54,864 stones and a
Hollow Court seat 2,592,000 - and `canReachReserves` already gates access on rank rather
than on cleverness: "Access is the rank. This is a crime a house has to promote somebody
into."

There is no smash-and-grab, deliberately, and the same reasoning extends to the shelf. You
do not steal a library in an afternoon; you are trusted with it and then you leave with it.

The louder form is war. Spoils are the consequence, and a house that loses a war loses the
shelf that made it a house.

**Cost.** `FLAG_MARKED_THIEF` is permanent and is explicitly "the only mark any other house
will ever hold against them". The suspicion clock does not fade and the hole does not close,
so the interesting decision is when to stop rather than whether to start. A war costs what a
war costs and creates a grudge that outlives everybody who started it - see
`src/engine/social/`, where grudges pass to descendants.

**Suits.** The thief, who needs rank and patience and no talent whatsoever; and the soldier,
who needs allies. These are genuinely different doors: siphoning is a solo crime that
requires promotion, and war is a collective act that requires standing.

**Fails.** Caught, which is a seeded roll against a suspicion figure the player can read
before committing. Or - and this is the good failure - you take the shelf that was already
stopping you. The Azure Dew Sect's entire library ends at cap 17. Robbing it blind gets you
54,864 stones and the same ceiling.

**Implemented by.** `src/engine/cultivation/embezzlement.ts`, `handleSiphon`,
`canReachReserves`, `FLAG_MARKED_THIEF`, `discoveryChance`; the disaster postures in
`catastrophe.ts`; the social graph for what a grudge does afterwards.

---

### 9. Decreeing the curriculum

<!-- tier: 2 trigger="somebody near the top of the ladder changes what may be taught" -->

**What.** Take the seat and change what the house teaches. `sect-leadership`'s `curriculum`
action already exists, is gated on the `set_curriculum` power, is priced by
`curriculumChangeCost`, and can be obstructed or cost you the seat.

**Cost.** Standing, and the risk in `resolveAct`. Also generational: `cost.years` prices the
fact that what a house hands its intake is the single most consequential thing about it over
a century.

**Suits.** The politician. It is the only route that changes the world for people other than
the player, which makes it the one that shows up in a 500-year soak.

**Fails.** You can be obstructed, and you can lose the seat doing it.

**And it currently fails an invariant.** `sects.ts` states that `teaches` is a house's entire
working library and that consequently no sect teaches a ruin- or grave-provenance art.
`handleCurriculum` validates only that the technique id exists. A head can therefore decree
a ruin manual onto the shelf out of nothing. The fix is not a new rule: **a house may teach
what a house holds**, which is an object-possession check against machinery that already
exists. Itemised below.

**Implemented by.** `handleCurriculum`, `powersAt`, `curriculumChangeCost`, `resolveAct`.

---

## Not every door is open to everybody

<!-- tier: 2 trigger="a route is refused, or the player asks why one is closed to them" -->

The point of nine routes is that two runs differ. Roughly nine hundred hand-played lives
were nearly identical to each other, and the reason is that they all had the same one door.

| The player is | Their doors | Closed to them |
|---|---|---|
| The thief | 8 (siphon), 3 (bodies), 1b (buy a volume) | 5 and 9 need standing they have burned; 6 will not adopt a marked thief |
| The heir | 5 (the shelf), 9 (the seat), 1 (bought volumes) | 2's `fate` gates, which are indifferent to everything they were given |
| The favourite | 5, 4 (somebody takes an interest), 6 | 8 costs them the thing they are |
| The scholar | 6 (adoption), 7 (deduction), 2's talent gates | 3 and 8 need a fight they will lose |
| The soldier | 3 (bodies), 8 (war and spoils), 2's strength gates | 7 needs a depth the years went elsewhere |
| The politician | 9 (the curriculum), 5, 8 (the treasury) | 7, for the same reason as the soldier |
| The nobody | 2 (`age_and_talent` and `fate`), 3, 1b | 5, 6, 8 and 9 all require being let in somewhere |

The table is illustrative, not a schema. What it has to be true of is that no column is
empty and no row is the same as another, and that the nobody's column is not the shortest -
because two of the three trial gates are indifferent to everything a house can buy, which is
exactly why the trials catalog exists.

---

## Searching must be rational, not compulsory

<!-- tier: 2 trigger="the player is deciding whether to keep searching or accept the ceiling" -->

The failure mode this whole file guards against is a game that nags. The correct structure
is that sitting still is priced honestly and searching is priced honestly, and the player
does the arithmetic.

Sitting is already priced: `techniqueExhausted` returns a rate multiplier of zero with the
label "The manual ends at <rank>". There is no need to add a penalty on top and there must
not be one. A ceiling that gets gradually stickier reads as bad luck; a ceiling that stops
dead reads as a fact about the book in your hands.

Searching is rational because of one asymmetry: **the thing that fits you is probably not
where you are.** A house holds one library, selected by its own founders for their own
roots, and the corridor table shows how narrow that gets above the middle of the ladder. The
world holds many. So the expected value of looking rises exactly as the local shelf runs
out, which is the same moment the cap bites, which is why the two mechanics belong to each
other.

And it is rational rather than compulsory because information is real. A rumour that there
is a fire-root manual three provinces over is worth more than stones, and only to a fire
root. `hearsay.ts` already puts names into a player's world through the mouths of people who
assume they know them, and records them at the lowest positive stance with the source
attached - the player has the word and nothing else, from one interested party who may be
wrong. That is the correct shape for this: you do not search everywhere, you search where
something was reported, knowing the report may be worthless.

Three things follow, and they are constraints on implementation rather than colour:

1. **Never generate a find to suit the seeker.** The moment the world starts producing
   fitting manuals because the player needs one, suitability stops being information and the
   whole loop collapses into a fetch quest. Finds are seeded from the catalog and the
   verdict falls where it falls.
2. **The miss must arrive as a complete sentence, immediately.** Not a stat block the player
   has to interpret. `Suitability.line` is already written to say that a thing is sound,
   which axis missed, and that sitting with it will teach them nothing however long they sit.
3. **Never hide the cap.** A player must be able to read, before they commit a decade, that
   the book in their hands ends at a named rank. The rate breakdown already carries the
   label; the question is whether anything shows it before the decade rather than after.

---

## What each layer must supply

<!-- tier: 3 -->

The itemised list. Each entry names the owning layer, what it needs, and which route it
serves. Nothing here is a new subsystem; every one is a field, a predicate or a verb over
machinery that exists.

### Data catalogs - `src/data/cultivation/**`

| # | Item | Serves | Note |
|---|---|---|---|
| D1 | `volumes` on a cultivation manual: an ordered list of volume ids, or null for a single-volume work | 1b | The complete work already has a `cap`. A volume is one row per part with `tags: ['shard', 'from:<manual-id>']` so `shardPower`'s arithmetic applies unchanged. Do not add a second cap field - derive it. |
| D2 | Close the 37 - 40 corridor, or state that it is closed on purpose | 1 | `heaven-conversing-primordial-canon` is the only continuation past 37 and its only route is a parting gift. If that is intended, it belongs in a named constant with a reason, the way `NO_SURVIVING_COPY_NOTES` does it. If it is not, it needs a second route. |
| D3 | `rootGrades` and `domain` populated on cultivation manuals | 1, 1b, 3 | `Find` already reads them and `assessFit` already judges them. Today only `element` is authored, so the root and comprehension axes never fire for a manual and every miss reads as an element miss. |
| D4 | A `derivable` marker, or a stated reason a given manual is not | 7 | Which manuals a sufficient dao can reconstruct. Not every book: the Canon of the Unwritten Span is written for a condition no reader is in, and its own entry says so. |
| D5 | Volume-holder rows for at least one scattered set | 1b | An object with three holders in three factions, with `knownOwnershipBy` set differently on each, so the investigation half of the route has something to find. |

### Engine - `src/engine/cultivation/**` and `src/engine/encounters/**`

| # | Item | Serves | Note |
|---|---|---|---|
| E1 | `effectiveCapOf(manual, heldVolumeIds)` | 1b | Pure. Complete set returns the manual's own `cap`; each missing volume drops it by one, via `shardPower`'s rule so there is one piece of arithmetic in the repo and not two. |
| E2 | `canDerive(dao, manual)` returning permitted / `leaning_only` / `wrong_dao` | 7 | Shaped exactly like `daoGate` and reusing `daoMatches`. `leaning` reads an immortal art and does not extend one; only `dao` derives. |
| E3 | A derivation result the storage layer can persist as a technique row | 7 | The one genuinely new thing in this document. Deterministic from `(runSeed, cultivatorId, sourceManualId, daoSubject)`, output `cap` one realm above the source, `provenance` a new `'derived'` value, and `element`/`subject` taken from the deriver's own road so the result is suited by construction. **The engine must produce the row; the narrator may never assert one.** |
| E4 | `assessFit` called on every manual acquisition, not only on encounter finds | 1, 1b, 2, 3 | Today `assessFit` is reachable from the encounter path only. A grave prize, a corpse's inventory and a bought volume must all produce a `Suitability` with a `line`. |
| E5 | `mayHoldAFit` extended to grave and corpse tags | 3 | It reads `technique`, `recipe`, `inheritance`, `ruin-only`, `pills`. A body carrying a canon holds a fit and is not currently tagged as such. |
| E6 | A `Find` builder from a `TechniqueEntry` | 1, 2, 3 | One function, so the three acquisition paths cannot disagree about what a manual demands. Should read D3's fields. |

### Verb layer - `src/web/**` and `src/server/consolidated/**`

| # | Item | Serves | Note |
|---|---|---|---|
| V1 | **Fix: no manual means no ceiling** | all | `GameService`'s cap resolution returns `techniqueCap: anyManual ? cap : null`, and `techniqueExhausted(x, null)` is false. A cultivator who knows no cultivation manual is therefore uncapped, so the current optimal play at any cap is to forget your book. The engine default is deliberate legacy behaviour for callers with no manual declared; the web layer must not inherit it. Raw cultivation with no manual needs its own floor, and it is not infinity. |
| V2 | Show the cap before the decade, not after | 3rd constraint above | The rate breakdown already carries "The manual ends at <rank>". Surface it on the manual, on `status`, and at the moment of learning. |
| V3 | An acquisition verb that reports fit | 1, 1b, 2, 3 | "I take the manual" must return `Suitability.line` in the same response as the acquisition. A player must never be able to acquire something and find out later. |
| V4 | Volume-aware learning | 1b | `learnTechnique` accepts a volume; the cap it contributes comes from E1. |
| V5 | A derive verb | 7 | Gated on E2, priced in years, and refusing with `daoGate`'s own vocabulary so the two refusals read alike. |
| V6 | **Fix: a house may only teach what a house holds** | 9 | `handleCurriculum` validates that a technique id exists and nothing else, so a head can decree a ruin manual onto a shelf, contradicting `sects.ts`'s stated invariant. Check possession before adding. |
| V7 | Corpse and grave inventories surfaced as finds | 3 | The tables and repository exist and nothing in the cultivation verb layer reads them. |
| V8 | `DiscoveryContext.tradition` populated from real membership | 6 | The field exists, is documented, and is never supplied, so adoption into a Dao house currently grants nothing. |
| V9 | War and spoils, or an explicit statement that the engine has no answer yet | 8 | Siphoning is fully built; the collective version is not. "The engine has no answer for this yet" is a legitimate sentence and belongs in `sects.md` if that is the decision. |
| V10 | Contribution surfaced against the shelf | 5 | A player should be able to ask what the next rank up would let them read, and get a real answer off `SECTS[].teaches` and `powersAt`. |

### Cross-cutting

| # | Item | Note |
|---|---|---|
| X1 | One test that the corridor has no gaps | For every ordinal below the last crossing, at least one cultivation manual exists with `requiredOrdinal <= n` and `cap > n`. It passes today. It should fail loudly the day somebody retires a manual, because a gap there is an unwinnable game and nothing currently notices. |
| X2 | One test that every choke point has a route | At each ordinal where exactly one manual continues, that manual has at least one route in the five-route enumeration. `heaven-conversing-primordial-canon` currently has exactly one, and it is a parting gift. |
| X3 | Do not let `derived` become a hole-closer | If E3 lands, the same discipline `NO_SURVIVING_COPY_TECHNIQUE_IDS` is held to applies: derivation is the prodigy's road, not the way missing content gets papered over. A test on the ratio, as the routes suite already does. |

---

## Related

<!-- tier: 3 -->

- [`understanding.md`](understanding.md) - the axis that has no ceiling, and route 7's substrate
- [`dao-houses.md`](dao-houses.md) - route 6, and what accumulated knowledge is worth
- [`discovery.md`](discovery.md) - why a rumour is the only way a route reaches a player
- [`origin.md`](origin.md) - privilege buys inputs and never rank, which is why the table above has no empty column
- [`economy.md`](economy.md) - possession, ownership and claim, which is what routes 1b and 8 argue over
- [`../../src/engine/cultivation/README.md`](../../src/engine/cultivation/README.md) - the cap itself
- [`../../src/engine/encounters/README.md`](../../src/engine/encounters/README.md) - suitability, and the miss as a good outcome

---

## Leaving, and what it costs

<!-- tier: 2 trigger="a cultivator considers changing house, is offered a place elsewhere, or leaves one" -->

Most of the routes above are things you do where you stand. This one is the other kind, and it
is the commonest answer in the setting to *my house cannot take me further*: *go somewhere that
can*. Leaving a sect for a better one is the spine of a career here.

The thing that makes it a decision rather than a menu is that **what you know is not only
yours.** A road in your head is your house's property as much as your own, and walking out with
it is how a road escapes into the world. So the terms of a departure are negotiated over the
book, not over the person, and the house's reaction is proportional to what leaves with you.

### The Hollow Court is the exception to all of it

Everything in this section describes leaving as a thing that costs something. **Going to the
Hollow Court costs nothing and is an honour on the house you leave.**

The Court takes people from about ordinal 29 upward, out of any house anywhere. A member
leaving for it is not a defection and is not treated as one: **the original house gains
standing by having produced somebody the Court wanted**, and the Court makes that explicit -
rewards, a celebration, sometimes a dao artifact sent back down. Nobody swears an oath,
nobody buys a release, nobody carries a grievance, and no house has ever gone to war over
one. It is sanctioned by everybody because everybody knows a Court disciple could have come
from anywhere, and because **nobody would start a war with the Hollow Court over any member
at all** - not even its most junior.

And note what "most junior" means here, because it is the fact that sets the Court apart from
every other house on the map: **an OUTER disciple of the Hollow Court is a Void Refinement
cultivator.** Its bottom rung sits at a rung most houses never reach at all, which is the
direct consequence of recruiting from about ordinal 29 upward and taking nobody below it. So
"they would not go to war over an outer disciple" is not a statement about somebody
unimportant - it is a statement that a body whose *lowest* member outranks most houses'
heads is simply not worth crossing at any level.

The reason it can behave this way is that it wants one thing and it is not competing with
anybody for it. **The Court is trying to reach immortality.** It is not accumulating ground,
tenants, curriculum or standing in the province, so a house that loses somebody to it has not
lost anything to a rival.

Three consequences, and they make the Court unlike every other institution in the setting:

- **Its own shelf is OPEN, and it is large.** Everything the Court has legitimately obtained
  over its history is available to its members - not gated by rank, not rationed, not held
  back for favourites. And it has obtained a great deal. **This is the inverse of every other
  house in the setting**, where the book is the guarded thing.
- **What its members BROUGHT is oral, and that is a different rule.** People arrive carrying
  the roads of the houses that raised them, and **the Court does not write those down, out of
  respect for the house each one came from.** So there are two bodies of knowledge inside it
  with opposite properties: the Court's own holdings, written and open, and the incoming
  roads, unwritten and passed person to person - which means an inherited road dies with the
  member who held it if they never taught it on.
- **Inside it, everybody shares freely.** A Court disciple teaches the other disciples what
  their original house taught them. That is the exact inverse of the secrecy economy
  everywhere else in this file, and it is why the Court can go where it goes - it is the one
  place in the world where roads from every house are pooled rather than guarded.
- **It is the reason people want in**, and the reason wanting in is reasonable. Somebody at
  the end of their own house's shelf can reach, in one move, a body holding more roads than
  anyone and giving them away to its own.

**So the scarce thing in the Hollow Court is not knowledge. It is people's hours.** The shelf
is open; what is not open is the living False Immortal, and the seats, and an elder's time.
A disciple's ceiling there is set by whose attention they can get, not by what they are
allowed to read - which is the exact reverse of the problem everywhere else, where the reader
is willing and the book is shut. It is the same scarcity the Deep Survey states about its own
Assessor: the hours he could give a student are the hours he is not doing everything else,
and nobody is told in advance whether the answer will be yes.

Note also what the Court does *not* do with any of it: it does not sell, teach outward, or
leak. Open inside and closed outward is why the houses tolerate it. And the unwritten half is
the Court's own fragility - a road that lives only in one member's head is lost when they
are.

### Inside your own apex, none of this applies

Moving to a stronger house under the same apex - or to the apex itself - **carries no friction
at all.** The road does not leave the bloc that already holds it, nobody has leaked anything to
anybody, and the receiving house is on the same side as the one you left. This is the ordinary
way a promising person rises and it should be the commonest transfer in the world by a wide
margin. An apex is, among other things, a containment sphere for its own curriculum.

Everything below is about crossing OUT of that sphere.

### The two ways out, and the instrument that separates them

**Sworn, on good terms.** The leaver takes a dao oath - carries no manuals out, transmits the
road to nobody - and it is witnessed. The old house lets them go and nothing is owed in either
direction. `THE BOUND WORD` is the institution for exactly this, and note what its own history
says about the weight of the instrument: its founding oath outlived its purpose, the house wants
it gone, it *cannot revise its own instruments*, and the dissolution method for an oath whose
parties are all dead has never worked. **An oath here is permanent even when everybody involved
regrets it.**

**Unsworn, on hostile terms.** They walk out with the road in their head. The new house gains a
shelf entry and pays for it; the old house gains a standing reason to move on them, which arms
if the receiving house ever weakens (see [`sects.md`](sects.md)).

**The oath's price falls on the leaver, and that is what makes the choice real.** A defector's
value to a new house *is* the road they bring - it is what they are paid and promoted for. To
swear is to promise to arrive with nothing to sell: admitted on what you personally are, worth
much less, possibly for centuries. To refuse is to arrive valuable and hand your new house a
permanent liability. Neither dominates.

It also explains why a strong house tolerates defection at all: **it offers the oath first.**
Losing a person is survivable; losing the road is not. A house that lets people go freely on
oath and hunts the ones who refuse is behaving consistently.

### What actually leaves with you, and what the oath actually forbids

**The books stay.** No house lets a departing member walk out with manuals, and none of them
have to guess about it - **a shelf is signed out, and they know who has what.** So a departure
is never about objects. What leaves is what is in your head, which is a worse copy than the
book: partial, remembered, without the commentary and without the teacher who explained it.
That is the thing every negotiation above is actually over.

**And the oath forbids TRANSMISSION, not possession.** This is the distinction that makes the
whole instrument liveable:

- **Being seen practising your old house's road is fine.** Everybody understands what an
  ex-disciple is. Holding is a signature and the signature reads *"this person trained at that
  house"*, which is true and was never a secret. Nobody is in trouble for it.
- **It stops mattering on its own.** As you climb in the new house on the new house's road,
  the old one is superseded - you are simply not practising it any more, and the signature
  fades from your work. **The problem has a natural expiry**, which is exactly why an oath that
  binds forever is not as harsh as it sounds.
- **Teaching it to somebody else is the violation.** And the evidence is not you - it is the
  third party. Your old house sees a stranger practising their road, traces where it came from,
  and arrives at your name. That is when there is trouble, and it is proportionate, because the
  road has now genuinely escaped: there is a person in the world practising it who never trained
  there and owes them nothing.

Two consequences worth building. First, the discovery is DELAYED and indirect - it comes through
somebody else being seen, years later, by people who then work backwards. That is the same shape
as the existing machinery for somebody working out what you did, and it should reuse it rather
than checking anything at the moment of teaching. Second, it means an oath-breaker is usually
caught long after the fact, by which time they have a house, a rank and something to lose, which
is what makes the consequence land.


### The full set of exits

Not all of these are leaving, which is the point - a capped cultivator who thinks the only
options are *stay* and *defect* is missing most of the board.

| Exit | What it costs | When it is correct |
|---|---|---|
| **Rise inside your apex** | nothing | almost always, if the bloc has a deeper shelf |
| **Swear and cross out** | your value on arrival, permanently | the road that fits you is outside, and you cannot afford enemies |
| **Cross out unsworn** | an enemy that waits for you to weaken | the road you carry is worth more than the peace |
| **Take the seat above you** | it is held by a person, not a rule | the shelf is reachable by rank and somebody is in the way |
| **Be seconded to an ally** | you owe the term, and you come back | your house cannot teach you and does not want to lose you |
| **Marry or be adopted in** | you become *of* them; your old loyalties are the price | the receiving house is a family before it is an institution |
| **Be transferred for a fee** | your old house is paid, so no grudge forms | both houses would rather have the receipt than the fight |
| **Buy or barter the road, and stay** | a favour owed upward, spent once | the book is obtainable and the house is not the problem |
| **Schism** | you take people with you, and inherit the war | the disagreement is institutional, not personal |
| **Found your own house** | everything, at first | you hold a road nobody will teach you further on |
| **Go rogue** | no shelf, no backing, no materials | every door above is shut, or you want none of them |

### Money cannot buy a house, and it can buy the people in one

[`items.md`](items.md) says that above a certain line cash is simply not the medium, and that
holds here: **no house sells rank.** Offering a sect stones for a seat reads as not
understanding what you are looking at, and it is the sort of error that ends the conversation.

But that is a statement about the institution, and an institution is made of people. Two
channels stay open to somebody who has just come into real money - and they are different
transactions with different failure modes, which is why they should never be collapsed into one
"bribe" verb:

**Greasing palms.** You are not buying a promotion, you are paying the individuals who decide
one. What money buys is a recommendation, an omission, a name moved up a list, a test scheduled
when the right elder is presiding. The seat is still awarded by the house, on the house's
stated terms, by people who have been paid to see you favourably. This runs through the same
machinery as any other pressure applied to a person - coin is one leverage among several, and
it is priced the same way a threat or an attachment is. So it can be refused, it can be
**reported** to the house, and the person who took it now has something on you as surely as you
have something on them. A righteous house treats a discovered payment as a scandal about its
own member first and about you second.

**Buying a release.** This one the house CAN accept, and the distinction is worth being precise
about: a release is not the purchase of standing, it is **compensation for a loss.** You are
paying an institution for the value of what walks out with you - the years it spent on you and
the road in your head. That is a transaction a house can take without contradicting itself,
because nothing about its own ladder has been sold. It is the fee half of the transfer above,
paid by the leaver instead of by the receiving house, and it settles a departure that would
otherwise be resented.

**It does not buy the road, and it does not replace the oath.** A release covers what the house
is owed for your years; you still may not teach its method to anybody. Being released *with the
right to transmit* is a different purchase entirely - that is the house selling its own
curriculum - and it should be priced ruinously, refused far more often than not, and, by the
[`items.md`](items.md) rule, not payable in money at all above a certain height. So paying your
way out is a way to leave cleanly while carrying much less than a defector does, not a way to
have both.

**But permission to transmit is a sliding scale, not a wall, and the slider is exclusivity.** A
house will never release its unique road - the one that reaches the top, the one only it teaches
- at any price, because the whole value of that road is that nobody else has it. A road it
already shares with several other houses is a different matter entirely: there is nothing left
to protect, the road is out, and letting a departing member carry it costs the house almost
nothing. So the same number that measures how widely a road is held - the one that decides how
safe it is to steal, and how plausibly a stranger practising it could have learned it anywhere -
also decides how cheaply a house will let it go.

Which means a leaver's real question is not *may I take my road* but *which of the roads I know
is common enough to be allowed out*. Somebody who trained at a house with a deep shelf may leave
entirely legitimately carrying the shallow end of it, and that is both the commonest case and a
good one: the world's widely-held roads stay widely held, and the top of each shelf does not
move.

Which makes a sudden windfall a genuine turning point rather than a bigger number. Somebody who
opens a piece of closed ground and comes out rich has not bought their way up the ladder - the
ladder is not for sale - but they can now pay their way OUT of a house that has run out of book,
without swearing away the only thing they have to sell. That is one of the few moments where
stones convert into a rung, and it converts indirectly, through people, at the risk of being
found out.

Two of these are worth more attention than the others when this gets built. **Secondment** is
the answer for the extremely common case where a house likes you and has run out of book - it
uses alliances that already exist, it is not a betrayal, and it produces a person who owes two
houses. And **founding your own** is the only exit that turns a ceiling into an institution: it
is what the world does when somebody holds a road and refuses every offer, and it is where new
houses come from.

### What this means for the world, not just the player

The same rules bind everybody, and most of the interesting consequences are demographic rather
than personal. A road held inside one apex stays inside it. A road that crosses out does so
through a specific person on a specific day, with or without an oath, and either way it is an
event somebody can find out about later. Over centuries that is the whole explanation of why
some roads are held by one house and others by a dozen - and the [items.md](items.md) rule
holds: how many houses teach a thing is measured off what happened, never chosen.

