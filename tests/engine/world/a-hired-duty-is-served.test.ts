/**
 * A paid contractor once had only a price reader: no days spent and no failure.
 * A private term now holds the worker at the post, closes once, and leaves a
 * broken word with the employer when they die or leave. The house's separate
 * account with its member is never transferred to the contractor.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state';
import { createNpc } from '../../../src/engine/world/npc-state';
import { createObligation } from '../../../src/engine/social/grudges';
import { settleHiredDuties } from '../../../src/engine/world/a-hired-duty-is-served';

function hired(employer = 'member') {
    const state = createWorld({ seed: 'hired-duty', skipPriorAges: true, regionCount: 1, presentYear: 0 });
    state.obligations = [createObligation({ kind: 'oath', holderId: 'worker', subjectId: employer,
        cause: 'service_term', severity: 'serious', onDay: 5, dueOnDay: 25,
        description: 'Serve the post.', tags: ['hired-duty', 'post-at:post'] })];
    state.npcs = [{ ...createNpc('hired-duty', { id: 'worker', name: 'Worker', bornOnDay: 0, onDay: 0 }),
        locationId: 'post', activity: { kind: 'stationed', note: 'Serve the post.', withIds: [],
            sinceDay: 5, untilDay: 25 } }];
    return state;
}

describe('a hired duty is served', () => {
    it('spends the contractor days, serves the whole term, and settles only once', () => {
        const state = hired();
        settleHiredDuties(state, 24);
        expect(state.obligations[0]!.status).toBe('open');
        expect(state.npcs[0]!.activity?.kind).toBe('stationed');
        settleHiredDuties(state, 25);
        expect(state.obligations[0]!.settlement?.resolution).toBe('oath_fulfilled');
        expect(state.npcs[0]!.activity).toBeNull();
        const settled = state.obligations.slice();
        settleHiredDuties(state, 100);
        expect(state.obligations).toEqual(settled);
    });
    it.each(['death', 'walked away'] as const)('leaves a broken word after %s', how => {
        const state = hired();
        state.npcs[0] = { ...state.npcs[0]!, ...(how === 'death'
            ? { status: 'physically_dead' as const, diedOnDay: 12 } : { locationId: 'elsewhere' }) };
        settleHiredDuties(state, 12);
        expect(state.obligations[0]!.settlement?.resolution).toBe('broken');
        expect(state.obligations.some(row => row.kind === 'grudge' && row.holderId === 'member'
            && row.subjectId === 'worker' && row.cause === 'broken_oath')).toBe(true);
    });
    it('uses the same private term for an NPC employer', () => {
        const state = hired('npc-member');
        settleHiredDuties(state, 25);
        expect(state.obligations[0]!.subjectId).toBe('npc-member');
        expect(state.obligations[0]!.settlement?.resolution).toBe('oath_fulfilled');
    });
});
