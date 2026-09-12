<!-- tier: 3 -->

# Worldgen

Building a world from a seed: who exists, where they are standing, and what they are holding
on the day a run opens. Everything here is deterministic from the world seed.

The population it produces is a law rather than a preference - see "The population pyramid is
a law, not a preference" in [`AGENTS.md`](../../../AGENTS.md). If a number here looks wrong,
the fix is usually the pyramid, not the draw.

| file | what it is |
|---|---|
| [`biome.ts`](./biome.ts) | Helper to convert 2D coords to 1D index |
| [`climate.ts`](./climate.ts) | Helper to convert 2D coords to 1D index |
| [`heightmap.ts`](./heightmap.ts) | Helper to convert 2D coords to 1D index |
| [`index.ts`](./index.ts) | World Generation Module Integrates heightmap, climate, and biome generation into a unified API. |
| [`lakes.ts`](./lakes.ts) | Lake Generation Module Identifies terrain depressions and fills them with lakes. |
| [`regions.ts`](./regions.ts) | Helper to convert 2D coords to 1D index |
| [`river.ts`](./river.ts) | River Generation Module Generates rivers using flow accumulation algorithm. |
| [`structures.ts`](./structures.ts) | Helper to convert 2D coords to 1D index |
| [`validation.ts`](./validation.ts) | - |

---

## Where else to look

- [`../world/README.md`](../world/README.md) - **who exists is not decided here.**
  `world/seeding.ts` turns the catalogs into a population that is already running when the
  player arrives; this directory decides the ground under them. Two different seeds, two
  different files, and the population is the one people look for here first.
- [`../../data/cultivation/regions/README.md`](../../data/cultivation/regions/README.md) - the
  authored map the generated terrain sits beneath: five provinces, their prefectures and
  arterials, and the names the generated half gets in
  `what-the-people-who-saw-it-call-it.ts`.
- [`../../server/state/README.md`](../../server/state/README.md) - `cultivation-world.ts` owns
  the world seed. A run seed without a world seed does not reproduce anything, and that is the
  usual reason a generated-world test drifts.
- [`../../services/README.md`](../../services/README.md) -
  `generated-world-persistence.service.ts` is what makes a generated world survive a restart.
- [`../dsl/README.md`](../dsl/README.md) - `validation.ts` here is called from the rules DSL,
  which is the only non-server consumer of this directory.
- [`../../schema/README.md`](../../schema/README.md) - `biome.ts`, `tile.ts`, `region.ts`,
  `river.ts` and `structure.ts` are the shapes produced.

