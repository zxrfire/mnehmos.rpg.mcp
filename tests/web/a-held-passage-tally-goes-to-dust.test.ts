/**
 * An unused passage tally physically crumbles at its actual departure. The
 * player carrying it learns this once on their next turn, with the route
 * named. World people's unused tallies disappear without a player notice.
 * These played observations start with a prepared purchased/gifted tally;
 * the still-unbuilt public buy, full-next-departure and resale interactions
 * are not claimed by these item-lifecycle controls.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { transferPossession } from '../../src/engine/world/possessions';
import { routineTime } from '../../src/engine/world/npc-routines';
import { makePassageTally } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { carriageIdForRoad, quotePublicCarriage, commitPublicCarriage }
    from '../../src/engine/world/public-carriages';

async function prepared(playerHolds: boolean) {
    const h = await makeGameInWorld({ seed: playerHolds ? 'carried-tally-dust' : 'world-tally-dust',
        worldSeed: 'physical-passage-tally-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!;
    const from = makeLocation({ id: 'tally-departure', name: 'Reed Station', kind: 'settlement' });
    const to = makeLocation({ id: 'tally-arrival', name: 'Stone Station', kind: 'settlement' });
    linkLocations(from, to, 'road', 2);
    world.locations.push(from, to);
    const day = routineTime(world);
    const owner = createNpc(world.seed, { id: 'tally-owner', locationId: from.id,
        bornOnDay: world.currentDay - 30 * 365, onDay: day });
    const passenger = createNpc(world.seed, { id: 'tally-passenger', locationId: from.id,
        bornOnDay: world.currentDay - 30 * 365, onDay: day });
    world.npcs.push(owner, passenger);
    const terms = { service: 'carriage' as const, fromId: from.id, toId: to.id, departureDay: day,
        vesselId: carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal'), seat: 1, fareStones: 3 };
    const purchase = appendWorldFact(world, makeFact({ day, kind: 'gathering',
        summary: 'An accepted passage seat was bought.',
        actors: [{ id: owner.id, name: owner.name, role: 'buyer' }],
        data: { passageTallyPurchase: true, service: 'carriage', vesselId: terms.vesselId,
            fromLocationId: from.id, toLocationId: to.id, departureDay: day, seat: 1, fareStones: 3 } }),
        { bystanders: false, recur: false });
    const bought = makePassageTally({ terms, buyer: owner, fromName: from.name, toName: to.name,
        onDay: day, purchase });
    const tally = playerHolds ? transferPossession(bought, { onDay: day, toHolderId: cultivator.id,
        toHolderName: cultivator.name, how: 'gifted', transfersOwnership: true }) : bought;
    world.objects.push(tally);
    expect(tally.possessorId).toBe(playerHolds ? cultivator.id : owner.id);
    h.game.theWorldMoved();
    expect(h.db.prepare('SELECT id FROM world_objects WHERE world_id = ? AND id = ?')
        .get(world.id, tally.id)).toBeDefined();
    const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day,
        conveyanceId: 'conv-carriage-mortal', passengerIds: [passenger.id], fareStones: 3, hired: false });
    expect(quote).not.toBeNull();
    expect(commitPublicCarriage(world, quote!)).not.toBeNull();
    h.game.theWorldMoved();
    return { ...h, cultivator, tally };
}

describe('the next turn reports an unused carried passage tally', () => {
    it('names its route once and removes the actual item from the pack', async () => {
        const h = await prepared(true);
        const line = h.tally.name + ' is now useless and has gone to dust.';
        const first = await h.game.act('I check my inventory');
        expect(first.narration).toContain(line);
        expect(first.narration.split(line)).toHaveLength(2);
        expect(h.game.atHand!.objects.some(object => object.id === h.tally.id)).toBe(false);
        expect(h.db.prepare('SELECT id FROM world_objects WHERE world_id = ? AND id = ?')
            .get(h.game.atHand!.id, h.tally.id)).toBeUndefined();
        const next = await h.game.act('I check my inventory');
        expect(next.narration).not.toContain(line);
    });

    it("does not narrate a world person's private unused tally to the player", async () => {
        const h = await prepared(false);
        const line = h.tally.name + ' is now useless and has gone to dust.';
        const turn = await h.game.act('I check my inventory');
        expect(turn.narration).not.toContain(line);
        expect(h.game.atHand!.objects.some(object => object.id === h.tally.id)).toBe(false);
    });
});
