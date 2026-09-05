<!-- tier: 3 -->

# src

A deterministic xianxia cultivation engine, exposed over MCP and driven by an LLM that
narrates but never decides. Read [`../context.md`](../context.md) first; it is short and
indexes everything.

| folder | what it is |
|---|---|
| [`web/`](./web/README.md) | the front door: sentence in, verb out, engine, prose out. The authority rule as type signatures |
| [`engine/`](./engine/README.md) | what is true and what follows. Cultivation, the world, the social layers |
| [`data/`](./data/cultivation/README.md) | the catalogs: sects, people, places, techniques, beasts, artifacts |
| [`server/`](./server/README.md) | the MCP surface the runtime agent calls |
| [`schema/`](./schema/README.md) | the shapes that cross a boundary |
| [`storage/`](./storage/README.md) | SQLite, migrations and one repository per table |
| [`agent/`](./agent/provider/README.md) | providers and the runtime loop |
| [`math/`](./math/README.md), [`utils/`](./utils/README.md), [`services/`](./services/README.md) | helpers with no game knowledge in them |

**The rule that overrides everything: the AI narrates, the engine decides.** Before writing
anything, check which side of that line it falls on -
[`AGENTS.md`](../AGENTS.md) has the table.

| file | what it is |
|---|---|
| [`index.ts`](./index.ts) | the MCP entry point |
| [`cli.ts`](./cli.ts) | the published binary |
| [`run.ts`](./run.ts) | a run, end to end |
