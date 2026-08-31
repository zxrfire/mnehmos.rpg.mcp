<!-- tier: 3 -->

# Storage

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected into a
> narration prompt.

SQLite is the source of truth. Migration conventions, the idempotent-ALTER pattern, and
repository conventions. Read this before adding a table, a column, or a repo.

The runtime agent reasons **from** these rows and never asserts them. See
[`../../context.md`](../../context.md).

---

## Layout

```text
db.ts                        opening a handle, integrity checks
index.ts                     the per-campaign connection pool and test override
migrations.ts                the root migration; calls every subsystem migration
migrations.cultivation.ts    cultivator, injuries, techniques, alchemy, sects, run ledger,
                             confrontations and the record of what was survived
migrations.world.ts          date, locations and their history, factions, NPCs, facts
migrations.social.ts         relationships, obligations, knowledge, secrets
repos/                       one module per table family
tenant-context.ts            the verified tenant a request resolves against
```

`migrations.ts` is a **shared registry that conflicts badly** when several agents edit it.
Make the minimum one-line addition and nothing else.

---

## Migration conventions

**Every migration is idempotent and safe on every startup.** There is no version table and
no up/down pairing. `migrate(db)` runs in full each time the process opens a database, and
every statement in it is written so that running it again is a no-op.

A subsystem migration is a single exported function that takes the handle:

```ts
import { migrateWorld } from './migrations.world.js';
// ...at the end of migrate():
migrateWorld(db);
```

Table creation uses `CREATE TABLE IF NOT EXISTS`, and index creation uses
`CREATE INDEX IF NOT EXISTS`. Create tables in dependency order within a subsystem: sects
first, because `cultivators.sect_id` points at them.

### The idempotent-ALTER pattern

SQLite has no `ADD COLUMN IF NOT EXISTS`, and a duplicate `ALTER` throws. So a column
added after a table already shipped is guarded by reading the table's current shape:

```ts
const cultivatorColumns = (
    db.prepare('PRAGMA table_info(cultivators)').all() as { name: string }[]
).map(col => col.name);

if (!cultivatorColumns.includes('foundation_quality')) {
    console.error('[Migration] Adding foundation_quality column to cultivators table');
    db.exec("ALTER TABLE cultivators ADD COLUMN foundation_quality TEXT NOT NULL DEFAULT 'none';");
}
```

Three parts, all of them required:

1. **Read `PRAGMA table_info` once** per table and reuse the array. Do not re-query per
   column.
2. **Guard with `includes`,** not a try/catch around the `ALTER`. A swallowed exception
   hides real failures.
3. **Log the migration to stderr.** `console.error` because stdout is the MCP transport.

Any index that depends on the new column goes inside the same guard, so it is created
exactly when the column is.

### Choosing NULL versus NOT NULL with a default

This decision is not cosmetic. The engine is never unsure, so `NULL` must mean genuinely
unknown rather than "not filled in yet".

- `cultivators.location` is **nullable with no default**: an existing world has no
  recorded locations, and inventing one for every legacy row would be the engine asserting
  geography it never simulated.
- `cultivators.foundation_quality` is **NOT NULL DEFAULT 'none'**: every cultivator has a
  foundation, and for the overwhelming majority the honest value is that they have not
  laid one. `NULL` would mean "unknown", which is a different and wrong claim.

Write the reasoning as a comment above the guard. Future readers need to know which of the
two cases they are in.

---

## Shape decisions worth knowing before you add a table

These are already load-bearing. Follow the same reasoning for new tables.

**Query the thing you query; do not blob it.** Injuries get their own table rather than a
JSON blob on `cultivators`, because untreated injuries are counted and individually
mutated far more often than they are read whole. A blob would force a read-modify-write of
the cultivator row for every pill taken, and would make "how many untreated injuries" an
application-side scan instead of an indexed `COUNT`.

**Separately queryable layers stay separate tables.** Location history is its own table,
because "what happened at Blackwater Valley", "which changes here have no recorded cause"
and "what did this place look like in year 8,412" must all be answerable without loading
and parsing every location in the region. The **origin** is denormalised onto the location
row rather than stored as change index 0, because replaying to a past state needs the
origin every time and the changes only sometimes.

**Deterministic ids, not UUIDs, for seeded content.** Facts are sequential text (`f7`),
and so are memories (`m7`), scheduled effects (`e7`) and location changes (`loc-x-c7`).
Seeding several prior ages writes thousands of rows, and the whole layer has to be
byte-identical across replays of the same seed. A random id makes two runs of one seed
incomparable and quietly destroys the determinism guarantee. Use `randomUUID` only for
rows that are genuinely per-session and never replayed.

**Do not enforce a circular foreign key.** `runs.cultivator_id` carries a `FOREIGN KEY`;
`cultivators.run_id` deliberately does not. The relationship is genuinely circular, and
SQLite can only satisfy a cycle with deferred constraints plus a mandatory transaction
around every insert. A run is always started *for* an existing cultivator, so the
cultivator side is the safe one to enforce and the back reference is a plain indexed
column.

**Nothing in the social schema expires.** No TTL column, no decay coefficient, no "stale"
flag, no sweep. An obligation leaves the open ledger exactly one way: a settlement row is
written saying what discharged it. The schema offers no column that could be used to
forget something quietly. See [`../engine/social/README.md`](../engine/social/README.md).

**The social tables deliberately store falsehoods.** A `knowledge_records` row is not a
fact. A `secret_holdings` row with status `falsified` is not the secret. `world_facts` is
the only table there that says what is true, and **no character-facing query may read
it.**

**Flags that gate the ledger get an index.** `runs.admin` exists so the death ledger's
exclusion of admin-touched runs is an indexed read rather than a `LIKE` scan across every
audit row. The `audit_logs` row written alongside remains the authoritative justification.

---

## Repository conventions

**Declare the row shape explicitly.** Do not infer it from a query. An explicit interface
means a column rename in the migration fails compilation in the repo, instead of silently
producing `undefined` at the schema boundary:

```ts
interface CultivatorRow {
    id: string;
    run_id: string | null;
    // ...
}
```

**Round-trip through Zod at the boundary.** Persisted state parses through the schema in
`src/schema/`, so invalid data fails loudly where it entered rather than silently later.
The schema is the contract; the row shape is an implementation detail of this layer.

**Columns are `snake_case`, the domain model is `camelCase`.** The repo is where the
translation happens, and it is the only place it happens.

**One transaction per coherent state change.** A save that has the injuries but not the
aging, the death but not the peak rank, or the boundary crossing but not the price it
exacted, is worse than a save that has neither.

**One implementation of a write, shared by both front doors.** The MCP tool layer and the
web server write the same rows to the same database. Shared derivations live in
`src/server/consolidated/cultivation-support.ts` and are used verbatim by both, because a
second implementation of "what a crossing took" would eventually disagree with the first,
and the disagreement would be a corrupted save rather than a failing test.

**Getting a handle.** Production code calls the no-argument `getDb()`, which resolves
against the verified tenant. Tests install an in-memory database via `setDb()` (or
implicitly via `getDb(':memory:')`) and then drive tool handlers directly with no HTTP and
no network. Campaign ids are UUIDs and are **validated, not sanitized** - the id becomes a
path segment, so a rejected id is a bug or an attack, and neither should be repaired into
something that opens a file.

## Related

- [`../engine/world/README.md`](../engine/world/README.md) - what the world tables are a model of
- [`../engine/social/README.md`](../engine/social/README.md) - why nothing there decays
- [`../engine/cultivation/README.md`](../engine/cultivation/README.md) - the survival ratchet these rows record
- [`../web/README.md`](../web/README.md) - the other front door onto the same database
