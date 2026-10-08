/**
 * Aboard a paid public ship, a three-hour conversation must advance the same
 * actual crew and passenger clock. Eight separate replies cross midnight once;
 * hull meals use the ordinary food rule and do not consume carried provisions.
 * If every actual crew member dies at a dated boundary, the later requested
 * player/body span does not happen and the receipt never claims the landing.
 * These are accepted real public-lane bookings, not invented short sea legs.
 * Frozen13 paid-ship controls passed in the root remaining9 run74411.
 * Frozen14 adds a read-only canonical landfall/positive partial-day control,
 * pending verification; no passage clock or quoted horizon is shortened.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt, turnBackPublicPassage } from '../../src/engine/world/passenger-on-a-vessel.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { writeTheVoyage, recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { isWater, journeyTimeHasReached, locationOnNpcJourney } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';

async function boarded() {
    const { game, db } = makeGame({ seed: 'precise-sea-replies', worldEnabled: true });
    await createWorld({ seed: 'precise-sea-world', presentYear: 0 });
    await game.newRun('Paid sea passenger');
    let now = game.currentRun();
    game.repos.cultivators.update(now.cultivator.id, { location: 'Emerald Water City',
        realmOrdinal: 20, spiritStones: 5000, hp: 1000, maxHp: 1000, satiety: 12 });
    now = game.currentRun();
    game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
    const world = game.atHand;
    const from = worldLocationFor(world, now.cultivator.location)!;
    const line = publicShipLinesFrom(world, from.name, routineTime(world))
        .find(one => one.runsFromDay === null)!;
    const to = worldLocationFor(world, line.to)!;
    const quote = quotePublicPassage(world, from.id, to.id, routineTime(world), 1)!;
    expect(quote).not.toBeNull();
    expect(quote.days).toBeGreaterThan(1);
    const crew = ensureShipCrew(world, quote.lane, from.id, quote.departureDay);
    bindShipCrewToPassage(world, quote);
    const receipt = recordPublicPassage(world, quote, quote.departureDay, from.id,
        [now.cultivator.id, ...crew.map(one => one.id)]);
    game.repos.cultivators.applyDeltas(now.cultivator.id, { spiritStones: -quote.fareStones });
    writeTheVoyage(db, now.cultivator.id, { receiptId: receipt.id, from: from.name, bound: to.name,
        lane: quote.lane, sailed: 0, days: quote.days, quoted: quote.days,
        hullRationDays: quote.days, crew: crew.length });
    game.theWorldMoved();
    return { game, db, world, quote, receipt, from, to, playerId: now.cultivator.id };
}

it('moves a paid passenger during separate fractional replies and feeds them from this hull', async () => {
    const { game, db, quote, receipt, from, playerId } = await boarded();
    try {
        const before = game.currentRun();
        for (let i = 0; i < 8; i++) {
            const now = game.currentRun();
            const reply = await passHours(game, now.run, now.cultivator, 3);
            expect(reply.finished).toBe(true);
            expect(recordedVoyage(db, playerId)?.receiptId).toBe(receipt.id);
            const actual = shipPassengerAt(game.atHand!, receipt.id, routineTime(game.atHand!))!;
            expect(actual.unavailable).toBeNull();
            expect(game.currentRun().cultivator.location)
                .toBe(game.atHand!.locations.find(place => place.id === actual.locationId)!.name);
        }
        expect(routineTime(game.atHand!)).toBeCloseTo(quote.departureDay + 1, 12);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(1, 12);
        expect(game.currentRun().cultivator.location).not.toBe(from.name);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(game.currentRun().cultivator.satiety).toBeGreaterThan(0);
        expect(game.drawFromPack(game.currentRun().cultivator, 1)).toBe(0);
    } finally { db.close(); resetCultivationWorlds(); }
});

it('retains actual water ground and stops at the death of the last real crew', async () => {
    const { game, db, quote, receipt, to } = await boarded();
    try {
        const actual = shipPassengerAt(game.atHand!, receipt.id, quote.departureDay)!;
        expect(actual.crew.length).toBeGreaterThan(0);
        for (const one of actual.crew) one.cultivation.lifespanEndsOnDay = quote.departureDay + .0625;
        const before = game.currentRun();
        const reply = await passHours(game, before.run, before.cultivator, 3);
        expect(reply.finished).toBe(false);
        expect(routineTime(game.atHand!)).toBeCloseTo(quote.departureDay + .0625, 12);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(.0625, 12);
        expect(game.currentRun().cultivator.alive).toBe(true);
        expect(game.currentRun().cultivator.location).not.toBe(to.name);
        const lost = shipPassengerAt(game.atHand!, receipt.id, routineTime(game.atHand!))!;
        expect(lost.arrived).toBe(false);
        expect(lost.unavailable).not.toBeNull();
        expect(isWater(game.atHand!.locations.find(place => place.id === lost.locationId)!)).toBe(true);
    } finally { db.close(); resetCultivationWorlds(); }
});

/** A changed course is another actual leg caused by boarding, never a rewritten past arrival. */
it('carries surviving crew back from actual water and preserves the original paid receipt', async () => {
    const { game, db, quote, receipt, from, to, playerId } = await boarded();
    try {
        let now = game.currentRun();
        await passHours(game, now.run, now.cultivator, 3);
        const boundary = routineTime(game.atHand!);
        const beforeReturn = shipPassengerAt(game.atHand!, receipt.id, boundary)!;
        expect(beforeReturn.locationId).not.toBe(from.id);
        expect(beforeReturn.locationId).not.toBe(to.id);
        const returned = turnBackPublicPassage(game.atHand!, receipt.id, boundary)!;
        expect(returned).not.toBeNull();
        expect(returned.fromId).toBe(beforeReturn.locationId);
        expect(returned.toId).toBe(from.id);
        expect(returned.departureDay).toBe(boundary);
        expect(returned.arrivalDay).toBeCloseTo(boundary + .125, 12);
        game.theWorldMoved();
        expect(recordedVoyage(db, playerId)?.receiptId).toBe(receipt.id);
        now = game.currentRun();
        const carried = await passHours(game, now.run, now.cultivator, 3);
        expect(carried.finished).toBe(true);
        expect(game.currentRun().cultivator.location).toBe(from.name);
        expect(game.currentRun().cultivator.spiritStones).toBe(now.cultivator.spiritStones);
        expect(routineTime(game.atHand!)).toBeCloseTo(returned.arrivalDay, 12);
        const original = game.atHand!.history.facts.find(fact => fact.id === receipt.id)!;
        expect(original.data.toLocationId).toBe(to.id);
        expect(original.data.arrivalDay).toBe(quote.arrivalDay);
        const landed = shipPassengerAt(game.atHand!, receipt.id, routineTime(game.atHand!))!;
        expect(landed.arrived).toBe(true);
        expect(landed.crew.map(one => one.id).sort()).toEqual(beforeReturn.crew.map(one => one.id).sort());
        // The abandoned future landing cannot block a real sailing from the returned port.
        expect(quotePublicPassage(game.atHand!, from.id, to.id, routineTime(game.atHand!))).not.toBeNull();
    } finally { db.close(); resetCultivationWorlds(); }
});

it('reads a canonically reached landing without a phantom remainder or an early real-day arrival', async () => {
    const { game, db, world, quote, receipt, to } = await boarded();
    try {
        const originalDay = world.currentDay;
        const partial = shipPassengerAt(world, receipt.id, quote.arrivalDay - 1)!;
        expect(partial.unavailable).toBeNull();
        expect(partial.arrived).toBe(false);
        expect(partial.remainingDays).toBe(1);
        expect(partial.locationId).not.toBe(to.id);
        const moment = quote.arrivalDay - Number.EPSILON * Math.abs(quote.arrivalDay);
        expect(journeyTimeHasReached(moment, quote.arrivalDay)).toBe(true);
        expect(journeyTimeHasReached(quote.arrivalDay, moment)).toBe(true);
        const landed = shipPassengerAt(world, receipt.id, moment)!;
        expect(landed.unavailable).toBeNull();
        expect(landed.arrived).toBe(true);
        expect(landed.remainingDays).toBe(0);
        expect(landed.sailed).toBe(quote.arrivalDay - quote.departureDay);
        expect(landed.locationId).toBe(to.id);
        expect(landed.crew.length).toBeGreaterThan(0);
        for (const crew of landed.crew)
            expect(locationOnNpcJourney(world.locations, crew, moment)).toBe(to.id);
        expect(world.currentDay).toBe(originalDay);
        expect(game.currentRun().cultivator.location).not.toBe(to.name);
    } finally { db.close(); resetCultivationWorlds(); }
});

/** Preparatory native time defers completion; the following real wait owns it once.
 * Oct6 native31 run stopped at a branch-specific world.waitForHour label.
 * Accepted carriers may use another wait front door; native result receipt,
 * actual elapsed body/world time, one completion and original claim are the rule. */
it('keeps one completion across a deferred preparatory span and an actual wait', async () => {
    const { game, db, receipt } = await boarded();
    try {
        const before = game.currentRun(), start = routineTime(game.atHand!);
        
        const prepared = await passHours(game, before.run, before.cultivator, 3, before.run.turn + 1, false);
        expect(prepared.finished).toBe(true);
        expect(prepared.spent?.timeSkip?.simulatedDays).toBe(.125);
        expect(game.currentRun().run.turn).toBe(before.run.turn);
        const waited = await game.act('I wait for 3 hours');
        const after = game.currentRun();
        expect(waited.toolCalls.some(call => !call.name.startsWith('narrator.') && call.ok),
            JSON.stringify(waited.toolCalls)).toBe(true);
        expect(waited.toolCalls.filter(call => !call.name.startsWith('narrator.') && !call.ok),
            JSON.stringify(waited.toolCalls)).toEqual([]);
        expect(after.cultivator.alive).toBe(true);
        expect(after.cultivator.age).toBeGreaterThan(before.cultivator.age);
        expect(after.run.turn).toBe(before.run.turn + 1);
        expect(journeyTimeHasReached(after.run.elapsedDays, before.run.elapsedDays + .25)).toBe(true);
        expect(journeyTimeHasReached(before.run.elapsedDays + .25, after.run.elapsedDays)).toBe(true);
        expect(journeyTimeHasReached(routineTime(game.atHand!), start + .25)).toBe(true);
        expect(journeyTimeHasReached(start + .25, routineTime(game.atHand!))).toBe(true);
        expect(recordedVoyage(db, after.cultivator.id)?.receiptId).toBe(receipt.id);
    } finally { db.close(); resetCultivationWorlds(); }
});
