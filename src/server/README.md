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
