/**
 * The taking ledger always marked an absence secret, even above its own quiet
 * count. Knowing people are gone and knowing who took them are separate facts:
 * the count exposes the absence, while attribution remains unknown.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { A_ROOM_HOLDS, A_PROVINCE_HOLDS, aTakingEntersTheWorld } from '../../../src/engine/world/taking-people-is-not-a-quiet-thing.js';

describe('the hole a taking leaves', () => {
    it.each([
        [A_ROOM_HOLDS, 'secret', 'local'],
        [A_ROOM_HOLDS + 1, 'regional', 'local'],
        [A_PROVINCE_HOLDS + 1, 'public', 'continental']
    ])('records %s missing people at the reach of that absence', (heads, visibility, scale) => {
        const world = createWorld({ seed: 'a-taking', skipPriorAges: true, regionCount: 1, presentYear: 0 });
        const written = aTakingEntersTheWorld(world, {
            heads: Number(heads), day: world.currentDay,
            summary: 'People were taken from the road.',
            actors: [{ id: 'the-taker', name: 'Qiu Wanbo', role: 'actor' }]
        });
        expect(written.fact.visibility).toBe(visibility);
        expect(written.fact.scale).toBe(scale);
        expect(written.fact.causeKnown).toBe(false);
        expect(written.fact.data.heads).toBe(heads);
        expect(written.fact.data.unattributed).not.toContain('Qiu Wanbo');
        expect(world.history.facts.filter(fact => fact.id === written.fact.id)).toHaveLength(1);
    });
});
