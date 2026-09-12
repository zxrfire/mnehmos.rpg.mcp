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

---

## Where else to look

- [`../provider/README.md`](../provider/README.md) - the wire. `LLMProvider`, `ProviderFactory`
  and one file per vendor, plus `reasoning.ts`.
- [`../prompt/README.md`](../prompt/README.md) - what `invoke.ts` sends: slices assembled in a
  fixed order, with `systemOverride` and `messagesOverride` as the two escape hatches.
- [`../audit/README.md`](../audit/README.md) - the deliberate bypass. A replay skips
  `preflight.ts`, `circuit.ts`, the journal append and the `event_inbox` emission, because a
  replay is an audit action and not a turn.
- [`../../server/consolidated/README.md`](../../server/consolidated/README.md) - the only
  callers of `invokeAgent` in the repo: `agent-manage.ts` and `combat-manage.ts`.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - `agent.repo.ts` (the
  binding), `npc-memory.repo.ts` (what it recalls), `scene.repo.ts` (what it can see),
  `event-inbox.repo.ts` (what it emits).
- [`../../web/README.md`](../../web/README.md) - **the player's turn does not come through
  here.** `web/turn-engine.ts` is the loop that runs during play; this one drives a character
  the world holds.

