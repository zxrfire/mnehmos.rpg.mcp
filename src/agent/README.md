<!-- tier: 3 -->

# `src/agent` - an LLM bound to a character

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected into a
> narration prompt.

**This is not the player's turn loop.** The player's sentence is read, routed and narrated
in [`../web/`](../web/README.md); the two phases there talk to a model directly and borrow
nothing from this directory except the provider interface. What lives here is the other
thing: **a character the world holds, driven by a model of its own**, reachable only through
the `agent_manage` and `combat-manage` tools. If you are looking for how a turn is taken,
you are in the wrong directory - and that confusion is the reason this file exists.

| folder | what it answers |
|---|---|
| [`provider/`](./provider/README.md) | which model, over which wire. `LLMProvider`, `ProviderFactory`, and one file per vendor |
| [`runtime/`](./runtime/README.md) | the invoke loop: preflight gates, the circuit breaker, scene scope, and the dependency registrar |
| [`prompt/`](./prompt/README.md) | how that invocation's messages are assembled, in a fixed slice order |
| [`audit/`](./audit/README.md) | replaying a stored call, dry or live, without taking a turn |

The binding itself - which character an agent is, what it may be told, what it is allowed to
remember - is a row: `schema/agent.ts` for the shape, `agent.repo.ts` for the table.

## Where else to look

- [`../web/README.md`](../web/README.md) - the player's two-phase turn: sentence in, verb out,
  engine, prose out. `web/prompt.ts` and `web/narrator.ts` are the prompts that actually run
  during play, and they have nothing to do with `prompt/compose.ts` here.
- [`../server/consolidated/README.md`](../server/consolidated/README.md) - the only way in.
  `agent-manage.ts` and `combat-manage.ts` call `invokeAgent`; nothing else in the repo does.
- [`../storage/repos/README.md`](../storage/repos/README.md) - where an agent's material comes
  from: `agent.repo.ts` (the binding), `npc-memory.repo.ts` (what it recalls),
  `scene.repo.ts` (what it can see), `character.repo.ts` (its sheet).
- [`../schema/README.md`](../schema/README.md) - `agent.ts` is the binding contract and
  `audit.ts` the stored-call shape. Note that a world NPC is **not** a schema type: that is
  `NpcRecord` in `../engine/world/npc-state.ts`.
- [`../engine/social/README.md`](../engine/social/README.md) - what a character KNOWS is not
  the agent's prompt. It is `KnowledgeRecord` per holder, with a `Stance` of
  `knows`/`believes`/`suspects`/`ignorant`. A secret handed to a slice and a secret the world
  records are two different facts and only one of them survives the turn.
