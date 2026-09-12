<!-- tier: 3 -->

# Prompt slices

The pieces the runtime agent's prompt is assembled from. A slice is composed, never hand-maintained twice; where a slice restates something the code owns, the code is the source.

| file | what it is |
|---|---|
| [`character_state.ts`](./character_state.ts) | Character state slice - the live sheet, auto-built every invoke. |
| [`directive.ts`](./directive.ts) | Directive slice - DM-authored behavioral instructions for this campaign. |
| [`narrative_feed.ts`](./narrative_feed.ts) | Narrative feed slice - DM-curated rolling buffer of observations. |
| [`persona.ts`](./persona.ts) | Persona slice - the DM-authored identity / voice of the character. |
| [`recent.ts`](./recent.ts) | Recent memory slice - long-term npc_memories for this character. |
| [`scene.ts`](./scene.ts) | Scene slice - current DM-committed scene for this character. |
| [`secrets.ts`](./secrets.ts) | Secrets slice - agent-private knowledge. |

---

## Where else to look

- [`../README.md`](../README.md) - the composer and the fixed slice order these are assembled
  in, plus the token-budget estimate and the two override hatches.
- [`../../../storage/repos/README.md`](../../../storage/repos/README.md) - every slice is a
  table read: `agent.repo.ts`, `character.repo.ts`, `inventory.repo.ts`,
  `npc-memory.repo.ts`, `scene.repo.ts`.
- [`../../../schema/README.md`](../../../schema/README.md) - `agent.ts` is the binding shape
  and `character.ts` the sheet `character_state` is built from.
- [`../../../engine/social/README.md`](../../../engine/social/README.md) - the `secrets` slice
  is prompt text; `social/secrets.ts` and `social/knowledge.ts` are what the world records
  about who knows what. Handing a fact to a model does not file it.
- [`../../../web/prompt.ts`](../../../web/prompt.ts) - the prompts that actually run during
  play, which share no code with these slices.

