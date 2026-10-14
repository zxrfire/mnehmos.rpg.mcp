/** A paid road guard joins real company and its admitted course, never a stationary label. */
import type { WorldState } from './world-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { ObligationRecord } from '../social/grudges.js';
import type { PrivateWorkBodies, PrivateWorkTerms } from './private-paid-work.js';
import { sendHouseMission } from './capital-missions-and-calendar.js';
import { isTheWorldsToMove } from './npc-state.js';
import { freeForPrivateBusiness } from './private-ventures.js';
import { putPrivateRequest, privatePeopleCanSpeak } from './private-requests.js';
import { factsWithDataValue } from './witness-reaction-index.js';

export function startPrivateRoadProtection(state: WorldState, offer: HistoricalFact, term: ObligationRecord,
    terms: PrivateWorkTerms, day: number, bodies?: PrivateWorkBodies) {
    const objective = terms.objective;
    if (objective.kind !== 'escort') return null;
    const existing = factsWithDataValue(state, 'privateEscortStarted', offer.id)[0];
    if (existing) return existing;
    const person = (id: string) => bodies?.person(id) ?? state.npcs.find(row => row.id === id);
    const worker = person(term.holderId), protectedPerson = person(objective.personId), employer = person(term.subjectId ?? '');
    if (!worker || !protectedPerson || !employer || worker.status !== 'alive' || protectedPerson.status !== 'alive'
        || !freeForPrivateBusiness(protectedPerson, day) && isTheWorldsToMove(protectedPerson)
        || !(bodies?.canSpeak(worker, protectedPerson, day) ?? privatePeopleCanSpeak(state, worker, protectedPerson, day))) return null;
    let itineraryId: string | null = null;
    if (isTheWorldsToMove(protectedPerson) && objective.destinationId) {
        const destination = state.locations.find(place => place.id === objective.destinationId);
        if (!destination) return null;
        const before = state.history.facts.length;
        if (employer.id !== protectedPerson.id && !putPrivateRequest(state, employer, protectedPerson, day,
            `${employer.name} asked ${protectedPerson.name} to take the guarded road to ${destination.name}.`,
            'private-protected-road', 'a_real_favour', (actor, subject, at) => bodies?.canSpeak(actor, subject, at)
                ?? privatePeopleCanSpeak(state, actor, subject, at), bodies?.localExchangeDays)) return null;
        const attention = state.history.facts.slice(before).reduce((sum, fact) => sum + Number(fact.data.attentionDays ?? 0), 0);
        const party = [state.npcs.find(row => row.id === protectedPerson.id)!, state.npcs.find(row => row.id === worker.id)!];
        const itinerary = sendHouseMission(state, null, destination, party, 'a guarded private journey', day + attention,
            { days: 0, returnByDay: terms.dueOnDay }, undefined, undefined, undefined,
            { leaderId: protectedPerson.id, privateWorkId: term.id, privateEscortOffer: offer.id, publicOneWay: true }, employer,
            bodies?.spendJourneyFare);
        if (!itinerary) return null;
        itineraryId = itinerary.id;
    } else {
        const at = state.npcs.findIndex(row => row.id === worker.id);
        if (at < 0) return null;
        state.npcs[at] = { ...state.npcs[at], activity: { kind: 'out_with_a_party', privateWorkId: term.id,
            withIds: [protectedPerson.id], sinceDay: day, untilDay: terms.dueOnDay,
            returnTo: worker.locationId, standingIn: protectedPerson.activity?.standingIn,
            note: `Guarding ${protectedPerson.name} on their actual road.` } };
    }
    return appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
        actors: [{ id: worker.id, name: worker.name, role: 'guard' },
            { id: protectedPerson.id, name: protectedPerson.name, role: 'protected' }], causes: [offer.id],
        summary: `${worker.name} began guarding ${protectedPerson.name} on the actual road.`,
        data: { privateEscortStarted: offer.id, itineraryFactId: itineraryId, endsOnDay: day + objective.days } }),
        { recur: false, bystanders: false });
}
