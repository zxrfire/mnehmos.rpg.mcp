/**
 * Shame: a fact about somebody that other people hold, and that lowers them.
 *
 * The record keeps who holds it, so a concealed fostering and a public one differ
 * without a branch. The world layer keeps no shame ledger, so what a world pass
 * produces rides on the person as a tag, and the tag is what play reads: the
 * person carrying it is heard on it (`what-somebody-here-is-chewing-on.ts`).
 *
 * `liftShame`, `nowKnownTo`, `isConcealedFrom` and `isCarryingShame` went in the
 * unwired pass: no record was ever stored for them to act on, nothing in the world
 * lifts a shame, and the tag read below is the one play makes.
 */

import { describe, it, expect } from 'vitest';
import {
    createShame,
    shameCausesFromTags,
    shameTag
} from '../../../src/engine/social/shame.js';

describe('a shame record', () => {
    it('is a stored word and never a number, and nothing about it expires', () => {
        const record = createShame({
            subjectId: 'npc-parent',
            cause: 'birth_outside_the_household',
            severity: 'serious',
            onDay: 400,
            description: 'A child the household would not own.',
            heldBy: ['npc-parent', 'npc-friend']
        });
        expect(typeof record.severity).toBe('string');
        // Forty years going by is not a resolution.
        expect(record).not.toHaveProperty('expiresOnDay');
        expect(record.heldBy).toEqual(['npc-friend', 'npc-parent']);
        expect(record.common).toBe(false);
    });

    it('travels on a person, and only its own vocabulary reads back', () => {
        const tags = ['fostered', shameTag('fled_a_fight')];
        expect(shameCausesFromTags(tags)).toEqual(['fled_a_fight']);
        expect(shameCausesFromTags(['fostered'])).toEqual([]);
        // A tag that is not one of ours, and a cause that is not in the
        // vocabulary, are both simply not shames.
        expect(shameCausesFromTags(['shame:invented'])).toEqual([]);
    });
});
