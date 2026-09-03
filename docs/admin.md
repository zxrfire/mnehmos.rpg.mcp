# admin.md - the operator surface

> **"The admin panel can set preconditions, but it allows me to test outcomes."**
> - the design owner

That sentence is the whole design, and the **but** is doing the work. The restriction is
not a limit on the tool; it is what makes the tool worth having. **If admin could set
outcomes there would be nothing left to test.**

The law it follows is stated where it belongs, next to the code it governs, in the header
of [`src/server/consolidated/admin-manage.ts`](../src/server/consolidated/admin-manage.ts) -
**"ADMIN bypasses GATES, not TRUTH"**, no action that takes an outcome as input, everything
through the real engine path, everything audit-logged. **Read it there. It is not restated
here**, because two copies of a law drift and the header's value is that it sits beside the
thing it binds.

This file is the other half: **what each action is for, what it takes, and which phrasings
reach it**, so that whoever is choosing - a person typing, or a model calling the tool - has
something to be right against.

**"Bypasses gates" is about AWARENESS and about reach**, and it is worth saying which gates,
because there is one place it does not apply. `spawn_site` and `grant_knowledge` lift the gate
that is *you have to have happened to hear of it*; `set_location` lifts the road. **A
precondition on the actor is a different animal and stays exactly where it is** - see
[ADMIN &lt;verb&gt;](#admin-verb---forcing-an-attempt-to-land), which decides an uncertain
outcome and never makes an illegal action legal.

---

## The acceptance test for any new action

> **Does this action ARRANGE A SITUATION, or does it ASSERT A RESULT?**

Arrange, and it belongs. Assert, and it never does, however convenient.

That is the test to apply before adding anything here. `spawn_encounter` arranges: it puts a
real person in front of you and the engine decides what happens when you meet them.
`set_hp` would assert, and it is exactly the affordance that invites a narrator to describe
a world that does not exist.

The owner wants to test what death looks like. Admin's answer is not a `kill_me` action. It
is **put a Tribulation Transcender in front of me and let the engine decide**, or **advance
two hundred years with no rations and let the belly decide.** Precondition set, outcome
observed - and the observation is worth something *precisely because nobody stipulated it.*

---

## Three worked examples, from the design owner

Non-exhaustive. They show what "set preconditions, test outcomes" means better than any
definition, because in every one of them **admin arranges the situation and a law of the
world produces the result. Nobody stipulates the outcome.**

### 1. Spawn an object of the immortal grade, and watch it leave

> *"i should be able to spawn a 46 sword, and it should immediately zwoop up to the sky in
> 10-15 breaths, right?"*

`OBJECT_CEILING_BELOW_THE_LID` is 45. An object rated above it cannot remain below the Lid,
for the reason `realms.ts` gives: a weapon lets its holder strike at its own rung, so a 46
in a mortal hand is a way to injure a True Immortal, and there is no such thing. The window
is the same ten to fifteen breaths a descending immortal gets - **an object obeys the same
law as a person**, which is an elegant thing to be able to show in one command.

**Reachable today:** `ADMIN grant_item ordinal=46 kind=artifact`.

**What actually happens: it stays.** See [what does not fire](#laws-that-do-not-fire-yet).

### 2. Shatter it, and get pieces that can stay

> *"i should be able to shatter a sword and it becomes 45 fragments"*

**Read as grade, not as a count** - pieces *of rating 45*, not forty-five of them. The owner
writes ordinals as grades throughout ("a 46 sword", "a 45 weapon"), and the reading is
confirmed by the catalog, which already states this outright:
`HOW_A_FORTY_FIVE_EXISTS.shattered` says a piece is worth one rung less than the whole and
that *"a piece of a forty-six is a forty-five"*. `shardPower` is that arithmetic and it is
the same arithmetic that turns a notched sabre into a worse one. Nothing about it is a rule
for immortals; it is an ordinary rule meeting a boundary, and it is **the one route by which
immortal material has ever stayed in the world.**

**And breaking is gated by realm, which is the better half of the example.**

> *"a qi condensation cultivator can't shatter a 46 sword"*

Shattering is a **world action, not an admin power.** Admin can put the sword in front of
somebody; whether they can break it is the engine's answer. This agrees with the ladder that
already governs MAKING: `refiningOrdinalFor` and `PILL_GRADE_REALM` in
`engine/cultivation/breakthrough.ts` are the design owner's ruling that a cultivator cannot
*work with* materials above their realm, and that this rather than price is what makes the
high grades rare. **Breaking a thing is working with it.** You cannot make above your rung and
you cannot unmake above it either - one ladder, both directions, and a second rule written
just for breaking would be the wrong shape.

So witnessing this takes **two** preconditions - the sword, and somebody capable of breaking
it - and **the absence of a shortcut is the feature.** An admin surface that let a Qi
Condensation cultivator shatter a 46 would be asserting an outcome.

**Not reachable today.** See [what does not fire](#laws-that-do-not-fire-yet).

### 3. Throw it to a crowd, and let the rumour mill go

> *"if i throw it out into the crowd THE RUMOR MILL SHOULD EXPLODE"*

Tests gossip propagation under an extreme stimulus. The machinery exists and is good -
rumours carry a hand count and a distortion and can be true, false or anywhere between -
and something world-historic becoming public in a crowded square is an input nobody has
ever given it.

**Not reachable today.** See below, and it is the sharpest of the three.

---

## Laws that do not fire yet

**This is admin's real value, and it is worth stating as a principle: if you arrange a
situation and the world does not do what it says it does, you have not found an admin bug -
you have found that a law is not implemented.** Report it. **Admin must never simulate a
law to make a demonstration work**; a surface that faked the departure of a 46 would have
destroyed the only measurement that mattered.

All three were found by trying to reach the owner's examples, and all three are absences in
the world rather than in this surface.

**A fourth, found the same way and fixed here rather than reported:** `spawn_encounter` wrote
a correct row, at the player's exact location, alive, in the right run - and `who is here` did
not mention them. `othersPresent` *did* return them; what was missing is that `company()` in
`game.ts` splits the people present on whether the player holds a knowledge record, so an
opponent nobody had heard of rendered as an anonymous band reading. **`spawn_site` had already
solved this for places and `spawn_encounter` had never solved it for people.** It writes the
knowledge record now, and the person is named, addressable and attackable.

Two things a disposition still does not reach, and neither is faked:

- **Hostility is answered, not volunteered.** It is on the knowledge record, so *"what do I
  know about them"* replies *"and means harm"* with the provenance attached. Nothing in the
  play layer says it unprompted, and nothing makes them act.
- **No grudge is written, on purpose.** `GrudgeCause` is *"concrete and specific by design"*
  and grudges are inherited. There is no cause here - nothing happened, somebody was placed -
  and writing `other` would put a fabricated grievance permanently into the world's causal
  record. **The real absence is that there is no store for how a person is disposed toward the
  player right now**, separate from what they are owed and what they hold against them.

**And one that is not the engine's at all.** The mechanical channel showed a *previous* input's
`Raw input:` line under a later turn. The server record is correct - verified from the payload,
`hello` returns `Raw input: "hello"` on its own turn. The rendering is at fault: `S.inspectors`
in `web/app.js` is keyed by **turn**, turns are **not unique per input** (an ADMIN call does not
increment one), and the store is written only when `toolCalls` is non-empty - so an input with
no calls silently inherits whatever that turn already held. `web/app.js` is the fix, not this
surface.

| The law | Where it is written | What reads it |
|---|---|---|
| An object above the ceiling cannot stay below the Lid | `evaluateLayerCrossing` in `engine/world/layers.ts`, refusing `above_the_object_ceiling` by name | **`immortal-world.ts` only**, for NPC descents. Nothing anywhere reads what a PLAYER carries. |
| Breaking a thing degrades it a rung | `shatter` and `shardPower` in `engine/world/possessions.ts` | **`shatter` has no caller in `src/` at all.** There is no verb, so there is also no realm gate on breaking - the question "can a Qi Condensation cultivator break this" has no code to answer it. |
| What the player does becomes something people say | `what-people-are-saying.ts`, reachable through `askAround` | Rumours are drawn from the world's **historical facts**, and **nothing the player does ever writes one** - `appendWorldFact` and `makeFact` have no caller outside `engine/world/`. The player is outside the historical record, so no player act can ever be gossiped about. |

Each is the shape `AGENTS.md` records under
[a module nothing calls is not a feature](../AGENTS.md), and the third is also
[the world's rules must bind the player too](../AGENTS.md) - the rumour mill binds NPCs
and cannot see the player at all.

A rated object in the pouch was a fourth and is not one now. `combatantFromCultivator` reads
`carriedArtifact` into `CombatantInput.weapon`, `assessPower` prices `weapon.power` as the
rated ordinal, and a granted object can be broken in the fight by the ordinary rule - the same
field an NPC's blade arrives in through `bestObjectHeldBy`, read by the same resolver.
`grant_item` names both in its own response rather than letting an operator find out by
losing a fight they should have won.

**What the grant still does not do is touch the world's register, and it must not.** Holding a
thing and owning it are two facts ([`things/items.md`](world/things/items.md)); the world going
on saying a house owns something the player is carrying is what a stolen artifact is.

### And a fifth, found by the design owner, which read exactly like the surface lying

`ADMIN grant_item ordinal=46 kind=artifact` answered **GRANTED**, with the catalog id, and then
`what am I carrying`, `what am I holding` and `inventory` all answered *"Nothing in the pouch
at all."*

**The grant was real.** `addToPouch` wrote the row and it is still there. What could not see it
is the READ: the `inventory` verb goes to `alchemy_manage.inventory`, an alchemy tool, and
`listPouch` filters to pills and herbs **by design** - a rated object is a different kind of
thing and `listCarriedArtifacts` is its accessor. That accessor had exactly one caller,
`carriedArtifact`, which itself had none.

So the object was in the database, invisible to every sentence a player can type, and worth
nothing in a fight. **A write nobody can read is indistinguishable from a write that did not
happen**, which is why this belongs on this page rather than in a changelog: it is the failure
`docs/admin.md` opens by forbidding, arrived at from the other side. The surface was telling the
truth and there was no way to check it.

Two things follow, and the second is the useful one:

- **The read is what needed fixing, not the grant** - `inventory` lists what is carried
  alongside the medicine, out of `listCarriedArtifacts`.
- **The 46 departure measurement above has to be re-taken.** "What actually happens: it stays"
  was recorded against a grant nobody could observe. Whether the object stays, and whether it
  takes its holder with it, is an open question again.

---

## It sets up preconditions, and preconditions must be possible

> - the design owner

That sentence governs everything below it, and it is the whole answer to *what may ADMIN
arrange*. Three cases from the same conversation, and the middle one is the interesting one:

- **A Qi Condensation patriarch: allowed.** Absurd, unstable, and the point is watching him be
  replaced. **Improbable is not impossible.**
- **A 46 weapon: allowed, and it is a scene rather than an edge case.** `MAX_ORDINAL` is 46 so
  46 is a real rung, while `OBJECT_CEILING_BELOW_THE_LID` is 45 - because an object rated at a
  rung lets its holder strike at that rung, and a 46 in a mortal hand is a way for somebody at
  44 to injure a True Immortal. The catalog already says what happens: it does not stay, it goes
  up, immediately, **with whoever is holding it**, and `artifacts.ts` calls that *"not a route,
  it is a method of dying"*. Arranging it is arranging a precondition the world has a violent
  opinion about, and the opinion is the content.
- **A 47 weapon: refused, and the refusal says "there is no such rung".** Not "too high", which
  would imply a limit somebody could raise. The ladder ends at 46 and nothing in this world has
  a meaning for a thing rated above it, so every observation downstream of one would be about a
  world that does not exist.

The test that separates them is **possible against impossible, never typical against atypical**:
a precondition must be a state the world has a meaning for. A generator produces the ordinary
case by construction, so validating against what a generator would have produced would refuse
every scenario worth arranging - which is the feature.

---

## ADMIN &lt;verb&gt; - forcing an attempt to land

> **Forcing decides an uncertain outcome. It does not make an illegal action legal.**

`ADMIN sect join the Azure Dew Sect` runs the *ordinary* `sect` verb - the same `handleJoin` the
played game runs, spending what it spends and writing what it writes - and decides the one thing
the engine was uncertain about, which here is whether the house took them. Phase 1 is skipped
because the operator named the verb. Nothing else about the turn is different.

The design owner's own case, and the last clause is the purpose:

> *"What admin can do is make success work - like a Qi Condensation stealing from a Nascent
> Soul. It's very hard, but if it works you can then see what happens next (what that Nascent
> Soul does), right?"*

The feature is not the theft. It is that the reprisal, standing and rumour systems then have to
answer a state ordinary play would take thousands of runs to reach, and those are the systems
least tested and likeliest to be wrong. The law and the mechanism are in
[`src/server/consolidated/forcing-an-attempt-to-land.ts`](../src/server/consolidated/forcing-an-attempt-to-land.ts),
and are not restated here.

### A gate stays a gate, and the refusal is directions

The split is **per failure, not per verb**, so there is no table of forty-six. Every refusal in
this game is already one of two things:

| | | |
|---|---|---|
| **A roll** | an uncertain outcome the engine sampled | force lands it |
| **A gate** | a precondition. Nothing was decided; the world stopped before any uncertainty arose | force leaves it standing and **names the actions that arrange it** |

The worked example, from the design owner, and both halves are about the same house:

> *"Admin can put you in the middle of the Hollow Court and have you successfully
> charm/seduce the seats. It can't admit you to the Hollow Court below 29, because there simply
> isn't a way."*

Seducing a seat is a legal attempt with terrible odds - nothing forbids trying, you would simply
never land it - so force decides it, and what the operator gets is **what the Court does next**.
Admission below 29 is not a bad chance, it is no chance: the Court takes people at Void
Refinement and no branch anywhere admits somebody under it. Forcing that would not be arranging
an unlikely outcome, it would be inventing a state the world cannot reach.

**Why the gate is not lifted, since it is the obvious thing to want.** Two reasons and both are
load-bearing. Admin can already do it properly - `set_realm`, `set_age`, `grant_progress`,
`grant_item`, `grant_knowledge`, `set_location` arrange the common preconditions - and a verb
forced past one would be a *second* way to do a thing this surface already does, which is how
the forced path and the real path drift until admin stops testing anything. And a state reached
by removing a precondition is a state the world cannot produce, so an operator looking at it is
looking at a lie.

So `ADMIN breakthrough` on an empty accumulator answers:

```
ADMIN - FORCED BREAKTHROUGH

Nothing was decided. The world refused before any uncertain question arose, which means what
stopped this was a PRECONDITION and not a roll.

What would arrange it:

    ADMIN grant_progress fill=true - fills the accumulator the engine already reads, which is
    what makes the attempt legal. Then the crossing can be forced.

    ADMIN set_realm ordinal=<rung> - if what is wanted is somebody STANDING at a rung rather
    than crossing to it, this is the action, and it claims no crossing.
```

**Every route it has, not the first.** The owner's requirement, in his words: *"it should say
no, you can do it by setting your realm to 29 and your age."* An operator handed both does the
thing in two calls; one handed "refused" goes and reads a catalog. **And the two compose**, which
is the real workflow: arrange the gate with the action that arranges it, then force only what was
ever uncertain.

### A refusal with no route says so, and offers nothing

An **invariant** is not a gate. One house has one patriarch; innate attributes are rolled once
and never rise. There is no route, and the honest answer is a flat no - inventing a
helpful-sounding alternative would be worse, because the operator would go and try it.

**ADMIN keeps no register of what is impossible, and must not grow one.** "One patriarch" is a
fact about how a roster is built rather than a constant somebody declared, and a hand-kept list
of such facts goes stale. What enforces an invariant is the ordinary write path, which refuses
because it cannot express the thing; admin inherits that for free and stays correct as the write
paths change. The two tables in `forcing-an-attempt-to-land.ts` only decide **what to say after**
a refusal that has already happened; neither performs a check, and a refusal in neither is
reported as being in neither rather than guessed at.

### What it never skips

The bill. **Force decides the answer; the verb writes the price**, and it writes it because it is
the same verb - there is no second implementation. A forced crossing spends the accumulator, takes
the Price of Advancement and meets the tribulation. A forced approach spends its days and its
stones and writes the tie, the obligation, and whatever the other party now holds. A forced
admission writes the membership row at the seat the house's own ladder gives.

**There is deliberately no argument that makes it free.** Not charging is not something this layer
can do without re-implementing the verb; an operator who wants a success to be affordable arranges
affordability first. That is `AGENTS.md` on softening, from the other side.

### And it is always marked

Every forced call writes an audit row - `force.<verb>`, with the sentence, the outcome, and which
decisions were actually reached - and those rows **are** the admin flag, so the run never reaches
the death ledger or the balance data as though it had earned the success. A played test that
cannot tell an arranged success from an earned one is testing nothing.

### The grammar

`ADMIN <verb> <the sentence>`, where `<verb>` is a member of the closed playable set in
`ACTION_NAMES`. The rest of the line goes through the ordinary deterministic parser, so the
target, intent, topic and duration are read exactly as they are for anybody - what the operator
settled is **which verb**.

Three playable verbs are also admin words - `move`, `site` and `wait`, aliases of `set_location`,
`spawn_site` and `advance_days` - and **the admin meaning still wins**, because the action list
is a contract. `ADMIN force move Nine Peaks` is the unambiguous spelling, and `force` is also
accepted as `succeed`, `land`, `do` and `play`.

The word is a **lookup against the enum**, never a reading of prose: same discipline as
`PRIMARY_ARG` and `BARE_NUMBER_ARG`, and for the reason recorded beside the withdrawn alignment
draft in `admin-manage.ts` - a word lifted out of a sentence cannot be told from a word that is
part of a name.

`force` appears in the action list and **refuses on the MCP tool path**, naming where the door is.
A playable verb runs inside a run, through `GameService`; the tool holds repositories and has no
run, and building a second way to execute a verb is the duplication the whole design forbids.

---

## The actions

Fourteen, and the three `READ` ones - `help`, `roster`, `audit_log` - write nothing. Every other one performs a real deterministic
mutation and returns what the engine actually did.

**Arguments are `key=value`**, and a value runs to the **next key**, not to the next space,
so a multi-word name needs no quoting: `set_location location=The Dead Verge` works, and so
does the quoted form.

**A rung may be named rather than numbered.** Every `ordinal` argument accepts a number, a
realm by name, a realm plus its sub-rank, or **the realm's initials** - so `ordinal=17`,
`ordinal=Core Formation` and `ordinal=CF` are one request, and `TT` is Tribulation
Transcendence. The abbreviations are the initials of whatever `REALM_TIERS` currently says,
derived rather than tabulated, with a two-letter minimum that exists to stop Immortal
abbreviating to `I` and swallowing the commonest pronoun anybody types. A realm name alone
takes the **first** rung of its band, which is the weakest reading of a claim made without
one; `ordinal=Core Formation Early` names the rung exactly. All of this exists because
everything in this game prints rank names and almost nothing prints ordinals, so nobody
should have to know that Core Formation is 17-20.

**Prose after a named action is that action's main argument.** `ADMIN help refusals`,
`ADMIN move Nine Peaks`, `ADMIN give The Standing Edge`. Which argument is a property of the
action, not a guess about the words - there is one free-text field it could mean - and an
action with none leaves the prose alone and refuses in its own words.

| Action | What it is for | Takes |
|---|---|---|
| `help` | READ. What admin can do, as copyable lines. Three sections, because all of it at once is more than anybody reads: `ADMIN help` is the capabilities, `ADMIN help refusals` is what it will not do with the honest route to each, `ADMIN help actions` is every action with its arguments. | `about` |
| `roster` | READ. Every cultivator that exists: name, rung, root, sect, where they stand, alive or dead. | `includeDead` |
| `audit_log` | READ. Every admin call on this run. **These rows ARE the admin flag** - `run_manage.ledger` reads them to exclude the run from the death ledger and balance data. | `runId`, `limit` |
| `spawn_encounter` | **Creates a PERSON.** A real persisted NPC at any strength, standing where the player is, talent rolled from the run seed and advanced through `advanceRealm` like anybody. `alignment` puts them in a real house of that leaning, which is what decides how far they go when wronged. Omitted, they are a rogue, and a rogue answers as a neutral. | `ordinal`, `name`, `location`, `disposition`, `alignment` |
| `spawn_site` | **Reveals a PLACE.** Makes a catalogued grave or trial nameable. Lifts the awareness gate and nothing else. | `kind`, `ordinal`, `name` |
| `grant_item` | **Gives an OBJECT.** A catalog pill, herb or rated artifact into the real pouch. | `itemId`, `name`, `ordinal`, `kind`, `quantity` |
| `set_location` | Moves the player to a place really on the map. No travel time, nothing on the road. | `location` |
| `set_ambient` | Finds a place near the player the engine genuinely derives the requested band for, for this 30-day block. **Found, never declared.** | `band` |
| `advance_days` | Real time through `simulateTimeSkip` at idle focus: real aging, hunger, stagnation, death. Says how much ran and what stopped it. | `days`, `months`, `years`, `rations` |
| `grant_progress` | Fills the qi-unit accumulator so a crossing can be **attempted**. Rolls nothing. | `amount`, `fill` |
| `set_realm` | Moves the player on the ladder through `advanceRealm`: peak stamped, progress cleared, stagnation clock restarted. | `ordinal` |
| `set_age` | Moves the age through the repository's own delta path, up or down. **No life was lived** - the clock does not move and nothing happened in between; `advance_days` is the action that spends a life. Refuses an age past the rung's lifespan, because that is a death the survival check has not been asked about yet, and names the two routes. | `age` |
| `force` | **Runs an ORDINARY VERB with the attempt landing.** Typed at the game as `ADMIN <verb> <sentence>`. Decides an uncertain outcome; never makes an illegal action legal. Refuses on this tool's own path, because a playable verb needs a run. | `verb` |
| `grant_knowledge` | **Lifts the awareness gate wide.** Makes every place, every house, or one named either, nameable by this cultivator. They already exist; what changes is whether their names can be said. | `kind`, `name` |
| `reset` | **Ends this run and begins another.** Closes the current run with no death cause - it did not die - flags it admin so it never reaches the ledger, and opens a fresh birth in the SAME world. Handled in `game.ts` rather than here: runs are written there and nowhere else, and a tool handler ending one would be a second writer. | a name, optional |

### Which of the two `spawn`s

The commonest wrong turn, and it was a real one: a session asking for a person got offered
`spawn_site` first, because the two names differ only in a suffix and the operator's word was
"spawn".

> **`spawn_encounter` creates somebody. `spawn_site` reveals somewhere.**

If the sentence is about a person - a fight, a threat, a conversation, "put an X in front of
me" - it is `spawn_encounter`, and "in front of me" needs no argument because **here is the
default.**

---

## Intent to action

The mapping, for whoever is choosing. **The left column is what somebody says; the right is
what runs.** Nothing here is a new capability - every row is an existing action with existing
arguments, which is the property that makes reading prose safe at all.

**Every line on the left is typed AFTER the word `ADMIN`, and none of them works without it.**
That is not a formatting note. `ADMIN` is the dispatch: it is what routes a sentence to this
surface at all, before anything here reads a word of it. Typed bare, every row below reaches
the ordinary game instead - measured, and the results are not refusals but wrong answers.
*"spawn_encounter 41"* comes back `unclear`, *"put a Tribulation Transcender in front of me"*
comes back `unclear`, and *"I am ordinal 44"* prints a status dump about somebody who is still
at Qi Condensation. So read the left column as `ADMIN put a Tribulation Transcender in front
of me`, and the two rows below that spell `ADMIN` out are not doing anything the others are
not.

| What was said | What runs |
|---|---|
| spawn an NPC / a cultivator / a person at *rung* | `spawn_encounter ordinal=<rung>` |
| put a Tribulation Transcender in front of me | `spawn_encounter ordinal=41` |
| spawn a Core Formation girl | `spawn_encounter ordinal=17 name=A Core Formation girl` |
| I run into a 45 weapon / give me a 45 sword | `grant_item kind=artifact ordinal=45` |
| give me *the Standing Edge* | `grant_item name=The Standing Edge` |
| I am ordinal 44 / put me at Core Formation / I AM TT | `set_realm ordinal=<rung>` |
| show me a grave / a trial at *rung* | `spawn_site ordinal=<rung>` |
| give me knowledge of every sect / I know every location | `grant_knowledge kind=sect` / `kind=place` |
| ENCOUNTER ORDINAL 19 (the equals sign left out) | `spawn_encounter ordinal=19` |
| spawn_encounter 41 / encounter 41 (a bare rung, nothing else) | `spawn_encounter ordinal=41` |
| set_realm 30 / spawn_site 41 / advance_days 50 | `set_realm ordinal=30` / `spawn_site ordinal=41` / `advance_days days=50` |
| reset / restart / reroll / regenerate | `reset`, keeping the current name |
| reset Shen Yuan | `reset`, with that name |
| what can you do / how do I ... | `help` |
| I join the Azure Dew Sect, and it must land | `ADMIN sect join the Azure Dew Sect` |
| I steal from that Nascent Soul, and it must land | `ADMIN interact I steal from <them>` |
| make the crossing succeed | `ADMIN breakthrough` - refused while the accumulator is empty, and it says so |
| I am 250 years old | `set_age age=250` |
| set_age 250 (a bare number, nothing else) | `set_age age=250` |

**An alias is not a named action.** `give` is an alias of `grant_item`, so *"give me knowledge
of every sect"* used to be refused with "nothing in the pill, herb or artifact catalogs answers
to 'me knowledge of every sect'". The operator did not name an action there - they used an
ordinary verb, and **the noun is what says which action they meant.** So a canonical action
name still wins over any reading, and a generic verb yields to an explicit subject. The other
half of the same rule: *"give me a 45 weapon"* still means an object, because the noun still
decides.

Two rules keep this honest, and they are the entire licence for accepting prose:

1. **What was inferred is always printed back**, as the `key=value` line that would have
   produced it. The operator sees the guess and can correct it. Nothing is done quietly.
2. **Ambiguity refuses rather than picks.** A line naming two different kinds of thing gets
   a refusal that names both, not a coin flip presented as advice.

A sentence can only ever *address* the surface. It can never assert an outcome:
`ADMIN make my breakthrough succeed` names no capability and is refused, and there is no
phrasing of it that is not. What is reachable is
[`ADMIN breakthrough`](#admin-verb---forcing-an-attempt-to-land), which is not the same thing:
it runs the crossing, it decides the roll and not the eligibility, and it is refused outright
while the accumulator is empty.

### What a person is described as

`spawn a Core Formation girl` is unambiguous about three things and the engine has a field
for two of them: **there is no sex on `Cultivator` or `NpcCultivation`, anywhere.** So the
description goes into the **name**, which is free text the action already takes, and nothing
else about the person differs - the spirit root and the attributes are rolled from the run
seed either way. That is the agency rule applied to a word: the wording changes what was
intended and what the world calls her, and changes nothing about what the engine then does.

---

## Doing something to them, and what comes back

A threat, a lie, a theft or an interrogation put to somebody standing in front of you is a
**wrong**, and it is answered. Before this existed the engine wrote a social TIE for a landed
threat - the record it keeps for two people who are getting ON - so coercion and theft
registered as relationship-building and nothing else happened at all.

What comes back is the lesser of two things, floored at a warning:

- **what they CAN do**, from the gap in major realms. A full realm below you and words are all
  they have; level, and they can hurt you; a realm up, cripple you; two up, kill you.
- **how far they WOULD go**, from their house's alignment. Righteous will not start with a
  corpse. Demonic does not warn anybody twice. Neutral is proportional, and a rogue answers as
  a neutral.

**The floor is a warning and never silence.** Somebody who cannot touch you can still tell you
what you are, and that line is the cheapest signal that the act landed on a person rather than
on a ledger.

The answer is one of five, and the floor is never silence:

| | what it costs you |
| --- | --- |
| **warned** | words, and nothing else. What somebody who cannot reach you has instead |
| **driven off** | put out, told not to come back. No wound |
| **injured** | a real wound, and it does not close on its own |
| **crippled** | a wound that does not come back |
| **killed** | the run is closed, `combat_defeat`. No reload and no continuation |

A wound is never fatal unless the verdict was `killed` - those are separate answers, and one
that killed by arithmetic would collapse them into one. Set the target's house with
`alignment=` on `spawn_encounter` to see the axis move; leave it off and they are a rogue,
which answers as a neutral.

The rule lives in `engine/social-leverage/what-somebody-does-about-being-wronged.ts`, which
owns the ordering and is the file to read for the current thresholds. Which verbs are wrongs
at all is a separate closed table in `game.ts`, so a verb added to the parser does not
silently acquire consequences nobody chose for it.

`ADMIN reset` is read BEFORE the live-run guard, and is the only admin verb that is: every
other one is refused once the cultivator is dead, and the refusal ends "Begin a new run" -
which is exactly what reset does.

---

## And then the world is looked at

An action that CHANGES something is followed by a look at what it changed into: the engine
report, verbatim and labelled out-of-world, and then phase 3 over the post-state - the same
call that opens a life. Arranging a situation and then saying nothing left the operator
holding a receipt: the encounter existed, and there was no way to see it exist.

**The receipt is not narrated.** What follows it is the world as it now stands, and the person
just stood up is in it because `company()` reads the world rather than the command. The engine
decided, the narrator describes, and the narrator is not told what to say about it. A read -
`roster`, `audit_log`, `help` - changed nothing and so is followed by nothing.

Which narrator answers is settled at process start and ADMIN gets whatever the process was
started with, so **testing the engine alone is "start it without a model"** rather than a mode.
There is no flag, and there should not be one.

This is also the only place the engine-to-narrator seam is exercised against arbitrary state.
Ordinary play reaches Core Formation in about one run in a hundred and eighty, so phase 3 has
barely run above Foundation at all. From here it is one line. **A bad narration after an admin
call is a finding about phase 3**, not about admin.

## What the model may decide, and what it may never

> *"'No model reads an ADMIN line' - this can be broken. Admin messages go the same way as
> regular messages."*
> - the design owner

**An admin line travels the same road as anything else somebody types**, through whichever
tier is configured. The old rule said no model ever read one, and it was retired deliberately
rather than eroded, for the reason the owner gave: *"that's how we test with admin - because
the LLM layer needs testing too."* A surface built for arranging hard-to-reach situations that
could never exercise the layer reading them was testing half of what it should.

So an admin line is now a test of **two** things at once:

1. **The engine.** You arrange a precondition and watch a law produce a result nobody
   stipulated. Unchanged, and still the main event.
2. **The reading layer.** Can the tier that is running turn an operator's sentence into the
   right call? That is a genuinely hard input - `give myself chaos healing pill` has no catalog
   spelling in it, a grade word, a kind word, a name fragment and a pronoun that is not an
   argument at all - and **ordinary play never produces sentences shaped like that**, so the
   reading layer has never been tested on them.

**The four tiers will not agree, and the disagreement is the measurement rather than a defect
list.** Expect the ordering to be monotonic - Claude at least as good as Ollama, Ollama at
least as good as the in-process embedding, that at least as good as the browser tier. **An
inversion is the finding to chase**, not a difference.

And the deterministic tiers are not trying to be a model. Their bar is **playable**: reading
the grade and the kind off closed sets and then asking which of seven chaos-grade pills you
meant is a *good* answer at that rung. Their failures should be useful rather than silent -
which is why `grant_item` refuses with the rows it weighed, spelled the way this surface takes
them, instead of three unrelated examples.

### The invariant that did not move

**The model may read the line and phrase the answer. It may never decide the outcome.**

The old rule was never really about determinism - it was about admin being unable to *invent* a
world. A model reading "chaos healing pill" and resolving it to a catalog row invents nothing:
it is a lookup against a closed catalog, the same operation `ordinalNamed` performs when it
turns "Core Formation" into a rung. A model deciding that the grant *succeeded* would invent
one, and that stays impossible **by construction rather than by instruction** - there is no
argument anywhere on this surface that takes an outcome, and
[forcing](#admin-verb---forcing-an-attempt-to-land) decides only questions the engine was
already going to ask.

**Refusals stay facts produced by code.** *"There is no such rung"*, *"the Court admits at Void
Refinement"*, *"admin does not invent items"* - a model may phrase those; it may not decide
them.

### Which is why the READ AS echo matters more, not less

With four readers of differing quality, **a silent wrong resolution is the failure mode this
change introduces**, and the echo is the only defence. So every call prints what it ran and
what was read as what - and a resolved item prints **the catalog id it landed on**, not just
the argument that was parsed:

```
ADMIN · READ AS
You typed:  give myself a chaos grade tribulation pill
ADMIN ran:  ADMIN grant_item kind=pill name=chaos tribulation
...
Chosen because: described as "chaos tribulation", read as grade chaos, name word(s)
"tribulation", and resolved to the one row that answers all of it: pill-tribulation-guiding
```

That last line is what an operator checks. It was added after a measured near-miss: *"a heaven
grade herb"* resolved to the **Heavenly Tribulation Cinder Fruit** at 80/100 on the letters of
"heaven", and that fruit is chaos grade. Confident, plausible and wrong. A grade word in the
line is now a **fact about which rows can answer** and beats letter similarity outright.

### And a name the reader has no noun for is still refused

*"spawn a void tempering tortoise in human form in front of me"* is refused by the
deterministic reader - "tortoise" is not a subject noun, and nothing infers a rung from "void
tempering". That is a limit of that tier rather than a law, and the same thing is always
reachable spelled the surface's own way:

```
ADMIN spawn_encounter name=Void-Tempering Tortoise in Human Form ordinal=29
```

which stands up a real, nameable, attackable person at Void Refinement under that name.

What is **not** reachable is bespoke mechanics. `spawn_encounter` builds a CULTIVATOR: hp, qi
and attributes come from the rung and a rolled spirit root, and the ladder is walked with
`advanceRealm` like anybody. The name is free text; the creature is not. Anything that wants
its own statline is a data change in `src/data/cultivation`, not an admin argument.

---

## Refusals

The standard is the same as everywhere else in this build: **a refusal must name what would
work.** The reader is often a model that has just chosen wrong, so the useful answer is the
one it can recover from in a single retry.

Three things follow, all of them implemented:

- **A confidence floor of 40% on suggestions.** Below it, string-distance "did you mean"
  lines are noise ranked by letter overlap - `Unknown action "I". Did you mean: audit_log
  (11%)?` put the least relevant candidate first. Below the floor the actions are listed
  instead, **with what each one does**, which is shorter than the noise and is an answer.
- **A wrong argument is as informative as a wrong verb.** `"spawn_encounter" cannot run as
  asked. ordinal: Required.` plus the field list the action accepts, read off its schema so
  it cannot go stale.
- **`help` is the same sheet**, reachable on purpose rather than only by failing.

## Knowing a name is not an introduction

`grant_knowledge` is the widest gate this surface lifts, so it is worth being exact about
what it does not touch. The places and the houses are seeded, real, and full of people with
their own opinions. **What changes is whether this cultivator may say their names.**

Everything else stands, and the game says so unprompted - after granting every house,
`what sects are there` still answers:

> *Knowing a name is not an introduction. Somebody would have to put you in front of them, or
> you would have to walk up on your own.*

Admission bars, trial requirements, whether anybody will talk to you, what a favour costs -
all untouched. A player who knows the name of an apex still cannot walk in.

**Places and houses only, and the omission is the point.** `KnownEntityKind` has four members
and this takes two. `event` is left out and must stay out: an event is a thing that *happened*,
so a knowledge record of one is a claim about history, and *"give me knowledge that I killed
him"* is an outcome wearing an awareness gate as a costume. A place and a house are standing
there whether or not anybody has heard of them - which is exactly what makes naming them a
gate and not a truth.

**Written as ordinary knowledge rows**, through `learnIfNew` at the stage the discovery
system already uses for being told something. There is deliberately **no admin-knows-
everything flag**: a flag that read as knowledge would be a second source of truth beside the
table, and the first surface that forgot to check it would quietly disagree with the rest of
the game. `learnIfNew` is a floor, so anything already held at a firmer stance keeps it.

## What the surface actually renders

**Plain text. Not markdown.** This trap has been walked into once and it is worth writing
down, because everything about the code invites the mistake: `RichFormatter` exists, it is
used elsewhere, and its output looks like formatting.

One line in `web/app.js` decides it:

> `text.split(/\n\s*\n/)` … each part wrapped in an escaped `<p>`

So a narrator entry - which is what `ADMIN` is logged as - is **HTML-escaped and split on
blank lines**, with no markdown renderer anywhere on the path. Every `**bold**`, backtick,
`- ` bullet and `|` table pipe arrives as a literal character, and a **single** newline is
not a break at all, so consecutive list lines collapse into one another. The design owner's
word for the result was "very ugly and leaky", and they were right.

Three rules, and they are the whole of it:

1. **No markup.** It is not rendered, and it is read as noise by whoever the output is for.
2. **A blank line is the only structure there is.** Anything that must stand on its own line
   needs a blank line around it.
3. **Keep it short enough to finish.** Help is three sections rather than one wall for the
   same reason.

Note that `.entry--engine` *does* carry `white-space: pre-wrap` and would preserve single
newlines. ADMIN is not logged under that role, so it does not get them.

And the banner under every admin response stays exactly as it is:

> *ADMIN - out of world. Nothing above is narration, and no part of it is a claim about what
> a character perceives.*

---

## Where the code is

| | |
|---|---|
| The law, the actions, the handlers | [`src/server/consolidated/admin-manage.ts`](../src/server/consolidated/admin-manage.ts) |
| Reading a typed sentence | [`src/server/consolidated/admin-said-as-a-sentence.ts`](../src/server/consolidated/admin-said-as-a-sentence.ts) |
| The suggestion floor | `SUGGESTION_NOISE_FLOOR` in [`src/utils/fuzzy-enum.ts`](../src/utils/fuzzy-enum.ts) |
| Where `ADMIN` is intercepted in play | the ADMIN branch of `act` in `src/web/game.ts`, which routes a named playable verb to the forced path and everything else to `adminAct` |
| Forcing an attempt to land: the law, the decisions, the routes | [`src/server/consolidated/forcing-an-attempt-to-land.ts`](../src/server/consolidated/forcing-an-attempt-to-land.ts) |
| Reading `ADMIN <verb>` | `readAForcedVerb` in [`src/server/consolidated/admin-manage.ts`](../src/server/consolidated/admin-manage.ts) |
| Where a forced verb is dispatched, and its receipt written | `act` and `receiptForAForcedVerb` in `src/web/game.ts` |
| The ladder, the ceiling, the breaths | [`src/engine/cultivation/realms.ts`](../src/engine/cultivation/realms.ts) |
