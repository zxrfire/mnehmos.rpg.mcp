/**
 * The sea crossing arithmetic.
 *
 * What is being asserted is not "the numbers are these numbers" - it is that a
 * crossing behaves like a different KIND of thing from a road. Each block below
 * names the land behaviour it is refusing to reproduce, because the failure
 * mode this module exists to prevent is sea travel that is land travel with a
 * different noun on it.
 */

import { describe, it, expect } from 'vitest';
import {
    ADVANCING_BURN_MULTIPLIER,
    CUSTOMARY_PROVISIONING_MARGIN,
    STONES_BURNED_PER_HEAD_PER_DAY,
    WATER_CUPS_PER_HEAD_PER_DAY,
    canTurnBack,
    commitDayOf,
    laneIsOpenInMonth,
    provisionForLane,
    quotePassage,
    resolveCrossing,
    stoneBurnFor,
    waterCupsAboard,
    type SeaLane
} from '../../../src/engine/world/what-a-sea-crossing-costs.js';
import { SEA_LANES, getSeaLane } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';

const NOWHERE_TO_STOP: SeaLane = {
    id: 'lane-test-open',
    fromPlace: 'A',
    toPlace: 'B',
    expectedDays: 20,
    openMonthsPerYear: 12,
    intermediateLandfallDays: [],
    weatherSeverity: 1
};

const ROCK_IN_THE_MIDDLE: SeaLane = {
    ...NOWHERE_TO_STOP,
    id: 'lane-test-landfall',
    intermediateLandfallDays: [8]
};

describe('you cannot stop where you like', () => {
    it('has a commit point, which a road does not', () => {
        // On a road any village is an exit. The whole difference is that a
        // crossing has a middle, and past it turning back is not shorter.
        expect(commitDayOf(NOWHERE_TO_STOP)).toBe(10);
        expect(canTurnBack(NOWHERE_TO_STOP, 9)).toBe(true);
        expect(canTurnBack(NOWHERE_TO_STOP, 10)).toBe(false);
        expect(canTurnBack(NOWHERE_TO_STOP, 19)).toBe(false);
    });

    it('makes a rock in the middle a different lane at the same length', () => {
        // Same days, same weather, and a materially different proposition,
        // because a hull that has passed a landfall is running for that
        // landfall rather than for where it started. This is why Thousand Sail Harbour
        // exists at all and why the eastern passage is the busiest water in
        // the world at twenty-one days while a shorter lane is feared.
        expect(commitDayOf(ROCK_IN_THE_MIDDLE)).toBe(8);
        expect(commitDayOf(ROCK_IN_THE_MIDDLE))
            .toBeLessThan(commitDayOf(NOWHERE_TO_STOP));
        expect(canTurnBack(ROCK_IN_THE_MIDDLE, 9)).toBe(false);
    });

    it('puts a landfall inside the commit point on exactly one authored lane', () => {
        const withOne = SEA_LANES.filter(l =>
            l.intermediateLandfallDays.some(d => d <= l.expectedDays / 2));
        // The river mouth is coastal the whole way and the capes have nothing.
        // The eastern passage is the one long crossing with somewhere in it,
        // and that is a fact about the map rather than a coincidence.
        expect(withOne.map(l => l.id)).toContain('lane-eastern-passage');
        const capes = getSeaLane('lane-the-northern-capes')!;
        expect(capes.intermediateLandfallDays).toEqual([]);
    });
});

describe('the weather closes it, and nobody can appeal to the weather', () => {
    it('shuts a lane outside its season, which no road does', () => {
        const capes = getSeaLane('lane-the-northern-capes')!;
        expect(capes.openMonthsPerYear).toBe(2);
        // Open around midyear and shut at the turn. A road can be closed by a
        // party and reopened by paying them; this cannot be paid.
        expect(laneIsOpenInMonth(capes, 6)).toBe(true);
        expect(laneIsOpenInMonth(capes, 1)).toBe(false);
        expect(laneIsOpenInMonth(capes, 12)).toBe(false);
        // And a coastal lane is worked all year, which is why the Alliance
        // will run it and will not run anything else.
        const mouth = getSeaLane('lane-the-river-mouth')!;
        expect(mouth.openMonthsPerYear).toBe(12);
        for (let m = 1; m <= 12; m++) expect(laneIsOpenInMonth(mouth, m)).toBe(true);
    });

    it('returns a shut lane rather than a slow one', () => {
        const capes = getSeaLane('lane-the-northern-capes')!;
        const manifest = provisionForLane(capes, 10);
        const out = resolveCrossing('seed-a', capes, manifest, 1);
        expect(out.laneWasShut).toBe(true);
        expect(out.daysTaken).toBe(0);
        // Nothing ran out, because nothing left. A road in a bad season is a
        // longer road; a crossing in a shut season is not a route at all.
        expect(out.waterShortDays).toBe(0);
        expect(out.ranShortSideOfCommit).toBe('never');
    });
});

describe('it takes what it takes', () => {
    it('is reproducible from its seed, and varies between seeds', () => {
        const lane = getSeaLane('lane-eastern-passage')!;
        const manifest = provisionForLane(lane, 12);
        const a1 = resolveCrossing('seed-one', lane, manifest, 6);
        const a2 = resolveCrossing('seed-one', lane, manifest, 6);
        expect(a2).toEqual(a1);
        const durations = new Set<number>();
        for (let i = 0; i < 40; i++) {
            durations.add(resolveCrossing(`seed-${i}`, lane, manifest, 6).daysTaken);
        }
        // A road's length is its length. A crossing's is a distribution, and a
        // module that always returned the quoted figure would be a road.
        expect(durations.size).toBeGreaterThan(3);
    });

    it('runs long more often than the customary margin covers', () => {
        // The province's threat model: most people who die in the South die
        // because a passage took longer than it was provisioned for. If the
        // customary margin were always enough, that sentence would be false
        // and the whole province would be scenery.
        const lane = getSeaLane('lane-the-northern-capes')!;
        const manifest = provisionForLane(lane, 8);
        let short = 0;
        for (let i = 0; i < 200; i++) {
            if (resolveCrossing(`cape-${i}`, lane, manifest, 6).waterShortDays > 0) short++;
        }
        expect(short, 'the worst lane in the world never runs short').toBeGreaterThan(0);
        expect(short, 'nobody would ever sail it').toBeLessThan(200);
    });

    it('is safer on a coastal lane than on the capes, from weather alone', () => {
        const mouth = getSeaLane('lane-the-river-mouth')!;
        const capes = getSeaLane('lane-the-northern-capes')!;
        const storms = (lane: SeaLane): number => {
            let total = 0;
            for (let i = 0; i < 120; i++) {
                total += resolveCrossing(`w-${i}`, lane, provisionForLane(lane, 6), 6).stormDays;
            }
            return total / 120;
        };
        expect(storms(mouth)).toBeLessThan(storms(capes));
    });
});

describe('water is the constraint, and the ground gives nothing', () => {
    it('counts water in the unit the province says aloud', () => {
        const lane = getSeaLane('lane-eastern-passage')!;
        const manifest = provisionForLane(lane, 10);
        expect(manifest.waterDaysAboard)
            .toBe(Math.ceil(lane.expectedDays * (1 + CUSTOMARY_PROVISIONING_MARGIN)));
        expect(waterCupsAboard(manifest))
            .toBe(manifest.waterDaysAboard * 10 * WATER_CUPS_PER_HEAD_PER_DAY);
    });

    it('burns the same figure for a Core Formation cultivator and a porter', () => {
        // The single most quoted fact the Drowned Reach has about itself, and
        // it has to be true in code or it is prose. There is no realm argument
        // anywhere in the burn, so there is nowhere for one to creep in.
        expect(stoneBurnFor(21, 1)).toBe(21 * STONES_BURNED_PER_HEAD_PER_DAY);
        expect(stoneBurnFor(21, 10)).toBe(10 * stoneBurnFor(21, 1));
    });

    it('charges much more to gain than to hold', () => {
        const holding = stoneBurnFor(30, 4, 0);
        const oneGaining = stoneBurnFor(30, 4, 1);
        expect(oneGaining).toBeGreaterThan(holding);
        expect(oneGaining - holding)
            .toBe(30 * (ADVANCING_BURN_MULTIPLIER - 1) * STONES_BURNED_PER_HEAD_PER_DAY);
    });

    it('reports an empty chest as a shortfall rather than as a death', () => {
        // Nothing here may decide that somebody dies. It subtracts and reports,
        // and what a shortfall costs a body is the survival system's question.
        const lane = getSeaLane('lane-eastern-passage')!;
        const manifest = { ...provisionForLane(lane, 5), stonesInChest: 1 };
        const out = resolveCrossing('lean', lane, manifest, 6);
        expect(out.stonesShort).toBeGreaterThan(0);
        expect(Object.keys(out)).not.toContain('died');
    });
});

describe('a hull is somebody\'s property', () => {
    it('quotes per head per day, not per li', () => {
        // The unit change is the content. On a road you buy distance; out here
        // you buy somebody else's provisioning risk over an uncertain time.
        const lane = getSeaLane('lane-eastern-passage')!;
        const q = quotePassage(lane, 3, 45);
        expect(q.quotedDays).toBe(21);
        expect(q.fareCash).toBe(21 * 3 * 45);
        expect(q.heads).toBe(3);
    });

    it('never includes the chest in the fare', () => {
        const lane = getSeaLane('lane-eastern-passage')!;
        const q = quotePassage(lane, 2, 45, 1);
        expect(q.stonesBurned).toBe(stoneBurnFor(21, 2, 1));
        expect(q.notCovered.length).toBeGreaterThan(60);
        // A shipmaster quotes the expected passage and never the tail, which
        // is where every argument in the province comes from.
        expect(q.quotedDays).toBe(Math.ceil(lane.expectedDays));
    });
});
