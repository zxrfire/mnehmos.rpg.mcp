/** One read of the existing accepted party; no route or body is stored here. */
import type Database from 'better-sqlite3';
import type { HistoricalFact } from '../engine/world/history.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { readJsonFlag } from '../server/consolidated/cultivation-support.js';
import type { PhysicalCarrier } from './a-physical-span.js';
import { shipPassengerAt } from '../engine/world/passenger-on-a-vessel.js';
import { publicCarriagePassage } from '../engine/world/public-carriages.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { locationOfNpcOnItsJourney } from '../engine/world/places-on-the-way.js';

export const FOLLOWING = 'following_party_leader';
export interface PartyFollowerClaim { bindingFactId: string }
export interface FollowedParty {
    binding: HistoricalFact;
    itinerary: HistoricalFact;
    leader: NpcRecord;
    members: NpcRecord[];
    locationId: string;
    finished: boolean;
}

export function partyFollowerClaim(db: Database.Database, playerId: string): PartyFollowerClaim | null {
    return readJsonFlag<PartyFollowerClaim>(db, playerId, FOLLOWING);
}

/** The flag is a reference to accepted company, not another route or passenger list. */
export function followedParty(db: Database.Database, world: WorldState, playerId: string,
    onDay = routineTime(world)): FollowedParty | null {
    const claim = partyFollowerClaim(db, playerId);
    const binding = claim && witnessIndexFor(world).byId.get(claim.bindingFactId);
    if (!binding || binding.data.partyFollowerBinding !== true
        || !binding.actors.some(actor => actor.id === playerId && actor.role === 'follower')
        || typeof binding.data.itineraryFactId !== 'string' || typeof binding.data.leaderId !== 'string') return null;
    const itinerary = witnessIndexFor(world).byId.get(binding.data.itineraryFactId);
    const leader = world.npcs.find(person => person.id === binding.data.leaderId && person.status === 'alive');
    if (!itinerary || itinerary.data.publicMission !== true || !leader?.activity
        || !leader.activity.withIds.includes(playerId)) return null;
    const activity = leader.activity;
    const finished = activity.capitalMissionId == null && activity.sinceDay === itinerary.day
        && activity.untilDay != null && activity.untilDay <= onDay;
    if (activity.capitalMissionId !== itinerary.id && !finished) return null;
    const locationId = locationOfNpcOnItsJourney(world, leader, onDay);
    if (!locationId) return null;
    const ids = new Set([leader.id, ...activity.withIds]);
    return { binding, itinerary, leader, locationId, finished,
        members: world.npcs.filter(person => ids.has(person.id) && person.id !== playerId && person.status === 'alive') };
}

/** Called after the ordinary party's explicit acceptance and its capacity/payment admission. */

/** Losing a party leader does not cancel a public course already carrying its passengers. */
export function survivingPartyCarrier(db: Database.Database, world: WorldState, playerId: string,
    onDay = routineTime(world)): { binding: HistoricalFact; receipt: HistoricalFact;
        source: PhysicalCarrier; operator: NpcRecord; crew: NpcRecord[]; arrived: boolean } | null {
    const claim = partyFollowerClaim(db, playerId);
    const binding = claim && witnessIndexFor(world).byId.get(claim.bindingFactId);
    if (!binding || binding.data.partyFollowerBinding !== true
        || !binding.actors.some(actor => actor.id === playerId && actor.role === 'follower')
        || world.npcs.some(person => person.id === binding.data.leaderId && person.status === 'alive')) return null;
    const receipt = [...factsWithDataValue(world, 'publicPassage', true),
        ...factsWithDataValue(world, 'service', 'carriage')].filter(fact =>
            (fact.data.publicPassage === true || fact.data.service === 'carriage')
            && typeof fact.data.departureDay === 'number' && fact.data.departureDay >= binding.day
            && fact.data.departureDay <= onDay && fact.actors.some(actor => actor.id === playerId))
        .sort((a, b) => (b.data.departureDay as number) - (a.data.departureDay as number))[0];
    if (!receipt) return null;
    const ship = receipt.data.publicPassage === true ? shipPassengerAt(world, receipt.id, onDay) : null;
    const road = receipt.data.service === 'carriage' ? publicCarriagePassage(world, receipt.id, playerId, onDay) : null;
    const locationId = ship?.locationId ?? road?.locationId;
    const operator = ship?.crew.find(person => person.identity.occupation === 'shipmaster')
        ?? ship?.crew[0] ?? road?.driver;
    if (!locationId || !operator) return null;
    const d = binding.data;
    const boardingMoment = typeof d.runId === 'string' && typeof d.boardingRunElapsedDays === 'number'
        && typeof d.departureDay === 'number' ? { runId: d.runId,
            elapsedDays: d.boardingRunElapsedDays, boardedOnDay: d.departureDay } : null;
    return { binding, receipt: ship?.receipt ?? road!.receipt, operator, crew: ship?.crew ?? [operator],
        arrived: ship?.arrived ?? road!.arrived, source: { locationId,
            endsOnDay: ship?.arrivalDay ?? road!.leg.arrivalDay,
            boardedOnDay: ship?.boardedOnDay ?? road!.leg.departureDay, boardingMoment,
            unavailable: ship?.unavailable ?? null } };
}
