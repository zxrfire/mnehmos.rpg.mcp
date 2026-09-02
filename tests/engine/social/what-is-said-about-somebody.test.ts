/**
 * Truth depends on proximity.
 *
 * The four reputations the design owner named are not four features and there
 * is no field naming any of them. Each test below produces one from the SAME
 * function by moving the observer, which is the claim: a good name that is
 * deserved, a good name that is not, a decent person nobody speaks well of, and
 * a wrongdoer his own house has the measure of.
 */

import { describe, expect, it } from 'vitest';
import {
    whatIsSaidAbout,
    type Told
} from '../../../src/engine/social/what-is-said-about-somebody.js';
import {
    atLeastAsNearAs,
    closeEnoughToKnow,
    howNearTheyStand
} from '../../../src/engine/social/how-near-you-stand-to-somebody.js';
import { createGrudge, createFavor, type ObligationRecord } from '../../../src/engine/social/grudges.js';
import { createRelationship } from '../../../src/engine/social/relationships.js';
import { createShame } from '../../../src/engine/social/shame.js';

const CHOSEN = 'the_chosen';

const praise: Told = {
    text: 'They say he gave away half of what he took out of the ruin.',
    hands: 5, fidelity: 0.4, namedIds: [CHOSEN], colour: 'well'
};
const smack: Told = {
    text: 'They say he left a junior behind on the ridge.',
    hands: 6, fidelity: 0.3, namedIds: [CHOSEN], colour: 'ill'
};

/** A grave thing he actually did, held by the three people who were there. */
function whatHeDid(): ObligationRecord {
    return createGrudge({
        holderId: 'the_junior', subjectId: CHOSEN, cause: 'violated',
        severity: 'grave', onDay: 100,
        description: 'It happened, and three people know it did.',
        participants: ['a_witness']
    });
}

const stranger = { observerId: 'a_stranger', houseId: 'other_house', placeId: 'far' };
const housemate = { observerId: 'a_housemate', houseId: 'his_house', placeId: 'here' };
const subject = { id: CHOSEN, houseId: 'his_house', placeId: 'here' };

describe('a fake good reputation', () => {
    it('is praise at a distance over a ledger the distance cannot see', () => {
        const far = whatIsSaidAbout({
            subjectId: CHOSEN, observer: stranger, subject,
            heard: [praise, praise], ledger: [whatHeDid()]
        });
        expect(far.saidToBe).toBe('well spoken of');
        expect(far.known).toHaveLength(0);
        expect(far.outOfReach).toBe(1);
        // And the honest answer from out there is not "he is good". It is that
        // there is no way to find out.
        expect(far.gap).toBe('no way of telling from here');
    });

    it('and the same praise reads differently to somebody in the house', () => {
        const near = whatIsSaidAbout({
            subjectId: CHOSEN, observer: housemate, subject,
            heard: [praise, praise], ledger: [whatHeDid()]
        });
        expect(near.saidToBe).toBe('well spoken of');
        expect(near.known).toHaveLength(1);
        expect(near.gap).toBe('better than he is');
    });
});

describe('a bad name that was not earned', () => {
    it('is slander, and nothing upgrades it into a deed', () => {
        // No ledger at all. Somebody with enemies.
        const far = whatIsSaidAbout({
            subjectId: CHOSEN, observer: stranger, subject, heard: [smack, smack], ledger: []
        });
        expect(far.saidToBe).toBe('ill spoken of');
        expect(far.known).toHaveLength(0);
        expect(far.gap).toBe('no way of telling from here');
    });

    it('and only somebody near enough can tell it is not true', () => {
        const near = whatIsSaidAbout({
            subjectId: CHOSEN, observer: housemate, subject,
            heard: [smack, smack],
            ledger: [createFavor({
                holderId: CHOSEN, subjectId: 'somebody', cause: 'returned_their_dead',
                severity: 'serious', onDay: 90, description: 'He brought them home.'
            })]
        });
        expect(near.knownToBe).toBe('well spoken of');
        expect(near.gap).toBe('worse than he is');
    });
});

describe('a good name that is deserved', () => {
    it('agrees with the ledger for anybody standing close enough to check', () => {
        const near = whatIsSaidAbout({
            subjectId: CHOSEN, observer: housemate, subject,
            heard: [praise],
            ledger: [createFavor({
                holderId: CHOSEN, subjectId: 'a_stranger', cause: 'taught_technique',
                severity: 'serious', onDay: 80, description: 'Taught them for nothing.'
            })]
        });
        expect(near.gap).toBe('it matches');
    });
});

describe('somebody decent nobody speaks well of', () => {
    it('is a full ledger and an empty market', () => {
        const near = whatIsSaidAbout({
            subjectId: CHOSEN, observer: housemate, subject,
            heard: [],
            ledger: [createFavor({
                holderId: CHOSEN, subjectId: 'a_stranger', cause: 'gifted_resource',
                severity: 'serious', onDay: 80, description: 'Gave it away.'
            })]
        });
        expect(near.saidToBe).toBe('nothing said');
        expect(near.gap).toBe('nobody is saying anything');
    });
});

describe('concealment and reputation are different fields', () => {
    it('produces a hidden wrong that nobody is saying anything about either way', () => {
        const shame = createShame({
            subjectId: CHOSEN, cause: 'known_for_a_grave_deed', severity: 'grave',
            onDay: 100, description: 'Three people hold this.',
            heldBy: ['the_junior', 'a_witness']
        });
        const outsider = whatIsSaidAbout({
            subjectId: CHOSEN, observer: stranger, subject, heard: [], shames: [shame]
        });
        expect(outsider.knownShames).toHaveLength(0);
        expect(outsider.saidToBe).toBe('nothing said');

        const onTheList = whatIsSaidAbout({
            subjectId: CHOSEN,
            observer: { observerId: 'a_witness', houseId: 'other_house' },
            subject, heard: [], shames: [shame]
        });
        expect(onTheList.knownShames).toHaveLength(1);
    });

    it('and a common shame is held by anybody, near or far', () => {
        const shame = createShame({
            subjectId: CHOSEN, cause: 'known_for_a_grave_deed', severity: 'grave',
            onDay: 100, description: 'A province watched.', common: true
        });
        const far = whatIsSaidAbout({
            subjectId: CHOSEN, observer: stranger, subject, shames: [shame]
        });
        expect(far.knownShames).toHaveLength(1);
    });
});

describe('what makes somebody near', () => {
    it('puts a tie above a shared square', () => {
        const tied = howNearTheyStand({
            observerId: 'me', houseId: null, placeId: 'far',
            ties: [createRelationship({
                fromId: 'me', toId: CHOSEN, type: 'junior_brother', onDay: 1
            })]
        }, subject);
        const sameSquare = howNearTheyStand(
            { observerId: 'me', houseId: null, placeId: 'here' }, subject);
        expect(tied.nearness).toBe('household');
        expect(sameSquare.nearness).toBe('nearby');
        expect(atLeastAsNearAs(tied.nearness, sameSquare.nearness)).toBe(true);
    });

    it('keeps an ended tie near, because they still know what they saw', () => {
        const rel = createRelationship({
            fromId: 'me', toId: CHOSEN, type: 'former_disciple', onDay: 1
        });
        const near = howNearTheyStand(
            { observerId: 'me', houseId: null, ties: [{ ...rel, active: false }] }, subject);
        expect(near.nearness).toBe('household');
    });

    it('lets the record itself override position when it names who holds it', () => {
        // A shame two people hold on purpose stays with those two whatever
        // anybody's ties look like.
        expect(closeEnoughToKnow({
            proximity: 'household', heldBy: ['a', 'b'], observerId: 'c'
        })).toBe(false);
        expect(closeEnoughToKnow({
            proximity: 'distant', heldBy: ['a', 'b'], observerId: 'b'
        })).toBe(true);
    });
});
