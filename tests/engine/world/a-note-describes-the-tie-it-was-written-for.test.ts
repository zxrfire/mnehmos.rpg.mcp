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
 * ── WHAT IS PINNED ───────────────────────────────────────────────────────
 *
 *   1. The note survives an update that leaves the kind alone - which is the
 *      ordinary case, and the reason the fallback existed at all.
 *   2. The note does NOT survive a change of kind with no words supplied.
 *   3. A caller that does supply words gets them, whichever way the kind went.
 */

import { describe, it, expect } from 'vitest';

import {
    createNpc,
    upsertRelationship,
    relationshipWith,
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

        const row = relationshipWith(moved, 'other')!;
        expect(row.kind).toBe('child');
        expect(row.standing).toBeCloseTo(0.9);
        expect(row.note, 'the words were dropped from a tie that did not change').toBe(
            'Their child.'
        );
    });

    it('drops words that would describe a tie this row no longer is', () => {
        // THE DEFECT. `ally` carrying `Their child.` is the exact shape the
        // world sweep found, thirteen times over four worlds.
        const fallenOut = upsertRelationship(holdingAChild(), {
            targetId: 'other',
            targetName: 'The Other',
            kind: 'ally',
            standing: 0.4
        }, DAY + 365);

        const row = relationshipWith(fallenOut, 'other')!;
        expect(row.kind).toBe('ally');
        expect(row.note, 'an ally row is still calling them their child').not.toBe(
            'Their child.'
        );
        expect(row.note).toBe('');
    });

    it('takes the words it is given, whichever way the kind went', () => {
        // A caller that HAS something to say is never overruled - the rule is
        // about inheritance, not about silencing.
        const said = upsertRelationship(holdingAChild(), {
            targetId: 'other',
            targetName: 'The Other',
            kind: 'enemy',
            standing: -0.8,
            note: 'Turned on them at the gate.'
        }, DAY + 365);

        const row = relationshipWith(said, 'other')!;
        expect(row.kind).toBe('enemy');
        expect(row.note).toBe('Turned on them at the gate.');
    });
});
