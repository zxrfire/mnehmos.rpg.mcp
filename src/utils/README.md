<!-- tier: 3 -->

# Utilities

Generic helpers. If something here starts knowing about cultivation, it belongs in `src/engine/`.

| file | what it is |
|---|---|
| [`action-router.ts`](./action-router.ts) | Action Router - Generic routing for consolidated MCP tools TIER 1 Token Efficiency Optimization Provides a generic framework for routing action-based tools: - Parses action parameter with fuzzy matching - Routes to appropriate handler based on action - Handles common patterns (CRUD, domain-specific) - Provides consistent response formatting Usage:   const router = createActionRouter(ACTIONS, commonSchema, handlers);   const result = await router(args); |
| [`fuzzy-enum.ts`](./fuzzy-enum.ts) | Fuzzy Enum Matching Utilities TIER 1 Token Efficiency Optimization Provides 3-tier fuzzy matching for action enums: 1. |
| [`schema-shorthand.ts`](./schema-shorthand.ts) | Schema Shorthand Utilities TIER 2 Token Efficiency Optimization Provides parsing utilities for common input formats that reduce token overhead: - Position: "10,5" or "10,5,0" -> { x: 10, y: 5, z: 0 } - Damage: "2d6+3 fire" -> { dice: "2d6", modifier: 3, type: "fire" } - Duration: "7d" / "3h" / "10r" -> { value: 7, unit: "days", rounds: 6720 } - Range: "30/120" -> { normal: 30, long: 120 } - Area: "20ft cone" -> { size: 20, shape: "cone" } |
