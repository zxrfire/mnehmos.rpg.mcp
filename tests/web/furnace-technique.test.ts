/**
 * A forced rite recorded its use but no population absence when subjects died.
 * The shared edge now records the actual dead count through the taking ledger.
 * Survivors and willing partners create no hole in the population.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/engine/world/world-state.js';
import { useFurnaceTechnique } from '../../src/web/furnace-technique.js';
import { A_ROOM_HOLDS } from '../../src/engine/world/taking-people-is-not-a-quiet-thing.js';

describe('a furnace rite leaves an absence only for its dead', () => {
    it.each([
        [1, 0, 'coerced', 1],
        [A_ROOM_HOLDS + 1, 0, 'coerced', A_ROOM_HOLDS + 1],
        [1, 0.99, 'coerced', 0],
        [1, 0, 'offered', 0]
    ] as const)('%s subjects, death sample %s, %s', (count, deathSample, type, expectedDead) => {
        const world = createWorld({ seed: 'rite-hole', skipPriorAges: true, regionCount: 1, presentYear: 0 });
        const result = useFurnaceTechnique({
            world, actorId: 'actor', actorName: 'Lin Zhaoyi', actorSex: 'male',
            subjects: Array.from({ length: count }, (_, index) => ({
                personId: `subject-${index}`, name: `Subject ${index}`, sex: 'female' as const,
                conceptionSample: 0.99, deathSample
            })),
            onDay: world.currentDay, locationId: null, type, seenBy: null
        });
        expect(result.happened).toBe(true);
        const holes = world.history.facts.filter(fact => fact.kind === 'catastrophe'
            && typeof fact.data.heads === 'number');
        expect(holes).toHaveLength(expectedDead > 0 ? 1 : 0);
        if (expectedDead > 0) {
            expect(holes[0]!.data.heads).toBe(expectedDead);
            expect(holes[0]!.causeKnown).toBe(false);
            expect(holes[0]!.visibility).toBe(expectedDead > A_ROOM_HOLDS ? 'regional' : 'secret');
        }
    });
});
