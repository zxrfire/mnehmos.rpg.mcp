/**
 * A house split off from another carries out the books its founders are holding,
 * and nothing else.
 *
 * `librariesCarriedOutBy` minted a fresh book row at full uses for every art any
 * founder held, mastered or not, whether or not a copy existed anywhere. At
 * heaven and above that put books into the world that the world did not have,
 * and it made a one-reader book into as many as there were splinters. A book is
 * a thing: the rows in the founders' hands move to the new house with whatever
 * is left in them, a copy that was the old house's stays the old house's, and a
 * book read to dust stays dust. Anything else the new house writes out through
 * `applyManualCopying`, by somebody who has finished the art.
 */

import { describe, it, expect } from 'vitest';
import { librariesCarriedOutBy } from '../../../src/engine/world/manuals.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeObject, ruin } from '../../../src/engine/world/possessions.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';

const HEAVEN = TECHNIQUES.find(t => t.grade === 'heaven' && t.cap != null)!;

function book(id: string, possessorId: string, ownerId: string, extra: Record<string, unknown> = {}) {
    return makeObject({
        id, name: HEAVEN.name, kind: 'manual', possessorId, ownerId, ownerName: ownerId,
        tags: ['manual'], data: { techniqueId: HEAVEN.id, cap: HEAVEN.cap, copies: 1, ...extra }
    });
}

describe('a splinter library', () => {
    it('is the books in the founders hands, with what is left in them, and nothing minted', () => {
        const founder = { ...createNpc('split', { id: 'founder', bornOnDay: 0, onDay: 0 }),
            cultivation: { ...createNpc('split', { id: 'x', bornOnDay: 0, onDay: 0 }).cultivation, techniqueIds: [HEAVEN.id, 'another-art'] } };
        const splinter = makeFaction({ id: 'sect-splinter-founder', name: 'Founder Hall', seatLocationId: 'hall' });
        const state = {
            npcs: [founder],
            factions: [splinter],
            objects: [
                book('carried', 'founder', 'sect-old', { usesSpent: 2 }),
                ruin(book('dust', 'founder', 'founder'), { onDay: 5, source: 'founder' }),
                book('left-behind', 'sect-old', 'sect-old')
            ]
        } as unknown as WorldState;

        expect(librariesCarriedOutBy(state, splinter, [founder], 100)).toBe(1);

        expect(state.objects).toHaveLength(3);
        const carried = state.objects.find(o => o.id === 'carried')!;
        expect(carried.possessorId).toBe(splinter.id);
        expect(carried.ownerId).toBe('sect-old');
        expect(carried.data.usesSpent).toBe(2);
        expect(state.objects.find(o => o.id === 'left-behind')!.possessorId).toBe('sect-old');
        expect(state.objects.find(o => o.id === 'dust')!.possessorId).toBeNull();
    });
});
