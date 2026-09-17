/**
 * Making a thing takes days, and happens in the room it is made in.
 *
 * Refining and a bench took no time at all. Pinned here:
 *
 *   THE CURVE    one curve over the grade, anchored at two ends the world
 *                already states: a mortal slip is a third of a day (three
 *                communication talismans a sitting, the design owner's own
 *                figure) and heaven-grade work is nine years at the gate (the
 *                deepest road's copy, the longest single work the world states).
 *                A hand past the grade is quicker, and never free.
 *   THE ROOM     somebody at the work of their rank whose activity names a pill
 *                is in the alchemy hall; one naming a made artifact is in the
 *                Artifact Refining Hall; a copy of an art is not moved by it.
 *   THE VESSEL   a cauldron and an artifact refining furnace are one model with
 *                the kind as data, and are worth the same for the same grade.
 *
 * Red-checked: pinning `daysAtTheWork` to 0 fails the curve block, and dropping
 * the making branch from `whereTheyAreStanding` fails the room block.
 */

import { describe, expect, it } from 'vitest';
import {
    A_HAND_FAR_PAST_IT_STILL_SPENDS,
    DAYS_TO_MAKE_A_MORTAL_THING,
    YEARS_TO_MAKE_A_HEAVEN_THING,
    daysAtTheWork
} from '../../../src/engine/social-leverage/commissioning-a-craft.js';
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
    it('is anchored at the two ends the world already states', () => {
        expect(DAYS_TO_MAKE_A_MORTAL_THING).toBe(DAYS_A_SITTING_TAKES / CUT_IN_A_SITTING);
        expect(YEARS_TO_MAKE_A_HEAVEN_THING).toBe(YEARS_TO_COPY_THE_DEEPEST_ROAD);
        expect(daysAtTheWork('mortal', refiningOrdinalFor('mortal'))).toBe(1);
        expect(daysAtTheWork('heaven', refiningOrdinalFor('heaven')))
            .toBe(Math.ceil(YEARS_TO_MAKE_A_HEAVEN_THING * DAYS_PER_YEAR));
    });

    it('climbs with the grade, and is quicker for a hand past it but never free', () => {
        const gateEarth = refiningOrdinalFor('earth');
        expect(daysAtTheWork('earth', gateEarth)).toBeGreaterThan(daysAtTheWork('mortal', gateEarth));
        expect(daysAtTheWork('heaven', refiningOrdinalFor('heaven'))).toBeGreaterThan(daysAtTheWork('earth', gateEarth));
        expect(daysAtTheWork('earth', gateEarth + 10)).toBeLessThan(daysAtTheWork('earth', gateEarth));
        expect(daysAtTheWork('earth', 999)).toBeGreaterThanOrEqual(1);
        expect(A_HAND_FAR_PAST_IT_STILL_SPENDS).toBeGreaterThan(0);
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
