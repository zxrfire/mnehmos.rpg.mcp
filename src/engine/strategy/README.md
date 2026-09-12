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

---

## Where else to look

- [`../world/README.md`](../world/README.md) - the cultivation side of war, which is written
  and wired: `war-melee.ts`, `war-spoils.ts`,
  `what-a-year-of-war-does-to-a-compound.ts`,
  `what-a-house-is-made-of-and-what-brings-it-down.ts`. Anybody looking for how fighting
  between houses actually resolves wants those, not `ConflictResolver`.
- [`../../data/cultivation/README.md`](../../data/cultivation/README.md) - the politics with no
  machinery under it: `faction-relationships.ts`, `faction-history.ts`,
  `governance-and-water-rights.ts`, `what-two-houses-both-have-a-hand-on.ts`. That is the
  content this directory would have to decide over.
- [`../social/README.md`](../social/README.md) - `FogOfWar` is a house-scale version of
  something the world already has per person: `KnowledgeRecord` with a `Stance`, and the
  `KnowingStage` ladder. Wiring the strategy layer means reconciling those two, not adding a
  second awareness model.
- [`../../schema/README.md`](../../schema/README.md) - `nation.ts` and `diplomacy.ts` are the
  shapes here, and they still speak the substrate's vocabulary rather than the world's.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - `nation.repo.ts`,
  `diplomacy.repo.ts` and `sect.repo.ts`. The last one is the cultivation table; the first two
  are the retained ones.
- [`../../server/consolidated/README.md`](../../server/consolidated/README.md) - `turn_manage`
  is the whole of this directory's reach. Nothing in `web/` touches it.

