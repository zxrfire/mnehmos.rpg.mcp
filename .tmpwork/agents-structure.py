import io

p = 'AGENTS.md'
s = io.open(p, encoding='utf-8').read()

anchor = "### `docs/bastion/` is a second game, and a repo-wide sweep is not repo-wide"
add = """### The shipped binary is a second runtime, and the suite cannot see it

`esbuild.config.mjs` cannot bundle better-sqlite3's JavaScript wrapper, so it writes its
own against the native addon. **vitest never loads that wrapper.** It imports the real
module, so every test in this repo is blind to the packaged driver by construction, and a
defect there can be shipped past a fully green suite.

Measured: the packaged `transaction` issued a bare `BEGIN` with no savepoints and no depth
counter, while two production paths already nested -

    sect-manage.ts:583  wraps  sect.repo.ts:200       joining a house
    apply.ts:78         wraps  cultivator.repo.ts:602 a skip that gains a realm

so joining a sect, and any seclusion that gained a realm or killed the player, threw
`cannot start a transaction within a transaction` in the shipped binary. 8,998 green tests
could not say so.

**The rule: nothing in `esbuild.config.mjs` reimplements behaviour.** Anything it has to
provide lives in `scripts/`, is imported by the build AND by a test, and the build inlines
the tested function's own source rather than a copy of it -
`scripts/packaged-better-sqlite3-driver.mjs` is the pattern. If you find yourself typing
logic into that config's template literal, you are writing untestable production code.

### Where state actually lives, and what has to be true of a write

There are two authoritative stores and they are both in the same SQLite file:

    the run          `cultivators`, `runs`, `sects`, `obligations`, `cultivator_flags`
                     Written through `src/storage/repos/*` - one class per table, and
                     nothing above that layer writes SQL.
    the world        an in-memory `WorldState`, flushed to ~25 `world_*` tables by
                     `world-state.repo.ts`. `appendWorld` adds; `saveWorld` CLEARS all
                     25 and re-inserts, so it is lifecycle-only and calling it to
                     "just save" destroys a world.

**A person exists in both** (`Cultivator` and `NpcRecord`), which is drift being worked
off, not a design. Do not add a third shape for one, and do not add a field to one that
the other already carries.

Two things that are true of every write and are easy to get wrong:

- **Nesting is allowed and is load-bearing.** An outer `db.transaction()` wrapping a repo
  method that opens its own is the normal shape here, not a mistake to unwind.
- **SQLite rolls back; a JavaScript object does not.** If a transaction that mutated the
  in-memory `WorldState` throws, SQLite is clean and the world handle is not. Drop the
  cached handle rather than trusting it.

"""
assert anchor in s
s = s.replace(anchor, add + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
