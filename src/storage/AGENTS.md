# Storage instructions

Read [README.md](README.md) and [repos/README.md](repos/README.md) before SQL/schema work.
One repository per table family owns SQL; nothing above this layer writes it. Preserve
Zod boundary round-trips and coherent atomic state changes.

## Where state actually lives, and what has to be true of a write

One SQLite file holds two authorities: run tables (`cultivators`, `runs`, `sects`,
`obligations`, `cultivator_flags`) through repositories, and in-memory `WorldState`
flushed to `world_*` tables by `world-state.repo.ts`. `appendWorld` adds;
`saveWorld` clears/reinserts world tables and is lifecycle-only, never "just save".
`Cultivator`/`NpcRecord` duplicating a person is debt, not a pattern: no third shape,
or copied field already carried by the other. Derive through existing readers.
Nested `db.transaction()` calls are normal and load-bearing. SQLite rollback does
not roll back mutated JavaScript objects; discard the cached world handle on failure.
Never keep a transaction across an await. Respect prepared synchronous span boundaries
in [the web contract](../web/README.md).

## World state regenerates from a seed. Do not write code to preserve it

Old saves may be deleted; do not build data migrations, compatibility reads or fallbacks
to rescue old shapes/renames. Fresh-schema/idempotent migrations are still required.
Catalogs are source, the database their projection; a fresh seeded world is immediately
playable. Correct a bad schema and rebuild rather than preserve corruption.
Measure/report invalid row counts anyway: many indicate an active bad writer. Rows
that never referenced anything differ from valid references broken by this change;
cascading away the latter is a survival/design decision requiring an argument.
The older preservation rationale in README's knowledge-key migration section describes
an existing migration, not authority to add another old-save rescue path.

## Never put a backtick inside a SQL template literal

A backtick, even inside a SQL comment, terminates its JavaScript template literal.
Quote SQL-comment identifiers with single quotes or nothing; put comments requiring
backticks above the literal as ordinary `//` comments.
