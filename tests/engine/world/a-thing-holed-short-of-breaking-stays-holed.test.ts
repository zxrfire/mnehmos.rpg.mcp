/**
 * Durability is damage, not wear.
 *
 * The owner: items have durability, *"but not the usage kind, the partial
 * damage kind"*. A thing a force reaches past what it is made for comes out
 * holed or, far enough past, broken. A hole stays until mended and works a rung
 * worse while it is: a blade prices a rung lower in a fight, a ward answers a
 * rung lower over its ground. Nothing is worn by ordinary use.
 */

import { describe, expect, it } from 'vitest';
import { combatPowerForOrdinal } from '../../../src/engine/cultivation/combat.js';
import {
    REALM_POWER_STEP,
    weaponExposure
} from '../../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import {
    isHoled,
    mend,
    rungsTheHolesTake,
    theConditionItIsIn,
    whatAFightMarked,
    writeBackWhatAFightLeft
} from '../../../src/engine/world/object-damage.js';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { whatAHouseIsMadeOf } from '../../../src/engine/world/what-a-house-is-made-of-and-what-brings-it-down.js';
import { theWeaponTheyFightWith } from '../../../src/engine/world/what-somebody-fights-with.js';

const BLADE_AT = 20;

/** A swing of a blade rated 20 into a body `realms` realms above it; a drawn roll that did not break it holed it. */
function aSwing(realms: number, roll: number | null, broke = false) {
    const exposure = weaponExposure({
        weaponPower: BLADE_AT,
        weaponStanding: combatPowerForOrdinal(BLADE_AT),
        metBy: combatPowerForOrdinal(BLADE_AT) * Math.pow(REALM_POWER_STEP, realms),
        metByBodyAlone: combatPowerForOrdinal(BLADE_AT) * Math.pow(REALM_POWER_STEP, realms),
        metByOrdinal: 40,
        standingOf: combatPowerForOrdinal
    });
    return { objectId: 'blade', objectName: 'the blade', exposure, roll, broke, holed: roll !== null && !broke };
}

const exchange = (weapon: ReturnType<typeof aSwing> | null) =>
    ({ attackerId: 'wu', defenderId: 'tall', result: { weapon } });

function blade(): ObjectRecord {
    return makeObject({
        id: 'blade', name: 'the blade', kind: 'artifact', power: BLADE_AT,
        possessorId: 'wu', ownerId: 'wu', ownerName: 'Wu'
    });
}

const nameOf = (id: string) => (id === 'wu' ? 'Wu' : 'the tall one');

describe('a fight marks what it does not end', () => {
    it('a swing that was at risk and marked it leaves a hole, one rung down', () => {
        const swing = aSwing(1.5, 0.99);
        expect(swing.exposure.chance).toBeGreaterThan(0);
        expect(swing.exposure.chance).toBeLessThan(1);

        const objects = [blade()];
        const marked = writeBackWhatAFightLeft(objects, whatAFightMarked([exchange(swing)]), {
            onDay: 10, fight: 'a fight', nameOf
        });
        expect(marked.map(m => m.state)).toEqual(['holed']);
        expect(objects[0]!.power).toBe(BLADE_AT - 1);
        expect(isHoled(objects[0]!)).toBe(true);
        expect(rungsTheHolesTake(objects[0]!)).toBe(1);
    });

    it('a swing the blade was made for leaves nothing, so ordinary use wears nothing', () => {
        const objects = [blade()];
        const fit = aSwing(0.5, null);
        expect(fit.exposure.chance).toBe(0);
        const marked = writeBackWhatAFightLeft(
            objects, whatAFightMarked([exchange(fit), exchange(fit), exchange(fit)]),
            { onDay: 10, fight: 'a fight', nameOf });
        expect(marked).toEqual([]);
        expect(objects[0]!.power).toBe(BLADE_AT);
        expect(theConditionItIsIn(objects[0]!)).toBeNull();
    });

    it('marks a thing once a fight, however many exchanges it came through', () => {
        const objects = [blade()];
        const at = aSwing(1.5, 0.99);
        writeBackWhatAFightLeft(objects, whatAFightMarked([exchange(at), exchange(at), exchange(at)]), {
            onDay: 10, fight: 'a fight', nameOf
        });
        expect(objects[0]!.power).toBe(BLADE_AT - 1);
    });

    it('leaves a thing that broke in the fight to the breaking', () => {
        expect(whatAFightMarked([exchange(aSwing(1.5, 0.99)), exchange(aSwing(1.5, 0.01, true))]))
            .toEqual([]);
    });

    it('states the condition as a fact a holder can read, with the rung that mends it', () => {
        const objects = [blade()];
        writeBackWhatAFightLeft(objects, whatAFightMarked([exchange(aSwing(1.5, 0.99))]), {
            onDay: 10, fight: 'a fight', nameOf
        });
        const said = theConditionItIsIn(objects[0]!)!;
        expect(said).toContain('holed once');
        expect(said).toContain(`${BLADE_AT - 1} of the ${BLADE_AT}`);
        expect(said).toContain(`a hand at ${BLADE_AT}`);
    });
});

describe('a holed blade cuts a rung worse', () => {
    it('fights at the rung its row stands at, carried in the pouch or in hand', () => {
        const objects = [blade()];
        writeBackWhatAFightLeft(objects, whatAFightMarked([exchange(aSwing(1.5, 0.99))]), {
            onDay: 10, fight: 'a fight', nameOf
        });
        expect(theWeaponTheyFightWith(objects, 'wu')?.power).toBe(BLADE_AT - 1);
        // The pouch keeps the catalog's rating; the row keeps the hole.
        const fromThePouch = { id: 'blade', name: 'the blade', power: BLADE_AT };
        expect(theWeaponTheyFightWith(objects, 'somebody-else', fromThePouch)?.power).toBe(BLADE_AT - 1);
        expect(theWeaponTheyFightWith([], 'somebody-else', fromThePouch)?.power).toBe(BLADE_AT);
    });
});

describe('and it stays holed until a hand at its rung mends it', () => {
    function holedBlade(): ObjectRecord {
        const objects = [blade()];
        writeBackWhatAFightLeft(objects, whatAFightMarked([exchange(aSwing(1.5, 0.99))]), {
            onDay: 10, fight: 'a fight', nameOf
        });
        return objects[0]!;
    }

    it('a hand below the rung it was made at cannot', () => {
        const tried = mend(holedBlade(), { byOrdinal: BLADE_AT - 1, onDay: 20, byId: 'wu', byName: 'Wu' });
        expect(tried.mended).toBe(false);
        expect(tried.account).toContain(String(BLADE_AT));
    });

    it('a hand at it puts it back whole', () => {
        const done = mend(holedBlade(), { byOrdinal: BLADE_AT, onDay: 20, byId: 'wu', byName: 'Wu' });
        expect(done.mended).toBe(true);
        expect(done.row.power).toBe(BLADE_AT);
        expect(isHoled(done.row)).toBe(false);
        expect(theConditionItIsIn(done.row)).toBeNull();
    });
});

describe('a holed ward answers lower over its ground', () => {
    const ward = (power: number, scars: number, tags: string[] = scars > 0 ? ['damaged', 'holed'] : []): ObjectRecord =>
        makeObject({
            id: 'ward', name: 'the ward', kind: 'formation', power, locationId: 'seat', tags,
            data: { ratedWhole: 27, raisedOnDay: 0, ...(scars > 0 ? { scars } : {}) }
        });

    it('a rung for every rung its holes took, and nothing for a whole one', () => {
        const whole = whatAHouseIsMadeOf([ward(27, 0)], 'seat', 0).formationStandsAt!;
        const holed = whatAHouseIsMadeOf([ward(25, 2)], 'seat', 0).formationStandsAt!;
        expect(whole - holed).toBe(2);
    });

    it('and a broken ward still answers, at the rung worth half of what it was made at', () => {
        const whole = whatAHouseIsMadeOf([ward(27, 0)], 'seat', 0).formationStandsAt!;
        const broken = whatAHouseIsMadeOf([ward(27, 3, ['damaged', 'broken'])], 'seat', 0).formationStandsAt;
        expect(broken).not.toBeNull();
        expect(broken!).toBeLessThan(whole);
        expect(combatPowerForOrdinal(broken!)).toBeLessThanOrEqual(combatPowerForOrdinal(whole) / 2);
        expect(combatPowerForOrdinal(broken! + 1)).toBeGreaterThan(combatPowerForOrdinal(whole) / 2);
    });
});
