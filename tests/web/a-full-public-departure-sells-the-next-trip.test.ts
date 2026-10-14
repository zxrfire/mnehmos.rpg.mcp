/**
 * A full public departure sells the next ordinary trip, rather than refusing
 * or filling an occupied seat. Buying leaves the player at the real counter,
 * free to spend the wait. The counter transaction has the ordinary short-act
 * cost; it does not spend the wait. The second load uses the same driver and carriage
 * after their outward and return work, not an invented replacement vehicle.
 * This pinned played fixture fills the three seats through the actual counter.
 */
import { expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { carriageIdForRoad } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { buyPublicCarriageTally } from '../../src/web/public-carriage-tallies-at-the-counter';
import { passageTallyTerms } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { publicCarriageDepartures } from '../../src/engine/world/the-next-public-carriage-is-an-ordinary-trip';

async function atCounter() {
    const h = await makeGameInWorld({ seed: 'full-carriage-counter', worldSeed: 'full-carriage-counter-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!;
    const to = worldLocationFor(world, 'Emerald Water City')!;
    const day = routineTime(world);
    const driver = createNpc(world.seed, { id: 'full-counter-driver', locationId: from.id,
        onDay: day, bornOnDay: day - 30 * 365, occupation: 'carter' });
    driver.spiritStones = 40;
    world.npcs.push(driver);
    const vehicle = aVehicleOf({ id: carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal'),
        conveyanceId: 'conv-carriage-mortal', ownerId: driver.id, ownerName: driver.name, at: from.id });
    vehicle.tags.push('public-road-service'); world.objects.push(vehicle);
    const station = theAreasOf(world, from).areas.find(area => area.for === 'carriage_station')!;
    driver.activity = { kind: 'idle', note: 'Keeping the public carriage at the station.',
        withIds: [], sinceDay: day, untilDay: null, standingIn: station.id };
    h.game.repos.cultivators.update(cultivator.id, { location: from.name, spiritStones: 100 });
    h.game.repos.cultivators.standIn(cultivator.id, station.id);
    expect(h.game.currentRun().cultivator.standingIn).toBe(station.id);
    h.game.theWorldMoved();
    await h.game.act('I look around');
    return { h, world, from, to, day, driver, vehicle, station, cultivator };
}

function fillFirstLoad(fixture: Awaited<ReturnType<typeof atCounter>>) {
    const { h, world, from, to, day, driver, station } = fixture;
    const sold = [];
    for (let seat = 0; seat < 3; seat++) {
        const buyer = createNpc(world.seed, { id: 'full-counter-passenger-' + seat, locationId: from.id,
            onDay: day, bornOnDay: day - 25 * 365 });
        buyer.spiritStones = 100;
        buyer.activity = { kind: 'idle', note: 'At the carriage counter.', withIds: [],
            sinceDay: day, untilDay: null, standingIn: station.id };
        world.npcs.push(buyer);
        const purchase = buyPublicCarriageTally(h.game, from.id, to.id, buyer, buyer, driver.id);
        expect(purchase.ok).toBe(true);
        if (!purchase.ok) throw new Error(purchase.reason);
        sold.push(passageTallyTerms(purchase.tally)!);
    }
    return sold;
}

it('buys the next dated seat while the player keeps their actual waiting time', async () => {
    const { h, world, from, to, day, driver, vehicle, station, cultivator } = await atCounter();
    const sold = fillFirstLoad({ h, world, from, to, day, driver, vehicle, station, cultivator });
    expect(new Set(sold.map(t => t.departureDay)).size).toBe(1);
    const first = publicCarriageDepartures(world, vehicle.id)[0]!;
    h.game.theWorldMoved();
    const before = h.game.currentRun().run.elapsedDays;
    const purse = h.game.currentRun().cultivator.spiritStones;
    const worldBefore = routineTime(h.game.atHand!);
    const turn = await h.game.act(`I buy a passage tally to ${to.name}`);
    const current = h.game.atHand!;
    const tally = current.objects.find(o => o.possessorId === cultivator.id && passageTallyTerms(o));
    expect(tally, turn.narration).toBeTruthy();
    const terms = passageTallyTerms(tally!)!;
    expect(terms.departureDay).toBeGreaterThan(first.arrivalDay);
    expect(terms.vesselId).toBe(vehicle.id);
    expect(turn.narration, JSON.stringify({ narration: turn.narration, terms, first: first.terms, jobs: publicCarriageDepartures(current, vehicle.id).map(job => job.terms) })).toContain('has no passenger seat');
    expect(turn.narration).toContain('departure day');
    expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(LESSER_ACTION_DAYS.passage);
    expect(routineTime(current) - worldBefore).toBeCloseTo(LESSER_ACTION_DAYS.passage);
    expect(terms.departureDay).toBeGreaterThan(routineTime(current));
    expect(h.game.currentRun().cultivator.location).toBe(from.name);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(purse - terms.fareStones);
    const jobs = publicCarriageDepartures(current, vehicle.id);
    expect(jobs.every(job => job.operatorId === driver.id)).toBe(true);
    const back = jobs.find(job => job.terms.fromId === to.id && job.terms.toId === from.id)!;
    expect(back.terms.departureDay).toBeGreaterThanOrEqual(first.arrivalDay);
    expect(terms.departureDay).toBeGreaterThanOrEqual(back.arrivalDay);
});

it('can still choose to board the first departure after buying its tally', async () => {
    const { h, from, to, cultivator } = await atCounter();
    const bought = await h.game.act(`I buy a passage tally to ${to.name}`);
    const tally = h.game.atHand!.objects.find(o => o.possessorId === cultivator.id && passageTallyTerms(o));
    expect(tally, bought.narration).toBeTruthy();
    expect(h.game.currentRun().cultivator.location).toBe(from.name);
    const boarded = await h.game.act(`I board the carriage to ${to.name}`);
    expect(h.game.atHand!.objects.some(o => o.id === tally!.id), boarded.narration).toBe(false);
    expect(boarded.narration).not.toContain('do not hold a passage tally');
    expect(h.game.currentRun().cultivator.location).not.toBe(from.name);
});

it('hands a held passage tally to a real person through ordinary giving', async () => {
    const fixture = await atCounter();
    const { h, to, cultivator } = fixture;
    fillFirstLoad(fixture);
    await h.game.act(`I buy a passage tally to ${to.name}`);
    const world = h.game.atHand!;
    const tally = world.objects.find(o => o.possessorId === cultivator.id && passageTallyTerms(o))!;
    expect(tally).toBeTruthy();
    const reached = h.game.present(h.game.currentRun().cultivator)[0]!;
    const person = world.npcs.find(row => row.id === reached?.id)!;
    expect(person, 'Nobody real is at this counter.').toBeTruthy();
    const phrase = `I give my passage tally to ${person.name}`;
    expect(parseIntent(phrase)).toMatchObject({ action: 'give', target: person.name, topic: 'my passage tally' });
    const turn = await h.game.act(phrase);
    const handed = h.game.atHand!.objects.find(o => o.id === tally.id)!;
    expect(handed?.possessorId, turn.narration).toBe(person.id);
    expect(handed.ownerId).toBe(person.id);
    expect(handed.provenance.at(-1)?.how).toBe('gifted');
    expect(passageTallyTerms(handed)).toEqual(passageTallyTerms(tally));
});
