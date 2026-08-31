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

alongside the world-facing operations that genuinely are distinct engine routines with
distinct state effects: cultivate, seclude, breakthrough, train_technique, refine, gather,
eat, wait, plus the pure reads.

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

## Related

- [`../../context.md`](../../context.md) - the authority rule this package enforces
- [`register.ts`](register.ts) - the standing register, and the only place to change it
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - what phase 2 actually runs
- [`../agent/provider/README.md`](../agent/provider/README.md) - provider selection and config precedence
- [`../storage/README.md`](../storage/README.md) - the database both front doors share
