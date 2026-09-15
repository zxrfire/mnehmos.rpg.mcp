/**
 * The copy rule: who may write a road out, what it costs them, and whether a
 * road can therefore reach a second pair of hands.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * Measured over two 5,000-year runs, the simulation could not produce anybody
 * above ordinal 37, and part of the reason was that the four canons reaching
 * the top of the ladder exist as single copies in single pairs of hands. A
 * holder dies and the road leaves the world. The design owner's ruling on the
 * copy rule has three parts, and this file holds each of them down.
 *
 * ── 1. THE BAR IS THE PEAK THE MANUAL REACHES, AND ALREADY WAS ───────────
 *
 * *"if the manual has brought you to the peak, it means you have mastered it,
 * and can copy it."*
 *
 * `masteryBarFor` returns the manual's `cap`, and `cap` is `realmEnd + 1`,
 * which reads like a rung past the end of the book. It is not.
 * `techniqueExhausted` stops a cultivator at `realmOrdinal >= cap`, so somebody
 * at `cap - 1` still accumulates and still breaks through: the last rung a
 * cap-45 road carries anybody to IS 45. The bar was never off by one and must
 * not be "corrected" to `cap - 1` - that would let somebody copy a book they
 * have not finished. The first assertion below is the ratchet against exactly
 * that edit, and it is why this reasoning is written down rather than fixed.
 *
 * Two comments in the tree read the other way and are about something else:
 * `realmsSpannedBy` says "the last rung actually taught is `cap - 1`" while
 * counting REALMS, where charging the cap's realm would report two for every
 * ordinary book; `monthsToCopy` says the same while counting SECTIONS OF PAPER.
 * Both are correct about their own question and neither is about how high the
 * book carries a reader.
 *
 * ── 2. A COPY COSTS A REAL SPAN, AND IT SCALES ───────────────────────────
 *
 * *"it takes them a while. enough time to matter."*
 *
 * It did not. `applyManualCopying` rolled `1/60` a year for a first copy and
 * `1/250` for a spare - two flat figures with no provenance, identical for a
 * village primer and an apex canon, and charged against nobody: a master
 * holding six roads got six independent rolls a year and gave up nothing to
 * take them. `yearsToWriteOutACopy` replaces both, anchored at the one figure
 * the world already states - `HIGH_REALM_PROVENANCE` has the Earth Vein
 * Tower's Assessor of the Deep costing a second copy of the house's only road
 * at *"somewhat over nine years of his own hours"* - and the pass now sits a
 * master at ONE desk.
 *
 * MEASURED across the shipped catalog: 2.0 months at cap 13, 4.5 years at cap
 * 29, 9.0 years at cap 45.
 *
 * ── 3. NO UNDERSTANDING, NO MANUAL ───────────────────────────────────────
 *
 * *"someone who doesn't understand it, even when copying the words, there is
 * no dao, so no manual."*
 *
 * `couldWriteOutACopy` opened with a clause returning true for anything a
 * stall carries. MEASURED: 35 of 149 capped manuals could be written out by
 * somebody standing at ordinal 0, the deepest capping at 33 and opening at 30 -
 * a rung its writer could not have opened the book at. There is no failed-copy
 * object in this engine and this does not add one: such a person simply cannot
 * produce a copy, which is what the rule already implies.
 *
 * ── WHAT THIS MOVES IN THE WORLD, MEASURED ──────────────────────────────
 *
 * Two seeds, 200 lived years, both arms run against this file alone with only
 * the copying pass changed between them:
 *
 *     manual rows   474 -> 725 before,  474 -> 880 after
 *     copies      2,333 -> 2,935 before, 2,333 -> 5,170 after
 *     distinct roads in circulation  123 and 126, unchanged in both arms
 *
 * So no new ROAD enters the world - what changes is that houses stop being
 * short of the cheap end of their own shelf, which is the direct consequence of
 * a primer costing two months instead of sixty years. Three assertions in
 * neighbouring soaks moved with it and are named in this work's report; each is
 * a marginal count on a seed (`> 0` over two or six seeds) rather than a
 * statement about copying, and none of them calls the copy rule.
 *
 * Every assertion below was red-checked against the behaviour it covers.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import {
    applyManualCopying,
    couldWriteOutACopy,
    masteryBarFor,
    yearsToWriteOutACopy,
    COMMON_MANUAL_CAP,
    YEARS_TO_COPY_A_PRIMER,
    YEARS_TO_COPY_THE_DEEPEST_ROAD
} from '../../../src/engine/world/manuals.js';
import { monthsToCopy } from '../../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { techniqueExhausted } from '../../../src/engine/cultivation/cultivation.js';
import { TECHNIQUES, stopsSomewhere } from '../../../src/data/cultivation/techniques.js';

const YEAR = 365;

const ROADS = TECHNIQUES.filter(t => stopsSomewhere(t));
const DEEPEST_CAP = Math.max(...ROADS.map(t => Number(t.cap)));

// ─────────────────────────────────────────────────────────────────────────
// 1. THE BAR IS THE PEAK
// ─────────────────────────────────────────────────────────────────────────

describe('the bar to copy a road is the last rung the road carries anybody to', () => {
    it('is the rung the book stops at, for every capped road in the catalog', () => {
        for (const t of ROADS) {
            const cap = Number(t.cap);
            const bar = masteryBarFor(t.id);
            expect(bar, t.id).toBe(cap);
            // One under the bar, the book is still teaching.
            expect(techniqueExhausted(bar! - 1, cap), t.id).toBe(false);
            // At the bar, it has nothing left. That is the peak, and finishing
            // the book is what the ruling calls mastering it.
            expect(techniqueExhausted(bar!, cap), t.id).toBe(true);
        }
    });

    it('the eight roads that stop nowhere fall back to the top of the ladder', () => {
        const capless = TECHNIQUES.filter(t => !stopsSomewhere(t));
        expect(capless.length).toBeGreaterThan(0);
        for (const t of capless) {
            expect(masteryBarFor(t.id), t.id).toBe(DEEPEST_CAP);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. NO UNDERSTANDING, NO MANUAL
// ─────────────────────────────────────────────────────────────────────────

describe('a copy is not a transcription', () => {
    it('somebody who has not finished a stall primer cannot write one out', () => {
        const primer = ROADS.find(t => Number(t.cap) <= COMMON_MANUAL_CAP);
        expect(primer, 'the catalog carries no book a stall would stock').toBeTruthy();
        const bar = masteryBarFor(primer!.id)!;
        expect(couldWriteOutACopy({ realmOrdinal: 0 }, primer!.id)).toBe(false);
        expect(couldWriteOutACopy({ realmOrdinal: bar - 1 }, primer!.id)).toBe(false);
        // And the person who took it to the end can.
        expect(couldWriteOutACopy({ realmOrdinal: bar }, primer!.id)).toBe(true);
    });

    it('nobody standing at the bottom can write out anything at all', () => {
        const atTheBottom = ROADS.filter(t => couldWriteOutACopy({ realmOrdinal: 0 }, t.id));
        expect(atTheBottom.map(t => t.id)).toEqual([]);
    });

    it('a mastery figure the caller holds still beats the ordinal proxy', () => {
        const road = ROADS.find(t => Number(t.cap) === DEEPEST_CAP)!;
        // Standing high and holding a tenth of it: paper, not a manual.
        expect(couldWriteOutACopy(
            { realmOrdinal: DEEPEST_CAP, masteryOfIt: 0.1 }, road.id
        )).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. WHAT A COPY COSTS
// ─────────────────────────────────────────────────────────────────────────

describe('a copy is a span of the writer own life, and it scales', () => {
    it('costs nine years at the top of the ladder and two months at the bottom', () => {
        const deepest = ROADS.find(t => Number(t.cap) === DEEPEST_CAP)!;
        const primer = ROADS.find(t => Number(t.cap) <= COMMON_MANUAL_CAP)!;
        expect(yearsToWriteOutACopy(deepest.id)).toBeCloseTo(YEARS_TO_COPY_THE_DEEPEST_ROAD, 5);
        expect(yearsToWriteOutACopy(primer.id)).toBeCloseTo(YEARS_TO_COPY_A_PRIMER, 5);
        // The floor agrees with what a stall pays a copyist for the same book,
        // which is the one place the two readings of "how long" have to meet.
        expect(yearsToWriteOutACopy(primer.id)! * 12)
            .toBeCloseTo(monthsToCopy(Number(primer.requiredOrdinal ?? 0), Number(primer.cap)), 5);
    });

    it('never charges a primer what it charges a canon', () => {
        const spans = new Map<number, number>();
        for (const t of ROADS) spans.set(Number(t.cap), yearsToWriteOutACopy(t.id)!);
        const byCap = [...spans].sort((a, b) => a[0] - b[0]);
        expect(byCap.length).toBeGreaterThan(3);
        for (let i = 1; i < byCap.length; i++) {
            expect(byCap[i][1], `cap ${byCap[i][0]}`).toBeGreaterThan(byCap[i - 1][1]);
        }
        // Not a rounding difference: the deepest road is an order of magnitude
        // more of somebody's life than the shallowest.
        expect(byCap[byCap.length - 1][1] / byCap[0][1]).toBeGreaterThan(10);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE SPAN BITES: ONE MASTER, ONE DESK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Two roads nothing about a reader's root can refuse, so the shortage is real,
 * and SHALLOW ones on purpose: a primer's span is two months, so the yearly
 * roll is a certainty and what is being measured is the desk rather than the
 * dice. With the roll taken per art - the shape before this work - a master
 * holding both finished both every year.
 */
const TWO_SHALLOW_ROADS = ROADS
    .filter(t => (t.element ?? null) === null && Number(t.cap) <= COMMON_MANUAL_CAP)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 2);

function aHouseWithOneMasterOfTwoRoads(): {
    state: WorldState;
    master: NpcRecord;
    factionId: string;
} {
    const state = seedWorld({
        seed: 'one-desk', catalog: fixtureCatalog(), presentYear: 1000, population: 60
    }).state;
    const faction = state.factions.find(f => f.dissolvedOnDay === null)!;
    const factionId = faction.id;

    // The house holds no copy of either road, so both are a first copy and the
    // shortage is the whole membership.
    state.objects = state.objects.filter(
        o => !(o.kind === 'manual' && o.possessorId === factionId)
    );

    const master = createNpc(state.seed, {
        id: 'the-one-who-can-write',
        name: 'The One Who Can Write',
        bornOnDay: 0,
        onDay: state.currentDay,
        factionId,
        factionRankIndex: 0,
        locationId: faction.seatLocationId,
        cultivation: {
            realmOrdinal: Math.max(...TWO_SHALLOW_ROADS.map(t => Number(t.cap))),
            techniqueIds: TWO_SHALLOW_ROADS.map(t => t.id)
        }
    });
    state.npcs.push(master);

    // People for the copies to be for. A shortage is what makes anybody sit
    // down, and a four-person house runs out of anybody to hand a book to
    // before the measurement has taken hold.
    for (let i = 0; i < 24; i++) {
        state.npcs.push(createNpc(state.seed, {
            id: `waiting-${i}`,
            bornOnDay: 0,
            onDay: state.currentDay,
            factionId,
            factionRankIndex: 0,
            locationId: faction.seatLocationId,
            cultivation: { realmOrdinal: 1, techniqueIds: [] }
        }));
    }
    return { state, master, factionId };
}

describe('a master writes one book at a time, because the years are theirs', () => {
    it('has two roads its house lacks and never finishes two in one year', () => {
        expect(
            TWO_SHALLOW_ROADS.length,
            'the catalog no longer carries two rootless roads a stall would stock'
        ).toBe(2);

        const { state, master } = aHouseWithOneMasterOfTwoRoads();
        const written = new Set<string>();
        let mostInOneYear = 0;
        for (let year = 1; year <= 600; year++) {
            const mine = applyManualCopying(state, year, state.currentDay + year * YEAR)
                .filter(c => c.masterId === master.id);
            mostInOneYear = Math.max(mostInOneYear, mine.length);
            for (const c of mine) written.add(c.techniqueId);
        }
        // The test would say nothing if nobody ever sat down.
        expect(written.size, 'the master wrote nothing in six centuries').toBeGreaterThan(0);
        expect(mostInOneYear).toBe(1);
    });

    it('gets to both of them eventually, so the desk is a queue and not a wall', () => {
        const { state, master } = aHouseWithOneMasterOfTwoRoads();
        const written = new Set<string>();
        for (let year = 1; year <= 600; year++) {
            for (const c of applyManualCopying(state, year, state.currentDay + year * YEAR)) {
                if (c.masterId === master.id) written.add(c.techniqueId);
            }
        }
        expect([...written].sort()).toEqual(TWO_SHALLOW_ROADS.map(t => t.id).sort());
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHETHER A ROAD CAN OUTLIVE THE PERSON WHO FOUND IT
// ─────────────────────────────────────────────────────────────────────────

describe('a road at the top of the ladder can reach a second pair of hands', () => {
    it('is copyable by somebody the road itself carried to its peak', () => {
        const apex = ROADS.filter(t => Number(t.cap) >= 41);
        expect(apex.length).toBeGreaterThan(0);
        for (const t of apex) {
            const cap = Number(t.cap);
            // Somebody who opened it where it opens and rode it to the end.
            expect(couldWriteOutACopy({ realmOrdinal: cap }, t.id), t.id).toBe(true);
            // And one rung short of the end, they cannot - which is the whole
            // of why a road dies with a holder who stops early.
            expect(couldWriteOutACopy({ realmOrdinal: cap - 1 }, t.id), t.id).toBe(false);
        }
    });
});
