/**
 * The killing does not open the account. The telling does.
 *
 * AGENTS.md, *a fact reaches a person, and reaching them is an event*. These
 * pin the four rulings that follow from it, and one of them is a decision
 * rather than a behaviour and would otherwise live only as an absent branch:
 *
 *   THE DATE IS THE DAY THEY WERE TOLD. Not the day it happened. That is the
 *   whole ruling in one field, and a reader who does not know it will "fix" the
 *   row to match the fact's date and delete the mechanic.
 *
 *   THE NAME IS THE NAME THEY WERE GIVEN. There is deliberately no check that
 *   the telling got it right, because a hearer who could tell a true telling
 *   from a false one is a hearer with the engine's omniscient view. A grudge
 *   opening against the wrong person is the design working.
 *
 *   THE WEIGHT IS THE DEED'S. `grudges.ts` requires severity be decided once,
 *   at creation, and finding out later makes a thing HELD rather than heavier.
 *
 *   THERE ARE THREE STATES, NOT TWO. Nothing known; an open account with no
 *   name on it; and a name attached. The middle one is the design - somebody
 *   who knows they were wronged, cannot say by whom, and is therefore looking -
 *   and it is the state a reader will delete by "simplifying" the branch that
 *   allows a subject-less row.
 */

import {
    whatBeingToldOpens,
    type TheDeedAsItStands,
    type TheTelling
} from '../../../src/engine/social/hearing-of-a-wrong';
import {
    NO_NAME_ON_IT,
    NO_NAME_TAG,
    hasANameOnIt,
    theSearchItOpens
} from '../../../src/engine/social/accounts-with-no-name';
import { createObligation, type ObligationRecord } from '../../../src/engine/social/grudges';

const DEED: TheDeedAsItStands = {
    weight: 'grave',
    cause: 'killed_kin',
    kind: 'grudge',
    description: 'Somebody was killed on the low road.',
    participants: ['npc-witness'],
    tags: ['deed:taken']
};

/** A telling that reached the brother in a market, naming the killer. */
function telling(over: Partial<TheTelling> = {}): TheTelling {
    return {
        hearerId: 'brother',
        onDay: 900,
        factId: 'f7',
        blamedId: 'killer',
        alsoNamedIds: ['the-dead'],
        form: 'partial',
        channel: 'market',
        fromHolderId: 'carter',
        ...over
    };
}

const CARRIES = {
    hearerId: 'brother',
    ids: ['brother', 'the-dead'],
    relationOf: { 'the-dead': 'sibling' }
};

/** An account the brother is already carrying about `f7`. */
function heldRecord(subjectId: string): ObligationRecord {
    return createObligation({
        kind: 'grudge',
        holderId: 'brother',
        subjectId,
        cause: 'killed_kin',
        severity: 'grave',
        onDay: 400,
        triggeringEventId: 'f7',
        description: 'Somebody was killed on the low road.',
        tags: subjectId === NO_NAME_ON_IT ? [NO_NAME_TAG] : []
    });
}

describe('being told is what opens the account', () => {
    it('dates the account to the day they were told, not the day it happened', () => {
        const out = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES });
        expect(out.opens).not.toBeNull();
        // The fact is `f7` and it happened whenever it happened. 900 is when the
        // brother found out, and it is the field the whole ruling rests on.
        expect(out.opens!.onDay).toBe(900);
        expect(out.opens!.triggeringEventId).toBe('f7');
        expect(out.opens!.holderId).toBe('brother');
        expect(out.opens!.subjectId).toBe('killer');
        expect(out.opens!.tags).toContain('opened-on-being-told');
    });

    it('carries the weight the deed was priced at and does not re-decide it', () => {
        for (const weight of ['slight', 'serious', 'grave', 'unforgivable'] as const) {
            const out = whatBeingToldOpens({
                telling: telling(), deed: { ...DEED, weight }, carriesFor: CARRIES
            });
            expect(out.opens!.severity).toBe(weight);
        }
    });

    it('holds it against the name it was given, right or wrong', () => {
        // Same event, same brother, a teller who names somebody else. Nothing
        // in the module compares the two, and the row is identical in every
        // respect except who it is against.
        const wrong = whatBeingToldOpens({
            telling: telling({ blamedId: 'somebody-else' }),
            deed: DEED,
            carriesFor: CARRIES
        });
        expect(wrong.opens!.subjectId).toBe('somebody-else');
        expect(wrong.againstAsTold).toBe('somebody-else');
        expect(wrong.opens!.severity).toBe('grave');
        expect(wrong.opens!.fromBelief).toBe(true);
    });

    it('opens nothing when nothing of theirs was legible in it', () => {
        const out = whatBeingToldOpens({
            telling: telling({ form: 'unattributed', blamedId: null, alsoNamedIds: [] }),
            deed: DEED,
            carriesFor: CARRIES
        });
        expect(out.did).toBe('nothing');
        expect(out.opens).toBeNull();
        expect(out.heldBack).toBe('nothing of theirs in it');
    });

    it('opens nothing for somebody with nothing of theirs in it', () => {
        const out = whatBeingToldOpens({
            telling: telling({ hearerId: 'a-stranger' }),
            deed: DEED,
            carriesFor: { hearerId: 'a-stranger', ids: ['a-stranger'] }
        });
        expect(out.opens).toBeNull();
        expect(out.heldBack).toBe('nothing of theirs in it');
    });

    it('is not a second account when they are told a second time', () => {
        const out = whatBeingToldOpens({
            telling: telling(),
            deed: DEED,
            carriesFor: CARRIES,
            held: heldRecord('killer')
        });
        expect(out.opens).toBeNull();
        expect(out.heldBack).toBe('they already had it');
    });

    it('opens nothing about themselves when the telling names them for it', () => {
        const out = whatBeingToldOpens({
            telling: telling({ blamedId: 'brother' }),
            deed: DEED,
            carriesFor: CARRIES
        });
        expect(out.opens).toBeNull();
        expect(out.heldBack).toBe('it names them');
    });

    it('opens for the person it was done to, when they are the one finding out', () => {
        // The deniable case arriving one telling later: something was done to
        // them, they had no idea there was anybody behind it, and somebody has
        // just told them who.
        const out = whatBeingToldOpens({
            telling: telling({ hearerId: 'victim', alsoNamedIds: ['victim'] }),
            deed: DEED,
            carriesFor: { hearerId: 'victim', ids: ['victim'] }
        });
        expect(out.opens!.holderId).toBe('victim');
        expect(out.opens!.subjectId).toBe('killer');
        expect(out.opens!.tags).not.toContain('carried:sibling');
    });

    it('marks a first-hand account as resting on a fact and a telling as belief', () => {
        const saw = whatBeingToldOpens({
            telling: telling({ channel: 'witnessed' }), deed: DEED, carriesFor: CARRIES
        });
        expect(saw.opens!.fromBelief).toBe(false);

        const heard = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES });
        expect(heard.opens!.fromBelief).toBe(true);
    });

    it('says on the row that an account rests on nothing when it does', () => {
        // A story with no event under it, naming a real person. It opens, and
        // the row says what it stands on, which is nothing.
        const out = whatBeingToldOpens({
            telling: telling({ factId: null }), deed: DEED, carriesFor: CARRIES
        });
        expect(out.opens!.triggeringEventId).toBeNull();
        expect(out.opens!.tags).toContain('rests-on-nothing');
    });

    it('names who told them, so the question a house asks first has an answer', () => {
        const out = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES });
        expect(out.opens!.tags).toContain('told-by:carter');
        expect(out.opens!.participants).toContain('carter');
    });

    it('says which of the three transitions it was', () => {
        expect(whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES }).did)
            .toBe('opened against a name');
    });

    it('records how it reached them and in what form', () => {
        const out = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES });
        expect(out.opens!.tags).toContain('heard:market');
        expect(out.opens!.tags).toContain('told:partial');
        expect(out.opens!.tags).toContain('carried:sibling');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE MIDDLE STATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody who knows they were wronged and cannot say by whom.
 *
 * This is the state that makes a killing with no witness have a consequence,
 * and it is the one that changes what silencing a witness buys: killing the
 * only person who could name you does not close the account, it converts a
 * named one into an unnamed one that goes looking.
 */
describe('an account can be open with no name on it', () => {
    /** A telling that names what was lost and nobody for it. */
    const noDoer = () => telling({ blamedId: null });

    it('opens against nobody when the telling names the loss and no doer', () => {
        const out = whatBeingToldOpens({ telling: noDoer(), deed: DEED, carriesFor: CARRIES });
        expect(out.did).toBe('opened against nobody');
        expect(out.opens).not.toBeNull();
        expect(hasANameOnIt({ subjectId: out.opens!.subjectId })).toBe(false);
        expect(out.opens!.tags).toContain(NO_NAME_TAG);
        expect(out.againstAsTold).toBeNull();
    });

    it('opens it at the weight the deed was priced at, undiscounted', () => {
        // Not knowing who did a thing does not make it lighter. That is the
        // whole reason the middle state is worth having rather than deferring
        // the account until a name turns up.
        const named = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES });
        const unnamed = whatBeingToldOpens({ telling: noDoer(), deed: DEED, carriesFor: CARRIES });
        expect(unnamed.opens!.severity).toBe(named.opens!.severity);
        expect(unnamed.opens!.onDay).toBe(named.opens!.onDay);
        expect(unnamed.opens!.triggeringEventId).toBe(named.opens!.triggeringEventId);
    });

    /**
     * The rule, not a list.
     *
     * A wrong that could only have been done by somebody the wronged party
     * already knew names its own subject, so there is no moment where the deed
     * is legible and its author is not.
     */
    it('is unavailable where the act could not have been done by a stranger', () => {
        const out = whatBeingToldOpens({
            telling: noDoer(),
            deed: { ...DEED, how: { promised: true } },
            carriesFor: CARRIES
        });
        expect(out.did).toBe('nothing');
        expect(out.heldBack).toBe('a wrong like this comes with a name');
    });

    it('is available for a wrong a stranger could have done', () => {
        for (const how of [undefined, {}, { promised: false }]) {
            const out = whatBeingToldOpens({
                telling: noDoer(), deed: { ...DEED, how }, carriesFor: CARRIES
            });
            expect(out.did).toBe('opened against nobody');
        }
    });

    it('gives its holder something to want, and something in the way of it', () => {
        const search = theSearchItOpens(heldRecord(NO_NAME_ON_IT), { lost: 'what happened' });
        expect(search).not.toBeNull();
        expect(search!.kind).toBe('revenge');
        expect(search!.targetId).toBeNull();
        expect(search!.obstacles).toContain('Nobody has put a name to it.');
        // And an account that has a name on it wants something else, which is
        // not this module's question.
        expect(theSearchItOpens(heldRecord('killer'), { lost: 'what happened' })).toBeNull();
    });
});

describe('and a name can arrive later', () => {
    it('puts the name on the account they were already carrying', () => {
        const held = heldRecord(NO_NAME_ON_IT);
        const out = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES, held });

        expect(out.did).toBe('put a name on what they carried');
        // ONE account, at the same id, so writing it updates the row rather
        // than forking it. The derived id folds in the subject, so without this
        // a name attaching would silently become a second account.
        expect(out.opens!.id).toBe(held.id);
        expect(out.opens!.subjectId).toBe('killer');
        expect(out.opens!.tags).not.toContain(NO_NAME_TAG);
        expect(out.opens!.tags.some(t => t.startsWith('name-attached:'))).toBe(true);
    });

    it('does not move the day the account opened', () => {
        const held = heldRecord(NO_NAME_ON_IT);
        const out = whatBeingToldOpens({ telling: telling(), deed: DEED, carriesFor: CARRIES, held });
        // The day they were wronged is the day the account opened; the day they
        // found out who is a different fact and lands in the tags. A reader in
        // forty years can have both.
        expect(out.opens!.onDay).toBe(400);
        expect(out.opens!.tags).toContain('name-attached:900');
    });

    it('attaches the wrong name exactly as readily', () => {
        const held = heldRecord(NO_NAME_ON_IT);
        const out = whatBeingToldOpens({
            telling: telling({ blamedId: 'somebody-else' }),
            deed: DEED,
            carriesFor: CARRIES,
            held
        });
        expect(out.opens!.subjectId).toBe('somebody-else');
        expect(out.opens!.id).toBe(held.id);
    });

    it('is not a second nothing when the second telling has no name either', () => {
        const out = whatBeingToldOpens({
            telling: telling({ blamedId: null }),
            deed: DEED,
            carriesFor: CARRIES,
            held: heldRecord(NO_NAME_ON_IT)
        });
        expect(out.did).toBe('nothing');
        expect(out.heldBack).toBe('they already had it');
    });
});
