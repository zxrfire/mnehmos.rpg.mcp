/**
 * A body is material of a grade, and the grade is the ladder that already
 * exists.
 *
 * The guard that matters is the negative one: this module must not have
 * introduced a scale. Every assertion below is checked against
 * `who-can-refine-a-grade-of-medicine.ts` rather than against a number typed
 * out here, so a change to that ladder moves these tests with it.
 */

import { describe, expect, it } from 'vitest';
import {
    couldUseItThemselves,
    gradeOfWhatABodyYields,
    harvestFrom,
    WHAT_A_HARVEST_COSTS_THE_BODY
} from '../../../src/engine/cultivation/a-cultivators-body-is-material.js';
import {
    canRefineGrade,
    refiningOrdinalFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { whatItWasWorth } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';
import { createLeverage } from '../../../src/engine/social/grudges.js';

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
        expect(harvestFrom({
            part: 'marrow', fromId: 'off_the_ladder', fromName: 'Somebody',
            fromOrdinal: refiningOrdinalFor('mortal') - 1, byId: 'somebody', onDay: 1
        })).toBeNull();
    });

    it('gates working it on exactly the gate that gates a herb', () => {
        const heaven = refiningOrdinalFor('heaven');
        const taken = harvestFrom({
            part: 'bone', fromId: 'them', fromName: 'Them',
            fromOrdinal: heaven, byId: 'a_nobody', onDay: 10
        });
        expect(taken).not.toBeNull();
        for (const ordinal of [0, 5, 12, heaven - 1, heaven, heaven + 8]) {
            expect(couldUseItThemselves(taken!, ordinal))
                .toBe(canRefineGrade(taken!.grade, ordinal));
        }
    });

    it('leaves a low cultivator holding something they cannot use', () => {
        const heaven = refiningOrdinalFor('heaven');
        const taken = harvestFrom({
            part: 'core', fromId: 'them', fromName: 'Them',
            fromOrdinal: heaven, byId: 'a_nobody', onDay: 10
        })!;
        expect(couldUseItThemselves(taken, 2)).toBe(false);
        // Which is the plot: they have to find somebody who can, and everybody
        // who can is by construction able to read what it is.
    });

    it('carries the part through as data and never reads it', () => {
        const parts = ['core', 'marrow', 'bone', 'something nobody has thought of'];
        const grades = parts.map(part => harvestFrom({
            part, fromId: 'them', fromName: 'Them', fromOrdinal: 20, byId: 'me', onDay: 1
        })?.grade);
        expect(new Set(grades).size).toBe(1);
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
        expect(WHAT_A_HARVEST_COSTS_THE_BODY).toBe(1);
        expect(whatItWasWorth({
            cause: 'harvested', paidBy: 'subject',
            cost: WHAT_A_HARVEST_COSTS_THE_BODY, irreversible: true,
            onDay: 1, description: 'Taken for what they were made of.'
        })).toBe('unforgivable');
    });
});
