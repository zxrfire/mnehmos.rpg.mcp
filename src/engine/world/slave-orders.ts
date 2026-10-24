/** A seal supplies compulsion; ordinary travel and melee still decide what the body achieves. */
import { holdsASlaveSeal } from '../cultivation/a-qi-seal-is-put-on-a-person.js';
import { forStream } from '../cultivation/rng.js';
import { resolveMelee, OUTCOME_FOR_FATE } from '../cultivation/combat.js';
import { A_BLOW_MEANT_TO_END_IT } from '../cultivation/how-a-blow-was-thrown.js';
import { createObligation } from '../social/grudges.js';
import { whatADeedLeaves } from '../social-leverage/what-a-deed-leaves.js';
import { startNpcJourney } from './dao-ground-stints.js';
import { routineLocationOf } from './npc-routines.js';
import { bodyStandingOn, maxBodyOf, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { combatantOf } from './gatherings.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { rememberFact } from './memory.js';
import { whatTheConfrontationDidToThem, whatTheirFlightsCost } from './what-a-confrontation-does-to-somebody-the-world-holds.js';
import { whoBurnedATeleportationTalisman } from './a-talisman-is-one-act-somebody-already-paid-for.js';
import { aBreakingEntersTheWorld } from './a-thing-somebody-ended-is-a-fact.js';
import { writeTheNpcArtsActuallyUsed } from './the-arts-an-npc-actually-uses-in-a-fight.js';
import { reactToWitnessedFact, observationOf } from './witness-reactions.js';
import { transferPossession } from './possessions.js';
import type { WorldState } from './world-state.js';
import { takeThemWithYou } from './who-is-on-the-road-with-you.js';
import { playerAtTheContact } from './background-incident-draw.js';
import { beginClosedDoorCultivation } from './closed-door-cultivation.js';
import { factsWithData, factsWithDataValue } from './witness-reaction-index.js';
import { releasePersonSeal } from './person-seals.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';
import { beginActualDepartureApproach, finishActualDepartureApproach } from './departure-approach.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';

export interface PersonOrder {
    action: 'attack' | 'guard' | 'fetch' | 'message' | 'travel' | 'company' | 'cultivate' | 'wait' | 'request';
    destinationId: string;
    destinationAreaId?: string;
    /** Remaining ordered acts, recorded at the original hearing. */
    following?: PersonOrder[];
    targetId?: string;
    objectId?: string;
    words: string;
    days?: number;
}

/** No trait or willingness read occurs here. Reach is supplied by the actual scene. */
export function commandSlave(state: WorldState, holder: NpcRecord, slave: NpcRecord,
    order: PersonOrder, day: number, reached: boolean): HistoricalFact | null {
    if (!reached || holder.status !== 'alive' || slave.status !== 'alive'
        || !holdsASlaveSeal(slave.cultivation.seal, holder.id, day)
        || !state.locations.some(place => place.id === order.destinationId)) return null;
    for (const previous of unfinishedSlaveOrders(state)) if (previous.data.slaveId === slave.id)
        finishOrder(state, previous, day, `${holder.name} superseded the prior order.`);
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', locationId: slave.locationId,
        visibility: 'secret', actors: [{ id: holder.id, name: holder.name, role: 'commanded' },
            { id: slave.id, name: slave.name, role: 'compelled' }], summary: `${holder.name} ordered ${slave.name}: ${order.words}`,
        data: { slaveOrder: true, slaveId: slave.id, holderId: holder.id, order: JSON.stringify(order) } }), { recur: false, bystanders: false });
    rememberFact(state.memories, slave.id, fact, { kind: 'betrayal', tags: ['slave-order'] });
    settleSlaveOrders(state, day);
    return fact;
}

export function unfinishedSlaveOrders(state: WorldState): HistoricalFact[] {
    const completed = new Set(factsWithData(state, 'slaveOrderEnded').filter(fact => typeof fact.data.slaveOrderEnded === 'string')
        .map(fact => fact.data.slaveOrderEnded));
    return factsWithDataValue(state, 'slaveOrder', true).filter(fact => !completed.has(fact.id));
}

export function finishSlaveOrder(state: WorldState, fact: HistoricalFact, day: number, note: string): void {
    appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
        locationId: fact.locationId, causes: [fact.id], actors: fact.actors,
        summary: note, data: { slaveOrderEnded: fact.id } }), { recur: false, bystanders: false });
}

const finishOrder = finishSlaveOrder;

/** Progress is derived from actual completion receipts, never a parallel queue/counter. */
export function currentSlaveOrder(state: WorldState, fact: HistoricalFact): PersonOrder | null {
    const root = JSON.parse(String(fact.data.order)) as PersonOrder;
    const completed = factsWithDataValue(state, 'slaveOrderStepEnded', fact.id).length;
    return [root, ...(root.following ?? [])][completed] ?? null;
}

export function completeSlaveOrderStep(state: WorldState, fact: HistoricalFact, day: number, note: string): void {
    const step = factsWithDataValue(state, 'slaveOrderStepEnded', fact.id).length;
    appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
        locationId: fact.locationId, causes: [fact.id], actors: fact.actors,
        summary: note, data: { slaveOrderStepEnded: fact.id, step } }), { recur: false, bystanders: false });
    if (!currentSlaveOrder(state, fact)) finishOrder(state, fact, day, note);
}

/** Appointments and foreground contact call this; no daily population walk is added. */
export function settleSlaveOrders(state: WorldState, day: number): void {
    for (const id of new Set(factsWithDataValue(state, 'slaveOrder', true).map(fact => String(fact.data.slaveId)))) {
        const person = state.npcs.find(person => person.id === id && isTheWorldsToMove(person) && person.status === 'alive');
        const seal = person?.cultivation.seal;
        if (person && seal?.kind === 'slave' && seal.liftsOnDay !== null && day >= seal.liftsOnDay)
            releasePersonSeal(state, id, seal.liftsOnDay);
    }
    for (const fact of unfinishedSlaveOrders(state)) {
        // Each true return has written a completion receipt; the finite original
        // sequence bounds this loop, including several immediate acts at one clock.
        while (settleCurrentOrder(state, fact, day)) { /* read the next original act */ }
    }
}

function settleCurrentOrder(state: WorldState, fact: HistoricalFact, day: number): boolean {
    const at = state.npcs.findIndex(person => person.id === fact.data.slaveId);
    let slave = state.npcs[at];
    const holderId = String(fact.data.holderId), order = currentSlaveOrder(state, fact);
    if (!order) return false;
    // SQL bodies act only through the actual-body port.
    if (slave && !isTheWorldsToMove(slave)) return false;
    if (!slave || slave.status !== 'alive' || !holdsASlaveSeal(slave.cultivation.seal, holderId, day)) {
        finishOrder(state, fact, day, 'The seal no longer holds. The remaining order no longer compels.'); return false;
    }
    const clock = { ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 };
    const place = routineLocationOf(clock, slave);
    const object = order.objectId && state.objects.find(object => object.id === order.objectId);
    const returning = order.action === 'fetch' && object && object.possessorId === slave.id;
    const contact = playerAtTheContact(state);
    const master = contact?.id === holderId ? contact.person : state.npcs.find(person => person.id === holderId && isTheWorldsToMove(person));
    const delivery = contact?.id === holderId ? contact.placeId : master && routineLocationOf(clock, master);
    const destination = returning ? delivery ?? fact.locationId : order.destinationId;
    if (slave.activity?.departureApproach) return false;
    if (place !== destination) {
        if (!slave.activity || slave.activity.kind !== 'travelling') {
            const journey = destination ? goOnTheOrderedCourse(state, { ...slave, locationId: place }, destination, day, fact.summary) : null;
            if (journey?.activity) state.npcs[at] = { ...journey, activity: { ...journey.activity, slaveOrderId: fact.id } };
        }
        return false;
    }
    // Areas are physical destinations too. Use the same timed approach and
    // door/key authority as ordinary Native departures, with no teleport.
    if (order.destinationAreaId && !returning) {
        const request = { intentId: fact.id, target: { locationId: order.destinationId, areaId: order.destinationAreaId } };
        const walking = slave.activity?.capitalMissionId === fact.id;
        const result = walking ? finishActualDepartureApproach(clock, slave.id, request, day)
            : beginActualDepartureApproach(clock, slave.id, request, day, { ...slave, locationId: place });
        if (result.kind === 'approaching') {
            state.npcs[at] = { ...result.actor, activity: { ...result.actor.activity!, slaveOrderId: fact.id } }; return false;
        }
        if (result.kind === 'waiting') return false;
        if (result.kind !== 'ready') {
            finishOrder(state, fact, day, result.kind === 'refused' ? result.reason : 'The actual body could not reach the ordered area.');
            return false;
        }
        slave = !walking ? result.actor : { ...result.actor, locationId: place, activity: {
            ...result.actor.activity!, kind: 'stationed', withIds: [], standingIn: order.destinationAreaId,
            capitalMissionId: undefined, slaveOrderId: fact.id, sinceDay: day,
            untilDay: null, note: 'Arrived at the ordered area.' } };
        state.npcs[at] = slave;
    }
    if (order.action === 'request') return false; // Reached request adapter owns its receipt.
    if (order.action === 'cultivate') {
        const step = factsWithDataValue(state, 'slaveOrderStepEnded', fact.id).length;
        let start = factsWithDataValue(state, 'slaveCultivationStarted', fact.id)
            .find(row => row.data.slaveOrderStep === step);
        if (!start) {
            // A completed journey is not an ongoing away activity at admission.
            state.npcs[at] = { ...slave, locationId: place, activity: null };
            if (!beginClosedDoorCultivation(state, slave.id, day, order.days ?? 1)) return false;
            const body = state.npcs[at];
            state.npcs[at] = { ...body, activity: { ...body.activity!, slaveOrderId: fact.id } };
            appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: place,
                causes: [fact.id], actors: fact.actors, summary: `${slave.name} began the ordered sitting.`,
                data: { slaveCultivationStarted: fact.id, slaveOrderStep: step } }), { recur: false, bystanders: false });
            return false;
        }
        if (slave.activity?.kind === 'closed_door_cultivation' && slave.activity.slaveOrderId === fact.id) return false;
        const ended = factsWithDataValue(state, 'closedDoorCultivationEnded', true).some(row => row.day >= start!.day + (order.days ?? 1)
            && row.actors.some(actor => actor.id === slave.id));
        if (!ended) {
            finishOrder(state, fact, day, 'The ordered sitting was interrupted. The remaining course was not reached.');
            return false;
        }
        completeSlaveOrderStep(state, fact, day, `${slave.name} finished the ordered sitting.`);
        return currentSlaveOrder(state, fact) !== null;
    }

    if (order.action === 'guard' || order.action === 'wait') {
        const previous = factsWithDataValue(state, 'slaveOrderStepEnded', fact.id).at(-1)?.day ?? fact.day;
        const held = slave.activity?.kind === 'stationed' && slave.activity.slaveOrderId === fact.id
            && slave.activity.note === order.words && slave.activity.sinceDay >= previous;
        const since = held ? slave.activity!.sinceDay : day;
        const until = order.days === undefined ? null : since + order.days;
        state.npcs[at] = { ...slave, locationId: place, activity: { kind: 'stationed', note: order.words, withIds: [],
            sinceDay: since, untilDay: until, standingIn: order.destinationAreaId ?? slave.activity?.standingIn, slaveOrderId: fact.id } };
        const target = order.targetId ? (contact?.id === order.targetId ? contact.person : state.npcs.find(person => person.id === order.targetId)) : undefined;
        const location = state.locations.find(location => location.id === place);
        const areas = order.action === 'wait' && target && location && routineLocationOf(clock, target) === place ? theAreasOf(clock, location) : null;
        const met = areas && areas.whereIs.get(target!.id) === areas.whereIs.get(slave.id);
        if (until === null ? !met : day < until) return false;
    } else {
        state.npcs[at] = { ...slave, locationId: place, activity: order.destinationAreaId ? {
            kind: 'stationed', note: order.words, withIds: [], sinceDay: day, untilDay: null, standingIn: order.destinationAreaId
        } : null, updatedOnDay: day };
        if (order.action === 'attack' && !attackUnderCommand(state, state.npcs[at], fact, order, day)) return false;
        else if (order.action === 'company') {
            const changed = takeThemWithYou(state.npcs, { leaderId: holderId, party: [state.npcs[at]],
                note: fact.summary, onDay: day, untilDay: order.days === undefined ? null : day + order.days });
            for (const person of changed) {
                const index = state.npcs.findIndex(row => row.id === person.id);
                state.npcs[index] = { ...person, activity: { ...person.activity!, slaveOrderId: fact.id } };
            }
        } else if (order.action === 'fetch') {
            if (!object) return false;
            if (returning) {
                if (!master || delivery !== place) return false;
                Object.assign(object, transferPossession(object, { toHolderId: holderId, toHolderName: master.name,
                    onDay: day, how: 'gifted', factId: fact.id, note: 'Delivered under the slave seal.' }));
                completeSlaveOrderStep(state, fact, day, `${slave.name} delivered ${object.name} to ${master.name}.`);
                return currentSlaveOrder(state, fact) !== null;
            }
            if (object.possessorId !== null && object.possessorId !== holderId
                || object.possessorId === null && object.locationId !== place) return false;
            Object.assign(object, transferPossession(object, { toHolderId: slave.id, toHolderName: slave.name,
                onDay: day, how: 'found', note: 'Fetched at the holder\'s command.', factId: fact.id }));
            const back = delivery ?? fact.locationId;
            if (back && place !== back) {
                const journey = goOnTheOrderedCourse(state, state.npcs[at], back, day, fact.summary);
                state.npcs[at] = journey.activity ? { ...journey, activity: { ...journey.activity, slaveOrderId: fact.id } } : journey;
            }
            return false;
        } else if (order.action === 'message') {
            const recipient = state.npcs.find(person => person.id === order.targetId && person.status === 'alive'
                && routineLocationOf(clock, person) === place);
            if (!recipient) return false;
            rememberFact(state.memories, recipient.id, fact, { kind: 'history', summary: order.words });
        }
    }
    completeSlaveOrderStep(state, fact, day, order.action === 'attack' ? `${slave.name} made the ordered attack. The melee records its outcome.`
        : `${slave.name} carried out ${order.words}`);
    if (!currentSlaveOrder(state, fact) && state.npcs[at]?.activity?.slaveOrderId === fact.id)
        state.npcs[at] = { ...state.npcs[at], activity: { ...state.npcs[at].activity!, slaveOrderId: undefined, untilDay: null } };
    return currentSlaveOrder(state, fact) !== null;
}

/** Compulsion supplies no key and cannot bypass a door or the body's entry bar. */
function goOnTheOrderedCourse(state: WorldState, person: NpcRecord, destinationId: string, day: number, note: string): NpcRecord {
    const entrance = reachThrough(pathTo(state.locations, destinationId), { realmOrdinal: person.cultivation.realmOrdinal,
        onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, person.id) });
    if (entrance.stoppedAt !== null) return { ...person, activity: { kind: 'stationed', note: entrance.reason,
        sinceDay: day, untilDay: null, withIds: [] } };
    return startNpcJourney(state, person, destinationId, day, note);
}

function attackUnderCommand(state: WorldState, slave: NpcRecord, fact: HistoricalFact, order: PersonOrder, day: number): boolean {
    const clock = { ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 };
    const place = order.destinationAreaId && state.locations.find(place => place.id === order.destinationId);
    const areas = place ? theAreasOf(clock, place) : null;
    const defenders = state.npcs.filter(person => person.id !== slave.id && person.id !== fact.data.holderId
        && person.status === 'alive' && isTheWorldsToMove(person)
        && routineLocationOf(clock, person) === order.destinationId
        && (!areas || areas.whereIs.get(person.id) === order.destinationAreaId)
        && (!order.targetId || person.id === order.targetId));
    if (!defenders.length) return false;
    const people = [slave, ...defenders], originals = new Map(people.map(person => [person.id, person]));
    const inputs = people.map(person => combatantOf(person, clock));
    const result = resolveMelee([{ id: slave.id, name: slave.name, members: [inputs[0]],
        intent: { thrown: A_BLOW_MEANT_TO_END_IT, willWithdraw: false } },
        { id: order.destinationId, name: 'Those attacked', members: inputs.slice(1) }], {
        rng: forStream(state.seed, 'slave-ordered-melee', fact.id), ambient: 'normal', turn: 1,
        intent: { thrown: A_BLOW_MEANT_TO_END_IT } });
    writeTheNpcArtsActuallyUsed(state, result.exchanges, fact.id, day);
    const escaped = new Set(whoBurnedATeleportationTalisman({ objects: state.objects, onDay: day,
        aboutToFall: result.combatants.filter(person => person.fate === 'finished' || person.fate === 'body_destroyed')
            .map(person => person.id) }));
    for (const verdict of result.combatants) {
        const attacker = originals.get(verdict.felledBy ?? '') ?? slave;
        const applied = whatTheConfrontationDidToThem(state, { npcId: verdict.id, byId: attacker.id, byName: attacker.name,
            day, wounds: verdict.injuries, outcome: escaped.has(verdict.id) ? 'withdrawal' : OUTCOME_FOR_FATE[verdict.fate], lost: verdict.felledBy !== null,
            finished: verdict.finished && !escaped.has(verdict.id), terms: 'open', witnesses: defenders.length,
            flight: whatTheirFlightsCost(result.exchanges, verdict.id, inputs.find(person => person.id === verdict.id)!.maxHp),
            ...(attacker.id === slave.id ? { commandedBy: { id: String(fact.data.holderId), name: fact.actors[0].name, orderId: fact.id,
                present: playerAtTheContact(state)?.id === fact.data.holderId
                    ? playerAtTheContact(state)!.placeId === order.destinationId
                    : state.npcs.some(person => person.id === fact.data.holderId && isTheWorldsToMove(person)
                        && routineLocationOf(clock, person) === order.destinationId) } } : {}) });
        state.obligations.push(...applied.opens.map(createObligation));
        const at = state.npcs.findIndex(person => person.id === verdict.id), current = state.npcs[at];
        if (current.status === 'alive') state.npcs[at] = { ...current, cultivation: { ...current.cultivation,
            hp: Math.min(bodyStandingOn(current, day), Math.max(1, maxBodyOf(current) * verdict.hp / inputs.find(input => input.id === verdict.id)!.maxHp)),
            bodyOnDay: day } };
        if (attacker.id === slave.id) for (const death of applied.facts) {
            attributeCommand(state, fact, death, originals.get(verdict.id)!, defenders, day);
        }
    }
    for (const exchange of result.exchanges) {
        const weapon = exchange.result.weapon;
        const object = weapon?.broke && state.objects.find(object => object.id === weapon.objectId);
        if (object) aBreakingEntersTheWorld(state, { actor: { id: exchange.attackerId,
            name: originals.get(exchange.attackerId)?.name ?? '', role: 'broke it' }, object, day,
            locationId: order.destinationId, how: `Broken in the ordered fight: ${weapon!.exposure.cause}.` });
    }
    return true;
}

/** The existing witness and deed readers receive the commander's responsibility as well as the hand's. */
function attributeCommand(state: WorldState, order: HistoricalFact, deed: HistoricalFact,
    victim: NpcRecord, witnesses: readonly NpcRecord[], day: number): void {
    const holder = state.npcs.find(person => person.id === order.data.holderId);
    if (!holder) return;
    const party = (person: NpcRecord) => {
        const house = state.factions.find(house => house.id === person.factionId);
        return { id: person.id, name: person.name, houseId: house?.id ?? null, houseName: house?.name ?? null,
            alignment: house?.alignment ?? null, ranked: person.factionRankIndex >= 0 };
    };
    const leaves = whatADeedLeaves({ actor: party(holder), subject: party(victim), principalCannotHoldIt: true,
        deed: { paidBy: 'subject', cause: 'injury', cost: 1, irreversible: true, onDay: day,
            description: `${holder.name} commanded ${deed.summary}`, participants: [String(order.data.slaveId)],
            triggeringEventId: deed.id, knownTo: [victim.id, victim.factionId ?? '', ...deed.witnessIds] } });
    state.obligations.push(...leaves.opens.map(createObligation));
    reactToWitnessedFact(state, deed, { actorId: holder.id, victimId: victim.id, onDay: day,
        witnesses: witnesses.filter(person => state.npcs.find(row => row.id === person.id)?.status === 'alive')
            .map(person => ({ id: person.id, seen: { ...observationOf(deed), sawAct: true, manyHarmed: witnesses.length > 1 } })) });
}
