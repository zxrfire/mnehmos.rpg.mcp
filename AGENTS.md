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
  `Math.random()`. Runs must be reproducible from their seed.
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

### "Typically does not" is not "never"

Court members are famous, unapproachable and usually silent. They are also "people and
not demons", and one might show you a thing or two. A rule modelled as an impossibility
throws away the rare event that makes the ordinary case worth having. Build the tendency,
leave the door open.

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
