/**
 * Moving-carrier contact acceptance, 2026-10-03.
 * Oct6 actual09 run: moving the observer to another native area did not
 * separate a matched driver/pilot; native company follows the real passenger.
 * These revised controls cover genuine co-located contact, not an invented
 * cabin crossing. Separate-deck approach remains the public ship control. Approach04's existing controls
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
 * Carriage contact here is explicitly roadside; these native readers do not
 * provide a carriage-interior area. This is not proof of an onboard cabin.
 */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { listenerInTheActualCarrierScene, askThatActualListener, actualListenerAnswered } from './fixtures/a-listener-on-an-actual-carrier.js';
import { createNpc, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { addPlacesOnTheWay, ROUTE_STOP } from '../../src/engine/world/places-on-the-way.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage } from '../../src/engine/world/public-carriages.js';
import { keepThePaidCarriage, thePaidCarriageClaim } from '../../src/web/a-paid-carriage-on-the-road.js';
async function boarded() {
    const plans: string[] = [];
    const { game, db } = makeGame({ provider: new ScriptedProvider({ plans, narrations: [] }), seed: 'physical-road-run', worldEnabled: true });
    await createWorld({ seed: 'physical-road-world', presentYear: 0 });
    await game.newRun('Paid road passenger');
    const run = game.currentRun().run;
    const player = game.repos.cultivators.getById(game.state().cultivator.id)!;
    const world = await prepareWorldClockForPreciseSpan(run, player);
    game.atHand = world;
    const from = makeLocation({ id: 'paid-from', name: 'Paid departure', kind: 'settlement' });
    const to = makeLocation({ id: 'paid-to', name: 'Paid destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    world.locations = [from, to]; addPlacesOnTheWay(world.locations);
    world.npcs = [createNpc(world.seed, { id: player.id, name: player.name, onDay: world.currentDay,
        bornOnDay: world.currentDay - 20 * 365, locationId: null, tags: [PLAYER_ROW_TAG] })];
    world.factions = []; world.objects = []; world.schedule = [];
    game.repos.cultivators.update(player.id, { location: from.name, standingIn: null,
        realmOrdinal: 20, spiritStones: 200, hp: 100, maxHp: 100 });
    const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day: world.currentDay,
        conveyanceId: 'conv-carriage-mortal', passengerIds: [player.id], fareStones: 12, hired: false,
        playedPassenger: { id: player.id, locationId: from.id, alive: true } })!;
    expect(quote).not.toBeNull();
    const receipt = commitPublicCarriage(world, quote)!;
    expect(receipt).not.toBeNull();
    game.repos.cultivators.applyDeltas(player.id, { spiritStones: -quote.fareStones });
    keepThePaidCarriage(db, player.id, receipt.id); game.theWorldMoved();
    return { plans, game, db, world, quote, receipt, player, from, to,
        stop: world.locations.find(place => place.tags.includes(ROUTE_STOP))! };
}

async function onActualRoad() {
    const h = await boarded();
    expect((await passHours(h.game, h.game.currentRun().run, h.game.currentRun().cultivator, 3)).finished).toBe(true);
    const driver = h.game.atHand!.npcs.find(person => person.id === h.quote.driverId)!;
    expect(driver).toBeDefined();
    return { ...h, driver };
}
it('speaks with the actual co-located driver while retaining the accepted carriage', async () => {
    const h = await onActualRoad();
    try {
        const listener = listenerInTheActualCarrierScene(h.game, h.driver.id, 'roadside');
        const moment = routineTime(h.game.atHand!);
        const turn = await askThatActualListener(h.game, h.plans, listener.name);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(false);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachUnfinished')).toBe(false);
        expect(actualListenerAnswered(turn, listener.name), JSON.stringify(turn.toolCalls)).toBe(true);
        const span = LESSER_ACTION_DAYS.interact;
        expect(h.game.currentRun().run.elapsedDays - listener.before.run.elapsedDays).toBeCloseTo(span, 12);
        expect(routineTime(h.game.atHand!) - moment).toBeCloseTo(span, 12);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
        expect(thePaidCarriageClaim(h.db, h.player.id)!.receiptId).toBe(h.receipt.id);
        const actual = publicCarriagePassage(h.game.atHand!, h.receipt.id, h.player.id, routineTime(h.game.atHand!))!;
        expect(actual).not.toBeNull();
        expect(h.game.currentRun().cultivator.location).toBe(h.game.atHand!.locations.find(row => row.id === actual.locationId)!.name);
        expect(h.game.present(h.game.currentRun().cultivator).length).toBeLessThanOrEqual(3);
    } finally { h.db.close(); resetCultivationWorlds(); }
});
it('actual driver death stops carrier time and the dead driver cannot answer afterward', async () => {
    const h = await onActualRoad();
    try {
        const listener = listenerInTheActualCarrierScene(h.game, h.driver.id, 'roadside');
        h.driver.cultivation.lifespanEndsOnDay = routineTime(h.game.atHand!) + .0625;
        h.game.theWorldMoved();
        const stopped = await passHours(h.game, listener.before.run, listener.before.cultivator, 3);
        expect(stopped.finished).toBe(false);
        expect(stopped.spent?.timeSkip?.simulatedDays).toBeCloseTo(.0625, 12);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
        const stoppedAt = h.game.currentRun().run.elapsedDays;
        const turn = await askThatActualListener(h.game, h.plans, listener.name);
        expect(h.game.currentRun().run.elapsedDays).toBe(stoppedAt);
        expect(turn.toolCalls.some(call => !call.name.startsWith('narrator.') && !call.ok), JSON.stringify(turn.toolCalls)).toBe(true);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(false);
        expect(actualListenerAnswered(turn, listener.name), "the stopped approach must not produce that listener's answer").toBe(false);
        expect(h.game.currentRun().cultivator.alive).toBe(true);
        expect(h.game.currentRun().cultivator.location).not.toBe(h.to.name);
        expect(h.game.currentRun().run.elapsedDays - listener.before.run.elapsedDays).toBeCloseTo(.0625, 12);
        expect(h.game.currentRun().run.turn).toBeGreaterThanOrEqual(listener.before.run.turn + 1);
    } finally { h.db.close(); resetCultivationWorlds(); }
});
