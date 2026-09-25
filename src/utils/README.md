<!-- tier: 3 -->

# Utilities

Generic helpers. If something here starts knowing about cultivation, it belongs in `src/engine/`.

| file | what it is |
|---|---|
| [`a-count-agrees-with-what-it-counts.ts`](./a-count-agrees-with-what-it-counts.ts) | A count and the noun behind it, agreeing, where the noun arrived at runtime from a catalog or a house's own rank list. `3 core disciple` was the defect. Knows that the head of `Keeper of Scrolls` is in front of the preposition, that a Witness is one person, and that a house whose rank is `Chosen` does not have three Chosens. |
| [`action-router.ts`](./action-router.ts) | Action Router - Generic routing for consolidated MCP tools TIER 1 Token Efficiency Optimization Provides a generic framework for routing action-based tools: - Parses action parameter with fuzzy matching - Routes to appropriate handler based on action - Handles common patterns (CRUD, domain-specific) - Provides consistent response formatting Usage:   const router = createActionRouter(ACTIONS, commonSchema, handlers);   const result = await router(args); |
| [`fuzzy-enum.ts`](./fuzzy-enum.ts) | Fuzzy Enum Matching Utilities TIER 1 Token Efficiency Optimization Provides 3-tier fuzzy matching for action enums: 1. |

---

## Where else to look

- [`../server/consolidated/README.md`](../server/consolidated/README.md) - what
  `action-router.ts` and `fuzzy-enum.ts` exist for: routing an `action` parameter across
  consolidated tools, and matching it when a model spells it loosely. `SessionContext` comes
  from `../server/types.ts`, which is the one thing in here that is not generic.
- [`../web/README.md`](../web/README.md) - `a-count-agrees-with-what-it-counts.ts` is used in
  played prose, and it is where `3 core disciple` was fixed. Anything about how a printed
  sentence reads belongs there; only the agreement arithmetic belongs here.
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - the boundary of this
  directory. A helper that learns what a rung, a house or a rank is has stopped being generic.
- [`../math/README.md`](../math/README.md) - the same rule for numbers.
- [`../server/utils/README.md`](../server/utils/README.md) - `RichFormatter` is the server's
  output furniture, which is a different job from anything here.

