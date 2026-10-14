/**
 * The public counter previously sold only immediate boarding. A physical seat
 * on a full run needs a later ordinary departure, including the real driver's
 * outward journey and return. These played purchases keep the tally in the
 * pack, leave the buyer free, move the actual fare, and name the leaving time.
 * Missing that departure dusts the item once; choosing boarding hands it to
 * the driver before deletion. The world and run are both pinned.
 * A later played control exposed twenty carried swords boarding by tally;
 * tally boarding now uses the same physical load admission as immediate seats.
 * Buying the token alone still leaves the buyer free to put the goods down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { carriageIdForRoad, publicCarriageRoadTerms, quotePublicCarriage } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { passageTallyTerms } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { publicCarriageDepartures, offerTheNextPublicCarriage } from '../../src/engine/world/the-next-public-carriage-is-an-ordinary-trip';
import { buyPublicCarriageTally } from '../../src/web/public-carriage-tallies-at-the-counter';
import { advanceWorldForPlay } from '../../src/engine/world/driver';
import * as possessions from '../../src/engine/world/possessions';

async function prepared() {
    const h = await makeGameInWorld({ seed: 'held-carriage-departure', worldSeed: 'held-carriage-departure-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!;
    const to = worldLocationFor(world, 'Emerald Water City')!;
    const station = theAreasOf(world, from).areas.find(area => area.for === 'carriage_station')!;
    const day = routineTime(world);
    const driver = createNpc(world.seed, { id: 'advance-carriage-driver', locationId: from.id,
        onDay: day, bornOnDay: day - 30 * 365, occupation: 'carter' });
    driver.spiritStones = 40;
    driver.activity = { kind: 'idle', note: 'Keeping the carriage at the station.',
        withIds: [], sinceDay: day, untilDay: null, standingIn: station.id };
    world.npcs.push(driver);
    const vehicle = aVehicleOf({ id: carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal'),
        conveyanceId: 'conv-carriage-mortal', ownerId: driver.id, ownerName: driver.name, at: from.id });
    vehicle.tags.push('public-road-service');
    world.objects.push(vehicle);
    h.game.repos.cultivators.update(cultivator.id, { location: from.name, standingIn: station.id, spiritStones: 100 });
    h.game.repos.cultivators.standIn(cultivator.id, station.id);
    h.game.theWorldMoved();
    return { ...h, world, from, to, station, cultivator, driver, vehicle };
}

function held(h: Awaited<ReturnType<typeof prepared>>) {
    return h.game.atHand!.objects.filter(object => object.possessorId === h.cultivator.id && passageTallyTerms(object));
}

function firstLoadIsStillItsOwn(h: Awaited<ReturnType<typeof prepared>>, tallies: possessions.ObjectRecord[]) {
    const day = passageTallyTerms(tallies[0]!)!.departureDay;
    const receipt = h.world.history.facts.find(fact => fact.data.publicPassage === true
        && fact.data.vesselId === h.vehicle.id && fact.data.departureDay === day);
    if (!receipt) expect(tallies.every(tally => h.world.objects.some(object => object.id === tally.id))).toBe(true);
    else expect(receipt.actors.filter(actor => actor.role === 'passenger').map(actor => actor.id).sort())
        .toEqual(tallies.map(tally => tally.provenance[0]!.holderId).sort());
    expect(h.world.history.facts.some(fact => fact.data.publicPassage === true
        && fact.actors.some(actor => actor.id === h.cultivator.id && actor.role === 'passenger'))).toBe(false);
}

async function fillFirst(h: Awaited<ReturnType<typeof prepared>>) {
    const seats = publicCarriageRoadTerms(h.world, h.from.id, h.to.id, 'conv-carriage-mortal')!.conveyance.heads - 1;
    const tallies = [];
    for (let i = 0; i < seats; i++) {
        const person = createNpc(h.world.seed, { id: 'waiting-carriage-passenger-' + i, locationId: h.from.id,
            onDay: routineTime(h.world), bornOnDay: routineTime(h.world) - 25 * 365 });
        person.spiritStones = 100;
        person.activity = { kind: 'idle', note: 'At the carriage station.', withIds: [],
            sinceDay: routineTime(h.world), untilDay: null, standingIn: h.station.id };
        h.world.npcs.push(person);
        const bought = buyPublicCarriageTally(h.game, h.from.id, h.to.id, person);
        expect(bought.ok, bought.ok ? '' : bought.reason).toBe(true);
        if (bought.ok) tallies.push(bought.tally);
    }
    return tallies;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('a full carriage offers a later ordinary departure', () => {
    it('buying a tally does not let an oversized carried load board on a passenger seat', async () => {
        const h = await prepared();
        for (let n = 0; n < 20; n++) h.world.objects.push(possessions.makeObject({
            id: `counter-carried-sword-${n}`, name: 'an iron sword', kind: 'artifact',
            power: 1, volume: 3, weight: 1.5, ownerId: h.cultivator.id, possessorId: h.cultivator.id }));
        const bought = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), bought.narration).toHaveLength(1);
        const purse = h.game.currentRun().cultivator.spiritStones;
        const boarding = await h.game.act(`I board the carriage to ${h.to.name}`);
        expect(boarding.toolCalls.some(call => !call.ok), boarding.narration).toBe(true);
        expect(boarding.narration).toMatch(/more than a passenger brings aboard|more bulk|more weight/i);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(purse);
        expect(h.world.history.facts.some(fact => fact.data.publicPassage === true
            && fact.actors.some(actor => actor.id === h.cultivator.id && actor.role === 'passenger'))).toBe(false);
    });

    it('buying holds the paid tally without boarding or waiting for its departure', async () => {
        const h = await prepared();
        const before = routineTime(h.world);
        const turn = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        const tallies = held(h);
        expect(tallies, turn.narration).toHaveLength(1);
        const terms = passageTallyTerms(tallies[0]!)!;
        expect(terms.departureDay).toBeGreaterThan(routineTime(h.world));
        expect(routineTime(h.world) - before).toBeLessThan(terms.departureDay - before);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(100 - terms.fareStones);
        expect(h.world.npcs.find(person => person.id === h.driver.id)!.spiritStones).toBe(40 + terms.fareStones);
        expect(turn.narration).toContain(h.to.name);
        expect(turn.narration).toMatch(/day \d+.*at /);
        expect(h.world.history.facts.some(fact => fact.data.publicPassage === true
            && fact.actors.some(actor => actor.id === h.cultivator.id && actor.role === 'passenger'))).toBe(false);
    });

    it('a sold-out run sells the next load after the same carriage has really returned', async () => {
        const h = await prepared();
        const first = await fillFirst(h);
        const firstTerms = passageTallyTerms(first[0]!)!;
        expect(new Set(first.map(tally => passageTallyTerms(tally)!.departureDay)).size).toBe(1);
        const offered = offerTheNextPublicCarriage(h.world, h.from.id, h.to.id, h.cultivator.id);
        expect(offered?.fullDepartureDay).toBe(firstTerms.departureDay);
        const turn = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), turn.narration).toHaveLength(1);
        const next = passageTallyTerms(held(h)[0]!)!;
        const road = publicCarriageRoadTerms(h.world, h.from.id, h.to.id, 'conv-carriage-mortal')!;
        expect(next.departureDay - firstTerms.departureDay).toBeGreaterThanOrEqual(2 * road.days);
        expect(next.vesselId).toBe(firstTerms.vesselId);
        expect(turn.narration, JSON.stringify({ offered: offered?.fullDepartureDay, next, now: routineTime(h.world) })
            + '\n' + turn.narration).toContain('has no passenger seat');
        expect(turn.narration).toContain(h.to.name);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const jobs = publicCarriageDepartures(h.world, next.vesselId);
        expect(jobs.map(job => [job.terms.fromId, job.terms.toId]))
            .toEqual([[h.from.id, h.to.id], [h.to.id, h.from.id], [h.from.id, h.to.id]]);
        expect(new Set(jobs.map(job => job.operatorId))).toEqual(new Set([h.driver.id]));
    });

    it('an unaffordable later departure leaves the purse, pack and accepted jobs unchanged', async () => {
        const h = await prepared();
        await fillFirst(h);
        h.game.repos.cultivators.update(h.cultivator.id, { spiritStones: 0 });
        const jobs = h.world.schedule.map(effect => effect.id);
        const turn = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), turn.narration).toHaveLength(0);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(0);
        expect(h.world.schedule.map(effect => effect.id)).toEqual(jobs);
        expect(turn.narration).toContain('costs');
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
    });

    it('asking to take a full carriage buys its next run without displacing the first load', async () => {
        const h = await prepared();
        const first = await fillFirst(h);
        const turn = await h.game.act(`I take the carriage to ${h.to.name}`);
        expect(held(h), turn.narration).toHaveLength(1);
        expect(passageTallyTerms(held(h)[0]!)!.departureDay).toBeGreaterThan(passageTallyTerms(first[0]!)!.departureDay);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        firstLoadIsStillItsOwn(h, first);
    });

    it('handing in a later tally cannot overwrite the first accepted run', async () => {
        const h = await prepared();
        const first = await fillFirst(h);
        await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        const later = held(h)[0]!;
        const terms = passageTallyTerms(later)!;
        const appointment = publicCarriageDepartures(h.world, h.vehicle.id).find(job => job.terms.departureDay === terms.departureDay)!;
        const speculative = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: terms.departureDay, conveyanceId: 'conv-carriage-mortal', fareStones: 0, hired: false,
            passengerIds: [h.cultivator.id], publicDepartureId: appointment.effect.id,
            tallyDepartureDay: terms.departureDay,
            playedPassenger: { id: h.cultivator.id, locationId: h.from.id, alive: true } });
        expect(speculative).toBeNull();
        const transfer = vi.spyOn(possessions, 'transferPossession');
        const turn = await h.game.act(`I board the carriage to ${h.to.name}`);
        expect(transfer.mock.calls.some(call => call[0].id === later.id), turn.narration).toBe(false);
        expect(held(h).map(object => object.id)).toEqual([later.id]);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        firstLoadIsStillItsOwn(h, first);
    });

    it.each(['what carriages run from here', 'I read the carriage board'])(
        'the board names the full run before purchase: %s', async words => {
        const h = await prepared();
        await fillFirst(h);
        const before = h.world.objects.filter(object => passageTallyTerms(object)).map(object => object.id);
        const jobs = h.world.schedule.map(effect => effect.id);
        const turn = await h.game.act(words);
        expect(turn.narration).toContain('has no passenger seat');
        expect(turn.narration).toMatch(/next.*day \d+.*at /i);
        expect(h.world.objects.filter(object => passageTallyTerms(object)).map(object => object.id)).toEqual(before);
        expect(h.world.schedule.map(effect => effect.id)).toEqual(jobs);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(100);
    });

    it('choosing boarding transfers the held tally to the actual driver, then deletes it', async () => {
        const h = await prepared();
        const bought = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), bought.narration).toHaveLength(1);
        const tally = held(h)[0]!;
        const carrierPurse = h.world.npcs.find(person => person.id === h.driver.id)!.spiritStones;
        const transfer = vi.spyOn(possessions, 'transferPossession');
        const turn = await h.game.act(`I board the carriage to ${h.to.name}`);
        const handover = transfer.mock.calls.findIndex(call => call[0].id === tally.id);
        expect(handover, turn.narration).toBeGreaterThanOrEqual(0);
        expect(transfer.mock.calls[handover]![0].possessorId).toBe(h.cultivator.id);
        expect(transfer.mock.results[handover]!.value.possessorId).toBe(h.driver.id);
        expect(held(h)).toHaveLength(0);
        expect(h.game.atHand!.objects.some(object => object.id === tally.id)).toBe(false);
        expect(h.db.prepare('SELECT id FROM world_objects WHERE id = ?').get(tally.id)).toBeUndefined();
        // Ordinary arrival can charge the city's register fee. It is a real
        // separate cost; the held seat must not pay its carrier another fare.
        expect(h.world.npcs.find(person => person.id === h.driver.id)!.spiritStones).toBe(carrierPurse);
        const receipt = h.world.history.facts.find(fact => fact.data.publicPassage === true
            && fact.actors.some(actor => actor.id === h.cultivator.id && actor.role === 'passenger'))!;
        expect(receipt, turn.narration).toBeDefined();
        expect(receipt.data.fareStones).toBe(0);
    });

    it('letting an unboarded departure leave removes its tally and reports dust once', async () => {
        const h = await prepared();
        const bought = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), bought.narration).toHaveLength(1);
        const tally = held(h)[0]!;
        const departure = passageTallyTerms(tally)!.departureDay;
        advanceWorldForPlay(h.world, { days: departure - h.world.currentDay + 0.1, preciseDays: true, stopOnInterrupt: false });
        h.game.theWorldMoved();
        const first = await h.game.act('I check my inventory');
        const line = tally.name + ' is now useless and has gone to dust.';
        expect(first.narration).toContain(line);
        expect(held(h)).toHaveLength(0);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const second = await h.game.act('I check my inventory');
        expect(second.narration).not.toContain(line);
        expect(h.db.prepare('SELECT id FROM world_objects WHERE id = ?').get(tally.id)).toBeUndefined();
    });

    it('the next load boards after the actual outward trip and empty return', async () => {
        const h = await prepared();
        const first = await fillFirst(h);
        const purchase = await h.game.act(`I buy a carriage ticket to ${h.to.name}`);
        expect(held(h), purchase.narration).toHaveLength(1);
        const tally = held(h)[0]!, terms = passageTallyTerms(tally)!;
        advanceWorldForPlay(h.world, { days: terms.departureDay - 0.1 - h.world.currentDay,
            preciseDays: true, stopOnInterrupt: false });
        h.game.theWorldMoved();
        const legs = h.world.history.facts.filter(fact => fact.data.publicPassage === true
            && fact.data.vesselId === h.vehicle.id);
        expect(legs).toHaveLength(2);
        expect(legs.map(fact => [fact.data.fromLocationId, fact.data.toLocationId]))
            .toEqual([[h.from.id, h.to.id], [h.to.id, h.from.id]]);
        expect(legs[0]!.actors.filter(actor => actor.role === 'passenger')).toHaveLength(first.length);
        expect(legs[1]!.actors.filter(actor => actor.role === 'passenger')).toHaveLength(0);
        expect(h.world.schedule.filter(effect => effect.data.publicCarrierDeparture === true)).toHaveLength(1);
        expect(held(h).map(object => object.id)).toEqual([tally.id]);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const transfer = vi.spyOn(possessions, 'transferPossession');
        const boarded = await h.game.act(`I board the carriage to ${h.to.name}`);
        expect(transfer.mock.calls.some(call => call[0].id === tally.id), boarded.narration).toBe(true);
        expect(held(h)).toHaveLength(0);
        const next = h.world.history.facts.find(fact => fact.data.publicPassage === true
            && fact.data.vesselId === h.vehicle.id && fact.actors.some(actor => actor.id === h.cultivator.id))!;
        expect(next, boarded.narration).toBeDefined();
        expect(next.data.driverId).toBe(h.driver.id);
        expect(next.data.departureDay).toBe(terms.departureDay);
    });
});
