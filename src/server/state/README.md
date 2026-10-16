<!-- tier: 3 -->

# Server-lifetime state

`advancePreparedWorldForCultivator` is the synchronous body of the ordinary
world advance, after opening and clock preparation. `commitPreparedWorldSpan`
nests repository writes under one transaction and holds only references to
the changed worlds until their final append before COMMIT. There is no pending
write outside that synchronous scope. Failure rolls back SQL and evicts the
mutable graph; intermediate appointments are simulation boundaries, not saves.

Precise native spans persist the fractional world day, from which the hour derives.
Legacy whole-day reads can still derive their hour from the run's fraction until
native clock preparation materializes it. Clock comparisons use that actual time
and the full elapsed run span. There is no separately persisted hour.

Opening a saved world applies the same idempotent road-ground augmentation as fresh
seeding and saves only when new ground was added. Care uses the house's existing rooms;
opening a world does not build a dispensary. Existing roads, rooms, permissions, people,
possessions and clock remain intact; a restart does not reseed an installation.

`advanceWorldForCultivator` supplies the player's current body and actual area as a
temporary visiting presence. NPC advancement can read their suppression and elemental
neighbourhood without assigning the player a second persisted location.

Local-news access resolves that body's current ground through `worldLocationFor`.
Its native location ID matches the calendar's fact locations, so presence can
receive local news without appearing among its participants or witnesses. The
digest still applies its existing secret, distance and naming authorities.

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

Opening a saved catalog world also initializes missing exterior metric anchors
through the same world-seed initializer as opening seeding, saving only when
anchors were added. Existing assigned points survive subsequent loads; nested
rooms and road midpoints derive instead of keeping position copies. No world
reseed, road-duration change, knowledge record or observer map disclosure follows.
Unanchored legacy roots remain honestly unavailable rather than being guessed.
