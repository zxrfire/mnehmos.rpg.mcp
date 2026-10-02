/**
 * At year 400, death settlements spent 22 ms/year rescanning possessions and
 * bonds. A lifespan batch now reads them once. Successive deaths must still
 * collect both communication halves and settle goods inherited moments earlier.
 * The ordinary resolver is the control, in the same process and seeded world.
 */
import { expect, it } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { cloneWorld, getNpc, indexById } from '../../../src/engine/world/world-state.js';
import { settleNpcDeath } from '../../../src/engine/world/time.js';
import { readDeathsTogether } from '../../../src/engine/world/reading-the-estates-settled-together.js';
import { isTheWorldsToMove, theWorldEnds, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { aPairOfCommunicationJade } from '../../../src/engine/world/a-pair-of-communication-jade.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { addToTheStack, keepTheTwins, howManyTheyCarry, howManyTwinsTheHallKeeps } from '../../../src/engine/world/a-communication-talisman-carries-word-home.js';

it('settles successive estates exactly as independent reads do', () => {
    const state = seedWorld({ seed: 'estates-together', catalog: fixtureCatalog(), population: 40 }).state;
    const people = state.npcs.filter(n => n.status === 'alive' && isTheWorldsToMove(n)).slice(0, 2);
    expect(people).toHaveLength(2);
    const place = state.locations[0]!.id;
    state.npcs = state.npcs.map(n => ({ ...n, locationId: people.some(p => p.id === n.id) ? place : null }));
    const first = getNpc(state, people[0]!.id)!;
    const second = getNpc(state, people[1]!.id)!;
    state.npcs[indexById(state.npcs, second.id)] = upsertRelationship(second, {
        targetId: first.id, targetName: first.name, kind: 'master', standing: 0.5
    }, state.currentDay);
    state.objects.push(makeObject({ id: 'estate-proof', name: 'Estate proof', kind: 'manual',
        significance: 'significant', ownerId: first.id, possessorId: first.id, locationId: place }),
        ...aPairOfCommunicationJade({ maker: { ...first, ordinal: 30 }, keeps: first, gives: second,
            onDay: state.currentDay, locationId: place }));
    const house = state.factions[0]!;
    addToTheStack(state.objects, { houseId: house.id, houseName: house.name, holderId: first.id,
        holderName: first.name, count: 3, locationId: place });
    keepTheTwins(state.objects, { houseId: house.id, houseName: house.name, senderId: first.id,
        senderName: first.name, count: 3, hallLocationId: house.seatLocationId });
    const control = cloneWorld(state);
    const read = readDeathsTogether(state);
    for (const [step, person] of people.entries()) {
        const onDay = state.currentDay + step + 1;
        for (const world of [state, control]) {
            const at = indexById(world.npcs, person.id);
            world.npcs[at] = theWorldEnds(world.npcs[at]!, onDay, 'Their span ran out.')!;
            settleNpcDeath(world, world.npcs[at]!, onDay, world === state ? read : undefined);
        }
        expect(state).toEqual(control);
        if (step === 0) {
            expect(state.objects.find(o => o.id === 'estate-proof')?.possessorId).toBe(second.id);
            expect(howManyTheyCarry(state.objects, first.id, house.id)).toBe(0);
            expect(howManyTwinsTheHallKeeps(state.objects, house.id, first.id)).toBe(0);
        }
    }
});
