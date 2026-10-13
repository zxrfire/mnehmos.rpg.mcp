/** A hired gatherer spends actual days and draws the same finite ground stock. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import type { ObligationRecord } from '../social/grudges.js';
import type { PrivateWorkBodies, PrivateWorkObjective } from './private-paid-work.js';
import { privateWorkTerms } from './private-paid-work.js';
import { getHerb, isExtinct } from '../../data/cultivation/herbs.js';
import { FORAGE_BASE_DAYS as GATHERING_DAYS } from '../../data/cultivation/herbs.js';
import { takesWithoutEndingTheStand } from '../../data/cultivation/techniques.js';
import { whatGroundThisIs } from './what-ground-a-place-is.js';
import { drawFromTheGround, recordGroundDraw } from './what-a-place-still-has-in-the-ground.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { isStoppedInArea } from './what-is-true-of-a-place-right-now.js';
import { STOPS_GATHERING } from './what-goes-wrong-with-a-place-and-what-ends-it.js';
import { makeObject, transferPossession } from './possessions.js';
import { privatePeopleCanSpeak } from './private-requests.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';

/** Record only herbs the actual gather verb has already harvested, without another ground draw. */
export function recordAnActualPrivateGather(state: WorldState, worker: { id: string; name: string },
    locationId: string | null, herbId: string, quantity: number, day: number): boolean {
    const word = state.obligations.find(word => word.status === 'open' && word.holderId === worker.id
        && word.tags.includes('private-paid-work') && (word.dueOnDay ?? Infinity) >= day);
    const offer = word && state.history.facts.find(fact => fact.id === word.triggeringEventId);
    const terms = offer && privateWorkTerms(offer), herb = getHerb(herbId);
    if (!offer || !herb || terms?.objective.kind !== 'gather' || terms.objective.herbId !== herbId
        || terms.objective.locationId !== locationId || quantity <= 0) return false;
    const id = `private-gather:${offer.id}`, at = state.objects.findIndex(object => object.id === id);
    if (at >= 0) {
        const object = state.objects[at];
        if (object.possessorId !== worker.id) return false;
        if (Number(object.data.quantity) >= terms.objective.quantity) return false;
        state.objects[at] = { ...object, data: { ...object.data,
            quantity: Math.min(terms.objective.quantity, Number(object.data.quantity) + quantity) } };
    } else state.objects.push(transferPossession(makeObject({ id, name: herb.name, kind: 'material',
        significance: 'mundane', locationId, data: { materialId: herbId,
            quantity: Math.min(quantity, terms.objective.quantity), privateGather: offer.id } }), {
        toHolderId: worker.id, toHolderName: worker.name, onDay: day, how: 'found', transfersOwnership: true, factId: offer.id }));
    return true;
}

export function servePrivateGather(state: WorldState, offer: HistoricalFact, term: ObligationRecord,
    objective: Extract<PrivateWorkObjective, { kind: 'gather' }>, worker: NpcRecord, day: number,
    bodies?: PrivateWorkBodies): void {
    const herb = getHerb(objective.herbId), place = state.locations.find(place => place.id === objective.locationId);
    if (!herb || !place || isExtinct(herb.id) || worker.locationId !== place.id
        || herb.harvestOrdinal > worker.cultivation.realmOrdinal
        || !whatGroundThisIs(state, place)?.includes(herb.biome)
        || isStoppedInArea(state.statuses, state.locations, place.id, day, STOPS_GATHERING)
        || reachThrough(pathTo(state.locations, place.id), { realmOrdinal: worker.cultivation.realmOrdinal,
            onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, worker.id) }).stoppedAt !== null) return;
    let started = factsWithDataValue(state, 'privateGatherStarted', offer.id)[0];
    if (!started) {
        const ready = day + GATHERING_DAYS * objective.quantity;
        if (ready > (term.dueOnDay ?? Infinity)) return;
        started = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: place.id,
            actors: [{ id: worker.id, name: worker.name, role: 'gatherer' }], causes: [offer.id],
            summary: `${worker.name} began gathering ${herb.name}.`,
            data: { privateGatherStarted: offer.id, readyOnDay: ready } }), { recur: false, bystanders: false });
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at]!, activity: { ...worker.activity!, untilDay: ready } };
    }
    const ready = Number(started.data.readyOnDay), objectId = `private-gather:${offer.id}`;
    if (day < ready) return;
    let object = state.objects.find(object => object.id === objectId);
    if (!object && !factsWithDataValue(state, 'privateGatherResolved', offer.id).length) {
        const draw = drawFromTheGround(place, { kind: 'herb', grade: herb.grade, wanted: objective.quantity,
            onDay: ready, takenByTheSchool: takesWithoutEndingTheStand({ knownTechniqueIds: worker.cultivation.techniqueIds }) });
        recordGroundDraw(place, draw);
        appendWorldFact(state, makeFact({ day: ready, kind: 'opportunity', visibility: 'secret', locationId: place.id,
            actors: [{ id: worker.id, name: worker.name, role: 'gatherer' }], causes: [offer.id],
            summary: `${worker.name} gathered ${draw.taken} ${herb.name}.`,
            data: { privateGatherResolved: offer.id, quantity: draw.taken } }), { recur: false, bystanders: false });
        if (draw.taken > 0) {
            object = transferPossession(makeObject({ id: objectId, name: herb.name, kind: 'material',
                significance: 'mundane', locationId: place.id, tags: [`grade:${herb.grade}`],
                data: { materialId: herb.id, quantity: draw.taken, privateGather: offer.id } }),
                { toHolderId: worker.id, toHolderName: worker.name, onDay: ready, how: 'found', transfersOwnership: true, factId: offer.id });
            state.objects.push(object);
        }
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at]!, activity: { ...state.npcs[at]!.activity!, untilDay: term.dueOnDay } };
    }
    const recipient = bodies?.person(objective.recipientId) ?? state.npcs.find(person => person.id === objective.recipientId);
    if (!object || object.possessorId !== worker.id || !recipient
        || !(bodies?.canSpeak(worker, recipient, day) ?? privatePeopleCanSpeak(state, worker, recipient, day))) return;
    if (bodies?.deliverMaterial) { bodies.deliverMaterial(object.id, recipient.id, day, offer.id); return; }
    state.objects[state.objects.findIndex(row => row.id === object!.id)] = transferPossession(object,
        { toHolderId: recipient.id, toHolderName: recipient.name, onDay: day, how: 'gifted', transfersOwnership: true, factId: offer.id });
}
