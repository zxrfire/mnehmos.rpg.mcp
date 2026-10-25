/**
 * Moving-carrier approach acceptance, 2026-10-03. Approach04's existing controls
 * covered deferred carrier time, but did not actually reach a named listener
 * from another area. These copy the corresponding already-existing native
 * accepted-passage fixture, then choose an existing public area with the native
 * placement/access reader. Area/name arrangement is explicit operator setup;
 * there are no invented bookings, people, cabins or projected positions.
 * Scripted phase-1 routing plus empty narration exercises engine authority,
 * not live-model prose. Actual hull identity, elapsed body/world time, completion
 * and fresh native contact reads are the evidence. Real arrival/death/ruin
 * refuses the requested conversation rather than finishing an old scene.
 * Oct6 review adds the actual named engine answer receipt: approachTime alone
 * could also precede a handler refusal. Both listener and observer areas now
 * require the actual native substrate rather than a street/table fallback.
 */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { listenerAcrossAnActualPublicArea, askThatActualListener, actualListenerAnswered } from './fixtures/a-listener-on-an-actual-carrier.js';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { writeTheVoyage, recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { isWater } from '../../src/engine/world/places-on-the-way.js';
async function boarded() {
    const plans: string[] = [];
    const { game, db } = makeGame({ provider: new ScriptedProvider({ plans, narrations: [] }), seed: 'precise-sea-replies', worldEnabled: true });
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
    return { plans, game, db, world, quote, receipt, from, to, playerId: now.cultivator.id };
}

async function onActualWater() {
    const h = await boarded();
    const now = h.game.currentRun();
    expect((await passHours(h.game, now.run, now.cultivator, 3)).finished).toBe(true);
    expect(isWater(worldLocationFor(h.game.atHand!, h.game.currentRun().cultivator.location)!)).toBe(true);
    return h;
}
it('approaches a real ship listener across an actual deck on the same accepted hull', async () => {
    const h = await onActualWater();
    try {
        const actual = shipPassengerAt(h.game.atHand!, h.receipt.id, routineTime(h.game.atHand!))!;
        const listener = listenerAcrossAnActualPublicArea(h.game, actual.crew[0]!.id, 'deck');
        const moment = routineTime(h.game.atHand!);
        const turn = await askThatActualListener(h.game, h.plans, listener.name);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachTime' && call.ok)).toBe(true);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachUnfinished')).toBe(false);
        expect(actualListenerAnswered(turn, listener.name), JSON.stringify(turn.toolCalls)).toBe(true);
        const span = LESSER_ACTION_DAYS.move + LESSER_ACTION_DAYS.interact;
        expect(h.game.currentRun().run.elapsedDays - listener.before.run.elapsedDays).toBeCloseTo(span, 12);
        expect(routineTime(h.game.atHand!) - moment).toBeCloseTo(span, 12);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
        expect(recordedVoyage(h.db, h.playerId)!.receiptId).toBe(h.receipt.id);
        const after = shipPassengerAt(h.game.atHand!, h.receipt.id, routineTime(h.game.atHand!))!;
        expect(after.unavailable).toBeNull();
        expect(h.game.currentRun().cultivator.location).toBe(h.game.atHand!.locations.find(row => row.id === after.locationId)!.name);
        expect(h.game.present(h.game.currentRun().cultivator).length).toBeLessThanOrEqual(3);
    } finally { h.db.close(); resetCultivationWorlds(); }
});
it('real ship landfall during a deck approach retains arrival and never performs the old conversation', async () => {
    const h = await onActualWater();
    try {
        const remaining = h.quote.arrivalDay - routineTime(h.game.atHand!);
        const halfWalk = LESSER_ACTION_DAYS.move / 2;
        expect(remaining).toBeGreaterThan(halfWalk);
        expect((await passHours(h.game, h.game.currentRun().run, h.game.currentRun().cultivator,
            (remaining - halfWalk) * 24)).finished).toBe(true);
        expect(isWater(worldLocationFor(h.game.atHand!, h.game.currentRun().cultivator.location)!)).toBe(true);
        const actual = shipPassengerAt(h.game.atHand!, h.receipt.id, routineTime(h.game.atHand!))!;
        const listener = listenerAcrossAnActualPublicArea(h.game, actual.crew[0]!.id, 'deck');
        const turn = await askThatActualListener(h.game, h.plans, listener.name);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachUnfinished' && !call.ok)).toBe(true);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(false);
        expect(actualListenerAnswered(turn, listener.name), "the stopped approach must not produce that listener's answer").toBe(false);
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(listener.before.run.elapsedDays);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
    } finally { h.db.close(); resetCultivationWorlds(); }
});
