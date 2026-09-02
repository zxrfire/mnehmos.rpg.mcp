/**
 * The deed layer, pointed both ways.
 *
 * The guards that matter are the ones that would catch the design being
 * quietly narrowed: that kindness and harm run through ONE scorer, that nothing
 * reads the cause, that a house only ends up holding something when it had
 * something invested, and that a wrong nobody can answer is written to descend
 * rather than to be settled.
 */

import { describe, expect, it } from 'vitest';
import {
    isHeavy,
    whatADeedLeaves,
    whatItWasWorth,
    type Deed,
    type Party
} from '../../../src/engine/social-leverage/what-a-deed-leaves.js';
import type { ObligationCause } from '../../../src/engine/social/grudges.js';

const nobody: Party = {
    id: 'wanderer', name: 'A wanderer',
    houseId: null, houseName: null, alignment: null, ranked: false
};

function houseMember(id: string, over: Partial<Party> = {}): Party {
    return {
        id, name: id,
        houseId: 'house_a', houseName: 'The Standing Gate',
        alignment: 'righteous', ranked: true,
        ...over
    };
}

function deed(over: Partial<Deed> = {}): Deed {
    return {
        cause: 'robbery', paidBy: 'subject', cost: 0.2,
        onDay: 100, description: 'Something happened.',
        ...over
    };
}

describe('what it was worth', () => {
    it('is decided by what it cost and never by what it was called', () => {
        const causes: ObligationCause[] = [
            'robbery', 'killed_kin', 'violated', 'harvested', 'slander', 'other'
        ];
        const weights = causes.map(cause =>
            whatItWasWorth(deed({ cause, cost: 0.5, irreversible: false })));
        // Six different words for what happened, one weight. If this ever
        // fails, somebody has put a table of crimes in the scorer.
        expect(new Set(weights).size).toBe(1);
    });

    it('rises with the cost, monotonically, with no gaps', () => {
        const light = whatItWasWorth(deed({ cost: 0.1 }));
        const real = whatItWasWorth(deed({ cost: 0.5 }));
        const most = whatItWasWorth(deed({ cost: 0.9 }));
        expect(light).toBe('slight');
        expect(real).toBe('serious');
        expect(most).toBe('grave');
    });

    it('charges a step for a thing that does not come back, and one for a word given first', () => {
        expect(whatItWasWorth(deed({ cost: 0.9, irreversible: true }))).toBe('unforgivable');
        expect(whatItWasWorth(deed({ cost: 0.5, promised: true }))).toBe('grave');
    });

    it('prices the same absolute loss differently against what the payer had', () => {
        // A hundred stones off a beggar and off a treasury. Same cause, same
        // day, and the model must not call them the same event.
        expect(whatItWasWorth(deed({ cost: 0.95 })))
            .not.toBe(whatItWasWorth(deed({ cost: 0.05 })));
    });
});

describe('the same machinery, pointed two ways', () => {
    it('scores a kindness on exactly the scorer that scores a wrong', () => {
        const given = deed({ paidBy: 'actor', cause: 'gifted_resource', cost: 0.8, witnesses: 4 });
        const taken = deed({ paidBy: 'subject', cause: 'robbery', cost: 0.8, witnesses: 4 });
        expect(whatItWasWorth(given)).toBe(whatItWasWorth(taken));
    });

    it('makes a kindness nobody would have known about worth more, and only a kindness', () => {
        // Public virtue is cheap: reputation already pays for it. Helping
        // somebody where leaving them would have cost nothing and been known to
        // nobody is the most expensive thing anybody here can do.
        const watched = deed({ paidBy: 'actor', cause: 'saved_life', cost: 0.5, witnesses: 5 });
        const alone = deed({ paidBy: 'actor', cause: 'saved_life', cost: 0.5, witnesses: 0 });
        expect(whatItWasWorth(alone)).not.toBe(whatItWasWorth(watched));
        expect(isHeavy(whatItWasWorth(alone))).toBe(true);
        expect(isHeavy(whatItWasWorth(watched))).toBe(false);

        // The harm side gets no mirror of this. It already has a stronger
        // effect pointing the other way - a wrong nobody saw opens no account
        // at all - and doubling it here would make an unwitnessed wrong both
        // heavier and unrecorded.
        expect(whatItWasWorth(deed({ paidBy: 'subject', cost: 0.5, witnesses: 0 })))
            .toBe(whatItWasWorth(deed({ paidBy: 'subject', cost: 0.5, witnesses: 5 })));
    });

    it('opens a favour held BY the giver, and a grudge held BY the one it was done to', () => {
        const kindness = whatADeedLeaves({
            deed: deed({ paidBy: 'actor', cause: 'taught_technique', cost: 0.5 }),
            actor: { ...nobody, id: 'actor' }, subject: { ...nobody, id: 'subject' }
        });
        expect(kindness.opens[0].kind).toBe('favor');
        expect(kindness.opens[0].holderId).toBe('actor');
        expect(kindness.opens[0].subjectId).toBe('subject');

        const wrong = whatADeedLeaves({
            deed: deed({ paidBy: 'subject', cost: 0.5 }),
            actor: { ...nobody, id: 'actor' }, subject: { ...nobody, id: 'subject' }
        });
        expect(wrong.opens[0].kind).toBe('grudge');
        expect(wrong.opens[0].holderId).toBe('subject');
        expect(wrong.opens[0].subjectId).toBe('actor');
    });

    it('makes charity reach a house exactly as a wrong does', () => {
        const kindness = whatADeedLeaves({
            deed: deed({ paidBy: 'actor', cause: 'saved_life', cost: 0.9, irreversible: true }),
            actor: nobody,
            subject: houseMember('subject')
        });
        expect(kindness.reached).toBe('the houses');
        expect(kindness.opens.some(o => o.holderId === 'house_a' && o.kind === 'favor')).toBe(true);
        // And nothing about a kindness produces a shame.
        expect(kindness.shame).toBeNull();
    });

    it('does not let a house inflate what its own member is grateful for', () => {
        // A righteous house imposes a floor on a wrong done to one of its own.
        // It has no business deciding a member is more in debt than they are.
        const personal = whatItWasWorth(
            deed({ paidBy: 'actor', cause: 'sheltered', cost: 0.5 }));
        const left = whatADeedLeaves({
            deed: deed({ paidBy: 'actor', cause: 'sheltered', cost: 0.5 }),
            actor: nobody, subject: houseMember('subject')
        });
        expect(left.weight).toBe(personal);
    });
});

describe('a personal wrong becoming an institutional one', () => {
    const grave = () => deed({ cost: 0.9, irreversible: true, cause: 'violated' });

    it('reaches nobody when the person it was done to answers to nobody', () => {
        const left = whatADeedLeaves({
            deed: grave(), actor: nobody, subject: { ...nobody, id: 'subject' }
        });
        expect(left.reached).toBe('the two of them');
        expect(left.opens).toHaveLength(1);
    });

    it('reaches the house when it had something invested, even in its weakest member', () => {
        const left = whatADeedLeaves({
            deed: grave(), actor: nobody, subject: houseMember('subject'), reach: 'unbacked'
        });
        expect(left.reached).toBe('the houses');
        expect(left.opens.some(o => o.holderId === 'house_a')).toBe(true);
    });

    it('names the ACTOR when they answer to nobody and their HOUSE when they do', () => {
        const byANobody = whatADeedLeaves({
            deed: grave(), actor: nobody, subject: houseMember('subject'), reach: 'unbacked'
        });
        const byAHouseMember = whatADeedLeaves({
            deed: grave(),
            actor: houseMember('actor', { houseId: 'house_b', houseName: 'The Second Gate' }),
            subject: houseMember('subject'),
            reach: 'answerable'
        });
        const one = byANobody.opens.find(o => o.holderId === 'house_a');
        const two = byAHouseMember.opens.find(o => o.holderId === 'house_a');
        expect(one?.subjectId).toBe('wanderer');
        // The same act, and which houses it is between depends on who did it.
        expect(two?.subjectId).toBe('house_b');
    });

    it('writes it to be CARRIED, not settled, when nobody can be made to answer', () => {
        const left = whatADeedLeaves({
            deed: grave(), actor: nobody, subject: houseMember('subject'), reach: 'beyond'
        });
        expect(left.willDescend).toBe(true);
        expect(left.opens.every(o => o.kind === 'blood_feud')).toBe(true);
    });

    it('hands it to the family when the person it happened to cannot hold it', () => {
        const left = whatADeedLeaves({
            deed: deed({ cost: 1, irreversible: true, cause: 'killed_kin' }),
            actor: nobody,
            subject: {
                ...nobody, id: 'subject',
                kin: [{ id: 'brother', relation: 'descendant' }]
            },
            principalCannotHoldIt: true
        });
        expect(left.opens.map(o => o.holderId)).toEqual(['brother']);
        expect(left.reached).toBe('their people');
    });
});

describe('deniability', () => {
    it('opens nothing at all when the person it was done to has no idea', () => {
        // A cultivation quietly poisoned reads as a deviation. Something
        // certainly happened; there is nobody to hold an account against.
        const left = whatADeedLeaves({
            deed: deed({
                cost: 1, irreversible: true, cause: 'blocked_advancement',
                knownTo: ['wanderer', 'witness'], participants: ['witness']
            }),
            actor: nobody,
            subject: houseMember('subject')
        });
        expect(left.opens).toHaveLength(0);
        expect(left.reached).toBe('nobody has worked it out');
    });

    it('still leaves what the people who were there carry', () => {
        const left = whatADeedLeaves({
            deed: deed({
                cost: 1, irreversible: true,
                knownTo: ['wanderer', 'witness'], participants: ['witness']
            }),
            actor: nobody, subject: houseMember('subject')
        });
        expect(left.shame).not.toBeNull();
        expect(left.shame?.heldBy).toContain('witness');
        expect(left.shame?.common).toBe(false);
    });

    it('is a thing the province holds once a crowd saw it', () => {
        const left = whatADeedLeaves({
            deed: deed({ cost: 1, irreversible: true, witnesses: 20 }),
            actor: nobody, subject: houseMember('subject')
        });
        expect(left.shame?.common).toBe(true);
    });

    it('writes no shame for something slight', () => {
        const left = whatADeedLeaves({
            deed: deed({ cost: 0.05 }), actor: nobody, subject: houseMember('subject')
        });
        expect(left.shame).toBeNull();
    });
});

describe('the weight is written once', () => {
    it('is the same figure on every record the deed opens', () => {
        const left = whatADeedLeaves({
            deed: deed({
                cost: 0.9, irreversible: true,
                participants: ['a_witness']
            }),
            actor: houseMember('actor', { houseId: 'house_b', houseName: 'Second' }),
            subject: houseMember('subject', {
                kin: [{ id: 'brother', relation: 'clan' }],
                alliedHouseIds: ['house_c']
            }),
            reach: 'answerable'
        });
        expect(left.opens.length).toBeGreaterThan(2);
        expect(new Set(left.opens.map(o => o.severity)).size).toBe(1);
        expect(isHeavy(left.weight)).toBe(true);
        // Allies are named on the record so they can find it. They are never
        // made holders, because that would be the engine deciding they care.
        const institutional = left.opens.find(o => o.holderId === 'house_a');
        expect(institutional?.participants).toContain('house_c');
        expect(left.opens.some(o => o.holderId === 'house_c')).toBe(false);
    });

    it('carries the cause through untouched onto every record', () => {
        const left = whatADeedLeaves({
            deed: deed({ cause: 'harvested', cost: 1, irreversible: true }),
            actor: nobody,
            subject: houseMember('subject', { kin: [{ id: 'son', relation: 'descendant' }] })
        });
        expect(left.opens.every(o => o.cause === 'harvested')).toBe(true);
    });
});
