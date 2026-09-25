<!-- tier: 3 -->

# src

A deterministic xianxia cultivation engine, exposed over MCP and driven by an LLM that
narrates but never decides. Read [`../context.md`](../context.md) first; it is short and
indexes everything.

**The rule that overrides everything: the AI narrates, the engine decides.** Before writing
anything, check which side of that line it falls on - [`AGENTS.md`](../AGENTS.md) has the
table.

---

## Read this before concluding something does not exist

**This tree is organised by what a thing IS, not by who consumes it.** Knowledge is social,
so it is in `engine/social/` and not in `engine/world/` where the consumer lives. Grepping
one directory and reporting an absence is the most expensive mistake available here, because
the next agent builds a second implementation of something that already works.

The vocabulary is the other half of the problem. The repo names things the way the world
does, so search for the CONCEPT under several words:

| you are looking for | the repo calls it | where |
|---|---|---|
| does this NPC know X | `KnowledgeRecord`, `Stance`, `KnowingStage` | [`engine/social/`](./engine/social/README.md) |
| jail, imprisonment, house arrest | a **seal** - `a-qi-seal-is-put-on-a-person.ts` | [`engine/cultivation/`](./engine/cultivation/README.md), [`engine/social/`](./engine/social/README.md) |
| the NPC type | `NpcRecord` - a plain interface, not a Zod schema | [`engine/world/`](./engine/world/README.md) |
| the player's character sheet | `Cultivator` - a Zod schema, a different table | [`schema/`](./schema/README.md) |
| one answer over both of those | `Person`, `everybodyDrawingHere` | [`engine/people/`](./engine/people/README.md) |
| a beast that can talk | `BEAST_CHANGE_ORDINAL`, `reference`, `seeming` | [`data/cultivation/`](./data/cultivation/README.md), [`engine/world/`](./engine/world/README.md) |
| quests, jobs, contracts | duties, and what a house has on its board | [`engine/encounters/`](./engine/encounters/README.md) |
| debts, favours, blackmail, bounties | leverage - what it costs to move a person | [`engine/social-leverage/`](./engine/social-leverage/README.md) |
| marriage, children, dowry | a match, and what a house would take for one | [`engine/household/`](./engine/household/README.md) |
| teleport | a **fold**, priced in `engine/world/`, pathed nowhere yet | [`engine/spatial/`](./engine/spatial/README.md) |
| divine sense, spiritual awareness | attentional capacity | [`engine/perception/`](./engine/perception/README.md) |
| the prompt | two unrelated ones: the player's, and a bound NPC's | [`web/`](./web/README.md), [`agent/prompt/`](./agent/prompt/README.md) |

---

## Every directory, and the question it answers

### The turn

| folder | what question it answers |
|---|---|
| [`web/`](./web/README.md) | **what happens when a player types a sentence.** Phase 1 reads intent, a verb runs, phase 2 narrates. The authority rule as type signatures, and the largest directory here |

### The engine - what is true and what follows

| folder | what question it answers |
|---|---|
| [`engine/`](./engine/README.md) | the architectural constraint over everything below it, and `pubsub.ts` |
| [`engine/birth/`](./engine/birth/README.md) | whose child a run opens as, and what that start is worth |
| [`engine/cultivation/`](./engine/cultivation/README.md) | what a cultivator is and what it costs to become more of one: realms, roots, manuals, injuries, pills, deviation, crossings |
| [`engine/dsl/`](./engine/dsl/README.md) | a small expression language for authored rules |
| [`engine/encounters/`](./engine/encounters/README.md) | what happens TO somebody: arrivals, duties, what a house puts on its board, who it sends out |
| [`engine/household/`](./engine/household/README.md) | matches, children, and what a house would take for one |
| [`engine/people/`](./engine/people/README.md) | one read over the two tables a human being is stored in |
| [`engine/perception/`](./engine/perception/README.md) | what somebody can see from where they are standing, and what they miss |
| [`engine/social/`](./engine/social/README.md) | what people know, believe, suspect and remember - per holder, with a source and a confidence |
| [`engine/social-leverage/`](./engine/social-leverage/README.md) | what it costs to move a person who does not have to do it |
| [`engine/spatial/`](./engine/spatial/README.md) | cheapest path over a costed graph. Retained for folding space; not wired |
| [`engine/world/`](./engine/world/README.md) | what is true of the world right now: who exists, where, holding what, owing whom, and the day clock over all of it |
| [`engine/worldgen/`](./engine/worldgen/README.md) | the ground itself, deterministic from the world seed: height, climate, biome, rivers, lakes |

### The authored world

| folder | what question it answers |
|---|---|
| [`data/`](./data/README.md) | everything authored rather than derived |
| [`data/cultivation/`](./data/cultivation/README.md) | the catalogs: houses, named figures, roads, techniques, pills, herbs, beasts, artifacts, history, what each is worth to whom |
| [`data/cultivation/regions/`](./data/cultivation/regions/README.md) | one file per province, plus the tables that join them |

### The model

| folder | what question it answers |
|---|---|
| [`agent/`](./agent/README.md) | an LLM bound to a character the world holds. **Not the player's turn loop** |
| [`agent/provider/`](./agent/provider/README.md) | which model, over which wire. `LLMProvider` and one file per vendor |
| [`agent/runtime/`](./agent/runtime/README.md) | the invoke loop: preflight gates, circuit breaker, scene scope |
| [`agent/prompt/`](./agent/prompt/README.md) | how a bound character's messages are assembled |
| [`agent/prompt/slices/`](./agent/prompt/slices/README.md) | one file per slice of that prompt |
| [`agent/audit/`](./agent/audit/README.md) | replaying a stored call, dry or live |

### The surface

| folder | what question it answers |
|---|---|
| [`server/`](./server/README.md) | the MCP process: registry, metadata, events, audit |
| [`server/consolidated/`](./server/consolidated/README.md) | every tool a model can call, one file each. The authority boundary |
| [`server/handlers/`](./server/handlers/README.md) | the one pre-consolidation handler module left: rooms, exits, node networks |
| [`server/state/`](./server/state/README.md) | the two singletons that live for the server's lifetime, including the world seed |
| [`server/transport/`](./server/transport/README.md) | how the server is reached: stdio, HTTP, websocket, unix, and the tenant token |
| [`server/utils/`](./server/utils/README.md) | `RichFormatter` - the furniture around every tool's human-readable output |

### Underneath

| folder | what question it answers |
|---|---|
| [`schema/`](./schema/README.md) | the shapes that cross a boundary, and why a model cannot widen what the engine accepts |
| [`storage/`](./storage/README.md) | SQLite as the source of truth: migrations, tenant context, the db handle |
| [`storage/repos/`](./storage/repos/README.md) | one class per table, owning the SQL for it. Nothing above writes SQL |
| [`math/`](./math/README.md) | numeric helpers that know nothing about cultivation |
| [`utils/`](./utils/README.md) | generic helpers. Anything here that learns about cultivation belongs in `engine/` |
| [`services/`](./services/README.md) | cross-cutting services the server uses |

### Entry points

| file | what it is |
|---|---|
| [`index.ts`](./index.ts) | the MCP entry point |
| [`cli.ts`](./cli.ts) | the published binary |
| [`run.ts`](./run.ts) | a run, end to end |

---

## Where else to look

- [`../context.md`](../context.md) - the authority rule and the priority order that resolves
  conflicts between design goals. Short, and it indexes the rest.
- [`../AGENTS.md`](../AGENTS.md) - how to work in this repo. The rules general enough to apply
  anywhere; anything that governs one directory is in that directory's README instead.
- [`../docs/world/README.md`](../docs/world/README.md) - the setting bible, split by topic.
  The prose half of what `data/cultivation/` holds as tables.
- [`../docs/verbs.md`](../docs/verbs.md) - every verb a player can reach, in the player's own
  words.
- [`../tests/`](../tests/) - the tests mirror this tree directory for directory, so the tests
  beside a module are the fastest statement of what it guarantees.
