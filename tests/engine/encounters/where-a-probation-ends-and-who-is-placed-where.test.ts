/**
 * The Azure sort, at the places it is easy to get wrong.
 *
 * The claim under all of it is that the three-way placement is a READING of
 * the Azure grant chain rather than a table written beside it. So the tests
 * that matter are the ones that would catch a hardcoded ladder: the order
 * comes off `getSubsidiariesOf`, the bands come off positions in that walk,
 * and the recall comes off each house's own shelf.
 *
 * The other half is the age gate, which is the first one in this game. It is
 * asserted here as a RATE test - the case a flat cap gets backwards in both
 * directions is the one worth pinning, because a later tuning pass that
 * replaces the span with a number of years old would still pass everything
 * else in this file.
 */

import { describe, expect, it } from 'vitest';

import {
    ageCeilingFor,
    apexHoldingTheDoorOver,
    judgeProbation,
    placementLadderFrom,
    recallFrom,
    spansAlong
} from '../../../src/engine/encounters/where-a-probation-ends-and-who-is-placed-where.js';
import {
    guestTermYears,
    publishedDoorOf,
    shelfTopOf
} from '../../../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';
import { getSubsidiariesOf } from '../../../src/data/cultivation/governance-and-water-rights.js';
import { getSect, SECTS } from '../../../src/data/cultivation/sects.js';
import { getMembersOf } from '../../../src/data/cultivation/members.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../../src/schema/cultivation.js';

const PAVILION = 'sect-azure-cloud-pavilion';
const MIST = 'sect-azure-mist-court';
const DEW = 'sect-azure-dew-sect';

/** Somebody who walked up at the age a run opens at. */
function walkedUpAt16(ordinal: number, yearsOnTheRoll: number) {
    return judgeProbation({
        hostFactionId: PAVILION,
        ordinal,
        age: 16 + yearsOnTheRoll,
        yearsOnTheRoll
    });
}

describe('the ladder is the grant chain, walked', () => {
    it('is Pavilion, Mist, Dew - and every step of it comes off the parentage table', () => {
        expect(placementLadderFrom(PAVILION)).toEqual([PAVILION, MIST, DEW]);

        // Not asserted from the ladder: asserted from the thing the ladder
        // reads, so that a change to the grant chain moves both together and a
        // hardcoded ladder would show up here as a disagreement.
        expect(getSubsidiariesOf(PAVILION).map(p => p.factionId)).toContain(MIST);
        expect(getSubsidiariesOf(MIST).map(p => p.factionId)).toContain(DEW);
        expect(getSubsidiariesOf(DEW)).toEqual([]);
    });

    it('is the only ladder in the world, because one house publishes a door', () => {
        const withDoors = SECTS.filter(s => publishedDoorOf(s.id) !== null);
        expect(withDoors.map(s => s.id)).toEqual([PAVILION]);
        expect(publishedDoorOf(PAVILION)!.theOnlyOneInTheWorld).toBe(true);

        // And nobody outside the Azure grant is under it. If this ever names a
        // fourth house, somebody has attached the intake to a body that is not
        // part of it.
        expect(apexHoldingTheDoorOver(DEW)).toBe(PAVILION);
        expect(apexHoldingTheDoorOver('sect-nine-peaks-ascetic-order')).toBeNull();
    });
});

describe('the two spans, and where each number comes from', () => {
    it('is the house\'s own watching term, then the world\'s own stall allowance', () => {
        const spans = spansAlong(placementLadderFrom(PAVILION));

        // Neither of these is written here. Both are read off something that
        // already existed and would move if the thing behind it moved.
        expect(spans[0]).toBe(guestTermYears(PAVILION));
        expect(spans[1]).toBe(stagnationYearsForOrdinal(0));
        expect(spans[2]).toBeNull();
    });

    it('descends, which is what "the Dew does not select" means as a number', () => {
        const spans = spansAlong(placementLadderFrom(PAVILION));
        expect(spans[0]).toBeLessThan(spans[1] as number);
        expect(spans[2]).toBeNull();
    });

    it('is an age ceiling computed per person, not a number of years old', () => {
        // THE CASE A FLAT CAP GETS BACKWARDS, IN BOTH DIRECTIONS. If this
        // file is ever retuned to "under forty", both halves of this fail.
        const takenLate = ageCeilingFor(placementLadderFrom(PAVILION), 0, 68);
        const takenEarly = ageCeilingFor(placementLadderFrom(PAVILION), 0, 12);
        expect(takenLate).toBeGreaterThan(takenEarly as number);
        expect(takenLate! - takenEarly!).toBe(0 + (68 - 12));
    });
});

describe('somebody who crosses', () => {
    it('is kept at the terraces when they cross inside what the house was spending', () => {
        const j = walkedUpAt16(FOUNDATION_ORDINAL, guestTermYears(PAVILION) - 1);
        expect(j.outcome).toBe('placed');
        expect(j.band).toBe('exceptional');
        expect(j.factionId).toBe(PAVILION);
        expect(j.depth).toBe(0);
    });

    it('goes to the Mist when they cross past that and inside a career', () => {
        const j = walkedUpAt16(FOUNDATION_ORDINAL, guestTermYears(PAVILION) + 1);
        expect(j.outcome).toBe('placed');
        expect(j.band).toBe('promising');
        expect(j.factionId).toBe(MIST);
    });

    it('goes to the Dew when they cross past both, because the Dew keeps no clock', () => {
        const j = walkedUpAt16(FOUNDATION_ORDINAL, stagnationYearsForOrdinal(0) + 1);
        expect(j.outcome).toBe('placed');
        expect(j.band).toBe('unformed');
        expect(j.factionId).toBe(DEW);
    });

    it('is kept by the terraces at seventy-six if they crossed in eight years', () => {
        // The whole argument for a rate test rather than a youth test. A flat
        // cap refuses this person, and the catalog says the Pavilion is
        // precisely the house that would not.
        const j = judgeProbation({
            hostFactionId: PAVILION, ordinal: FOUNDATION_ORDINAL, age: 76, yearsOnTheRoll: 8
        });
        expect(j.outcome).toBe('placed');
        expect(j.band).toBe('exceptional');
        expect(j.ageAtIntake).toBe(68);
    });

    it('is placed down the chain at forty if it took them thirty years', () => {
        const j = judgeProbation({
            hostFactionId: PAVILION, ordinal: FOUNDATION_ORDINAL, age: 40, yearsOnTheRoll: 30
        });
        expect(j.outcome).toBe('placed');
        expect(j.band).toBe('promising');
    });
});

describe('somebody who does not cross', () => {
    it('is carried, and told how long for, while the house is still spending', () => {
        const j = walkedUpAt16(2, 20);
        expect(j.outcome).toBe('carried');
        expect(j.yearsLeftToCross).toBeGreaterThan(0);
        // Legible from the inside rather than being a silence with a verdict
        // on the end of it.
        expect(j.reason).toMatch(/Nothing is decided until/);
    });

    it('is kept at the menial rung when they met the bar behind the door', () => {
        const bar = publishedDoorOf(PAVILION)!.membershipOrdinal;
        const j = walkedUpAt16(bar + 2, stagnationYearsForOrdinal(0));
        expect(j.outcome).toBe('kept');
        expect(j.factionId).toBe(PAVILION);
        expect(j.rankIndex).toBe(0);
    });

    it('is turned out when they never reached it', () => {
        const bar = publishedDoorOf(PAVILION)!.membershipOrdinal;
        const j = walkedUpAt16(bar - 1, stagnationYearsForOrdinal(0));
        expect(j.outcome).toBe('turned_out');
        expect(j.factionId).toBeNull();
    });

    it('is judged against a bar that has not moved, which is the whole point', () => {
        // The published door and the membership bar are two numbers and the
        // sort reads both. If somebody ever collapses them, the failure branch
        // stops discriminating and everybody is either kept or turned out.
        const door = publishedDoorOf(PAVILION)!;
        expect(door.atOrdinal).toBe(0);
        expect(door.membershipOrdinal).toBe(getSect(PAVILION)!.admissionOrdinal);
        expect(door.membershipOrdinal).toBeGreaterThan(door.atOrdinal);
    });
});

describe('the servant branch is a row the catalog already contains', () => {
    it('produces exactly where Yan Shuling is standing', () => {
        // `member-yan-shuling` is on the Pavilion's roll at rank index 0,
        // titled Sword Servant, standing above the bar and a long way below
        // Foundation. That is what a `kept` judgement writes, and this asserts
        // the rule and the row have not drifted apart.
        const yan = getMembersOf(PAVILION).find(m => m.id === 'member-yan-shuling');
        expect(yan).toBeDefined();
        expect(yan!.rankIndex).toBe(0);
        expect(yan!.rank).toBe('Sword Servant');

        const bar = publishedDoorOf(PAVILION)!.membershipOrdinal;
        expect(yan!.realmOrdinal).toBeGreaterThanOrEqual(bar);
        expect(yan!.realmOrdinal).toBeLessThan(FOUNDATION_ORDINAL);

        const j = judgeProbation({
            hostFactionId: PAVILION,
            ordinal: yan!.realmOrdinal,
            age: 16 + stagnationYearsForOrdinal(0),
            yearsOnTheRoll: stagnationYearsForOrdinal(0)
        });
        expect(j.outcome).toBe('kept');
        expect(j.rankIndex).toBe(yan!.rankIndex);
    });
});

describe('the recall roll', () => {
    it('fires the moment somebody outruns what the house holding them can teach', () => {
        const mistTop = shelfTopOf(MIST)!;
        expect(recallFrom(MIST, mistTop)).toBeNull();
        expect(recallFrom(MIST, mistTop + 1)!.toFactionId).toBe(PAVILION);
        expect(recallFrom(DEW, shelfTopOf(DEW)! + 1)!.toFactionId).toBe(PAVILION);
    });

    it('is read off the shelf rather than off a rung', () => {
        // Not "Core Formation". The number is whatever the house's own deepest
        // road carries to, so a house that acquires a deeper book keeps its
        // people longer with nothing edited anywhere.
        expect(recallFrom(MIST, shelfTopOf(MIST)! + 1)!.pastTheShelfAt).toBe(shelfTopOf(MIST));
    });

    it('does not apply at the top of the chain, where there is nowhere to be sent', () => {
        expect(recallFrom(PAVILION, 44)).toBeNull();
    });

    it('does not apply to a house outside the intake at all', () => {
        expect(recallFrom('sect-nine-peaks-ascetic-order', 44)).toBeNull();
    });
});
