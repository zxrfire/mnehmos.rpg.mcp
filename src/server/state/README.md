<!-- tier: 3 -->

# Server-lifetime state

Two module singletons. They die on redeploy and cannot be shared across replicas, which is
the constraint [`docs/CLOUD-MIGRATION-PLAN.md`](../../../docs/CLOUD-MIGRATION-PLAN.md) is
about.

`cultivation-world.ts` is the one to read first: it owns the WORLD seed, which is the other
half of a reproducible run. A run seed alone does not fix the world, and a test that pins one
without the other is pinning a coincidence.

| file | what it is |
|---|---|
| [`cultivation-world.ts`](./cultivation-world.ts) | The world the runs happen inside. |
| [`world-manager.ts`](./world-manager.ts) | Singleton for server lifetime |
