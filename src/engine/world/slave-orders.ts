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

export interface PersonOrder {
    action: 'attack' | 'guard' | 'fetch' | 'message' | 'travel' | 'company' | 'cultivate' | 'request';
    destinationId: string;
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
    if (isTheWorldsToMove(slave)) {
        const at = state.npcs.findIndex(person => person.id === slave.id);
        const travelling = slave.locationId === order.destinationId ? slave
            : goOnTheOrderedCourse(state, slave, order.destinationId, day, fact.summary);
        state.npcs[at] = travelling.activity ? { ...travelling, activity: { ...travelling.activity, slaveOrderId: fact.id } } : travelling;
    }
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

/** Appointments and foreground contact call this; no daily population walk is added. */
export function settleSlaveOrders(state: WorldState, day: number): void {
    for (const id of new Set(factsWithDataValue(state, 'slaveOrder', true).map(fact => String(fact.data.slaveId)))) {
        const person = state.npcs.find(person => person.id === id && isTheWorldsToMove(person) && person.status === 'alive');
        const seal = person?.cultivation.seal;
        if (person && seal?.kind === 'slave' && seal.liftsOnDay !== null && day >= seal.liftsOnDay)
            releasePersonSeal(state, id, seal.liftsOnDay);
    }
    for (const fact of unfinishedSlaveOrders(state)) {
        const at = state.npcs.findIndex(person => person.id === fact.data.slaveId), slave = state.npcs[at];
        const holderId = String(fact.data.holderId), order = JSON.parse(String(fact.data.order)) as PersonOrder;
        // A SQL person's status and effect are read by the actual-body port, never this projection.
        if (slave && !isTheWorldsToMove(slave)) continue;
        if (!slave || slave.status !== 'alive' || !holdsASlaveSeal(slave.cultivation.seal, holderId, day)) {
            finishOrder(state, fact, day, 'The seal no longer holds. The order no longer compels.'); continue;
        }
        // A real player's next act is handled against their SQL body by the played adapter.
        const place = routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 }, slave);
        const object = order.objectId && state.objects.find(object => object.id === order.objectId);
        const returning = order.action === 'fetch' && object && object.possessorId === slave.id;
        const contact = playerAtTheContact(state);
        const master = contact?.id === holderId ? contact.person : state.npcs.find(person => person.id === holderId && isTheWorldsToMove(person));
        const delivery = contact?.id === holderId ? contact.placeId : master && routineLocationOf({ ...state, currentDay: day }, master);
        const destination = returning ? delivery ?? fact.locationId : order.destinationId;
        if (slave.activity?.departureApproach) continue;
        if (place !== destination) {
            if (!slave.activity || slave.activity.kind !== 'travelling') {
                const current = { ...slave, locationId: place };
                const journey = destination ? goOnTheOrderedCourse(state, current, destination, day, fact.summary) : null;
                if (journey?.activity) state.npcs[at] = { ...journey, activity: { ...journey.activity, slaveOrderId: fact.id } };
            }
            continue;
        }
        if (order.action === 'request') continue; // The actual reached request adapter owns its work receipt.
        // The existing journey projection supplies arrival, including its actual course duration.
        state.npcs[at] = { ...slave, locationId: place, activity: null, updatedOnDay: day };
        if (order.action === 'attack') attackUnderCommand(state, state.npcs[at], fact, order, day);
        else if (order.action === 'guard') state.npcs[at] = { ...state.npcs[at], activity: {
            kind: 'stationed', note: fact.summary, withIds: order.targetId ? [order.targetId] : [],
            sinceDay: day, untilDay: order.days === undefined ? null : day + order.days, slaveOrderId: fact.id } };
        else if (order.action === 'company') {
            const changed = takeThemWithYou(state.npcs, { leaderId: holderId, party: [slave],
                note: fact.summary, onDay: day, untilDay: order.days === undefined ? null : day + order.days });
            for (const person of changed) {
                const index = state.npcs.findIndex(row => row.id === person.id);
                state.npcs[index] = { ...person, activity: { ...person.activity!, slaveOrderId: fact.id } };
            }
        } else if (order.action === 'cultivate') {
            if (!beginClosedDoorCultivation(state, slave.id, day, order.days ?? 1)) continue;
        } else if (order.action === 'fetch') {
            if (!object) continue;
            if (returning) {
                if (!master || delivery !== place) continue;
                Object.assign(object, transferPossession(object, { toHolderId: holderId, toHolderName: master.name,
                    onDay: day, how: 'gifted', factId: fact.id, note: 'Delivered under the slave seal.' }));
                finishOrder(state, fact, day, `${slave.name} delivered ${object.name} to ${master.name}.`);
                continue;
            }
            if (object.possessorId !== null && object.possessorId !== holderId
                || object.possessorId === null && object.locationId !== place) continue;
            Object.assign(object, transferPossession(object, { toHolderId: slave.id, toHolderName: slave.name,
                onDay: day, how: 'found', note: 'Fetched at the holder\'s command.', factId: fact.id }));
            const back = delivery ?? fact.locationId;
            if (back && place !== back) {
                const journey = goOnTheOrderedCourse(state, state.npcs[at], back, day, fact.summary);
                state.npcs[at] = journey.activity ? { ...journey, activity: { ...journey.activity, slaveOrderId: fact.id } } : journey;
            }
            continue;
        } else if (order.action === 'message') {
            const recipient = state.npcs.find(person => person.id === order.targetId && person.status === 'alive'
                && routineLocationOf({ ...state, currentDay: day }, person) === place);
            if (!recipient) continue;
            rememberFact(state.memories, recipient.id, fact, { kind: 'history', summary: order.words });
        }
        finishOrder(state, fact, day, order.action === 'attack' ? `${slave.name} made the ordered attack. The melee records its outcome.`
            : `${slave.name} carried out ${order.words}`);
    }
}

/** Compulsion supplies no key and cannot bypass a door or the body's entry bar. */
function goOnTheOrderedCourse(state: WorldState, person: NpcRecord, destinationId: string, day: number, note: string): NpcRecord {
    const entrance = reachThrough(pathTo(state.locations, destinationId), { realmOrdinal: person.cultivation.realmOrdinal,
        onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, person.id) });
    if (entrance.stoppedAt !== null) return { ...person, activity: { kind: 'stationed', note: entrance.reason,
        sinceDay: day, untilDay: null, withIds: [] } };
    return startNpcJourney(state, person, destinationId, day, note);
}

function attackUnderCommand(state: WorldState, slave: NpcRecord, fact: HistoricalFact, order: PersonOrder, day: number): void {
    const defenders = state.npcs.filter(person => person.id !== slave.id && person.id !== fact.data.holderId
        && person.status === 'alive' && isTheWorldsToMove(person)
        && (order.targetId ? person.id === order.targetId : routineLocationOf({ ...state, currentDay: day }, person) === order.destinationId));
    if (!defenders.length) return;
    const clock = { ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 };
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
