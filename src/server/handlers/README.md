<!-- tier: 3 -->

# Tool handlers

The one surviving handler module from the era before tools were consolidated. Everything else
that was here now lives as one file per tool in [`../consolidated/`](../consolidated/README.md);
this directory holds `spatial-handlers.ts`, whose nine handlers are re-exported by
`consolidated/spatial-manage.ts` and reached only through it.

**This is the room-and-exit graph, not the province map.** It thinks in `RoomNode`, `Exit` and
`NodeNetwork` - a place broken into rooms you move between - and it is retained from the D&D
substrate. The ground a cultivator actually stands on is a named place in a province, and
that is a different model entirely.

| handler | what it answers |
|---|---|
| `handleLookAtSurroundings` | what is visible from where somebody is standing, light included |
| `handleGenerateRoomNode`, `handleUpdateRoomNode`, `handleListRooms` | rooms |
| `handleGetRoomExits`, `handleMoveCharacterToRoom` | edges, and walking one |
| `handleCreateNodeNetwork`, `handleGetNodeNetwork`, `handleListNodeNetworks` | a whole graph |

**Do not add a new handler here.** A new tool is a file in `consolidated/`.

## Where else to look

- [`../consolidated/README.md`](../consolidated/README.md) - the boundary these are exposed at.
  `spatial-manage.ts` is the only caller, and it is where argument validation happens.
- [`../../engine/spatial/README.md`](../../engine/spatial/README.md) - the A* and the min-heap,
  which this file does **not** call. Pathing here is exit-to-exit; the algorithm there is
  waiting on the fold path.
- [`../../engine/world/README.md`](../../engine/world/README.md) - where the cultivation world
  keeps ground instead: `locations.ts`, `the-ground-somebody-is-actually-standing-on.ts`,
  `what-is-built-on-this-ground.ts`, `architecture.ts`. If you want "where is this person",
  that is the model, not `RoomNode`.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - `spatial.repo.ts` owns
  every table under this, and `character.repo.ts` holds the row a move updates.
- [`../../schema/README.md`](../../schema/README.md) - `spatial.ts` defines `RoomNode`, `Exit`
  and `NodeNetwork`, and also exports `BiomeType` and `Atmospheric`, which the social hearing
  mechanics read.
- [`../../services/README.md`](../../services/README.md) - `light-source.service.ts` is the
  light model this file's `LightEffectRow` parsing shadows; the service itself is called from
  `consolidated/inventory-manage.ts`.
