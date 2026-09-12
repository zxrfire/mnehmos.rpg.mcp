<!-- tier: 3 -->

# Replaying a stored call

One file. `replay.ts` takes a stored `agent_calls` row and re-surfaces it - **dry** by
default (no model round-trip at all, which is what makes it useful for catching
schema-migration regressions), or **live** when a model is named, re-issuing the stored
`messages[]` and returning original and replay side by side with a text diff.

**Live mode deliberately bypasses `invokeAgent`.** No preflight, no circuit breaker, no
journal append, no `event_inbox` emission. A replay is an audit action somebody took, not a
turn the character took, and nothing downstream should be able to mistake one for the other.

| file | what it is |
|---|---|
| [`replay.ts`](./replay.ts) | dry and live replay of a stored LLM call |

## Where else to look

- [`../runtime/README.md`](../runtime/README.md) - the loop being bypassed. `invoke.ts`,
  `preflight.ts` and `circuit.ts` are the three things live mode skips, and
  `deps.ts` (`AgentRuntimeDeps`) is what this file takes instead.
- [`../provider/README.md`](../provider/README.md) - `ChatMessage` and `ProviderError`; live
  mode issues a direct provider call rather than going through the runtime.
- [`../../storage/README.md`](../../storage/README.md) - `audit.repo.ts` and the rows this
  reads. The stored call is the only record of what a model was actually asked.
- [`../../server/audit.ts`](../../server/audit.ts) - the server-side audit trail, which is a
  different log: what a TOOL did, not what a model was sent.
- [`../../server/consolidated/README.md`](../../server/consolidated/README.md) - `agent-manage.ts`
  is where a replay is triggered from.
