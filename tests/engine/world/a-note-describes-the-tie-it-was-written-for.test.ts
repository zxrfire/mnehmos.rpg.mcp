/**
 * A relationship's note may not outlive the tie it was written for.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `upsertRelationship` always overwrote `kind` and always let `note` fall back
 * to the previous one. So a pass that changed what a tie IS, without supplying
 * new words for it, left the old words behind - and the row then said one
 * thing in its kind and a different thing in its prose.
 *
 * Found while sweeping a world rather than by reading the function: across
 * four pinned worlds, 13 rows carried a kind and a note that disagreed -
 * `ally` rows saying `Their child.`, `Raised them.`, `Same household.` - and
 * every one of them was unilateral, because only one end had been rewritten.
 * A parent-child tie only one person holds is not a relationship, it is a
 * note; and a note contradicting its own row is worse than no note at all,
 * because everything downstream reads it as the world's own account.
 *
 * Seven call sites in `src/` pass no note, and that is reasonable of them: a
 * pass moving somebody from `kin` to `enemy` has no business inventing a
 * sentence about it. What it must not do is INHERIT one.
 *
 * ── AND THEN THE ROWS WERE KEYED BY KIND ─────────────────────────────────
 *
 * The design owner: *"marriages and master relationships ought to be separately
 * tracked, they aren't the same thing."* A row is now keyed by the pair AND the
 * kind, so most of this defect is structural rather than guarded: writing an
 * `ally` row does not touch the `child` row standing beside it, and a note can
 * only ever describe the kind it was written on. What is left to pin is the one
 * place a kind still changes on a row somebody already holds - a bond ending, a
 * death - which is `theTieBecomes`.
 *
 * ── WHAT IS PINNED ───────────────────────────────────────────────────────
 *
 *   1. The note survives an update that leaves the kind alone.
 *   2. A second kind stands BESIDE the first, with its own words, and neither
 *      note reaches the other row.
 *   3. A caller that supplies words gets them.
 *   4. `theTieBecomes` drops words that would describe a tie the row no longer
 *      is, and takes the words it is given.
 */

import { describe, it, expect } from 'vitest';

import {
    createNpc,
    relationshipWith,
    theTieBecomes,
    upsertRelationship,
    whatStandsBetween,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';

const DAY = 400 * 365;

/** One person holding one tie toward another, as the family pass writes it. */
function holdingAChild(): NpcRecord {
    const npc = createNpc('note-seed', {
        id: 'holder',
        bornOnDay: DAY - 365 * 80,
        onDay: DAY,
        locationId: null,
        occupation: 'disciple'
    });
    return upsertRelationship(npc, {
        targetId: 'other',
        targetName: 'The Other',
        kind: 'child',
        standing: 0.6,
        note: 'Their child.'
    }, DAY);
}

describe('a note describes the tie it was written for', () => {
    it('keeps the words while the kind is the same', () => {
        // THE ORDINARY CASE, and the whole reason the fallback exists. A pass
        // that moves the standing on a tie it is not redefining should not
        // have to restate what the tie is.
        const moved = upsertRelationship(holdingAChild(), {
            targetId: 'other',
            targetName: 'The Other',
            kind: 'child',
            standing: 0.9
        }, DAY + 365);

        const row = relationshipWith(moved, 'other', 'child')!;
        expect(row.kind).toBe('child');
        expect(row.standing).toBeCloseTo(0.9);
        expect(row.note, 'the words were dropped from a tie that did not change').toBe(
            'Their child.'
        );
    });

    it('puts a second kind beside the first, and neither note reaches the other', () => {
        // THE DEFECT, GONE BY CONSTRUCTION. `ally` carrying `Their child.` was
        // the shape the world sweep found thirteen times; an ally row is now a
        // row of its own, and the child row is still there under it.
        const both = upsertRelationship(holdingAChild(), {
            targetId: 'other',
            targetName: 'The Other',
            kind: 'ally',
            standing: 0.4
        }, DAY + 365);

        const stands = whatStandsBetween(both, 'other');
        expect(stands.map(row => row.kind).sort()).toEqual(['ally', 'child']);
        expect(relationshipWith(both, 'other', 'ally')!.note).toBe('');
        expect(relationshipWith(both, 'other', 'child')!.note, 'the child row was not touched')
            .toBe('Their child.');
        // And the most defining of the two is what a caller asking for one gets.
        expect(relationshipWith(both, 'other')!.kind).toBe('child');
    });

    it('takes the words it is given', () => {
        const said = upsertRelationship(holdingAChild(), {
            targetId: 'other',
            targetName: 'The Other',
            kind: 'enemy',
            standing: -0.8,
            note: 'Turned on them at the gate.'
        }, DAY + 365);

        expect(relationshipWith(said, 'other', 'enemy')!.note).toBe('Turned on them at the gate.');
    });
});

describe('and a kind that becomes another kind', () => {
    it('drops words that would describe a tie the row no longer is', () => {
        // The one place a kind still changes under somebody: a bond ending, a
        // death. The row keeps the day it began, which is what makes a bond of
        // eighty years read as eighty years old after it ends.
        const held = holdingAChild();
        const ended = theTieBecomes(held, 'other', 'child', 'former_disciple', DAY + 365, { note: '' });
        const row = relationshipWith(ended, 'other', 'former_disciple')!;
        expect(row.note, 'a former tie is still calling them their child').toBe('');
        expect(row.sinceDay, 'the day it began is kept').toBe(DAY);
        expect(relationshipWith(ended, 'other', 'child'), 'the old kind is gone').toBeNull();
    });

    it('and takes the words it is given', () => {
        const said = theTieBecomes(holdingAChild(), 'other', 'child', 'enemy', DAY + 365, {
            standing: -0.8, note: 'Turned on them at the gate.'
        });
        const row = relationshipWith(said, 'other', 'enemy')!;
        expect(row.note).toBe('Turned on them at the gate.');
        expect(row.standing).toBeCloseTo(-0.8);
    });
});
