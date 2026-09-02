# AGENTS.md - Working Agreement for Coding Agents

The single guide for any AI coding agent (Claude Code, Codex, Cursor, Aider, …)
working in this repository. `CLAUDE.md` is a symlink to this file - there is no
Claude-specific guidance, by design. Edit this file.

For *why* this project exists and what it is, read [`context.md`](context.md) first. It is
short, and it indexes everything else.

**Design docs live next to the code they govern.** Before you modify a directory, read the
`README.md` in it: it states that code's contract, the rules it must not break, and why.
If you change a contract, update that README in the same commit. Do not add design
material to `context.md` - it is an entry point and an index, and it is deliberately kept
short. World and setting material goes under [`docs/world/`](docs/world/), split by topic.

---

## What this repo is, in one line

A **deterministic xianxia cultivation RPG engine** exposed over MCP, driven by an LLM
runtime agent that narrates but never decides.

Forked from a D&D 5e MCP engine. The substrate (dice, SQLite, action-routed tools,
spatial grid, worldgen, NPC runtime) is retained; the entire game-facing surface is
being replaced with cultivation mechanics.

---

## The one rule that overrides everything

> **The AI narrates. The engine decides.**

Before you write any code, check which side of that line it falls on.

| Engine-authoritative (deterministic code, backed by SQLite) | Agent-authored (LLM prose) |
|---|---|
| Character statistics, cultivation progress, realm changes | Dialogue |
| Breakthrough outcomes, combat results, probability | Narrative description |
| Inventory, currency, health, lifespan, **death** | Presenting world events |
| NPC statistics, world-state mutations, event resolution | Summarizing world state |

Concretely, this means:

- **Never** let an LLM response decide a number that persists. If a tool returns a
  result, that result came from engine code, not from a model.
- **Never** add a code path where the agent can assert an outcome without the
  corresponding state change having already happened in the database.
- Every stochastic system takes a **seeded sample or RNG stream**, never a bare
  `Math.random()`. Runs must be reproducible from their seed - which means the
  RUN seed and the WORLD seed together, not the run seed alone. A run is lived
  inside a world, and an installation with no world mints one from
  `randomUUID()`, so the same run seed against a fresh database meets a
  different several hundred people. Within one installation the world is created
  once and persisted and the promise holds in full; to replay a run anywhere
  else, carry the world seed with it and `createWorld({ seed })` before the run
  opens. `src/server/state/cultivation-world.ts` owns this and explains why
  seeding the world from the run instead would delete cross-run persistence.
  Tests: `makeGameInWorld` in `tests/web/harness.ts`. **A played test that pins
  a seed to an outcome without pinning the world is pinning a coincidence.**
- Engine functions should be **pure where possible**: state in, deltas out, no mutation
  of inputs, no I/O in the mechanics layer.

If a change would let the model quietly become authoritative, it is wrong even if the
tests pass.

---

## Nothing in the lore is bespoke

The companion rule to the one above, and the one most often broken by accident.

> **Lore describes what the systems produce. It never adds a system of its own.**

Every dramatic fact about this world has to be a consequence of something a generic
system already reads. If the lore says somebody is untouchable, the reason must be an
object in the ordinary object table with an ordinary power level, held by an ordinary
person at an ordinary rung. The narrative weight comes from the size of the numbers, not
from an exception written next to them.

Concretely:

- **No faction-specific combat rules.** An apex head dies the way anybody dies. There is
  no branch anywhere on tier, title, faction or importance, in either direction. What is
  different about them is what they are carrying, in the same field a bandit's notched
  sabre uses, read by the same resolver.
- **No parallel catalogs for important things.** The strongest object in the world and a
  looted blade are rows in `src/data/cultivation/artifacts.ts`, made by the same
  `makeObject` factory and ordered by `power`, so the whole hierarchy of force is readable
  top to bottom. An "immortal weapons" table beside the artifact table is the exact
  mistake this rule exists to prevent.
- **No arithmetic in a lore file.** Data files may state what is standing where and what
  it is holding. They must not decide who wins - a margin constant, a weight function, a
  "how many houses it takes" helper is a second combat system living in the prose layer,
  and it will drift from the real one.
- **The prose yields to the measurement.** Where a description and the resolver disagree,
  the description is what changes. Say so in the file, and cite the harness run
  (`scripts/playtest-conspiracy.ts` is the worked example).
- **Take the object away and nothing is left over.** The test for whether a piece of lore
  is bespoke: remove the item, and the holder must price out as an ordinary cultivator at
  their ordinal, with no residue anywhere.

If you find yourself writing a rule that applies to exactly one faction, stop. The thing
you want is an item.

---

## Measuring, and being honest about what you measured

Most of the setting's load-bearing claims are now numbers produced by the engine rather
than assertions written next to it. That is the right direction and it has a failure mode:
a measurement is only worth what the harness that produced it is worth, and several have
been wrong in ways that read as findings.

Every one of these actually happened while writing this section. Check for them.

- **Build the character sheet legally.** `might` is capped at 3 and `insight` at 4
  (`src/schema/cultivation.ts`). A probe using 5/5/5/5 is not measuring this game. The
  whole legal attribute range is worth about ×1.5; one realm is ×4, at every rung.
- **A stalemate is not a loss.** `resolveMelee` returns `winningSideId: null` when neither
  side finishes. Scoring `winner === 'a'` counts that as a defeat for A, which is how "one
  immortal loses to ten ordinary cultivators" was reported when what actually happened was
  she ended on 80 HP with eight of them dead and the round budget ran out.
- **Give both sides the same treatment.** Handing one side a technique and not the other is
  a 1.4× swing before anything else is varied, and it will look like whatever mechanic you
  were investigating.
- **Filter every catalog you join.** A helper that filters courts by apex but not sects
  gives every house every sealed ancestor in the world. That one was caught only because
  the numbers barely moved - which was itself the finding.
- **Prefer the controlled table to the complicated one.** When a clean uniform sweep and a
  messy realistic case disagree, the harness is wrong far more often than the engine.
  Trust the simple result and go looking for the bug in the setup.

And when a measurement contradicts the prose, **change the prose in the same commit** and
say what it used to claim. `catastrophe.ts` records its own corrections in place, including
the figures that turned out to be harness artifacts, because a number nobody can trace is
worth less than a number with its retraction attached.

---

## What the engine does not model yet

Absences shape the setting as much as rules do, and an absence that nobody has written down
gets mistaken for a design decision. Two found by measurement rather than by reading:

- **Single-target-only was distorting everything.** Until reach existed, no combatant could
  strike more than one person a round, so an even 5v5 was a 100% stalemate and one person
  against a province could never resolve. That read for a while as "the world holds against
  an immortal", which was never a design claim - it was a missing mechanic wearing one.
- **Numbers still buy time even when they buy no force.** Bodies a full realm below cannot
  strike, but they can be struck, and clearing them costs rounds. Whether somebody should
  be able to be worn down by people who cannot hurt them is a design question, not a tuning
  constant, and it should be put to a person rather than settled quietly.

If you find one of these, write it down where the affected material lives. "The engine has
no answer for this yet" is a legitimate and useful sentence.

---

## Provider neutrality

Supported runtime agents: **Claude (Anthropic)** - primary/default - and **Ollama** -
local/self-hosted. OpenAI and OpenRouter remain supported.

- Provider-specific code lives **only** in `src/agent/provider/`. Nothing else in the
  codebase may branch on a provider name.
- Provider selection is configuration, never code: `runtime_provider = claude` or
  `runtime_provider = ollama` + `ollama_model = <model>`. `claude` is an accepted alias
  for `anthropic`.
- `src/agent/provider/config.ts` is the **only** place a provider name string is
  interpreted. If you need provider knowledge elsewhere, expose a neutral accessor.
- The same saved world must be playable under either provider. Switching providers must
  never require changing or resetting world state.

---

## Long-running simulation

The agent must **never** be required to simulate time day by day.

`"I cultivate for ten years"` resolves in a single deterministic pass via the time-skip
primitive (`src/engine/cultivation/time-skip.ts`), which advances time in adaptive
chunks, resolves events, and returns an **event digest** the narrator renders. Same seed
and input ⇒ identical result.

NPC simulation follows the same economy:

| Deterministic - no LLM call | Worth an LLM call |
|---|---|
| Walking to work, daily schedules | Betrayal / loyalty decisions |
| Routine cultivation ticks | Negotiating under conflicting goals |
| Ordinary trading | Reacting to a grudge or debt |
| Aging, resource consumption | Genuinely novel or ambiguous situations |

---

## Layout

```
src/
├── engine/               # README.md - implementation philosophy, the five pillars
│   ├── cultivation/      # README.md - THE CORE. Realm ladder, spirit roots,
│   │                     #   breakthrough, the Price of Advancement, qi deviation,
│   │                     #   injuries, existence states, survival/death, time-skip.
│   │                     #   Pure functions. No DB, no I/O, no MCP.
│   ├── world/            # README.md - places, capability predicates, opportunity
│   │                     #   windows, history, lineage, possessions, time
│   ├── social/           # README.md - relationships, grudges, knowledge and
│   │                     #   belief, secrets. Storage, never simulation
│   └── {combat,magic,spatial,worldgen,strategy,perception}/  # Retained substrate
├── schema/cultivation.ts # Zod contracts + survival constants (single source of truth
│                         #   for balance numbers - never hardcode them elsewhere)
├── data/cultivation/     # README.md - content catalogs, grade bands, provenance
├── storage/              # README.md - migrations, idempotent ALTER, repo conventions
├── web/                  # README.md - the narrator's three-phase split and the
│                         #   authority boundary in code
├── server/consolidated/  # Action-routed MCP tool handlers (index.ts = registry)
├── agent/provider/       # README.md - provider abstraction and config precedence
├── agent/{prompt,runtime,audit}/  # NPC agent composition, invocation, replay
└── math/                 # Dice, algebra, physics

docs/world/               # README.md - the setting bible, split by topic and tiered
tests/                    # Mirrors src/
```

Each `README.md` above is the contract for the directory it sits in. Read it before
editing that directory; update it in the same commit if you change the contract.

**Balance numbers live in `src/schema/cultivation.ts`.** Satiety costs, starvation
turns, lethal injury counts, stagnation years - import them, never retype them.

**Ladder bounds live in `src/engine/cultivation/realms.ts`.** `MAX_ORDINAL` is the
authority. Never restate the number of ranks in prose - it has gone stale before.

---

## Commands

```bash
npm test                              # full suite (Vitest)
npx vitest run tests/engine/cultivation   # one area - prefer this while iterating
npx tsc --noEmit                      # typecheck
npm run build                         # compile
npm run build:binaries                # standalone executables -> dist-bundle/
```

**Shell:** use **PowerShell** for npm and git on Windows. Prefer running a single test
area over the full suite while iterating - the full run is slow.

### What to run, and when

**While working: your own area, plus any integration tests your change could touch.**
`tests/web` and `tests/server` are where integration lives; `tests/engine` and `tests/data`
are mostly unit. There is no reason to run five thousand unit tests for modules you have
never opened - a unit test for something you did not touch cannot tell you anything, and a
dozen agents each doing it saturates the machine for everybody.

**Before landing: the full suite, once, in a clean detached worktree.** Not because the
unit tests might have changed their minds, but because nothing should land on a tree
nobody has run.

**The failure this replaces is worth naming, because the fix is not "run more".** Several
agents once reported a green tree having each run only the files they had edited, while
the pooled suite was red with 45 failures. **None of those failures were in unit tests for
untouched modules.** They were integration tests, and ladder and catalog tests, that their
changes had broken and they had not thought to run. Running everything would have caught
it; so would running the right things. Prefer knowing which are the right things.

**And a full-suite number off the shared tree is not a measurement.** Other agents'
uncommitted work is in it - three consecutive runs once gave 1, 2 and 3 failures on
different files. See
[a single measurement off a shared tree](#a-single-measurement-off-a-shared-tree-is-already-somebody-elses-unfinished-work).

The fork pool is capped so concurrent runs do not fight (`VITEST_MAX_FORKS`, default 4).
Raise it only when the machine is yours alone.

---

## Conventions

- TypeScript ESM with NodeNext resolution: **relative imports carry a `.js` extension**
  even though the source is `.ts`. This bites every new contributor once.
- Named exports only; no default exports.
- Comments explain **why**, not what. Section banners (`// ─── SECTION ───`) separate
  concerns in long files.
- Zod schemas are the contract. Persisted state round-trips through them so invalid data
  fails loudly at the boundary rather than silently later.
- New MCP tools are **action-routed**: one tool, an `action` discriminator, fuzzy
  matching and guiding errors. Follow `src/server/consolidated/character-manage.ts` and
  register in `src/server/consolidated/index.ts`.

### Writing style in docs and comments

Use plain **hyphens** (`-`). Do not use em-dashes or en-dashes anywhere in this repo -
not in Markdown, not in code comments, not in commit messages, not in player-facing
strings. They are hard to type, hard to grep, and they break exact-match edits against
these files.

### Never put a backtick inside a SQL template literal

Migration files hold their DDL in JS template literals. A backtick anywhere inside - most
easily in a SQL comment quoting an identifier, `` -- the count `assessPower` prices `` -
**terminates the literal** and takes the whole module out at transform time, failing every
test that imports storage with an error that points nowhere useful.

This has now happened twice in `migrations.cultivation.ts`, which contains hundreds of
backticks of which exactly two are load-bearing.

In SQL comments inside a template literal, quote identifiers with single quotes or nothing
at all. If you need a backtick in a comment, the comment is in the wrong place - put it
above the literal as a normal `//` comment.

### Commit convention

```
feat(scope): description
fix(scope): description
test(scope): description
refactor(scope): description
```

### TDD loop

1. Write the failing test (RED)
2. Implement (GREEN)
3. Refactor
4. Commit
5. Repeat

Commit local work freely after a passing test - don't ask permission for local commits.

---

## Running the game

```bash
docker compose up
```

Brings up the web GUI (http://localhost:8787) and the MCP endpoint together, sharing one
SQLite volume. No API key is needed to play with a local model:

```bash
docker compose --profile local-llm up
```

Set `ANTHROPIC_API_KEY` and `RUNTIME_PROVIDER=claude` to have Claude narrate instead.

### Forcing a situation to test it

`ADMIN_MODE=true` opens the operator surface. **[`docs/admin.md`](docs/admin.md)** is what it
is for, what each action takes, and which phrasings reach it; the law it follows is in the
header of `src/server/consolidated/admin-manage.ts`. In one line, from the design owner:

> **The admin panel can set preconditions, but it allows me to test outcomes.**

So the test for anything added there is **does it arrange a situation, or assert a result?**
Arrange, and it belongs. And when you arrange one and the world does not do what it says it
does, that is a finding about the world - `docs/admin.md` lists three found that way.

## If you are the narrator

When an agent is acting as the runtime narrator rather than editing code, the same rule
binds it: interpret intent, call tools, write prose - and narrate only what a tool
actually returned, including when the engine's answer is bad news. Never describe an
outcome you did not get back from the engine.

---

## The acceptance test

The design is frozen. No new subsystems until this passes.

The meaningful test is not "can a cultivator cultivate." It is:

> **Start as a nobody, run 500 years, and confirm the resulting world is recognisably
> descended from the world you started in.**

Concretely, after a 500-year soak: factions have risen and fallen, people have died and
been inherited from, grudges are still live and have passed to descendants, history has
accumulated with discoverable causes, locations have changed and carry their scars, and
nothing is incoherent or contradictory.

If that holds, the thing works. Feature creep before that point is the main risk to the
project.

## Git remotes

| Remote | Points at | Use |
|---|---|---|
| `origin` | `zxrfire/mnehmos.rpg.mcp` | This fork. Push here. |
| `upstream` | `Mnehmos/mnehmos.rpg.mcp` | Fetch upstream `main` to reintegrate. |

Work happens on `feat/xianxia-cultivation`. Never push to `upstream`.

### Preserve ancestry with upstream

**Never wipe or re-root the history.** No orphan branches, no fresh `git init`, no
squashing the whole branch to a single root commit.

This fork must keep a common ancestor with `upstream/main` so that
`git fetch upstream && git merge upstream/main` continues to work. Without a shared base,
every upstream file looks like an unrelated add and reintegration becomes a manual
conflict on effectively the entire tree.

If history genuinely has to be edited - to remove something that should never have been
committed - rewrite it **in place** (`git filter-branch` or `git filter-repo`) so commits
are rewritten but the ancestry is kept. Then force-push the branch only, never `main`,
and never to `upstream`.

---

## Lessons that keep having to be relearned

Every item below was a real correction from the design owner or a real bug found by
playing the game rather than by reading it. They repeat, which is why they are written
down.

### The world's rules must bind the player too

The commonest defect in this repo by a distance. A system is built for the simulation,
binds every NPC correctly, and does not reach the played game at all - so the world runs
on one set of rules and the player on another.

Worked examples, all found by playing:

- **Books.** `manuals.ts` seeds sect libraries, hands copies to members, prices the
  betrayal of selling one, and caps every NPC at the best book they hold. A player could
  name any art they had the rung for and simply have it. Seventeen of twenty-four roads
  were open that way.
- **Ground.** Every settlement declares an `ambient` band and the world stamped them all
  with their province's average, so Nine Peaks - "the deepest vein anyone has kept" - was
  arithmetically identical to a thin ford town, and rolled thin thirty-four months out of
  thirty-six.
- **Wounds.** `NpcCultivation.untreatedInjuries` is an integer, so no NPC can carry a
  typed wound the player can carry.

When you finish a world system, ask what the player's path through it is, and go and play
it. If the answer is "the player does not have one", the system is half-built.

### If a near-synonym works, the phrasing that fails is a bug

"I refine a pill" was understood and "I make a pill" reached nothing, so the whole alchemy
subsystem was accessible only to somebody who guessed the one verb. Same for "I take a
duty" against "what duties are there", and "what is my rank" against "what rank am I".

A player cannot find the working half except by guessing, and the failing half is usually
the more natural phrasing. When you add a verb, try the three or four ways somebody would
actually say it, and try the ways they would say the thing next to it to check you have
not swallowed it.

### A module nothing calls is not a feature

**The most-repeated defect in this project, by a wide margin.** A subsystem is designed
carefully, written well, tested, sometimes even rendered on a page - and **nothing in the
running game ever calls it.** It passes review because every artefact of a finished feature is
present except the one that matters.

The roll of them, all found in a single session:

| What | Where it lived | What never read it |
|---|---|---|
| The teacher layer - `carriesTo`, `teachersOf`, `THE_DEEPEST_ROADS` | catalog + register | anything in `src/engine/` |
| `WITHDRAWN_POWERS` - the Hollow Court's four seats | catalog + register | the seeder. The apex of the setting was empty and dissolved |
| The inheritance economy | `past-the-ceiling.md`, in detail | no divest, bequest or estate concept exists at all |
| 261 cultivation chambers with their own qi | seeded into every world | nobody stood in one; the largest multiplier in the model reached no one |
| Prospected ruins | a working discovery engine | `nameableSites` read only the static catalog |
| Gossip | a 700-line module with 309 lines of tests | no verb. Zero player-facing wiring, one commit old |
| The realm capability layer - fifteen grants | `capability-gaps-by-realm.md`, audited | `capabilityActorFor` hardcodes `heldGrants: []`. All fifteen off for every living cultivator |
| Surviving the loss of your own body | `existence.ts` - profound states, survival roll, `identityContinuity` | `canEnterExistenceState` and `resolveBodilyDestruction` have no caller in `src/` at all |

**So the definition of done is not "the module exists and its tests pass". It is that somebody
in the running world - a player or an NPC - reaches it by doing something.** Until then it is
documentation with a type signature.

Three habits that catch it:

1. **Before building, ask what will call this**, and name the file. If the answer is "the
   register" or "a test", stop: those are readers, not callers.
2. **After building, reach it the way a person would.** Type the sentence a player would type,
   or run the world and check the thing happened. `grep -rn "yourExport" src/` and looking at
   who imports it takes ten seconds and has caught seven of the eight above.

   Note how the last two were found: **somebody went looking for a live consumer to hang a
   change on, and discovered there wasn't one.** That is the reliable way to find these, and it
   is worth doing deliberately rather than waiting to stumble into it - pick any subsystem you
   believe in and try to name the line in `src/` that calls it.
3. **Suspect it hardest when the module is good.** Every one of these was well written. Quality
   is not evidence of reachability, and a beautiful module is if anything likelier to have been
   built in isolation.

The mirror image is worth stating too: **a rule that binds NPCs and not the player, or the
player and not NPCs, is the same failure with one caller instead of none.** See
[the world's rules must bind the player too](#the-worlds-rules-must-bind-the-player-too).

### A field nothing writes is the same defect, one size smaller

The entry above is about a module nothing calls. **This is the same failure at the level of a
single field, and it is harder to see, because every artefact around it is correct.**

The case: `deadlineOnDay` on a want. The schema had it, a predicate read it, tests covered the
predicate, and the design rested on it - the whole distinction between *a present need, which is
a refusal* and *a reserved future need, which is a price you have not met*. **Nothing in the
world ever wrote one.** So every want in every seeded world read as reserved, every holder was
negotiable, nobody was ever out of time, and the case the design most cared about - somebody
desperate - could not occur. Measured across five worlds: 2000 people with an open want, **0
carrying a date.**

Why this is worse than an uncalled module. An uncalled module is *inert* - nothing happens, and
sooner or later somebody notices nothing happening. **An unwritten field is not inert. It reads
as a value**, and the code around it goes on answering with total confidence. `null` means "no
deadline", "no deadline" means "not urgent", and a world where nobody is ever urgent looks
exactly like a world that is merely calm. Every test passed, over an empty column.

Three things that catch it:

1. **Ask who writes it, not just who reads it.** The same discipline as naming the caller, one
   level down. A field with three readers and no writer is a field with a bug.
2. **Count the column in a seeded world before trusting anything computed from it.** A
   distribution of one value is the signature. This is the same instrument as
   [an aggregate can be measuring the seeder](#an-aggregate-can-be-measuring-the-seeder-rather-than-the-thing-you-changed),
   pointed at an input rather than an output.
3. **Prefer deriving to storing where the answer moves.** The fix here was not to start writing
   the column - a stored deadline goes stale the moment the settling clock resets, and then the
   row lies with a straight face. It was to compute the date on demand from clocks the world
   already keeps and already moves. **A stored value that nothing maintains is a slower version
   of the same defect.**

### Check for existing docs and modules before you start

**In this project the prior is that it already exists.** The defect above has a twin: because so
much here was designed, written and documented before it was wired, the thing you are about to
build has usually been built once already - and the way you find out is by looking first, not by
discovering the collision at commit time.

The case that produced this entry: an agent was briefed to design fostering - who takes a child,
what it costs, why a favour is the currency. All of it existed.
`src/data/cultivation/a-favour-skips-the-admission-bar.ts` opens by stating the mechanism
outright - *a favour from somebody high enough makes a house take a person it would otherwise
refuse on the bar* - and carries the argument for why it must exist.
`src/engine/birth/spending-a-word-to-place-a-child.ts` was the engine half.
`docs/world/origin.md` was the written design, and the package README pointed at it. **The brief
was wrong, not the agent.** Had it been followed, the result would have been a second fostering
mechanic beside the first: the very defect the task existed to fix, committed again.

So, before writing anything:

1. **Open [`docs/world/INDEX.md`](docs/world/INDEX.md) and search it for the SITUATION, not
   the noun.** It is every section in the bible listed against the question it answers, plus
   every catalog in `src/data/cultivation/` and what design question that file settles. Do
   this before browsing filenames, because filenames are the thing that has repeatedly
   failed: the rule for what happens when a house catches you using its art is in
   `items.md`, correctly, because a manual is an object - and nobody with that question ever
   searches a file called `items.md`. **Three agents in one evening wrote an invented answer
   to a question the repo had already settled**, one of them into a passage they had
   personally read an hour earlier. The index exists because of them, and its top table is
   the running list of what this directory is bad at. **When your own search fails and the
   answer turns out to have existed, add a row.**
2. **Then read the file it sends you to, in full.** A design doc that contradicts what you
   are about to build is the cheapest correction you will ever get.
3. **Grep the catalog and the engine for the concept, not the identifier.** The file that owns a
   thing here is usually named after what it is - `a-favour-skips-the-admission-bar.ts`,
   `what-grade-of-medicine-a-wound-needs.ts`, `who-a-life-like-this-grew-up-knowing.ts` - so
   searching for the *idea* in filenames finds what searching for a symbol will not.
4. **Check whether it is half-wired rather than absent.** `src/engine/birth/` had one live file
   and one dead one in the same package. "No caller" and "does not exist" look identical from a
   distance and want opposite responses.
5. **When the docs and your brief disagree, say so before building.** The docs are usually older
   and usually right, and a brief written from a playtest often describes a symptom rather than
   the design. Raise it; do not quietly pick one.

The habit generalises past duplication. Most of the sharpest rulings in this world are already
written down somewhere - what money cannot buy, what a refusal owes the player, why lineage buys
nothing at one particular door - and prose you write in ignorance of them will contradict them
in ways a test will never catch.

### Nothing in this world is invincible

**Whatever a capability grants, it never adds up to cannot-be-killed.** Not the strongest body
on the ladder, not an adaptive defence, not a rung nobody else has reached. Everything that
lives can be ended, and every defence reduces rather than forbids.

This is stated as a law because it is the failure mode a capability system walks into on its
own. Each individual step is reasonable - a tribulation body resists the elements, so lean on
one element and it stops working; adaptation should cover more than elements, so it covers
anything; adaptation should improve with exposure, so it approaches total - and the sum of
three reasonable steps is somebody nothing can touch. The design owner said "not immunity",
"they will still die eventually", "it does not make you invincible" and "even adapting to
anything you can still die" across a single afternoon, unprompted, which is how strongly the
gradient pulls the other way.

Three shapes to check whatever you are building against:

- **A defence reduces; it never zeroes.** A fully adapted, fully resistant, fully prepared
  target still takes something from every blow. The moment a number can reach zero, a long
  enough fight becomes a stalemate nobody can break, and the world quietly acquires a creature
  that cannot lose.
- **Every defence has a window, a cost or a condition.** Adaptation takes exposure and time.
  Presence has range and burns out. A body is at home in the elements and can still be cut.
  Name the opening when you write the capability, because somebody will otherwise have to
  invent one later.
- **Scale does not rescue it either.** Being unkillable by twenty ordinary attackers is a
  legitimate and desirable outcome - *"you might not win, but you could get out"* - and is not
  the same as being unkillable. A smaller number doing something the target has not met should
  still finish them.

The rule holds all the way up. Even at the top of the ladder, what a rung buys is enormous
advantage, a very large margin, and a great deal of time - never exemption from the thing that
happens to everybody.

### Realm capability is enforced, not asserted

**Ruled by the design owner: what a realm grants is something the engine enforces.** Not prose
the narrator repeats, not a table read only by a document, and not a set of declarations
checked against an empty holder.

This was a live question because the capability layer was found to be entirely unreachable -
`capabilityActorFor` hardcodes `heldGrants: []`, so all fifteen realm grants were off for every
living cultivator, and four of them were described in an audit as "built". A wound meant to
deny a grant would have denied something nobody held: **a no-op that reviews as a feature.**

So a grant is only real when something in `src/` asks about it at the moment it matters. The
three that were genuinely enforced when this was written - `SATIETY_BURN_BY_REALM`,
`triggersHeavenlyTribulation`, and `killRequirement` through `assessPower` - are the model:
each is consulted by running code, in a system that already does something, at the point where
the answer changes an outcome.

Two consequences for anybody adding to it:

- **A capability without a consumer is not finished.** The same rule as
  [a module nothing calls](#a-module-nothing-calls-is-not-a-feature), applied to the layer that
  taught us the lesson.
- **And it is what makes a failed crossing mean anything.** The broken statuses each deny the
  ability their realm exists to grant - that is the whole of what they are. If capability is
  not enforced, a crippled nascent soul and a whole one are the same person with different
  prose, which is exactly the softening the agency rule forbids.

### The population pyramid is a law, not a preference

**Whatever is changed, the shape of the population survives it.** Far more people at the bottom
than the middle, far more in the middle than the top, and that ordering holds at every horizon
and every scale. `tests/engine/world/the-pyramid.test.ts` is the acceptance test for any change
that touches advancement, ground, teaching, seeding or the ladder - **run it in both arms, in
one command, on a tree you have checked.**

Two rules inside it, because the two ends of the ladder need different instruments:

- **Where both bands are populations, the ordering is absolute** - a single seed is proof.
  Qi Condensation outnumbering Foundation Establishment is roughly 300 against 80; samples that
  size do not trade places by chance. If that ever inverts, something structural has broken.
- **Where either band is individuals, the ordering holds only in aggregate.** Four against six
  swap for ordinary reasons. An inversion there fails only if it reproduces across seeds - and
  **the summit is expected to be irregular**, because a prodigy institution sits on it and
  concentrates the people who get that far.

And the rule that governs every proposed fix: **a change that makes the middle of the world
climb faster is the wrong change, even if it achieves the thing you wanted.** A world full of
cultivators at the top destroys the scarcity the whole setting rests on. What is wanted is a
handful going all the way against a population that overwhelmingly does not.

### The player must be able to type back what the game printed

The listing named ruins - "The Gate Frame With No Gate In It" - and the parser accepted
only the id slug, which is shown nowhere. Typing back what the game had just said reached
nothing. Any name the game prints is a name the game must accept.

### Fix the gap that was demonstrated, not the one you imagined

Having found that `ruin` was missing from the site nouns, the first fix also added scars,
sealed domains, forbidden zones and spirit veins. Those words live in the *names* of
places a player travels to, so the change stole sentences from `investigate` and from
ordinary place resolution. Two tests caught it. Narrow to what you actually saw fail.

### Rarity is a population statement, not a price

"Rare to a degree where most people just live with it" is a measurement of a cohort: of
everybody carrying the condition, what fraction is ever treated? A thing can be priced
astronomically and still be common if the people who need it can all get one. Measure the
cohort, not the cost.

Its sibling: **a count needs a physical reason.** An apex holds one or two copies of its
deepest manual because copying it out takes the patriarch's own time and nobody else can
do it. That survives the next content pass; "legendary tier, therefore two" does not.

### Holding a thing and being able to pass it on are different facts

A house's shelf says what it *has*. What gets across depends on teaching capacity, which
is a different number - one leader's occasional hours at an apex, against four people at
the Hollow Court who do nothing else. Two bodies with identical shelves can produce
utterly different numbers of high cultivators, and that difference is usually the
interesting part.

### What NPCs do is emergent. Never enumerate it

**Model what somebody wants. Let the behaviour fall out.** The moment a list of NPC
behaviours exists, the world has as many behaviours as somebody remembered to write, and
adding one means editing the list. That is the test: **if a new case requires a new branch,
the shape is wrong.**

The rulings that produced this entry are about who will part with a tracked thing, and they
are illustrations of a model rather than cases to implement:

- Somebody pays **above the going rate** because the need is theirs - an injured son, a
  chosen disciple, a weapon that would help them cross the tribulation.
- Somebody **will not part with it at any price**, because they need it themselves: for a
  child, for a chosen, or to clear an injury that is blocking their own path.
- Somebody holds **a store reserved against a need they do not have yet** - a chosen son who
  has not been born - and *"given the right trade might be willing to part with it"*.

**These are non-exhaustive and must not become an enum.** A tenth reason should require no
code, only a person with a different want.

The third case carries a distinction worth keeping, because it is what stops "will not sell"
from being a wall:

> **A present need is a refusal. A reserved future need is a price you have not met.**

Somebody whose son is dying tonight is not a seller at any figure. Somebody holding medicine
against a disciple they may one day take is holding an *asset*, and the right trade moves it -
where "right" means something that serves the reserved need better than the thing does.
That is [`docs/world/items.md`](docs/world/items.md)'s barter tier made personal: above the
line cash is not the medium, and what moves people instead is a favour owed or another
singular thing.

**Scope: tracked objects only.** Counted stock has a price and no story. A bowl of millet does
not have anybody's dying son behind it, and if it did the market would stop working. See
[rarity is a population statement, not a price](#rarity-is-a-population-statement-not-a-price)
for why that boundary is not an authoring convention.

This is the same law as [nothing in this world is
invincible](#nothing-in-this-world-is-invincible), pointed at motivation instead of defence:
the interesting behaviour is what the model produces, and a hand-written list of outcomes is
always both smaller than the world and impossible to keep true.

### "Typically does not" is not "never"

Court members are famous, unapproachable and usually silent. They are also "people and
not demons", and one might show you a thing or two. A rule modelled as an impossibility
throws away the rare event that makes the ordinary case worth having. Build the tendency,
leave the door open.

### Every realm is a bucket with an inflow and an outflow

The design owner's model for the population, and the one to tune against:

> Think of it as a bucket with an input and an output. The bucket always has some volume to
> it, but it is shifting.

Nine buckets, one per cultivation stage, and they are CHAINED - the outflow of one is the
inflow of the next, minus whatever dies or settles on the way. So no band can be tuned in
isolation: widening Core Formation's outflow fills Nascent Soul, and choking Foundation
starves everything above it.

The shape wanted at every stage is a steady volume whose contents turn over slowly - some
residents who arrived recently, many who have been there a long time. Measure **inflow,
outflow and volume separately** rather than reporting a single share, because the four
failure modes look different in those three numbers and identical in any one of them:

- volume stable, arrivals near 100% - **too fast a turnover**, the bucket is being flushed.
  Measured at 90-95% above Void Refinement and rejected: "arrivals should be HARD",
  "cultivation should not be easy".
- volume falling - outflow exceeds inflow. This was the original decline.
- volume healthy, inflow near zero - **living on inheritance**, which is where the apex
  started: every resident a seeded survivor and nobody new ever arriving.
- volume climbing without bound - the outflow is too slow. Not yet observed.

Two things make this subtler than it looks. **Settling and the structural breaks are
outflows that do not remove anybody from the world** - a settled or broken cultivator stays
in the band forever and stops feeding the one above. So a band's volume can look healthy
while the outflow that matters, the one that fills the next bucket, is near zero. Measure
the two kinds of outflow separately. And check what "arrival" counts: somebody who climbed
one rung and is now recounted in the band above is not the world producing anybody.

### Rare in the world and common at the top are the same fact

A birth tier that almost nobody is born into can still make up a large minority of an elite
house, and there is no contradiction between those two sentences. They are the same
distribution asked two different questions.

> The chance somebody is born high is tiny. The chance somebody is born high **given that
> they are an elder of a Dao house** is large.

Selection is not random. Advantage buys the inputs - stones, provisioned years, a teacher,
placement - that make surviving the climb far likelier, so the small pool supplies most of
the people who arrive. Nobody is placed at the top for being born well; they are
over-represented at the top because being born well made them likelier to get there. That
is the setting's own thesis rather than an exception to it: **an origin buys inputs and
never rank.**

This was found the hard way. Every Dao house member on the register read `thin_county`,
because the seeder ran the people it PLACES through the lottery meant for people it BIRTHS.
A world whose entire aristocracy was born on farms is not the thesis arriving on its own -
it is a sampling error wearing the thesis as a costume, and it is more flattering than the
truth, which is why it survived review.

Two habits follow:

**Measure the conditional, not just the marginal.** A distribution over the whole
population and a distribution over an institution's membership answer different questions,
and a system is only right when both look correct. Reporting one and assuming the other is
how this got missed.

**Ask whether a rule written for one moment is being applied to another.** Birth and
placement are different events. So are arriving in a band and being seeded into it - the
same mistake, in a different file, produced an "arrivals" figure that counted everybody not
present at world creation. When a number looks wrong, check that the rule producing it was
written for the case it is being asked about.

### Decline is correct for a house and wrong for the world

Sects rise and fall; that is the setting working. The world's standing distribution
collapsing to 98% at the bottom with empty bands in the middle is not a Late Age, it is
unreplaced attrition wearing its clothes. When you measure decline, split it: which
institutions ended, and what happened to the population's shape.

And when you count a band, split **survivors from arrivals**. A band held entirely by
people who were there at seeding is a dying band however healthy its headcount looks.

### A ruling about one body is not a general mechanic

A constraint given for the Hollow Court was generalised into a universal rule and had to
be retracted in writing. If the design owner says a thing about one faction, it is about
that faction until they say otherwise. Ask before promoting it.

### A test can encode a defect

Four calibration tests asserted a ladder that stopped at Core Formation. They were
measuring a sweep that priced every rung at ordinal zero, and their bars had been derived
from that broken arithmetic - one docstring even reasoned from it explicitly. Passing
tests are evidence, not proof. When a fix turns tests red, read whether they assert the
intent or the bug, and re-derive rather than reverting a correct change.

### The test harness runs with the world OFF, and the game runs with it ON

`makeGame` in `tests/web/harness.ts` defaults `worldEnabled: false`. `GameService`
defaults it to `true`. So hand-playing through the harness is not playing the game - it is
playing a configuration where every guard that needs a world to check against is skipped by
design.

The trap is that those guards fail OPEN and read exactly like bugs. Travelling to
"Nowhereville", to "sleep", or to "the moon" all succeeded through the harness and set the
cultivator's location to the typed string, which looks like a serious defect and is
documented in `move` as the exact thing it refuses. With `worldEnabled: true` the same three
come back with "You ask after Nowhereville and get the look people give a name that is not a
place", and the location does not move.

So: **pass `worldEnabled: true` when hand-playing.** Reach for the default only when the
test genuinely does not need a world and wants the speed.

This is the fourth time in one session that a harness disagreed with the engine and the
harness was wrong - the others were reading `narration` when the API returns `error` on a
closed run, and using `factionId` and `techniqueIds` where the player row carries `sectId`
and `knownTechniques`. Before reporting engine behaviour as a defect, check that the thing
you are driving it with is configured the way the real caller configures it.

### A number taken across a gap is worthless while other agents are committing

Two measurements of the same thing, minutes apart, are not a before-and-after when four
agents are landing catalog changes between them.

Measured: a world advanced to the same horizon on the same seed gave 506 alive, then 513.
That reads exactly like a determinism bug, and it is not - the simulation is deterministic
within a process (three runs in one command gave identical results). What moved was the
catalog underneath it. The same trap caught a timing comparison in the same hour.

So **the only trustworthy comparison is back-to-back in a single command**: save the file,
`git checkout --` the one file, measure, restore, measure, all in one invocation. If that
is not possible, do not report the delta. Prove correctness a different way instead - two
functions returning identical output for every input, or a test suite giving the same
pass/fail count with and without the change, both of which are immune to a moving tree.

### Pool the sample. Never widen the bar

A threshold on a rare or varied outcome, asserted on too small a sample, reports **the world
moving as the world breaking** - and then gets widened by whoever happens to be holding the
good reason at the time. That is how a guard becomes decoration.

This bit three separate files in a single day. A ruins test required four kinds of closed
ground and got three, on one seed, twice - once after a technique-catalog change and once
after a ground change, neither of which went anywhere near ruins. A pyramid guard asserted
that two adjacent bands were ordered, on one seed, and went red because bands of 25 and 30
traded places by chance. A leverage guard sampled three seeds and concluded a working
subsystem did nothing, when eight seeds showed it landing.

**Pooling is the fix in every case. Widening is never it.** Run more seeds, pool the counts,
and judge the claim over a sample big enough to carry it - the bar itself usually turns out
to be right. The ruins test kept its four; it simply stopped asking one seed to prove it.

The tell that you are about to make this mistake is the sentence *"it is only just under, and
my change is obviously fine"*. You are the person holding the good reason. Everybody who
widened one of these was.

And the same arithmetic decides the other direction: **where the counts are enormous, one
seed is proof.** Three hundred against eighty do not trade places by chance, and a guard on
those two should fail instantly and unpooled. Sample size is not a global setting; it is a
property of the claim being made.

### A control arm at one seed is two samples, not a control

The entry above says pool a claim before you judge it. This is the same rule applied to the
thing you reach for when a guard goes red: **running your change off and then on against the
same seed tells you the two worlds differ. It does not tell you whether the difference is
your change or the draw.**

Measured, and it came within one command of going in as a finding. Eleven rows added to the
member catalog - none of them standing above Nascent Soul - turned a guard red at 4 of 10
people above Void Refinement, against a bar of half. The control arm on that seed read 22 of
30 without the rows. Two separate instruments reproduced it identically, and the population
was 531 against 527 either side, so the world was the same size and the band had been cut to
a third. The baseline's spread over six seeds was 23 to 41, which put 10 nowhere near it.

Every one of those sentences is true and the conclusion drawn from them was wrong. Six seeds
on the CHANGED side read 10, 29, 43, 27, 41 and 14 - its own spread is 10 to 43 - and the
claim the guard actually makes barely moved: 143 of 194 pooled without the rows against 114
of 164 with them. One seed had drawn badly, and that was all.

The mistake is specific enough to look for: **the new reading was judged against the OLD
arm's spread.** A baseline sampled on one side says nothing about how wide the distribution
is on the other, and a change that reshuffles a seeded population can widen it. So pool BOTH
arms before deciding which of the two you are holding - and be most suspicious of the reading
dramatic enough to feel like a mechanism, because that is what the tail of a wide
distribution looks like from close up.

### A single measurement off a shared tree is already somebody else's unfinished work

The lesson above is about the gap BETWEEN two readings, and that framing is too narrow. It
lets you believe one careful reading is safe. It is not.

Measured: an agent took a pyramid baseline, committed it as the authority, and later
re-ran its own probe at the same parameters - getting numbers identical **to two decimal
places across all nine bands**. That precision is not small-sample noise, it is "the change
did not apply", and chasing it found the real story: the original baseline had been taken
off a working tree that already held another agent's uncommitted root-conditioning edits.
The file showed as `M` in `git status`, was correctly identified as somebody else's, and was
correctly left alone - and none of that stopped it being *in the tree the number came out
of*. Both arms of every before-and-after quoted from that baseline were "after". A real
change worth four points looked like no change at all.

So: **`git status --short` before you measure, not only before you edit.** A dirty file you
do not own is still in your build. If anything relevant is dirty, either take both arms
back-to-back in one command (checkout, measure, restore, measure) or say plainly which
uncommitted work was in the tree when you read the number. A baseline is a claim about a
tree state, and a baseline that does not name its tree state is not a baseline.

The reciprocal holds and is worth saying out loud: **your own unstaged work is in everybody
else's measurements** for as long as it sits there. Commit or say so.

### An aggregate can be measuring the seeder rather than the thing you changed

A band histogram said 123 cultivators above Core Formation with the dao gate off and 130
with it on - reassuring, and meaningless. The upper bands were overwhelmingly people the
SEEDER placed, and only 1 NPC in 32 alive from seeding ever climbs past ordinal 21. The
table was measuring world creation.

Its sibling: a column named `arrivedAt` counted people *not present at world creation*,
which after ten thousand years is nearly everyone alive. It was reported as a turnover
measure and read 82-94% before the change it was offered as evidence for.

Two habits fix both. **Split what you are counting from where it came from** - seeded
versus arrived, and for a band, inflow and outflow and volume separately rather than one
share. And **run the control arm**: the same probe with your change switched off. That is
one edit and one command, and it is what established that the dao gate is not what limits
this world's apex and never was.

### A fallback written in ordinary English is invisible

`summariseToolBody` turns a tool result into prose through branches keyed on what the
result carries. A verb whose shape has no branch does not fail - it falls through to
"It is done. Nothing about it drew attention.", which reads like a sentence and says
nothing.

Three verbs sat there in one session. Combat reported "both parties are worse than they
were" while omitting that it took two thirds of the HP and left an untreated wound. Work
reported wages across four years while wounds accumulated silently. A petition's whole
journey - how far it climbed, every stop, the names learned carrying it - came back as
"It is done."

All three were found by playing, because nothing else notices. A test asserting "the verb
returned prose" passes on the shrug. `scripts/probe-does-every-verb-say-what-happened.ts`
is the cheap version of a person reading the answer and asking "and then what happened?" -
run it after adding a verb.

### Escapes die on the way through a heredoc

Writing a file with `python - <<'PYEOF'` and a regex in it: `\\b` reaches Python as `\b`,
Python's string escape turns it into a BACKSPACE (0x08), and the file gets a control
character where the word boundary should be. The regex then reads `/\x08(?:anyway)\x08/`,
matches nothing, and looks perfectly correct in the editor, in `tsc`, in `grep` and in code
review.

This happened three times in one session and cost hours on the third, because every
instinct says the problem is elsewhere - the value is right, the function is right, and the
match simply fails.

Use a raw string (`r'''...'''`) for anything containing a backslash, or write the file with
the Write tool instead. And when a regex that is obviously correct does not match, check
the bytes before checking anything else:

```bash
grep -rlP '[\x08\x0b\x0c]' src/ scripts/ tests/
```

### The register is a reflection, not a source

The standing register must be readable off the world's own state. Where it says a house
holds something, the house holds it; where it says a body wants something, that want is
still coherent with what that body now is. A want pointed several tiers below its holder
is the signature of an earlier draft, and finding one usually means finding more.

---

## Boundaries when working in parallel

Multiple agents may be working this repo simultaneously. Stay inside your assigned file
set. In particular, do not casually edit:

- `src/schema/cultivation.ts`, `src/engine/cultivation/realms.ts`,
  `src/engine/cultivation/spirit-roots.ts` - shared contracts. Changing them breaks
  everyone. Propose the change instead.
- `src/storage/migrations.ts` and `src/server/consolidated/index.ts` - shared registries
  that conflict badly. Make the minimum one-line addition and nothing else.

### Do not act on an error in a file you do not own

While other agents are running, the working tree is a moving target and any snapshot of it
you take is already stale. This has bitten us concretely:

- **A typecheck or test failure in somebody else's file is not yours to fix.** You are
  looking at a half-written edit. Fixing it races the owner, and the "obvious" fix is often
  wrong - an unused import you remove is used two lines later once their edit lands.
  Report it to the owner and move on.
- **A red suite is not automatically a regression.** Check who owns the failing file before
  concluding anything, and never revert somebody else's work to get back to green.

### Do not `git add -A` while agents are running

Test runs create transient files (`*.db-journal` and friends). If one appears and is gone
again between staging and indexing, `git add -A` fails and stages nothing:

```text
error: unable to index file 'test-invoke.db-journal'
```

Stage explicit paths instead, or make sure every artifact pattern is in `.gitignore`
before staging. When a run produces an artifact that is not ignored, **add the pattern**;
do not delete the file and hope, because the next run recreates it.

### Name the file after what is in it

> **A filename is the only documentation everyone reads. Make it say the subject.**

This project has repeatedly shipped modules whose names told a reader nothing, and the
cost lands on whoever arrives next and has to open five files to find one behaviour.
Actual examples from this branch, with what their own header comments already called them:

| Was | Its own first line | Now |
|---|---|---|
| `escapes.ts` | "What a capped cultivator does next" | `acquisition.ts` |
| `toll.ts` | "The Price of Advancement" | `price-of-advancement.ts` |
| `goods.ts` | two unrelated subjects in one file | split, and both named for their subject |

The test: **a reader who has never opened the file should be able to guess what is in it
from the name alone.** One-word abstractions - `goods`, `toll`, `pressure`, `standoff` -
almost always fail it, because the word is doing metaphorical work the filename cannot
carry. Prefer the plain description, and prefer a long descriptive name over a short
evocative one: `single-use-dao-comprehension-materials.ts` is not too long, it is correct.

Two corollaries:

- **If the file's own header says what it is, the filename should say the same thing.** In
  every case above the right name was already sitting in the first line of the comment.
- **A file with two subjects has the wrong name whatever you call it.** Split it.

**Renaming in a busy tree: rename by re-export, never by rewriting importers.** Every
import line you touch in somebody else's file is a line you will sweep into your own
commit, along with whatever else they have unstaged there. Move the module, leave a
one-line `export * from './new-name.js';` at the old path with a comment saying where it
went, and let the importers migrate as they come free. Twelve files imported the two
modules renamed above and nearly every one held another agent's live work.

### Repetition should cost. A narrow life makes a narrower cultivator

**Doing the same thing over and over must be worse than living a varied life** - and not only
in efficiency. Somebody who spends three hundred years doing one thing has *experienced* less,
and should be less of a cultivator for it. That is a statement about what they became, not a
penalty bolted onto a verb.

This is the counterweight to agency. Because anybody may attempt anything and the engine only
prices it, a player who finds one profitable action can otherwise run it forever - and a world
in which the optimal life is a single loop is a world with one decision in it, taken once.

Two ways to get this wrong:

- **Not charging for it**, so the loop is optimal and every run converges on the same
  featureless strategy.
- **Charging for it mechanically and calling it a day** - a stacking malus on a repeated verb.
  That reads as the engine slapping the player's hand, and it invites the player to launder the
  repetition through synonyms.

The honest version follows from what the setting already believes: **understanding comes from
having been places and survived things.** The comprehension machinery is already built this way
- an insight comes from a tribulation survived, a deviation come back from, a road walked, a
carving read, a place stood in. Somebody who only ever sat in one cave has none of those to
draw on and it is not because a counter was decremented; it is because they were not there.

So express it where experience already lives, not as a rule about verbs. If a life shows no
variety, the things that variety would have produced are simply absent - fewer roads walked,
thinner understanding, nothing to bring to a crossing that asks what you have understood. The
loop stops being optimal on its own, and the reason it stops is legible in the fiction.

**The image to hold is a greenhouse.** Somebody whose whole life was moving between caves and
sitting in them has been raised under glass. Nothing went wrong for them, which sounds like
good fortune and is the problem: they have never been tested, never had to come back from
anything, never met somebody who wanted something from them. They are not being punished for
grinding - they are simply thin, in a way that shows the moment the world asks them for
anything they did not practise.

And note what this does NOT license. A repetitive life failing *early* is not this rule
working; it is something else killing them, and it should be investigated rather than credited.
This effect is about who somebody has become over a long life, so it can only show up over one.

### Agency: do not ban it, and do not soften it

**Anybody may attempt anything.** The engine's job is not to decide what is allowed - it is to
say honestly what happened and what it cost. Those are the two ways to get this wrong, and they
look like opposites while being the same mistake:

- **Banning.** Refusing an action because it seems unwise, unsafe, or not what the designer had
  in mind. Every refusal of this kind is a decision taken away from the person playing, and it
  is usually indistinguishable from the feature being missing.
- **Softening.** Allowing the action but quietly removing its price, because the honest price
  seemed harsh. This is worse, because it is invisible: the player thinks they made a choice and
  the world silently declined to charge them for it.

**The correct answer to "may I?" is always "yes, and here is what it costs."**

So when a word in the player's sentence seems to call for special handling, ask which of the two
you are about to do. Usually the answer is that **the wording changes what somebody INTENDS and
what follows socially, and changes nothing about what the world then does.** Model the intent
and the consequences that flow from it - who is owed something afterwards, who carries a
grievance, what a witness would say - and leave the physical outcome exactly where it was. The
moment a phrasing starts changing what a body suffers, there are two sets of rules and the
softer one is reachable by choosing your words.

**Kill somebody during an agreed bout and you will obviously face consequences.** That is the
whole principle in one line. Nothing stops you - the engine does not reach in and prevent it,
and it does not quietly make the bout unable to kill. What happens instead is that the world
answers: you agreed to go gently and you killed them, there were witnesses, they had people, and
everyone who hears about it now knows something about you that they did not know before.

Note where the agreement lives in that sentence. It is not in the damage - the blows landed as
blows land. It is in **what the killing MEANT**, and that is where the entire consequence comes
from. The same wound in a duel neither party pretended was friendly is a different event with a
different bill.

The tell that you are softening is a sentence like *"but that would hurt them, and this is meant
to be the safe version."* If the fiction says the safe version exists, it is safe because of
what the participants are trying to do, not because the engine stopped keeping score.

And the tell that you are banning is a refusal with no cost attached. A world that says no is
smaller than a world that says *"yes, and it went badly, and here is who saw."*

#### The one exception: madness takes the choice, because the character lost it

**A mad cultivator does not act. Things are narrated as having happened.** The player reads what
they did; they did not choose it and they cannot veto it.

That is the rule above inverted, and it is the only place it should be. The reason it is
principled rather than the banning this entry forbids: **everywhere else, taking the verb away
lies about the world** - the player could have tried and the engine pretended otherwise. **Here,
keeping the verb would be the lie.** The character has no agency; the player losing the choice
is the honest rendering of that, not a punishment applied to them.

Two things keep it honest, and neither is optional:

- **The outcomes are not only bad.** The owner's framing is that you may not like it one bit -
  *and* that you might run into a ruin in your madness and come out rich. A mad stretch must be
  genuinely uncertain rather than a debuff with prose on it. Somebody who walks through a gate a
  careful person would have measured first is the shape: several of those gates ask for
  something that is not power.
- **The decision moves upstream, it does not vanish.** What the player still chooses is whether
  to risk the heart demon at all, and what to do about the state once they are in it. If a run
  can enter madness with no prior decision that led there, this has become a random punishment
  and the exception no longer applies.

**Do not confuse this with the engine deciding on a lucid character's behalf**, which is a
defect and has been fixed as one. The seclusion interrupt used to narrate a real dilemma -
*going costs the stretch; staying means being found* - and then resolve it silently. Same
surface, opposite verdict: there the character had a choice and the engine took it; here the
character has none and the engine saying so is the truth. **The test is not whether the player
chose. It is whether the character could have.**

### Commit with a pathspec, never a bare `git commit`

Every agent on this tree shares one git index. A bare `git commit` commits **whatever is
staged**, including work another agent staged and has not finished. This has happened:

```bash
git commit -m "..."            # swept up another agent's staged src/web/** work
git commit -- <your paths>     # only yours, whatever else is in the index
```

The agent that did it noticed, reset, and recommitted correctly - but nothing would have
caught it otherwise, and the owner would have found their half-finished edit in somebody
else's commit. Always name your paths. Check `git status` before staging so you know what
else is in flight.

**A pathspec in your command does not protect you if the command does not parse.** This
happened a second time, one message after the agent had been warned: a PowerShell
here-string (`@'...'@`) was used in the **Bash** tool, the quoting shattered, the `--`
pathspec was swallowed with it, and the commit swept up twelve of another agent's files
including three untracked ones. So:

- **Never use PowerShell quoting syntax in the Bash tool.** For any multi-line commit
  message use a heredoc or `git commit -F <msgfile>`.
- **`git reset --soft HEAD~1` is the recovery** and it preserves the index byte-for-byte.
  Verify the other agent's files are back in the index *and* that untracked ones are still
  on disk before continuing.

**And a pathspec does not protect a file you both touch.** It limits the commit to paths
you name, but it commits the *working tree* at those paths - so if another agent is
mid-edit in a file you also changed, their half-finished work goes in under your message.
This happened with a rename in flight. Before committing a shared file, check whether
anyone else has it open (`git status`, recent mtimes), and if they do, either wait or
commit only the files nobody else is in.

### Reverting your own work by file destroys everyone else's

The same hazard runs backwards, and it is worse, because a bad commit can be undone and a
discarded working tree cannot. An agent abandoned a design it had built and ran
`git checkout -- src/storage/migrations.cultivation.ts` to drop it. That file is a shared
registry: another agent's `bleeding_turns` migration was sitting in it, unstaged and
therefore not in any object git could hand back. 69 tests started failing and the only
copy of the lost block was in a `Read` result earlier in a transcript.

**A file-level revert on a shared file is not a scoped operation.** It does not undo your
change; it restores the file, including over work you never made and cannot see. Before
discarding, `git diff` the file and confirm every hunk you are about to lose is yours. If
it is not, revert your hunks specifically or edit them back out by hand, and commit
whatever you rescued immediately so it cannot be lost a second time.

### `--ff-only` refusing is usually a question about the branch, not about your commit

**Check what the tree is standing on before you believe a merge error.** This cost two hours and
nearly lost 670 finished lines.

An agent committed its work, ran `git merge --ff-only` in the main worktree, and was refused. It
concluded that a dirty `src/web/actions.ts` was blocking it, reported the work as blocked, and
stopped. Meanwhile I told two other agents the work had landed, and one of them built against a
file that was not in the tree.

**Every part of that was wrong:**

- **`feat/xianxia-cultivation` was checked out in no worktree at all**, and the main tree was
  sitting on a different branch that was *ahead* of it. The merge was resolving against that
  branch and correctly refusing, because the commit did not contain it. **The error was about
  the wrong branch, and it was accurate.**
- **The dirty file never mattered.** A dirty file blocks a merge that has to *update a working
  tree*. Nothing about this one did.
- **The commit was reachable the whole time.** `git log <hash>` showed it; `git branch --contains`
  showed nothing. It was not lost, it was unreferenced.

What to do instead:

1. **`git rev-parse --abbrev-ref HEAD` before you trust any merge error.** The tree may not be on
   the branch you think, especially in a repo where several agents create branches.
2. **Rebase onto the branch you mean by name**, not onto whatever the tree happens to be on.
   `git rebase feat/xianxia-cultivation`, not `git rebase HEAD`.
3. **If the target branch is checked out nowhere, `git branch -f` is safe** and touches no working
   tree, so nobody's dirty files are at risk. That is the whole reason to check.
4. **Verify a landing with `git branch --contains <hash>`, and never on report.** Two pieces of
   work were reported as landed tonight and were not. One of them I then repeated to the owner.

**The general shape, which is the same failure as the entry below in a different coat: a commit
that exists and is on no branch is invisible to everyone, including the agent that wrote it.**
`git log` will show it happily. Reachability is the thing to check, not existence.

### A file you never committed is invisible to everyone else

Untracked files in your working tree are not in the branch. An agent found
`src/web/above.ts`, `standing.ts` and `trials.ts` untracked while committed
`actions.ts`/`game.ts` already imported them - so **the branch did not build from a clean
checkout** and nothing local would ever have shown it. If you add a module, commit it in
the same commit as its first importer, and when in doubt clone the branch into a scratch
directory and build there.

### Read state, not prose

The narrator can say things that did not happen. That is not hypothetical: a scripted
narrator produced *"Day 91 - Breakthrough succeeded: Qi Condensation Layer 1 to Layer 2.
Odds were 94.0%"* against a cultivator who was still at ordinal 0 with zero progress,
imitating the engine's own digest format down to the day numbers. `auditNarration` now
catches the two irreversible fabrications, but the general rule stands:

- **Measure from the database or the state view, never by parsing narration.** A harness
  that reads `realmOrdinal` out of prose is measuring the model, not the engine.
- **A refusal from an endpoint is data.** `POST /api/run/new` answers **409** while a run
  is alive - *"there is no abandoning one"*. A driver that ignores that error replays one
  exhausted body and reports it as many lives. That exact bug produced a "100% starvation"
  finding that was entirely an artifact.
- **An absent field reads as zero.** A harness that asks for `after.qi` when the engine
  writes `cultivationProgress` measures `0 - 0` at every rung and calls it flat.

### Verify before you relay, and push back with evidence

Findings passed along without checking have repeatedly turned out to be the measurement
rather than the engine. When you are handed a defect report:

- **Reproduce it yourself before acting on it**, especially before changing a shared
  constant. Three separate "engine bugs" this project has chased were harness errors, and
  one nearly caused a retune of the exchange resolver to chase a figure that was three
  seeds out of three hundred in a distribution that was almost entirely stalemate.
- **If the report is wrong, say so and show the measurement.** That is more useful than
  complying, and it is how every one of those was caught.
- **State which build you measured.** A report against a stale `dist/` is not a finding;
  rebuild, restart the server, and say so.

### Only commit from a state you verified in one pass

Green tests from five minutes ago say nothing about the tree now. Run the suite and
`tsc --noEmit`, and commit only if both pass **in that same pass** with no agent edits in
between. If the tree is moving too fast to get a clean pair, wait for the owners to finish
rather than committing a snapshot you cannot vouch for.

### The catalog has usually already reasoned about the hazard you are about to hit

Before changing a value in `src/data/cultivation/`, **read the comment next to it.** Not the
file header - the note beside the field.

Three times in one session an agent changed a number that a comment ten lines away had already
explained, and broke a test each time. The clearest case: the Azure Cloud Pavilion's
`admissionOrdinal` was moved to 0 on the strength of prose describing a door at the floor,
while `governance-and-water-rights.ts` said, in as many words, that `rankRealmBand` derives
every member's band from that field and *"it must stay at the membership bar or the whole
ladder slides down"*. The same note explained why the probationary rung is deliberately not in
`sect.ranks`.

**A catalog field that looks like a free number is usually load-bearing**, and this repo tends
to have written down why. The reasoning is next to the data because that is where it belongs;
the failure is not reading it.

### A design decision that lives only as a number needs a test

The Pavilion's bar sat at 3 while two separate passages of catalog prose described a door at
the bottom of the ladder. **Nothing caught the contradiction for as long as it existed, because
an admission bar is a number nobody reads twice.**

Prose gets read and argued about. A number does not. So when a decision is deliberate - this
door is open on purpose, these three houses share an intake, this cap is a rate test - **pin it
with a test that says so in its name**, and put the reasoning in the test file. That is the
only place a future reader is forced to look.

### The git index is shared, and two habits will destroy somebody else's work

Several agents work in this tree at once and it is dirty almost all the time.

- **Never `git commit -a`.** It swept nineteen files of other agents' in-progress work into one
  commit in a single session.
- **`git commit` with no pathspec commits the WHOLE INDEX**, including files another agent has
  already staged. `git add` of your own paths does not protect you. Stage explicit paths and
  check `git status --short` before committing.
- **Never `git apply --cached --unidiff-zero`** to stage a partial hunk selection. With zero
  context git applies by line number and verifies nothing, so dropping hunks invalidates the
  offsets of the rest. That committed syntactically invalid TypeScript that took three commits
  to unbreak, while the author's own working tree compiled fine.

To take only your own changes out of a file somebody else is live in, **reverse-apply the other
party's hunks with normal context to a copy that already compiles.**

### A new RNG draw is a regression until proved otherwise

Adding a draw to an existing stream shifts every later draw off it. One agent's new hearsay
channel silently changed which name an unrelated channel picked, and a presence test went red
for a reason that had nothing to do with presence.

**Give any new draw its own stream**, and verify existing draws are byte-identical by running
base and change back to back in one command.

### The docs are filed by noun and searched for by question

This has cost more work than any other single thing here. Measured across the repo: **121,265
words of design prose live in comments inside `src/data/cultivation/`, against 94,476 words in
the whole of `docs/world/`.** Rationale markers point the same way - "measured" appears 41
times in the docs and 238 times in the catalog.

So the material exists and cannot be found. The consequence of practising a stolen art is
under *Items*, because a manual is an object - correct filing, useless retrieval. In one
session three separate design questions were answered by inventing something already written,
**one of them by an agent that had read the exact passage an hour earlier.**

**Start from the index, not from a grep.** Every tier-2 section carries a
`trigger="..."` marker stating the situation it answers, and those triggers are the retrieval
key: they are phrased as the question you actually have.

### An index shows where a thing is. It does not restate it

A parent file exists to point, and a pointer costs a reader almost nothing while a copy costs
them the whole passage. **Restating content in an index is worse than not indexing it**, because
now there are two copies to drift apart and an agent burns its context reading the wrong one.

The same rule governs cross-references between docs: when another file already covers something,
**link to it and say what it settles in one line.** Four times in one session a doc grew a
paragraph that already existed elsewhere, and each had to be trimmed back to a pointer.

### A test can be rewritten. A test that pins a bug must be

Tests here are not the specification. **They are an attempt to write the
specification down**, and when the specification changes the test is what has to
move.

So a test may be **modified, rewritten or deleted** when the design behind it has
genuinely changed. What is not allowed is deleting one because it is
inconvenient, or loosening an assertion until it stops failing without deciding
what the new rule is.

**The distinction is whether you can say what the test should assert now.** If you
can, rewrite it to assert that. If you cannot, you do not yet understand the
change and the red test is telling you so.

Two worked examples from one night, both from the same root cause:

- **A constant that encoded the bug.** `discovery.test.ts` defined the house a
  new life knows as "the lowest admission bar, tie-broken by faction id" - which
  was not a description of the world but a copy of the seeder's defect, where
  `sect-azure-dew-sect` won on the letter A and the other six houses admitting
  at rung 0 were unreachable to every player in every run. When the seeder was
  fixed the test failed, and the fix was to assert the **principle** -
  `discovery.md`'s "their world is the county" - instead of a headcount that
  would need editing every time the roster moved.
- **A fixture that hardcoded a name only a bug made universal.**
  `paying-into-the-ledger.test.ts` said "I join the Azure Dew Sect", which
  worked only because every cultivator everywhere had heard of that one house.
  With knowledge region-aware, the join was correctly refused and the test then
  measured a donation by somebody on nobody's roll. It asks the knowledge layer
  which house this cultivator knows now, and asserts they are on a roll before
  measuring anything.

And when the design moves under a number, **say so in the test's name and its
header**. The Azure houses' bars, the three intake layers, the population
pyramid: these are decisions, and a decision that lives only as a number nobody
reads twice will be silently reverted by the next person who finds it
surprising.

### `git stash` is shared across worktrees. Do not use it for before/after arms

The stash is per-REPOSITORY, not per-worktree. Every agent working in a
worktree of this repo pushes onto and pops off the same stack.

One agent lost a baseline stash mid-run: it vanished from `git stash list` while
another agent's appeared, almost certainly popped into somebody else's tree.
They recovered it from `git fsck --unreachable`, which is not a thing anybody
should have to do.

**Use commits for arms instead.** Commit your work on a branch, check out the
parent in a detached worktree, measure both, and compare. That is reproducible,
it survives another agent working at the same moment, and it leaves the
measurement attached to the hash it was taken at.

If you find unexplained edits appearing in your worktree, a stray `stash pop` is
the first thing to suspect.
