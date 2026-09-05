<!-- tier: 3 -->

# The schemas

Zod schemas and the types derived from them. These are the shapes that cross a boundary -
into the database, out to a tool, or back from a model - and they are the reason a model
cannot widen what the engine accepts.

`cultivation.ts` is the big one and carries the setting's own vocabulary: realms, roots,
injuries, obligations, and the closed enums the engine branches on.

A field comment here is often the ONLY statement of a unit, a range, or whether absent means
zero or means unknown. That is why this folder reads high on the comment-ratio check and
should: see [the declaration-list note](../../docs/comment-cleanup-rules.md).

| file | what it is |
|---|---|
| [`agent.ts`](./agent.ts) | AGENT - LLM-driven character bindings |
| [`audit.ts`](./audit.ts) | - |
| [`base-schemas.ts`](./base-schemas.ts) | Reusable Zod field patterns, spread or referenced by the other schema modules so a validation rule changes in one place. |
| [`biome.ts`](./biome.ts) | - |
| [`character.ts`](./character.ts) | The identity row for NPCs the agent runtime drives, the social layer overhears and the perception subsystem meters. |
| [`concentration.ts`](./concentration.ts) | Held attention: an effect somebody is actively sustaining. |
| [`corpse.ts`](./corpse.ts) | Corpse decay rules (in game hours) |
| [`cultivation.ts`](./cultivation.ts) | Cultivation domain schemas: the cultivator record, the survival layer, the technique and alchemy systems, sects, and the permadeath run ledger. |
| [`diplomacy.ts`](./diplomacy.ts) | - |
| [`encounter.ts`](./encounter.ts) | CRIT-003: Position schema for spatial combat |
| [`improvisation.ts`](./improvisation.ts) | IMPROVISATION SYSTEMS SCHEMAS Defines Zod schemas for: - Rule of Cool (Improvised Stunts) - Custom Effects System (Divine Boons, Curses, Transformations) - Arcane Synthesis (Dynamic Spell Creation) |
| [`index.ts`](./index.ts) | Schema exports |
| [`inventory.ts`](./inventory.ts) | Constants for inventory system limits |
| [`nation.ts`](./nation.ts) | - |
| [`party.ts`](./party.ts) | Party status enum |
| [`patch.ts`](./patch.ts) | - |
| [`perception.ts`](./perception.ts) | Constraint-Perception subsystem schemas: the Hierarchy-of-Controls model as a queryable primitive. |
| [`quest.ts`](./quest.ts) | - |
| [`region.ts`](./region.ts) | - |
| [`river.ts`](./river.ts) | - |
| [`secret.ts`](./secret.ts) | - |
| [`spatial.ts`](./spatial.ts) | PHASE-2: Export BiomeType and Atmospheric for social hearing mechanics |
| [`structure.ts`](./structure.ts) | - |
| [`tile.ts`](./tile.ts) | - |
| [`turn-state.ts`](./turn-state.ts) | Action schema for batch submission |
| [`world.ts`](./world.ts) | - |
