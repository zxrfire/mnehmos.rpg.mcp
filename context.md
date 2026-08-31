# Context — What This Repository Is

## Purpose

A **deterministic cultivation (xianxia) RPG engine** exposed over MCP, designed to be
driven by an LLM runtime agent that narrates but never decides.

This repo was forked from a D&D 5e MCP game engine and is being transformed into a
cultivation game in the spirit of the xianxia genre: a
text-first cultivation roguelike with permanent death, a 45-rank realm ladder, fixed
innate talent, and a survival layer (satiety, meridian injuries, lifespan, qi
deviation) that makes most runs end badly.

The D&D *substrate* — dice, SQLite persistence, action-routed MCP tools, spatial grid,
worldgen, NPC agent runtime — is sound engineering and is retained. What is replaced is
the entire game-facing surface:

| D&D concept | Cultivation replacement |
|---|---|
| Character level 1–20 | Realm ordinal 0–44 (45 ranks) |
| Class | Spirit root (rolled once, permanent) |
| Ability scores (STR/DEX/CON/INT/WIS/CHA) | Innate attributes: Might, Insight, Fortune, Charm |
| Spells / spell slots | Techniques (arts) / qi pool |
| Gold, silver, copper | Spirit stones |
| XP | Cultivation progress |
| Long rest | Seclusion / meditation |
| Death saves, revival | **Permanent death** — no reload, run is over |

## The Central Design Rule

> **The AI narrates. The engine decides.**

This is not a stylistic preference; it is the architecture. The runtime agent has no
write access to game state except through MCP tools, and every tool call is validated
and resolved by deterministic code backed by SQLite.

### The runtime agent IS responsible for

- Interpreting the player's natural-language intent
- Selecting appropriate game actions/tools
- Interacting with NPCs through the game systems
- Deciding how an NPC behaves **when an LLM decision is genuinely required**
- Generating dialogue and narrative description
- Presenting world events to the player
- Summarizing relevant world state
- Maintaining the conversational experience

### The runtime agent is NOT authoritative over

Character statistics · cultivation progress · realm changes · breakthrough outcomes ·
combat results · inventory · currency · health · lifespan · death · NPC statistics ·
world-state mutations · probability calculations · event resolution.

All of the above are handled by deterministic game systems. The agent must never
*claim* an outcome occurred without the corresponding engine state change having
actually happened. If the engine says the breakthrough failed and three meridians tore,
the agent's job is to describe that — not to soften it.

## Runtime Agent Architecture

```text
Player
  │
  ▼
Runtime Agent
  │
  ├── Claude   (primary/default)
  └── Ollama   (local/self-hosted)
       │
       ▼
    MCP tools
       │
       ▼
 Deterministic Game Engine
       │
       ▼
     SQLite
```

### Provider abstraction

Providers live behind a single interface (`src/agent/provider/types.ts`) and are
selected by configuration, never by engine code:

```text
runtime_provider = claude
```

or

```text
runtime_provider = ollama
ollama_model = <model>
```

Constraints this must satisfy:

- **No provider-specific logic in the game engine.** Claude-specific and Ollama-specific
  code stays behind the provider interface.
- **The same saved world is playable under either provider.** A player can switch from
  Claude to Ollama without changing or resetting the world.
- **Game state, MCP tools, simulation engine and persistence are identical** across
  providers. Only prose style differs.
- Claude is integrated through the Claude API / agent interface — the engine does not
  assume a human is manually operating Claude Code.

## High-Level Tool Contract

The agent talks to the engine in coarse, intent-level verbs, not micro-operations.

Player: *"I spend the next three months cultivating."*

Agent:

```text
cultivate(duration=90 days)
```

The engine then determines cultivation progress, resource consumption, breakthrough
eligibility, breakthrough success or failure, injuries, tribulation, NPC and world
changes, and random opportunities. The agent narrates the result it is handed.

## Long-Term Simulation

The agent must **not** be required to simulate time day by day. `"I cultivate for ten
years"` is resolved by the deterministic simulation in one pass, cheaply. The engine
advances time, resolves scheduled and stochastic events, and invokes the agent only
where a meaningful decision or a narratable event occurs.

The player must be able to return after those ten years and receive a coherent account
of what happened — so the time-skip produces an **event digest**, not just a new date.

## NPC Simulation Policy

Routine NPC behaviour is deterministic and cheap. LLM calls are reserved for decisions
where personality, goals, relationships, uncertainty, or genuinely complex circumstances
make reasoning useful.

| Deterministic (no LLM) | LLM-worthy |
|---|---|
| Walking to work, daily schedules | Betrayal / loyalty decisions |
| Routine cultivation ticks | Negotiating under conflicting goals |
| Ordinary trading | Reacting to a grudge or debt |
| Aging, resource consumption | Novel or ambiguous situations |

## Deployment

Self-hosted, single-user, no paid tiers, no turn limits, no metering. One command
brings up the GUI and all backend services.
