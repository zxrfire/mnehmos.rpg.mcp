<!-- tier: 3 -->

# Composing an agent's prompt

`compose.ts` assembles a bound character's `ChatMessage[]` out of the slices in
[`slices/`](./slices/README.md), in a fixed order that is part of the contract:

1. `persona` - the authored identity and voice
2. `directive` - authored behavioural instruction
3. `secrets` - what this character knows and the player does not
4. `character_state` - the live sheet, rebuilt every invoke rather than stored
5. `recent` - long-term memory out of `npc_memories`
6. `narrative_feed` - the rolling buffer of curated observations

then the situation as the user message. `systemOverride` and `messagesOverride` are the two
escape hatches, and they replace the assembled system message and the whole array
respectively. Token budget is estimated at roughly four characters to a token - cheap, rough,
and superseded by the provider's exact count in the response.

**A slice is composed, never hand-maintained twice.** Where a slice restates something the
code already owns, the code is the source and the slice reads it.

| file | what it is |
|---|---|
| [`compose.ts`](./compose.ts) | the composer and the slice order |
| [`slices/`](./slices/README.md) | one file per slice |

## Where else to look

- [`../../web/prompt.ts`](../../web/prompt.ts) - **the prompt that runs during play.** The
  player's narrator prompts are in `web/`, not here, and the two share no code. Anybody
  landing in this directory looking for "the prompt" almost certainly wants
  [`../../web/README.md`](../../web/README.md).
- [`../runtime/README.md`](../runtime/README.md) - what calls the composer, and the gates
  (`preflight.ts`, `scope.ts`) that decide whether a model is invoked at all.
- [`../provider/README.md`](../provider/README.md) - `ChatMessage` is defined there, and the
  provider returns the exact token count this file only estimates.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - every slice's material is
  a table: `agent.repo.ts`, `character.repo.ts`, `inventory.repo.ts`,
  `npc-memory.repo.ts`, `scene.repo.ts`.
- [`../../engine/social/README.md`](../../engine/social/README.md) - the `secrets` slice is a
  prompt input; `social/secrets.ts` and `social/knowledge.ts` are what the WORLD holds about
  who knows what. Putting a fact in a prompt does not file it.
