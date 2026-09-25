/**
 * A body is material of a grade, and the grade is the ladder that already
 * exists.
 *
 * The guard that matters is the negative one: this module must not have
 * introduced a scale. Every assertion below is checked against
 * `who-can-refine-a-grade-of-medicine.ts` rather than against a number typed
 * out here, so a change to that ladder moves these tests with it.
 *
 * A harvest record, a "could they use it themselves" wrapper and a constant
 * for what a harvest costs the body used to sit beside the grade read. Nothing
 * in play took material off a dead cultivator, so none of them had a caller;
 * they went, and what they pinned is asserted here against the reads the game
 * does make: the grade, the refining gate, and the deed layer's price.
 */

import { describe, expect, it } from 'vitest';
import { gradeOfWhatABodyYields } from '../../../src/engine/cultivation/a-cultivators-body-is-material.js';
import {
    canRefineGrade,
    refiningOrdinalFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { whatItWasWorth } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';
import { createObligation, type ObligationInput } from '../../../src/engine/social/grudges.js';

/** Something known about somebody that they would rather was not. */
const createLeverage = (input: Omit<ObligationInput, 'kind'>) => createObligation({ ...input, kind: 'leverage' });

describe('the grade of what a body yields', () => {
    it('is the grade that body could have worked, and no other ladder', () => {
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            const ordinal = refiningOrdinalFor(grade);
            expect(gradeOfWhatABodyYields(ordinal)).toBe(grade);
        }
    });

    it('has its floor at the bottom rung of the ladder and nowhere else', () => {
        // Mortal grade opens at ordinal zero, so every cultivator on the ladder
        // is material and only somebody off it entirely is not. Asserted
        // against `refiningOrdinalFor` rather than against the number, so a
        // change to the ladder moves this with it.
        expect(gradeOfWhatABodyYields(refiningOrdinalFor('mortal') - 1)).toBeNull();
        expect(gradeOfWhatABodyYields(refiningOrdinalFor('mortal'))).toBe('mortal');
    });

    it('leaves a low cultivator holding something they cannot use', () => {
        const grade = gradeOfWhatABodyYields(refiningOrdinalFor('heaven'))!;
        expect(canRefineGrade(grade, 2)).toBe(false);
        // Which is the plot: they have to find somebody who can, and everybody
        // who can is by construction able to read what it is.
    });
});

describe('the laundering moves the fact rather than erasing it', () => {
    it('is an ordinary ledger row and not a mechanic of its own', () => {
        // The crafter saw what went in. That is a position they hold, and
        // `leverage` is the kind whose whole definition is that using it does
        // not consume it - which is why they lean on the client for a century
        // rather than collecting a bounty once.
        const held = createLeverage({
            holderId: 'the_crafter', subjectId: 'the_client', cause: 'other',
            severity: 'grave', onDay: 40,
            description: 'Worked the material, and saw what it was.'
        });
        expect(held.kind).toBe('leverage');
        expect(held.status).toBe('open');
        // And the subject may be a house, because the columns are ids: nothing
        // in the ledger requires a person on either side.
        const overAHouse = createLeverage({
            holderId: 'a_nobody', subjectId: 'an_apex_house', cause: 'other',
            severity: 'grave', onDay: 40, description: 'They covered it up.'
        });
        expect(overAHouse.subjectId).toBe('an_apex_house');
    });
});

describe('what it costs the body', () => {
    it('is the whole of it, and the deed layer prices it at the top', () => {
        // The whole body, irreversibly: cost 1 is all of somebody.
        expect(whatItWasWorth({
            cause: 'harvested', paidBy: 'subject',
            cost: 1, irreversible: true,
            onDay: 1, description: 'Taken for what they were made of.'
        })).toBe('unforgivable');
    });
});
