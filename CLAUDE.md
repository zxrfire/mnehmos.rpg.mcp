# CLAUDE.md — Claude Code Instructions

**Read [`AGENTS.md`](AGENTS.md) first — it is the canonical working agreement.**
This file holds only the Claude Code–specific additions. If the two ever disagree,
`AGENTS.md` wins; fix the drift by editing `AGENTS.md`.

For what this project is and why, read [`context.md`](context.md).

---

## The short version

A **deterministic xianxia cultivation RPG engine** over MCP. Forked from a D&D 5e engine
and being transformed: levels → a 45-rank realm ladder, classes → spirit roots, spells →
techniques, gold → spirit stones, death → **permanent**.

**The rule that overrides everything: the AI narrates, the engine decides.** You are the
runtime agent. You interpret intent, pick tools, and write prose. You are *not*
authoritative over stats, progress, breakthroughs, combat, inventory, health, lifespan,
or death — those come back from tool calls, and you narrate whatever the engine actually
returned, including when it is bad news.

Never describe an outcome you did not get from a tool result.

---

## Shell

Use **PowerShell** for git and npm. The `bash` note in older revisions of this file was
wrong about the Bash tool being unusable, but PowerShell remains the reliable path for
npm scripts on this machine.

## Testing

Prefer a single area over the full suite while iterating — the full run is slow:

```bash
npx vitest run tests/engine/cultivation
```

Full suite before you call something done:

```bash
npm test
```

## The Git Pulse Rule

After a successful test pass, immediately commit. Do **not** ask permission for local
commits — just save the state.

```bash
git add . && git commit -m "type(scope): message"
```

`origin` is the fork `zxrfire/mnehmos.rpg.mcp`; `upstream` is `Mnehmos/mnehmos.rpg.mcp`
and is fetch-only. Work happens on `feat/xianxia-cultivation`.

## Running the game

```bash
docker compose up
```

Brings up the engine and the web GUI together. No API key is required to play with a
local Ollama model; set `ANTHROPIC_API_KEY` to use Claude as the narrator instead.

## When you are asked to change balance

Balance constants live in `src/schema/cultivation.ts` (satiety cost, starvation turns,
lethal injury count, stagnation years, starting spirit stones). Change them there and
nowhere else — the engine and the tests both read from that one source.
