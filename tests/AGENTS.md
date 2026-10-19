# Test instructions

Use the root heavy-run wrapper; keep all heavy work sequential. During iteration run
the affected area/integrations; before landing code use the root clean-tree gate.

## Tests test behaviour, not implementation

Pin what a player notices. Avoid engine-chosen names, IDs, ordering, rank indices,
room counts and reconstructed arrangements unless the choosing is itself under test.
Ask the engine for fixtures and read accepted names from output. Printed names must
work when typed back. Prove a new guard fails when its covered behaviour is broken.
Numeric design decisions need a named test with reasons, not an unexplained constant.

## Tests are living documentation

A substantial test opens with the observed defect, input/answer or relevant measurement
with provenance, and the asserted rule. Keep findings, not a discovery diary. A gap
in a header is still a gap, not an endorsed decision.
When behaviour legitimately changes, update header/name/assertions together and explain
the new rule and why the old one no longer applies. Do not relabel away its reasoning.
A test can encode a bug; re-derive rather than revert a correct fix.
Tests may be rewritten/deleted for real design changes, never inconvenience or to
erase a failure. If you cannot say what it should assert now, understand the change first.

## A long walk is three tests, or one

Never spend centuries reaching a moment in CI. Arrange the scenario through engine
writers, prove reachability with sampled source-keyed walked worlds, and run a real
walked instance through the same scenario contract. One predicate defines all three.
Use `tests/support/soaked-world.ts`; a bug with no history needs no walked history.
Long unscripted exploratory walks belong in `explore/`, outside Vitest collection
(`tests/**/*.test.ts`). Give each finding its smallest regression before fixing it.

## Three layers, and the cheap one carries the weight

Keep many fast engine tests, fewer model-routing comparisons and a handful of prose
tests. No-model parser/harness tests prove mechanics, state, refusals and explicit
routing; use no model for questions code can answer. Model-routing tests cover the
reader that runs first in configured play, on a small targeted corpus. Prose tests
cover genre, leaked arithmetic and contradictions that only narration can expose.
Live-model checks skip explicitly when no model answers; the floor runs without a GPU.
`scripts/probe-what-a-refusal-is-still-for.ts` and `scripts/probe-how-the-model-routes.ts`
are measurements rather than assertion suites.
Preconditions may be arranged quickly (including admin), but each needs a sibling
reachability check that plays to it. Do not make every scenario spend forty setup turns.

### Engine-only and played tests

Engine-only language is explicit verb + thing. Do not test English comprehension,
ellipses, pronouns/back-references or synonym sweeps against the pattern table.
Assert explicit routing, no accidental spending, and acceptance of printed names.
Use scripted phase-1 plans for contextual/anaphoric execution; live model play for
composition comprehension. Never call a fallback's single-act answer a failed plan.
For actual hand-play, `makeGame` defaults `worldEnabled: false` while production uses
true. Pass `worldEnabled: true` and pin `worldSeed`, preferably with `makeGameInWorld`.
Pin the run seed too where outcomes matter. Use world-off only when no world is needed.
Match production callers before reporting defects: closed-run errors may be in `error`,
and player rows use `sectId`/`knownTechniques`, not NPC `factionId`/`techniqueIds`.
Measure DB/state, not narration; no missing field silently becomes zero.

## A corpus is a set, not a sequence

Arrange fresh per sentence; earlier sentences must not spend later resources, leave a
fight or alter meaning. Share the expensive world snapshot, not mutable scenario state.
Shuffle the corpus and assert identical results. A world-enabled test without a pinned
world is a different arrangement each run, not harmless flakiness.
Measure early, middle and late ladder bands separately; pooled verb/prose figures hide
height-specific defects. [The ladder's prose bands](../docs/world/writing/what-changes-as-the-ladder-is-climbed.md)
are the reference.

## Nothing typechecks the tests unless you ask it to

`npm run typecheck` uses `tsconfig.json`, which excludes tests. Vitest/esbuild strips
types without checking. **Use `npm run typecheck:all`**, backed by `tsconfig.all.json`,
for tests/scripts and Vitest globals. Check the inspected files, not only an exit code.
The older root claim that this was intentionally unwired is superseded by the existing
command/config; do not recreate its obsolete ad hoc config.

## Two tiers of test: outcomes and rates

A unit test checks what happens when an event occurs; a rate test proves it reaches
the player at a sane rate. Assert observable consequence, not an internal firing.
Bound both edges and identify which failed. Derive closed-form expectations from real
chances, spans, exposure and pinned-world counts where possible, not repeated simulation.
Check tails as well as averages: chance of never seeing it, and of a run flooded by it.
Sample only genuine world dependence; pin worlds and pool fixed seeds inside the
assertion, never retry until green. Pool both arms, not only the baseline.
Do not widen bars for noise; increase the meaningful sample. Large population inversions
may be structural at one seed; small individual bands require pooling.
Keep seeds, span, population and source/build beside bars. Bars may move deliberately
with new measured behaviour and reasons, never merely to silence failure.
Validate new checkers on known answers, including inspected files/partitions.
Two-part guards need cases exercising both parts independently, including a permanently
true-half control; inspect actual null/undefined return contracts.

## TDD loop

Write the failing test, implement, refactor, commit passing work, repeat. Local commits
need no separate permission when the task allows them. Follow root ownership/private-index
rules; passing local files alone do not certify a pooled branch.
