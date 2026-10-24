/** Replay2 N2/N4: an ordered local destination was treated as the whole town,
 * and the wait inside the order was reported as an unperformed player act.
 * Orders retain their sequence; actual native bodies pay the same local walk. */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineOf, routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { publicCountersAt } from '../../src/engine/world/public-transport-at-a-place.js';
import { writeActualPersonSeal } from '../../src/web/person-seals-at-the-actual-body.js';
import { unfinishedSlaveOrders } from '../../src/engine/world/slave-orders.js';
import { commandAtTheActualBody } from '../../src/web/slave-orders-at-the-actual-body.js';
import { LOCAL_WALK_DAYS } from '../../src/engine/world/local-walking-cost.js';
import { forgetWorld, worldForRun } from '../../src/server/state/cultivation-world.js';

it('goes to the real landing, then waits there for the holder through save and arrival', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The order is heard.', 'Time passes.', 'You reach the landing.'] });
    const h = await makeGameInWorld({ seed: 'reading3-orders', worldSeed: 'reading3-orders-world', provider });
    try {
        const { cultivator } = await h.game.newRun('Holder');
        const world = h.game.atHand!, day = routineTime(world);
        const place = world.locations.find(place => place.kind === 'settlement' && publicCountersAt(world, place.name, day).includes('landing'))!;
        expect(place).toBeDefined();
        world.npcs = world.npcs.filter(person => person.id === cultivator.id);
        const areas = theAreasOf(world, place).areas;
        const street = areas.find(area => area.for === 'street')!, landing = areas.find(area => area.for === 'landing')!;
        const slave = createNpc(world.seed, { id: 'reading3-waiter', name: 'The Listener',
            onDay: day, bornOnDay: day - 25 * 365, locationId: place.id });
        slave.activity = { kind: 'stationed', note: 'Standing at the street.', sinceDay: day, untilDay: null, withIds: [], standingIn: street.id };
        world.npcs.push(slave);
        h.repos.cultivators.update(cultivator.id, { location: place.name });
        h.repos.cultivators.standIn(cultivator.id, street.id);
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, slave);
        writeActualPersonSeal(h.game, slave.id, { kind: 'slave', byId: cultivator.id,
            sinceDay: day, liftsOnDay: null, note: 'Actual held seal.' }, day);
        h.game.theWorldMoved();
        plans.push(JSON.stringify({ lane: 'speak', intent: 'command_person', target: slave.name,
            topic: `go to ${landing.name} and wait for me there`, orders: [
                { action: 'travel', destination: landing.name, words: `go to ${landing.name}` },
                { action: 'wait', target: 'me', words: 'wait for me there' }
            ] }));
        const before = h.game.currentRun().run.elapsedDays;
        const ordered = await h.game.act(`${slave.name}, I command you to go to ${landing.name} and wait for me there`);
        expect(h.game.currentRun().run.elapsedDays).toBe(before);
        expect(ordered.narration).not.toContain('One act at a time');
        const order = unfinishedSlaveOrders(h.game.atHand!).find(fact => fact.data.slaveId === slave.id);
        expect(order).toBeDefined();
        const body = () => h.game.atHand!.npcs.find(person => person.id === slave.id)!;
        expect(body().activity?.untilDay).toBeCloseTo(day + LOCAL_WALK_DAYS);
        expect(routineOf(h.game.atHand!, body()).standingIn).not.toBe(landing.id);
        plans.push(JSON.stringify({ action: 'wait', days: LOCAL_WALK_DAYS / 2 }));
        await h.game.act('I wait for 3 hours');
        expect(routineOf(h.game.atHand!, body()).standingIn).not.toBe(landing.id);
        expect(unfinishedSlaveOrders(h.game.atHand!).some(fact => fact.id === order!.id)).toBe(true);
        // The pending order and local walk survive ordinary storage, not a transient callback.
        h.game.theWorldMoved();
        forgetWorld(h.game.atHand!.id);
        h.game.atHand = await worldForRun(h.game.currentRun().run);
        plans.push(JSON.stringify({ action: 'move', target: landing.name }));
        await h.game.act(`I go to ${landing.name}`);
        expect(routineOf(h.game.atHand!, body()).standingIn).toBe(landing.id);
        expect(h.game.present(h.game.currentRun().cultivator).some(person => person.id === slave.id)).toBe(true);
        expect(h.game.atHand!.history.facts.some(fact => fact.data.slaveOrderStepEnded === order!.id)).toBe(true);
    } finally { h.db.close(); }
});

it('a sealed SQL body keeps the term and takes the local road through the actual executor', async () => {
    const h = await makeGameInWorld({ seed: 'reading3-sql-orders', worldSeed: 'reading3-orders-world' });
    try {
        const { cultivator } = await h.game.newRun('Bound Traveller');
        const world = h.game.atHand!, day = routineTime(world);
        const place = world.locations.find(place => place.kind === 'settlement' && publicCountersAt(world, place.name, day).includes('landing'))!;
        world.npcs = world.npcs.filter(person => person.id === cultivator.id);
        const areas = theAreasOf(world, place).areas;
        const street = areas.find(area => area.for === 'street')!, landing = areas.find(area => area.for === 'landing')!;
        h.repos.cultivators.update(cultivator.id, { location: place.name });
        h.repos.cultivators.standIn(cultivator.id, street.id);
        const holder = createNpc(world.seed, { id: 'reading3-sql-holder', name: 'The Holder', onDay: day,
            bornOnDay: day - 25 * 365, locationId: place.id });
        holder.activity = { kind: 'stationed', note: 'Standing here.', sinceDay: day, untilDay: null, withIds: [], standingIn: street.id };
        world.npcs.push(holder);
        writeActualPersonSeal(h.game, cultivator.id, { kind: 'slave', byId: holder.id,
            sinceDay: day, liftsOnDay: null, note: 'The actual SQL body is bound.' }, day);
        const order = commandAtTheActualBody(h.game, holder.id, cultivator.id, {
            action: 'wait', destinationId: place.id, days: LOCAL_WALK_DAYS / 2, words: 'wait three hours', following: [
                { action: 'travel', destinationId: place.id, destinationAreaId: landing.id, words: 'then go to the landing' }
            ]
        });
        expect(order).not.toBeNull();
        expect(h.game.currentRun().cultivator.standingIn).toBe(street.id);
        const before = h.game.currentRun().run.elapsedDays;
        await h.game.act(`I go to ${landing.name}`);
        expect(h.game.currentRun().cultivator.standingIn).toBe(street.id);
        expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(LOCAL_WALK_DAYS / 2);
        await h.game.act(`I go to ${landing.name}`);
        expect(h.game.currentRun().cultivator.standingIn).toBe(landing.id);
        expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(LOCAL_WALK_DAYS * 1.5);
    } finally { h.db.close(); }
});
