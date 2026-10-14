# World exploration: drift-guard

Status: complete. Started: 2026-10-13T13:55:36.415Z.

Simulation source key: f9f7545a0dfe61f2. Harness SHA-256: 3847c588a08722aabdead8e00143245782a441541968591eee1749310c5be623. Runtime: v24.14.0 win32/x64.

Request: start at 10 walked years, explore 3 further years. Census every 1 years; invariant reads every simulated year and at the starting checkpoint.

Cache root: D:\intellij-projects\mnehmos.rpg.mcp\.claude\worktrees\sol-speed\.claude\world-cache. Priority: below normal. Seeds run sequentially.

Starting checkpoint: cold bounded preparation; 7.392s wall / 11.203s CPU.

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

56 observations; first day 368650; last day 369745. Up to five distinct subjects:

- Day 368650; sect-cinnabar-crucible-sect: roll=14; intake/post budget=13; actual births and family placement may explain excess.
- Day 368650; sect-ashen-forge-clan: roll=14; intake/post budget=12; actual births and family placement may explain excess.
- Day 368650; sect-hollow-bell-wanderers: roll=14; intake/post budget=9; actual births and family placement may explain excess.
- Day 368650; sect-frostmirror-court: roll=21; intake/post budget=19; actual births and family placement may explain excess.
- Day 368650; sect-hollow-court: roll=10; intake/post budget=2; actual births and family placement may explain excess.


## Distribution review

A doubling/halving is a review heuristic, not an engine limit. All series remain visible even when no heuristic fires.

No doubling/halving review signal in the observed interval.

## Census

| walked age (years) | day | living | retained people | standing houses | objects | facts | locations | roll min/median/max | purse min/median/max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 368650 | 1453 | 1463 | 40 | 6416 | 2516 | 1668 | 6 / 16 / 34 (n=40) | 0 / 0 / 13758 (n=1453) |
| 11 | 369015 | 1459 | 1473 | 40 | 6459 | 2528 | 1669 | 6 / 15 / 36 (n=40) | 0 / 0 / 13767 (n=1459) |
| 12 | 369380 | 1465 | 1486 | 40 | 6538 | 2764 | 1669 | 6 / 15 / 35 (n=40) | 0 / 0 / 13776 (n=1465) |
| 13 | 369745 | 1476 | 1504 | 40 | 6641 | 3002 | 1670 | 6 / 15.5 / 36 (n=40) | 0 / 0 / 13785 (n=1476) |

## Living population by cultivation realm

| walked age | body_integration | core_formation | deity_transformation | foundation_establishment | grand_ascension | immortal | nascent_soul | qi_condensation | tribulation_transcendence | void_tribulation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 12 | 117 | 26 | 304 | 5 | 1 | 48 | 920 | 7 | 13 |
| 11 | 12 | 119 | 26 | 315 | 5 | 1 | 48 | 913 | 7 | 13 |
| 12 | 12 | 122 | 26 | 318 | 5 | 1 | 48 | 913 | 7 | 13 |
| 13 | 12 | 125 | 26 | 317 | 5 | 1 | 48 | 922 | 7 | 13 |

## Houses by strongest living member realm

| walked age | body_integration | core_formation | deity_transformation | foundation_establishment | grand_ascension | nascent_soul | tribulation_transcendence | void_tribulation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 11 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 12 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |
| 13 | 9 | 4 | 6 | 1 | 2 | 7 | 4 | 7 |

## Members by index on their own house ladder

| walked age | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 104 | 189 | 112 | 92 | 92 | 35 | 26 |
| 11 | 108 | 189 | 106 | 89 | 92 | 35 | 26 |
| 12 | 113 | 178 | 105 | 86 | 94 | 35 | 26 |
| 13 | 112 | 173 | 104 | 85 | 96 | 35 | 26 |

## Active area statuses

| walked age | closed_to_gathering | famine |
| --- | --- | --- |
| 10 | 1 | 0 |
| 11 | 1 | 0 |
| 12 | 1 | 1 |
| 13 | 1 | 0 |

## Area prices: cash per stated unit

| good | 10y min/median/max | 11y min/median/max | 12y min/median/max | 13y min/median/max |
| --- | --- | --- | --- | --- |
| price-millet (food, cash/each) | 1 / 1 / 1.3 (n=68) | 1 / 1 / 1.3 (n=68) | 1 / 1 / 4 (n=68) | 1 / 1 / 1.3 (n=68) |
| price-meal (food, cash/each) | 6 / 6 / 7.8 (n=68) | 6 / 6 / 7.8 (n=68) | 6 / 6 / 24 (n=68) | 6 / 6 / 7.8 (n=68) |
| price-month-rations (food, cash/month) | 120 / 120 / 156 (n=68) | 120 / 120 / 156 (n=68) | 120 / 120 / 480 (n=68) | 120 / 120 / 156 (n=68) |
| price-inn-night (lodging, cash/night) | 12 / 12 / 12 (n=68) | 12 / 12 / 12 (n=68) | 6 / 12 / 12 (n=68) | 12 / 12 / 12 (n=68) |
| price-month-lodging (lodging, cash/month) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 150 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) |
| price-spirit-beast-meal (food, cash/each) | 800 / 800 / 1040 (n=68) | 800 / 800 / 1040 (n=68) | 800 / 800 / 3200 (n=68) | 800 / 800 / 1040 (n=68) |
| price-ferry (transport, cash/crossing) | 2 / 2 / 2 (n=68) | 2 / 2 / 2 (n=68) | 2 / 2 / 3.2 (n=68) | 2 / 2 / 2 (n=68) |
| price-caravan-passage (transport, cash/per 100 li) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 400 (n=68) | 250 / 250 / 250 (n=68) |
| price-mule (transport, cash/each) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 2240 (n=68) | 1400 / 1400 / 1400 (n=68) |
| price-cart (transport, cash/each) | 3000 / 3000 / 3000 (n=68) | 3000 / 3000 / 3000 (n=68) | 3000 / 3000 / 4800 (n=68) | 3000 / 3000 / 3000 (n=68) |
| price-span-courier (transport, cash/per true li) | 900 / 900 / 900 (n=68) | 900 / 900 / 900 (n=68) | 900 / 900 / 1440 (n=68) | 900 / 900 / 900 (n=68) |
| price-sea-passage (transport, cash/per head per day) | 45 / 45 / 45 (n=68) | 45 / 45 / 45 (n=68) | 45 / 45 / 72 (n=68) | 45 / 45 / 45 (n=68) |
| price-deck-passage-open-water (transport, cash/per head per day) | 70 / 70 / 70 (n=68) | 70 / 70 / 70 (n=68) | 70 / 70 / 112 (n=68) | 70 / 70 / 70 (n=68) |
| price-water-jar (food, cash/jar) | 30 / 30 / 39 (n=68) | 30 / 30 / 39 (n=68) | 30 / 30 / 120 (n=68) | 30 / 30 / 39 (n=68) |
| price-hull-repair (service, cash/per call) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) | 2200 / 2200 / 2200 (n=68) |
| price-port-rate (service, cash/per stone of value per 40) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) | 25 / 25 / 25 (n=68) |
| price-doctor-visit (medicine, cash/visit) | 40 / 40 / 64 (n=68) | 40 / 40 / 64 (n=68) | 40 / 40 / 64 (n=68) | 40 / 40 / 64 (n=68) |
| price-splint-and-month (medicine, cash/course) | 500 / 500 / 800 (n=68) | 500 / 500 / 800 (n=68) | 500 / 500 / 800 (n=68) | 500 / 500 / 800 (n=68) |
| price-lesser-healing-pill (medicine, cash/each) | 2000 / 2000 / 3200 (n=68) | 2000 / 2000 / 3200 (n=68) | 2000 / 2000 / 3200 (n=68) | 2000 / 2000 / 3200 (n=68) |
| price-qi-gathering-pill (medicine, cash/each) | 1800 / 1800 / 2880 (n=68) | 1800 / 1800 / 2880 (n=68) | 1800 / 1800 / 2880 (n=68) | 1800 / 1800 / 2880 (n=68) |
| price-clear-meridian-pill (medicine, cash/each) | 6000 / 6000 / 9600 (n=68) | 6000 / 6000 / 9600 (n=68) | 6000 / 6000 / 9600 (n=68) | 6000 / 6000 / 9600 (n=68) |
| price-marrow-washing-pill (medicine, cash/each) | 42000 / 42000 / 67200 (n=68) | 42000 / 42000 / 67200 (n=68) | 42000 / 42000 / 67200 (n=68) | 42000 / 42000 / 67200 (n=68) |
| price-cave-ordinary (land, cash/month) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) | 800 / 800 / 800 (n=68) |
| price-cave-vein (land, cash/month) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) | 6000 / 6000 / 6000 (n=68) |
| price-grant-day (land, cash/day) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) | 4000 / 4000 / 4000 (n=68) |
| price-farmland-mu (land, cash/per mu) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) | 9000 / 9000 / 9000 (n=68) |
| price-gate-registration (service, cash/year) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) | 300 / 300 / 300 (n=68) |
| price-oath-witness (service, cash/oath) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) |
| price-scribe-letter (service, cash/letter) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) | 8 / 8 / 8 (n=68) |
| price-placement (information, cash/assessment) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) | 7000 / 7000 / 7000 (n=68) |
| price-chisel (tool, cash/each) | 450 / 450 / 675 (n=68) | 450 / 450 / 675 (n=68) | 450 / 450 / 675 (n=68) | 450 / 450 / 675 (n=68) |
| price-mortal-sword (tool, cash/each) | 700 / 700 / 1050 (n=68) | 700 / 700 / 1050 (n=68) | 700 / 700 / 1050 (n=68) | 700 / 700 / 1050 (n=68) |
| price-clay-cauldron (tool, cash/each) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) |
| price-iron-refining-furnace (tool, cash/each) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) | 200 / 200 / 300 (n=68) |
| price-earth-grade-cauldron (tool, cash/each) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) |
| price-earth-grade-refining-furnace (tool, cash/each) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) | 18300 / 18300 / 27450 (n=68) |
| price-coffin (service, cash/each) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) | 1400 / 1400 / 1400 (n=68) |
| price-burial-plot (land, cash/plot) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) | 600 / 600 / 600 (n=68) |
| price-corpse-cart (transport, cash/per stage) | 90 / 90 / 90 (n=68) | 90 / 90 / 90 (n=68) | 90 / 90 / 144 (n=68) | 90 / 90 / 90 (n=68) |
| price-bell-tolling (service, cash/each) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) | 20 / 20 / 20 (n=68) |
| price-mourner (service, cash/day) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) | 30 / 30 / 30 (n=68) |
| price-name-cut (service, cash/each) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) | 250 / 250 / 250 (n=68) |
| price-salt (food, cash/catty) | 4 / 4 / 5.2 (n=68) | 4 / 4 / 5.2 (n=68) | 4 / 4 / 16 (n=68) | 4 / 4 / 5.2 (n=68) |
| price-cloth (tool, cash/bolt) | 55 / 55 / 82.5 (n=68) | 55 / 55 / 82.5 (n=68) | 55 / 55 / 82.5 (n=68) | 55 / 55 / 82.5 (n=68) |
| price-firewood (food, cash/month) | 18 / 18 / 23.4 (n=68) | 18 / 18 / 23.4 (n=68) | 18 / 18 / 72 (n=68) | 18 / 18 / 23.4 (n=68) |
| price-culling-bounty (service, cash/head) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) | 350 / 350 / 350 (n=68) |
| price-village-well (land, cash/each) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) | 5000 / 5000 / 5000 (n=68) |

## Native year cost

Advance wall seconds min/median/max: 0.659 / 0.809 / 0.922 (n=3). Advance CPU: 0.953 / 1.031 / 1.594 (n=3).

Inspection cost is separate from engine advancement. Boundary plague reads are included in advance time.

| ending walked age | actual days | advance wall s | advance CPU s | inspection wall s | inspection CPU s | new facts |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | 365 | 0.922 | 1.594 | 0.149 | 0.156 | 440 |
| 12 | 365 | 0.659 | 1.031 | 0.149 | 0.141 | 526 |
| 13 | 365 | 0.809 | 0.953 | 0.135 | 0.125 | 619 |
