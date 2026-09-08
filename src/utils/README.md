<!-- tier: 3 -->

# Utilities

Generic helpers. If something here starts knowing about cultivation, it belongs in `src/engine/`.

| file | what it is |
|---|---|
| [`a-count-agrees-with-what-it-counts.ts`](./a-count-agrees-with-what-it-counts.ts) | A count and the noun behind it, agreeing, where the noun arrived at runtime from a catalog or a house's own rank list. `3 core disciple` was the defect. Knows that the head of `Keeper of Names` is in front of the preposition, that a Witness is one person, and that a house whose rank is `Chosen` does not have three Chosens. |
| [`action-router.ts`](./action-router.ts) | Action Router - Generic routing for consolidated MCP tools TIER 1 Token Efficiency Optimization Provides a generic framework for routing action-based tools: - Parses action parameter with fuzzy matching - Routes to appropriate handler based on action - Handles common patterns (CRUD, domain-specific) - Provides consistent response formatting Usage:   const router = createActionRouter(ACTIONS, commonSchema, handlers);   const result = await router(args); |
| [`fuzzy-enum.ts`](./fuzzy-enum.ts) | Fuzzy Enum Matching Utilities TIER 1 Token Efficiency Optimization Provides 3-tier fuzzy matching for action enums: 1. |
