/**
 * Shame: a fact about somebody that other people hold, and that lowers them.
 *
 * The rules being guarded are the obligation ledger's four, applied to a
 * different kind of record. The one that matters most is the third - shame is
 * held by PEOPLE - because it is what makes a concealed fostering different
 * from a public one without either of them needing a branch.
 */

import { describe, it, expect } from 'vitest';
import {
    createShame,
    isCarryingShame,
    isConcealedFrom,
    liftShame,
    nowKnownTo,
    shameCausesFromTags,
    shameTag
} from '../../../src/engine/social/shame.js';

function aShame() {
    return createShame({
        subjectId: 'npc-parent',
        cause: 'birth_outside_the_household',
        severity: 'serious',
        onDay: 400,
        description: 'A child the household would not own.',
        heldBy: ['npc-parent', 'npc-friend']
    });
}

describe('a shame record', () => {
    it('is carried until something lifts it, and nothing lifts it on a timer', () => {
        const record = aShame();
        expect(record.status).toBe('carried');
        expect(record.lifted).toBeNull();
        // There is no expiry field to set, which is the point: forty years
        // going by is not a resolution.
        expect(record).not.toHaveProperty('expiresOnDay');

        const done = liftShame(record, {
            how: 'acknowledged',
            onDay: 900,
            note: 'Said so, out loud, to the people who mattered.'
        });
        expect(done.status).toBe('lifted');
        expect(done.lifted?.how).toBe('acknowledged');
        // The original is untouched. Deltas out, nothing mutated.
        expect(record.status).toBe('carried');
    });

    it('is a stored word and never a number', () => {
        expect(typeof aShame().severity).toBe('string');
    });

    it('knows who holds it, and therefore who it is being kept from', () => {
        const record = aShame();
        expect(isConcealedFrom(record, 'npc-child')).toBe(true);
        expect(isConcealedFrom(record, 'npc-friend')).toBe(false);

        // Somebody finds out. The record does not change; the list does.
        const out = nowKnownTo(record, ['npc-child']);
        expect(isConcealedFrom(out, 'npc-child')).toBe(false);
        expect(out.cause).toBe(record.cause);
        expect(out.severity).toBe(record.severity);
        expect(out.incurredOnDay).toBe(record.incurredOnDay);
    });

    it('stops being a list once it is common, which is a different fact', () => {
        const common = createShame({
            subjectId: 'npc-parent',
            cause: 'expelled',
            severity: 'grave',
            onDay: 10,
            description: 'Put out of the house in front of it.',
            common: true
        });
        // Nobody is being kept from a thing everybody knows.
        expect(isConcealedFrom(common, 'anybody')).toBe(false);
    });

    it('travels on a person when the layer holding them has no ledger', () => {
        // The world layer stores NPCs, not ledgers. A shame produced by a world
        // pass rides on a tag, encoded here so no caller ever parses one.
        const tags = ['fostered', shameTag('birth_outside_the_household')];
        expect(shameCausesFromTags(tags)).toEqual(['birth_outside_the_household']);
        expect(isCarryingShame(tags)).toBe(true);
        expect(isCarryingShame(['fostered'])).toBe(false);
        // A tag that is not one of ours, and a cause that is not in the
        // vocabulary, are both simply not shames.
        expect(shameCausesFromTags(['shame:invented'])).toEqual([]);
    });
});
