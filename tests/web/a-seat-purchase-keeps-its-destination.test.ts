/**
 * Gemma finding 39: buying a seat spent all 30 stones on a whole carriage,
 * then failed to resolve "closest city". A seat must use the actual public
 * tally writer, with a real destination before payment. A vehicle is separate.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { aVehicleOf, isAVehicle } from '../../src/engine/world/a-vehicle.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { carriageIdForRoad } from '../../src/engine/world/public-carriages.js';
import { ordinarySettlementKind } from '../../src/engine/world/the-work-an-ordinary-mortal-does.js';
import { whatRunsFromHere, theLineTo, stonesFor } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { passageTallyTerms } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';

async function counter() {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The exchange ends.'] });
    const h = await makeGameInWorld({ seed: 'reading-seat', worldSeed: 'reading-seat-world', provider });
    const { cultivator } = await h.game.newRun('Passenger');
    const world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!;
    const station = theAreasOf(world, from).areas.find(area => area.for === 'carriage_station')!;
    expect(station).toBeDefined();
    h.repos.cultivators.update(cultivator.id, { location: from.name, standingIn: station.id, spiritStones: 30 });
    h.repos.cultivators.standIn(cultivator.id, station.id);
    const lines = whatRunsFromHere(h.game, h.game.currentRun().cultivator, Math.floor(world.currentDay));
    const line = lines.filter(line => line.service === 'carriage'
        && ordinarySettlementKind(worldLocationFor(world, line.to)!) === 'city')
        .sort((a, b) => a.walkingDays - b.walkingDays)[0]!;
    expect(line).toBeDefined();
    const to = worldLocationFor(world, line.to)!;
    const driver = createNpc(world.seed, { id: 'reading-seat-driver', locationId: from.id,
        onDay: routineTime(world), bornOnDay: routineTime(world) - 30 * 365, occupation: 'carter' });
    driver.activity = { kind: 'idle', note: 'Keeping the actual public carriage.', withIds: [],
        sinceDay: routineTime(world), untilDay: null, standingIn: station.id };
    world.npcs.push(driver);
    const carriage = aVehicleOf({ id: carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal'),
        conveyanceId: 'conv-carriage-mortal', ownerId: driver.id, ownerName: driver.name, at: from.id });
    carriage.tags.push('public-road-service');
    world.objects.push(carriage);
    h.game.theWorldMoved();
    return { ...h, plans, provider, world, from, to, line, lines, cultivator };
}

it('selects the closest city on the actual public route board', async () => {
    const h = await counter();
    try {
        expect(theLineTo(h.lines, 'the closest city', 'carriage', h.world.locations)?.to).toBe(h.to.name);
    } finally { h.db.close(); }
});

it('cannot charge a vehicle purchase for a seat with no real destination', async () => {
    const h = await counter();
    try {
        h.plans.push(JSON.stringify({ action: 'buy', target: 'carriage' }));
        const before = h.game.currentRun().cultivator.spiritStones;
        await h.game.act('I buy a seat on a carriage to a city that is not on any road');
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before);
        expect(h.game.atHand!.objects.some(object => isAVehicle(object) && object.ownerId === h.cultivator.id)).toBe(false);
    } finally { h.db.close(); }
});

it('a misread seat purchase still buys only the next public tally', async () => {
    const h = await counter();
    try {
        h.plans.push(JSON.stringify({ action: 'buy', target: 'carriage' }));
        const reply = await h.game.act('I go find the clerk and buy a seat on a carriage to the closest city');
        const tally = h.game.atHand!.objects.find(object => object.possessorId === h.cultivator.id && passageTallyTerms(object));
        expect(tally, JSON.stringify(reply.toolCalls)).toBeDefined();
        expect(passageTallyTerms(tally!)!.toId).toBe(h.to.id);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(30 - stonesFor(h.line.cashPerSeat));
        expect(h.game.atHand!.objects.some(object => isAVehicle(object) && object.ownerId === h.cultivator.id)).toBe(false);
    } finally { h.db.close(); }
});

it('an explicitly bought vehicle persists and reaches the ownership facts', async () => {
    const h = await counter();
    try {
        h.repos.cultivators.update(h.cultivator.id, { spiritStones: 1000 });
        h.plans.push(JSON.stringify({ action: 'buy', target: 'carriage' }));
        await h.game.act('I buy a carriage of my own');
        const vehicle = h.game.atHand!.objects.find(object => isAVehicle(object) && object.ownerId === h.cultivator.id)!;
        expect(vehicle).toBeDefined();
        expect(new WorldStateRepository(h.db).loadWorld(h.world.id)!.objects.find(object => object.id === vehicle.id)?.ownerId).toBe(h.cultivator.id);
        h.plans.push(JSON.stringify({ action: 'inventory' }));
        await h.game.act('What do I own?');
        const facts = h.provider.calls.at(-1)!.messages.map(message => String(message.content)).join('\n');
        expect(facts).toContain(`With you: ${vehicle.name}`);
    } finally { h.db.close(); }
});
