<!-- tier: 3 -->

# The runtime agent

The loop that hears a player, calls tools, and narrates. It reasons about intent and never decides an outcome - the engine does that.

| file | what it is |
|---|---|
| [`circuit.ts`](./circuit.ts) | Circuit breaker helpers. |
| [`competency.ts`](./competency.ts) | - |
| [`deps.ts`](./deps.ts) | Agent runtime dependency registrar. |
| [`invoke.ts`](./invoke.ts) | Agent invoke runtime. |
| [`preflight.ts`](./preflight.ts) | Preflight gates - decide whether to invoke the LLM at all. |
| [`scope.ts`](./scope.ts) | Scene-scope gate. |
