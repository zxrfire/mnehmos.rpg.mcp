/**
 * Standing on ground nobody holds, a player can find out.
 *
 * The defect: `whoHoldsTheGround` had two callers in `src/`, both in the NPC
 * simulation, so the fact that changes a player's odds was one the played game
 * would not say. Measured on a fresh run at the Meet on The Blown Ground, five
 * ways of asking gave five wrong answers - an NPC resolve failure, the
 * province's realm ceiling twice, the player's own sect standing, and unclear.
 *
 * Four claims:
 *
 *   1. The four readings say four different things, and each one says what to
 *      do about being wronged there. Not a lower number with no sentence.
 *   2. The world volunteers where nobody holds the ground, and only there. An
 *      absent register is a fact about paper, and 113 of 435 people in a seeded
 *      world stand on ground the record does not describe.
 *   3. Somebody who ASKED is answered whichever of the four it is.
 *   4. Asking after somewhere else is asking. The volunteer is for the ground
 *      under their own feet.
 */

import { describe, it, expect } from 'vitest';

import { whoAnswersForThisGround } from '../../src/web/ground-holder-lines';
import { makeLocation } from '../../src/engine/world/locations';

const LOW_FALL = makeLocation({ id: 'r', name: 'The Low Fall', kind: 'region' });
const DROWNED = makeLocation({
    id: 'sea', name: 'The Drowned Reach', kind: 'region', data: { politics: 'no_authority' }
});

/** The four grounds, read through the real chain rather than fabricated. */
const GROUNDS = {
    held: [
        LOW_FALL,
        makeLocation({
            id: 'g', name: 'a compound', kind: 'settlement', parentId: 'r',
            controllingFactionId: 'sect-sweptground-temple'
        })
    ],
    no_authority: [
        DROWNED,
        makeLocation({ id: 'g', name: 'Bellhead', kind: 'settlement', parentId: 'sea' })
    ],
    no_holder_of_record: [
        LOW_FALL,
        makeLocation({ id: 'g', name: 'Scarwater', kind: 'settlement', parentId: 'r' })
    ],
    unrecorded: [
        makeLocation({ id: 'r', name: 'Somewhere', kind: 'region' }),
        makeLocation({ id: 'g', name: 'A Place Nobody Registered', kind: 'settlement', parentId: 'r' })
    ]
} as const;

function read(which: keyof typeof GROUNDS, standingHere = true) {
    return whoAnswersForThisGround({
        locations: GROUNDS[which], locationId: 'g', standingHere
    });
}

describe('who answers for this ground', () => {
    it('reads each of the four as itself', () => {
        for (const which of Object.keys(GROUNDS) as Array<keyof typeof GROUNDS>) {
            expect(read(which).holding, which).toBe(which);
        }
    });

    it('answers somebody who asked, whichever of the four it is', () => {
        const answers = (Object.keys(GROUNDS) as Array<keyof typeof GROUNDS>)
            .map(which => read(which).answer);
        expect(new Set(answers).size).toBe(4);
        for (const answer of answers) expect(answer.length).toBeGreaterThan(80);
    });

    it('names a route out of being wronged rather than only a state', () => {
        // The route is what makes this a game answer instead of a database one,
        // and each one says something the state above it did not already say.
        expect(read('no_authority').answer).toMatch(/somebody who already knows you/);
        expect(read('no_holder_of_record').answer)
            .toMatch(/asking a favour rather than invoking a right/);
        // And the one that is ignorance points at the people who would know.
        expect(read('unrecorded').answer).toMatch(/Ask somebody standing here/);
    });

    it('volunteers only where nobody holds the ground', () => {
        expect(read('no_authority').lines.length).toBeGreaterThan(0);
        expect(read('no_holder_of_record').lines.length).toBeGreaterThan(0);
        // Held ground already names its holder everywhere else, and an absent
        // register is a fact about paper. Neither is worth a line every turn.
        expect(read('held').lines).toEqual([]);
        expect(read('unrecorded').lines).toEqual([]);
    });

    it('volunteers about the ground under their feet and not about elsewhere', () => {
        expect(read('no_authority', false).lines).toEqual([]);
        // Asked about, it still answers.
        expect(read('no_authority', false).answer).toBe(read('no_authority').answer);
    });

    it('carries the mechanical channel beside the prose', () => {
        expect(read('held').structure).toMatch(/whoHoldsTheGround: held by /);
        expect(read('held').structure).toMatch(/Recourse taken_up/);
        expect(read('unrecorded').structure).toMatch(/Recourse the_record_does_not_say/);
    });
});
