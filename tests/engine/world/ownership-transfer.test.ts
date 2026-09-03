/**
 * Ownership moves three ways and no others.
 *
 * The owner's ruling, in `docs/world/things/items.md`. What is under test is
 * the third route and its negative, because the negative is the load-bearing
 * half: **a single thief does not become an owner however long they keep it**,
 * and that is what leaves a stolen thing findable, dangerous to carry, and a
 * claim its owner's descendants inherit.
 *
 * The claim layer these run through - `assertClaim`, `acknowledgeClaim`,
 * `ClaimBasis`, `acknowledgedByIds` - had no caller anywhere in `src/` before
 * this. A register that moved with no basis recorded and nobody's
 * acknowledgement asked is the same defect one size smaller than an unwired
 * module, and it read as working because "a claim nobody acknowledges" is a
 * real state.
 */

import { describe, it, expect } from 'vitest';
import {
    movesTheRegister,
    nobodyLeftToArgueWith,
    takenByForceOfArms,
    takenByStandingOverIt,
    type CouldObject
} from '../../../src/engine/world/ownership-transfer.js';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { HELPLESS_REALM_GAP } from '../../../src/engine/cultivation/combat.js';

function theirs(): ObjectRecord {
    return makeObject({
        id: 'o-1',
        name: 'The Gate Seal',
        kind: 'artifact',
        significance: 'significant',
        power: 18,
        ownerId: 'sect-kiln-wardens',
        ownerName: 'The Kiln Court',
        possessorId: 'sect-kiln-wardens'
    }) as ObjectRecord;
}

const somebody = (id: string, realmOrdinal: number): CouldObject =>
    ({ id, name: id, realmOrdinal });

describe('is there anybody left to raise the question with', () => {
    it('says nobody when everybody who could is past the gap that is not a fight', () => {
        // The same constant the combat layer stops calling a confrontation a
        // fight at, read here as the gap at which there is no question to
        // raise. Read off the constant rather than restated, so a retune of the
        // ladder moves this with it.
        const read = nobodyLeftToArgueWith({ realmOrdinal: 44 }, [
            somebody('a', 0), somebody('b', 3)
        ]);
        expect(read.nobody).toBe(true);
        expect(read.couldStillObject).toEqual([]);
        expect(read.because).toContain(String(HELPLESS_REALM_GAP));
    });

    it('says somebody when one person can still make it a question', () => {
        const read = nobodyLeftToArgueWith({ realmOrdinal: 14 }, [
            somebody('weak', 0), somebody('near', 12)
        ]);
        expect(read.nobody).toBe(false);
        // Strongest first, so a caller rendering one line names the person who
        // actually matters.
        expect(read.couldStillObject[0].id).toBe('near');
    });

    it('does not let numbers stand in for a rung', () => {
        // Twenty people who cannot contest it still cannot contest it. Numbers
        // are an argument in a WAR, and a war is the other route.
        const crowd = Array.from({ length: 20 }, (_, i) => somebody(`n${i}`, 0));
        expect(nobodyLeftToArgueWith({ realmOrdinal: 44 }, crowd).nobody).toBe(true);
    });

    it('tells an empty list apart from a measured one', () => {
        // A caller that did not go looking gets the same boolean and a
        // different account, so the two cannot be confused for each other.
        const none = nobodyLeftToArgueWith({ realmOrdinal: 2 }, []);
        expect(none.nobody).toBe(true);
        expect(none.because).toMatch(/absence of objectors/i);
    });
});

describe('the three routes, and the fourth answer that is most of the world', () => {
    it('moves the register for force of arms, with who accepted it on the row', () => {
        const took = takenByForceOfArms(theirs(), {
            by: { id: 'sect-storm-tyrant-court', name: 'Storm Tyrant Court' },
            onDay: 400,
            source: 'the Kiln war',
            acknowledgedBy: ['sect-kiln-wardens']
        });

        expect(took.ownerId).toBe('sect-storm-tyrant-court');
        expect(took.possessorId).toBe('sect-storm-tyrant-court');

        const claim = took.claims.at(-1)!;
        expect(claim.basis).toBe('conquest');
        expect(claim.strength).toBe(1);
        // *"Everyone else acknowledges"* is the load-bearing half, and this is
        // the field it lives in.
        expect(claim.acknowledgedByIds).toContain('sect-kiln-wardens');
    });

    it('leaves a thief a possessor, however long they keep it', () => {
        const { object, route, reading } = takenByStandingOverIt(theirs(), {
            by: { id: 'npc-thief', name: 'Nobody In Particular' },
            onDay: 400,
            source: 'walked out of the hall with it',
            holder: { realmOrdinal: 6 },
            objectors: [somebody('npc-warden', 20)]
        });

        expect(route).toBe('possession');
        expect(movesTheRegister(route)).toBe(false);
        expect(object.possessorId).toBe('npc-thief');
        // The whole thread. The Kiln Court still owns it, which is what makes
        // it findable and what makes carrying it dangerous.
        expect(object.ownerId).toBe('sect-kiln-wardens');
        expect(object.ownerName).toBe('The Kiln Court');
        expect(reading.nobody).toBe(false);

        // And the claim is written anyway. A claim nobody acknowledges is still
        // a claim; it is the record the argument gets raised off later.
        const claim = object.claims.at(-1)!;
        expect(claim.claimantId).toBe('npc-thief');
        expect(claim.acknowledgedByIds).toEqual([]);
        expect(claim.active).toBe(true);
    });

    it('moves it for somebody there is nobody to raise it with', () => {
        const { object, route } = takenByStandingOverIt(theirs(), {
            by: { id: 'npc-immortal', name: 'Somebody Very Strong' },
            onDay: 400,
            source: 'stood over it',
            holder: { realmOrdinal: 45 },
            objectors: [somebody('npc-warden', 20), somebody('npc-second', 18)]
        });

        expect(route).toBe('nobody_to_argue_with');
        expect(movesTheRegister(route)).toBe(true);
        expect(object.ownerId).toBe('npc-immortal');
        // Short of having made the thing. Somebody standing over it has the
        // best claim available and not a perfect one, because the record is
        // what lets the question be raised again if they fall.
        expect(object.claims.at(-1)!.strength).toBeLessThan(1);
    });

    it('says how it was taken, in the word the chain will carry', () => {
        const stolen = takenByStandingOverIt(theirs(), {
            by: { id: 'npc-thief', name: 'Nobody' }, onDay: 1, source: 's',
            holder: { realmOrdinal: 6 }, objectors: [somebody('npc-warden', 20)]
        }).object;
        const kept = takenByStandingOverIt(theirs(), {
            by: { id: 'npc-immortal', name: 'Somebody' }, onDay: 1, source: 's',
            holder: { realmOrdinal: 45 }, objectors: [somebody('npc-warden', 20)]
        }).object;

        // `how` is what separates a theft from a taking in the provenance
        // chain, and it is the word somebody reads two centuries later.
        expect(stolen.provenance.at(-1)!.how).toBe('stolen');
        expect(kept.provenance.at(-1)!.how).toBe('looted');
    });
});
