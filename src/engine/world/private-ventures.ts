/** People's own purse buys an actual journey, without a house notice or merit. */
import { forStream } from '../cultivation/rng.js';
import { isElderRank } from '../cultivation/leadership.js';
import { drawBackgroundIncidents, isPlayerInvolved, playerAtTheContact } from './background-incident-draw.js';
import { invitePlayerToPrivateParty } from './a-private-party-invites-the-player.js';
import { capitalCalendar, sendHouseMission, type CapitalOccasion } from './capital-missions-and-calendar.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheyHold } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from './what-one-of-the-worlds-own-people-knows.js';
import { isAtLeast } from '../social/discovery.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import { getSendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { putPrivateRequest } from './private-requests.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';

const RUIN_REASON = 'sending-to-open-an-inheritance';
const FORBIDDEN_REASON = 'sending-to-the-edge-of-forbidden-ground';

export function freeForPrivateBusiness(person: NpcRecord, day: number): boolean {
    return person.status === 'alive' && isTheWorldsToMove(person)
        && !isAwayOnSomething(person.activity?.kind ?? 'idle')
        && !(person.activity?.untilDay != null && person.activity.untilDay > day)
        && !person.activity?.withIds.length;
}

/** No title is inferred: the ordinary posting deal identifies the spare elders. */
export function eldersWithoutOffices(state: WorldState, day: number): NpcRecord[] {
    const out: NpcRecord[] = [];
    for (const house of state.factions.filter(row => row.dissolvedOnDay === null)) {
        const roll = state.npcs.filter(person => person.factionId === house.id && person.status === 'alive');
        const offices = portfoliosIn({ locations: state.locations, sectId: house.id,
            roll: roll.map(person => ({ id: person.id, rankIndex: person.factionRankIndex })), rankCount: house.ranks.length });
        out.push(...roll.filter(person => isElderRank(person.factionRankIndex, house.ranks.length)
            && freeForPrivateBusiness(person, day) && !whatTheyHold(offices, person.id).length));
    }
    return out;
}

/** The native itinerary charges this person; no treasury is substituted. */
export function undertakePrivateVenture(state: WorldState, leaderId: string, venue: LocationRecord,
    members: readonly NpcRecord[], day: number, auction?: CapitalOccasion,
    onDue?: (id: string, day: number) => void, elderExpedition?: boolean,
    acceptedPlayers: ReadonlySet<string> = new Set()) {
    const leader = state.npcs.find(person => person.id === leaderId);
    const currentMembers = members.map(person => state.npcs.find(row => row.id === person.id));
    if (new Set(members.map(person => person.id)).size !== members.length || !leader || !freeForPrivateBusiness(leader, day)
        || currentMembers.some(person => !person || !(freeForPrivateBusiness(person, day)
            || !isTheWorldsToMove(person) && acceptedPlayers.has(person.id) && person.status === 'alive')
        || (isTheWorldsToMove(person) ? person.locationId : playerAtTheContact(state)?.placeId) !== leader.locationId
        || person.id === leader.id)) return null;
    const party = [leader, ...currentMembers as NpcRecord[]];
    if (!auction) for (const member of party) {
        const entrance = reachThrough(pathTo(state.locations, venue.id), { realmOrdinal: member.cultivation.realmOrdinal,
            onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, member.id) });
        if (entrance.stoppedAt !== null) return null;
    }
    const reason = getSendingReason(venue.kind === 'forbidden_zone' ? FORBIDDEN_REASON : RUIN_REASON)!;
    return sendHouseMission(state, null, venue, party, auction ? 'a private auction visit' : 'a private expedition', day,
        auction ? { untilDay: auction.endsOnDay + 1, eventDay: auction.onDay } : { days: reason.days },
        onDue, undefined, undefined, { privateVenture: !auction, privateReasonId: reason.id,
            leaderId: leader.id, privateElderExpedition: elderExpedition
                ?? currentMembers.some(person => person!.relationships.some(tie => tie.targetId === leader.id && tie.kind === 'master')),
            pitchOrdinal: venue.thresholds.operational, dutyDays: reason.days }, leader);
}

/** Available elders choose known ground and their own actual calendar; distant starts are bounded. */
export function privateVenturesThisYear(state: WorldState, year: number, day: number,
    onDue?: (id: string, day: number) => void): string[] {
    const pool = eldersWithoutOffices(state, day);
    const chosen = [...pool.filter(person => isPlayerInvolved(state, person)
        && forStream(state.seed, 'private-venture-entry', person.id, year).chance(0.06)),
        ...drawBackgroundIncidents(pool.filter(person => !isPlayerInvolved(state, person))
            .map(value => ({ value, rate: 0.06 })), forStream(state.seed, 'private-venture-background', year), 4)];
    const known = whatOneOfTheWorldsOwnPeopleKnows({ ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 });
    const auctions = capitalCalendar(state, year).filter(occasion => occasion.kind === 'auction' && occasion.onDay > day);
    const started: string[] = [];
    for (const elder of chosen) {
        const rng = forStream(state.seed, 'private-venture-choice', elder.id, year);
        const knownAuctions = auctions.filter(occasion => isAtLeast(known(elder.id, 'place', occasion.venueId), 'placed'));
        const grounds = state.locations.filter(place => (place.kind === 'ruin' || place.kind === 'forbidden_zone')
            && isAtLeast(known(elder.id, 'place', place.id), 'placed')
            && reachThrough(pathTo(state.locations, place.id), { realmOrdinal: elder.cultivation.realmOrdinal,
                onDay: day, keyIds: theDoorKeysTheyActuallyCarry(state.objects, elder.id) }).stoppedAt === null);
        const auction = knownAuctions.length && (!grounds.length || rng.chance(0.5)) ? rng.pick(knownAuctions) : null;
        const ground = auction ? state.locations.find(place => place.id === auction.venueId)
            : grounds.length ? rng.pick(grounds) : null;
        if (!ground) continue;
        const announcement = appendWorldFact(state, makeFact({ day, kind: 'said_in_public', visibility: 'public',
            locationId: elder.locationId, actors: [{ id: elder.id, name: elder.name, role: 'speaker' }],
            summary: `${elder.name} intends to visit ${ground.name}.`, data: { plannedPrivateVenture: true, destinationId: ground.id } }));
        let attentionDays = 0;
        const ask = (actor: NpcRecord, subject: NpcRecord, description: string, stream: string) => {
            const before = state.history.facts.length;
            const accepted = putPrivateRequest(state, actor, subject, day, description, stream);
            const request = state.history.facts.slice(before).find(fact => fact.data.privateRequest === true);
            attentionDays += Number(request?.data.attentionDays ?? 0);
            return accepted;
        };
        const willing = (person: NpcRecord) => ask(elder, person,
            `${elder.name} asked ${person.name} to join the private expedition.`, 'private-disciple-invitation');
        const disciples = auction ? [] : state.npcs.filter(person => freeForPrivateBusiness(person, day)
            && person.locationId === elder.locationId && person.relationships.some(tie => tie.targetId === elder.id && tie.kind === 'master'))
            .filter(willing);
        const contact = playerAtTheContact(state);
        let visitingPlayer: NpcRecord | undefined;
        if (!auction) for (const other of pool.filter(person => person.id !== elder.id
            && announcement.witnessIds.includes(person.id))) {
            const junior = state.npcs.find(person => (freeForPrivateBusiness(person, day)
                || contact?.id === person.id && person.status === 'alive')
                && (isTheWorldsToMove(person) ? person.locationId : contact?.placeId) === elder.locationId
                && person.relationships.some(tie => tie.targetId === other.id && tie.kind === 'master'));
            if (!junior || disciples.some(person => person.id === junior.id)) continue;
            if (ask(other, elder, `${other.name} asked ${elder.name} to take ${junior.name} along.`, 'private-expedition-favour')) {
                if (!isTheWorldsToMove(junior)) visitingPlayer = junior;
                else if (willing(junior)) disciples.push(junior);
            }
        }
        // The existing request duration delays the paid departure. The held course
        // occupies these people through that preparation and the journey itself.
        const pupil = visitingPlayer ?? (contact && state.npcs.find(person => person.id === contact.id
            && person.relationships.some(tie => tie.targetId === elder.id && tie.kind === 'master')));
        if (pupil && invitePlayerToPrivateParty(state, elder, pupil.id, ground.id, day, 'elder',
            disciples.map(person => person.id), auction?.onDay, onDue, attentionDays)) continue;
        const dispatched = undertakePrivateVenture(state, elder.id, ground, disciples, day + attentionDays, auction ?? undefined, onDue, true);
        if (dispatched) started.push(dispatched.id);
    }
    return started;
}
