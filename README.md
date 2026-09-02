# The Cultivation Ladder - a xianxia RPG engine

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)]()
[![MCP](https://img.shields.io/badge/MCP-compatible-green.svg)]()

**A xianxia cultivation roguelike with permanent death, where an LLM narrates and a
deterministic engine decides.**

You play a cultivator climbing the realm ladder from Qi Condensation Layer 1 toward
Tribulation Transcendence. Your talent is rolled once and locked forever. You will
almost certainly die somewhere in the first realm - of starvation, of torn meridians, of
a breakthrough you attempted at 31% because waiting was worse.

The AI writes the prose. It does not decide the outcomes. When the engine says the
breakthrough failed, the story you get is about a breakthrough that failed.

---

## Run it

```bash
npm run play
```

That installs on first run, compiles only if something changed, starts the game and opens
your browser at **http://localhost:8787**. No Docker, no services, no API key.

Out of the box the engine narrates itself and the game is fully playable. To get LLM
prose instead, pick a narrator:

**A local model, nothing leaving your machine** - start Ollama, then:

```bash
echo "RUNTIME_PROVIDER=ollama" >> .env
npm run play
```

**Claude:**

```bash
echo "RUNTIME_PROVIDER=claude" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
npm run play
```

Copy `.env.example` to `.env` to see every option. There are no paid tiers, no turn
limits, and no metering - it is your machine.

### Or with Docker

If you would rather containerise it, `docker compose up` brings up the same GUI plus an
MCP endpoint on 8788 sharing one database, and `docker compose --profile local-llm up`
adds a bundled Ollama.

---

## What the world is

The sky is a lid. The world sits under a ceiling, and to ascend is to punch a hole in it
and leave. Almost nobody does.

Below the lid, everything runs on **qi**. Qi pools in **spiritual veins** the way ore
does, and its density varies enormously from place to place. The great sects are old
because they sit on rich veins, and they sit on rich veins because they are old enough to
have taken them. In a genuinely qi-poor region a cultivator does not merely progress
slowly - they stop, and no amount of talent or discipline manufactures what is not there.

The world is also **late**. Veins that ran rich for a thousand years have been drawn
down, ancient wars killed whole regions outright, and what the old civilisations did not
consume they monopolised and then lost. Most ground is thin because most ground has
already been used. **Spirit stones** - qi compressed until it holds its shape - are money,
fuel, and the only way to cultivate somewhere the ambient qi will not support you.

And advancement has a price. Every time you cross a realm boundary, the crossing demands
that something be cut away: a person who knew you stops knowing you, a memory you were
using to stay yourself, a technique you had mastered, sometimes your name. A cultivator
cannot carry everything they were into what they are becoming. You don't choose what
goes. You're just told.

Which is why the powerful are hollow. Whatever they were climbing for was usually among
the things the climb took.

The full setting bible - the powers, the graves, why you still have to eat, what a spirit
tide actually is - lives in [`docs/world/`](docs/world/), split by topic.
[`context.md`](context.md) is the short entry point and indexes everything else.

---

## How it plays

Talk to it in plain language. The narrator turns intent into engine actions:

> *"I spend the next three months cultivating in the cave I found."*

becomes `cultivate(duration=90 days)`, and the engine determines the progress, the food
you burned, whether your meridians held, what wandered past, and whether you're now
eligible to break through. Then the narrator describes what actually happened.

Long spans are cheap and deterministic. `"I cultivate for ten years"` resolves in a
single pass and hands back a chronological digest of those ten years - not ten years of
LLM calls.

You never have to guess the vocabulary - say what you mean and the engine prices it - but
the set of things it can price is closed and finite. [`docs/verbs.md`](docs/verbs.md) is
that set: every verb, what a player is asking for when they say it, what it costs, and
where it is implemented. It is generated from the action enum itself, so it cannot fall
behind the game.

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
| Water-Fire or Metal-Wood dual | 9.0% each | Conflicting elements; standing qi-deviation risk |
| Metal-Wood-Earth triple | 9.9% | Three in an overcoming chain; only earth arrives clean |
| Metal-Wood-Earth-Water quad | 11.7% | Four ways divided, and the missing fire buys nothing |
| Five-Element Muddled | 14.4% | All five, none clean. Cultivation crawls. |
| Mutated Lightning / Ice | 2.7% each | Devastating, and almost no manuals exist |

Every element after the first is one more mouth on the same intake: speed, matched-art
bonus and breakthrough odds fall the whole way down that table, and commonness rises.

Plus four innate attributes locked at creation: **Might** (1-3), **Insight** (1-4),
**Fortune** (0-3, and it can genuinely be zero), **Charm** (1-3).

Mixed roots - three, four or five elements - are 36% of all draws, and the five-element
muddled root is the single most likely thing to be. That is the real experience of
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
inventory, health, lifespan, or death - those are resolved by engine code backed by
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
`src/schema/cultivation.ts` and nowhere else, ladder bounds live in
`src/engine/cultivation/realms.ts`, relative imports carry `.js` extensions, and no code
path may ever let the model become authoritative over state.

Design docs sit next to the code they govern - each major directory under `src/` carries a
`README.md` stating its contract. Start from [`context.md`](context.md).

### Admin mode

`ADMIN_MODE=true` unlocks an audited `admin_manage` tool surface for exploratory testing.
It lifts **content gates** - it can hand a Qi Condensation cultivator the grave of a
Tribulation Transcender - but it never lets the agent fabricate state. Every admin action
is a real, logged engine mutation, and runs that use it are flagged out of the ledger.

---

## Credits

Forked from [Mnehmos/rpg-mcp](https://github.com/Mnehmos/rpg-mcp), a D&D 5e MCP game
engine. The substrate - dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime - is theirs and is retained; the game-facing surface has been
replaced with cultivation mechanics.

Game design is an amalgamation drawn from across the xianxia genre - its progression
ladders, talent systems and survival pressures - rather than from any single source. The
setting, mechanics, and text here are original.

MIT licensed.
