# World exploration: demography

Status: complete. Started: 2026-10-13T13:55:36.415Z.

Simulation source key: f9f7545a0dfe61f2. Harness SHA-256: 3847c588a08722aabdead8e00143245782a441541968591eee1749310c5be623. Runtime: v24.14.0 win32/x64.

Request: start at 10 walked years, explore 3 further years. Census every 1 years; invariant reads every simulated year and at the starting checkpoint.

Cache root: D:\intellij-projects\mnehmos.rpg.mcp\.claude\worktrees\sol-speed\.claude\world-cache. Priority: below normal. Seeds run sequentially.

Starting checkpoint: cold bounded preparation; 6.91s wall / 8.829s CPU.

Actual exploration: 3 years. 3 native boundary reads for new plague courses; 0 newly contracted courses observed at their exact date.

These are diagnostic observations, not a verdict that every flagged state is a defect. Counts are rule observations across snapshots, not unique people. Each confirmed finding needs a small CI regression before a fix.

Coverage: native unscripted world advancement without a player. Yearly snapshots can miss short-lived violations. New dead acts cover explicit buyer/seller/bidder/crafter/traveller roles and bodies retained across the interval. Plague checks require a new course at an observed native boundary; zero exposure is not evidence of immunity. Preserved souls and reconstruction are not classified as dead actors.

Prices below are fixed catalog cash prices multiplied by the existing area-status dial, per good and unit. They are area-price distributions, not complete player quotes, tariffs or market transaction prices.

## Checks

- Unique IDs in each authoritative collection; finite nonnegative purses, faction stock/count resources and counted object quantities. Resource dates and ordinal metadata are not stocks.
- Living people have an actual recorded physical place; a standing house member away from its seat has a concrete activity.
- Physically dead people have no active goals, and no new buyer/seller/bidder/crafter/traveller act between observations while remaining physically dead.
- A house with zero actual people (including its unmodelled population) has no standing office rooms.
- Unexpired stationed assignments at shopfronts/public watches and temple branches fit their existing staff caps; visiting delegations are not staff.
- Recruiting living rolls exceeding the existing intake/post budget are review candidates, because births and family placement can legitimately exceed it.
- Living cultivation ordinals and house rank indices are within their actual ladders.
- A plague course newly contracted exactly at an observed native boundary requires the existing bodily need for food, including actual wounds.
- Location parents exist and form no cycles; quoted area price dials are finite and nonnegative.

## Findings

### roll-over-intake-budget (review)

45 observations; first day 368650; last day 369745. Up to five distinct subjects:

- Day 368650; sect-sweptground-temple: roll=17; intake/post budget=16; actual births and family placement may explain excess.
- Day 368650; sect-earth-vein-tower: roll=23; intake/post budget=22; actual births and family placement may explain excess.
- Day 368650; sect-ashen-forge-clan: roll=14; intake/post budget=12; actual births and family placement may explain excess.
- Day 368650; sect-hollow-bell-wanderers: roll=18; intake/post budget=9; actual births and family placement may explain excess.
- Day 368650; sect-frostmirror-court: roll=20; intake/post budget=19; actual births and family placement may explain excess.


## Distribution review

A doubling/halving is a review heuristic, not an engine limit. All series remain visible even when no heuristic fires.

No doubling/halving review signal in the observed interval.

## Census

| walked age (years) | day | living | retained people | standing houses | objects | facts | locations | roll min/median/max | purse min/median/max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 368650 | 1443 | 1478 | 40 | 6332 | 2575 | 1679 | 6 / 16 / 35 (n=40) | 0 / 0 / 13564 (n=1443) |
| 11 | 369015 | 1452 | 1496 | 40 | 6413 | 2676 | 1679 | 6 / 15.5 / 35 (n=40) | 0 / 0 / 13573 (n=1452) |
| 12 | 369380 | 1456 | 1506 | 40 | 6517 | 2871 | 1679 | 6 / 15 / 36 (n=40) | 0 / 0 / 13906 (n=1456) |
| 13 | 369745 | 1466 | 1522 | 39 | 6624 | 3004 | 1680 | 6 / 15 / 35 (n=39) | 0 / 0 / 13915 (n=1466) |

## Living population by cultivation realm

| walked age | body_integration | core_formation | deity_transformation | foundation_establishment | grand_ascension | immortal | nascent_soul | qi_condensation | tribulation_transcendence | void_tribulation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 12 | 105 | 30 | 296 | 5 | 1 | 51 | 922 | 7 | 14 |
| 11 | 12 | 110 | 30 | 297 | 5 | 1 | 51 | 925 | 7 | 14 |
| 12 | 12 | 114 | 30 | 296 | 5 | 1 | 51 | 926 | 7 | 14 |
| 13 | 12 | 115 | 30 | 298 | 5 | 1 | 51 | 933 | 7 | 14 |

## Houses by strongest living member realm

| walked age | body_integration | core_formation | deity_transformation | foundation_establishment | grand_ascension | nascent_soul | tribulation_transcendence | void_tribulation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 11 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 12 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 13 | 9 | 4 | 6 | 0 | 2 | 7 | 4 | 7 |

## Members by index on their own house ladder

| walked age | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 112 | 170 | 112 | 102 | 87 | 34 | 25 |
| 11 | 117 | 160 | 110 | 101 | 88 | 34 | 25 |
| 12 | 128 | 149 | 107 | 96 | 92 | 34 | 25 |
| 13 | 127 | 149 | 104 | 92 | 92 | 34 | 25 |

## Active area statuses

| walked age | famine |
| --- | --- |
| 10 | 0 |
| 11 | 0 |
| 12 | 1 |
| 13 | 1 |

## Area prices: cash per stated unit

| good | 10y min/median/max | 11y min/median/max | 12y min/median/max | 13y min/median/max |
| --- | --- | --- | --- | --- |
| price-millet (food, cash/each) | 1 / 1 / 1 (n=68) | 1 / 1 / 1 (n=68) | 1 / 1 / 4 (n=68) | 1 / 1 / 4 (n=68) |
| price-meal (food, cash/each) | 6 / 6 / 6 (n=68) | 6 / 6 / 6 (n=68) | 6 / 6 / 24 (n=68) | 6 / 6 / 24 (n=68) |
| price-month-rations (food, cash/month) | 120 / 120 / 120 (n=68) | 120 / 120 / 120 (n=68) | 120 / 120 / 480 (n=68) | 120 / 120 / 480 (n=68) |
| price-inn-night (lodging, cash/night) | 12 / 12 / 12 (n=68) | 12 / 12 / 12 (n=68) | 6 / 12 / 12 (n=68) | 6 / 12 / 12 (n=68) |
| price-month-lodging (lodging, cash/month) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 150 / 300 / 300 (n=68) | 150 / 300 / 300 (n=68) |
| price-spirit-beast-meal (food, cash/each) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) | 800 / 800 / 3200 (n=68) | 800 / 800 / 3200 (n=68) |
| price-ferry (transport, cash/crossing) | 2 / 2 / 2 (n=68) | 2 / 2 / 2 (n=68) | 2 / 2 / 3.2 (n=68) | 2 / 2 / 3.2 (n=68) |
| price-caravan-passage (transport, cash/per 100 li) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 400 (n=68) | 250 / 250 / 400 (n=68) |
| price-mule (transport, cash/each) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 2240 (n=68) | 1400 / 1400 / 2240 (n=68) |
| price-cart (transport, cash/each) | 3000 / 3000 / 3000 (n=68) | 3000 / 3000 / 3000 (n=68) | 3000 / 3000 / 4800 (n=68) | 3000 / 3000 / 4800 (n=68) |
| price-span-courier (transport, cash/per true li) | 900 / 900 / 900 (n=68) | 900 / 900 / 900 (n=68) | 900 / 900 / 1440 (n=68) | 900 / 900 / 1440 (n=68) |
| price-sea-passage (transport, cash/per head per day) | 45 / 45 / 45 (n=68) | 45 / 45 / 45 (n=68) | 45 / 45 / 72 (n=68) | 45 / 45 / 72 (n=68) |
| price-deck-passage-open-water (transport, cash/per head per day) | 70 / 70 / 70 (n=68) | 70 / 70 / 70 (n=68) | 70 / 70 / 112 (n=68) | 70 / 70 / 112 (n=68) |
| price-water-jar (food, cash/jar) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) | 30 / 30 / 120 (n=68) | 30 / 30 / 120 (n=68) |
| price-hull-repair (service, cash/per call) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) |
| price-port-rate (service, cash/per stone of value per 40) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) |
| price-doctor-visit (medicine, cash/visit) | 40 / 40 / 40 (n=68) | 40 / 40 / 40 (n=68) | 40 / 40 / 40 (n=68) | 40 / 40 / 40 (n=68) |
| price-splint-and-month (medicine, cash/course) | 500 / 500 / 500 (n=68) | 500 / 500 / 500 (n=68) | 500 / 500 / 500 (n=68) | 500 / 500 / 500 (n=68) |
| price-lesser-healing-pill (medicine, cash/each) | 2000 / 2000 / 2000 (n=68) | 2000 / 2000 / 2000 (n=68) | 2000 / 2000 / 2000 (n=68) | 2000 / 2000 / 2000 (n=68) |
| price-qi-gathering-pill (medicine, cash/each) | 1800 / 1800 / 1800 (n=68) | 1800 / 1800 / 1800 (n=68) | 1800 / 1800 / 1800 (n=68) | 1800 / 1800 / 1800 (n=68) |
| price-clear-meridian-pill (medicine, cash/each) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) |
| price-marrow-washing-pill (medicine, cash/each) | 42000 / 42000 / 42000 (n=68) | 42000 / 42000 / 42000 (n=68) | 42000 / 42000 / 42000 (n=68) | 42000 / 42000 / 42000 (n=68) |
| price-cave-ordinary (land, cash/month) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) |
| price-cave-vein (land, cash/month) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) |
| price-grant-day (land, cash/day) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) |
| price-farmland-mu (land, cash/per mu) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) |
| price-gate-registration (service, cash/year) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) |
| price-oath-witness (service, cash/oath) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) |
| price-scribe-letter (service, cash/letter) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) |
| price-placement (information, cash/assessment) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) |
| price-chisel (tool, cash/each) | 450 / 450 / 450 (n=68) | 450 / 450 / 450 (n=68) | 450 / 450 / 450 (n=68) | 450 / 450 / 450 (n=68) |
| price-mortal-sword (tool, cash/each) | 700 / 700 / 700 (n=68) | 700 / 700 / 700 (n=68) | 700 / 700 / 700 (n=68) | 700 / 700 / 700 (n=68) |
| price-clay-cauldron (tool, cash/each) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) |
| price-iron-refining-furnace (tool, cash/each) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) | 200 / 200 / 200 (n=68) |
| price-earth-grade-cauldron (tool, cash/each) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) |
| price-earth-grade-refining-furnace (tool, cash/each) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) | 18300 / 18300 / 18300 (n=68) |
| price-coffin (service, cash/each) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) |
| price-burial-plot (land, cash/plot) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) |
| price-corpse-cart (transport, cash/per stage) | 90 / 90 / 90 (n=68) | 90 / 90 / 90 (n=68) | 90 / 90 / 144 (n=68) | 90 / 90 / 144 (n=68) |
| price-bell-tolling (service, cash/each) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) |
| price-mourner (service, cash/day) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) |
| price-name-cut (service, cash/each) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) |
| price-salt (food, cash/catty) | 4 / 4 / 4 (n=68) | 4 / 4 / 4 (n=68) | 4 / 4 / 16 (n=68) | 4 / 4 / 16 (n=68) |
| price-cloth (tool, cash/bolt) | 55 / 55 / 55 (n=68) | 55 / 55 / 55 (n=68) | 55 / 55 / 55 (n=68) | 55 / 55 / 55 (n=68) |
| price-firewood (food, cash/month) | 18 / 18 / 18 (n=68) | 18 / 18 / 18 (n=68) | 18 / 18 / 72 (n=68) | 18 / 18 / 72 (n=68) |
| price-culling-bounty (service, cash/head) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) |
| price-village-well (land, cash/each) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) |

## Native year cost

Advance wall seconds min/median/max: 0.638 / 0.742 / 0.789 (n=3). Advance CPU: 0.859 / 1.109 / 1.375 (n=3).

Inspection cost is separate from engine advancement. Boundary plague reads are included in advance time.

| ending walked age | actual days | advance wall s | advance CPU s | inspection wall s | inspection CPU s | new facts |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | 365 | 0.638 | 0.859 | 0.125 | 0.125 | 476 |
| 12 | 365 | 0.789 | 1.375 | 0.145 | 0.156 | 540 |
| 13 | 365 | 0.742 | 1.109 | 0.145 | 0.172 | 525 |
