# Played tests

`area-cap-walk.test.ts` checks area placement and narrator company through busy
towns, markets, compound rooms, ship decks and three years of world ticks. The
engine companion test also covers overflow, private rooms, beasts and bodies.
`area-arrivals.test.ts` adds visiting run sheets and remote presences, checks
their scene and offer rosters, and walks to visitors in overflow areas.

`makeGameInWorld` copies a freshly seeded JSON world into a private SQLite
database built from the cached schema. The key covers the harness, schema,
seeding and their imports, plus
the world seed and installed runtime. One fork builds each snapshot, then closes
its database. Every harness clears world handles and installs its own database.
World rows use the ordinary repository writer; seeded SQLite buffer copies
added native allocations to the many harnesses a played file keeps open.

Run seeds, narrators and player identities are still configured per caller.
`makeGame` keeps its schema-only setup for tests which do not pin a world.
`fresh-world-snapshot.test.ts` compares the cached world with `createWorld` and
checks that SQLite mutations, held graphs and ambient handles stay isolated.

The played deed search caches completed candidates in `tests/support/played-deed.ts`.
Its key follows the played path's sources. World and ledger assertions, plus
the hearsay readers, run again on each caller's JSON copy.
