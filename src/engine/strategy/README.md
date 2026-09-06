<!-- tier: 3 -->

# Strategy

Faction-scale decision making.

Retained from the D&D substrate and **kept for war between houses**. The
cultivation side has the politics and not the machinery: `sect-politics.ts`,
`governance-and-water-rights.ts`, `war-melee.ts` and the vassalage field all
exist, and what is missing is the layer that decides what a house DOES about
another house over time.

The readings are close to one-for-one, which is why this is worth keeping rather
than rewriting:

- `FogOfWar` is what one house knows about another. That is the knowledge gate
  at faction scale, and the world already tracks per-holder awareness of sects.
- `DiplomacyEngine` is alliance, tribute and vassalage between houses.
- `ConflictResolver` is what happens when two of them want the same ground,
  which is the water-rights question the governance file already poses.
- `NationManager` is a house as a body with holdings and a reach.
- `TurnProcessor` is the world moving on its own between a player's turns.

Nothing here is wired to the cultivation world yet. It reaches the tool surface
through `turn_manage` and no further.

| file | what it is |
|---|---|
| [`conflict-resolver.ts`](./conflict-resolver.ts) | - |
| [`diplomacy-engine.ts`](./diplomacy-engine.ts) | - |
| [`fog-of-war.ts`](./fog-of-war.ts) | - |
| [`nation-manager.ts`](./nation-manager.ts) | - |
| [`turn-processor.ts`](./turn-processor.ts) | - |
