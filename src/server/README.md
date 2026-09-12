<!-- tier: 3 -->

# The MCP server

The process the runtime agent talks to. `index.ts` starts it, the tools it exposes are in
[`consolidated/`](./consolidated/README.md), and `state/` holds the two things that live for
the server's lifetime rather than for a request.

| file | what it is |
|---|---|
| [`audit.ts`](./audit.ts) | - |
| [`consolidated-registry.ts`](./consolidated-registry.ts) | Consolidated Tool Registry for v1.0 Clean-Break Release. |
| [`domain-services.ts`](./domain-services.ts) | Domain service boundary for MCP handlers. |
| [`events.ts`](./events.ts) | Track subscriptions per session |
| [`index.ts`](./index.ts) | RPG-MCP Server - Dynamic Loader Pattern Implementation |
| [`legacy-surface-policy.ts`](./legacy-surface-policy.ts) | Public-surface policy for the pre-consolidation world helpers. |
| [`meta-tools.ts`](./meta-tools.ts) | Meta-Tools for Dynamic Loader Pattern search_tools - Discover tools by keyword, category, or capability load_tool_schema - Load full schema for a specific tool on-demand |
| [`schema-shape.ts`](./schema-shape.ts) | Return the object shape represented by a Zod schema, including intersections. |
| [`terrain-patterns.ts`](./terrain-patterns.ts) | terrain-patterns.ts Procedural terrain pattern generators for consistent geometric layouts Used by generate_terrain_patch and generate_terrain_pattern tools |
| [`tool-metadata.ts`](./tool-metadata.ts) | Tool Metadata Types for Dynamic Loader Pattern Enables search_tools discovery and load_tool_schema on-demand loading |
| [`tools.ts`](./tools.ts) | Global state for the server (in-memory for MVP) |
| [`types.ts`](./types.ts) | - |

---

## Where else to look

- [`./consolidated/README.md`](./consolidated/README.md) - every tool a model can call, one file
  each, and the boundary the authority rule is enforced at.
- [`./state/README.md`](./state/README.md) - the two module singletons, including the world
  seed. They die on redeploy and cannot be shared across replicas, which is the constraint on
  ever running more than one of these.
- [`./transport/README.md`](./transport/README.md) - how the process is reached, and
  `tenant-token.ts`, whose other half is `storage/tenant-context.ts`.
- [`./handlers/README.md`](./handlers/README.md) - the one pre-consolidation handler module
  left. New tools do not go there.
- [`./utils/README.md`](./utils/README.md) - `RichFormatter`, which roughly eighteen tool
  modules print through.
- [`../storage/README.md`](../storage/README.md) - SQLite is the source of truth, and
  `getDb()` is what nearly every tool starts with.
- [`../web/README.md`](../web/README.md) - **the other front door.** `web/server.ts` serves the
  played game over HTTP and does not go through this MCP surface. Two servers, one engine, and
  a change meant for players usually belongs there.
- [`../agent/README.md`](../agent/README.md) - the bound-character runtime that
  `agent-manage.ts` and `combat-manage.ts` reach into.

