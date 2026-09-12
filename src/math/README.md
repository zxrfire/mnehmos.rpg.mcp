<!-- tier: 3 -->

# Numbers

Small numeric helpers with no game knowledge in them. Nothing here knows what a realm is.

| file | what it is |
|---|---|
| [`algebra.ts`](./algebra.ts) | - |
| [`dice.ts`](./dice.ts) | - |
| [`export.ts`](./export.ts) | - |
| [`physics.ts`](./physics.ts) | - |
| [`probability.ts`](./probability.ts) | - |
| [`schemas.ts`](./schemas.ts) | Phase 1.1: DiceExpression schema |

---

## Where else to look

- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - **the game's
  randomness is not here.** `cultivation/rng.ts` is the seeded generator every outcome runs
  through, and determinism from a seed is a property of that file, not of `dice.ts`.
- [`../schema/README.md`](../schema/README.md) - `DiceExpression` and the other numeric shapes
  that cross a boundary; `schemas.ts` beside this file is the local half of the same idea.
- [`../server/consolidated/README.md`](../server/consolidated/README.md) - `math-manage.ts` is
  the only tool over this directory, and the only reason `export.ts` exists.
- [`../engine/spatial/README.md`](../engine/spatial/README.md) - `heap.ts` there is a numeric
  helper that stayed with its algorithm rather than moving here, which is the right call and
  worth knowing before you go looking for a priority queue.
- [`../utils/README.md`](../utils/README.md) - the other directory with no game knowledge in
  it. If something here starts knowing what a realm is, it belongs in `engine/`.

