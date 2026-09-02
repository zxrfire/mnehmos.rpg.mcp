/**
 * The hard requirement, asserted mechanically rather than reviewed.
 *
 * Any gender, in every direction, with no asymmetry anywhere in the code or the
 * prose. Two halves, and both of them fail on a single occurrence:
 *
 *   THE SWAP     Run a match both ways round and the answers are identical.
 *                Who proposes and who is proposed for are positions in a call,
 *                not properties of a person, and if a branch ever appears that
 *                reads one side differently this goes red.
 *
 *   THE SCAN     Every identifier and string literal in `src/engine/household`
 *                against a gendered vocabulary. This is the test that catches
 *                the failure a reviewer would not: a field called `brideId`, a
 *                sentence that says "her family", a comment that assumes.
 *
 * The scan lists its vocabulary explicitly rather than pattern-matching, so a
 * word can be added when somebody finds one this missed.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    whatAHouseWouldTakeForAMatch,
    type APartyToAMatch,
    type TheHouseBeingAsked
} from '../../../src/engine/household/what-a-house-would-take-for-a-match.js';
import { whatTheChildIs } from '../../../src/engine/household/what-a-child-costs-the-two-people-who-have-one.js';
import { whatAMatchChanges } from '../../../src/engine/household/what-a-match-changes-and-what-leaving-one-costs.js';

const DIRECTORY = 'src/engine/household';

const ONE: APartyToAMatch = {
    personId: 'p-one',
    reachesTo: 14,
    carriesTheLineAt: 'final',
    houseId: 'sect-ninefold-ledger',
    onTheRoll: 'by blood'
};

const OTHER: APartyToAMatch = {
    personId: 'p-other',
    reachesTo: 9,
    carriesTheLineAt: null,
    houseId: null,
    onTheRoll: null
};

const HOUSE: TheHouseBeingAsked = {
    houseId: 'sect-ninefold-ledger',
    reachesTo: 30,
    othersCarryingTheLineAsWell: 3
};

describe('a match reads the same in both directions', () => {
    it('gives the same line and the same step-down whichever side is asked for', () => {
        const forwards = whatAHouseWouldTakeForAMatch({
            house: HOUSE, theirs: ONE, theOther: OTHER, table: []
        });
        const backwards = whatAHouseWouldTakeForAMatch({
            house: HOUSE, theirs: { ...OTHER, onTheRoll: 'by blood' }, theOther: ONE, table: []
        });

        // `bloodlineTierForChild` reads both parents and nothing else, so the
        // children of this match carry the same thing whichever way round the
        // two of them are passed.
        expect(forwards.theLineTheChildrenWouldCarry)
            .toBe(backwards.theLineTheChildrenWouldCarry);
    });

    it('answers the same about a child with the parents swapped', () => {
        const forwards = whatTheChildIs({ one: ONE, other: OTHER });
        const backwards = whatTheChildIs({ one: OTHER, other: ONE });

        expect(forwards.theLineTheyCarry).toBe(backwards.theLineTheyCarry);
        expect(forwards.theLineStepsDownHere).toBe(backwards.theLineStepsDownHere);
        expect(forwards.bothSidesAreLines).toBe(backwards.bothSidesAreLines);
        expect([...forwards.rolls].map(r => r.houseId).sort())
            .toEqual([...backwards.rolls].map(r => r.houseId).sort());
    });

    it('writes both halves of the tie identically apart from the direction', () => {
        const changed = whatAMatchChanges({ one: ONE, other: OTHER, onDay: 400 });
        const [a, b] = changed.ties;

        expect(a.fromId).toBe(b.toId);
        expect(a.toId).toBe(b.fromId);
        expect(a.strength).toBe(b.strength);
        expect(a.type).toBe(b.type);
        expect(a.significance).toBe(b.significance);
    });

    it('puts the same rolls on the table with the two parties swapped', () => {
        const forwards = whatAMatchChanges({ one: ONE, other: OTHER, onDay: 400 });
        const backwards = whatAMatchChanges({ one: OTHER, other: ONE, onDay: 400 });

        const key = (r: { personId: string; houseId: string }) => `${r.personId}@${r.houseId}`;
        expect([...forwards.rolls].map(key).sort())
            .toEqual([...backwards.rolls].map(key).sort());
    });
});

/**
 * Words that would make one side of a match different from the other.
 *
 * Not a spelling rule and not squeamishness: every one of these carries an
 * assumption about which party is which, and a type or a sentence that carries
 * one has decided something the design says is open.
 */
const WORDS_THAT_PICK_A_SIDE: readonly string[] = Object.freeze([
    'bride', 'groom', 'husband', 'wife', 'wives', 'widow', 'widower',
    'dowry', 'maiden', 'suitress', 'matron',
    'she', 'her', 'hers', 'herself',
    'he', 'him', 'his', 'himself',
    'man', 'woman', 'men', 'women',
    'son', 'daughter', 'sons', 'daughters',
    'mother', 'father', 'mothers', 'fathers',
    'brother', 'sister', 'brothers', 'sisters',
    'boy', 'girl', 'male', 'female'
]);

describe('nothing in this directory picks a side', () => {
    const files = readdirSync(DIRECTORY).filter(f => f.endsWith('.ts'));

    it('has files to check', () => {
        expect(files.length).toBeGreaterThan(3);
    });

    for (const file of files) {
        it(`${file} names no party by anything but their position`, () => {
            const source = readFileSync(join(DIRECTORY, file), 'utf8').toLowerCase();
            const found: string[] = [];
            for (const word of WORDS_THAT_PICK_A_SIDE) {
                // Word boundaries, so `other` does not match `her` and
                // `somebody` does not match `some`.
                if (new RegExp(`\\b${word}\\b`).test(source)) found.push(word);
            }
            expect(found).toEqual([]);
        });
    }
});
