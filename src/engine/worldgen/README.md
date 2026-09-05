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
