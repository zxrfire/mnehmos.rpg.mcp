# Developer simulations

Run builds, tests and simulations sequentially through the shared heavy runner.
Capture output to a file. The fixture regenerators lower their own priority and
retain the fixture authority's builder locks and source identity.

`regenerate-world-fixtures.mjs` warms canonical aged world checkpoints. Set
`MNEHMOS_WORLD_CACHE` to a task-owned directory; select a seed and ages with
`--seed drift-guard --years 24,25,100,250`.

`regenerate-driver-fixture.mjs` warms the native driver's complete cumulative
500-year sample, including its deaths, digest and final world. CI only reads
completed source-keyed bytes and fails with this command when they are absent.
`--output receipt.json` captures the cold wall/CPU measurement and cache identity.
It is independent of `test` and `test:ci`.

`measure-aged-world.mjs` times current-source completed checkpoints and records
their source key. Its historical before arm rejects later merged versions of
the two old profiled files, so a comparison cannot discard unrelated changes.
