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

**The enumerated form of it is [`docs/verbs.md`](../../docs/verbs.md)** - every verb, what a
player is asking for when they say it, what it takes, its intents, and where it resolves -
generated from `what-each-verb-is-for-in-the-players-words.ts`, which is also what the
phase-1 glossary is composed from. This section is the argument for the shape; that document
is the shape. Neither restates the other.

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
| `news` | the whole world ledger - every ranking, refusal, duel and house opening closed ground the simulation has ever written | four phrasings of "what news is there" deflecting into the `recall` listing, which is an inventory of what the player already held |

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

### A verb space nobody can find is a verb space nobody has

The table above is the story of mechanics no sentence could reach. This is the
next one along, and it is bigger: **every one of those verbs works, and a player
cannot discover a single one of them.** Found by playing a full run in the
browser, age 16 to 39. The interface offers three controls - Cultivate, Status,
Attempt Breakthrough - and:

| typed | answered |
|---|---|
| `help` | *"You turn the thought over and it does not resolve into anything you could actually do standing here."* |
| `what can I do` | the same refusal |
| `what are my options` | the manual read, which is a good answer to a different question |

while `I look for work`, `gather herbs`, `I buy food`, `who can teach me`,
`what is stopping me`, `see a physician` and a dozen more all answer well and
were reachable only by guessing. The two most universal inputs in the history of
text games both refused.

That is fatal rather than annoying, because the engine builds a real trap. The
run that found it reached qi deviation at Qi Condensation Layer 9 with three
untreated meridian injuries, every stone spent on food and satiety at zero -
five turns from death, with a way out: work, gather, eat. A player who reads only
the screen presses Cultivate, because it is the only obvious control, and dies.
**The trap is well designed. The exit was hidden.**

[`what-is-worth-doing-standing-here.ts`](what-is-worth-doing-standing-here.ts) is
the answer, and it is a pure function: state in, sentences out. Three consumers,
one source, so they cannot drift:

| | |
|---|---|
| `help`, `what can I do`, a bare `what are my options` | `GameService.guidance`, a free read like `ceiling` |
| every unparseable sentence | the `unclear` refusal now names two or three things that WOULD work |
| `derived.standingHere` on the wire | for a client to offer beside the standing controls |

Four rules it must keep, and each of them is a way this could go wrong:

- **Prompts, never a menu.** The whole character of this game is that you say
  what you do in your own words. A fixed command list would flatten it, so the
  read always closes by saying it is not the list.
- **Situated, never a dump.** Every line is gated on a fact the engine already
  computes, and `MOST_A_PLAYER_SHOULD_READ` caps the whole read - measured, a
  maximally unlucky state reaches fourteen live rules at once.
- **Every sentence is verified to parse.** `say` is a string driven through
  `parseIntent` by `tests/web/what-is-worth-doing.test.ts`. Offering a player a
  sentence that reaches nothing is *worse* than the refusal it replaces, because
  they conclude the game is broken.
- **Nothing changes an outcome.** No price, no probability, no unlock. Dying
  becomes a decision rather than a failure to guess vocabulary.

### A refusal is finished when it names the thing that would work

The medicine layer is the sharpest case, and it is the same defect
[`../../docs/world/things/items.md`](../../docs/world/things/items.md) closes with a warning
about, one layer up: that build's commonest cause of death had no reachable cure
while the formula sat in the catalog. This time **the cure is reachable and its
name is not.** Measured, carrying a crippling tear and 194 spirit stones against
a 54-stone cure:

- `buy a healing pill` sold a Minor Healing Pill - 6 HP, closes nothing;
- `see a physician` said *"cannot touch a meridian"*, which is **false**: mortal
  care closed two torn meridians and two scorched channels in the same run. What
  it cannot touch is a **crippling** one;
- `what would close my meridians` did not resolve at all;
- the answer was a Clear Meridian Pill, and it was found by reading `pills.ts`.

[`what-would-close-this-wound.ts`](what-would-close-this-wound.ts) names it, at
its board price, with whether the purse covers it - in the physician's refusal,
in the `help` read and in the panel. It authors nothing: the pill is the
catalog's, the price is the board's, the grade rule is
`what-grade-of-medicine-a-wound-needs.ts`.

**One thing it found and did not settle, now settled.** The grade ladder used to
be enforced in exactly one place, `GameService.treat`. The pill path had none -
`treat_injury` in `alchemy-manage.ts` called `treatWorstInjury` and nothing else
- so a mortal Clear Meridian Pill closed a crippling tear a physician would
refuse. That was written down rather than patched because it is a design
question and closing it makes the game harder. It has since been put to the
design owner and answered: `treat_injury` passes `medicineReaches` into
`treatWorstInjury`, and the physician and the pill now give the same answer
about the same wound.

Two consequences for this directory. `whatSomebodyWouldGoAndGet` filters by
`medicineReaches` rather than naming the cheapest treat-injury pill in the
catalog, because a name the resolver will refuse is worse than no name. And the
price board carries every commodity-tier cure, which it did not: the earth-grade
answer an ordinary tear needs on a Core Formation body was quoted nowhere in the
world. `tests/data/every-purchasable-cure-is-on-the-board.test.ts` holds that
shut.

**What a wound needs is not what a maker needs.** The severity-and-height ladder
above is `what-grade-of-medicine-a-wound-needs.ts`. Who may *refine* a grade is
`who-can-refine-a-grade-of-medicine.ts`, answered by the alchemist's own realm,
and nothing in this directory should ever read one as the other.

### A clause the turn did not run is named, never dropped

The rule above has a hole the shape of a sentence with two verbs in it. Found by
playing: `I buy a month of rations and eat` bought the rations and did not eat,
and **said nothing about the eating**. That is worse than a refusal - a refusal
at least tells you where you stand, and a dropped clause is indistinguishable
from an action that ran and did nothing.

**And it happens in both directions.** The parser takes whichever verb its table
reaches first, which is not always the first verb in the sentence, so
`I gather herbs and go to the market` browses a board and the gathering is gone.
That is the same defect from the worse end: when the second thing is dropped the
player at least watches the first one happen and can guess, and when the first is
dropped the expensive thing vanishes and a cheap read runs in its place.

One turn is still one action, and
[`the-part-of-the-sentence-that-was-not-run.ts`](the-part-of-the-sentence-that-was-not-run.ts)
does not change that. It is not command chaining, and it must not become it: the
game's character is that you say what you mean in your own words and the engine
prices it, and two verbs can legitimately cost two spans. What it does is report
the clause, in the player's own words, with the sentence that would work beside
it - into `facts.prose`, `facts.lines`, `facts.structure` and the inspector.

**One rule, and it was settled by measurement rather than by taste:**

> A clause is worth reporting only if it would have COST something.

Free reads are never reported, on either side, and not as a tuning choice:
nothing was taken. `look`, `market`, `status`, `interact` and the rest of
`READ_ONLY_ACTIONS` spend no day, no ration and no stone, so a player who wanted
one can say it next turn and have it for nothing. Against a corpus of sixty
ordinary one-intent sentences containing the word "and", reporting any clause
whose reading differs from the turn's produced **seven false reports and every
one of them was a free read** (`I speak to the elder and ask about a manual` is
one act, not two); the same rule with the cost guard produced **none**, while
still catching every costly clause on either side. The guard also removed a false
report an earlier version was already shipping - `I go to the ruin and look
inside` announced that the looking had not been done.

**What that costs, stated plainly.** `I work for a season and then go to the
market` no longer reports the market visit, because browsing a board is free. A
lie about half the player's sentence is worse than silence about something they
can have next turn at no price.

### What a seclusion will cost to eat is quoted before it is entered

You cannot cultivate for longer than you can eat, and the ration purchase at the
cave mouth is what makes a long stretch possible at all. That mechanic is right.
What was wrong was the order: a player entered seclusion holding 54 spirit stones
and came out holding none, told about it afterwards.

[`what-feeding-a-stretch-of-seclusion-costs.ts`](what-feeding-a-stretch-of-seclusion-costs.ts)
owns the provisioning arithmetic, and **it owns it once**. `GameService.buyProvisions`
runs it to spend the stones and `GameService.provisionsForAStretch` runs it to
answer `GET /api/seclusion/provisions?days=N`, which is what the seclusion picker
prints above its button. A preview computed by a second implementation would be a
second economy and would drift the first time either half was touched, so there
is no second implementation - the played test asserts the quote equals the charge.

**A bill of nought has three reasons and they are not interchangeable.** The body
has stopped taking meals (`hungerHasStopped`, from Deity Transformation up, where
`SATIETY_BURN_BY_REALM` is zero); the pack already holds the whole stretch
(`cost === 0 && short === 0`); or the purse will not reach a single ration
(`toBuy === 0 && short > 0`). The first two end the matter. **The third is a
starvation warning wearing their clothes**, and a surface that reads a zero bill
as good news swallows it - which is what the picker did, returning early and
never rendering the warning underneath. The engine half of this is
`buyProvisions`, and the picker prints its sentence rather than a second one:
two surfaces phrasing one fact differently is how a codebase acquires two answers
to a question. Pinned by
[`the-picker-says-why-there-is-nothing-to-buy.test.ts`](../../tests/web/the-picker-says-why-there-is-nothing-to-buy.test.ts).

The same rung frees the low-belly warning too. Satiety stops moving where hunger
stops, so a cultivator who crossed on an empty stomach carries that number for
life, and the picker told them on every stretch that this is how runs end. **The
sheet's satiety chips still do**, because `/api/state` carries no field saying
whether this body eats and the client must not keep its own copy of the burn
table.

The picker asks a second time only when the purchase takes 75% or more of the
purse, in the shape `Cultivate` with no manual already uses. Every other stretch
gets the figure and no extra click: prompting on every seclusion is tedium on the
common case, and the point was never to make food a decision - it was to stop the
purse leaving without the player having seen the number.

**A press that lands before the quote does not skip the confirm.** It used to:
the click went straight through and the one case the confirm exists for is
somebody about to spend everything. `confirmPick` now cancels the debounce, asks,
and says `Pricing the food…` on the button while it waits. It still falls through
to the seclusion when the endpoint *fails* - a player must not be held out of the
game because a read is unwell - but not merely because the answer is in flight.

**The free-text route is not quoted, and that is a decision rather than a gap.**
`I cultivate for two years` reports the purchase afterwards. There is no commit
point on that route to quote at, and the two ways to invent one are both worse
than the honest report: refusing the sentence and asking again is banning, and
silently making the food optional is softening. AGENTS.md answers "may I?" with
"yes, and here is what it costs", which is exactly what the typed sentence
already gets. The picker needs a preview precisely because a button carries no
sentence and therefore no intent; a player who typed the years has said what they
meant.

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

Making it real needs three things, and one of them now exists in one direction. A **technique
transfer between two holders** is what `request` does: a person who agrees to teach the player
puts the art on the sheet through `handleLearn` with `provenance: 'taught_by_a_person'`. What
still does not exist is the same transfer pointed the other way - the player teaching somebody
- because that needs the other two: a disciple as an entity rather than a count on a house
ledger, and a carving as something a location can carry and a later cultivator can read. The
carving is the closest, since `engine/world/locations.ts` already carries a place's change
log, and neither belongs in this package.

---

### Asking a person for something

The verb the design rests on, and until recently it did not exist. The engine says, correctly
and often, that there are exactly two ways past a manual's ceiling - another book, or somebody
willing to teach you - and it says it well: *"You have no name to ask for, which is the whole
of what is stopping you."* The book half works. The teacher half had no verb, and four
phrasings of it reached four different lookups, none of which was a person:

| typed, in a live run | what came back |
|---|---|
| `I ask X to teach me` | the roster of everybody standing above the player |
| `I beg X to take me as a disciple` | a description of X |
| `ask X for the Lesser Qi-Gathering Manual` | the almanac entry for the manual |
| `I bribe X with 60 spirit stones` | *"X agreed."* Agreed to what? |

`request` is the fix, and it is three files:

```text
what-a-request-asks-and-of-whom.ts        the split: who, and what of them
what-asking-this-person-for-this-        what saying yes would cost them, off
  would-cost-them.ts                       the catalogs the world already uses
saying-what-an-ask-cost-and-how-         the arithmetic in words, for the player
  likely-it-was.ts                         and for the channel at once
GameService.request                       the wiring, and the consequence
```

**`interact` is not this and must not be routed here.** Its `intent` is a free label that
nothing branches on, which is right for the verb and useless for the OBJECT: what is being
asked FOR has to reach the engine, because `AskWeight` prices resistance and duration off it
and because a take has to end in the thing actually happening.

Four rules it keeps.

- **The ask is derived, never asserted.** Whether teaching somebody an art is an afternoon or
  the end of their standing is a fact about the BOOK and the HOUSE, and `betrayalOfSelling` in
  `engine/world/manuals.ts` already decides exactly that for every NPC alive. A commonly-held
  primer is `a_real_favour`; a house's own working manual is `a_betrayal`. Nothing reads the
  word the player typed - bribing, begging, offering and asking politely produce the same
  weight for the same thing.
- **Money is priced by the same line the catalog already draws.** `PURSE_REACH` falls from 1
  at a courtesy to 0.05 at a betrayal, which is `items.md`'s line - below it things have
  prices, above it cash is not the medium - as arithmetic. So a purse buys an introduction and
  does not buy a house's canon, and no rule anywhere says so.
- **A take changes a row.** `handleLearn` has carried `provenance: 'taught_by_a_person'` since
  it was written and nothing had ever passed it. Being taught still meets the manual's own
  entry requirement, which is `manuals.md`'s second gate: *"rank says what the house will give
  you; the manual's own entry requirement says what you can open, and being favoured does not
  lift it."* An introduction writes the third party into the knowledge table. Discipleship
  writes a master that `guideFor` reads on every cultivation span.
- **A refusal names what would work.** Every one, without exception - what this person is
  actually carrying, who teaches it, that a stall sells a copy, that an introduction runs
  along a line somebody is already standing on. "No" is a bug.

**One target resolver.** `partyPutTo` and `nobodyByThatName` are shared by `interact` and
`request`, which is the fix for the symptom that made the shared resolver necessary: three
verbs each finding their target their own way, one of them resolving a party called
`"Han Peiru with 60 spirit stones to introduce me to the elder"` against a roster of two-word
names.

**The odds are said out loud, on both channels, by one module.** They turned out
to be the same sentence written twice, and finding that out cost a played run:
somebody bought the same person a drink eighteen times, got a byte-identical reply
every time, and nearly filed the verb as broken. It was landing at 13% - Charm 1,
Fortune 1, a muddled root, the worst social character the game rolls - so eighteen
misses is an 8% run, correctly modelled and never mentioned. The player with the
worst numbers was getting the least information about why.

So the prose now says how often a thing like this comes off and how many times it
has been tried, and where an attempt count has passed twice the expected wait it
says that too, because that is arithmetic rather than sympathy. The mechanical
channel says all of it: every term named, every enum resolved, and the CLAMP
stated - a reader who adds the terms up gets -1 in a hundred against stated odds of
2, and an arithmetic trail that does not reach the number it is explaining is worse
than none. `ODDS_FLOOR` is doing the one job it exists for and now says so.

The read is the same arithmetic. `oddsOf` runs every term the attempt would run and
stops at the roll, so "could I ask her to teach me" answers with the real number
rather than a description of it, and the two cannot drift because there is nothing
to drift from.

**And the marks are persisted now.** `AttemptMarks` is the resolver saying what the world is
carrying that it was not before, and its own header says every field is a record the caller
persists. Nothing persisted any of them, while `factsForAttempt` told the player *"it is on
somebody's ledger now, and ledgers here are kept"* - the narrator asserting an outcome the
database never took. Obligations and ties are written; ties are read back on the next
approach, which is what makes the twelfth time somebody asks the twelfth rather than another
first.

---

### A run does not open with nobody in it

`seedStartingAwareness` has always given a new cultivator the county. It gave them
no PEOPLE, and measured on three seeds that meant nine to fourteen places known
and zero faces, with thirteen, five and seventeen bodies standing in the square.
`company()` reports anybody with no record as an ordinal and nothing else, so
every person in the world was a permanent stranger and the four verbs that have to
be pointed at somebody could not find one.

> "you aren't dropped as a nobody, you have presumably grown up in the area you
> are in. you at least know SOMETHING to start."

[`who-a-life-like-this-grew-up-knowing.ts`](who-a-life-like-this-grew-up-knowing.ts)
draws from live world rows standing at the birthplace, nearest in standing first,
so every name it writes resolves the moment the player types it. A better birth
knows more people and knows people who stand higher - `origin.md`'s own rule, that
an origin buys inputs and never rank - and nothing but acquaintance is granted.

Two floors underneath the rung table, because the first version of it left runs
opening with nobody on about one world in five. **Your own realm always reaches**:
the table governs how far ABOVE your realm a birth reaches, and never bars you from
the people you were born level with. Measured on twelve worlds, the birthplace was
never empty - it held four to thirteen Qi Condensation cultivators, and a
`thin_county` birth reaching six rungs knew none of them whenever the village
happened to seed at Layers 7 to 12. And **the area, not the building**: if the
hamlet itself is empty the draw widens once to the places sharing its parent, for
a single name, because the ruling says the area you grew up in. Neither floor ever
hands over somebody from a realm above; the widening is sideways.

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

### `news` is `recall`'s opposite, and it is the only verb that asks other people

`recall` reads the holder's own rows and is structurally incapable of teaching
anybody anything. `news` is the other direction: it asks whoever is standing here
what is happening somewhere else, and what comes back may be wrong.

The engine is [`../engine/world/what-people-are-saying.ts`](../engine/world/what-people-are-saying.ts)
and the web side is [`asking-what-people-are-saying.ts`](asking-what-people-are-saying.ts).
Three properties, and none of them is optional:

- **Scale.** A fact is weighted UP for the standing of the people in it. A market
  talks about the top of the world rather than about itself, because a disciple
  hearing that two of the world's tallest fought is being told how big the world
  is.
- **Truth is a spectrum.** No boolean anywhere. A count of hands it passed through
  and a distortion naming WHICH part came off - the who, the where, the when, the
  size, or, at the bottom, the event. The distortion reaches the operator and
  never the narrator, for the same reason a schema category never reaches a
  prompt.
- **Attributable, therefore checkable.** The draw is seeded on (world seed, fact
  id, teller id) and carries no day, so one person always tells you the same
  version. A rumour arrives as an ordinary `Hearing` whose per-name `statement` is
  the RUMOUR'S sentence rather than the ledger's - so two tellings of one night
  land as two records on one name and `recall` hands back both, unreconciled.
  Checking a rumour is not a mechanic anybody had to build.

The refusal where nobody is present is content rather than a gap: a cultivator
forty years into a cave asking what is happening in the world is asking a wall.

### The sheet reports what the cultivator can perceive, not what the engine knows

`discovery.md`'s rule applied to a measurement rather than to a name.
[`what-you-can-tell-about-the-ground.ts`](what-you-can-tell-about-the-ground.ts)
is a gate over `how-crowded-this-ground-is.ts` and not a second set of strings.

| | |
|---|---|
| below `FOUNDATION_ORDINAL` | a feeling, banded over `density x share`, no figures |
| from Foundation Establishment | and that more are drawing on it than it likes |
| from Core Formation's start | the figures, which is the sentence that already existed |

Two things this must keep getting right. **The low end stays actionable** - the
feeling is banded over the same product the rate is computed from, so thin ground
nobody is on and rich ground with a crowd on it land in different bands and a
beginner can still choose between two places. And **somebody who can read it will
read it for you**: where the reader is short of the figures and holds a master,
the figures arrive attributed, which is a different sentence from perceiving them
and the difference is kept.

The masking is three nulls on `CrowdingRead` rather than a parallel type, because
the client already renders a headcount where `share` is not a number. The null
*is* the gate, and there is no second rendering path to keep in step.

### And geography is perceived on the same principle

> *"at higher ranks you should just be able to fly and look around. why should the
> entire thing be dependent on asking? that's a mortal's POV."*

[`what-you-can-see-from-up-there.ts`](what-you-can-see-from-up-there.ts) generalises the
paragraph above from a measurement to the map. Consumed by `destinations`, which now
answers with two channels kept visibly apart: what was said to you, and then what you can
see.

**Perception gives you the world. It does not give you people.** You can see the mountain;
you cannot see whose mountain it is. Terrain, distance, bearing, what the ground carries
and whether anything is standing on it are physical and are perceived. A name, a holder, a
house, a province's ceiling stay behind the knowledge gate at every rung.

The enforcement is in the type: **`Sighting` has no name field**, so the module cannot leak
one because it is never handed one. A change that wants to print a name up there has to add
a field and argue for it.

One scale and no rungs in it. A height buys **one number** - how far a thing can be and
still be made out, in the travel days the gazetteer prices roads in - and everything else
is `distance <= horizon`. Zero below ordinal 15 (`gale-riding-sword-flight`, the catalog's
own first flight), the near provinces at 22 (`thousand-li-cloud-tread`), the whole world by
Deity Transformation, which the curve reaches on its own rather than by arrangement. It
saturates against the map, so nothing needs a cap.

### A question with weight behind it is not a question

> *"you can DEMAND knowledge. whether it succeeds is whether people respect you - either
> via power or something else."*

The third channel, and it is **an ask with a different subject and no resolver of its
own**. `interact` routes a topic + an attempt intent to `demandOf`, which reads the
ordinary ask for its verdict and then hands the whole thing to `resolveAttempt` - the same
call a bribe and a threat go through, already pricing standing, charm, the tie, the ledger,
grudges, what they want from you, the room and how freely that person parts with anything.
[`making-somebody-tell-you.ts`](making-somebody-tell-you.ts) owns the register and decides
no outcome.

Three things it must keep getting right:

- **It reaches limits two and three and never limit one.** `askedAbout` takes a `compelled`
  flag and reads it BELOW the "could they know" test, so *somebody who does not know cannot
  be made to know* is enforced by the position of a branch rather than by a rule. That
  refusal is taken before the resolver runs - no day, no mark, no grudge - and reads
  nothing like being turned down.
- **A failed demand is not a failed ask.** Being refused costs a day. Being *corrected in
  public about what you are worth* is the other thing, and the sentence says so, because a
  cost nobody can see is not being charged.
- **A bare demand is backed by `name`** - the asker's own reputation - and never by `force`,
  which is a threat and is a different sentence the parser already labels. Found by playing:
  without it every demand went to the resolver at `leverage: none` and the ruling's first
  half was not being read at all.

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
rule from `docs/world/houses/discovery.md` on top: **a site whose awareness is below `named` cannot
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

### A cache is a very small inheritance ground

`leaving-things-for-the-next-life.ts` is `trials.ts`'s sibling and shares its table.
Burying a cache and lodging a deposit against a phrase are the two ways a cultivator who is
finished can put possessions beyond their own death, and both write to `cultivation_sites` -
the same table the trial ledger uses, with `kind = 'cache'` or `kind = 'deposit'`, and **no
schema change**, because that table already carried a comment saying a site outlives the run
that turned it up and already had `run_id` deliberately unconstrained.

Four rules hold this together, and breaking any one of them breaks something load-bearing:

- **A claim hands over objects and nothing else.** Stones and pouch stock. Never a rung,
  progress, a foundation, an insight, standing, a knowledge record or a name.
  `A_DEPOSIT_IS_NOT_A_LIFE` states it and `applyGoods` is the single writer, so there is one
  place to check. A death stays final.
- **The phrase is never stored.** Only a digest salted with the entry id, and no function
  anywhere reverses it. The player carries the words across the death; that is the mechanic.
  `hintFor` is handed the entry's facts and not the phrase, so it has nothing in scope to
  leak, and what a counter may say is the day, the term and the word count.
- **Neither route is safe, and they fail differently.** A cache is at risk of being found -
  ground, burial effort, watchers, and a concealment that decays. A deposit is at risk of
  the holder - Lindy on `foundedYearsAgo`, adjusted by `powerOrdinal`, rivals, decline and
  whether the catalog gives that house a `quietlyStopped` line. Every input is a figure the
  catalog already keeps; there is no `reliability` number written next to any house.
- **Both fates are dealt, not rolled.** One uniform threshold per row, derived from
  (world seed, row id) and never persisted, with the row lost at the first year the
  cumulative hazard passes it. Monotone, reproducible, and identical however many times it
  is asked.

The two routes meet in exactly one place: a house that fails as `destroyed_vault_intact`
becomes a cache at its own seat, so a burned vault is a hole with things in it rather than a
third kind of thing.

The clock is `WorldState.currentDay`, not `Run.elapsedDays`, because a run's clock restarts
every life and the whole feature is about the gap between two of them. Where no world is
running the day is recorded as null and the span is reported as unmeasurable rather than
guessed - the direction that never deletes anybody's property.

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

### Both paths must hand the engine the same action

The contract that makes the fallback a MODE rather than a degradation, and it was not
being kept. `leverage` and `rations` are set by the parser and are not in the phase-1
schema the model is shown, so `validatePlan` dropped both. Measured over twenty
sentences, four reached the engine as a different object depending on which path ran:

| Said | Parser | Model, before |
|---|---|---|
| `I threaten the steward into handing over the ledger` | `leverage: 'force'` | *dropped* |
| `I buy 200 rations` | `rations: 200` | `days: 30` |

The first matters because `resolveAttempt` reads `leverage` and never `intent` - so with
a provider configured, a threat was priced as a bare ask. The second is worse than a
dropped field: `provision` is a timed action, so the stripped count was replaced by a
*defaulted* month, silently, and only when a narrator was running.

`carryWhatOnlyTheSentenceKnows` closes it, and the direction of the fix is the point:
**the model keeps choosing the verb, and the sentence keeps owning the facts about
itself.** Teaching the model to emit `leverage` would have been the wrong repair - it is
decided by the parser precisely so that nothing downstream turns a word into a mechanic.
The carry only ever fills fields the model left empty, and only when both paths already
agree on the verb.

`tests/web/both-modes-hand-the-engine-the-same-action.test.ts` is the guard. **Any new
field the parser sets that the phase-1 schema does not carry belongs in that function and
in that test**, or the two modes drift apart again one field at a time.

### One typo must not cost a turn

`parseIntent` runs the table twice: once on the sentence as typed, and - **only if that
reached `unclear`** - once more on a sentence whose misspelt words have been put back by
`repairing-a-misspelt-word-before-the-verb-table-sees-it.ts`.

The gate is the whole safety argument. A sentence that already found a verb keeps it, so
nothing in the spelling layer can move a working parse or shift the guards in
`misparse.test.ts` and `a-verb-must-not-swallow-the-verb-next-door.test.ts`. Measured
back-to-back on the corpus with one typo per sentence: plain-tier accuracy 41.1% to
63.1%, refusals 69 to 37, wrong-verb 14 to 15 - the accuracy is not being bought by
guessing.

Two rules for anybody touching it. **The vocabulary is harvested from the patterns in
`actions.ts`, never written down** - a hand-kept word list would be a second source of
truth and would go stale the first time somebody added a verb. And **the respelling
chooses the verb and nothing else**: `target` and `topic` go back into the player's own
spelling before they reach the engine, because the repair cannot tell a verb word from a
name, and `stele` is one edit from `stole`.

### The phrase tables, and what the benchmark is for now

`scripts/benchmark-the-local-intent-layer.ts` runs a corpus of player commands
against `parseIntent` in two tiers - `plain`, the obvious phrasing, and
`oblique`, the way somebody talks on turn three. It was built to answer one
question: **does the rules layer need a model?**

| | before | after |
|---|---|---|
| plain, as written | 85.8% | **100%** |
| plain, one typo per sentence | 63.1% | **75.7%** |
| oblique, as written | 40.4% | 50.0% |

The answer was no. Every plain-tier miss was a near-synonym whose twin already
worked - "weigh my chances" was answered and "what are my chances" was not,
"why is my cultivation stalled" reached `ceiling` while "why is my progress
stalled" returned a character sheet, "I go into seclusion" was seclusion and
"I seclude myself" was ordinary cultivation at a twelfth of the span. Those are
missing phrasings rather than missing intelligence, and an embedding index
would have covered them while hiding them.

**Read the plain-tier 100% as a regression suite, not as a measurement.** It
was tuned against - those sentences were the worklist. What it is worth now is
that it fails when somebody breaks a phrasing, and a real coverage claim would
need a fresh held-out corpus written by somebody else. The out-of-sample number
in that table is the typo arm: those exact strings were never inspected while
the patterns were being written, and it moved twelve points on the same work.

Two rules for adding to the tables:

- **Try the three or four ways somebody would say it**, and try the sentence
  next door to check you have not swallowed it. Every fix above came in pairs
  for that reason, and one of them - `peace with` - reached a verb that commits
  a house irreversibly on a sentence that named nobody. `misparse.test.ts`
  caught it the same minute.
- **When the benchmark and the repo disagree, the benchmark is usually wrong.**
  Two corpus labels were corrected rather than the parser: "what do I own" is
  the sheet and not the pouch, already ruled in `misparse.test.ts`; and
  "I descend the mountain" is a walk - labelling it `descend` reported a
  correct refusal as a defect and invited a fix that could end a run.

`tests/web/the-plain-way-of-saying-it-reaches-the-verb.test.ts` holds the
sentences as a contract, with the things the work must NOT have taken beside
them.

### A verb answers to its own name

`theVerbsOwnName` routes a sentence that is nothing but an action's name to
that action - but **only when the action is on `READ_ONLY_ACTIONS`**. That gate
is the whole safety argument and it needs no exception list: those verbs pass
no time and change no state, so a bare word reaching one cannot cost a day, a
stone or a life. 17 of 40 names answered to themselves before; 26 do now.

The fourteen still declined are declined because they take something or need a
target one word cannot supply, and two of them - `descend`, which crosses the
Lid once, and `seal`, which wakes a sealed ancestor - must never be reachable
this way at all. **Do not widen this rule past the read-only gate.** What did
change for all fourteen is that none of them is swallowed any more: `seclude`
used to reach `cultivate` and `market` used to reach `interact`, so a bare word
silently bought a different action. Every remaining miss is now `unclear`,
which costs nothing and names three things that would have worked.

### The mode is named to the player

`which-mode-this-session-is-playing-in.ts`, read off the narrator that was actually built
rather than off configuration. It reaches the player in the opening log and rides on
`ProviderStatus` as `mode` / `modeLabel` / `modeLine`.

Said in **both** directions on purpose. `configured: false` was already there and already
correct, and a client rendered it as `(not configured)` - a true sentence about an
environment variable that reads like a broken install. Nothing is broken: the whole game
is playable on that path. A line that only appears when something is missing is an
apology rather than a mode.

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

### Which surface an emitter reaches, and how to tell

Three passes have converted the mechanical channel from `key=value` telemetry into
sentences, and the thing that makes the work possible to do wrongly is that **`src/web`
writes to two surfaces that look identical in the source and are read by different
people.** The split is decided by exactly one question, and it is answered by tracing
where the string is assigned, never by the name of the function that built it:

| Where the string is assigned | Where it is read | Format |
|---|---|---|
| `EngineFacts.structure` (including `factsForRefusal`'s third argument) | `engineEntries` renders every entry into the **play log**, beside the prose | sentences, every figure kept |
| `EngineFacts.headline`, `lines`, `prose` | the play log and the narrator | sentences |
| `SimEvent.summary` | the play log, as `Day N: ...` | sentences |
| `ToolCallRecord.summary` and `.note` | the **inspector** only - nothing reads a call into the log | a compact field dump is correct here |

The asymmetry is one-directional and worth knowing: `refused()` sources its call summary
from `facts.structure[0]`, and `structureCalls` builds rows out of structure lines - so
structure reaches both surfaces and `calls[]` reaches only one. **Where an emitter reaches
both, the player's surface decides the format.**

The inspector's rows carry `name` and `action` as separate fields with the routine's own
identifier in a `<code>`, which is why a field dump reads correctly there and does not read
correctly in a log entry rendered as a line of the transcript.

### A handler name is a second shape of the same defect, and it has three escapes

`withoutTheHandlerName` strips a `module.function:` prefix off every structure line before
it reaches the log. It is narrow on purpose - lowercase, dotted, no spaces, a colon - and
three shapes get past it and were found in play: a head with parentheses
(`getHoldingsOf(sect-x): ...`), a head in capitals (`SECT_ANCESTRY[sect-x].dormant is
null`), and a handler named **mid-sentence** rather than at the head. The narrowness is
right, so those were fixed at the string rather than by widening the regex. The six
surviving `handler.name:` heads are left as they are: the helper is what defends them, and
rewriting them would leave it with nothing to do and no guard for the next one.

The worst case was general rather than local. `fromToolResult`'s guiding-error branch had
a comment saying `hint` "is a tool invocation for a developer, and never goes to a player"
sitting directly above the line that put it on the mechanical channel - written when that
channel was believed not to reach anybody. Every action-routed tool refusal in the game
came through it, so an ordinary member asking for a stipend early read

```text
nothing_accrued. Time is advanced by cultivation_manage.cultivate. Calling stipend
twice does not pay twice.
```

The hint now goes to the inspector, where a tool name is the right word, and the log gets
the ruling said as a ruling.

### Two formatting decisions are centralised, because they had already drifted

- `rungAndOrdinal` in `facts.ts` renders `Qi Condensation Layer 1 (ordinal 0)`. Five
  modules were deciding it separately.
- `rankAndIndex` in `standing.ts` renders
  `Dew Servant of Azure Dew Sect, rank 1 of 5 counting from the bottom (rank index 0)`.
  Six call sites in `game.ts` were deciding it separately, and each kept only the index -
  which counts from zero, against a house whose members count from the bottom, so a reader
  handed `rank_index=4 of 5` could not tell which end it started at.

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

## A seclusion the engine stopped is a question, not a bulletin

`choosing-what-to-do-when-a-seclusion-is-broken.ts` holds the contract; this is the part of
it a reader of this directory needs.

When a long sitting is interrupted by `major_encounter` - and by that reason only -
`runSeclusion` does **not** resolve what happens next. It raises a `SeclusionCrossroads` on
the service, puts the question into `facts.required`, and stops. The two answers are the two
things that were always physically there:

| | what it costs | how it is carried out |
|---|---|---|
| going | the unspent remainder of the stretch, forfeited | nothing runs. It was never simulated |
| staying | the remainder is spent | one call back into `runSeclusion` for exactly those days |

**The correctness argument for staying is the absolute-day rule and nothing else.** Every
roll in `time-skip.ts` and in `src/engine/encounters/` is keyed to an absolute day, so a
stretch resumed at day D gives the surviving days precisely what they were always going to
give, and a forty-year sitting split into 5.3 and 34.7 is the same forty years. There is no
second simulation anywhere in the feature and no modifier of any kind. If that rule is ever
broken, this is one of the things it breaks.

Four rules that are easy to violate by accident:

- **Not a modal jail.** Any action that spends a day is going, and it says what that cost.
  A refusal, an unparsed sentence and any free read leave the question standing, because
  `freeAction` exists so that looking around can never kill you and forfeiting a decade for
  `what am I carrying` is a harder version of exactly that. The test is whether the run's
  clock moved.
- **Either answer, always.** Sitting back down with somebody at the cave mouth is frequently
  the stupider of the two and is never refused, and nothing about choosing it makes the
  world gentler.
- **The clock is neither handed back nor charged twice.** The first half spent
  `simulatedDays` and the world advanced by exactly that; the resumption spends the
  remainder and no more. Food is the one thing that WOULD have been charged twice - it is
  bought per stretch, at the cave mouth, for the whole span - so the crossroads carries
  `endState.rationsRemaining` forward into the resumed stretch's provisioning.
- **The two sentences are different and must not be flattened.** One case offers a ROAD out;
  the other offers only the POSTURE you are found in. `time-skip.ts` writes both and the
  fork keeps them apart all the way to the panel.

And one absence, written down rather than left to be mistaken for a decision: **nothing in
the engine prices being found seated differently from being found standing.** The posture
branch is real - it costs the remainder either way, and only one of the two spends it - but
if posture is ever meant to change what an arrival DOES, that belongs in the encounter layer
and this prose follows it rather than inventing it.

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

`docs/world/houses/discovery.md` is the constitution: **never reference an entity the player has
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

The **overheard** channel has a fourth constraint the other two do not: it may not name
anybody standing in the square. A speaker's working vocabulary is full of the people they
stand next to all day - measured on a seeded world, 1,086 speaker/present-name pairs across
the map, including speakers who could name themselves - and two people talking about
somebody eight feet away resolves the fragment in the same scene, which is the one thing
`discovery.md` says this device must never do. `told` and `passing` are deliberately not
filtered: somebody nodding at a colleague while talking *to* the player is an introduction,
which is a wanted way for a name to arrive.

The exclusion matches on **name** as well as id, and the id half catches nothing. `lore.ts`
keys a catalog person `member-yan-shuling`; `seeding.ts` instantiates the same person as
`npc-member-yan-shuling`. Measured: 203 lore people, 428 world NPCs, zero ids in common. The
knowledge system is keyed by id and everything the player reads is keyed by name - the same
asymmetry `personName` in `engine/world/history.ts` guards from the other end - so an
id-only comparison would have passed all 1,086 pairs while looking correct.

`tests/web/lore.test.ts` holds the regression guard: every catalog must still be reachable
by somebody on the player-facing path, so "written but unreachable" fails the build.

### A catalog person and their world row are one person

The failure the three files above are only worth anything if they avoid, and they were not
avoiding it. `lore.ts` speaks of the catalogs' named people by their **catalog** id -
`member-yan-shuling`, `hollow-court-shen-quan` - and `seedNamedFigures` instantiates each
of them into the world as `npc-` plus that id. `KnowledgeGate` keys existence claims by
exact id, so the record `hearsay.ts` wrote when somebody said a name in a market and the
question `company()` asks when that person is standing in front of you were about two
different people.

Measured on a seeded world before the fix: **203 lore people, 428 world NPCs, zero ids in
common.** Standing on the ground the Hollow Court's own people hold, having been told 175
catalog names through the ordinary channel, the player could name **none** of the ten of
them in the square - every one of whom they held a live knowledge record for. Told a name,
walked up to that exact person, and still a stranger.

[`../engine/world/a-catalog-person-and-their-world-row.ts`](../engine/world/a-catalog-person-and-their-world-row.ts)
owns both directions of the mapping, sits beside the seeder that mints the world id so the
two cannot drift, and `existenceClaimKey` folds a person onto the catalog id the way it
already folds a place onto `placeKey`. Three rules it keeps:

- **The fold is at the gate, never at the callers.** This table has a dozen readers and
  half a dozen writers across three packages. Two of them had noticed the seam and were
  each patching it locally, which is how it survived: every call site looked correct.
- **The strip is a catalog lookup, never a prefix strip.** The world is full of `npc-95`,
  `npc-apex-azure-dew-sect` and `npc-above-3`, and `id.slice(4)` renames the first to `95`
  and invents a person. Nor is `member-` the rule: ten of the catalog's people, the Hollow
  Court and the mountains under it, are filed under `hollow-court-`.
- **Canonical is the catalog id.** 185 of the 203 have a world row; the guest elders, the
  wanderers, the sealed ancestors and the bodies on the immortal channels have none.
  Folding the other way means minting an id for somebody who has no row.

`knowsNpc` in `accessForCultivator` had to stop being a set for the same reason. A set can
carry only one of a person's two ids and the world digest asks with the other, so every
catalog person the player had been told about was redacted out of every world event report.

**One thing this makes visible for the first time, and it is a question rather than a bug.**
A `whisper` record - a name through a wall, stance `suspects` - passes `isAwareOf`, which is
the documented behaviour of that predicate. Until now no catalog person could be both
whisper-known and present, so the case never arose; now it does, and `company()` will attach
an overheard name to a face. Whether pointing at a body and saying *that is Yan Shuling*
should need `placed` rather than a whisper is a design call on the predicate, not on the id,
and it is left where it was.

`tests/web/a-catalog-person-is-one-person.test.ts` is the guard, and it is a reproduction
rather than an assertion that the fold is called.

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

**The world reference sheet is assembled by [`register.ts`](register.ts). That is where the
page is put together, and where a new tab is wired in.**

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

### The tabs, and where each one is built

Ten panes, one visible at a time, state in the DOM. A `data-tab` button and a
`data-pane` div share a name, and `tests/web/register.test.ts` asserts the two sets are
equal - a section outside every pane renders under all of them at once, which has happened.

| Tab | What it answers | Built in |
|---|---|---|
| People | everybody at or above Grand Ascension, from every catalog at once | `register.ts` |
| Factions | what each body **is**: a resume, read in about thirty seconds | `register.ts` |
| Ties | how each body stands with every other, under both parties | `register.ts` |
| History | how each house got here, and the dated events several of them share | `register.ts` |
| Objects | the almanac: what kinds of thing exist, and what each one is | [`register-items.ts`](register-items.ts) |
| Items | the ledger: which specific things exist right now, and who has them | `register.ts` |
| Holdings | what each house actually **holds**, joined across seven catalogs | [`register-what-each-house-holds.ts`](register-what-each-house-holds.ts) |
| Teaching | what each house will teach, art by art, and how far it can carry you | `register.ts` |
| Arts | the technique catalog, the ground, and what the last age left | `register.ts` |
| Key | structural repair medicine, and the column glossary | [`register-structural-repair-medicine.ts`](register-structural-repair-medicine.ts), [`register-glossary.ts`](register-glossary.ts) |

### One structure, on every faction-scoped page

**Ties, History, Holdings and Teaching draw the same arrangement of bodies the Factions
tab draws** - the three apex pyramids as an indented tree, then everybody outside one
grouped by how they hold their ground. You click a house and it tells you that house's
ties, or its dated events, or its inventory, or its shelf. One shape, learned once.

It is a `HouseView` in `register.ts`: each pane supplies its anchor prefix, the facts on
the closed card, and what opening a house shows. Nothing about the tree, the groups, the
courts or the ordering is written twice, and **every view names its own anchor prefix** so
one house carrying a card on five tabs still leaves every id on the sheet unique.

**Items and Arts are deliberately excluded.** They are almanacs - organised by the thing
rather than by the house that has one - and a house tree over a catalog of objects would
be filing the question under the wrong noun.

### The sheet does not explain itself

**Do not write a paragraph about the sorting rule, the editorial policy, or what a section
is for.** A reader does not need to be told that entries are grouped, that a card opens,
that a tie is written once, or what a resume is; if an arrangement is not self-evident
from the rendering, the fix is the rendering. This was a whole cleanup pass - the sheet had
accumulated a note per section narrating its own design, and the design owner's word for
it was *"I really don't need to see this, do I?"*

A **key** is not this. Saying once what a glyph means, which end of an arrow is which, or
what a warmth word covers is content, and it belongs **where the thing is read** rather
than at the top of a tab a reader is nowhere near once they have opened a house.

### Every count names its noun

`4 immortal` is not notation, it is a riddle, and it shipped with a disclosure labelled
*what each one is* pointing at the tab that owns the detail. **Name the noun in the count
and delete the pointer** - a resume line may point at the page that owns a question or
answer it, never both, and the pointer is the whole job only when the count is meaningless
without it.

### A level shown is the teachable end, never the cap

`cap` is where the paper stops. On a road covering the last realm the final rung is
reached by surviving the crossing and by nothing else, so a cap quoted as a level is a rung
no house can walk anybody onto. Use `teachableEndOf`. The cap belongs only where it is
explicitly set against the teachable end.

**A section big enough to argue about gets its own module.** `register.ts` is several
hundred kilobytes and is worked on by more than one person at a time; a section that is
one `build*()` call and one `render*Section()` call is a section nobody has to open that
file to add. The module carries its own `esc()` and its own header explaining what the
section is for. That is the pattern to copy.

**Objects and Items are not the same question, and the split is deliberate.** Objects is
one `ObjectKind` out of the ten in [`../engine/world/possessions.ts`](../engine/world/possessions.ts) -
the kind with a combat rating, sorted on it, because there the ordering is the argument.
Items is the other nine, which is most of what somebody can actually pick up, and it is
organised on the one line `docs/world/things/items.md` says governs every item in the world:
**counted or tracked**. It also *measures* that document's second claim rather than
repeating it - a thing is cash-priced exactly where it is fungible - by joining the two
independent engine answers per catalog and naming any row where they part.

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
`buildRegister()` to read its catalog, and add a `<section>` inside an existing pane - or,
if it is a question of its own, a new module and a new tab per the table above. Keep the
ordering rule the sheet is built on: **ordinal is the strongest _acting_ member**, never a
sealed ceiling and never a withdrawn one - those are separate columns because conflating
them is the specific bug the register exists to make visible.

Two page-wide rules a new section has to satisfy, both enforced by tests rather than by
review:

- **No chunk a reader lands on runs past a short paragraph.** `enforceChunkLimit` splits
  oversized `<p>` and `<dd>` on the finished document, so a section does not have to do
  anything - but it declines to touch a paragraph that already holds a block tag, so
  **anything that must stay visible has to be a sibling of the paragraph, not inside it.**
  The direction key on the relationships section was a `<span>` at the tail of an
  oversized note, and shipped folded into a disclosure on all 38 entries that carry it.
- **A wide listing is `table-layout: fixed` with declared column widths.** Auto layout
  sizes every column to its longest cell, which on free text produces tables several
  thousand pixels wide inside a 1,080px column. `.itemtbl` and `.holdtbl` carry the rule;
  each table declares its own `<colgroup>`.

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
| `GET /api/admin/places` | the whole lower world as JSON - admin only |
| **World Map** in the admin menu | the panel the operator actually opens |

### It is text, and that was a correction

It was a drawn plate for one pass: a deterministic relaxation of the link graph with the
sites placed by travel time. It read well and it was the wrong medium. This is a text
game, the register already has a house pattern for a long structured list somebody
expands - `ncard` in [`register.ts`](register.ts) - and a nested disclosure survives 859
locations where a diagram does not. The panel now uses that markup in the app's tokens.

What did **not** go with the picture is the data the picture carried. Ground, the four
thresholds against a chosen ordinal, seal and cycle, control, and the fog of `discovered`
are facts a reader needs; they are labelled text and small inline markers now, and the
threshold sweep became a filter, which does more work than the colour did.

### The map may not invent geography

A line between two places is read as a road, and a position on a page is read as a
position in the world. So:

- **An edge is a `LocationLink` and nothing else.** A link naming a location this world
  does not hold is counted in `danglingLinks` and not drawn; so is a link from a place to
  itself.
- **A road recorded from both ends is one road.** Where the two ends disagree about
  `travelDays` the larger is kept and `asymmetric` is set, because a traveller does not
  get to pick the cheaper direction's number.
- **The payload carries no coordinates, and must not start to.** `LocationRecord` has no
  position and has never needed one: containment is `parentId` and distance is
  `travelDays` on a link.

`tests/web/places.test.ts` pins every one of those.

### Order is distance, and distance is the link graph

Every list is ordered nearest-first from wherever the reader is standing, and banded -
*within a day*, *two to six days* - rather than printed as a column of integers. The
figure is the **shortest path over `links` in `travelDays`**, a plain Dijkstra over a
sub-thousand-node graph, not a straight line: two places either side of a mountain are far
apart, and the link graph is where that is already written.

**`unreachable` is a real answer** and has its own bands - two of them, and the split is a
correction. Measured against the seeded world, 18 of 20 roots hold no links at all, and
`seedRegions` links **provinces to provinces and provinces to sect gates and nothing
else**, so no settlement, vein, ruin or scar is priced from anywhere, in any world. Filing
all of that under *"No route recorded - nothing links these to where you are"* and then
printing `no route` again on every row said something false about a town three hours away
and read as a data error. It is not one:
[`where-this-cultivator-could-go.ts`](where-this-cultivator-could-go.ts) rules that a
settlement inside your own province has a **null** travel cost because nothing anywhere
prices those, and that a fabricated zero is a number a player will plan around.

So the panel says the two different things the data can actually distinguish, off
`linkCount`:

| | |
|---|---|
| **No road is recorded to these** | the record holds no crossing of any kind. Inside a container this reads *Inside &lt;the province&gt;*, because calling a province's own towns unreachable from its gate is the opposite of true |
| **Roads, but none that reach here** | the record holds crossings and no chain of them arrives |

**And the absence is stated once, in the heading, never on the rows.** That is
[`facts.ts`](facts.ts)'s rule - a constant repeated on every row of a list is not a
measurement, and `travelDays=unstated` eight times is what buried the two rows carrying a
figure. A row under one of those headings carries no duration cell at all.

The origin is the container the reader has walked into, which is also what puts a
compound's precincts in the order somebody would actually pass through them. At the top of
the world there is no such place, so it is the best-connected root, **named in every band
heading** - an unlabelled origin makes every distance on the page unreadable.
`cultivator.location` is free text by design (see `schema/cultivation.ts`) and is used as
the origin only on an exact name match to a place that has at least one link. That guard
was added after a live world matched `Sixmile`, a settlement holding no links, and reported
every distance in the world as "no route".

### Where the cultivator is standing is not where distances start

The guard above had a cost nobody noticed: `mapChooseOrigin` was the **only** reader of
`cultivator.location`, so a player standing anywhere unlinked - which is every settlement
in every world - vanished from the map entirely, and the panel silently measured from a
province instead. The operator's first question of a map had no answer on it.

`MAP.hereId` is kept separately from `MAP.originId` now, and the panel gives one of three
honest answers above the list: they are the origin; they are marked in the list and
distances come from somewhere else *and why*; or the name on the character matches no place
this world holds, printed as the free text it is. Nothing guesses which place an unmatched
string meant.

### Descent is one click

A row that holds something is a button: clicking it re-roots the panel inside that place,
and that place's own record heads the level you land on - so descending and reading the
description are one interaction rather than two. A row that holds nothing opens where it
stands. The breadcrumb walks back out and every step of it is clickable.

### Built for the player it does not serve yet

`discovered` is on every node and is never filtered server-side. The admin panel shows all
of them and marks the undiscovered ones, so an operator can see the fog the player is
standing in; the *As the player sees it* control drops them, which is exactly what a
player-facing map would do at the boundary. See
[`../../docs/world/houses/discovery.md`](../../docs/world/houses/discovery.md) for why that gate exists
at all.

### Depth is walked, never assumed

The seeded world was 65 places in two levels; with interiors it is 859 in five, and it will
move again. `depth` is computed by walking `parentId` with a visited set, and the panel
shows one container at a time rather than a tree of eight hundred cards.

### What a place says about itself

The panel is concise by default and expands on request, and **an absent field renders
nothing at all** - most rooms have no hazards, no cycle and no faction, and nine blank
labels reads as a broken panel rather than as an ordinary room. Beyond the current state,
the payload carries three things nothing else surfaced:

- **`origin`**, and only when something moved. A valley that became a city returns the
  fields that changed and the day it started from; a room that is still what it was
  returns `null`.
- **`changes`**, newest first and capped at eight with `changeCount` for the true total.
  This is the middle of the three layers `locations.ts` describes and it is the best
  source of "the world is alive" in the whole panel: *day 139,065 - 15 li of ground
  stopped holding qi, when Yun Zhaoping failed tribulation here.* `causeKnown` is carried
  because "nobody alive can explain it" is a stored state of the world.
- **`capacity` against `occupancy`**. `architecture.ts` stores capacity and deliberately
  stores no other measurement; the other half is a count of NPCs standing there.

### What is TRUE of a place is not the same as what a place IS

A record's fixed fields say what somewhere **is**. `WorldState.statuses` - the layer in
[`../engine/world/what-is-true-of-a-place-right-now.ts`](../engine/world/what-is-true-of-a-place-right-now.ts) -
says what is **happening**: a famine, a war on the ground a house stands on, a beast tide
running, a district its holder has worked out. The played `investigate` verb has read it
since it was wired and the map carried none of it, so an operator's map of the world could
not report the only part of the world that was currently moving. Measured on a live world:
fourteen statuses running, none of them reachable from the panel.

The join is the engine's own `statusesInArea`, so the map and the played verb cannot
disagree about what is going on. A status is true of its area **and of everything under
it**, so a node carries its ancestors' too and `ownArea` says which are its own. Every
figure travels - `stops`, `priceMultiplier`, `dangerDelta`, the day it began and the day it
is next reviewed - because those are what a status *does*, and a statement without them is
a mood rather than a mechanic. `causeKnownLocally` travels raw: this surface is admin,
and masking a cause by a knowing stage is `readStatusAtStage`'s job at the player boundary.

`counts.runningStatuses` counts distinct statuses on their own areas, not the sum of the
per-node lists - one famine over a province is inherited by every town in it.

### The ground figure is on one scale, whatever the world was written on

`qiDensity` is 1..100 (see `engine/world/qi-scale.ts`, which records why it left 0..1). A
world instantiated before that move stores fractions, and every one of them rounds to the
bottom of the new scale: measured on a live database, **all thirty-nine places reported
`ground 0 of 100, thin`**, including Nine Peaks, "the deepest vein anyone has kept". The
map's single most important figure read as a constant zero for the entire world.

`groundOf` in `places.ts` converts a stored fraction by the constant `qiFraction` divides
by - the same conversion stated in the other direction, not a guess - and the tell is
**fractional rather than small**, because `clampQiDensity` rounds and a current world can
only store integers. A stored `0` becomes 1, because the scale says dead ground still reads
1 and 0 would mean unmeasured. `counts.rescaledGround` reports how many were converted so
the panel can say it once in the footer. **Nothing is written back**: this is a view, and a
storage migration is not its business.

### A row that is not distinguishable is not a row

The panel's worst block was a dozen ruins, identical in every field but the place name,
each printing eight unlabelled lines of which seven were the same seven, under a heading
that already said the eighth. Three separate rules of this repo were being broken in one
place - an index does not restate its own titles, a constant is said once, and nothing
should read as a dump - and the fix is one idea: **lead with what differs, and hoist what
is shared.**

- **Rows on a level that share a description are grouped**, at three or more. The group
  says the shared sentence once and summarises what actually varies as a range: the ground,
  the ordinal it would take to hold one, how many are sealed, how many nobody has found,
  how many have something going wrong on them. It opens onto the individual records and
  hides nothing.
- **A row whose description is shared, or is its own name again, leads with its newest
  change instead.** `locationFromRuin` writes *"The seat of a power that no longer exists."*
  verbatim for every ruin in the world; what separates Blackpass from Neargate is in the
  change ledger, which was already in the payload and was never on the row.
- **A leading copy of the row's own name is taken off its own sentence.** *"The Door Ji
  Yuanhe Did Not Open Again was opened by He Lanxue"* under a heading that is already that
  name is the title read twice.
- **The first sentence is not automatically the useful half.** The scar description is
  *"Dead ground. Every scar was somebody's entire ambition."* and the old first-sentence
  rule kept the half that says nothing.

### The ground band on a row is the place's own

`qiBand` is derived from `qiDensity`, and `seedRegions` writes the **province's** average
density onto every settlement in it while putting the settlement's authored band in
`ambient`. So the row's band comes from `ambient` - what somebody standing there would
ordinarily draw - and the figure follows it. Where the two disagree the row carries a `≠`
and the tooltip says why. That disagreement is a real state of the record (a sealed pocket
holds far more than anybody can reach) and is marked rather than smoothed: averaging them
would be the map inventing a third number.

`web/mock-api.js` carries one row of each shape, deliberately - a group of three identical
ruins, a famine nobody decided, a war somebody did, and one settlement whose band and
geology disagree - because those are what break, not the volume.

## The player is a row on the world's roster

[`the-player-as-a-row-the-world-can-invite.ts`](the-player-as-a-row-the-world-can-invite.ts).
The world layer keys everything on `NpcRecord`, and below the Lid the player had none - so
every system reading `state.npcs` was running on a population the person playing was not
in. Sharpest at `gatherings.ts`, whose entire invitation list is drawn from it: the player
was not rarely invited, they were **structurally uninvitable**.

It follows [`above.ts`](above.ts)'s precedent exactly - one row, under **the cultivator's
own id**, so lineage, grudges, obligations and object provenance keep resolving against one
identity - and the two halves compose rather than overlap: `residentAbove` owns the player
once `canExistBeyondTheLid` is true, and this stands down at that point.

**The sheet is the source.** `GameService.act` refreshes the row from the `Cultivator` at
the top of every turn and again at the end of one, so nothing the world wrote to it can
survive into the next turn: drift is structurally impossible rather than corrected. The
refresh is in the turn and not in `advanceWorld` on purpose - `work` spends its days
through the consolidated tool and never passes through this class's span helper.

The world may read this row, rank it, resent it and seat it. It may not *decide* anything
for it: see `PLAYER_ROW_TAG` and the guarded passes in
[`../engine/world/README.md`](../engine/world/README.md).

**The row stands nowhere.** `locationId` is null and never set: it is a membership, not a
second account of where the player is. Presence has always been this layer's, off
`cultivator.location`, and `npcsAt` means "the other people here" at every call site in
both layers - each of which predates the row and adds the player back explicitly where
wanted. One honest `locationId` double-counted the player in the crowding term, returned
them to themselves as a possible opponent, added one to a headcount, and had a persistence
test find the player where it was looking for an NPC. Nothing the row exists for needs a
location; a gathering seats people by id.

## Where they can go is gated like everything else

`destinations` reads the knowledge table for named places and then adds the province's
caves, wilds and veins off `WorldState.locations`. That second half had no gate at all -
and "a farm boy knows where the caves are" is a reason to **grant a record**, not a reason
to skip one. A cultivator holding nothing was handed The Glass Field and The Nine-City
Assize by name, which are dao grounds seeded as ordinary `wilds`, and the same hole would
have handed over any prospected find that landed on one of those three kinds.

Both halves now ask `canPointAt`. `seedTheGroundAroundHome` grants the **ordinary** ground
of the birth province at `placed` when the run opens - the same stage and the same reason
as the next town along, because it is not an advantage, it is what everybody has - and
withholds the two kinds the world means somebody to find: dao ground, and anything carrying
`FOUND_BY_PROSPECTING_TAG`. Default-deny, so the next kind of special ground somebody adds
is withheld by construction rather than by being remembered.

## Ground that teaches a road, and how a player ever meets one

Closing the gate above made an absence visible that it did not create. Those two names were
**the only place a player ever saw a dao ground**, stripped of everything that makes one
what it is - and `daoGroundsInReachOf`, the function that decides who can get at one, had
no caller anywhere in `src/web` or `src/server`. Twenty-three of these are seeded per
world, the whole simulation walks roads off them, and nothing a player could type reached
one.

Three joints were missing, and together they are the loop:

| Joint | Where it lives | What was wrong |
|---|---|---|
| A source | `offerGroundSomebodyGoesTo` in [`hearsay.ts`](hearsay.ts) | No channel in the game could put the name of a ground into anybody's knowledge, so the gate over them was default-deny across an empty set |
| A province | `daoGroundNamed` behind `regionIdOfPlace` in `cultivation-support.ts` | A dao ground is a world location and is not in the region gazetteer, so somebody standing ON one resolved to no province and got nothing. The one place guaranteed to teach them was the one place that could not |
| A sentence | the `roads` verb, over [`ground-that-teaches-a-road.ts`](ground-that-teaches-a-road.ts) | Nothing asked what a ground wanted, so a place a player could stand in changed nothing and said nothing |

**The source is somebody who could point at it, never somebody who could read it.** That
distinction is the content. A cart driver at the bottom of the ladder has crossed the
Grinding Ford ten thousand times, will never take anything off it, and is exactly the
person who can tell you where it is - `howSomebodyStandsToAGround` separates the two, and
requiring the speaker to be able to READ it would have made a landmark a secret. Measured
on a seeded world before that split existed: of 587 living NPCs, the ones standing in a
settlement who could reach any ground at all were **10, 5, 7 and 5 people in four towns of
one province, and zero everywhere else**, because every catalogued master sits on a region
node rather than in a town.

**The gate is untouched.** The `roads` read lists nothing the cultivator could not already
name - `canPointAtLocation`, the same predicate `destinations` and `move` enforce - plus
the ground under their feet, which they can obviously point at. The affordance line in
`what-is-worth-doing-standing-here.ts` is offered only once they hold a record, so it
cannot leak what the read would refuse to say.

**And every refusal names what would work**, off the row's own fields rather than per
place: the rung it becomes legible at, the province it is in, the house that keeps it and
the rank that house lets people on it at. A twenty-fourth ground needs no branch anywhere.
## The refusal path is inside the gate too

A refusal is prose the player reads, so every name in one is a name the game has handed
over. `blankLook` used to open with `You put the words to ${here[0].name}` - the nearest
person, ungated - while `nobodyByThatName` appended the correctly gated sentence "you have a
name for none of them" to the very same paragraph.

Two defects in one line, and the second is the worse one. The leak is obvious. The other is
that the player asked for one person, read the name of a different one, and read it in a
sentence describing their words being delivered: **a refusal that reads as a redirect is not
a refusal**, and the player walks away believing they spoke to somebody they did not.
Measured: `I negotiate with Kong Lanwu`, typed in a square of fifteen strangers, answered
"You put the words to Liang Fuhe."

So the witness is named only where the player could already name them, and otherwise the
refusal says plainly that nobody here answers to that name. `whoIsAbout` carries the same
gate on its lone-person branch, where being the only person in the square was enough to get
your name printed.

## Related

- [`../../context.md`](../../context.md) - the authority rule this package enforces
- [`standing.ts`](standing.ts) - who is entitled to commit a house, and what the refusal says
- [`register.ts`](register.ts) - the standing register, and the only place to change it
- [`places.ts`](places.ts) - the world map view, and the rule against inventing geography
- [`ground-that-teaches-a-road.ts`](ground-that-teaches-a-road.ts) - dao ground as a player meets it, and what a ground that will not teach says instead
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - what phase 2 actually runs
- [`../agent/provider/README.md`](../agent/provider/README.md) - provider selection and config precedence
- [`../storage/README.md`](../storage/README.md) - the database both front doors share
