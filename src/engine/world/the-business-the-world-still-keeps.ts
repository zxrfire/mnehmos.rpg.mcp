/** Completed background business keeps visits and live evidence, not every docket. */
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { isPlayerInvolved } from './background-incident-draw.js';
import { isTheWorldsToMove } from './npc-state.js';
import { howAGradeIsStored, isRuined } from './possessions.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { noteLedgerPruned } from './a-fact-that-keeps-happening-is-one-row.js';
import { factsWithData, factsWithDataValue, referenceKeys, witnessHistoryWasPruned, witnessIndexFor } from './witness-reaction-index.js';
import type { HistoricalFact } from './history.js';
import type { WorldState } from './world-state.js';
import { missingMembersInRollCheck } from './life-lamp-roll-check-findings.js';

const SWEPT = new WeakMap<WorldState, number>();
const routinePassageLoss = (fact: HistoricalFact): boolean => fact.data.missedDeparture === true
    || fact.data.unusedPassageTally === true;
const routine = (fact: HistoricalFact): boolean => {
    const data = fact.data;
    return !('deedWeight' in data) && (data.publicMission === true || data.exchangeConsignment === true
        || data.exchangeReturn === true || data.exchangeSale === true || data.exchangeHandover === true
        || data.auctionLot === true || data.auctionBid === true || data.auctionResult === true
        || data.capitalCompetition === true || data.capitalOccasion === true
        || data.houseProgress === true || typeof data.houseBusiness === 'string'
        // A board's entries and its non-winning placings are paperwork once it is decided; who won is
        // history and stays. Arrivals, reliefs, passages, receipts and delivered tribute are dockets.
        || (data.openCompetition === true && (data.entry === true || (data.result === true && data.place !== 1)))
        || data.actualBodyArrival === true || data.postRelief === true || data.postServiceReceipt === true || data.houseHallService === true
        || data.publicPassage === true || data.capitalMission === true || data.tributeReceived === true
        // A gate entry is a docket; a year's registration has run out by the time it is a year old.
        || data.houseClinicalCare === true || typeof data.houseClinicalCareEnded === 'string' || typeof data.housePersonnelReview === 'string' || data.gateRegistration === true || data.passageTallyPurchase === true
        || data.missedDeparture === true || data.unusedPassageTally === true);
};

/**
 * Mundane events a world forgets once nobody alive took part in or saw them, and nothing in the world
 * still points at them (owner, 2026-10-09). Consequential kinds (deaths, wars, inheritances, marriages,
 * finds, forbidden ground, grudges, prices) are not on this list: they leave evidence and causes.
 */
const MUNDANE = new Set<HistoricalFact['kind']>(['said_in_public', 'opportunity', 'grant_renewed', 'spirit_tide', 'gave_up_waiting', 'promotion']);

/** The yearly boundary shares the dead-row sweep's index and reference hooks. */
export function keepTheBusinessStillOnTheBooks(state: WorldState): void {
    const year = Math.floor(state.currentDay / DAYS_PER_YEAR);
    if (SWEPT.get(state) === year) return;
    SWEPT.set(state, year);
    // A settled docket is paperwork after a year. Anything still in play is held below by what points
    // at it (an activity, an obligation, an open lot, a schedule entry), whatever its age.
    const cutoff = state.currentDay - DAYS_PER_YEAR;
    const index = witnessIndexFor(state);
    if (!['publicMission', 'exchangeConsignment', 'exchangeReturn', 'exchangeSale', 'exchangeHandover',
        'auctionLot', 'auctionBid', 'auctionResult', 'capitalCompetition', 'capitalOccasion',
        'houseProgress', 'houseBusiness', 'openCompetition', 'actualBodyArrival', 'postRelief',
        'postServiceReceipt', 'houseHallService', 'publicPassage', 'capitalMission', 'tributeReceived', 'gateRegistration',
        'passageTallyPurchase', 'missedDeparture', 'unusedPassageTally', 'housePersonnelReview', 'houseClinicalCare', 'houseClinicalCareEnded'].some(key => factsWithData(state, key).some(fact => fact.day <= cutoff))
        && ![...MUNDANE].some(kind => (index.byKind.get(kind) ?? [])
            .some(fact => fact.day <= cutoff))) return;
    const exact = new Set(state.npcs.filter(person => isPlayerInvolved(state, person)).map(person => person.id));
    const alive = new Set(state.npcs.filter(person => person.status === 'alive').map(person => person.id));
    // Forgotten: a mundane event nobody alive took part in or witnessed.
    const forgotten = (fact: HistoricalFact): boolean => MUNDANE.has(fact.kind)
        && !(fact.data.lampRollCheck === true && missingMembersInRollCheck(fact).length > 0)
        && fact.actors.every(actor => !alive.has(actor.id)) && fact.witnessIds.every(id => !alive.has(id));
    const disposable = (fact: HistoricalFact): boolean => routine(fact) || forgotten(fact);
    const players = new Set(state.npcs.filter(person => !isTheWorldsToMove(person)).map(person => person.id));
    const foregroundKeeps = (fact: HistoricalFact): boolean => !routinePassageLoss(fact)
        && (fact.actors.some(actor => exact.has(actor.id)) || fact.witnessIds.some(id => players.has(id)));
    const held = new Set<string>();
    const objectIds = new Set(state.objects.map(object => object.id));
    const protectedObjects = new Set<string>();
    const hold = (value: unknown, keepMissedDeparture = true): void => {
        if (typeof value === 'string') {
            const fact = index.byId.get(value);
            if (fact && (keepMissedDeparture || !routinePassageLoss(fact))) held.add(value);
            if (objectIds.has(value)) protectedObjects.add(value);
        }
        else if (Array.isArray(value)) for (const part of value) hold(part, keepMissedDeparture);
        else if (value && typeof value === 'object') for (const part of Object.values(value)) hold(part, keepMissedDeparture);
    };
    for (const person of state.npcs) {
        hold(person.activity);
        if (exact.has(person.id)) { hold(person.historyFactIds, false); hold(person.relationships); }
        hold(person.goals);
    }
    for (const obligation of state.obligations) hold(obligation, obligation.status === 'open');
    hold(state.memories.records);
    hold(state.schedule);
    hold(state.opportunities);
    hold(state.runs);
    hold(state.lineages);
    hold(state.absences);
    hold(state.statuses);
    hold(state.ascensions);
    for (const place of state.locations) { hold(place.data); hold(place.changes); }
    for (const lot of index.openAuctionLots) held.add(lot.id);

    for (const fact of state.history.facts) if (!disposable(fact) || fact.day > cutoff || foregroundKeeps(fact)) {
        for (const value of Object.values(fact.data)) if (typeof value === 'string') protectedObjects.add(value);
    }
    const stacks = new Map<string, number>();
    const aliases = new Map<string, string>();
    const objects: WorldState['objects'] = [];
    let shortened = false;
    for (const object of state.objects) {
        const thing = whatThisThingIs(object);
        const counted = thing && (object.kind === 'pill' || object.kind === 'material')
            && howAGradeIsStored(thing.grade) === 'counted' && !isRuined(object)
            && object.claims.length === 0 && !object.provenance.some(link => link.how === 'inherited' || link.how === 'stolen')
            && !exact.has(object.ownerId ?? '') && !exact.has(object.possessorId ?? '')
            && !object.knownOwnershipBy.some(id => players.has(id));
        if (!counted) { hold(object); objects.push(object); continue; }
        const countedRow = object.provenance.length > 1 ? { ...object, provenance: object.provenance.slice(-1) } : object;
        if (countedRow !== object) shortened = true;
        if (protectedObjects.has(object.id)) { hold(countedRow); objects.push(countedRow); continue; }
        const key = JSON.stringify([object.kind, thing.kindId, thing.grade, object.ownerId,
            object.possessorId, object.locationId, [...object.tags].sort(),
            Object.entries(object.data).filter(([key]) => key !== 'quantity' && key !== 'stintDay')
                .sort(([a], [b]) => a.localeCompare(b))]);
        const previous = stacks.get(key);
        if (previous === undefined) {
            stacks.set(key, objects.length);
            const row = countedRow;
            objects.push(row); hold(row.provenance);
        } else {
            const row = objects[previous]!;
            objects[previous] = { ...row, data: { ...row.data,
                quantity: whatThisThingIs(row)!.quantity + thing.quantity } };
            aliases.set(object.id, row.id);
        }
    }
    if (aliases.size || shortened) state.objects = objects;

    const previous = state.history.facts;
    const candidates = new Set<string>();
    const visited = new Set<string>();
    // A visit is evidence kept for the foreground, the people a card is built for, as with every other
    // exact record. A background person's routine is read off their role and activity when they are
    // met. Keeping the last routine visit of everybody grew the ledger by ~20,000 facts a century.
    const living = exact;
    for (let at = previous.length - 1; at >= 0; at--) {
        const fact = previous[at]!;
        if (!disposable(fact) || fact.day > cutoff || foregroundKeeps(fact)) { held.add(fact.id); continue; }
        let visit = false;
        if (!routinePassageLoss(fact) && (fact.locationId || fact.factionIds.length)) for (const id of new Set([
            ...fact.actors.map(actor => actor.id), ...fact.witnessIds
        ])) {
            if (!living.has(id)) continue;
            const key = `${id}\u001f${fact.locationId ?? ''}\u001f${fact.factionIds.join('|')}`;
            if (!visited.has(key)) { visited.add(key); visit = true; }
        }
        if (visit) held.add(fact.id); else candidates.add(fact.id);
    }
    // A surviving receipt retains its actual causal evidence, including old dockets.
    const pending = [...held];
    for (let at = 0; at < pending.length; at++) {
        const fact = index.byId.get(pending[at]!);
        if (!fact) continue;
        // A retained consignment keeps its closing receipt; dropping only the receipt reopens it.
        const closingReceipts = index.auctionResults.get(fact.id) ?? [];
        // A live prepaid account keeps the receipts which say how much it has spent.
        const fareReceipts=fact.data.publicMission===true&&typeof fact.data.publicFareStones==='number'
            ?factsWithDataValue(state,'publicFareFundingId',fact.id).map(receipt=>receipt.id):[];
        for (const id of [...referenceKeys(fact), ...closingReceipts, ...fareReceipts]) if (index.byId.has(id) && !held.has(id)) {
            held.add(id); pending.push(id);
        }
    }
    for (const id of held) candidates.delete(id);
    const replacements = new Map<string, HistoricalFact>();
    const facts: HistoricalFact[] = [];
    for (const fact of previous) {
        if (candidates.has(fact.id)) continue;
        let data = fact.data;
        for (const [key, value] of Object.entries(data)) if (typeof value === 'string' && aliases.has(value)) {
            if (data === fact.data) data = { ...data };
            data[key] = aliases.get(value)!;
        }
        if (data !== fact.data) { const row = { ...fact, data }; replacements.set(row.id, row); facts.push(row); }
        else facts.push(fact);
    }
    if (!candidates.size && !replacements.size) return;
    state.history.facts = facts;
    noteLedgerPruned(state.history, previous, candidates, replacements, index.order);
    witnessHistoryWasPruned(state, previous, candidates, replacements);
    state.npcs = state.npcs.map(person => {
        if (person.historyFactIds.every(id => !candidates.has(id))
            && person.relationships.every(tie => tie.factIds.every(id => !candidates.has(id)))) return person;
        return { ...person, historyFactIds: person.historyFactIds.filter(id => !candidates.has(id)),
            relationships: person.relationships.map(tie => tie.factIds.some(id => candidates.has(id))
                ? { ...tie, factIds: tie.factIds.filter(id => !candidates.has(id)) } : tie) };
    });
}
