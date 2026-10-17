# Exploration handoff: 8210cf97

Complete: one command, three sequential seeds, each starting at 500 walked
years and exploring another 500. Source key 1a7960129f6a1539; no simulation
source changed during the run. Exit 0; 16,697.975 seconds wall (4h 38m).
Individual seed reports contain annual wall/CPU costs and distributions.
Walked age is additional time after the world's seeded year 1000.

These are findings for review, not repairs. Each confirmed defect needs a small
CI regression before an engine change. Repeated observations are not distinct
bugs or distinct people.

| Seed | Flag | Observations | Evidence and next check |
|---|---|---:|---|
| drift-guard | Away without reason | 35 | Check actual migration, home and post reasons against the observer. |
| drift-guard | Empty house with standing offices | 18 | sect-lantern-hall; distinguish physical rooms from active institutional offices. |
| demography | Duplicate object ID | 266 | First observed at walked age 735, day 633275: obj-yard-core-sect-the-severed-632977.2-25433. |
| demography | Away without reason | 22 | Actual place/activity examples are in its seed report. |
| area-occupancy-census-2026-10-01 | Duplicate object ID | 501 | Present in the starting 500-year checkpoint: obj-yard-core-sect-earth-vein-tower-453032.19999999995-14998. |
| area-occupancy-census-2026-10-01 | Away without reason | 39 | Check the actual reason before treating a missing explanation as a defect. |
| area-occupancy-census-2026-10-01 | Empty house with standing offices | 2 | Inspect physical rooms and actual institutional holders. |
| All three | Roll over intake/post budget | 6281 / 6241 / 6401 | Review only: births, family placement and staff can exceed recruitment budgets. |
| All three | Plague-onset coverage gap | 0 observed onsets | No new course was seen at its exact contraction boundary. This cannot certify food-need eligibility or prove immunity. |

The duplicate core producer is creditWhatCameBack in
src/engine/world/the-world-changing-on-its-own.ts. Its ID includes faction,
date and state.objects.length. Collection length can decrease, making a
collision plausible; the insertion cause has not been established. Compare
actual duplicate rows and provenance before choosing a repair. The second
example can be extracted from its existing checkpoint without another walk.

Median native wall seconds per year, read from 100-year windows:

| Seed | Walked ages 501-600 | Walked ages 901-1000 |
|---|---:|---:|
| drift-guard | 8.343 | 11.249 |
| demography | 7.872 | 11.375 |
| area-occupancy-census-2026-10-01 | 8.766 | 11.697 |

These are shared-machine baseline costs, not a before/after speed claim or an
asymptotic growth estimate. Complete window and CPU figures are in
.claude/landing-exploration-timing-summary.md. Player actions were not timed by
this native exploration.

Certification repairs are tracked separately in .claude/landing-blockers.md.
This report describes the unmodified 8210cf97 simulation.
