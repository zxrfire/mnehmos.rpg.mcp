<!-- tier: 3 -->

# Server-lifetime state

Two module singletons. They die on redeploy and cannot be shared across replicas. That is
the constraint on ever running more than one of these, and it is stated here rather than in
a plan document because it is a fact about this code and not about a migration.

`cultivation-world.ts` is the one to read first: it owns the WORLD seed, which is the other
half of a reproducible run. A run seed alone does not fix the world, and a test that pins one
without the other is pinning a coincidence.

| file | what it is |
|---|---|
| [`cultivation-world.ts`](./cultivation-world.ts) | The world the runs happen inside. |
| [`world-manager.ts`](./world-manager.ts) | Singleton for server lifetime |

---

## Where else to look

- [`../../engine/worldgen/README.md`](../../engine/worldgen/README.md) - what the world seed
  drives: height, climate, biome, rivers, lakes, all deterministic from it.
- [`../../engine/world/README.md`](../../engine/world/README.md) - the other half of a world:
  `seeding.ts` draws the population, and `world-state.ts` is what a tool actually reads.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - `world.repo.ts`,
  `world-state.repo.ts` and `world-snapshot.repo.ts` are what survives the singletons dying.
- [`../consolidated/README.md`](../consolidated/README.md) - every reader. A tool that
  re-derives the world instead of taking it from here will disagree with every other tool in
  the same process.
- [`../../web/README.md`](../../web/README.md) - `web/which-mode-this-session-is-playing-in.ts`
  is the played game's version of the same question, and a test that pins a run seed without
  pinning the world seed is pinning a coincidence.

