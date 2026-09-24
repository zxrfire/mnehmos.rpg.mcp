/**
 * Making a thing takes days, and happens in the room it is made in.
 *
 * Refining and a bench took no time at all. Pinned here:
 *
 *   THE DAYS     a pill or an artifact takes its grade's days at the gate (two
 *                weeks, two months, nine years - the last the deepest road's
 *                copy), fewer for a hand whose time is worth more, and never
 *                fewer than its grade's floor: a week, a month, a year, as the
 *                design owner set them. A slip is a third of a day whatever the
 *                grade, the owner's three communication talismans a sitting.
 *   THE ROOM     somebody at the work of their rank whose activity names a pill
 *                is in the alchemy hall; one naming a made artifact is in the
 *                Artifact Refining Hall; a copy of an art is not moved by it.
 *   THE VESSEL   a cauldron and an artifact refining furnace are one model with
 *                the kind as data, and are worth the same for the same grade.
 *
 * Red-checked: pinning `daysAtTheWork` to 0 fails the days block, and dropping
 * the making branch from `whereTheyAreStanding` fails the room block.
 */

import { describe, expect, it } from 'vitest';
import {
    DAYS_AT_THE_GATE,
    DAYS_TO_CUT_A_SLIP,
    THE_FEWEST_DAYS_THE_WORK_TAKES,
    YEARS_TO_MAKE_A_HEAVEN_THING,
    daysAtTheWork,
    whatACommissionComesTo,
    whatASlipIsWorth,
    whatAYearOfAMakersTimeIsWorth
} from '../../../src/engine/social-leverage/commissioning-a-craft.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { YEARS_TO_COPY_THE_DEEPEST_ROAD } from '../../../src/engine/world/manuals.js';
import { CUT_IN_A_SITTING, DAYS_A_SITTING_TAKES } from '../../../src/data/cultivation/communication-talismans.js';
import { refiningOrdinalFor } from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    REFINING_VESSELS,
    theVesselFor,
    whatThisCauldronAddsFor,
    whatThisVesselAddsFor
} from '../../../src/engine/cultivation/what-you-refine-in.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import {
    whatIsBeingMade,
    whereCompoundsAre,
    whereTheyAreStanding
} from '../../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { ARTIFACTS } from '../../../src/data/cultivation/artifacts.js';

describe('the days a made thing takes', () => {
    it('takes the grade\'s days at the gate, and the heaven anchor is the deepest road\'s copy', () => {
        expect(YEARS_TO_MAKE_A_HEAVEN_THING).toBe(YEARS_TO_COPY_THE_DEEPEST_ROAD);
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            expect(daysAtTheWork(grade, refiningOrdinalFor(grade))).toBe(Math.ceil(DAYS_AT_THE_GATE[grade]));
            // The gate sits above the floor, so skill has room to save time.
            expect(DAYS_AT_THE_GATE[grade]).toBeGreaterThan(THE_FEWEST_DAYS_THE_WORK_TAKES[grade]);
        }
        expect(THE_FEWEST_DAYS_THE_WORK_TAKES).toEqual({ mortal: 7, earth: 30, heaven: DAYS_PER_YEAR });
    });

    it('is quicker for a hand past the grade, and never below the grade\'s floor however strong', () => {
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            const gate = refiningOrdinalFor(grade);
            let before = Infinity;
            for (let o = gate; o <= MAX_ORDINAL; o++) {
                const days = daysAtTheWork(grade, o);
                expect(days, `${grade} at ${o}`).toBeLessThanOrEqual(before);
                expect(days, `${grade} at ${o}`).toBeGreaterThanOrEqual(THE_FEWEST_DAYS_THE_WORK_TAKES[grade]);
                before = days;
            }
            expect(daysAtTheWork(grade, MAX_ORDINAL)).toBeLessThan(daysAtTheWork(grade, gate));
        }
    });

    it('cuts a slip in a third of a day whatever its grade, because the floor is for a pill or an artifact', () => {
        expect(DAYS_TO_CUT_A_SLIP).toBe(DAYS_A_SITTING_TAKES / CUT_IN_A_SITTING);
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            expect(daysAtTheWork(grade, refiningOrdinalFor(grade), { aSlip: true })).toBe(1);
        }
    });

    /**
     * AND THE GUARD IS THE PRICE, NOT THE TIME. A slip quick to cut is worth a
     * third of its cutter's day and its materials, and a commission for one states
     * that, in whole stones and never less than one.
     */
    it('prices a slip at a third of its cutter\'s day and its materials, however strong the cutter', () => {
        for (const ordinal of [13, 20, 29, 35]) {
            const aThirdOfADay = whatAYearOfAMakersTimeIsWorth(ordinal) / DAYS_PER_YEAR * DAYS_TO_CUT_A_SLIP;
            expect(whatASlipIsWorth(ordinal)).toBeCloseTo(aThirdOfADay, 9);
            expect(whatACommissionComesTo('mortal', false, ordinal, true))
                .toBe(Math.max(1, Math.round(whatASlipIsWorth(ordinal))));
        }
    });
});

describe('somebody making a thing is in the room it is made in', () => {
    const pill = PILLS[0]!;
    const artifact = ARTIFACTS[0]!;

    const aCompound = () => {
        const seat = makeLocation({ id: 'seat', name: 'House grounds', kind: 'sect_seat' });
        seat.data.factionId = 'house';
        const precinct = makeLocation({ id: 'p0', name: 'House: the outer precinct', kind: 'precinct', parentId: 'seat', tags: ['interior'] });
        const room = (purpose: string) => {
            const row = makeLocation({ id: purpose, name: `House: the ${purpose}`, kind: 'hall', parentId: 'p0', tags: ['interior'] });
            row.data.purpose = purpose;
            return row;
        };
        return [seat, precinct, room('alchemy_hall'), room('artifact_refining_hall'), room('workshop'), room('scripture_pavilion')];
    };

    const somebodyMaking = (thingId: string | null) => ({
        id: 'maker', status: 'alive', locationId: 'seat', factionId: 'house', factionRankIndex: 1,
        activity: { kind: 'the_work_of_their_rank', note: 'making it', withIds: [], sinceDay: 0, untilDay: 50, thingId }
    });

    const whereIs = (thingId: string | null) => {
        const locations = aCompound();
        const npc = somebodyMaking(thingId) as never;
        const state = { locations, npcs: [npc], factions: [{ id: 'house', ranks: ['a', 'b'] }], currentDay: 10 } as never;
        return whereTheyAreStanding(state, whereCompoundsAre(state), npc, new Set(['maker']));
    };

    it('reads the kind of thing off the catalog it is in', () => {
        expect(whatIsBeingMade(pill.id)).toBe('medicine');
        expect(whatIsBeingMade(artifact.id)).toBe('an_artifact');
        expect(whatIsBeingMade('communication-talisman')).toBeNull();
        expect(whatIsBeingMade(null)).toBeNull();
    });

    it('puts medicine in the alchemy hall and a made artifact in the Artifact Refining Hall', () => {
        expect(whereIs(pill.id)).toBe('alchemy_hall');
        expect(whereIs(artifact.id)).toBe('artifact_refining_hall');
        expect(whereIs('lesser-qi-gathering-manual')).toBe('seat');
    });
});

describe('a vessel is one model with the kind as data', () => {
    it('has a cauldron for medicine and a refining furnace for artifacts, worth the same by grade', () => {
        expect(theVesselFor('medicine').kind).toBe('cauldron');
        expect(theVesselFor('an_artifact').kind).toBe('refining_furnace');
        expect(Object.keys(REFINING_VESSELS).sort()).toEqual(['cauldron', 'refining_furnace']);
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            const at = refiningOrdinalFor(grade);
            expect(whatThisVesselAddsFor('refining_furnace', grade, at)).toBe(whatThisCauldronAddsFor(grade, at));
            expect(whatThisVesselAddsFor('refining_furnace', grade, at - 1)).toBe(0);
        }
    });
});
