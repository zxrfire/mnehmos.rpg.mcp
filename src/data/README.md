<!-- tier: 3 -->

# `src/data` - the authored world

Everything authored rather than derived. One subtree today:

| folder | what it answers |
|---|---|
| [`cultivation/`](./cultivation/README.md) | the catalogs - houses, people, places, roads, techniques, pills, herbs, beasts, artifacts, history, and what each of those is worth to whom |
| [`cultivation/regions/`](./cultivation/regions/README.md) | one file per province of the map, plus the tables that join them |

**Nothing here decides anything.** A catalog is a table of facts the engine reads; the
arithmetic over it lives in [`../engine/`](../engine/README.md). If a file in here starts
computing an outcome, it is in the wrong directory.

**And nothing here invents a name at runtime.** A place is identified by its display string,
so the name is the key - which is why names are consts in `cultivation/place-names.ts` and
never retyped.

## Where else to look

- [`./cultivation/README.md`](./cultivation/README.md) - start here. It opens by pointing at
  the setting bible's index, which lists every file below it against the design question that
  file settles.
- [`../../docs/world/README.md`](../../docs/world/README.md) - the prose side of the same
  world. The catalogs are the machine-readable half; the bible is the half a narrator reads.
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - the arithmetic these
  tables feed: realms, grades, prices, what a crossing costs.
- [`../engine/world/README.md`](../engine/world/README.md) - what the catalog becomes once a
  world is running. `seeding.ts` turns these rows into people standing somewhere, and from
  then on the world state, not the catalog, is what is true.
- [`../engine/worldgen/README.md`](../engine/worldgen/README.md) - the generated half of the
  map (height, climate, biome, rivers) that the authored provinces sit on top of.
