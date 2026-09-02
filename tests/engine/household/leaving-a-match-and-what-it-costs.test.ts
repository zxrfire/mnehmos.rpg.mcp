/**
 * Running, refusing, and what a child costs.
 *
 * Three decisions pinned here because each of them lives as a shape rather than
 * as prose, and a shape nobody reads twice is a shape the next person will
 * quietly change:
 *
 *   - a match nobody was bound into writes NO oath, and therefore leaving one
 *     costs nothing on the ledger. `whatWalkingOutOfItCosts` says that is the
 *     common case; this asserts the producer agrees.
 *   - leaving costs the ROLL whether or not there was a word, and what it
 *     leaves in front of the person is the house's own lowest door.
 *   - a refusal opens an account only on the route where the two of them had
 *     already agreed. The stakes decide how heavy and never whether.
 */

import { describe, expect, it } from 'vitest';

import {
    whatAMatchChanges,
    whatLeavingAMatchCosts
} from '../../../src/engine/household/what-a-match-changes-and-what-leaving-one-costs.js';
import {
    aRefusalLeavesSomething,
    howMuchOfWhatTheyHad,
    whatDecliningSomebodyLeaves
} from '../../../src/engine/household/what-declining-somebody-leaves.js';
import {
    whatAChildCosts,
    whatTheChildIs,
    YEARS_BEFORE_A_CHILD_CAN_BE_PLACED
} from '../../../src/engine/household/what-a-child-costs-the-two-people-who-have-one.js';
import type { APartyToAMatch } from '../../../src/engine/household/what-a-house-would-take-for-a-match.js';
import { CULTIVATION_BEGINS_AT_AGE } from '../../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { SPOUSE_STANDING } from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import type { Party } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';

const one: APartyToAMatch = {
    personId: 'p-one',
    reachesTo: 10,
    carriesTheLineAt: null,
    houseId: 'sect-azure-dew-sect',
    onTheRoll: 'by blood'
};

const other: APartyToAMatch = {
    personId: 'p-other',
    reachesTo: 8,
    carriesTheLineAt: null,
    houseId: null,
    onTheRoll: null
};

describe('what a match writes', () => {
    it('uses the world own spouse strength rather than a stronger one of its own', () => {
        const changed = whatAMatchChanges({ one, other, onDay: 100 });
        for (const tie of changed.ties) expect(tie.strength).toBe(SPOUSE_STANDING);
    });

    it('writes no word at all when nobody was bound into it', () => {
        const changed = whatAMatchChanges({ one, other, onDay: 100 });
        expect(changed.binding).toBeNull();
    });

    it('writes an oath the ledger already has the cause for when somebody was', () => {
        const changed = whatAMatchChanges({
            one,
            other,
            onDay: 100,
            bound: {
                personId: other.personId,
                toHouseId: 'sect-azure-dew-sect',
                terms: 'Agreed between the two houses and written down.'
            }
        });

        expect(changed.binding?.kind).toBe('oath');
        expect(changed.binding?.cause).toBe('marriage_pact');
        // Held by the person bound about the house holding them to it, which is
        // the direction `whatWalkingOutOfItCosts` reads.
        expect(changed.binding?.holderId).toBe(other.personId);
        expect(changed.binding?.subjectId).toBe('sect-azure-dew-sect');
    });
});

describe('leaving a match', () => {
    it('costs nothing on the ledger when no word had been given', () => {
        const left = whatLeavingAMatchCosts({
            binding: null,
            leaverId: other.personId,
            leaverName: 'the one who left',
            rollsTheyWereOn: [],
            onDay: 900
        });

        expect(left.onTheLedger).toBeNull();
        expect(left.offTheRolls).toEqual([]);
    });

    it('costs the roll, and leaves the house own lowest door in front of them', () => {
        const left = whatLeavingAMatchCosts({
            binding: null,
            leaverId: other.personId,
            leaverName: 'the one who left',
            rollsTheyWereOn: ['sect-azure-dew-sect'],
            onDay: 900
        });

        expect(left.offTheRolls).toHaveLength(1);
        const off = left.offTheRolls[0];
        expect(off.houseId).toBe('sect-azure-dew-sect');
        expect(off.theLowestDoorNowInFrontOfThem).not.toBeNull();
        expect(off.whatWasLost).toMatch(/roll/i);
    });

    it('opens a personal account in the leaver own name when a word is broken', () => {
        const changed = whatAMatchChanges({
            one,
            other,
            onDay: 100,
            bound: {
                personId: other.personId,
                toHouseId: 'sect-azure-dew-sect',
                terms: 'Agreed between the two houses.'
            }
        });
        const left = whatLeavingAMatchCosts({
            binding: changed.binding!,
            leaverId: other.personId,
            leaverName: 'the one who left',
            rollsTheyWereOn: ['sect-azure-dew-sect'],
            onDay: 3000
        });

        expect(left.onTheLedger).not.toBeNull();
        // Nothing was being settled, so nothing reopens - which the module that
        // owns it names as the common case.
        expect(left.onTheLedger?.reopened).toBeNull();
        expect(left.onTheLedger?.opened.cause).toBe('broken_oath');
        expect(left.onTheLedger?.opened.subjectId).toBe(other.personId);
        // As heavy as the word was. Walking out is never the cheap move.
        expect(left.onTheLedger?.opened.severity).toBe(changed.binding?.severity);
    });

    it('refuses nobody: the same call answers whoever is leaving', () => {
        // One implementation, both directions. The party leaving is an argument.
        const a = whatLeavingAMatchCosts({
            binding: null, leaverId: one.personId, leaverName: 'one',
            rollsTheyWereOn: ['sect-azure-dew-sect'], onDay: 1
        });
        const b = whatLeavingAMatchCosts({
            binding: null, leaverId: other.personId, leaverName: 'other',
            rollsTheyWereOn: ['sect-azure-dew-sect'], onDay: 1
        });
        expect(a.offTheRolls[0].theLowestDoorNowInFrontOfThem)
            .toBe(b.offTheRolls[0].theLowestDoorNowInFrontOfThem);
    });
});

const party = (id: string, houseId: string | null): Party => ({
    id,
    name: id,
    houseId,
    houseName: houseId,
    alignment: houseId === null ? null : 'neutral',
    ranked: houseId !== null
});

describe('the gate on a refusal is the route and not a threshold', () => {
    /**
     * The owner's correction, and it is the sharpest rule in the directory:
     * an ordinary refusal opens nothing at all. Houses and people refuse
     * constantly and must be able to without accumulating enemies for it.
     *
     * What opens an account is a no said to a thing the two of them had
     * already made, which is only reachable on the `person first` route.
     */
    it('opens nothing on the route where the answer came first', () => {
        expect(aRefusalLeavesSomething('family first')).toBe(false);

        // Even with everything they had on the table. The stakes decide how
        // heavy and never whether, and this is the assertion that stops a
        // threshold creeping back in.
        const left = whatDecliningSomebodyLeaves({
            declining: party('p-declining', 'sect-azure-dew-sect'),
            asking: party('p-asking', null),
            route: 'family first',
            staked: { theBestOnTheTable: 40, theyReachTo: 12, hadBeenToldYes: true },
            onDay: 500
        });

        expect(left.left).toBeNull();
        expect(left.note).toMatch(/nothing between the two of them/i);
    });

    it('opens one on the route where the two of them had already agreed', () => {
        expect(aRefusalLeavesSomething('person first')).toBe(true);

        const left = whatDecliningSomebodyLeaves({
            declining: party('p-declining', 'sect-azure-dew-sect'),
            asking: party('p-asking', null),
            route: 'person first',
            staked: { theBestOnTheTable: 12, theyReachTo: 12 },
            onDay: 500
        });

        expect(left.left).not.toBeNull();
        expect(left.left?.opens.length).toBeGreaterThan(0);
        // The refused party holds it, against the one who refused.
        expect(left.left?.opens[0].holderId).toBe('p-asking');
        expect(left.left?.opens[0].subjectId).toBe('p-declining');
    });

    it('opens one even where almost nothing was staked, because it is not a threshold', () => {
        const left = whatDecliningSomebodyLeaves({
            declining: party('p-declining', 'sect-azure-dew-sect'),
            asking: party('p-asking', null),
            route: 'person first',
            staked: { theBestOnTheTable: 0, theyReachTo: 40 },
            onDay: 500
        });
        expect(left.left).not.toBeNull();
    });

    it('prices the same offer differently depending on who made it', () => {
        // `what-a-deed-leaves.ts`'s central rule, arriving here unmodified: the
        // same thing put down is most of what one party had and a rounding
        // error to another.
        expect(howMuchOfWhatTheyHad({ theBestOnTheTable: 12, theyReachTo: 12 })).toBe(1);
        expect(howMuchOfWhatTheyHad({ theBestOnTheTable: 12, theyReachTo: 40 }))
            .toBeLessThan(0.4);
    });

    it('runs the same code whichever party is the played one', () => {
        // No branch reads who is playing. Swapping the two arguments swaps the
        // holder and nothing else.
        const forwards = whatDecliningSomebodyLeaves({
            declining: party('a', null), asking: party('b', null),
            route: 'person first',
            staked: { theBestOnTheTable: 10, theyReachTo: 10 }, onDay: 5
        });
        const backwards = whatDecliningSomebodyLeaves({
            declining: party('b', null), asking: party('a', null),
            route: 'person first',
            staked: { theBestOnTheTable: 10, theyReachTo: 10 }, onDay: 5
        });

        expect(forwards.left?.weight).toBe(backwards.left?.weight);
        expect(forwards.left?.opens[0].holderId).toBe('b');
        expect(backwards.left?.opens[0].holderId).toBe('a');
    });
});

describe('what a child costs', () => {
    it('takes its floor from the age a road can be walked at, not from a new number', () => {
        expect(YEARS_BEFORE_A_CHILD_CAN_BE_PLACED).toBe(CULTIVATION_BEGINS_AT_AGE);
    });

    it('is the same years and a different price to each of two parents', () => {
        const low = { ...one, reachesTo: 2 };
        const high = { ...other, reachesTo: 30 };
        const cost = whatAChildCosts({ one: low, other: high, years: 12 });

        const [a, b] = cost.toEachOfThem;
        expect(a.years).toBe(b.years);
        // The whole of the price is `realms.ts`'s own curve. Nothing here
        // decides it and nothing here could.
        expect(a.ofAWholeLifeAtTheirRung).toBeCloseTo(12 / lifespanForOrdinal(2), 10);
        expect(b.ofAWholeLifeAtTheirRung).toBeCloseTo(12 / lifespanForOrdinal(30), 10);
        expect(a.ofAWholeLifeAtTheirRung).toBeGreaterThan(b.ofAWholeLifeAtTheirRung);
    });

    it('reports a short stretch rather than refusing it', () => {
        const cost = whatAChildCosts({ one, other, years: 3 });
        expect(cost.shorterThanTheChildCanBeHandedOn).toBe(true);
        expect(cost.years).toBe(3);
    });
});

describe('what the child is', () => {
    it('is on no roll when neither parent is on a lineage', () => {
        const child = whatTheChildIs({
            one: { ...one, houseId: 'sect-azure-dew-sect' },
            other
        });
        // The Azure Dew Sect recruits; it is not a lineage. `intakeRouteOf`
        // decides, not a faction id written here.
        expect(child.rolls).toEqual([]);
        expect(child.theNameTheyCarry).toBeNull();
        expect(child.note).toMatch(/walked up the mountain/i);
    });

    it('carries no rung, ever - there is no field that could', () => {
        const child = whatTheChildIs({ one, other });
        expect(Object.keys(child)).not.toContain('ordinal');
        expect(Object.keys(child)).not.toContain('realmOrdinal');
        expect(Object.keys(child)).not.toContain('rank');
    });

    it('steps a line down at exactly one generation when only one parent carries it', () => {
        const child = whatTheChildIs({
            one: { ...one, carriesTheLineAt: 'final' },
            other: { ...other, carriesTheLineAt: null }
        });
        expect(child.theLineTheyCarry).toBe('grown');
        expect(child.theLineStepsDownHere).toBe(true);
    });

    it('holds a line when both parents carry it, with no constant anywhere', () => {
        const child = whatTheChildIs({
            one: { ...one, carriesTheLineAt: 'final' },
            other: { ...other, carriesTheLineAt: 'final' }
        });
        expect(child.theLineTheyCarry).toBe('final');
        expect(child.theLineStepsDownHere).toBe(false);
    });
});
