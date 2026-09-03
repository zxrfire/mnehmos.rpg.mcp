/**
 * The ledger is not empty before somebody is told.
 *
 * The design owner, correcting the reading that had state 1 holding nothing:
 *
 *   > "also the ledger is not empty before being told, it is there, they just
 *   > don't have an outlet for their anger, right?"
 *
 * A brother who is dead is dead, and the people who loved him do not need a
 * teller to start grieving. **What being told supplies is not the wrong, it is
 * the target.** So state 1 is much rarer and much more transient than a first
 * reading has it - it is the window before anybody notices, not the whole span
 * between the deed and the telling.
 *
 * These pin that at the deed layer, where the volume is: `whatADeedLeaves`
 * routes a wrong to the kin of the person it was done to, and until this it
 * gave a relative who could not name the actor NOTHING AT ALL.
 */

import {
    whatADeedLeaves,
    type Deed,
    type Party
} from '../../../src/engine/social-leverage/what-a-deed-leaves';
import {
    NO_NAME_ON_IT,
    NO_NAME_TAG,
    hasANameOnIt,
    theWrongedPartyAlreadyHasTheName,
    theSearchItOpens
} from '../../../src/engine/social/accounts-with-no-name';
import { createObligation } from '../../../src/engine/social/grudges';

const KILLER: Party = {
    id: 'killer', name: 'The one who did it',
    houseId: null, houseName: null, alignment: null, ranked: false
};

/** Somebody with a brother and a sister who were not there. */
const DEAD: Party = {
    id: 'the-dead', name: 'The dead man',
    houseId: null, houseName: null, alignment: null, ranked: false,
    kin: [
        { id: 'brother', relation: 'sibling' },
        { id: 'sister', relation: 'sibling' }
    ]
};

/** A killing: heavy, irreversible, and it leaves a body. */
function aKilling(over: Partial<Deed> = {}): Deed {
    return {
        cause: 'killed_kin',
        paidBy: 'subject',
        cost: 1,
        irreversible: true,
        onDay: 400,
        description: 'He was killed on the low road.',
        witnesses: 2,
        ...over
    };
}

describe('kin who cannot name it still hold it', () => {
    it('opens an account with no name on it for a relative who was not there', () => {
        const left = whatADeedLeaves({
            deed: aKilling({ knownTo: ['killer', 'the-dead'] }),
            actor: KILLER,
            subject: DEAD,
            principalCannotHoldIt: true
        });

        const theirs = left.opens.filter(row => row.holderId === 'brother');
        expect(theirs, 'the brother holds something').toHaveLength(1);
        expect(hasANameOnIt({ subjectId: theirs[0].subjectId })).toBe(false);
        expect(theirs[0].subjectId).toBe(NO_NAME_ON_IT);
        expect(theirs[0].tags).toContain(NO_NAME_TAG);
        expect(theirs[0].tags).toContain('carried:sibling');
    });

    it('holds it at the same weight as a relative who can name it', () => {
        // Not knowing who did it does not make it lighter. If it did, being
        // told would be an escalation rather than the arrival of a target, and
        // the whole middle state would be a discount.
        const blind = whatADeedLeaves({
            deed: aKilling({ knownTo: ['killer', 'the-dead'] }),
            actor: KILLER, subject: DEAD, principalCannotHoldIt: true
        }).opens.find(r => r.holderId === 'brother')!;
        const knowing = whatADeedLeaves({
            deed: aKilling(),
            actor: KILLER, subject: DEAD, principalCannotHoldIt: true
        }).opens.find(r => r.holderId === 'brother')!;

        expect(blind.severity).toBe(knowing.severity);
        expect(blind.onDay).toBe(knowing.onDay);
        expect(blind.cause).toBe(knowing.cause);
        expect(hasANameOnIt({ subjectId: knowing.subjectId })).toBe(true);
    });

    it('says so in the description, rather than leaving the row to be read wrong', () => {
        const theirs = whatADeedLeaves({
            deed: aKilling({ knownTo: ['killer', 'the-dead'] }),
            actor: KILLER, subject: DEAD, principalCannotHoldIt: true
        }).opens.find(r => r.holderId === 'brother')!;
        expect(theirs.description).toMatch(/nobody has put a name to it/);
    });

    it('opens nothing where the deed reads as something other than a deed', () => {
        // The narrow case `knownTo` was written for, and the one where holding
        // nothing is right: a poisoning that reads as a qi deviation tells
        // nobody that anybody did anything.
        const left = whatADeedLeaves({
            deed: aKilling({ knownTo: ['killer'], deniable: true }),
            actor: KILLER,
            subject: DEAD,
            principalCannotHoldIt: true
        });
        expect(left.opens.filter(r => r.holderId === 'brother')).toHaveLength(0);
        expect(left.opens.filter(r => r.holderId === 'sister')).toHaveLength(0);
    });

    it('does not invent gratitude nobody knows they were given', () => {
        // The kindness direction has no equivalent. Somebody who was helped and
        // never knew owes nothing, and their relatives owe nothing either -
        // there is no anger looking for an outlet, only a debt nobody incurred.
        const left = whatADeedLeaves({
            deed: {
                cause: 'saved_life', paidBy: 'actor', cost: 0.9, irreversible: true,
                onDay: 400, description: 'She stood between him and it.',
                knownTo: ['killer']
            },
            actor: KILLER,
            subject: DEAD
        });
        expect(left.opens.filter(r => r.holderId === 'brother')).toHaveLength(0);
    });
});

describe('the rule for whether a wrong can be held with no name', () => {
    it('is a question about the act, not a list of causes', () => {
        // A stranger could have done it.
        expect(theWrongedPartyAlreadyHasTheName({})).toBe(false);
        expect(theWrongedPartyAlreadyHasTheName({ promised: false })).toBe(false);
        // A word was given first, so somebody gave it, so they have the name.
        expect(theWrongedPartyAlreadyHasTheName({ promised: true })).toBe(true);
        // They already had dealings, which is what a betrayal requires.
        expect(theWrongedPartyAlreadyHasTheName({ priorTie: true })).toBe(true);
        // Somebody who would tell them saw it.
        expect(theWrongedPartyAlreadyHasTheName({ seenBySomebodyWhoWouldSay: true })).toBe(true);
    });
});

describe('and it gives its holder something to do about it', () => {
    it('opens a search rather than leaving the anger with nowhere to go', () => {
        const held = createObligation({
            kind: 'grudge', holderId: 'brother', subjectId: NO_NAME_ON_IT,
            cause: 'killed_kin', severity: 'grave', onDay: 400,
            description: 'He was killed on the low road.'
        });
        const search = theSearchItOpens(held, { lost: 'what happened to him' });
        expect(search).not.toBeNull();
        expect(search!.targetId, 'they have nobody to point at').toBeNull();
        expect(search!.obstacles).toContain('Nobody has put a name to it.');
        // Heavier wrongs are looked into harder. The one read of severity, and
        // it decides priority rather than any outcome.
        const slight = theSearchItOpens(
            { ...held, severity: 'slight' }, { lost: 'what happened to him' });
        expect(search!.priority).toBeGreaterThan(slight!.priority);
    });
});
