# Expensive fixtures

`soakedWorld` caches canonical walks of the live cultivation catalog. Each caller
gets a JSON copy. Its optional setup preserves a canonical fixture catalog,
population and starting age in the key. Observers, callbacks, pressure options
and worlds changed before advancing must keep their own walks.
The existing live-catalog cache retains its source keys and kept walks.
Long soaks advance at most ten years per span and discard returned event arrays.
Spans shorten at checkpoint boundaries.
Cold walks publish intermediate snapshots every 25 years. A later worker resumes
from the nearest completed snapshot with the same source key.
An exited builder's lock can be reclaimed immediately; a live builder keeps it.
Completed JSON stays on disk instead of retaining another copy in each process.

`serializedFixture` caches bytes under a hash of the fixture's import graph,
dependency lockfile, runtime and inputs. A lock across forks permits one builder;
an atomic rename publishes a complete snapshot. Callers receive copied bytes,
never a database, world object or ambient handle. Memory holds only in-flight
builds; failed builds are retried. Builders must close databases and clear
ambient world handles before returning.

Both disk caches release a dead builder's lock when its process has exited, so
an interrupted test does not make the next caller wait for the age limit.

`tests/web/harness.ts` uses it for freshly seeded world records. The played
deed probe uses it for completed candidate worlds. These are test fixtures only;
they do not alter production seeding or simulation.
