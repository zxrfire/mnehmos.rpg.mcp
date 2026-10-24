/** A Native master can command a SQL person; their real body, never the World projection, acts. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { holdsASlaveSeal } from '../engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { commandSlave, completeSlaveOrderStep, currentSlaveOrder, unfinishedSlaveOrders, type PersonOrder } from '../engine/world/slave-orders.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { makeFact, type HistoricalFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { A_BLOW_MEANT_TO_END_IT } from '../engine/cultivation/how-a-blow-was-thrown.js';

export function commandAtTheActualBody(game: GameService, holderId: string, subjectId: string, order: PersonOrder) {
    const holder = actualPersonFor(game, holderId), subject = actualPersonFor(game, subjectId);
    if (!game.atHand || !holder || !subject) return null;
    const fact = commandSlave(game.atHand, holder, subject, order, routineTime(game.atHand), true);
    if (fact) game.theWorldMoved();
    return fact;
}

/** This returns an ordinary act for the actual executor. There is no autonomous SQL-body move. */
export function theOrderOnTheActualPlayer(game: GameService, body: Cultivator, requested: PlannedAction):
    { action: PlannedAction; raw: string; fact: HistoricalFact } | null {
    if (!game.atHand || !body.alive) return null;
    const world = game.atHand, day = routineTime(world);
    const fact = unfinishedSlaveOrders(world).find(fact => fact.data.slaveId === body.id
        && holdsASlaveSeal(body.qiSeal, String(fact.data.holderId), day));
    if (!fact) return null;
    const order = currentSlaveOrder(world, fact);
    if (!order) return null;
    const place = world.locations.find(place => place.id === order.destinationId);
    if (!place) return null;
    const action = (action: PlannedAction, raw: string) => ({ action, raw, fact });
    if (game.worldPlaceOf(body) !== place.id) {
        if (['look', 'request', 'interact', 'eat', 'treat', 'status'].includes(requested.action)) return null;
        return action({ action: 'move', intent: 'travel', target: place.name }, `I travel to ${place.name}`);
    }
    if (order.destinationAreaId && body.standingIn !== order.destinationAreaId) {
        const area = theAreasOf(world, place).areas.find(area => area.id === order.destinationAreaId);
        if (area) return action({ action: 'move', target: area.name }, `I walk to ${area.name}`);
    }
    const step = factsWithDataValue(world, 'slaveOrderStepEnded', fact.id).length;
    if (order.action === 'guard' || order.action === 'wait') {
        let start = world.history.facts.find(row => row.data.slaveGuardStarted === fact.id && (row.data.slaveOrderStep ?? 0) === step);
        if (!start) {
            start = appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret',
                actors: [{ id: body.id, name: body.name, role: 'guarding' }], locationId: place.id,
                summary: `${body.name} began the ordered guard.`, data: { slaveGuardStarted: fact.id, slaveOrderStep: step } }), { recur: false, bystanders: false });
            game.theWorldMoved();
        }
        const remaining = order.days === undefined ? Infinity : start.day + order.days - day;
        const met = order.action === 'wait' && order.targetId && game.present(body).some(person => person.id === order.targetId);
        if (remaining > 0 && !met) {
            // Eating, talking and defending the post remain possible. Leaving it does not.
            if (!['travel', 'move', 'ride', 'fold', 'passage', 'seclude'].includes(requested.action)) return null;
            return action({ action: 'wait', days: Math.min(remaining, 0.125) }, 'I keep the ordered guard');
        }
    } else if (order.action === 'attack') {
        const target = order.targetId ? game.present(body).find(person => person.id === order.targetId) : game.present(body)
            .find(person => person.id !== fact.data.holderId);
        if (target) return action({ action: 'attack', target: target.name, thrown: A_BLOW_MEANT_TO_END_IT }, `I attack ${target.name}`);
    } else if (order.action === 'message') {
        const person = actualPersonFor(game, order.targetId ?? '');
        if (person) return action({ action: 'tell', target: person.name, topic: order.words }, `I tell ${person.name}: ${order.words}`);
    } else if (order.action === 'cultivate') {
        let start = world.history.facts.find(row => row.data.slaveCultivationStarted === fact.id && (row.data.slaveOrderStep ?? 0) === step);
        if (!start) {
            start = appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: place.id,
                actors: [{ id: body.id, name: body.name, role: 'cultivating' }], summary: `${body.name} began the ordered cultivation.`,
                data: { slaveCultivationStarted: fact.id, slaveOrderStep: step } }), { recur: false, bystanders: false });
        }
        const remaining = start.day + (order.days ?? 1) - day;
        if (remaining > 0) return action({ action: 'seclude', days: remaining }, `I enter closed-door cultivation for ${remaining} days`);
    } else if (order.action !== 'travel') {
        return action({ action: 'request', target: actualPersonFor(game, String(fact.data.holderId))?.name,
            topic: order.words }, order.words);
    }
    completeSlaveOrderStep(world, fact, day, `${body.name} completed the ordered course.`);
    game.theWorldMoved();
    return currentSlaveOrder(world, fact) ? theOrderOnTheActualPlayer(game, body, requested) : null;
}
