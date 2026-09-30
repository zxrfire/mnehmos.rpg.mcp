/**
 * The player's agreement must not be the only agreement that has effects.
 * These run the ordinary yearly pass: NPCs offer rites, enter witnessed beast
 * contracts, divert their own progress, and retain earned progress after release.
 * Each fixture pins its world and selects only the new agreement's RNG stream.
 * Removing both yearly callers makes both checks fail.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { primalEssenceOf } from '../../../src/engine/world/primal-essence.js';
import { BEASTS } from '../../../src/data/cultivation/beasts.js';

function selectedSeed(stream: string, person: string, chance: number): string {
    let sample = 0;
    while (forStream(`agreements-world-${sample}`, stream, person, 0).next() >= chance) sample++;
    return `agreements-world-${sample}`;
}

function standing(seed: string) {
    const world = createWorld({ seed, presentYear: 0, skipPriorAges: true, regionCount: 1 });
    const ground = world.locations.find(row => row.kind === 'region')!.id;
    const person = (id: string, sex: 'male' | 'female', techniqueIds: string[]) => createNpc(seed, {
        id, name: id, bornOnDay: -30 * 365, onDay: 0, locationId: ground, sex,
        cultivation: { realmOrdinal: 29, techniqueIds, accumulatingSinceDay: -1000, lastAdvancedOnDay: 0 }
    });
    world.npcs = [];
    return { world, ground, person };
}

describe('cultivation agreements in the world without a player directing them', () => {
    it('offers a rite through the yearly pass and spends the same personal property', () => {
        const seed = selectedSeed('world-furnace-offer', 'rite-subject',
            0.04 * (1 + openHandednessOf('rite-subject')));
        const { world, person } = standing(seed);
        const actor = person('rite-actor', 'male', ['lotus-plucking-rite']);
        const subject = upsertRelationship(person('rite-subject', 'female', ['lotus-nurturing-canon']), {
            targetId: actor.id, targetName: actor.name, kind: 'ally', standing: 1, note: 'They trust each other.'
        }, 0);
        world.npcs = [actor, subject];
        advanceWorldForPlay(world, { days: 120, pressure: { intensity: 0 } });
        expect(world.history.facts.some(fact => fact.data.furnace === true && fact.data.type === 'offered')).toBe(true);
        const live = (id: string) => world.npcs.find(row => row.id === id)!;
        expect(live(actor.id).cultivation.accumulatingSinceDay).toBeLessThan(-1000);
        expect(live(subject.id).cultivation.accumulatingSinceDay).toBeGreaterThan(-1000);
        expect(primalEssenceOf(live(actor.id))).toBeNull();
        expect(primalEssenceOf(live(subject.id))).toBeNull();
        expect(world.obligations.some(row => row.cause === 'violated' && row.subjectId === actor.id)).toBe(false);
    });

    it('forms a witnessed beast agreement, shares in later years, and releases lost ground', () => {
        const seed = selectedSeed('beast-contract-offer', 'bond-beast', 0.03);
        const { world, person } = standing(seed);
        const cultivator = person('bond-cultivator', 'male', []);
        const beast = upsertRelationship(person('bond-beast', 'female', []), {
            targetId: cultivator.id, targetName: cultivator.name, kind: 'ally', standing: 1,
            note: 'They trust each other.'
        }, 0);
        beast.tags.push(`beast:${BEASTS[0]!.id}`);
        world.npcs = [cultivator, beast, person('bond-witness', 'male', [])];
        advanceWorldForPlay(world, { days: 120, pressure: { intensity: 0 } });
        const oath = world.obligations.find(row => row.kind === 'oath' && row.holderId === beast.id
            && row.subjectId === cultivator.id)!;
        expect(oath).toBeDefined();
        expect(oath.tags).toContain('witnessed');
        advanceWorldForPlay(world, { days: 365, pressure: { intensity: 0 } });
        const live = () => world.npcs.find(row => row.id === beast.id)!;
        expect(live().cultivation.bondedCultivationDays).toBeGreaterThan(0);
        expect(world.npcs.find(row => row.id === cultivator.id)!.cultivation.accumulatingSinceDay).toBeGreaterThan(-1000);
        const earned = live().cultivation.bondedCultivationDays;
        live().locationId = null;
        advanceWorldForPlay(world, { days: 365, pressure: { intensity: 0 } });
        expect(world.obligations.find(row => row.id === oath.id)!.status).toBe('settled');
        expect(live().cultivation.bondedCultivationDays).toBe(earned);
        expect(world.obligations.some(row => row.cause === 'broken_oath' && row.subjectId === cultivator.id)).toBe(false);
    });
});
