# World exploration

Long unscripted walks discover states nobody has thought to test. They run here,
outside `tests/`, and Vitest only collects `tests/**/*.test.ts`. The independent
`npm run explore` script is never called by `test` or `test:ci`. A confirmed
finding needs a CI regression as small as the bug before its production fix.
This harness reports candidates and distributions; it never repairs a world.

Run sequentially through the shared slot runner. The harness lowers its process
priority automatically. The default is two seeds, starting at 100 walked years,
then exploring another 1,000 years, with a census every ten years. Arrange free
slots before a long run. A short smoke exploration is:

```powershell
node C:/Users/hi/.claude/tools/heavy-run.mjs -- npm.cmd run explore -- --seeds drift-guard,demography --start-years 10 --years 3 --sample-years 1 *> .claude/explore-short.log
```

Use `npm run explore -- --help` for options. All numeric options are whole years;
`--years` is the additional horizon, not the final world age. Both seeds run in
one process, sequentially. Invariant reads happen yearly even when census tables
are less frequent. Each actual engine year and the separate inspection receive
wall and CPU timings. No assertion expects a particular house count, population
band, named survivor or pyramid ratio. Doubling/halving flags are explicitly
review heuristics, with the full distribution series alongside them.

`preBakedWorld` supplies a private copy of a completed checkpoint keyed by the
simulation's actual source graph, runtime and lockfile. The report records that
authority's own key through `soakedWorldSourceHash`, and checks fresh source each
year and before completion. A source edit stops the run with an incomplete report.
Stale checkpoints are never relabelled. On a missing checkpoint at ten years or
less, the harness prepares it through `soakedWorld` and reports that bounded cost.
Older missing starts stop with regeneration instructions. The local default cache
is `.claude/world-cache`; `MNEHMOS_WORLD_CACHE` selects a different cache.

Warm older worlds first, sequentially and only when long simulation slots are
available. The existing regenerator also lowers its priority and retains the
source-keyed builder lock:

```powershell
$env:MNEHMOS_WORLD_CACHE = Join-Path $PWD '.claude/world-cache'
node C:/Users/hi/.claude/tools/heavy-run.mjs -- node scripts/regenerate-world-fixtures.mjs --seed drift-guard --years 100 *> .claude/explore-warm-drift.log
node C:/Users/hi/.claude/tools/heavy-run.mjs -- node scripts/regenerate-world-fixtures.mjs --seed demography --years 100 *> .claude/explore-warm-demography.log
node C:/Users/hi/.claude/tools/heavy-run.mjs -- npm.cmd run explore *> .claude/explore-long.log
```

Reports are plain Markdown at `explore/reports/<local-date>-<seed>.md`, updated at
each census and on errors. Rerunning the same date/seed replaces its report; copy
one before comparing runs. Unusual seed spellings receive a digest in the filename
to avoid collisions and path traversal. The simulation key, harness digest,
runtime, actual dates, warm/cold preparation, completed span and check coverage
remain in each report. Findings count observations across snapshots, with at most
five distinct example subjects per rule. They are candidates for investigation,
not failed acceptance tests. Reports are review artifacts; select them explicitly
when handing off an exploration rather than automatically adding every run.

The checks derive their scope from existing authorities:

- Physical whereabouts use `locationOfNpcOnItsJourney` and `exteriorGroundOfDeparture`.
  Carriage passengers follow their actual current driver. A living member of a
  standing house away from its seat needs an activity.
- Stocks are purses, nonnegative resource counts and counted object quantities.
  Resource date/ordinal metadata is excluded from the stock check.
- Dead actors mean physically dead bodies. Active goals and new explicit trade,
  craft or travel actor roles are suspicious. Preserved souls and reconstructed
  bodies are not corpses; a retained activity alone does not prove action.
- Empty-house offices use actual room purposes and `howManyPeopleAHouseHas`,
  which includes the unmodelled population rather than treating the sampled roll
  as the whole institution. Dissolved institutions are outside this live-office
  check; their surviving architecture can be ruins the player explores.
- Staff caps come from `A_SHOPFRONT_HOLDS` and `A_BRANCH_HOLDS` at existing
  shopfronts, public watches and branches. Unexpired stationed assignments include
  actual air-duty receipt destinations. Visiting parties are not shop staff.
- Roll overages compare `aRollWorthModelling` and `theRollItsPostsNeed`. This is a
  review budget, not a hard population cap: real births and family placement have
  their own rights. Closed houses that recruit nobody are not assigned a zero cap.
- Plague checks read a newly dated bodily course at a native boundary through
  `stillNeedsToEat` and `woundsCarriedBy`, so a partial bodily transformation still
  counts as needing food. Historical courses after immunity are not new illness.
  Each report records how many newly contracted courses were actually observed.
- Price series use fixed catalog goods and units with `priceMultiplierInArea`.
  They describe the area dial, not full player quotes or transaction prices.

Yearly inspection can miss brief violations; the plague probe sees exact new
course dates only at native boundaries. Dead-action checks require the body to be
retained and physically dead at both ends of an interval. This is native world
exploration without a played player, not a claim to exercise all foreground acts.
Keep new checks tied to engine facts and document their coverage limits here.

Typecheck the observer and its dependencies with
`node C:/Users/hi/.claude/tools/heavy-run.mjs -- npx.cmd tsc --noEmit -p explore/tsconfig.json`.
The separate config does not broaden CI collection or production build inputs.
