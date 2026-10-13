/** A private admitted leg uses the existing personal agreement, never a tally. */
import type { Cultivator } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { HistoricalFact } from '../engine/world/history.js';
import type { GameService } from './turn-engine.js';
import type { FollowedParty } from './the-party-you-actually-follow.js';
import { followedParty } from './the-party-you-actually-follow.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { bindAgreedRide } from './an-offered-ride-is-an-agreement.js';
import { worldLocationFor } from './entities.js';
import { arrivalCourseOfFact, recordActualBodyArrival } from '../engine/world/a-body-that-actually-arrived.js';
import { locationOfNpcOnItsJourney, journeyTimeHasReached } from '../engine/world/places-on-the-way.js';

export function privateLegOfFollowingParty(world: WorldState, party: FollowedParty): HistoricalFact | null {
    const leg = party.leader.activity;
    if (leg?.kind !== 'travelling' || !leg.vesselId) return null;
    const airSite = leg.airCourseLocationId && world.locations.find(place => place.id === leg.airCourseLocationId);
    const activeAir = airSite && typeof airSite.data.airCourseId === 'string'
        ? witnessIndexFor(world).byId.get(airSite.data.airCourseId) : null;
    const candidates = leg.airCourseLocationId ? activeAir ? [activeAir] : []
        : factsWithDataValue(world, 'vesselId', leg.vesselId);
    return [...candidates].reverse().find(fact => fact.data.ownedPassage === true
        && fact.data.publicPassage !== true
        && fact.data.fromLocationId === leg.fromLocationId && fact.data.toLocationId === leg.returnTo
        && fact.data.departureDay === leg.sinceDay && fact.data.arrivalDay === leg.untilDay) ?? null;
}

export function bindFreePrivateRideForFollower(game: GameService, body: Cultivator): void {
    const world = game.atHand, party = world && followedParty(game.db, world, body.id);
    if (!world || !party) return;
    const receipt = privateLegOfFollowingParty(world, party), d = receipt?.data;
    if (!receipt || !d || !receipt.actors.some(actor => actor.id === body.id)
        || typeof d.fromLocationId !== 'string' || typeof d.toLocationId !== 'string'
        || typeof d.departureDay !== 'number') return;
    const owner = world.npcs.find(person => person.id === d.ownerId && person.status === 'alive');
    const target = world.locations.find(place => place.id === d.toLocationId);
    if (target && owner && owner.id !== body.id) bindAgreedRide(game, owner, body, { driverId: owner.id,
        riderId: body.id, fromId: d.fromLocationId, toId: d.toLocationId,
        acceptedWorldDay: d.departureDay, payment: { kind: 'free' } }, target.name);
}

/** Named admission plus the current real bodies proves landfall; a booking alone does not. */
export function recordFollowingPrivateLandfall(world: WorldState, party: FollowedParty,
    body: Cultivator, onDay: number): void {
    const bodyGround = worldLocationFor(world, body.location)?.id;
    const leaderGround = locationOfNpcOnItsJourney(world, party.leader, onDay);
    if (!body.alive || !bodyGround || bodyGround !== leaderGround) return;
    for (const member of party.members) for (const fact of factsWithDataValue(world, 'ownerId', member.id)) {
        if (fact.data.ownedPassage !== true || fact.data.publicPassage === true
            || !fact.causes.includes(party.itinerary.id) || !fact.actors.some(actor => actor.id === body.id)) continue;
        const course = arrivalCourseOfFact(fact);
        if (!course || course.toLocationId !== bodyGround || !journeyTimeHasReached(onDay, course.arrivalDay)) continue;
        if (fact.data.airCourse === true) {
            const site = world.locations.find(place => place.data.airCourseId === fact.id);
            if (!site || typeof site.data.airStoppedFactId === 'string') continue;
        }
        const owner = world.npcs.find(person => person.id === fact.data.ownerId && person.status === 'alive');
        const ownerGround = owner && locationOfNpcOnItsJourney(world, owner, onDay);
        if (!owner || ownerGround !== bodyGround) continue;
        recordActualBodyArrival(world, { id: owner.id, name: owner.name,
            alive: true, locationId: ownerGround }, course, onDay, fact);
        recordActualBodyArrival(world, { id: body.id, name: body.name,
            alive: body.alive, locationId: bodyGround }, course, onDay, fact);
    }
}
