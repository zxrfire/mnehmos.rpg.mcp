# Expensive fixtures

`soakedWorld` caches canonical walks of the live cultivation catalog. Each caller
gets a JSON copy. Its optional setup preserves a canonical fixture catalog,
population and starting age in the key. Observers, callbacks, pressure options
and worlds changed before advancing must keep their own walks.
Both fixture caches use the same TypeScript dependency reader, including lazy,
side-effect and re-exported imports. Missing or computed imports fail closed.
The key also covers runtime, dependency lockfile and loader configuration;
changing any of these rebuilds the walk. Snapshot-format and walk-boundary code
are part of the canonical key. Historical keys are never relabelled as current.
`soakedWorldSourceHash()` exposes that same canonical identity for diagnostic
reports. Passing `true` re-reads current source without changing the loaded
module graph's identity, so an exploration can stop if source changes mid-run.
Long soaks advance at most ten years per span and discard returned event arrays.
Spans shorten at checkpoint boundaries.
Cold walks publish intermediate snapshots every 25 years. A later worker resumes
from the nearest completed snapshot with the same source key.
An exited builder's lock can be reclaimed immediately; a live builder keeps it.
Different horizons of one seed share that lock and reuse its nearest checkpoint.
Before publication the walker checks the source again; editing a loaded simulation
mid-build cannot publish a mixed-generation world as current.
Eviction skips source directories with a live or unverifiable builder lock.
Completed JSON stays on disk instead of retaining another copy in each process.
Canonical snapshots store arrays in chunks of 1,024 records behind an atomically
published manifest. A 1,200-year walk exceeded JavaScript's single-string limit;
chunking preserves the JSON round trip without requiring a world-sized string.
Readers also accept existing single-file snapshots.

`serializedFixture` caches bytes under a hash of the fixture's import graph,
dependency lockfile, runtime and inputs. A lock across forks permits one builder;
an atomic rename publishes a complete snapshot. Callers receive copied bytes,
never a database, world object or ambient handle. Memory holds only in-flight
builds; failed builds are retried. Builders must close databases and clear
ambient world handles before returning.

Both disk caches release a dead builder's lock when its process has exited, so
an interrupted test does not make the next caller wait for the age limit.
The byte-fixture cache never displaces a known live builder merely because a
long walk takes more than thirty minutes.

`tests/web/harness.ts` uses it for freshly seeded world records. The played
deed probe uses it for completed candidate worlds. These are test fixtures only;
they do not alter production seeding or simulation.

Warm the standard age checkpoints in the background with:
`node C:/Users/hi/.claude/tools/heavy-run.mjs -- node scripts/regenerate-world-fixtures.mjs`.
The regenerator runs one age at a time at reduced priority and uses the same cache
and locks as tests. `--seed <seed> --years 10,100,1000` selects another sample.
It does no work when those source-keyed snapshots already exist. Set
`MNEHMOS_WORLD_CACHE` to a task-owned directory for isolated measurements.

`scripts/measure-aged-world.mjs` reads completed current-source age checkpoints
only. Missing ages request regeneration instead of starting a cold walk inside
a timing. It reports one native year, an ordinary look, a ten-year wait, closed
seclusion, a far flight along the physical map and a long walking route through the real game service. Routing
and narration are scripted; SQLite writes, body costs, world simulation and
interruptions remain real. Each player action gets its own copy of the aged world.
The body is legally at the flight threshold and both endpoints have actual metric coordinates.
The player learns a real catalog cultivation method through repository writers; the
report includes gained progress. Reported actual days distinguish interruption/refusal
from a completed request. --native-only measures years without played actions;
--decade also measures an uninterrupted native ten-year advance.
For an explicit diagnostic before/after, `--arm before` loads only the two
original profiled source modules from 056c7114; `--arm current` uses disk source.
Both arms can consume the same `--snapshot-root` diagnostic checkpoint family.
Those inputs are labelled in the report and are never published into the canonical
cache. Ordinary runs use current-source canonical checkpoints only.

`sampledWorld` keeps opening/decade controls inexpensive and requires completed
current-source checkpoints for longer acceptance samples. A missing long sample
fails with its regeneration command; CI never silently starts a centuries-long
exploration. Regenerate before running the long acceptance files.

`forecast-hall-staff.ts` arranges hypothetical posts for pure remit fixtures.
It preserves the retired round-robin forecast without supplying any actual
appointment; production staffing belongs to Internal Affairs.
