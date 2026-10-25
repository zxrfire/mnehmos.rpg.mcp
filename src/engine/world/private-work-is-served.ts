/** A private word reaches physical work through the ordinary route, access and possession readers. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { isTheWorldsToMove } from './npc-state.js';
import { privatePeopleCanSpeak } from './private-requests.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';
import { sendHouseMission } from './capital-missions-and-calendar.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from './what-one-of-the-worlds-own-people-knows.js';
import { isAtLeast } from '../social/discovery.js';
import { whatABodyCanCarry } from './what-a-body-can-carry-and-what-a-ring-holds.js';
import { whatTheirThingsTake, whereItWouldGo, howManyHeld } from './what-somebody-is-carrying-takes.js';
import { hadAs, isRuined, transferPossession } from './possessions.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { ObligationRecord } from '../social/grudges.js';
import type { PrivateWorkBodies, PrivateWorkTerms } from './private-paid-work.js';
import { beginActualDepartureApproach, finishActualDepartureApproach } from './departure-approach.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { routineLocationOf } from './npc-routines.js';
import { servePrivateCraft } from './private-work-at-a-bench.js';
import { servePrivateRefinement } from './private-work-at-a-cauldron.js';
import { servePrivateGather } from './private-work-in-the-field.js';
import { FORAGE_BASE_DAYS as GATHERING_DAYS } from '../../data/cultivation/herbs.js';
import { startPrivateRoadProtection } from './a-private-road-guard-joins-the-actual-party.js';

export function doingPrivateWork(state: WorldState, worker: NpcRecord, termId: string): boolean {
    return worker.activity?.privateWorkId === termId || worker.activity?.passageCompany?.privateWorkId === termId
        || !!worker.activity?.capitalMissionId
        && witnessIndexFor(state).byId.get(worker.activity.capitalMissionId)?.data.privateWorkId === termId;
}

export function servePrivateWork(state: WorldState, offer: HistoricalFact, term: ObligationRecord,
    terms: PrivateWorkTerms, day: number, bodies?: PrivateWorkBodies): void {
    let worker = state.npcs.find(person => person.id === term.holderId);
    if (!worker || !isTheWorldsToMove(worker) || worker.status !== 'alive' || !doingPrivateWork(state, worker, term.id)
        || day < worker.activity!.sinceDay || terms.objective.kind === 'watch') return;
    if (!worker.activity?.capitalMissionId && worker.activity?.untilDay != null && worker.activity.untilDay <= day) {
        worker = { ...worker, activity: { ...worker.activity, untilDay: terms.dueOnDay } };
        state.npcs[state.npcs.findIndex(person => person.id === worker!.id)] = worker;
    }
    if (terms.objective.kind === 'craft') {
        servePrivateCraft(state, offer, term, terms.objective, worker, day, bodies); return;
    }
    if (terms.objective.kind === 'refine') {
        servePrivateRefinement(state, offer, term, terms.objective, worker, day, bodies); return;
    }
    if (worker.activity?.kind === 'travelling' && worker.activity.untilDay != null && day < worker.activity.untilDay) return;
    if (worker.activity?.capitalMissionId === offer.id && worker.activity.departureApproach) {
        const intention = worker.activity.departureApproach;
        const clock = { ...state, currentDay: day, currentHour: (day % 1) * 24 };
        const arrival = finishActualDepartureApproach(clock, worker.id, { intentId: offer.id,
            target: { locationId: intention.locationId, areaId: intention.areaId } }, day);
        if (arrival.kind !== 'ready') return;
        worker = { ...arrival.actor, activity: { kind: 'their_own_business', privateWorkId: term.id,
            standingIn: arrival.areaId, note: terms.description, withIds: [], sinceDay: day, untilDay: terms.dueOnDay } };
        state.npcs[state.npcs.findIndex(person => person.id === worker!.id)] = worker;
    }
    const objective = terms.objective;
    const person = (id: string) => bodies?.person(id) ?? state.npcs.find(row => row.id === id && isTheWorldsToMove(row));
    const speak = (other: NpcRecord) => bodies?.canSpeak(worker!, other, day) ?? privatePeopleCanSpeak(state, worker!, other, day);
    const approach = (other: NpcRecord): void => {
        if (worker!.activity?.capitalMissionId) return;
        const clock = { ...state, currentDay: day, currentHour: (day % 1) * 24 };
        const placeId = routineLocationOf(clock, other), place = state.locations.find(place => place.id === placeId);
        if (!place || routineLocationOf(clock, worker!) !== place.id) return;
        const area = isTheWorldsToMove(other) ? theAreasOf(clock, place).whereIs.get(other.id) : other.activity?.standingIn;
        if (!area) return;
        const walking = beginActualDepartureApproach(clock, worker!.id, { intentId: offer.id,
            target: { locationId: place.id, areaId: area } }, day);
        if (walking.kind !== 'approaching') return;
        worker = { ...walking.actor, activity: {
            ...walking.actor.activity!, privateWorkId: term.id, departureApproach: { locationId: place.id,
                areaId: area, destinationId: place.id, purpose: 'private work' } } };
        state.npcs[state.npcs.findIndex(person => person.id === worker!.id)] = worker;
    };
    let destination: string | null = null;
    if (objective.kind === 'escort') {
        if (objective.destinationId) {
            startPrivateRoadProtection(state, offer, term, terms, day, bodies); return;
        }
        if (factsWithDataValue(state, 'privateEscortStarted', offer.id).length) return;
        const protectedPerson = person(objective.personId);
        if (!protectedPerson) return;
        if (!speak(protectedPerson)) { approach(protectedPerson); return; }
        if (day + objective.days > terms.dueOnDay) return;
        const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
        const place = state.locations.find(place => place.id === routineLocationOf(clock, protectedPerson));
        if (!place) return;
        const area = isTheWorldsToMove(protectedPerson) ? theAreasOf(clock, place).whereIs.get(protectedPerson.id)
            : protectedPerson.activity?.standingIn;
        state.npcs[state.npcs.findIndex(person => person.id === worker!.id)] = { ...worker,
            activity: { kind: 'out_with_a_party', privateWorkId: term.id, withIds: [protectedPerson.id],
                sinceDay: day, untilDay: day + objective.days, returnTo: worker.locationId,
                standingIn: area, note: `Accompanying ${protectedPerson.name} on the road.` } };
        appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: place.id,
            actors: [{ id: worker.id, name: worker.name, role: 'guard' },
                { id: protectedPerson.id, name: protectedPerson.name, role: 'protected' }], causes: [offer.id],
            summary: `${worker.name} began accompanying ${protectedPerson.name} on the road.`,
            data: { privateEscortStarted: offer.id, endsOnDay: day + objective.days } }), { recur: false, bystanders: false });
        return;
    }
    if (objective.kind === 'find') {
        const target = person(objective.personId);
        if (target && speak(target)) {
            if (![...witnessIndexFor(state).references.get(offer.id) ?? []].some(fact => fact.data.privateWorkMeeting === offer.id))
                appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'secret', locationId: worker.locationId,
                    actors: [{ id: worker.id, name: worker.name, role: 'finder' }, { id: target.id, name: target.name, role: 'found' }],
                    causes: [offer.id], summary: `${worker.name} found ${target.name} in person.`,
                    data: { privateWorkMeeting: offer.id } }), { recur: false, bystanders: false });
            return;
        }
        if (target) approach(target);
        // The employer supplies an address, never the target's hidden live position.
        destination = objective.searchAt ?? null;
    } else if (objective.kind === 'gather') {
        if (worker.locationId === objective.locationId) {
            servePrivateGather(state, offer, term, objective, worker, day, bodies); return;
        }
        destination = objective.locationId;
    } else {
        const at = state.objects.findIndex(object => object.id === objective.objectId);
        const object = state.objects[at], recipient = person(objective.recipientId);
        if (!object || isRuined(object)) return;
        if (object.possessorId !== worker.id) {
            const employer = person(term.subjectId ?? '');
            const lent = employer && objective.recipientId !== employer.id && object.ownerId === employer.id
                && object.possessorId === employer.id && speak(employer);
            const abandoned = object.possessorId === null && object.ownerId === null && object.locationId === worker.locationId
                && typeof object.data.chamberId !== 'string';
            if (lent || abandoned) {
                const access = reachThrough(pathTo(state.locations, worker.locationId!), { realmOrdinal: worker.cultivation.realmOrdinal,
                    onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, worker.id) });
                const packing = whereItWouldGo(whatTheirThingsTake(state.objects, worker.id), object,
                    whatABodyCanCarry(worker.cultivation.realmOrdinal), howManyHeld(state.objects, worker.id));
                if (access.stoppedAt !== null || packing === 'too_heavy' || packing === 'hands_full') return;
                state.objects[at] = transferPossession(object, { onDay: day, toHolderId: worker.id, toHolderName: worker.name,
                    how: lent ? 'lent' : 'found', transfersOwnership: !lent, source: employer?.name ?? '', factId: offer.id });
                if (packing === 'held') state.objects[at] = hadAs(state.objects[at]!, 'held');
            } else destination = objective.collectAt ?? null;
        }
        if (state.objects[at]!.possessorId === worker.id) {
            if (recipient && speak(recipient)) {
                state.objects[at] = transferPossession(state.objects[at]!, { onDay: day, toHolderId: recipient.id,
                    toHolderName: recipient.name, how: 'gifted', transfersOwnership: true, factId: offer.id });
                return;
            }
            if (recipient) approach(recipient);
            destination = objective.deliverAt ?? (objective.recipientId === term.subjectId ? offer.locationId : null);
        }
    }
    if (!destination || worker.activity?.capitalMissionId || worker.locationId === destination) return;
    const venue = state.locations.find(place => place.id === destination);
    if (!venue) return;
    const known = whatOneOfTheWorldsOwnPeopleKnows({ ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 });
    if (!isAtLeast(known(worker.id, 'place', destination), 'placed')) return;
    // On-site work retains its existing quarter day; the approach is priced separately.
    const workDays = objective.kind === 'gather' ? objective.quantity * GATHERING_DAYS : 0.25;
    sendHouseMission(state, null, venue, [worker], 'private paid work', day, { days: workDays, returnByDay: terms.dueOnDay },
        undefined, undefined, undefined, { privateWorkId: term.id, leaderId: worker.id,
            privateVenture: venue.kind === 'ruin' || venue.kind === 'forbidden_zone',
            privateReasonId: venue.kind === 'forbidden_zone' ? 'sending-to-the-edge-of-forbidden-ground' : 'sending-to-open-an-inheritance',
            pitchOrdinal: venue.thresholds.operational, dutyDays: 0.25 }, worker);
}
