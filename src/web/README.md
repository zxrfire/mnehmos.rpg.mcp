<!-- tier: 3 -->

# The Web Front Door

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected into a
> narration prompt. The narrator's always-loaded text is
> [`../../docs/world/NARRATOR-CORE.md`](../../docs/world/NARRATOR-CORE.md).

Where the authority rule stops being a design principle and becomes a set of type
signatures. Read this before changing anything in `src/web/` - and read it especially
carefully before widening anything a model is allowed to return.

The rule this package enforces is in [`../../context.md`](../../context.md): the AI
narrates, the engine decides.

---

## The three-phase split

```text
PHASE 1   intent -> action    narrator.plan()      a classifier
PHASE 2   action -> state     game.ts              the engine, and the only writer
PHASE 3   result -> prose     narrator.narrate()   a stylist
```

That ordering is the whole architecture: **a model can influence which deterministic
routine runs, and how the result is described, and nothing in between.**

- **Phase 1** sees the player's sentence and a state summary, and must answer with one
  verb from a closed list as strict JSON. Its output is parsed by `actions.ts` and
  discarded if it does not fit.
- **Phase 2** lives in `game.ts` and touches no narrator at all. Phase 2 is the engine,
  and the engine does not take instructions. There is no phase-2 prompt.
- **Phase 3** sees only what the engine already decided, expressed as flat statements by
  `facts.ts`, and turns those statements into paragraphs. Its output is **never parsed**.
  It cannot reach state because there is no code that reads it back.

The state returned to the client is re-read from the database after phase 2 and is not
touched by phase 3.

Read the method bodies in `game.ts` with one question in mind: *where does a value from a
model response become a row?* The answer is nowhere.

### Phase 3 is checked against phase 2

Not parsed - **checked**. The distinction matters and it took a measurement to find:

```text
narration-claims-breakthrough = true
ordinal-after = 0        progress-after = 0
```

Prose reading *"Day 91 - Breakthrough succeeded: Qi Condensation Layer 1 to Layer 2. Odds
were 94.0%."* against a cultivator still at ordinal 0 with zero progress. The engine was
never touched - "the answer is nowhere" held perfectly - and the player was told two ranks
had been gained, in the engine's own digest format, down to the day numbers and the odds.

**A player who is told they advanced two ranks has been given an outcome by a model,**
whether or not a row moved. They will plan the next forty years around it. So the rule
covers the prose as well as the database, and phase 3 now has a gate of its own:

| Direction | Mechanism | Where |
|---|---|---|
| The prose says something the engine did not | `auditNarration` -> discard, render `facts.prose` | `narrator.ts` |
| The prose omits something the player cannot play without | `EngineFacts.required` -> appended verbatim | `facts.ts`, `narrator.ts` |

Both are narrow on purpose. The audit is **one-directional**: it only ever flags a claim
the engine did not make, it never requires the prose to say anything, and it never reads a
value out of the prose and uses it - so the authority line is exactly where it was. It
covers the two outcomes a player would irreversibly act on, a rank they did not gain and a
death that did not happen, and a call site that files no account audits nothing.

`required` is the inverse, and it exists because the same measurement found the opposite
failure: the engine files a `method_ceiling` line saying in full *"without a manual there
is no road for the qi to take, so nothing accumulates and nothing ever will"*, hands the
model the whole sentence inside a long digest, and the model drops it. A cultivator sits
for fifty years gaining nothing and is never told why - and with the deterministic
narrator the same seed tells them every time. The difference between the two front doors
was the model's mood.

Reserve `required` for facts a player cannot play without: why nothing is accumulating,
that they have died, what a crossing cut away. A required line stapled to the end of good
prose is a cost, and it is only worth paying where silence would be a lie by omission.

---

## The closed action enum

`ACTION_NAMES` in `actions.ts` is the complete set of actions the engine can execute. Two
properties make it the authority boundary rather than a suggestion.

**1. The enum is closed.** `action` is a Zod enum over `ACTION_NAMES`. A model that
answers `"ascend"`, `"gain_spirit_stones"` or `"set_realm"` fails validation, and a failed
validation is not an error path the player notices: it falls back to the keyword parser
and the game continues. A model cannot widen the list at runtime, so it cannot invent an
action. Adding a member is a deliberate act the compiler forces into `GameService.execute`.

**2. The object strips.** Zod's default object mode drops unknown keys, so a response of
`{"action":"cultivate","realmOrdinal":24,"spiritStones":9999}` yields exactly
`{action:'cultivate'}`. There is no code path anywhere in `src/web` that reads a number
out of a model response and writes it to the database. The only numeric field that
survives is `days`, and `days` is an **input** to a deterministic simulation, not an
outcome of one - bounded on both ends, so a model answering `1e9` cannot ask the simulator
for a heat-death loop and one answering `0` cannot produce a no-op the player paid a turn
for.

### Why it is not a verb list

A flat taxonomy of verbs only grows. `negotiate, deceive, trade, flee` becomes
`bribe, threaten, spy, interrogate, steal, sabotage, recruit, intimidate`, and every
social nuance ends up as an engine mechanic. So the expressive range lives in
**parameters** instead:

```text
interact      target + intent   dealing with a person or a faction
investigate   target            examining a place, record, object, person
move          target + intent   going somewhere, by whatever means
```

One caveat learned the hard way, and it is the reason four members were added at once.
**`interact` swallows any sentence that names a faction**, which made it the catch-all for a
whole category the vocabulary did not cover: institutions acting on each other, and on you
beyond membership. A player filing a Requisition, offering an alliance or asking an apex for
one of its objects got a bystander, a shrug and a paragraph about the building - text that
looks like an answer, so they could not tell REFUSED from NOT IMPLEMENTED. That is worse
than silence. A catch-all is only safe while the things falling into it genuinely have no
engine behind them, and this one had six catalogs behind it.

alongside the world-facing operations that genuinely are distinct engine routines with
distinct state effects: cultivate, seclude, breakthrough, train_technique, refine, gather,
eat, provision, treat, buy, work, market, attack, sect, site, wait, plus the pure reads.

Three of those were added after the same discovery, made three times: **a mechanic the
engine has always had, that no typed English sentence could reach.**

| | what was already there | what a player got instead |
|---|---|---|
| `treat` | `treatWorstInjuries`, exercised by `playtest.ts` | "The thought does not resolve." while the engine said the injuries were lethal and would not heal |
| `buy` | twenty-odd priced lines printed by `market` | the party resolver, looking for a person called "visit from the mortal physician" |
| `site` | ~1,900 lines of trials, graves and three gate kinds | nothing at all; the catalog was unreachable from the command bar |
| `recall` | `knowledge_records`, and the sheet's own DAO panel | nothing; "what do I know of X" and "what is my dao" both parsed to `unclear` |
| `petition` | `handlePetition` and `handleWake` in `sect-politics.ts`, complete with the discovery gate applied to tool output | nothing typed reached a line of it |
| `posture` | `DISASTER_RESPONSES`, `OPENLY_OR_IN_SECRET`, nineteen symmetric `contestedWith` claims, two courts in the catalog's own history that changed patrons | no verb at all |
| `seal` | six houses holding a sealed ancestor with a written `wakeCondition` and `wakeCost`, the strongest at forty-four | no verb at all |
| `offer` | `IMMORTAL_CHANNELS`, `MillennialOffering`, `IMMORTAL_MOTIVE` on why an offering buys two words | no verb at all |

The `recall` case is the one that says most about how to look for these. It was found by a
**rank-band sweep** - standing a character at each rung and typing what somebody at that
height would actually type - and the three dead sentences were at ordinals 37-46, at the
very top, where the ladder is finished and comprehension is the only axis still moving.
Testing the opening moves of a run would never have found it. Reachability has to be checked
at every height a player can be standing, not only at the one they start at.

The `treat` case is the one to remember, because it was not a missing convenience. Untreated
injuries raise deviation risk, deviation adds another injury and ejects the cultivator from
seclusion after about a month, and the next attempt goes wrong sooner - so a hurt cultivator
could not advance, could not heal, and could not die. **An engine that manufactures a state
it labels lethal, says the state will not resolve itself, and offers no verb has softlocked
the run.** When adding a mechanic, the question is not whether it is implemented and tested.
It is whether a sentence reaches it.

### `intent` is open, and is never branched on

`intent` is a free-ish label, and it is safe **precisely because nothing in the engine
branches on it to decide an outcome.** It is carried for the narrator to reason about and
for the log to record.

> The moment a line of code reads `if (intent === 'bribe')` to pick a result, the design
> has failed: the outcome must come from state - who these people are, what they want,
> what they know, what is owed - not from the word the player used.

`MOVE_INTENTS` and `INTERACT_INTENTS` exist only as suggestions in the prompt. They are
not a schema, and the field accepts any short label. A model that writes a whole sentence
there has not done anything dangerous, so `validatePlan` truncates it to a label rather
than rejecting the plan and costing the player a turn.

**Eight actions read `intent`, and every one of them is selecting WHICH READ OR ROUTINE runs
rather than what came of it.** `sect` uses it to pick between joining, leaving, the stipend,
the standing, an order to the rung below, a siphon of the reserves, and the four powers a
seat holds - recruit, admission, curriculum, expel. `look` uses it to pick between the room,
the faces in it, and what was done to the ground here. `site` uses it to pick between the
four steps of taking an inheritance - approach, outside, enter, take. `recall` uses it to
pick between the two things a cultivator carries - what they have HEARD, and what they have
UNDERSTOOD. `petition` picks which form is being filed, `posture` which stance a house is
taking, `seal` whether the thing under the mountain is being read or spent, and `offer`
whether the line upward is being read or paid. All eight are safe for the same reason: the
label is matched against a closed set of literals, an unrecognised one falls through to the
default, and every outcome on the far side is computed from state. The rule that still binds
is the one above - no `intent` value may ever decide a *result*.

**Five of them carry an extra obligation, and it is the same obligation.** `site` has a step
that spends days and can kill; `posture`, `seal` and `offer` each have a branch that commits
the house to something it cannot walk back, and one of them changes a power ordinal
permanently. **Their default must be the cheapest branch they have**, so a model answering
`{"action":"site","intent":"go in and get it"}` gets the listing rather than the door, and
one answering `{"action":"posture"}` gets the standing between two houses rather than a war.
That is `DEFAULT_SITE_INTENT`, `DEFAULT_POSTURE_INTENT`, `DEFAULT_SEAL_INTENT`,
`DEFAULT_OFFER_INTENT` and `DEFAULT_PETITION_INTENT`, each matched against its own closed
set, and `tests/web/misparse.test.ts` asserts that every one of them is a read.

### The standing gate, and why it is a file

The four institutional verbs are all one shape - **a party asking something of another
party, of the dead, or of somebody above the Lid** - and most of them are supposed to be
REFUSED. A refusal that names its reason is the win condition here rather than a
consolation: the Requisition Against Standing Stock has been granted once in four hundred
years and refused ten times, and the catalog says the refusals are filed with the same care
as the grant.

So the gate is the feature, and [`standing.ts`](standing.ts) is where it lives. It copies
`noAuthority` in `sect-leadership.ts` sentence for sentence rather than inventing a second
voice for the same act, because that refusal is already the best-written one in the project
and three properties make it good:

- **it states the rung it opens at, in that house's own title** - not "you lack authority"
  but *"It opens at Sect Warden, and not before."* A player learns the ladder by being
  refused on it, and the title comes off `ranks[]`, so it is right in a four-rung court and
  a six-rung pavilion with no branch on either;
- **somebody with no house gets a different refusal from somebody junior in one**, because
  the first is about position and the second is about rank, and it names what the act would
  actually require rather than restating that it failed;
- **what succeeds prices itself in the same breath**, out of the catalog, rather than in a
  rules note beside the outcome.

Two things this must keep getting right.

**Rank is not realm.** `realmOrdinal` says how hard somebody is to kill; `rankIndex` says
whether anybody has to do what they say. The catalog is emphatic that the two come apart -
the Long Cut ranks by work and nothing else, so a Hand may be an apprentice of nineteen or
an Inner Face cultivator of four hundred. Every gate in `standing.ts` is on the rank.

**The gate goes before the target resolves, for the acting branches.** Both refusals are
about the speaker and disclose nothing about who was named, so they are safe to give to
somebody who has never heard of the house in the sentence - and a rogue at the bottom of the
ladder learns what a declaration would take, which is a thing they can go and get. Resolving
first answers them with the knowledge gate instead, which is correct and teaches nothing.

### The far side of the Lid is somewhere, not a refusal

Ordinal 46 is the one point where progression is also *geographic*, and the layer on the
other side is one of the most complete systems in the project. Played cold at 46, every verb
came back **"Not from here"** and there was no other verb - a correct, well-written refusal
in front of an empty room, which reads as the game ending rather than as the game moving.

Nothing in the codebase called `ascend`, `descend`, `sendAcross` or `ensureImmortalLayer`.
That is the same discovery as `treat`, `buy`, `site`, `recall` and the four institutional
verbs, at the one height where there is nothing else to do at all.

**What an immortal has is an abode and a choice.** [`above.ts`](above.ts) is the whole of the
wiring:

| | |
|---|---|
| `residentAbove` | the player, as somebody the far side has a row for. Same id as the cultivator, so lineage, grudges, facts and object provenance keep resolving across the boundary instead of becoming two people. Settles the abode on the way past |
| `linesDownward` | channels this resident could actually use. A line is an OBJECT held by somebody below, which is the whole difference between a house that receives and a house that hears nothing |
| `theTwoWaysDown` | a mortal-world sentence, re-offered rather than refused |

**A mortal-world verb above the Lid is re-offered in the two forms an immortal has**, and
neither is invented here:

- **by proxy** - `offer` with intent `send`, through `sendAcross`. No tribulation, because
  nothing of them crosses; and no control, because what happens next is done by people who
  are not them. `OBJECT_CEILING_BELOW_THE_LID` is what makes it interesting rather than a win
  button: a 46 cannot stay down there, so what arrives and *remains* is a 45, which is
  precisely how the best objects in the world came to exist.
- **in person** - `descend`, through `evaluateLidTransit(down)` at nine strikes, resolved by
  `resolveDescentStrikes` on the same per-strike odds and the same lethal-at-three rule every
  tribulation in the game uses. About one attempt in ten arrives. The window on the ground is
  `BREATHS_IN_THE_LOWER_REALM` and **the expulsion is not a second action**: `descend`
  resolves the visit atomically, because a True Immortal in the lower world is a thing being
  pushed back out for the whole time they are there.

`offer` is deliberately *not* in `MORTAL_WORLD_ACTIONS`. It is one verb from both ends - an
offering going up below the Lid, a thing going down a line above it - and which end the
speaker is standing at is decided by state rather than by the word they used. Two verbs for
that would have been two implementations of one relationship.

`look` has its own above-the-Lid branch, and the reason is a bug rather than a preference:
the ordinary read described the ambient of a province, observed a Dao house's practice among
people who are not there, and overheard two names through a wall on the other side of the
Lid. It is enforced by not calling the mortal-layer readers rather than by filtering them.

**One assignment was the reason none of this was reachable through play.**
`attemptBreakthrough` decides `immortalStatusGained` and `strikeBarrier` was not writing it
down, so a cultivator could survive the last crossing, be told they had gone through, and
still be `immortalStatus: 'none'` on the next read. Everything above the Lid gates on that
field.

### What the write side would need

`recall` reads what a cultivator has comprehended. There is no write, and there is
deliberately no verb for one. "I carve my dao into the stone" and "I teach the flying blade
to a disciple" are the two sentences a player at the ceiling reaches for, and both are
`unclear` on purpose - because **nothing in the engine records a carving, no disciple exists
as a row that could be taught** (an intake is a count on a house ledger, not a person), and
`legacy.ts` writes a successor's inheritance at death rather than by anybody's decision.

Both sentences used to be answered by the `recall` panel, which is a well-composed paragraph
about what the cultivator understands and looks exactly like an answer. That is the same
failure `interact` was producing for the institutional sentences, and it is worse at the top
of the ladder, where a player has no way to tell that the carving did not happen. The veto
is `PUTTING_IT_SOMEWHERE_ELSE` in `actions.ts`.

Making it real needs three things that do not exist: a disciple as an entity rather than a
count, a technique transfer between two holders, and a carving as something a location can
carry and a later cultivator can read. The third is the closest - `engine/world/locations.ts`
already carries a place's change log - and none of it belongs in this package.

---

## Target resolution

`interact`, `investigate`, `move`, `refine`, `gather` and `train_technique` all take a
free-text subject, and free text is exactly where a hallucinated entity would get in. So
`entities.ts` trusts nothing: the string is matched against **real rows and real catalog
entries**, and a subject that matches nothing resolves to nothing. The caller then refuses
the action rather than narrating an encounter with a person who does not exist.

> The enum stops a model inventing an **action**. Target resolution stops it inventing a
> **thing to do it to**.

Refusals are informative rather than blank: the engine says what it does not hold and
lists what is on record nearby.

The one deliberate exception is a place name, documented at `resolvePlace`.
`Cultivator.location` is explicitly a name the engine stores and lists but never computes
with, which is what makes accepting an unrecognised destination safe.

### `recall` resolves against the holder, never against the world

The one target resolution in this package that does **not** consult a catalog. "What do I
know of X" scores the query against **this cultivator's own `knowledge_records`** and stops
there, which is what makes the verb structurally incapable of teaching anybody anything: there
is no code path from a name the player typed to a name they have not been told. Two
consequences follow, and both are required rather than incidental:

- **An unheard name and an invented one come back identical.** Only the quoted string
  differs. The shape of the refusal must never be the answer - same discipline as the
  `causeKnown` gate on place history.
- **Fragments are never joined up.** A holder carrying several incompatible accounts gets
  several incompatible accounts, unranked, with the engine saying outright that whether any
  of them are the same thing is not something they know. Working that out is the prize; a
  read that merged or ordered them would have handed it over for the price of a question.

The only enrichment is for a record held at stance `knows`, and it goes through the same
awareness-gated resolvers `investigate` already uses - so it discloses nothing a second
sentence could not already have got. Anything at a lower stance renders as the record's own
sentence and nothing else, which for an overheard name is "a name that got said. What it is
remains unknown." **That thinness is the content**, not a gap for a renderer to fill.

### An inheritance ground has a second gate on top of that one

`trials.ts` resolves a site the way `entities.ts` resolves everything else - against real
catalog rows, with a near miss refused rather than guessed - and then applies the awareness
rule from `docs/world/discovery.md` on top: **a site whose awareness is below `named` cannot
be resolved at all**, because the catalog withholds its name, so there is nothing to type.
Thirteen of the entries start at `named` and are typeable by a villager; the rest have to
reach the player from somebody first, exactly as a sect name does.

A specific name that resolves to nothing does **not** fall through to the site at hand. That
is the elder-dismissal rule applied to doors: naming a grave you have only heard rumoured
must not quietly open the one you were standing at an hour ago.

The structural gate underneath is the catalog's, and nothing in this package weakens it.
`outsideViewOf` returns a type with **no `interior` key**; `SiteFace` in `facts.ts` likewise
has no field that could hold one; and the single call to `enterSite` in the whole reachable
surface sits below a recorded entry, in a method that has already spent the days. A player
who has not gone in cannot learn what is inside through any phrasing, and there are three
independent reasons for that rather than one convention.

---

## The deterministic fallback is not a stub

Two narrator implementations:

- **`DeterministicNarrator`** - keyword intent parsing plus the engine's own prose from
  `facts.ts`. This is what `docker compose up` with zero configuration plays like, and
  **the whole game is reachable through it.**
- **`ProviderNarrator`** - wraps an `LLMProvider`. Every failure mode (no response, a
  timeout, prose instead of JSON, an invented action name, an invented stat field)
  degrades to the deterministic path rather than to an error. A player whose Ollama
  container is not running should notice worse writing, not a broken game.

The keyword parser is conservative on purpose. An unparseable count next to a recognised
unit means one of that unit, because undershooting a permadeath time-skip is the forgiving
direction to be wrong in. A bare number with no unit is not a duration: "I strike the
barrier 3 times" must not become three days of seclusion. And a movement phrase that names
no destination returns nothing rather than guessing, because a parser that answers
"I set out." to the question *where to?* would send the cultivator to a place called
"I set out.", the engine would dutifully store it, and the run would be quietly nonsense
from then on.

`PlanSource` and `Narration.source` are surfaced to the client so the seam is visible: the
player can always see whether the model or the fallback produced what they are reading.

---

## `facts.ts` is the only bridge

This module is the single place where a `TimeSkipResult`, a `BreakthroughResult` or a
survival state becomes a sentence, and **neither narrator path may bypass it**:

- the provider narrator is handed `lines` as the *entire* factual content of its phase-3
  prompt, so the model has nothing to narrate from except what the engine actually
  returned;
- the deterministic narrator ships `prose` verbatim.

That symmetry is the point. With no provider configured the player reads the engine's own
account; with one configured they read the same account in better sentences. Neither
version can contain a fact the engine did not produce, because neither version is composed
anywhere else.

---

## `apply.ts` is the only writer of a time-skip

`simulateTimeSkip` is pure: it mutates nothing and hands back deltas plus a digest.
`apply.ts` is the one function in this package that turns that into rows, which makes it
the one function to read when asking "can a narrator's output reach the database?" The
signature answers it: **it takes a `TimeSkipResult` and no prose.**

Almost nothing is implemented there. The MCP tool layer already persists skips and writes
to the *same* database this server does, so the derivations, the injury reconstruction and
the price of a crossing are all taken from
`src/server/consolidated/cultivation-support.ts` verbatim. Two implementations of "what a
crossing took" would eventually disagree, and the disagreement would be a corrupted save
rather than a failing test. `apply.ts` owns only the ordering and the transaction - one
transaction, because a save that has the injuries but not the aging is worse than a save
that has neither.

---

## Prompts

`prompt.ts` is the one module to tune when the prose is wrong. It holds the phase-1
classifier prompt and the phase-3 stylist prompt, and nothing else may compose a model
call in this package.

The world bible is far too long to send on every call, so `prompt.ts` currently carries a
hand-maintained compression of it: the ceiling, qi as a contested and unevenly distributed
resource, the price of a crossing, the Late Age, the naming conventions, and the rule that
engine outcomes are never softened. It deliberately excludes the mechanical tables,
because the engine has already applied them and the model is not being asked to reason
about numbers.

That compression should converge on
[`../../docs/world/NARRATOR-CORE.md`](../../docs/world/NARRATOR-CORE.md), which is the
assembled Tier-1 text maintained as a single file for exactly this purpose. Situational
material - sects, Dao houses, ruins, the economy, the immortal layer - is Tier 2 and
should be loaded when the situation calls for it rather than sent every turn. See
[`../../docs/world/README.md`](../../docs/world/README.md) for the tier scheme.

---

## Nothing here branches on which provider is in use

Selection is configuration, resolved once in `server.ts` by
`resolveRuntimeProviderConfig()`. `Narrator.providerName` exists for diagnostics only. See
[`../agent/provider/README.md`](../agent/provider/README.md).

---

## Names enter through people, never through the narrator

Three files, and the split between them is the contract:

| | |
|---|---|
| `knowledge.ts` | what this cultivator has ever heard of. The gate the whole rule rests on |
| `lore.ts` | the **speakable world**: every name anybody could say, and the terms for saying it |
| `hearsay.ts` | whether a name gets said in this scene, which, and by whom |

`docs/world/discovery.md` is the constitution: **never reference an entity the player has
no knowledge record for.** That rule governs the narrator's own voice and it must not gag
the people in the world - a cultivator says a name flatly because *of course* you know it.
So content becomes reachable by being **acquirable**, never by being printed:

1. `lore.ts` decides which names a present speaker plausibly holds.
2. `hearsay.ts` picks one, and the engine writes the knowledge record itself.
3. Only then is the narrator handed a licence to have somebody say it.

Inverting those steps - letting the model drop a name and reading it back out of the prose
- is the forbidden move, because it takes state out of a model response.

`lore.ts` draws on **every** catalog under `data/cultivation/`, not the sect list: the
courts, the members, the guest elders, the venues, the ages, the dead civilisations, the
readings of the Lid, the sealed ancestors, the channels upward, the wanderers and the
legends that circulate about them. Three gates decide who can say what, and none of them
consult the player, because a speaker is not adjusting for their audience:

- **floor** - the standing at which the name is in a person's working vocabulary
- **insider** - a faction's own people hold their own names whatever their standing
- **locality** - used for **weight only**, never for exclusion. Names do travel, rarely,
  and often wrong

Weighting is by band rather than by row, so a catalog's size cannot buy it airtime. The
deep material is weighted six times higher in the **overheard** channel than in the told
one, which is the texture `discovery.md` asks for: fragments the player cannot resolve and
cannot ask about.

> If a change here makes somebody helpfully explain the Late Age, it is wrong. The measure
> is that a player accumulates fragments they cannot yet place.

`tests/web/lore.test.ts` holds the regression guard: every catalog must still be reachable
by somebody on the player-facing path, so "written but unreachable" fails the build.

### The other half: what a player sees

`practices.ts` is the same problem with the opposite answer, and the two must not be
confused. A **name** is told, and `discovery.md` gates it. A **practice** - what an
outsider sees of a faction's people in the first ten minutes - is *seen*, names nothing,
and is what NARRATOR-CORE means by:

> Show the world, never explain it. Render these as behaviour and let the player infer.

Every faction in `faction-character.ts` has one, and they are among the best writing in
the project: disciples who stand when a sword is drawn anywhere in earshot, including in a
kitchen; members who greet each other by naming a ford rather than by name. Because a
practice identifies nobody, it is safe in the narrator's own voice for a player who cannot
name a single thing in the world - being in the room is the whole qualification.

The one gate is narrow and **computed rather than asserted**: eight of the thirty use
their own faction's short name mid-sentence ("a Consortium negotiation", "the Office"),
and those unlock only once the player holds the name. The detection reads the text, so a
rewritten practice cannot silently start leaking a name nobody thought of as one. A
capitalised word at a sentence start is a role and stays open - "Wardens carry paint"
identifies nobody, and three separate factions open that way.

At most one observation per scene, always. A scene listing what three factions do is a
briefing with people standing in it.

## The standing register

**The world reference sheet lives in [`register.ts`](register.ts). That is where to change
it, and it is the only place.**

It is a **view over the catalogs**, not a document. `buildRegister()` reads
`data/cultivation/` and `engine/cultivation/realms.ts` and returns a `WorldRegister`;
`renderRegisterHtml()` turns that into one self-contained page. Nothing in the file
authors a fact, so the sheet cannot drift from what the engine believes - if a figure
looks wrong, the catalog is wrong and the fix belongs there.

Three ways to get it, one build behind all of them:

| | |
|---|---|
| `GET /api/admin/register` | the structure, as JSON, for tooling |
| `GET /api/admin/register.html` | the rendered sheet - what the **Register** button in the game opens |
| `npm run register` | writes it to `build/standing-register.html` |

Regenerating is a reload. The endpoint rebuilds on every request, so after editing a
catalog the sheet is current with no step in between.

### The curated prose

The tables are the catalog. The italic paragraphs between them are a model talking about
the catalog, and they live in [`register-prose.ts`](register-prose.ts) so the two can never
be confused for each other - separate file, separate cache, separate visual block.

**Lazy, cached, and fingerprinted.** Nothing is generated until somebody opens the sheet.
Every block stores a hash of the facts it was written from, recomputed on each request:

| | |
|---|---|
| fingerprint matches | serve it, no provider call |
| fingerprint differs | the catalog moved - rewrite that block only |
| missing | write it |

Blocks are fingerprinted individually, so editing one catalog does not invalidate the
whole sheet. The cache is JSON beside the database, so it survives restarts and rebuilds.

**It never fails the page.** No provider, no key, a timeout: the stale text is served with
a *behind the catalog* marker rather than dropped. A sheet with one dated paragraph that
admits it is dated beats a sheet with a hole in it. Same posture as the deterministic
narrator - an unconfigured model is a quieter page, never a broken one.

**Forcing a rewrite:** shift-click the Register button, or `?refresh=1`. That is the only
way to rewrite prose whose facts have not moved, and it is deliberately not what an
ordinary click does, because it costs provider calls.

**The prompt rule:** the model is handed `section.facts(reg)` and nothing else, and is told
it may not introduce a name, number, date or relationship absent from them. Same discipline
as `facts.ts` feeding phase 3 - a model may describe what the engine decided and may not
decide anything. Bump `PROSE_SCHEMA_VERSION` when the prompt changes and every block
invalidates without touching a catalog.

**Adding a new kind of thing to the world?** Add it to `WorldRegister`, extend
`buildRegister()` to read its catalog, and add a `<section>` to `renderRegisterHtml()`.
Keep the ordering rule the sheet is built on: **ordinal is the strongest _acting_
member**, never a sealed ceiling and never a withdrawn one - those are separate columns
because conflating them is the specific bug the register exists to make visible.

### Why it is admin-gated

Not a security boundary; a disclosure one. Nothing behind `assertAdmin()` writes. The
sheet names the two apexes a starting cultivator is `unaware` of, prints which sealed
ancestors are *not* publicly known, and lists a wanderer whose entire design is that
nobody knows he exists. Handing it to a player is handing them the answer key. Same
reasoning as `game.ts`'s refusal to let a `sect` query return the register: see the note
above `GameService.sect()`.

## The world map

**The map lives in [`places.ts`](places.ts), and like the register it is a view rather
than a document.** `placesView(world)` reads `WorldState.locations` and returns nodes and
edges; `web/app.js` renders them. Nothing in either file authors a place, a road or a
distance.

| | |
|---|---|
| `GET /api/admin/places` | the whole map as JSON - admin only |
| **World Map** in the admin menu | the panel the operator actually opens |

### The map may not invent geography

A line drawn between two places is read by whoever is looking at it as a road, so the
whole module is arranged around not drawing one that is not there:

- **An edge is a `LocationLink` and nothing else.** A link naming a location this world
  does not hold is counted in `danglingLinks` and not drawn; so is a link from a place to
  itself.
- **A road recorded from both ends is one road.** Where the two ends disagree about
  `travelDays` the larger is kept and `asymmetric` is set, because a traveller does not
  get to pick the cheaper direction's number.
- **The payload carries no coordinates, and must not start to.** `LocationRecord` has no
  position and has never needed one: containment is `parentId` and distance is
  `travelDays` on a link. A renderer handed x/y would be laying out a claim about where
  things are that no part of the world supports. That is why the panel is a containment
  view with the graph drawn over it rather than a force layout, and why it says *position
  is containment, not geography* on its own face.

`tests/web/places.test.ts` pins every one of those.

### Built for the player it does not serve yet

`discovered` is on every node and is never filtered server-side. The admin panel shows all
of them and marks the undiscovered ones, so an operator can see the fog the player is
standing in; the *As the player sees it* control drops them, which is exactly what a
player-facing map would do at the boundary. See
[`../../docs/world/discovery.md`](../../docs/world/discovery.md) for why that gate exists
at all.

### Depth is walked, never assumed

The seeded world was 65 places in two levels; with interiors it is 857 in five, and it
will move again. `depth` is computed by walking `parentId` with a visited set, the client
renders containers recursively, and the panel folds everything below the regions by
default because eight hundred tiles is not a map.

## Related

- [`../../context.md`](../../context.md) - the authority rule this package enforces
- [`standing.ts`](standing.ts) - who is entitled to commit a house, and what the refusal says
- [`register.ts`](register.ts) - the standing register, and the only place to change it
- [`places.ts`](places.ts) - the world map view, and the rule against inventing geography
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - what phase 2 actually runs
- [`../agent/provider/README.md`](../agent/provider/README.md) - provider selection and config precedence
- [`../storage/README.md`](../storage/README.md) - the database both front doors share
