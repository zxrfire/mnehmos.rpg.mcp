# Open questions

**Read the four items under WHAT STILL NEEDS YOU. Everything below that is history:**
**either answered and built, or a decision of mine left visible so you can reverse it.**

Started the night of 11-12 September and appended to through the 12th by nine agents, so
the sections below are in the order they were written rather than in order of importance.
Anything headed with a date or "being built right now" has since landed.

---

## WHAT STILL NEEDS YOU

All four are done, measured, and none of them was blocking anything already built. They
are kept here with what landed and what is still open under each.

1. **DONE - a posting on the board no longer reprices money**, and the second reading was
   the one that was right. `donate` read contribution off the MEDIAN SPAN of whatever was
   posted to you, so three new sending reasons took 100 spirit stones from 71 contribution
   to 107 against a first promotion of 100. The rule is untouched - buying is still
   `DONATION_DISCOUNT` of the board's own rate - and the SPAN is now the ordinary errand,
   `ORDINARY_DUTY_DAYS`, which is the span `dutyTermsFor` already measures every duty's
   contribution against. So the rate is one number for every house and every rung, and a
   duty reason added tomorrow cannot move it.

   Measured, three seeded worlds, 342 readers, both arms in one run
   (`scripts/probe-what-a-donation-buys.ts`):

   |  | median span | 100 stones bought | against the promotion | bought a rung outright |
   |---|---|---|---|---|
   | bottom band | 30-90 (60) | 36-107 (71) | 0.36-1.07 | 31 of 114 |
   | middle | 30-90 (90) | 36-107 (107) | 0.01-1.07 | 1 of 114 |
   | top | 90 | 107 | 0.00-0.04 | 0 |
   | **all three, after** | not read | **24** | **0.24 at the first rung** | **0** |

   The anchor was not only drifting with the catalog: at ONE rung it already came out 30,
   60 or 90 days depending on the house, so the same hundred stones met three different
   answers for no reason a player could see. What replaces it makes one statement that
   holds everywhere - **buying a rung costs three times the money serving for it would
   have paid you**, which is `DONATION_DISCOUNT` read as a sentence.

   The third reading, a fixed span, is what landed; the first, that the median is a fact
   about the house, is what was rejected, and the section below headed with the same
   finding records why. Guarded by
   `tests/engine/encounters/a-posting-does-not-reprice-a-donation.test.ts` and a played
   assertion in `tests/web/paying-into-the-ledger.test.ts`, red-checked by putting the
   median back.

   **One residual, and it is yours because it is a catalog number.** The FLOOR under a
   donation is the house's own lowest stipend, which is per house and right. At one house
   of 38 it is big enough that the smallest donation the house will accept buys a first
   rung: The Hollow Court pays 500 a month at its bottom rank, and 500 stones is 119
   contribution against a rung of 100. The fix is a stipend or a floor, not an anchor.

2. **DONE - what `sealed` means on a ruin**, and it uncovered a dead mechanic under it.
   `howThisGroundIsShut` in
   `src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.ts` reads the record
   as open, shut until its season, or shut until somebody opens it, and names the day the
   next door opens. No new field. Measured over twelve pinned worlds: 144 ruins at day 0,
   72 with a cycle, 9 open, 72 shut until a season, 63 shut until somebody opens them; at
   two hundred years 445 ruins, 264 open, 72 / 109, 217 spent.

   **What still needs you: the world has never once opened one of these doors.**
   `nextOpeningDay` answers null for anything sealed, every seeded ruin with a cycle is
   sealed, and `applyConvergences` reads exactly that function - so across twelve worlds
   run two hundred years each the world opened and shut **zero** doors on its own. The
   reading now gets past the flag (`whenTheScheduleNextOpens` in `convergence.ts`); the
   yearly pass was left alone because making half the world's ancient sites start opening
   is a world-simulation change, not a reading. `readSchedule`, the gated half that tells
   a house when a door is due and is exactly the information edge you described, has no
   caller anywhere.

3. **DONE - monopoly**, as the act and the accounts it opens.
   `shutAPublicRuin` in `src/engine/world/a-house-that-shuts-a-public-ruin.ts`.
   `controllingFactionId` on a ruin now means a house has shut something public, which is
   the meaning `whoTurnsYouAwayFrom` already reads as somebody standing at the door. Who
   is angry is derived: the houses seated in the ruin's own province. Measured over the
   same twelve worlds at day 0 - of 456 house-and-open-ruin pairs the act is available on
   41, refused 358 times for the province and 57 for want of anybody who could stand
   there, and each one that lands opens a median of 18 accounts.

   **What still needs you: nothing types it and nothing does anything about it.** There is
   no verb in `src/web/`, so only the engine can perform it; and an angry house holds an
   account it never acts on, because `whatTheHouseDoesAboutIt` answers for a house and a
   person, not for a house and a house.

4. **DONE - a gathering can fold into itself**, and no kind is exempt from the ratchet
   any more. `reserveFactSlot` in `history.ts` hands out the fact id and the row's place
   in the ledger WITHOUT the row, so the four passes get the id their ties carry and the
   row is appended once, with what actually happened in it. No restructure was needed:
   the passes were never the obstacle, the id was. Measured, eight worlds across ten
   horizons from 200 to 1,000 years - gathering duplicates 2 to 0, every other world 0 to
   0 with its row count unchanged, which is also the evidence that nothing else moved.

   The sweep turned up a second thing worth knowing: **`gathering` was the only writer in
   the world layer that appends and rewrites** (`resolveFact` and `explainFact` could do
   the same damage and have no callers), but it was NOT the only source of duplicate rows.
   Nine callers pass `recur: false` deliberately - two promotions to the same seat are two
   events in one career - and the guard could not tell those from a failure to fold, so it
   would have failed on `recur-world-b` and two others. Rows that asked to keep their own
   now say so on themselves (`keptItsOwnRow`), which is what let the `gathering` exception
   come out without a kind replacing it.

---

## History, in the order it was written

## What is being built right now, from your rulings

Six agents, so you can tell what landed from what did not:

| | your ruling |
|---|---|
| **elder life + sect diplomacy** | the patriarch gives orders, not requests; postings to better cities; taking a disciple; auction both ways |
| **dao ground + haggling** | ground is public / private / restricted, not a membership test; haggling is item-for-item and a refusal tells you what would work |
| **news travels** | two axes, distance and importance; a breakthrough files a deed scaled by rung; a sitting delivers what arrived IF somebody would deliver to you |
| **inventory + residence + renames** | one general inventory, not bespoke; a residence holds things and NPCs have them; manuals are complete / missing sections / ruined; rename the essayist encounters |
| *(landed)* | the narrator is told it is a xianxia novelist, not a renderer of findings |
| *(queued)* | the tests typecheck session |

---

## ANSWERED: the immortal/chaos count, and one thing that needs your call

You asked me to check whether there are enough immortal and chaos arts for the
single-use rule to matter. Measured on a seeded world, population 400:

- **The catalog is fine: 26 immortal arts and 29 chaos arts.** Not few at all.
- **The WORLD is the problem.** Across 124 library rows and 36 live houses, only **6
  immortal and 2 chaos distinct arts sit on any shelf anywhere**. 30 of 36 houses hold no
  immortal road; 34 of 36 hold no chaos road.
- **So the bottleneck is `TAUGHT`** — each house's `teaches` list — not the number of arts
  that exist. Your instinct was right about the symptom and wrong about the cause.

**Your apex rule is already satisfied wherever it CAN be.** Of the three `APEX_INSTITUTIONS`
only one is a house: `apex-azure-cloud`. It already holds exactly one immortal (Silk Drawing
Scripture) and one chaos (Clear Terrace Ascension Canon). The Earth Vein Tower and The Long
Cut have `factionId: null`, are in no faction row, and teach nothing — which
`seedSectLibraries` records as deliberate (*"two powers teach nothing, deliberately"*) and
`governance-and-water-rights.ts` argues for at length.

**The call you need to make:** those two apexes cannot be given arts without overturning a
stated design decision about what they ARE. Leave them as powers that teach nothing, or
make them houses?

**And the bigger finding underneath it.** `sect-kiln-wardens` (Deeproot Court) sits at
ceiling **44 — the highest in the world**, holds the strongest sealed ancestor, and
**teaches nothing at all**. Spreading immortal and chaos roads across the high houses is
what would actually produce "multiple chosen like the novels", and it is a catalog edit
plus the political half of who gets the one reading. Routed to the elder agent, since it is
the same `refreshChosen` / `chooseTheChosen` machinery.

---

## A design question the night surfaced: does haggling cost a day?

Haggling is built and works. `whatTheyWillTakeInsteadOfMoney` puts an offer on a ladder -
**stones < goods < a favour < a service < a hold** - from the corpus reading that being
asked for money is a RELIEF, and a refused offer names the rung that would have worked.
Board prices correctly do not move: *"the rate is the rate, it is the same rate for the
next person in the queue."*

**But the sentences people actually type at a stall do not reach it.** `that's too
expensive`, `I offer him twenty stones` and `counter-offer` all parse to `interact/trade`,
and that intent has no resolver - it falls through to a question put back to the player.

I tried the one-word fix (adding `trade` beside `negotiate` in `ATTEMPT_INTENTS`) and
**reverted it**, because a test caught what it actually means: that set makes an intent
PRESS somebody, which spends a day. Every counter-offer would burn a day, which is the
opposite of your *"you can change what you offer"*. It needs its own resolver, not
membership in the pressing set, and that is a design call:

**Question:** is haggling a free action - you can go back and forth, and only the
ACCEPTANCE costs - or does each offer cost you something?

Two smaller things in the same area, both real:

- **"the stallholder" resolves to nobody.** A stall is not a person in the roster, so
  market haggling has no counterparty to address even once the verb works.
- **`what is my rank`** still reaches `status`, which prints realm, root and attributes and
  never names the house or the rank.

---

## Still open, and I could not decide them for you

Nothing. You cleared all three before going to bed, and they are routed:

- **apex arts** - every apex house holds at least one immortal and one chaos art, their
  spent-or-kept state varied deliberately, and the giving of them political: only to the
  chosen, only once proven. Counting comes first, so we know what the catalog holds today.
- **subcontracting** - approved and building. The board still belongs to the house and a
  rogue still cannot take from it; a disciple who HAS taken a duty can pay somebody else
  to do it. Both directions, and the rogue-being-paid direction matters most because it
  is the one that answers "a rogue has nothing to do".
- **a rogue's quiet decade** - deliberate, and it stays quiet. But INTERRUPTION is not
  gated on standing: two juniors brawling disturb a senior, and that is a trope rather
  than a delivery. Delivery is gated, interruption is not.

## Standing task: the elder pass

Left for me before you slept:

> "don't forget to remind yourself to do a pass over this other stuff cuz clearly there is
> SOMETHING to do for elders and the player can be an elder"

Two claims in that, and I am checking BOTH rather than taking either on faith:

1. **The player can become an elder.** Verify the path is reachable by PLAYING, end to
   end - joining, rising, holding an office - not merely arrangeable with ADMIN. A rank
   nothing can reach is content that does not exist.
2. **There is something for an elder to do.** The affordance probe measured 3.3 acts a
   square at the top band against 4.0 at the bottom, so the game currently gets THINNER as
   you climb. If the elder machinery is wired and simply not reachable, that is a very
   different fix from it not being wired.

An agent is building elder life in parallel - the patriarch's orders, postings, taking a
disciple, auction. This pass is mine and is about REACHABILITY, which is the half an agent
building features will not check on its own.

**FIRST PASS DONE, and the answer to your first claim is YES.** Played it: join a house,
ask to be promoted, and the engine answers

    Sand Well Caravan will not raise Shen Wuyou to Carrier yet: needs realm Qi Condensation
    Layer 5 (currently Qi Condensation Layer 1) and 100 contribution

which names the gate and exactly what would change it. The promotion machinery is wired
for the player, not only for the simulation. There IS a path.

**And the ladder is already visible, through a read almost nothing reaches.** `sect` with
intent `standing` answers:

    Skin of Sand Well Caravan, 0 contribution, 2 spirit stones a month.
    Nine Boards Qiu stands highest in it, at Core Formation Late and titled Waterman.
    Carrier wants Qi Condensation Layer 5, which is 4 rungs up and 100 contribution.

Membership, rank, stipend, who is above you, what the next rung costs. Your visibility
principle, already satisfied - by a read the natural sentences do not reach.

**Three defects found, one fixed:**

- FIXED: the sect listing said *"You are not on anybody's roll and no house has been asked
  yet"* to somebody who had joined a turn earlier. It was gated on whether any house WOULD
  admit you, never on whether one already had - so the engine contradicted its own
  `sectId`. It landed on "what sect am I in", a direct question about the membership it
  was denying.
- ROUTED to the pattern-table agent: `what sect am I in` and `what house am I in` fall
  through to the catalogue of houses that would take you, and `am I in a sect` is a blank
  look. All three should reach `standing`.
- ROUTED: `what is my rank` reaches `status`, which prints realm, root and attributes and
  never names the house or the rank.

## Decisions of mine; reverse them if you disagree

### 4. Turn 0 sits outside the corpus band on purpose
You ruled it the exception: it is about who you are, so it is narration and nobody needs
to speak. It runs 21% speech against 24-38% everywhere else, and is the longest turn.

### 5. I stopped tuning the one-liner rate
Counting said 6-30% by book. Reading said the 30% outlier is the one work by a different
author; the other 23 run 7.2-15.2%, median 9.1%. Composition matters more than rate: two
thirds are a flat act or reveal, a fifth a line of speech alone, an eighth the body doing
one thing.

### 6. Attribution is improving and I am leaving it alone
The corpus carries no speech verb on 75% of its dialogue paragraphs. We were at ~100%;
after telling the narrator it is a novelist it reads 33-50%. I am not tuning it further
because the metric counts a closed verb list and cannot see "a voice drifts from the
crowd".

---

## For the morning, not tonight

### 7. The prose has arrived, and here is the evidence

Telling the narrator it is a novelist rather than a renderer of findings did it. A played
turn, gemma narrating, `I ask Tang Xuxue about the caravan`:

    "Fifteen stones," the stallholder says.

    Thirty stones in the purse. Fifteen for the book. It is a steep price for a farm boy,
    but it is the...

    "The Great Peace is the only one moving this season," Tang Xuxue says. "If you are
    looking for a sea..."

    "The Great Peace? Hah! They'll take any fool with a few stones to spare."

    "And most of those fools end up as crow-feed before the first moon."

    Tang Xuxue does not look at the voices in the crowd. There is no reason to.

Unattributed crowd taking sides, contempt, hyperbole, a named person pointedly ignoring
them, and a one-line beat to close. Measured across four played turns:

| | ours | corpus |
|---|---|---|
| median words | 21-44 | 21-40 |
| speech | 38-71% | 24-38% |
| **attribution** | **0-33%** | **~25%** |
| one-liners | 0-29% | 7-15% |

**Attribution was the last big lever and it has landed** - about 100% down to 0-33%, which
is at or below the corpus. Speech runs high on some turns and one-liners swing either side;
both are variance rather than a direction, and I am not tuning further.

### 7b. Old note: the remaining gap was paragraph length
With the novelist identity in, speech is in band (21-43% against 24-38%) and the crowd
talks properly - *"He's just staring at the boards," a voice drifts from the crowd.
"Staring won't buy him a way out of this hole."* What is still off is that some turns run
long: one came back at a 53-word median against a corpus 21-40.

### 8. 521 type errors in `tests/`
`tsconfig.json` excludes `tests/` and vitest strips types without checking, so a test
file is checked by neither command anybody runs. It already hid one live bug. You said to
spin up a session for it; that is queued behind the six running now, because it will
touch every test file and would collide with all of them.

---

## The Root Cauldron: what landed, and what is routed

Built from your ruling on what the two courts are watching. The object, the arithmetic,
the leak as a posted duty and the honest refusal at the gate are in. Four things are not,
and this is where they are written down.

### 9. A NOMINATION HAS NO MACHINERY, AND IT IS THE ROAD TO THE BEST POSTING IN THE WORLD

The largest finding of the session. `a-favour-skips-the-admission-bar.ts` says twice, for
both bodies, that these are *"the two with no door at all"* and that **a favour is the
wrong instrument here and the right one is a nomination**. It also says the Deeproot
Court's *"nominations carry"* inside its apex and that the Course Keepers *"have never
once declined one of its names."*

Measured: `grep -rn "nominat" src/engine src/web src/server` returns **one line**, and it
is a comment in `spending-a-word-to-place-a-child.ts` saying a word is the wrong
instrument and a nomination is not. **There is no nomination anywhere in the engine.**

So the most sought-after position in the world has a stated road and nothing implementing
it. That is the failure pattern this repo keeps hitting: a capability written on one side
and nothing routed to it. I did not build a nomination system on my own initiative.

**BUILT.** `src/engine/social-leverage/who-can-put-your-name-up-for-a-posting.ts` is the
instrument: who may nominate whom, derived from the parentage chain, `Parentage.standing`
and the relationship layer rather than listed; what the ask weighs; what it costs the
NOMINATOR, which is the half that makes it a different instrument from a favour - a
`blocked_advancement` grudge held by somebody passed over, about the house that chose,
where a favour leaves a debt owed to the person asked. `whyYouCannotBePostedThere` now
names the bodies whose names that apex reads and how many rungs short the reader is, and
`petition` answers a posting in the instrument's own terms.

Measured: 13 of 38 sects reach a posting at all; the Kiln Court's apex reads 4 sects' names
plus the Court's own, the Deeproot Court's 8 plus its own. **The work stands at ordinal 25
and 21 - twenty-odd rungs above where a run opens - so this is a mid-game road, and the
engine says the number rather than pretending otherwise.**

**What is still missing, and it is one thing:** nothing in the game GRANTS one.
`aNameGoesUp` writes the rows a granted nomination produces and has no caller, because
being posted is not a state a run can be in - there is no Warden rank a player can hold and
no term to serve. What would call it is a `request` at a person inside a nominating house
resolving `taken`, plus somewhere to put the posting. Until that exists the road is
legible, priced and walkable up to its last step.

### 10. The bloodlust and the wardens' madness are ONE mechanic, and it is already built

`WHAT_A_HALF_MAD_STRETCH_DOES` in `half-mad-stretch.ts` is *"what somebody does with a
month they were not entirely steering"* - a fight unpicked, a thing taken, a month of not
stopping - resolved as deeds rather than as a status word. That is the bloodlust a
cauldron-born weapon inflicts and it is the madness a warden takes off the leak. It has
exactly one caller, `alchemy-manage.ts`.

Not built: the second caller. Carrying a `derangement-bearing` object, or standing a watch
without the nightly cleansing, should resolve a stretch the same way the golden pill does.
The cheap version of the cleansing is one `DeviationRiskOptions` field and one constant in
`deviation.ts` - that file already prices risk from named sources and takes caller-supplied
options, so nights uncleansed is a row and not a track. I did not add it, because an unwired
opts field is the defect `furnace-technique.ts` is the standing example of.

### 11. Renaming the two courts: proposed, not done

You asked for xianxia ids and names, and for the `sect-kiln-wardens` / "Deeproot Court"
id/name mismatch fixed. **I did not do it, deliberately**, for three reasons: another agent
is mid-sweep renaming The Long Cut across ~30 of the same files; `Kiln` occurs inside
longer strings everywhere (`Kiln Wardens`, `Keeper of the Kiln`, `Kiln Gate Seal`,
`court-kiln`, `sect-kiln-wardens`), which is exactly the `The Root` -> `Root Hollow`
mangling `a-rename-did-not-mangle-a-name.test.ts` exists to catch; and a rename is done
across the whole tree at once or not at all.

Proposed, now that we know what they guard - a cauldron in two pieces, a belly that makes
a blade and a lid that makes a shield:

| today | proposed name | proposed id |
|---|---|---|
| `court-kiln` / The Kiln Court | The Deep Belly Court | `court-deep-belly` |
| `sect-kiln-wardens` / Deeproot Court | The Lifted Lid Court | `court-lifted-lid` |

Siblings, both name the piece they hold, and the second finally has an id that matches its
name. `event-the-reposting` in `faction-history.ts` carries both old ids in its `parties`
array and is one of the places a sweep has to reach.

### 12. The token challenge has its facts and no encounter

`whatTheTwoSay` in `a-house-knows-its-own-by-a-plate-and-a-token.ts` states what the object
names, what the token names, and whether they agree - including the harsh case where
somebody carries no token at all. It deliberately does not resolve who is lying, because
that module's own rule is that a tag authenticates the line and not the person.

Not built: the encounter that puts the question. Somebody senior enough to know what a
cauldron-born weapon is should ask to see a token, and the asking has to fire on the
CHALLENGER's awareness rather than on the object.

### 13. Crafting does not model materials as a gate, and its own comment says it does

Found while establishing what a heaven-grade artifact actually costs. In
`commissioning-a-craft.ts`, `whetherTheirHandsCanDoIt` opens with

    // Whether this pair of hands could make it at all. The material gate first,
    // because it is the one that names a realm to reach for.

and then checks `canRefineGrade(ask.grade, makerOrdinal)` and nothing else. **That is the
MAKER'S RUNG, not the material.** Nothing anywhere reads whether the person commissioning
the work is holding, or could obtain, a scrap of the grade they are asking for. So in the
engine as it stands, anybody who can find a hand at ordinal 29 can have a heaven-grade
artifact for the asking.

This matters to the cauldron directly, because the cauldron's entire reason to exist is
that it meets the MATERIAL requirement out of people when the material cannot be got. If
the material is not a gate, the cauldron has no benefit and the whole design loses its
point. The catalog now states the requirement; the engine does not enforce it.

Worth knowing alongside it: `beasts.ts` holds six heaven-grade material rows, and
`BEAST_SPEECH_ORDINAL` is 29 - at and above which a beast *"has a shape, it has a voice, it
can decline."* So the ordinary road to heaven-grade material is already killing somebody who
can talk. The cauldron is not exotic beside it; it is the same act with the species changed.

### 14. Asking a changed beast for its own material: the fact is true, the encounter is not built

Ruled: above `BEAST_CHANGE_ORDINAL` a beast is a person, so material may be ASKED FOR or
BOUGHT as well as cut off a corpse - and that is the only road to it a righteous house can
walk, since hunting is closed to them and the cauldron is worse. Without it, righteousness
is locked out of the top of the artifact economy by arithmetic rather than by any decision.

In: `THREE_ROADS_TO_WHAT_A_PERSON_CARRIES` in `beasts.ts` states the three roads and which
alignment may walk each, and points at the existing ladder rather than inventing a currency.
Goodwill is not a new number: having done somebody a kindness is what puts you on the
FAVOUR rung of `what-they-will-take-instead-of-money.ts`, which changes which rung you stand
on and never the size of the ask - so kindness is real and usually insufficient, which is
the shape that was asked for.

Not built: the encounter. A changed beast has to be reachable as a counterparty and asked.
The machinery landed this session and should be used rather than duplicated -
`src/web/going-back-and-forth-over-a-price.ts` and `haggleOverAPrice`, with
`whereTheOfferLanded` naming the rung that would have worked when an offer is refused. I did
not build it because the verb path runs through `turn-engine.ts`, which another agent owns.

### 15. Drop grade now derives from the source's rung, and one thing is still yours to decide

RULED and built: a drop's grade is a function of what the source was standing at when it
died, not a field on the row. `gradeOfWhatItYielded` in `hunting-a-spirit-beast.ts` is one
line and calls `gradeOfWhatABodyYields` - the function that already answers this for a dead
cultivator - so a dead beast and a dead cultivator are answered by the same code. Same
Thunder Hawk Core either way; kill the hawk young and it is the earth-grade version, kill it
old and it is the heaven-grade one. `objectForBeastMaterial` mints with the derived grade.

The alignment fault line now falls out with nothing authored: the heaven-grade version only
comes off a source at or above `BEAST_CHANGE_ORDINAL`, and anything standing there has a
shape and a voice. It also answers why nobody lets a spirit beast grow old.

I DID NOT raise the six source beasts, and I reverted the raise I had started on your earlier
instruction - the ordinals and `speaks` are back exactly as they were. Under the derivation
they do not need to move.

**THE ONE THING LEFT, AND IT IS A DESIGN CALL.** The Millennial Tortoise stands at ordinal 31
with `speaks: false`, above `BEAST_CHANGE_ORDINAL`, and its own row comment says *"standing at
a rung where killing it is killing a person."* I set `speaks: true` as the obvious bug fix and
**a test went red**: `cultivation-beasts.test.ts` pins *"the two things anybody could actually
negotiate with yield nothing at all, which is what keeps the line from being a price list"* -
so a beast that speaks may hold no materials, and the Tortoise holds three. The file header
says the same thing from the other end: 29 and up is *"a person... this catalog carries only
three entries at 29 and gives none of them materials."*

So `speaks: false` on the Tortoise is not a bug, it is the catalog keeping its own contract.
The real inconsistency is that a beast at 31 is in the beast catalog holding stock at all.
Three ways out, and none is an agent's to pick:

- Let it speak and strip its three materials. Removes a heaven-grade material from the
  palette another agent is building artifact recipes against right now.
- Drop it below 29 so the catalog's own rule holds.
- Change the rule: let a beast that speaks still yield materials, which is coherent under the
  new derivation but overturns a stated design line and a test.

I reverted `speaks` to `false` to keep the tree green and that agent's palette intact.

One more thing worth knowing rather than acting on: `objectForBeastMaterial` already tags
`taken_from_something_that_spoke` and sets `data.spoke`. Those are pre-existing and are
properties of the SOURCE recorded on the object, not a grade flag on the material - I did not
add them and did not touch them, but you said no "came from something sapient" flag should
exist, so you should know they are there.

### 16. An elder's escort does not name WHERE, and nothing posted anywhere does

BUILT: an elder reads the disciples' wall and can take a line off it, and a peer or the
patriarch asks an elder to go out with named juniors on a posting pitched at the juniors'
rung. Delivery split unchanged: the wall for what is pitched under the house's ceiling,
word of mouth for what touches it.

NOT BUILT, and it is the half of your requirement I could not reach cheaply. **No posting in
the game names where it goes.** `aPostingAsAnOffer` takes a `placeName` and puts it in the
title - "An escort at Autumn Gate, for Azure Cloud Pavilion" - and **no caller anywhere
passes one**, not `sectBoardFor` and not the summons draw, so every posted duty in play is
"An escort, for Azure Cloud Pavilion". The machinery for the answer already exists and is
wired to nothing on this side: `whereASendingGoes` decides a destination off the reason's own
`needs` key, and the world's own sendings use it.

What it needs is a `placeFor` composed in `src/web/encounters.ts` - the seats in play, the
places that are nobody's seat, and a draw off the caller's stream - handed to both
`whatAHouseHasOnItsBoard` callers. It is a contained change and it touches every posting in
the game, which is why I left it rather than folding it into this one.

Two smaller things found on the way:

- `TIER_NAMES.dismissed` is the string `'Not posted'`, and work seventeen or more rungs under
  a reader now IS posted and takeable off a wall. The board prints the tier name on every
  line, so a reader can be shown "Azure Cloud Pavilion, not posted at Qi Condensation Layer
  3". It reads wrong in the chronicle too - `newsOfASending` prints "a not posted at ordinal
  4". A rename is one word in one Record, but it is catalog content and renames go across the
  tree at once, so it is yours.
- `pitchedWellBeneath` rides `completeDuty`'s settlement line, which is the facts channel the
  caller already narrates, and that puts the fact at COMPLETION rather than at acceptance.
  Taking and serving are one turn today so it reaches the player either way. Stating it at
  acceptance instead is one line in `turn-engine.ts`'s `duty()`, next to the provisioning
  warning - `sayThisWhateverTheNarratorDoes(facts, pitchedWellBeneath(duty.pitchOrdinal,
  cultivator.realmOrdinal))` - and I did not write it because another agent owns that file.

AND ONE THAT IS NOT MINE. `tests/web/a-wall-says-what-is-on-it-even-when-none-of-it-is-yours.test.ts`
is red on the shared tree: it asserts every posted refusal shown to a rogue names the roll,
and `whyYouCannotBePostedThere` - correctly - does not, because the Deeproot Court admits
nobody. That house is being renamed by another agent right now and it now sits in a province
in the pinned world `a-wall-is-never-empty`. I confirmed the failure is independent of my
change by reverting both halves of mine and re-running. It belongs to whoever lands the apex
rename.

---

## The fox you save and the tortoise who guards you: where the chain actually breaks

Walked rather than guessed, while building the changed-beast spawn. Four links, and the
first two are broken in the same place.

**The awareness half is not broken and needed nothing.** `knowledge_records` is keyed on
`holder_id`, which is any person's row id, and NPCs already hold rows in it - combat
losers, students, masters, anybody who hears of a wrong. `askedAbout` already reads
`isAwareOf(who.id, ...)` to decide whether the person being asked has anything to say, and
`whatTheyRecogniseAboutIt` already reads `stageOf(them.id, 'sect', house)` as its reference
axis. Bidirectional is what a two-holder table already is: one row for what she knows of
you, one for what you know of her, and either may be missing. The `AwarenessSchema` in
`governance-and-water-rights.ts` is a re-declaration of the same six rungs as inert catalog
content - a SEEDING input on a site or a house row, not a live store - and reading it as
the live ladder is what makes the system look player-only. The live one is `KnowingStage`
in `src/engine/social/discovery.ts`, carried as a tag on an ordinary knowledge row.

**Link 1 - helping a beast leaves no trace. THE FIRST BREAK.** `ObligationRecord.holderId`
and `subjectId` are plain strings and would happily point at a beast. Nothing ever gives
one an id. `WhatIsOnThisGround` in `hunting-a-spirit-beast.ts` answers what is on a piece
of ground out of the catalog; there is no per-instance row anywhere, so the hare you spared
is one of a count and there is nothing to hang a favour on.

**Link 2 - nothing promotes a beast, ever.** Nothing in `the-world-changing-on-its-own.ts`
moves a beast's ordinal; `beast.ordinal` is a catalog constant read in place. So the event
"it crossed 29 and became a person" does not exist as a thing the world can do. A changed
beast today can only be authored into the catalog or stood up by ADMIN.

**Link 3 - identity therefore cannot survive, because there is none to survive.** This is
the real design question and it is yours, not mine: **the trope needs the beast to become
tracked at the moment somebody INTERACTS with it, not at 29.** A player who spares one of
three counted hawks at ordinal 20 has done something to a quantity. If the promotion is at
29 there is nothing to carry across; if it is at first contact, then sparing it is what
mints the row, which is also the only reading under which "it remembers who helped it"
means anything. I did not guess which.

**Link 4 would then be free.** It seeks you out, gives you something, stands beside you -
that is ordinary obligation and relationship behaviour over a person with a row, and none
of it needs beast code.

**On `howAGradeIsStored`.** It takes a `TechniqueGrade` and returns `counted` for `mortal`
and `earth`, `tracked` above. Your "even an earth grade beast should be a tracked entity"
and your next clause "i mean, counted entity per location" disagree, and the second one is
what the function already says: earth is counted, heaven and up is tracked, and 17-28 is
exactly the earth band. So the boundary maps and needs no third expression - but it takes a
GRADE, and a beast has an ordinal rather than a grade, so something has to name the band.
`gradeOfWhatABodyYields` is the obvious bridge and is another agent's file today.

**What ADMIN can do about it now.** `ADMIN spawn_encounter species=<fox|ape|sleeper>` mints
the row directly, which is the whole of the promotion for testing purposes and is not the
promotion.

**And one more, on the fox inventing badly.** `WHAT_GIVES_A_CHANGED_BEAST_AWAY.howItSurfaces`
says the absence shows twice - not knowing when at ease, inventing badly when trying - and
that the second is the sharper scene. `SourceKind` already carries `fabricated` and there is
an index on it (`migrations.social.ts`), so a lie is meant to be a real row with a real flag
rather than a narration style. **Exactly one place writes one**:
`asking-what-people-are-saying.ts:318`, where a hearer records a rumour that was invented
upstream. Nothing writes a `fabricated` row for somebody inventing an account of THEMSELVES -
which is the cover story, and the only thing that would let a local catch one later. That is
the missing write path, and it is not beast-specific: it is the same hole for a wanderer
using a false name.

### 17. Judgement: the two ends are built and the middle is not

BUILT THIS PASS, so the rest of this entry is what sits on top of it: `mission_hall` is a room
purpose, `office` is its own column on `PurposeSpec` (it was `sealed`, and an office that must
not lock could not exist), and `who-works-in-an-elders-hall.ts` reads who WORKS in a room as
well as who is over it, with a two-value remit - the holder DECIDES about a room, the staff
HANDLE what passes through it.

NOT BUILT: the judgement. And the striking thing about it is how little is actually missing.

**The front door exists.** `src/engine/social-leverage/reporting-what-you-saw.ts` - a witness
takes what they watched you do to whoever holds the room complaints go to. No RNG; every branch
reads a row that exists for another reason. `src/web/false-decree-reports.ts` is its player-side
half.

**The instruments all exist.** In the order a sentence would reach for them:

| sentence | what it already is |
|---|---|
| no case | nothing written. The ledger simply gains no row |
| a rebuke | an `ObligationRecord` and nothing else. `src/engine/social/grudges.ts` |
| a fine | contribution and stones already move. `sect_members.contribution`, `applyDeltas` |
| taking back what was given | `src/engine/world/a-house-bestows-a-thing-on-somebody-who-earned-it.ts`. Its gift-vs-loan split is the whole of "depends": recalling a LOAN is barely a sanction, taking back a BESTOWAL undoes something earned |
| years sealed and held | `src/engine/social/what-laying-a-qi-seal-takes.ts` plus the `punishment_hall`, whose `qiLift: -10` is the only negative in the room table and already prices the stay |
| crippling | `'crippling'` severity and `isPermanentWound` in `src/data/cultivation/wounds.ts` |
| death | and at an apex this is the act that feeds `THE_ROOT_CAULDRON` in `artifacts.ts` |

**What is missing is one function**: somebody weighing a report and returning one of those. The
reading has three inputs, all of which are already written down somewhere else - whether it can
be shown (`reporting-what-you-saw.ts` already answers whether a witness speaks), how bad it was
(`Severity` on the ledger row), and what kind of house this is (`SectAlignment`, and
`demonic-sects-and-what-they-are-willing-to-do.ts` states what each kind will actually do to
people). No table of offences. If somebody writes a list of crimes with punishments beside them,
that is the bespoke version of two facts the catalogs already carry.

**Intercession is the same shape one step further.** `whoseCallItIs` already narrows a room's
question to its holder plus the head, and `whatTheBodyWants` already knows that a patriarch can
overrule elders and can only be overruled when all of them disagree. Pointing that at a sentence
IS the intercession model; what an intercessor spends is a favour rung from
`what-they-will-take-instead-of-money.ts`, and `a-favour-skips-the-admission-bar.ts` is the
precedent for a word moving a bar - including that it names bodies no word can reach, which this
needs too.

**THE SEAL-TERM TENSION IS ALREADY RESOLVED IN THE MODULE, and the answer is the sentence.**
`whatLayingASealTakes` takes `attempt.forDays` and returns *the lesser of what was asked and what
the gap allows*, with the comment *"a house that says a hundred years over a gap that holds for
one has said something it cannot do."* So the sentence is the term, `howLongASealOfThisGapHolds`
is the cap on one application, and a long sentence is a seal renewed - with an escape window at
each renewal, which `whatBreakingASealTakes` and `oddsOfBreakingASeal` already price. Nothing
needs deciding here; it needs reading.

**A correction to the record.** An earlier note in this session said there is no state for being
held by your own house. That was wrong, and the reason is worth keeping: the search was for
imprison/jail/detain and the genre's word is SEAL. What is missing is not detention, it is a
house imposing one on a ruling.

**And one thing the sub-job already gives it.** The bribery trope - stones to a disciple in the
punishment hall for a friend's extra food - needs no bribery-outcome table. `remitOf` says the
hand HANDLES what passes through the room and the elder DECIDES about it, so food and a message
and a slow door are in reach and a shortened sentence is not, without anything about punishment
halls being written down. Asking it about a room nothing has been built in yet still answers,
which is what makes it safe to point at detention before detention exists.

### 18. Two from the previous pass, still open

- **WHERE is still not named on a posting.** `aPostingAsAnOffer` takes a `placeName` and no caller
  passes one; `whereASendingGoes` is the answer and is wired only to the world's own sendings.
  Unchanged from item 16.
- **`TIER_NAMES.dismissed` is still `'Not posted'`** for work that is now posted and takeable.
  Unchanged from item 16.
- **An existing saved world has no mission hall.** `roomsFor` builds one now, so every world
  generated after this change has one, and `whoTakesAReportAt` answers null for a house without
  one - the taking simply says nothing about a hall. That is honest but it means the feature is
  invisible on an old database until the compound is rebuilt. Whether this repo migrates world
  geometry at all is not a question I could answer from inside this change.

### 19. Travelling together: what landed, and what it left open

`src/engine/world/who-is-on-the-road-with-you.ts` makes "who is travelling with me" a reading
over each companion's own `out_with_a_party` activity, and `move`, `ride` and `passage` in
`src/web/travel-verbs.ts` now carry whoever that reading names. What is deliberately not built:

- **An escort duty is a span, so its party cannot be travelled with unless the term is cut
  short.** `goWhereTheHouseSentYou` in `src/web/turn-engine.ts` accepts the ask and immediately
  spends the whole term in one `shortSkip`, so `putThemOnTheRoadWithYou` puts a party on the
  road and `bringHomeWhoeverIsDue` takes it off again inside one turn. The player is only ever
  standing next to the juniors when `aTermCutShort` fired. Either the accept should not span
  (the errand becomes a journey the player steers) or the escort should resolve as a sending
  through `resolveSending`, which already prices what comes back. Both are design questions.

- **The player has no verb for asking somebody to come with them.** `RequestKind` in
  `src/web/what-a-request-asks-and-of-whom.ts` is the nearest existing thing and has no member
  for company; adding one touches `baseWeightOf`, `classify`, `EVERY_REQUEST_KIND` in
  `what-each-verb-is-for-in-the-players-words.ts`, `REQUEST_KINDS` in `asking-verbs.ts` and the
  verb table, and regenerates `docs/verbs.md`. Not a 59th verb, but not small either. The
  refusal side of it is the interesting half: somebody with no reason to follow you declines
  plainly, and somebody who would says what it would take, which is
  `what-asking-this-person-for-this-would-cost-them.ts`'s existing job.

- **Somebody at `mustering` is somebody a player cannot join.** `ActivityKind.mustering`'s own
  doc says *"somebody at this is somebody a player can join"* and `whetherTheyWouldLookUp`
  returns true for it, so the world puts these people in front of the player deliberately. No
  sentence reaches them. This is the cheapest player-initiated producer left.

- **`priceJourney` charges a party walking as though the road had a capacity.**
  `conv-on-foot` declares `heads: 1` like every vehicle, so `priceJourney({conveyance: on-foot,
  heads: 5})` returns `trips: 5` and `daysForEverybody = daysOneWay * 9` for five people on a
  one-day road. `ride` therefore states the trips as a fact and keeps spending `daysOneWay`.
  The fix is in `what-a-conveyance-does-to-a-journey.ts` and is probably that a conveyance with
  no grade has no capacity, but it is that module's call and changing it moves the world sim's
  own sendings, which pass `hands` through `postingFor`.

- **Whether folding away from a party is abandonment or refusal.** `CapabilityGrant`
  `spatial_folding` says *no companion and no passenger at any size*, so `fold` in
  `travel-verbs.ts` refuses outright while anybody is on the road with the player. The other
  reading is that the fold succeeds and the party is left standing - which is a real act in this
  genre, and should then end their `out_with_a_party` activity and be a thing the house hears
  about. Refusing was chosen because doing that to somebody by default is not a decision the
  engine should make for a player.

- **A companion is carried but is not a combatant, a mouth or a purse.** Nothing reads the party
  in `combat-verbs.ts`, in `offerHearing`, or in any fare the player cannot cover - `passage`
  charges the whole party's fare to the player's own purse and refuses if it is short, with no
  sense that five disciples of a house travelling on the house's errand might be paid for by the
  house. `whatTheHouseWillPartWith` is where that would be asked.

### 20. Adding a posting repriced money, and that coupling is yours to rule on

BUILT: three occasions in `SENDING_REASONS` so an escort is not always an errand - a visit to
another house, a friendly competition, and a walk to the edge of forbidden ground. Two new
`needs` keys, no branches.

FOUND ON THE WAY, and it was the only thing here that was not mine to settle. `donate` in
`turn-engine.ts` priced contribution off the MEDIAN SPAN of what was on this person's board:

    const spans = board.offers.map(o => o.terms.days).sort(...)
    const reference = spans[floor(spans.length / 2)] ?? DEFAULT_DUTY_DAYS
    const rate = contributionPerStoneOverDays(reference) * DONATION_DISCOUNT

`daysFor` gives 90 days to a regional posting, 60 to one staking an obligation, 30 to an
open-ended one and 20 to the rest, so the median sits among a handful of discrete spans and two
more regional rows tipped it. Measured on the seed that test pins, same house, same sentence:

    before   9 -> 7 offers, spans 90 90 90 60 30 20 20, median 60, 100 stones -> 71 contribution
    after    9 offers,      spans 90 90 90 90 90 60 30 20 20, median 90, 100 stones -> 107

The RULE is untouched - buying is still exactly `DONATION_DISCOUNT` of the board's own rate, so
it is still strictly worse than serving. What moved is what money is worth against a promotion,
and the first promotion costs 100 contribution: a hundred stones used to be about seven tenths
of a rung and is now a rung and a bit.

Three readings, and none is an agent's to pick:

- The median is right and the number is right: a house whose work is long-haul values a donation
  more, and that is a fact about the house.
- The reference should be what this person could actually SERVE, not everything posted at them.
  Today a posting they will never take still moves what their money buys.
- The reference should not ride the board at all. A fixed span makes the rate a constant and
  makes the catalog safe to extend, at the cost of the derivation the owner asked for.

**RULED AND BUILT: the third, and the cost it was supposed to carry turned out not to exist.**
The span is `ORDINARY_DUTY_DAYS`, and the derivation is entirely intact - the rate is still
`contributionPerStoneOverDays` at a span, still the board's own arithmetic, still nothing
hand-picked. What was given up is only that the span comes from today's notices.

Why the first reading was tested and rejected. It reads as a fact about the house and is not
one: the same house's median moves when the world moves, and across three seeded worlds the
median at ONE rung came out 30, 60 or 90 days depending on which house you had joined, which no
player can see, ask about or plan around. A house whose work runs long is a real fact and it is
already paid - serving a 90 day posting credits four and a half times what an errand does. Saying
it twice, once in the work and once in the price of the ledger, is the same fact stored in two
places.

And the owner's own candidate, **what the house pays per day**, was measured and does not work:
`stipend` is a RETAINER rather than a wage. At the bottom band it runs 1 to 500 stones a month
and is 0.05 to 4.39 of what one errand pays for a day; at the top, 30 to 12,000, and up to 72
times errand pay. Anchoring money to it would swing what a donation buys by three orders of
magnitude between houses, which is the drift complained of, worse. The stipend keeps the job it
already has here, which is the FLOOR under a donation - a house will not open the book for less
than it pays its least important member in a month - and that one is per house and correct.

The rule now states in one sentence: **buying a rung costs three times the money serving for it
would have paid you**, everywhere, forever, which is `DONATION_DISCOUNT` read out loud.

`tests/web/paying-into-the-ledger.test.ts` was pinning `contributionPerStoneOverDays(20)` - which
is `DEFAULT_DUTY_DAYS`, the EMPTY-board fallback, not a span the engine uses when anything is
posted. It was passing on a rounding: the board's median was already 60, the rate was 71.43, the
ledger stored 71, and the assertion was `71 < 71.43`. It now reads both rates out of the engine's
own answer and asserts the rule, so it moves with a retune instead of breaking on one. The header
records what changed and why.

TWO SMALLER THINGS, both pre-existing and both visible in a played escort:

- **The duty id is printed at the player.** A played accept narrates
  `posted-sect-azure-dew-sect-sending-an-escort-20: 90 days, 180 contribution ...`. That is a
  row id in player-facing prose, on every posted duty, and it predates this change.
- **A term that ran its full length still says it was cut short.** The same turn prints
  *"It ran 3 months and not 3 months. Something was already on its way."*

### 21. DONE - a gathering could not fold into itself, and the ledger's ratchet was holding by luck

`a-fact-that-keeps-happening-is-one-row.ts` exists because a two-thousand-year world held 4,556
rows saying something an earlier row already said. It folds on the way in: `appendWorldFact`
computes a recurrence key off the pending fact and extends the row that already carries it.

`holdGathering` cannot use that, and nothing said so. It appends its row with a PROVISIONAL
summary - *"X received the chosen of N allied houses"* - because every tie it writes has to carry
the fact id and the id does not exist until the row does, then fills the real sentence and the
real `data` in on the stored record. The recurrence decision is therefore taken on a sentence the
row does not keep, so two finished gatherings that come out identical are looked up under two
different placeholder keys, never meet, and sit in the ledger as two rows saying the same thing.

Surfaced, not caused, by the occasions work: the new sending reasons moved which reason each
house draws, which moved the draw order, which moved which gatherings happen. Measured across
horizons, `fixtureCatalog`, `eventsPerYear: 2`:

    recur-world     1 duplicate, always kind `gathering`, at 290/295/300/305/310/400 years
    recur-world-b   0 duplicates, at every one of those horizons

The duplicate is two competitions four years apart with the same three attendees, the same
placings and the same sentence. Folding them would be CORRECT and is what the module is for.

**FIXED, and the restructure was not needed.** The four passes were never the obstacle - the
ID was. `reserveFactSlot(ledger)` in `history.ts` takes the next fact id AND the row's place in
the ledger without creating the row; the passes run against that id exactly as they did against
the appended row's; then the row is appended once, with the real sentence, the real `data` and
the real consequences, and `appendFact` splices it into the place held for it. So the recurrence
decision is taken on what the row keeps, and the RNG streams, the fact ids and the ledger order
are all byte-for-byte what they were.

Two edges it has to answer, both in the code:

- **A folded gathering leaves its slot unused.** `appendWorldFact` returns the row that already
  said it, under a different id, and the ties were written with the slot's. `pointTiesAt` moves
  them. It is complete rather than best-effort: `write` is the only thing in `gatherings.ts` that
  puts the id anywhere durable, and every call to it pushes a tie, so the ties ARE the list of
  places to look.
- **The recurrence index counts how far along the ledger it has read**, and a row spliced into
  the middle would leave one row indexed twice and one never indexed. `noteRowInsertedAt` takes
  account of it, and does nothing where the ledger has no index yet.

Measured after, eight worlds across ten horizons from 200 to 1,000 years, same catalog and
`eventsPerYear: 2`: **gathering duplicates 2 to 0** (`recur-world-e` at 500 years and past it,
the only world of the eight that produced the coincidence), and every other world 0 to 0 with
its row count unchanged to the row - which is the evidence that nothing but the fold moved.

**And the sweep answered a question the finding did not ask.** `gathering` was the only writer
in the world layer that appends-then-rewrites - `resolveFact` and `explainFact` in `history.ts`
would do the same damage and have no callers anywhere - but it was not the only source of
duplicate rows. Nine callers pass `recur: false` on purpose, and those rows are duplicates by
design: two promotions to the same seat are two events in one career. The guard could not tell
a decision from a failure, so with the `gathering` exception removed it would have failed on
`recur-world-b`, `-c` and `-d` for rows that are correct. `appendWorldFact` now marks an
opted-out row `keptItsOwnRow` in `data`, which is excluded from the recurrence key, so the guard
reads it without changing what anything collides with.

Two attempted fixes that do NOT work, kept so nobody spends the afternoon again:

- Re-filing the row in the recurrence index after the rewrite. The index is not the problem; the
  LOOKUP is, and it happens before the rewrite.
- Putting the day in `data` so rows never collide. That makes the invariant hold by making
  folding impossible, which is the opposite of what the module is for.

### 22. Monopolising a ruin is a real act with a real cost, and nothing in the world performs it

Your ruling: a ruin is an open object, public by agreement, and a sect that monopolises one
angers everybody else. `a_find` now reads what a house KNOWS rather than what it holds -
`aFindThisHouseCouldSendFor` in
`src/engine/world/who-goes-out-for-a-house-and-what-comes-back.ts` - and it reads
`controllingFactionId` nowhere. Which leaves that column on a ruin meaning nothing at all.

**It should mean monopoly, and that is a sharper meaning than the one it has.** On a seat or a
vein it means ordinary ownership. On open ground it can only mean a house has shut everybody
else out, which is the one thing the genre says costs you. Nothing writes it for a ruin today
(measured: 0 of 144 at day 0 and 0 of 379 at two hundred years, twelve pinned worlds), so the
column is free to be given that meaning without a migration.

**What the act would be, in files that already exist.** An `ObligationRecord` per house shut
out - `src/engine/social/grudges.ts` - held against the monopolist, at a `Severity` scaled by
what the ground is worth. Who to open one against is `circleCandidatesFor` in `gatherings.ts`
read inside out: the bodies seated in that province are exactly the ones with a claim. What a
house DOES about it is already written in `what-a-house-does-when-it-catches-you.ts` and
`what-a-body-wants-is-what-its-deciders-want.ts`. The verb a player would type has no home yet.

This is a bigger piece than the reading and was deliberately not folded into it.

**Two things the reading turned up on the way, both worth their own look:**

- **Every seeded ruin is off the map.** `seedWorld` writes 12 ruins per world with
  `parentId: null`, and their ids run `loc-ruin-<region index>-<n>` - so the NAME says which
  province a ruin belongs to and the record does not. `theProvinceAround` is therefore null for
  all 144 of them, no house is seated near any ruin at day 0, and anything province-scoped
  reads zero on a fresh world. Ruins the simulation creates later are parented normally: 405 of
  429 houses have an open one in their province at two hundred years.
- **`sealed` means two different things on a ruin and the catalog does not say which.** One is
  a door that has never been opened - `ruin_opened` in `the-world-changing-on-its-own.ts`
  unseals it once, tags it `emptied`, and it never shuts again. The other is a door that
  closes: a ruin with an `OpeningCycle` seals and unseals on its own schedule, carrying an
  `open_now` tag, which is your sealed realm. 72 of 144 seeded ruins carry a cycle and 72 do
  not, and nothing distinguishes the two states on the record. The reading treats `sealed` as
  "shut today" either way, which is right for both; anything that wants to tell a spent ruin
  from one waiting for its season has to read `cycle` and `emptied`, and should say so.

**And nothing writes a knowledge row for a world NPC.** Every writer of `knowledge_records`
names the player or somebody an operator spawned, so a read over a house's roll through the
knowledge gate alone is `unaware` everywhere.

**SETTLED, and the answer is that nothing should.** A row per person per fact is an unbounded
table - measured on a seeded world of 250 at one thousand years, 28,488 of them, or 8,804
collapsed to one per person per PLACE, both roughly linear in the world's age. What a world
NPC knows is READ off the ledger the world already keeps, and there are now three readings
rather than one: having been there, the province talking about it, and this house's own party
coming back and saying so. `src/engine/world/README.md` has the table, the rungs and what each
one moved.

**What is still open is the PLAYER-FACING half.** `KnowledgeGate` in `src/web/knowledge.ts` is
constructed from a `Database` in about twenty places and has no world handle, so `isAwareOf`,
`stageOf` and `canPointAt` still answer `unaware` for a world NPC - which is what
`asking-verbs.ts` asks to decide whether the person being questioned has anything to say, and
what `combat-verbs.ts` asks for `referenceFor`. The route is an optional second reader on the
gate, wired at the call sites that hold a world; it is not a row.
