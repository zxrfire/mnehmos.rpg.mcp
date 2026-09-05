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
