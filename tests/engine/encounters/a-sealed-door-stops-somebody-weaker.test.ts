/**
 * Somebody who comes for a sealed cultivator breaks the door or is stopped by it.
 *
 * The owner's ruling, on whether an account coming due gets through a sealed
 * seclusion: they can break it depending on the material. Before this, the door
 * was consulted for everything EXCEPT the one arrival that came by name - an
 * account holder walked through an inn's planks and a reinforced cave slab alike.
 *
 * What these pin:
 *
 *   - the account's own severity decides whether they try (a slight is not worth
 *     a door); strength against the door's rung decides whether it breaks - not a
 *     roll, so no seed can flip it;
 *   - somebody stopped waits or goes, a weighted draw on the account's weight
 *     and the holder's temperament, and waiting is forceable;
 *   - a stopped arrival is settled against the day the sitter came out: still
 *     outside is the confrontation, gone leaves a trace, and a whole major realm
 *     above leaves none;
 *   - nothing about an arrival that did not meet a sealed door moved.
 *
 * Every figure asserted is read off the module that holds it, not retyped.
 */

import { describe, expect, it } from 'vitest';

import { rollEncounters, type EncounterPlace, type EncounterRollInput } from '../../../src/engine/encounters/index.js';
import type { AnAccountComingDue } from '../../../src/engine/encounters/types.js';
import { whoWasAtTheDoorWhenTheyCameOut } from '../../../src/engine/encounters/an-account-comes-due.js';
import { whatTheyDoAtASealedDoor } from '../../../src/engine/encounters/at-a-sealed-door.js';
import {
    aDoorReinforcedWith,
    aHouseRoomDoor,
    anInnDoor,
    yourOwnDoor
} from '../../../src/engine/world/door-materials.js';

const cave: EncounterPlace = { id: 'c', name: 'a cave above Burnt Earth', kind: 'cave', danger: 0.3, qiDensity: 30 };

function anAccount(severity: AnAccountComingDue['severity'], ordinal: number, strength = ordinal): AnAccountComingDue {
    return {
        holderId: 'npc-holder',
        holderName: 'Bai Kehe',
        holderIsAHouse: false,
        sent: { id: 'npc-holder', name: 'Bai Kehe', realmOrdinal: ordinal, strength },
        push: 0,
        weight: 2,
        severity,
        what: 'They were shamed in front of their own people.',
        carried: false
    };
}

/** A decade behind a door, which an unforgivable account all but certainly reaches. */
function aDecadeSealed(input: Partial<EncounterRollInput>) {
    return rollEncounters({
        seed: 'door',
        startDay: 0,
        days: 3650,
        activity: 'sealed',
        cultivator: { id: 'c1', realmOrdinal: 8, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 },
        place: cave,
        ...input
    });
}

describe('what somebody does at a sealed door', () => {
    const door = yourOwnDoor(null);
    const base = {
        theirOrdinal: 10, yourOrdinal: 8, door, push: 0, arrivedOnDay: 100, sample: 0.99
    };

    it('does not put a shoulder to a door over a slight', () => {
        expect(whatTheyDoAtASealedDoor({ ...base, severity: 'slight', strength: 40 }).what).toBe('did_not_try');
    });

    it('breaks it when they reach its rung, and not otherwise, whatever the draw', () => {
        // `canUnmake`: a rung reaches what is rated at it.
        for (const sample of [0, 0.5, 0.99]) {
            expect(whatTheyDoAtASealedDoor({ ...base, sample, severity: 'grave', strength: door.standsAt }).what)
                .toBe('broke_in');
            expect(whatTheyDoAtASealedDoor({ ...base, sample, severity: 'grave', strength: door.standsAt - 1 }).what)
                .toBe('stopped');
        }
    });

    it('waits longer the heavier the account and the more patient the holder, and waiting is forceable', () => {
        const stopped = (severity: 'serious' | 'grave' | 'unforgivable', push: number, forced = true) => {
            const at = whatTheyDoAtASealedDoor({
                ...base, severity, push, strength: 0, waitingIsForced: forced
            });
            if (at.what !== 'stopped') throw new Error(at.what);
            return at.waitingUntilDay - base.arrivedOnDay;
        };
        expect(stopped('grave', 0)).toBeGreaterThan(stopped('serious', 0));
        expect(stopped('unforgivable', 0)).toBeGreaterThan(stopped('grave', 0));
        expect(stopped('grave', -1)).toBeGreaterThan(stopped('grave', 1));
        // Unforced, a draw near 1 goes away.
        expect(stopped('grave', 0, false)).toBe(0);
    });

    it('leaves a trace unless they stand a whole major realm above the sitter', () => {
        const trace = (theirOrdinal: number) => {
            const at = whatTheyDoAtASealedDoor({ ...base, theirOrdinal, yourOrdinal: 8, severity: 'grave', strength: 0 });
            return at.what === 'stopped' && at.leftATrace;
        };
        expect(trace(12)).toBe(true);   // the top of Qi Condensation, the sitter's own realm
        expect(trace(13)).toBe(false);  // Foundation: one whole realm up
    });
});

describe('an account coming due at a sealed door', () => {
    it('breaks through a weak door, stops the sitting, and says through what', () => {
        const door = anInnDoor();
        const roll = aDecadeSealed({ comingForYou: [anAccount('grave', 10)], door });
        const came = roll.occurrences.find(o => o.account);
        expect(came, 'a decade of an unforgivable-weight account found nobody').toBeDefined();
        expect(came!.interrupts).toBe(true);
        expect(came!.door).toMatchObject({ what: 'broke_in', doorName: door.name });
    });

    it('is stopped by a door stronger than them, does not interrupt, and names nobody', () => {
        const roll = aDecadeSealed({ comingForYou: [anAccount('grave', 4)], door: yourOwnDoor(null) });
        const came = roll.occurrences.find(o => o.account)!;
        expect(came.door?.what).toBe('stopped');
        expect(came.interrupts).toBe(false);
        expect(came.grants).toEqual([]);
        expect(came.event.summary).not.toMatch(/Bai Kehe/);
    });

    it('meets the sitter at the door if still waiting when they come out, and leaves a trace if not', () => {
        const roll = aDecadeSealed({
            comingForYou: [anAccount('grave', 4)], door: yourOwnDoor(null), waitingIsForced: true
        });
        const came = roll.occurrences.find(o => o.account)!;
        const door = came.door!;
        expect(door.waitingUntilDay).toBeGreaterThan(door.arrivedOnDay);

        const outWhileWaiting = whoWasAtTheDoorWhenTheyCameOut(roll, 0, door.waitingUntilDay);
        const met = outWhileWaiting.occurrences.find(o => o.account)!;
        expect(met.interrupts).toBe(true);
        expect(met.absoluteDay).toBe(door.waitingUntilDay);
        expect(met.event.summary).toMatch(/Bai Kehe/);
        expect(met.grants.length).toBeGreaterThan(0);

        const outLater = whoWasAtTheDoorWhenTheyCameOut(roll, 0, door.waitingUntilDay + 1);
        const gone = outLater.occurrences.find(o => o.account)!;
        expect(gone.interrupts).toBe(false);
        expect(gone.event.summary).toMatch(/did not get through/);
        expect(gone.event.summary).not.toMatch(/Bai Kehe/);
    });

    it('leaves the roll untouched where there is no sealed door', () => {
        const account = [anAccount('grave', 10)];
        const open = (door: ReturnType<typeof anInnDoor> | undefined) => rollEncounters({
            seed: 'door', startDay: 0, days: 3650, activity: 'seclusion',
            cultivator: { id: 'c1', realmOrdinal: 8, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 },
            place: cave, comingForYou: account, ...(door ? { door } : {})
        });
        expect(open(yourOwnDoor(null))).toEqual(open(undefined));
    });
});

describe('what a door is made of', () => {
    it('gives a better room a stronger door, which is how promotion strengthens it', () => {
        const outer = aHouseRoomDoor({ purpose: 'dormitory', precinctIndex: 0 });
        const inner = aHouseRoomDoor({ purpose: 'residence', precinctIndex: 3 });
        expect(inner.standsAt).toBeGreaterThan(outer.standsAt);
        expect(outer.whose).toBe('the_house');
        expect(anInnDoor().whose).toBe('the_inn');
    });

    it('reinforces to the lower of the part and the hands, and always gains when it could', () => {
        const door = yourOwnDoor(null).standsAt;
        for (const mastery of [0.5, 0.75, 1]) {
            const worked = aDoorReinforcedWith({ doorStandsAt: door, partRung: 20, handRung: 14, mastery });
            expect(worked.theLowerOfTheTwo).toBe(14);
            expect(worked.limitedBy).toBe('the hands');
            expect(worked.gained).toBeGreaterThanOrEqual(1);
            expect(worked.standsAt).toBeLessThanOrEqual(14);
        }
        const whole = aDoorReinforcedWith({ doorStandsAt: door, partRung: 20, handRung: 14, mastery: 1 });
        const poor = aDoorReinforcedWith({ doorStandsAt: door, partRung: 20, handRung: 14, mastery: 0.5 });
        expect(whole.standsAt).toBeGreaterThanOrEqual(poor.standsAt);
        // A part no better than the door adds nothing, and the caller refuses before spending it.
        expect(aDoorReinforcedWith({ doorStandsAt: door, partRung: door, handRung: 30, mastery: 1 }).gained).toBe(0);
    });
});
