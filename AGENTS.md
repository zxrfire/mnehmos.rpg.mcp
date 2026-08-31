# AGENTS.md - Working Agreement for Coding Agents

The single guide for any AI coding agent (Claude Code, Codex, Cursor, Aider, …)
working in this repository. `CLAUDE.md` is a symlink to this file - there is no
Claude-specific guidance, by design. Edit this file.

For *why* this project exists and what it is, read [`context.md`](context.md) first.

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
├── engine/cultivation/   # THE CORE. Realm ladder, spirit roots, breakthrough,
│                         # qi deviation, injuries, survival/death, time-skip.
│                         # Pure functions. No DB, no I/O, no MCP.
├── schema/cultivation.ts # Zod contracts + survival constants (single source of truth
│                         # for balance numbers - never hardcode them elsewhere)
├── data/cultivation/     # Content: techniques, pills, recipes, herbs, sects, encounters
├── storage/              # SQLite: migrations.cultivation.ts + repos/
├── server/consolidated/  # Action-routed MCP tool handlers (index.ts = registry)
├── agent/provider/       # LLM providers: anthropic, ollama, openai, openrouter
├── agent/{prompt,runtime,audit}/  # NPC agent composition, invocation, replay
├── math/                 # Dice, algebra, physics
└── engine/{combat,spatial,worldgen,strategy}/  # Retained substrate

tests/                    # Mirrors src/
```

**Balance numbers live in `src/schema/cultivation.ts`.** Satiety costs, starvation
turns, lethal injury counts, stagnation years - import them, never retype them.

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

## Git remotes

| Remote | Points at | Use |
|---|---|---|
| `origin` | `zxrfire/mnehmos.rpg.mcp` | This fork. Push here. |
| `upstream` | `Mnehmos/mnehmos.rpg.mcp` | Fetch upstream `main` to reintegrate. |

Work happens on `feat/xianxia-cultivation`. Never push to `upstream`.

---

## Boundaries when working in parallel

Multiple agents may be working this repo simultaneously. Stay inside your assigned file
set. In particular, do not casually edit:

- `src/schema/cultivation.ts`, `src/engine/cultivation/realms.ts`,
  `src/engine/cultivation/spirit-roots.ts` - shared contracts. Changing them breaks
  everyone. Propose the change instead.
- `src/storage/migrations.ts` and `src/server/consolidated/index.ts` - shared registries
  that conflict badly. Make the minimum one-line addition and nothing else.
