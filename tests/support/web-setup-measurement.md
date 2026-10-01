# Web setup timing

Measured on 2026-10-01 in `cx-speed`, on the shared Windows machine. Each
Vitest command ran serially with `--no-file-parallelism`; no two runs overlapped.
The sample contains 20 files and 208 existing tests. Assertions were preserved.

The comparison uses the sum of Vitest's **test-file execution times**, excluding
transforms, collection and runner startup. Early baseline batches encountered
worker-reporting errors and a forbidden result-cache write through the shared
`node_modules` junction. Only completed, passing file timings were retained;
missing sample files were measured in separate passing recovery batches. The
two files which did not complete were excluded before fixing the final sample.
Later terminated batches were completed using explicit file commands. An
incorrectly expanded recovery command was stopped and its results discarded.
The temporary `cache: false` workaround was removed from `vitest.config.ts`.

The first pass populated newly keyed fixtures. The reuse pass used completed
candidate fixtures populated for the final sources. These are single
measurements on a shared machine, not a claim about a full-suite speedup.

The reuse pass reduced test execution by **18.2%**, from **582.015s** to **476.312s**. Raw timings are in [web-setup-timings.json](web-setup-timings.json).

| File | Before (s) | First pass (s) | Reuse (s) |
|---|---:|---:|---:|
| a-crossing-costs-the-body.test.ts | 26.008 | 25.503 | 24.947 |
| what-somebody-knows-of-the-land.test.ts | 26.797 | 26.062 | 25.169 |
| a-bigger-house-is-bigger-to-stand-in.test.ts | 9.871 | 10.215 | 10.562 |
| a-player-deed-enters-the-world.test.ts | 115.141 | 90.553 | 14.778 |
| asking-a-person-for-something.test.ts | 111.432 | 112.946 | 113.830 |
| telling-somebody-opens-the-account.test.ts | 24.298 | 25.663 | 24.085 |
| a-turn-says-what-it-spent-and-what-it-cost.test.ts | 22.243 | 21.477 | 22.564 |
| standing-guard.test.ts | 16.453 | 18.090 | 15.610 |
| a-night-outdoors-costs-the-body.test.ts | 23.491 | 23.818 | 23.298 |
| the-strip-names-what-is-standing-here.test.ts | 64.012 | 63.154 | 63.978 |
| a-room-at-the-inn-is-yours-alone.test.ts | 17.231 | 16.297 | 16.693 |
| a-fight-you-can-answer.test.ts | 30.617 | 33.524 | 30.128 |
| being-told-opens-the-account.test.ts | 15.860 | 15.277 | 14.594 |
| more-and-why-are-about-the-answer-before-them.test.ts | 10.497 | 9.777 | 9.839 |
| a-seat-on-a-ship-or-a-carriage.test.ts | 17.066 | 16.629 | 16.078 |
| looking-at-somebody-who-is-not-here.test.ts | 17.534 | 17.453 | 18.170 |
| a-body-you-were-born-as-is-something-you-can-read.test.ts | 8.315 | 8.057 | 8.103 |
| the-two-clocks-are-one-clock.test.ts | 9.736 | 11.141 | 9.146 |
| what-a-seclusion-will-cost-to-eat.test.ts | 7.848 | 8.781 | 7.892 |
| a-life-knows-people-and-where-to-find-them.test.ts | 7.565 | 8.321 | 6.848 |
| **Total** | **582.015** | **562.738** | **476.312** |

Run the same sample in these five commands, one at a time:

```powershell
npx.cmd vitest run --no-file-parallelism tests/web/a-crossing-costs-the-body.test.ts tests/web/what-somebody-knows-of-the-land.test.ts tests/web/a-bigger-house-is-bigger-to-stand-in.test.ts tests/web/a-player-deed-enters-the-world.test.ts
npx.cmd vitest run --no-file-parallelism tests/web/asking-a-person-for-something.test.ts tests/web/telling-somebody-opens-the-account.test.ts tests/web/a-turn-says-what-it-spent-and-what-it-cost.test.ts tests/web/standing-guard.test.ts
npx.cmd vitest run --no-file-parallelism tests/web/a-night-outdoors-costs-the-body.test.ts tests/web/the-strip-names-what-is-standing-here.test.ts tests/web/a-room-at-the-inn-is-yours-alone.test.ts tests/web/a-fight-you-can-answer.test.ts
npx.cmd vitest run --no-file-parallelism tests/web/being-told-opens-the-account.test.ts tests/web/more-and-why-are-about-the-answer-before-them.test.ts tests/web/a-seat-on-a-ship-or-a-carriage.test.ts tests/web/looking-at-somebody-who-is-not-here.test.ts
npx.cmd vitest run --no-file-parallelism tests/web/a-body-you-were-born-as-is-something-you-can-read.test.ts tests/web/the-two-clocks-are-one-clock.test.ts tests/web/what-a-seclusion-will-cost-to-eat.test.ts tests/web/a-life-knows-people-and-where-to-find-them.test.ts
```

Focused checks for the changed setup:

```powershell
npx.cmd tsc --noEmit -p tsconfig.all.json
npx.cmd vitest run --no-file-parallelism tests/support/serialized-fixture.test.ts tests/support/soaked-world.test.ts tests/web/fresh-world-snapshot.test.ts
npx.cmd vitest run --no-file-parallelism tests/engine/world/what-a-world-must-never-contain.test.ts tests/engine/world/a-fact-that-keeps-happening-is-one-row.test.ts tests/engine/world/does-a-life-read-like-a-life.test.ts
npx.cmd vitest run --no-file-parallelism tests/web/a-player-deed-enters-the-world.test.ts
```
