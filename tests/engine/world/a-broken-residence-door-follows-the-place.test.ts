/**
 * Owner ruling 2026-10-03: an actual locked door can be broken using its rated
 * material and the ordinary force authority. Private permission alone does not
 * prove a lock exists. Audit found owned residences already have stable location
 * identity and native slab/reinforcement material, but no persistent physical
 * damage; holder-based quarters areas do not yet have physical slot identity.
 *
 * This candidate tests damage on the actual residence only. It does not promise
 * ordinary entry through a qi seal/cycle, private-quarter construction or repair.
 * No checks have been run; production integration and front-door controls remain
 * pending. Numeric force requirements come from native material, not fixture math.
 */
import { describe, expect, it } from 'vitest';
import { makeLocation, evaluateAccess } from '../../../src/engine/world/locations.js';
import { yourOwnDoor } from '../../../src/engine/world/door-materials.js';
import { THE_TAG_A_RESIDENCE_CARRIES } from '../../../src/engine/world/somewhere-that-is-theirs.js';
import { breakTheResidenceDoor, theActualResidenceDoor,
    theResidenceDoorThatCanBeShut, whetherTheResidenceDoorCanBeBroken
} from '../../../src/engine/world/a-residence-door-that-was-broken.js';

function residence() {
    return makeLocation({ id: 'actual-residence', name: 'A settled cave', kind: 'cave',
        parentId: 'outside', tags: [THE_TAG_A_RESIDENCE_CARRIES],
        data: { heldById: 'resident', heldByName: 'Resident', settledOnDay: 1,
            actualStorageNote: 'goods remain in their ordinary store' },
        sealed: true, hazards: ['formation'],
        cycle: { periodDays: 12, openDays: 2, phaseDay: 0 } });
}

describe('physical damage to an actual owned residence door', () => {
    it('names the native requirement and leaves a failed attempt unchanged', () => {
        const target = residence();
        const before = JSON.stringify(target);
        const needed = yourOwnDoor(target).standsAt;
        const answer = whetherTheResidenceDoorCanBeBroken(target, needed - 1)!;
        expect(answer.force.reaches).toBe(false);
        expect(answer.force.needs).toBe(needed);
        expect(answer.force.cause).toContain(String(needed));
        expect(breakTheResidenceDoor(target, { strength: needed - 1, onDay: 2,
            byName: 'Visitor', causeFactId: 'actual-deed' })).toBeNull();
        expect(JSON.stringify(target)).toBe(before);
    });

    it('breaks the physical slab without changing the qi seal, cycle, goods or ownership', () => {
        const target = residence();
        const changed = breakTheResidenceDoor(target, { strength: yourOwnDoor(target).standsAt,
            onDay: 2.5, byName: 'Visitor', causeFactId: 'actual-deed' })!;
        expect(theResidenceDoorThatCanBeShut(changed.location)).toBeNull();
        expect(changed.location.sealed).toBe(target.sealed);
        expect(changed.location.cycle).toEqual(target.cycle);
        expect(changed.location.hazards).toEqual(target.hazards);
        expect(changed.location.thresholds).toEqual(target.thresholds);
        expect(changed.location.data).toEqual({ ...target.data, doorBrokenOnDay: 2.5 });
        expect(changed.change.causeFactId).toBe('actual-deed');
        expect(theResidenceDoorThatCanBeShut(target)).toEqual(yourOwnDoor(target));
        const closedDay = target.cycle!.phaseDay + target.cycle!.openDays + 1;
        const query = { realmOrdinal: yourOwnDoor(target).standsAt,
            onDay: closedDay, keyIds: [] };
        expect(evaluateAccess(target, query).closed).toBe(true);
        expect(evaluateAccess(changed.location, query).closed).toBe(true);
    });

    it('retains damage through saved-record reload and a later change of holder', () => {
        const target = residence();
        const changed = breakTheResidenceDoor(target, { strength: yourOwnDoor(target).standsAt,
            onDay: 3, byName: 'Visitor', causeFactId: 'actual-deed' })!;
        const reopened = makeLocation(JSON.parse(JSON.stringify(changed.location)));
        const nextHolder = { ...reopened, data: { ...reopened.data,
            heldById: 'successor', heldByName: 'Successor' } };
        expect(theActualResidenceDoor(nextHolder)?.locationId).toBe(target.id);
        expect(theActualResidenceDoor(nextHolder)?.brokenOnDay).toBe(3);
        expect(theResidenceDoorThatCanBeShut(nextHolder)).toBeNull();
        const vacated = { ...reopened, data: { ...reopened.data, heldById: null, heldByName: null } };
        expect(theActualResidenceDoor(vacated)?.brokenOnDay).toBe(3);
        expect(theResidenceDoorThatCanBeShut(vacated)).toBeNull();
    });

    it('reads actual reinforced material without copying its grade into damage', () => {
        const target = residence();
        target.data = { ...target.data, doorStandsAt: 21,
            doorReinforcedWith: 'actual-part', doorReinforcedOnDay: 2 };
        const answer = whetherTheResidenceDoorCanBeBroken(target, 20)!;
        expect(answer.force.needs).toBe(yourOwnDoor(target).standsAt);
        expect(answer.force.reaches).toBe(false);
        const changed = breakTheResidenceDoor(target, { strength: 21, onDay: 4,
            byName: 'Visitor', causeFactId: 'actual-deed' })!;
        expect(changed.location.data).toEqual({ ...target.data, doorBrokenOnDay: 4 });
    });

    it('does not mint a residence door for a private permission or an ordinary town', () => {
        const town = makeLocation({ id: 'town', name: 'Town', kind: 'settlement' });
        expect(theActualResidenceDoor(town)).toBeNull();
        expect(breakTheResidenceDoor(town, { strength: 99, onDay: 4,
            byName: 'Visitor', causeFactId: 'actual-deed' })).toBeNull();
    });

    it('cannot append a second breach for an already broken physical door', () => {
        const target = residence();
        const changed = breakTheResidenceDoor(target, { strength: yourOwnDoor(target).standsAt,
            onDay: 4, byName: 'Visitor', causeFactId: 'actual-deed' })!;
        expect(breakTheResidenceDoor(changed.location, { strength: 99, onDay: 5,
            byName: 'Another visitor', causeFactId: 'second-deed' })).toBeNull();
        expect(theActualResidenceDoor(changed.location)?.brokenOnDay).toBe(4);
    });
});
