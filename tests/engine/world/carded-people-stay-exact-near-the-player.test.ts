/**
 * The background shortcut used the whole settlement, while a card names only
 * the people in the player's area. The temporary yearly context must read that
 * same placement, including a party member, and disappear when the player moves.
 * No person's row stores a foreground flag.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { isPlayerInvolved, resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { makeObject } from '../../../src/engine/world/possessions.js';

it('derives exact people from the card area and party, then returns them to rates', () => {
    const world = createWorld({ seed: 'card-area', skipPriorAges: true, regionCount: 0 });
    const place = makeLocation({ id: 'town', name: 'Town', kind: 'settlement' });
    world.locations.push(place);
    for (let index = 0; index < 8; index++) world.npcs.push(createNpc(world.seed, {
        id: `person-${index}`, name: `Person ${index}`, locationId: place.id,
        bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay
    }));
    const player = createNpc(world.seed, { id: 'player', name: 'Player', locationId: place.id,
        onDay: world.currentDay, bornOnDay: world.currentDay - 18 * 365, tags: [PLAYER_ROW_TAG] });
    world.npcs.push(player);
    const read = theAreasOf(world, place);
    const areaId = read.whereIs.get(world.npcs[0]!.id)!;
    const near = world.npcs.filter(person => read.whereIs.get(person.id) === areaId);
    const far = world.npcs.find(person => person.locationId === place.id && read.whereIs.get(person.id) !== areaId)!;
    expect(near.length).toBeGreaterThan(0);
    expect(far).toBeDefined();
    resolveWithPlayerPresent(world, { placeId: place.id, areaId }, () => {
        for (const person of near) expect(isPlayerInvolved(world, person)).toBe(true);
        expect(isPlayerInvolved(world, far)).toBe(false);
    });
    resolveWithPlayerPresent(world, { placeId: place.id, areaId: 'somewhere-else' }, () => {
        for (const person of near) expect(isPlayerInvolved(world, person)).toBe(false);
    });
    player.activity = { kind: 'talking', withIds: [far.id], note: 'Speaking together.',
        sinceDay: world.currentDay, untilDay: world.currentDay + 1, returnTo: null };
    expect(isPlayerInvolved(world, far)).toBe(true);
    player.activity.untilDay = world.currentDay - 1;
    resolveWithPlayerPresent(world, { placeId: place.id, areaId }, () => {
        expect(isPlayerInvolved(world, far)).toBe(false);
    });
    player.activity = null;
    const remote = createNpc(world.seed, { id: 'remote', name: 'Remote', locationId: null,
        onDay: world.currentDay, bornOnDay: world.currentDay - 30 * 365 });
    world.npcs.push(remote);
    world.objects.push(makeObject({ id: 'projection', name: 'Projection', kind: 'other', ownerId: remote.id,
        locationId: place.id, tags: ['acting-proxy'], data: { kind: 'soul', standingIn: areaId,
            madeOnDay: world.currentDay, lapsesOnDay: world.currentDay + 10 } }));
    resolveWithPlayerPresent(world, { placeId: place.id, areaId, person: player }, () => {
        expect(isPlayerInvolved(world, remote)).toBe(true);
    });
    resolveWithPlayerPresent(world, { placeId: place.id, areaId: 'somewhere-else', person: player }, () => {
        expect(isPlayerInvolved(world, remote)).toBe(false);
    });
    player.locationId = null;
    expect(isPlayerInvolved(world, far)).toBe(false);
});
