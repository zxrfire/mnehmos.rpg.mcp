/**
 * Oct6 observed guided02 run: six legacy failures (87.21s/16 tests): precise
 * departure did not equal floor(calendar), native supplied food ended at96,
 * old fixed-guard captions no longer described actual named crew, and a
 * manually doubled160-day clock advertised a closed seasonal lane. Repairs
 * preserve real clocks, native hunger, actual fight/crew/cap and source stocks.
 * Human band deterrence is NOT proved by the observed wolf fight; that native
 * actor scenario remains an explicit coverage gap. No outcome/seed sweep.
 *
 * Oct7 diagnostic17 preserved both failing assertions and recorded actual facts:
 * spring boarding kept its full22-day quote but stopped after6 at a real corpse
 * encounter, with16 days left on the same live hull. The wolf fight was the
 * departure occasion: zero time/distance spent, actual city/hull/driver there.
 * Neither stop licenses an invented arrival or a road waypoint not reached.
 * The season control now checks actual interruption versus actual landfall;
 * the pack control checks departure ground, paid fare and no invented span.
 *
 * Ships from a landing and carriages from a station: read the board, buy a seat or
 * hire the whole carriage, and ride under a roof with meals on board.
 *
 * The owner: "you are able to get on boats (you buy a ticket)", "have ticket booth
 * npc's for boats and carriages", and "they deal with bandits, bandits see and they
 * scurry off", against "you go alone, you risk it". Then: water is a ship ("spirit
 * skiff = genre flying boat"), a seat carries only what a passenger carries on their
 * person and a hired carriage carries the rest, and a band big enough to take the
 * escort on attacks, and is fought as a group with at most three in the foreground.
 *
 * Played on `road-world`. A new run opens at The Furnace Flank, three days on foot
 * down the arms road from Emerald Water City, whose river mouth is a lane to Sweet
 * Spring Island. Historical seeds for a band were pinned: `booth-0` meets one that
 * withdraws from a ship, and `hire-37` one of five that attacks a hired carriage on
 * the first day to Moraine Gate (found by sweeping sixty seeds, of which four attacked).
 *
 * A run now opens at 08:00, a third of a day already on the run clock
 * (`turn-engine.ts`'s `newRun`), so a fresh run's `elapsedDays` is `1/3`, not `0`,
 * and a two-day ride lands on `2 + 1/3`. People are also placed by the hour and
 * sparsely (`npc-routines.ts`): at most one body in this seed's starting area, and
 * the inn is dealt a keeper before the carriage station is (`who-keeps-a-counter-here.ts`),
 * so a test that wants the station's own keeper has to put a second person there itself.
 * Road fights now hold the passenger on the actual intermediate ground already
 * reached, rather than leaving their body at the departure town until arrival.
 */

import { describe, expect, it } from 'vitest';

import { makeObject } from '../../src/engine/world/possessions';
import { makeCultivator } from '../engine/cultivation/fixtures';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { advanceWorldForPlay } from '../../src/engine/world/driver';
import { activeWorld, writeTheWorldNow } from '../../src/server/state/cultivation-world';
import { whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping';
import { shipIdForLane } from '../../src/engine/world/the-ship-on-a-lane';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { stonesFor } from '../../src/engine/world/the-fare-and-calendar-of-a-passage';
import { journeyTimeHasReached, isWater } from '../../src/engine/world/places-on-the-way';
import { groundOfTheAcceptedCarriage } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { makeGame } from './harness';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world';
import { quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel';
import { writeTheVoyage, recordedVoyage, takeFromTheHull, theRationsAboard } from '../../src/web/a-ship-at-sea';
import { passHours } from '../../src/web/routine-invitations';

const WORLD = 'road-world';

describe('a seat on a ship or a carriage', () => {
    it('keeps the landing season when a new life starts between year boundaries', async () => {
        // Run day zero used to advertise winter departures even when the shared
        // world was in spring; actual hull booking then correctly refused them.
        const { game, db, repos } = await makeGameInWorld({ seed: 'new-life-season', worldSeed: WORLD });
        const world = (await activeWorld()).state;
        advanceWorldForPlay(world, { days: 100, stopOnInterrupt: false });
        writeTheWorldNow(world);
        await game.newRun('Rider');
        const id = game.state().cultivator.id;
        db.prepare("UPDATE cultivators SET location = 'Sweet Spring Island', spirit_stones = 500 WHERE id = ?").run(id);
        repos.cultivators.standIn(id, null);
        expect(Math.floor(game.state().run.elapsedDays)).toBe(0);
        const lines = whatRunsFromHere(game, game.state().cultivator, 0);
        const expected = publicShipLinesFrom(game.atHand, 'Sweet Spring Island', Math.floor(world.currentDay));
        const spring = expected.find(line => line.to === 'Cloud Gate')!;
        expect(spring.runsFromDay).toBeNull();
        expect(publicShipLinesFrom(game.atHand, 'Sweet Spring Island', 0)
            .find(line => line.to === spring.to)!.runsFromDay).not.toBeNull();
        expect(lines.find(line => line.to === spring.to)!.runsFromDay).toBeNull();
        const before = game.state();
        const readyDay = routineTime(game.atHand!);
        const from = worldLocationFor(game.atHand!, before.cultivator.location)!;
        const to = worldLocationFor(game.atHand!, spring.to)!;
        const vesselId = shipIdForLane(spring.lane);
        const springQuote = quotePublicPassage(game.atHand!, from.id, to.id, readyDay,
            1, [], `${game.currentRun().run.seed}:${Math.floor(before.run.elapsedDays)}`);
        expect(springQuote).not.toBeNull();
        const boarded = await game.act(`I take the ship to ${spring.to}`);
        expect(boarded.narration).not.toMatch(/not worked this month|no available passage/);
        const after = game.state();
        // A completed passage restores the crew's ordinary work at landfall.
        // Its immutable receipt, rather than an obsolete travelling activity,
        // proves the accepted spring hull/course; its actual read proves progress.
        const passage = game.atHand!.history.facts.find(fact => fact.data.publicPassage === true
            && fact.data.vesselId === vesselId && fact.data.seaLaneId === spring.lane.id
            && fact.data.fromLocationId === from.id && fact.data.toLocationId === to.id);
        expect(passage).toBeDefined();
        const arrivedOn = Number(passage!.data.arrivalDay);
        const departedOn = Number(passage!.data.departureDay);
        expect(journeyTimeHasReached(departedOn, readyDay)).toBe(true);
        expect(arrivedOn).toBeGreaterThan(departedOn);
        expect(arrivedOn - departedOn).toBe(springQuote!.days); // Canonical full quote, not the measured22-day choice.
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones - stonesFor(spring.cashPerSeat));
        const now = routineTime(game.atHand!);
        const actual = shipPassengerAt(game.atHand!, passage!.id, now)!;
        expect(actual).not.toBeNull(); expect(actual.unavailable).toBeNull();
        expect(actual.crew.length).toBeGreaterThan(0);
        expect(worldLocationFor(game.atHand!, after.cultivator.location)?.id).toBe(actual.locationId);
        expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(now - readyDay, 8);
        if (actual.arrived) {
            expect(after.cultivator.location).toBe(spring.to);
            expect(actual.remainingDays).toBe(0);
            expect(journeyTimeHasReached(now, arrivedOn)).toBe(true);
            expect(game.atHand!.npcs.some(npc => npc.status === 'alive'
                && npc.identity.occupation === 'shipmaster' && npc.tags.includes(`crew-of:${vesselId}`)
                && npc.locationId === to.id)).toBe(true);
        } else {
            // A real interrupted receipt must explain the shorter lived span.
            const interruption = boarded.toolCalls.find(call => call.ok
                && call.name === 'engine.simulateTimeSkip' && /interrupted: \S/.test(call.summary));
            expect(interruption, JSON.stringify(boarded.toolCalls)).toBeDefined();
            expect(journeyTimeHasReached(now, arrivedOn)).toBe(false);
            expect(actual.remainingDays).toBeGreaterThan(0);
            expect(actual.remainingDays).toBeCloseTo(arrivedOn - now, 8);
            expect(isWater(worldLocationFor(game.atHand!, after.cultivator.location)!)).toBe(true);
            expect(recordedVoyage(db, after.cultivator.id)?.receiptId).toBe(passage!.id);
            expect(actual.crew.every(npc => npc.status === 'alive'
                && npc.activity?.vesselId === vesselId && npc.activity.sinceDay === departedOn
                && npc.activity.untilDay === arrivedOn)).toBe(true);
        }
    }, 120_000);

    it('reads the carriage station at the town, with who keeps it', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Rider');
        // The inn is dealt a keeper before the carriage station, and this seed's
        // starting area holds one body - claimed by the inn. A second body, stood in
        // the same place, is free to be the station's. `standingIn` lives in a flag
        // row `create` never touches, so it is set the same way a move sets it.
        repos.cultivators.create(makeCultivator({
            id: 'station-clerk-under-test', kind: 'npc', name: 'Second Body',
            location: cultivator.location
        }));
        repos.cultivators.standIn('station-clerk-under-test', cultivator.standingIn ?? null);

        const done = await game.act('what carriages are there');

        expect(done.narration).toMatch(/keeps the carriage station/);
        expect(done.narration).toMatch(/Emerald Water City by carriage: 2 days \(3 on foot\), \d+ cash a seat/);
        expect(game.state().run.elapsedDays).toBeCloseTo(1 / 3);
    }, 120_000);

    it.each(['I book a carriage to Emerald Water City', 'I take a carriage to Emerald Water City'])(
        'rides a paid seat under a roof, fed on board: "%s"', async said => {
            const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
            await game.newRun('Rider');
            // A hungry passenger with no carried ration proves actual supplied food.
            game.repos.cultivators.update(game.state().cultivator.id, { satiety: 1 });
            const before = game.state().cultivator;
            expect(game.rationsHeld(before)).toBe(0);

            const done = await game.act(said);
            const after = game.state().cultivator;

            expect(after.location).toBe('Emerald Water City');
            expect(game.state().run.elapsedDays).toBeCloseTo(2 + 1 / 3);
            expect(after.spiritStones).toBeLessThan(before.spiritStones);
            expect(after.hp).toBe(before.hp);
            expect(after.satiety).toBeGreaterThan(before.satiety);
            expect(game.rationsHeld(game.currentRun().cultivator)).toBe(0);
            expect(game.currentRun().cultivator.starvationTurns).toBe(0);
            expect(done.toolCalls.filter(call => !call.name.startsWith('narrator.') && !call.ok), JSON.stringify(done.toolCalls)).toEqual([]);
            expect(game.atHand!.history.facts.some(fact => fact.data.publicPassage === true
                && fact.data.service === 'carriage' && fact.actors.some(actor => actor.id === after.id))).toBe(true);
            expect(done.narration).not.toMatch(/in the open (?:has|have) worn the body/);
        }, 120_000);

    it('sails the lane from the river mouth while an actual hostile group withdraws', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'booth-0', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 500 WHERE id = ?")
            .run(game.state().cultivator.id);

        const board = await game.act('what ships are there');
        expect(board.narration).toMatch(/Sweet Spring Island by ship: 9 days/);

        const done = await game.act('I take the ship to Sweet Spring Island');

        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        expect(done.narration).toContain('A band withdrew from the actual carrier.');
        expect(game.state().fight).toBeNull();
        expect(done.narration).not.toMatch(/attacks you/);
    }, 120_000);

    it('retains an actual ordinary pack attack and real carrier crew without fabricating fixed guards', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'hire-37', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 5000, realm_ordinal = 1 WHERE id = ?")
            .run(game.state().cultivator.id);

        const before = game.currentRun(), readyDay = routineTime(game.atHand!);
        const done = await game.act('I hire a carriage to Moraine Gate');

        // The observed current encounter is a wolf pack, not proof of human bandits.
        expect(done.narration).toMatch(/spirit wolves.*hunting as a pack/);
        const passage = game.atHand!.history.facts.find(fact => fact.data.publicPassage === true
            && fact.data.service === 'carriage' && fact.actors.some(actor => actor.id === game.state().cultivator.id));
        expect(passage).toBeDefined();
        expect(typeof passage!.data.driverId).toBe('string');
        expect(game.present(game.currentRun().cultivator).length).toBeLessThanOrEqual(3);
        expect(done.narration).toMatch(/attacks you\. The fight is open/);
        const battleGround = game.atHand!.locations.find(place =>
            place.name === game.state().cultivator.location);
        expect(battleGround?.id).toBe(passage!.data.fromLocationId);
        expect(groundOfTheAcceptedCarriage(game.atHand!, passage!.id, before.cultivator.id,
            routineTime(game.atHand!))).toBe(battleGround?.id);
        expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(journeyTimeHasReached(routineTime(game.atHand!), readyDay)).toBe(true);
        expect(journeyTimeHasReached(readyDay, routineTime(game.atHand!))).toBe(true);
        expect(game.currentRun().run.turn).toBe(before.run.turn + 1);
        expect(game.currentRun().cultivator.hp).toBe(before.cultivator.hp);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones
            - Number(passage!.data.fareStones));
        expect(done.toolCalls.some(call => call.ok && call.name === 'engine.encounterWindow'
            && call.summary.includes('Interrupted at actual departure; no travel time was spent.'))).toBe(true);
        expect(game.state().fight).not.toBeNull();
    }, 120_000);

    it('refuses a seat to more than a passenger carries, and a hired carriage takes it', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Rider');
        for (let n = 0; n < 20; n++) {
            game.atHand!.objects.push(makeObject({ id: `sword-${n}`, name: 'an iron sword', kind: 'artifact',
                power: 1, volume: 3, weight: 1.5, possessorId: cultivator.id, ownerId: cultivator.id }));
        }

        const seat = await game.act('I book a carriage to Emerald Water City');
        expect(seat.narration).toMatch(/A seat carries you and what you can carry on your own person/);
        expect(seat.narration).toMatch(/Hired whole, a drawn carriage carries the rest: \d+ stones/);
        expect(game.state().cultivator.location).toBe('The Furnace Flank');

        await game.act('I hire a carriage to Emerald Water City');
        expect(game.state().cultivator.location).toBe('Emerald Water City');
    }, 120_000);

    it('uses actual hull food before opening the passenger pack on an unchanged full passage', async () => {
        // Operator provisioning arrangement: accepted real lane, paid actual fare,
        // canonical crew/history; takeFromTheHull consumes the existing supply.
        // This replaces the SQL160 + world160 double clock and seed64/day46 story.
        const { game, db } = makeGame({ seed: 'precise-sea-replies', worldEnabled: true });
        await createWorld({ seed: 'precise-sea-world', presentYear: 0 });
        await game.newRun('Rider');
        game.repos.cultivators.update(game.currentRun().cultivator.id, {
            location: 'Emerald Water City', realmOrdinal: 0, hp: 1000, maxHp: 1000,
            spiritStones: 5000, satiety: 1 });
        const before = game.currentRun();
        game.atHand = await prepareWorldClockForPreciseSpan(before.run, before.cultivator);
        const world = game.atHand!, day = routineTime(world);
        const from = worldLocationFor(world, game.currentRun().cultivator.location)!;
        const line = publicShipLinesFrom(world, from.name, day).find(row => row.runsFromDay === null)!;
        const to = worldLocationFor(world, line.to)!;
        const quote = quotePublicPassage(world, from.id, to.id, day, 1)!;
        expect(quote).not.toBeNull(); expect(quote.days).toBeGreaterThan(1);
        const crew = ensureShipCrew(world, quote.lane, from.id, day);
        bindShipCrewToPassage(world, quote);
        const receipt = recordPublicPassage(world, quote, day, from.id,
            [before.cultivator.id, ...crew.map(person => person.id)]);
        game.repos.cultivators.applyDeltas(before.cultivator.id, { spiritStones: -quote.fareStones });
        writeTheVoyage(db, before.cultivator.id, { receiptId: receipt.id, from: from.name,
            bound: to.name, lane: quote.lane, sailed: 0, days: quote.days, quoted: quote.days,
            hullRationDays: quote.days, crew: crew.length });
        db.prepare("INSERT INTO cultivator_flags(cultivator_id,key,value,updated_at) VALUES(?,'rations_held','1',datetime('now')) ON CONFLICT(cultivator_id,key) DO UPDATE SET value='1'").run(before.cultivator.id);
        game.theWorldMoved();
        try {
            const first = await passHours(game, game.currentRun().run, game.currentRun().cultivator, 3);
            expect(first.finished).toBe(true);
            expect(isWater(worldLocationFor(game.atHand!, game.currentRun().cultivator.location)!)).toBe(true);
            expect(game.rationsHeld(game.currentRun().cultivator)).toBe(1);
            expect(theRationsAboard(db, game.currentRun().cultivator, game.atHand)).toBeGreaterThan(0);
            expect(takeFromTheHull(db, game.currentRun().cultivator, quote.days + 1, game.atHand)).toBeGreaterThan(0);
            expect(theRationsAboard(db, game.currentRun().cultivator, game.atHand)).toBe(0);
            const paid = game.currentRun().cultivator.spiritStones;
            const requested = quote.arrivalDay - routineTime(game.atHand!);
            const next = await passHours(game, game.currentRun().run, game.currentRun().cultivator, requested * 24);
            expect(next.finished).toBe(false);
            expect(next.spent?.timeSkip?.interruptReason).toBe('provisions_exhausted');
            expect(game.rationsHeld(game.currentRun().cultivator)).toBe(0);
            expect(game.currentRun().cultivator.satiety).toBeGreaterThan(1);
            expect(game.currentRun().cultivator.spiritStones).toBe(paid);
            expect(recordedVoyage(db, before.cultivator.id)?.receiptId).toBe(receipt.id);
            const actual = shipPassengerAt(game.atHand!, receipt.id, routineTime(game.atHand!))!;
            expect(actual.arrived).toBe(false); expect(actual.unavailable).toBeNull();
            expect(game.currentRun().cultivator.location).toBe(game.atHand!.locations.find(place => place.id === actual.locationId)!.name);
            expect(next.spent!.timeSkip!.simulatedDays).toBeLessThan(requested);
        } finally { db.close(); resetCultivationWorlds(); }
    }, 120_000);

    it('says when a lane is not worked, and on what day it is', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Salt Fields', spirit_stones = 500 WHERE id = ?")
            .run(game.state().cultivator.id);

        const done = await game.act('I take the ship to Moraine Gate');

        expect(done.narration).toMatch(new RegExp(`The first ship sails on day \\d+; today is day ${Math.floor(game.atHand!.currentDay)}`));
        expect(game.state().cultivator.location).toBe('Salt Fields');
    }, 120_000);

    it('reads the ways a player asks for a ship or a carriage', () => {
        expect(parseIntent('what ships are there')).toMatchObject({ action: 'passage', intent: 'board' });
        expect(parseIntent('where do the boats go')).toMatchObject({ action: 'passage', intent: 'board' });
        expect(parseIntent('I take the ship to Sweet Spring Island'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Sweet Spring Island' });
        expect(parseIntent('I buy a ticket to Sweet Spring Island'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Sweet Spring Island' });
        expect(parseIntent('I book a carriage to Emerald Water City'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Emerald Water City' });
        expect(parseIntent('I hire an iron-rimmed carriage to Emerald Water City'))
            .toMatchObject({ action: 'passage', intent: 'hire', topic: 'iron-rimmed carriage' });
        expect(parseIntent('what boats could I build here').action).not.toBe('passage');
    });
});
