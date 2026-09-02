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

A rated object in the pouch has a fourth, smaller one: `CombatantInput.artifactOrdinal` is
the engine's price for a carried rated object, and **nothing in `src/` passes it, for
anybody.** `grant_item` says so in its own response rather than letting an operator find out
by losing a fight they should have won.

---

## The actions

Eleven, and the two `READ` ones write nothing. Every other one performs a real deterministic
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
phrasing of it that is not.

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

## What the model does not see

**No model reads an ADMIN line.** It is dispatched at the top of `act`, before phase 1, so no
model parses it and no model can be steered through it. Every phrasing on this page is read
deterministically, in `admin-said-as-a-sentence.ts`.

**The situation it arranges is narrated like any other**, by whichever narrator is
configured. Those are two different things and only the first is closed to a model: the
command is never read by one, and the world it leaves is described by one whenever one is
running. That is what makes an admin call useful for looking at states ordinary play almost
never reaches - and it is why a bad narration after one is a finding about phase 3.

That is a real limit and not only a safety property. *"spawn a void tempering tortoise in
human form in front of me"* is refused - "tortoise" is not a subject noun, and nothing infers
a rung from "void tempering". The same thing is reachable spelled the surface own way:

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
| Where `ADMIN` is intercepted in play | `adminAct` in `src/web/game.ts` - **before the narrator ever sees the input**, so no model is in the loop on that path |
| The ladder, the ceiling, the breaths | [`src/engine/cultivation/realms.ts`](../src/engine/cultivation/realms.ts) |
