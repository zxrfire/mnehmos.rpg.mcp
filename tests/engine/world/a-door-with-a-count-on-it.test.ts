/**
 * Every door in the world was the everyone-walks-in cell.
 *
 * MEASURED, on three pinned worlds advanced two hundred years
 * (`probe-what-cell-of-the-door-table-every-ruin-is-in.ts`): 42, 35 and 39
 * ruins; 0 held by anybody; 0 admitting a count. A place at a find was never
 * scarce, so it could never be given, and the whole allocation the design turns
 * on had nothing to allocate.
 *
 * WHAT THESE ASSERTIONS ENCODE. Two independent questions, four cells:
 *
 *   held    + counted    doled out per house
 *   held    + uncounted  open on the holder's terms
 *   unheld  + counted    N places and nobody to assign them
 *   unheld  + uncounted  anybody who turns up goes in
 *
 * The one that is easiest to get wrong, and is therefore pinned hardest: A
 * HOLDER DOES NOT MAKE SLOTS. Putting people at a door lets a house turn
 * somebody away, charge them or wave them past. It does not invent a count the
 * ground does not have, which is why the two questions multiply instead of
 * forming a list of three.
 *
 * Red-checked: inverting the `cycle === null` guard in `placesAtThisDoor` turns
 * every one of the cell assertions red, and dropping the holder check turns the
 * first two red only.
 */

import { describe, expect, it } from 'vitest';

import {
    isGroundWithADoor,
    placesAtThisDoor,
    waysInTo,
    whatADoorAdmits,
    whatADoorSomebodyPaysAtTakesInAYear,
    whatTheHolderDoesWithIt
} from '../../../src/engine/world/a-door-with-a-count-on-it.js';
import { whatItTakesToHold } from '../../../src/engine/world/a-house-that-shuts-a-public-ruin.js';
import {
    A_HOARD_WORTH_WAITING_FOR
} from '../../../src/engine/world/how-long-a-door-stays-shut.js';
import {
    makeLocation,
    makeThresholds,
    type LocationRecord,
    type OpeningCycle
} from '../../../src/engine/world/locations.js';
import { WHAT_ONE_POST_TAKES_IN_A_YEAR } from '../../../src/engine/world/seeding.js';

const SEASON: OpeningCycle = { periodDays: 60 * 365, openDays: 21, phaseDay: 100 };

function door(over: Partial<LocationRecord> = {}): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-cold-spring',
        name: 'Lone Spring',
        kind: 'ruin',
        parentId: 'loc-prov-here',
        qiDensity: 60,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: false,
        ...over
    });
}

describe('a door with a count on it', () => {
    it('counts nobody at a door with no season on it', () => {
        expect(placesAtThisDoor(door({ cycle: null }))).toBeNull();
    });

    it('counts the ways in times the party an opening takes', () => {
        const d = door({ cycle: SEASON });
        expect(placesAtThisDoor(d)).toBe(waysInTo(d) * whatItTakesToHold(d).hands);
        expect(waysInTo(d)).toBeGreaterThan(0);
    });

    // ── THE FOUR CELLS ───────────────────────────────────────────────────

    it('deals the places out where a house holds counted ground', () => {
        const read = whatADoorAdmits({
            ruin: door({ cycle: SEASON, controllingFactionId: 'f-a' })
        });
        expect(read.cell).toBe('doled_out');
        expect(read.places).toBeGreaterThan(0);
        expect(read.account).toContain('no going anyway');
    });

    it('leaves uncounted held ground open on the holder\'s terms', () => {
        const read = whatADoorAdmits({
            ruin: door({ cycle: null, controllingFactionId: 'f-a' })
        });
        expect(read.cell).toBe('open_on_the_holders_terms');
        expect(read.places).toBeNull();
        expect(read.holdersTerms).not.toBeNull();
    });

    it('leaves counted unheld ground to be settled with fists', () => {
        const read = whatADoorAdmits({ ruin: door({ cycle: SEASON }) });
        expect(read.cell).toBe('settled_with_fists');
        expect(read.places).toBeGreaterThan(0);
        expect(read.account).toContain('nobody to say');
    });

    it('lets anybody who turns up into uncounted unheld ground', () => {
        const read = whatADoorAdmits({ ruin: door({ cycle: null }) });
        expect(read.cell).toBe('anybody_who_turns_up');
        expect(read.places).toBeNull();
    });

    // ── THE RULE THE TABLE RESTS ON ──────────────────────────────────────

    it('does not let a holder invent a count the ground has not got', () => {
        const open = door({ cycle: null });
        const held = door({ cycle: null, controllingFactionId: 'f-a' });
        expect(placesAtThisDoor(open)).toBeNull();
        expect(placesAtThisDoor(held)).toBeNull();
        expect(placesAtThisDoor(held)).toEqual(placesAtThisDoor(open));
    });

    it('does not take a count off ground because somebody took it', () => {
        const open = door({ cycle: SEASON });
        const held = door({ cycle: SEASON, controllingFactionId: 'f-a' });
        expect(placesAtThisDoor(held)).toEqual(placesAtThisDoor(open));
    });

    it('has no door at all on ground that is not a find', () => {
        const town = makeLocation({
            id: 'loc-town', name: 'Nine Fords', kind: 'settlement', cycle: SEASON
        });
        expect(isGroundWithADoor(town)).toBe(false);
        expect(placesAtThisDoor(town)).toBeNull();
    });

    // ── THE HOLDER'S THREE SHAPES, ROUTED RATHER THAN REBUILT ────────────

    it('leaves a bequest standing open and charges at ground it broke open', () => {
        const d = door({ controllingFactionId: 'f-a' });
        expect(whatTheHolderDoesWithIt(d, A_HOARD_WORTH_WAITING_FOR, true)).toBe('left_open');
        // Nothing recorded about who built it: not a bequest, so it was opened
        // by whoever is standing at it, and they charge.
        const shapes = new Set(
            ['a', 'b', 'c', 'd', 'e', 'f'].map(suffix =>
                whatTheHolderDoesWithIt(door({ id: `loc-ruin-${suffix}` }), 0, false))
        );
        expect(shapes.has('you_pay')).toBe(true);
        expect(shapes.has('left_open')).toBe(false);
    });

    it('prices a paid door off the levy and not off a second toll', () => {
        const prices = [
            whatADoorSomebodyPaysAtTakesInAYear(door({ qiDensity: 5 })),
            whatADoorSomebodyPaysAtTakesInAYear(door({ qiDensity: 60 })),
            whatADoorSomebodyPaysAtTakesInAYear(door({ qiDensity: 99 }))
        ];
        for (const price of prices) {
            expect(Object.values(WHAT_ONE_POST_TAKES_IN_A_YEAR)).toContain(price);
        }
        expect(prices[2]).toBeGreaterThan(prices[0]);
    });
});
