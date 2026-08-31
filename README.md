# The Vault — a cultivation RPG engine

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)]()
[![MCP](https://img.shields.io/badge/MCP-compatible-green.svg)]()

**A xianxia cultivation roguelike with permanent death, where an LLM narrates and a
deterministic engine decides.**

You play a cultivator climbing a 45-rank ladder from Qi Condensation Layer 1 to
Tribulation Transcendence. Your talent is rolled once and locked forever. You will
almost certainly die somewhere in the first realm — of starvation, of torn meridians, of
a breakthrough you attempted at 31% because waiting was worse.

The AI writes the prose. It does not decide the outcomes. When the engine says the
breakthrough failed, the story you get is about a breakthrough that failed.

---

## Run it

```bash
docker compose up
```

Then open **http://localhost:8787**. That's the whole setup — the GUI, the game engine,
the database, and the MCP endpoint all come up together.

No API key is required. Out of the box the engine narrates deterministically. To get
LLM prose, pick a narrator:

**Local model, nothing leaves your machine:**

```bash
docker compose --profile local-llm up
```

**Claude:**

```bash
echo "RUNTIME_PROVIDER=claude" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
docker compose up
```

Copy `.env.example` to `.env` to see every option. There are no paid tiers, no turn
limits, and no metering — it's your machine.

---

## What the world is

The sky is a lid. The world sits at the bottom of a sealed vessel, and to ascend is to
punch a hole in the ceiling and leave.

The Vault charges a toll for that, and the toll is paid downward. When a cultivator
ascends, their remembered life is stripped out and falls back into the world as **ash** —
and that ash is the spiritual energy every other cultivator breathes. To cultivate is to
inhale the discarded lives of strangers.

The toll is collected in instalments. Every time you cross a realm boundary, the Vault
takes something that mattered: a person who knew you stops knowing you, a memory you were
using to stay yourself, a technique you had mastered, sometimes your name. You don't
choose what goes. You're just told.

Which is why the powerful are hollow. Whatever they were climbing for was usually among
the things the climb took.

The full setting bible — the powers, the graves, why you still have to eat, what a spirit
tide actually is — lives in [`context.md`](context.md).

---

## How it plays

Talk to it in plain language. The narrator turns intent into engine actions:

> *"I spend the next three months gathering ash in the low fall."*

becomes `cultivate(duration=90 days)`, and the engine determines the progress, the food
you burned, whether your meridians held, what wandered past, and whether you're now
eligible to break through. Then the narrator describes what actually happened.

Long spans are cheap and deterministic. `"I cultivate for ten years"` resolves in a
single pass and hands back a chronological digest of those ten years — not ten years of
LLM calls.

### What kills you

| Cause | Rule |
|---|---|
| Starvation | Satiety at zero for 5 consecutive turns |
| Untreated injuries | 3+ untreated meridian injuries and you force another fight |
| Settling | 50 years at the same realm without advancing |
| Lifespan | Your realm's ceiling, reached |
| Failed breakthrough | Attempting one poisoned, injured, or at terrible odds |
| Combat | Losing a fight with no exit |

Death is permanent. There is no reload, no save slot, and no continue button. The run
goes into the Death Ledger and you start again with different talent.

---

## Talent

Rolled once at creation, never rerollable, and it decides most of your ceiling.

| Spirit root | Odds | Effect |
|---|---|---|
| Single Metal / Wood / Water / Fire / Earth | 8.1% each | Clean affinity, fast cultivation |
| Water–Fire or Metal–Wood dual | 16.2% each | Conflicting elements; standing qi-deviation risk |
| Five-Element Muddled | 21.6% | All five, none clean. Cultivation crawls. |
| Mutated Lightning / Ice | 2.7% each | Devastating, and almost no manuals exist |

Plus four innate attributes locked at creation: **Might** (1–3), **Insight** (1–4),
**Fortune** (0–3, and it can genuinely be zero), **Charm** (1–3).

The most common draw in the game is the muddled root. That is the real experience of
this world.

---

## Architecture

```text
Player
  │
  ▼
Runtime Agent ──┬── Claude (Anthropic)
  │             ├── Ollama (local)
  │             └── OpenAI / OpenRouter
  ▼
MCP tools
  │
  ▼
Deterministic Game Engine
  │
  ▼
SQLite
```

The runtime agent interprets intent, picks tools, and writes prose. It is **not**
authoritative over stats, cultivation progress, realm changes, breakthroughs, combat,
inventory, health, lifespan, or death — those are resolved by engine code backed by
SQLite, and the agent narrates whatever came back.

Provider choice is configuration, never code (`RUNTIME_PROVIDER=claude|ollama|openai|openrouter`).
The same saved world is playable under any of them; switching narrators never touches
world state.

Every stochastic system draws from the run's seed, so a run is reproducible.

---

## Connecting an MCP client

The compose stack exposes MCP over WebSocket on port **8788**, sharing the same database
as the web GUI. Point Claude Desktop, Claude Code, or any MCP client at it to drive the
same world you're playing in the browser.

To run the server directly over stdio instead:

```bash
npm install && npm run build
node dist/server/index.js --db-path ./cultivation.db
```

---

## Development

```bash
npm install
npm test                                 # full suite
npx vitest run tests/engine/cultivation  # one area
npx tsc --noEmit                         # typecheck
npm run build
```

Contributor and agent guidance lives in [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` is a
symlink to it). The short version: balance constants live in
`src/schema/cultivation.ts` and nowhere else, relative imports carry `.js` extensions,
and no code path may ever let the model become authoritative over state.

### Admin mode

`ADMIN_MODE=true` unlocks an audited `admin_manage` tool surface for exploratory testing.
It lifts **content gates** — it can hand a Qi Condensation cultivator the grave of a
Tribulation Transcender — but it never lets the agent fabricate state. Every admin action
is a real, logged engine mutation, and runs that use it are flagged out of the ledger.

---

## Credits

Forked from [Mnehmos/rpg-mcp](https://github.com/Mnehmos/rpg-mcp), a D&D 5e MCP game
engine. The substrate — dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime — is theirs and is retained; the game-facing surface has been
replaced with cultivation mechanics.

Game design is an amalgamation drawn from across the xianxia genre - its progression
ladders, talent systems and survival pressures - rather than from any single source. The
setting, mechanics, and text here are original.

MIT licensed.
