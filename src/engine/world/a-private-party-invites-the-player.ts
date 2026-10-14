/** A private plan asks the human before admitting their body to its quote. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { isTheWorldsToMove } from './npc-state.js';
import { playerAtTheContact } from './background-incident-draw.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { LEVERAGE_ATTEMPT_CONSTANTS } from '../social-leverage/an-attempt-to-move-somebody.js';
import { undertakePrivateVenture, freeForPrivateBusiness } from './private-ventures.js';
import { formPrivateParty } from './close-people-go-together.js';
import { capitalCalendar } from './capital-missions-and-calendar.js';

export function invitePlayerToPrivateParty(state: WorldState, leader: NpcRecord, playerId: string,
    destinationId: string, day: number, kind: 'elder' | 'equals' | 'hunt', members: readonly string[] = [],
    auctionOnDay?: number, onDue?: (id: string, day: number) => void, preparationDays = 0) {
    const player = state.npcs.find(person => person.id === playerId);
    const contact = playerAtTheContact(state);
    if (!player || isTheWorldsToMove(player) || player.status !== 'alive' || leader.status !== 'alive'
        || contact?.id !== playerId || contact.placeId !== leader.locationId) return null;
    const existing = factsWithDataValue(state, 'privatePartyInvitation', true).find(fact =>
        fact.data.leaderId === leader.id && fact.actors.some(actor => actor.id === playerId)
        && Number(fact.data.respondByDay) > day
        && !state.history.facts.some(reply => reply.data.privatePartyReply === fact.id || reply.data.privatePartyDeparture === fact.id));
    if (existing) return existing;
    const place = state.locations.find(place => place.id === destinationId);
    if (!place) return null;
    const here = state.locations.find(place => place.id === contact.placeId);
    if (!here || theAreasOf(state, here, undefined, { id: player.id, sectId: player.factionId,
        standingIn: contact.areaId }).whereIs.get(leader.id) !== contact.areaId) return null;
    const respondByDay = day + preparationDays + LEVERAGE_ATTEMPT_CONSTANTS.ASK_DAYS.a_real_favour;
    const offered = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
        locationId: leader.locationId, actors: [{ id: leader.id, name: leader.name, role: 'invited' },
            { id: player.id, name: player.name, role: 'asked' }],
        summary: `${leader.name} invites ${player.name} to ${place.name}${kind === 'elder' ? ' to broaden their horizons' : ' in a private party'}.`,
        data: { privatePartyInvitation: true, leaderId: leader.id, destinationId, partyKind: kind,
            respondByDay, preparationDays, memberIds: JSON.stringify(members), auctionOnDay: auctionOnDay ?? null } }), { recur: false, bystanders: false });
    onDue?.(leader.id, respondByDay);
    return offered;
}

/** The ordinary discussion window ends; silence cannot hold somebody's private life forever. */
export function departAfterPrivateInvitations(state: WorldState, day: number,
    onDue?: (id: string, day: number) => void): void {
    for (const offer of factsWithDataValue(state, 'privatePartyInvitation', true)) {
        if (typeof offer.data.respondByDay !== 'number' || !Number.isFinite(offer.data.respondByDay)
            || offer.data.respondByDay > day || state.history.facts.some(fact =>
            fact.data.privatePartyDeparture === offer.id || fact.data.privatePartyReply === offer.id && fact.data.accepted === true)) continue;
        const leader = state.npcs.find(person => person.id === offer.data.leaderId);
        const venue = state.locations.find(place => place.id === offer.data.destinationId);
        const members = JSON.parse(String(offer.data.memberIds)) as string[];
        const auction = typeof offer.data.auctionOnDay === 'number' ? capitalCalendar(state, Math.floor(offer.data.auctionOnDay / 365))
            .find(occasion => occasion.onDay === offer.data.auctionOnDay && occasion.venueId === venue?.id) : undefined;
        const trip = leader && venue && freeForPrivateBusiness(leader, day)
            ? offer.data.partyKind === 'elder' ? undertakePrivateVenture(state, leader.id, venue,
                state.npcs.filter(person => members.includes(person.id) && freeForPrivateBusiness(person, day)), day, auction, onDue, true)
                : formPrivateParty(state, leader.id, venue, members, day, onDue, offer.data.partyKind === 'hunt' ? 'hunt' : 'journey')
            : null;
        appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: leader?.locationId ?? null,
            causes: [offer.id, ...(trip ? [trip.id] : [])], actors: leader ? [{ id: leader.id, name: leader.name, role: 'decided' }] : [],
            summary: trip ? 'The private journey left without the unanswered invitee.' : 'The unanswered private invitation ended; no journey began.',
            data: { privatePartyDeparture: offer.id, itineraryFactId: trip?.id ?? null } }), { recur: false, bystanders: false });
    }
}
