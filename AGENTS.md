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

## Boundaries when working in parallel

Multiple agents may be working this repo simultaneously. Stay inside your assigned file
set. In particular, do not casually edit:

- `src/schema/cultivation.ts`, `src/engine/cultivation/realms.ts`,
  `src/engine/cultivation/spirit-roots.ts` - shared contracts. Changing them breaks
  everyone. Propose the change instead.
- `src/storage/migrations.ts` and `src/server/consolidated/index.ts` - shared registries
  that conflict badly. Make the minimum one-line addition and nothing else.
