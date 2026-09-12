<!-- tier: 3 -->

# Services

Cross-cutting services the server uses.

| file | what it is |
|---|---|
| [`generated-world-persistence.service.ts`](./generated-world-persistence.service.ts) | - |
| [`light-source.service.ts`](./light-source.service.ts) | - |

---

## Where else to look

- [`../engine/worldgen/README.md`](../engine/worldgen/README.md) -
  `generated-world-persistence.service.ts` is what makes a generated world survive a restart;
  everything it stores is otherwise reproducible from the world seed.
- [`../server/state/README.md`](../server/state/README.md) - the world singleton and the seed
  that service is persisting around.
- [`../server/consolidated/README.md`](../server/consolidated/README.md) - the callers.
  `light-source.service.ts` is reached from `inventory-manage.ts` and nowhere else.
- [`../storage/repos/README.md`](../storage/repos/README.md) - where these services put things.
  A service holds a policy; a repository holds the SQL.
- [`../server/handlers/README.md`](../server/handlers/README.md) - `spatial-handlers.ts` parses
  light effects out of its own rows rather than calling the light service, which is the seam to
  know about before changing either.

