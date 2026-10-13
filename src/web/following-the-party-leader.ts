/** A consenting follower reads one accepted itinerary and moves the stored body. */
import type Database from 'better-sqlite3';
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import { setLocation, type NpcActivity } from '../engine/world/npc-state.js';
import type { HistoricalFact } from '../engine/world/history.js';
import type { PhysicalCarrier } from './a-physical-span.js';
import { makeFact } from '../engine/world/history.js';
import { arrivalCourseOfFact, recordActualBodyArrival } from '../engine/world/a-body-that-actually-arrived.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { journeyTimeHasReached, locationOfNpcOnItsJourney, firstTravellerOnTheWay, firstTravellerOnTheWater } from '../engine/world/places-on-the-way.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';
import { CultivatorRepository } from '../storage/repos/cultivator.repo.js';
import { clearFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { actualCarrierScene, selectedAreaOnActualCarrier } from './the-actual-carrier-scene.js';
import { executeActualPaidPassage } from './an-actual-paid-passage.js';
import { personalAirCourseClaim } from './an-actual-personal-air-course.js';
import { thePaidCarriageClaim } from './a-paid-carriage-on-the-road.js';
import { recordedVoyage } from './a-ship-at-sea.js';
import { ownedPassageClaim, ownedCarrierAt } from './an-owned-passage.js';
import { roadVertexMoments } from '../engine/world/road-course.js';
import { walkingRouteFrom } from '../engine/world/locations.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import { putTheRouteToTheParty, pendingPartyQuestion, thePartyAnswers, type PartyCourseChoice } from '../engine/world/a-party-answers-its-leader.js';
import { applyPartyCourseDecision } from '../engine/world/capital-missions-and-calendar.js';
import { roadPositionOfNpc } from '../engine/world/places-on-the-way.js';
import { groundWhereAPartyStopped } from '../engine/world/where-a-carriage-stopped.js';
import { FLAG_ROAD_STOPPED } from './a-road-stopped-partway.js';

import { privateLegOfFollowingParty, bindFreePrivateRideForFollower, recordFollowingPrivateLandfall }
    from './a-party-follower-on-a-private-owned-leg.js';
import { FOLLOWING, followedParty, partyFollowerClaim, survivingPartyCarrier, type PartyFollowerClaim }
    from './the-party-you-actually-follow.js';
export { followedParty, partyFollowerClaim } from './the-party-you-actually-follow.js';
export type { FollowedParty, PartyFollowerClaim } from './the-party-you-actually-follow.js';

export function bindFollowingParty(game: GameService, run: Run, body: Cultivator,
    leaderId: string, itineraryFactId: string): { ok: true; binding: HistoricalFact } | { ok: false; reason: string } {
    const world = game.atHand, current = game.repos.cultivators.getById(body.id);
    const leader = world?.npcs.find(person => person.id === leaderId && person.status === 'alive');
    const follower = world?.npcs.find(person => person.id === body.id);
    const itinerary = world && witnessIndexFor(world).byId.get(itineraryFactId);
    if (!world || !current?.alive || !leader?.activity || itinerary?.data.publicMission !== true
        || leader.activity.capitalMissionId !== itinerary.id || !leader.activity.withIds.includes(current.id)
        || follower?.activity?.capitalMissionId !== itinerary.id
        || follower.activity.capitalMissionLeg !== leader.activity.capitalMissionLeg
        || !itinerary.actors.some(actor => actor.id === current.id))
        return { ok: false, reason: 'The actual party has not accepted this living follower on that itinerary.' };
    const now = routineTime(world);
    const ground = locationOfNpcOnItsJourney(world, leader, now);
    if (!ground || worldLocationFor(world, current.location)?.id !== ground)
        return { ok: false, reason: 'The party leader and the actual follower have not reached the same ground.' };
    const carrier = actualCarrierScene({ db: game.db }, current, world, now);
    if (carrier && carrier.vesselId !== leader.activity.vesselId)
        return { ok: false, reason: 'The follower is still aboard another actual passage.' };
    const prior = followedParty(game.db, world, current.id, now);
    if (prior) return prior.leader.id === leaderId && prior.itinerary.id === itineraryFactId
        ? { ok: true, binding: prior.binding }
        : { ok: false, reason: 'The follower is already following another actual party.' };
    const binding = appendWorldFact(world, makeFact({ day: now, kind: 'gathering', visibility: 'secret',
        locationId: ground, causes: [itinerary.id],
        actors: [{ id: current.id, name: current.name, role: 'follower' },
            { id: leader.id, name: leader.name, role: 'party_leader' }],
        witnessIds: [current.id, ...leader.activity.withIds.filter(id => id !== current.id), leader.id],
        summary: 'The accepted party follower follows its actual leader.',
        data: { partyFollowerBinding: true, itineraryFactId: itinerary.id, leaderId: leader.id,
            runId: run.id, boardingRunElapsedDays: run.elapsedDays, departureDay: now } }),
        { bystanders: false, recur: false });
    writeFlag(game.db, current.id, FOLLOWING, JSON.stringify({ bindingFactId: binding.id } satisfies PartyFollowerClaim));
    game.theWorldMoved();
    return { ok: true, binding };
}

/** Remove one accepted follower, including from a held or resumed phase. */
function removeFollowerFromItinerary(world: WorldState, playerId: string, itineraryId: string): void {
    const without = (activity: NpcActivity): NpcActivity => ({ ...activity,
        withIds: activity.withIds.filter(id => id !== playerId),
        ...(activity.redirect?.previous ? { redirect: { ...activity.redirect,
            previous: without(activity.redirect.previous) } } : {}),
        ...(activity.passageCompany ? { passageCompany: without(activity.passageCompany) } : {}) });
    for (let at = 0; at < world.npcs.length; at++) {
        const person = world.npcs[at]!;
        if (person.activity?.capitalMissionId !== itineraryId) continue;
        world.npcs[at] = person.id === playerId ? { ...person, activity: null }
            : { ...person, activity: without(person.activity) };
    }
}

/** A newly accepted individual course ends following before either body projection runs. */
export function releaseFollowingForIndependentPassage(db: Database.Database, world: WorldState,
    playerId: string, onDay = routineTime(world)): boolean {
    const now = routineTime(world);
    if (!journeyTimeHasReached(now, onDay) || !journeyTimeHasReached(onDay, now)) return false;
    const claim = partyFollowerClaim(db, playerId);
    if (!claim) return false;
    const binding = witnessIndexFor(world).byId.get(claim.bindingFactId);
    if (!binding || binding.data.partyFollowerBinding !== true) return false;
    const flight = personalAirCourseClaim(db, playerId);
    const receiptId = ownedPassageClaim(db, playerId)?.receiptId
        ?? thePaidCarriageClaim(db, playerId)?.receiptId ?? recordedVoyage(db, playerId)?.receiptId
        ?? (flight && world.locations.find(place => place.id === flight.locationId)?.data.airCourseId);
    const accepted = typeof receiptId === 'string' && witnessIndexFor(world).byId.get(receiptId);
    if (!accepted || accepted.day < binding.day || !journeyTimeHasReached(onDay, accepted.day)) return false;
    if (typeof binding.data.itineraryFactId === 'string')
        removeFollowerFromItinerary(world, playerId, binding.data.itineraryFactId);
    clearFlag(db, playerId, FOLLOWING);
    const body = new CultivatorRepository(db).getById(playerId);
    if (body) appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering',
        locationId: typeof accepted.data.fromLocationId === 'string' ? accepted.data.fromLocationId : null,
        visibility: 'secret', causes: [binding.id, accepted.id],
        actors: [{ id: body.id, name: body.name, role: 'left_party' }], witnessIds: [body.id],
        summary: 'The follower left the party on an independently accepted journey.',
        data: { partyFollowerLeft: binding.id, itineraryFactId: binding.data.itineraryFactId,
            independentCourseId: accepted.id } }), { bystanders: false, recur: false });
    return true;
}

function endUnavailableFollowing(game: GameService, run: Run, body: Cultivator,
    registerTurn = true): Execution {
    const world = game.atHand!, claim = partyFollowerClaim(game.db, body.id);
    const binding = claim && witnessIndexFor(world).byId.get(claim.bindingFactId);
    if (typeof binding?.data.itineraryFactId === 'string')
        removeFollowerFromItinerary(world, body.id, binding.data.itineraryFactId);
    clearFlag(game.db, body.id, FOLLOWING);
    game.theWorldMoved();
    return game.freeAction(run, 'interact', factsForToolResult('The accepted party journey has ended.', [
        "The party's leader is no longer carrying the accepted journey.",
        `You remain at ${body.location}.` ]), registerTurn);
}

/** Each phase's existing activity supplies its actual position and deadline. */
export function partyFollowerSource(db: Database.Database, world: WorldState, body: Cultivator,
    onDay = routineTime(world)): PhysicalCarrier | null {
    const party = body.alive && followedParty(db, world, body.id, onDay);
    if (!party) return body.alive ? survivingPartyCarrier(db, world, body.id, onDay)?.source ?? null : null;
    const activity = party.leader.activity!;
    if (activity.untilDay == null) return null;
    const privateLeg = privateLegOfFollowingParty(world, party);
    const privateAdmissionMissing = privateLeg && !privateLeg.actors.some(actor => actor.id === body.id);
    const owner = privateLeg && world.npcs.find(person => person.id === privateLeg.data.ownerId);
    const privateCarrier = privateLeg && (privateLeg.data.ownerId === body.id
        ? ownedCarrierAt(world, privateLeg.id, body, onDay) : owner && ownedCarrierAt(world, privateLeg.id, {
            id: owner.id, alive: owner.status === 'alive', realmOrdinal: owner.cultivation.realmOrdinal }, onDay));
    const d = party.binding.data;
    const moment = typeof d.runId === 'string' && typeof d.boardingRunElapsedDays === 'number'
        && typeof d.departureDay === 'number' ? { runId: d.runId,
            elapsedDays: d.boardingRunElapsedDays, boardedOnDay: d.departureDay } : null;
    const route = activity.kind === 'travelling' && !activity.vesselId && !activity.airCourseLocationId
        && activity.fromLocationId && activity.returnTo
        ? activity.admittedRoad?.route ?? walkingRouteFrom(world.locations, activity.fromLocationId, activity.returnTo) : null;
    return { locationId: privateCarrier?.locationId ?? party.locationId,
        endsOnDay: privateCarrier?.endsOnDay ?? activity.untilDay,
        boardingMoment: moment, vertexDates: route ? roadVertexMoments(route, activity.sinceDay,
            activity.untilDay - activity.sinceDay, activity.admittedRoad?.initialTravelDays ?? 0) : [],
        boardedOnDay: activity.sinceDay, unavailable: privateAdmissionMissing
            ? 'The private craft has not boarded you on this actual leg.'
            : privateLeg && !privateCarrier ? 'The actual private carrier owner is no longer available.' : privateCarrier?.unavailable ?? (activity.partyFightId ? 'The party is in a fight.' : activity.partyQuestionId
            ? activity.redirect?.previous ? 'The party is resting until the next dawn.'
                : 'The party leader has put continuing, resting or turning back to the party.' : null) };
}

/** This writer projects SQL, including when the native itinerary replaces a world mirror. */
export function projectPartyFollower(db: Database.Database, world: WorldState, playerId: string,
    onDay = routineTime(world)): void {
    if (!partyFollowerClaim(db, playerId)) return;
    const now = routineTime(world);
    if (!journeyTimeHasReached(now, onDay) || !journeyTimeHasReached(onDay, now)) return;
    if (releaseFollowingForIndependentPassage(db, world, playerId)) return;
    const repo = new CultivatorRepository(db), body = repo.getById(playerId);
    const party = body?.alive && followedParty(db, world, playerId, onDay);
    const place = party && world.locations.find(place => place.id === party.locationId);
    if (body?.alive && !party) {
        const carrier = survivingPartyCarrier(db, world, playerId, onDay);
        const ground = carrier && world.locations.find(place => place.id === carrier.source.locationId);
        if (carrier && ground) {
            const carried = repo.update(playerId, { location: ground.name })!;
            const scene = actualCarrierScene({ db }, carried, world, onDay);
            repo.standIn(playerId, scene ? selectedAreaOnActualCarrier(world, scene, carried) : null);
            if (carrier.arrived && !carrier.source.unavailable) {
                recordActualBodyArrival(world, { id: carried.id, name: carried.name, alive: carried.alive,
                    locationId: ground.id }, arrivalCourseOfFact(carrier.receipt), onDay, carrier.receipt);
                clearFlag(db, playerId, FOLLOWING);
            }
            return;
        }
    }
    if (!body?.alive || !party || !place) { clearFlag(db, playerId, FOLLOWING); return; }
    const privateLeg = privateLegOfFollowingParty(world, party);
    if (privateLeg && (!privateLeg.actors.some(actor => actor.id === playerId)
        || partyFollowerSource(db, world, body, onDay)?.unavailable)) return;
    repo.update(playerId, { location: place.name });
    const areas = theAreasOf(world, place), area = areas.whereIs.get(party.leader.id);
    const current = repo.getById(playerId)!;
    const carrier = actualCarrierScene({ db }, current, world, onDay);
    if (carrier) repo.standIn(playerId, selectedAreaOnActualCarrier(world, carrier, current));
    else if (party.leader.activity?.kind === 'travelling' && !party.leader.activity.vesselId
        || !current.standingIn || !areas.areas.some(area => area.id === current.standingIn))
        repo.standIn(playerId, area ?? null);
    recordFollowingPrivateLandfall(world, party, repo.getById(playerId)!, onDay);
    if (party.finished) clearFlag(db, playerId, FOLLOWING);
}

/** Contacts use the current real phase's dated route, never the enclosing wait. */
function firstPartyContact(game: GameService, body: Cultivator, onDay: number,
    days: number): ReturnType<typeof firstTravellerOnTheWay> {
    const world = game.atHand, party = world && followedParty(game.db, world, body.id, onDay);
    if (!world || !party || party.finished || !(days > 0)) return null;
    const activity = party.leader.activity!;
    if (activity.partyQuestionId || activity.partyFightId || activity.airCourseLocationId) return null;
    const exceptIds = new Set([body.id, ...party.members.map(person => person.id),
        ...world.npcs.filter(person => activity.vesselId && person.activity?.vesselId === activity.vesselId)
            .map(person => person.id)]);
    if (activity.seaLaneId && activity.vesselId) {
        const contact = firstTravellerOnTheWater({ locations: world.locations, npcs: world.npcs,
            waterId: party.locationId, vesselId: activity.vesselId, onDay, days, exceptIds });
        const locationId = contact && locationOfNpcOnItsJourney(world, contact.npc, onDay + contact.afterDays);
        const place = locationId && world.locations.find(place => place.id === locationId);
        return contact && place ? { ...contact, place } : null;
    }
    if (activity.kind !== 'travelling') {
        const point = roadPositionOfNpc(world.locations, party.leader, onDay)
            ?? { kind: 'place' as const, locationId: party.locationId, originLocationId: party.locationId };
        return firstTravellerOnTheWay({ locations: world.locations, npcs: world.npcs,
            fromId: party.locationId, toId: party.locationId, onDay, days, exceptIds, stationaryAt: point });
    }
    const operator = activity.carrierOperatorId
        ? world.npcs.find(person => person.id === activity.carrierOperatorId && person.status === 'alive') : party.leader;
    const road = operator?.activity;
    if (road?.kind !== 'travelling' || !road.fromLocationId || !road.returnTo || road.untilDay == null) return null;
    return firstTravellerOnTheWay({ locations: world.locations, npcs: world.npcs,
        fromId: road.fromLocationId, toId: road.returnTo, onDay,
        days: Math.min(days, Math.max(0, road.untilDay - onDay)), exceptIds,
        route: road.admittedRoad?.route,
        journey: { sinceDay: road.sinceDay, untilDay: road.untilDay,
            initialTravelDays: road.admittedRoad?.initialTravelDays } });
}

/** One real body/world span follows the current native phase at every boundary. */
export async function spendFollowingParty(game: GameService, run: Run, body: Cultivator,
    days: number, resolvesOnTurn = run.turn + 1, finishTurn = true): Promise<Execution | null> {
    // Combat spends ordinary body time while the native party is held at the fight ground.
    if (game.fight || !game.atHand || !partyFollowerClaim(game.db, body.id)) return null;
    if (releaseFollowingForIndependentPassage(game.db, game.atHand, body.id)) {
        game.theWorldMoved();
        return null;
    }
    const source = (onDay?: number) => game.atHand && partyFollowerSource(game.db, game.atHand, body, onDay);
    const first = source();
    // An explicit wait while a discussion is held spends ordinary time on that ground.
    if (first?.unavailable) {
        const held = followedParty(game.db, game.atHand, body.id)?.leader.activity?.partyQuestionId;
        if (held) return null;
        return refused('engine.actualPartyFollower', 'wait', factsForRefusal(
            'The actual party cannot carry you on this leg.', first.unavailable, 'Nothing spent.'));
    }
    if (!first) return endUnavailableFollowing(game, run, body);
    const requested = Number.isFinite(days) ? days : Math.max(0, first.endsOnDay - routineTime(game.atHand));
    const party = followedParty(game.db, game.atHand, body.id);
    const publicCarrier = party ? null : survivingPartyCarrier(game.db, game.atHand, body.id);
    const activity = party?.leader.activity ?? publicCarrier?.operator.activity;
    const target = game.atHand.locations.find(place => place.id === activity?.returnTo)
        ?? game.atHand.locations.find(place => place.id === first.locationId)!;
    const moment = first.boardingMoment;
    const now = routineTime(game.atHand);
    const newlyAccepted = moment != null && journeyTimeHasReached(now, moment.boardedOnDay)
        && journeyTimeHasReached(moment.boardedOnDay, now);
    bindFreePrivateRideForFollower(game, body);
    const questionBefore = party && pendingPartyQuestion(game.atHand, party.leader.id);
    const execution = await executeActualPaidPassage(game, run, body, { service: 'party', to: target.name,
        days: requested, walkingDays: requested, stones: 0, escort: 0,
        bought: "You are following the party's accepted itinerary.", departureOccasion: newlyAccepted },
        (arrivedBody, _arrivedRun, execution) => {
            execution.facts.lines.push(...askAfterThePartyFightOnReachedGround(game, arrivedBody));
        },
        { source, beforeWorld: () => bindFreePrivateRideForFollower(game, game.currentRun().cultivator), contact: (onDay, remaining) => firstPartyContact(game, body, onDay, remaining), overWater: !!activity?.seaLaneId,
            vesselId: activity?.vesselId ?? undefined,
            airborne: !!activity?.airCourseLocationId,
            crew: () => game.atHand ? followedParty(game.db, game.atHand, body.id)?.members
                ?? survivingPartyCarrier(game.db, game.atHand, body.id)?.crew ?? [] : [],
            stop: () => partyFollowerClaim(game.db, body.id) ? null : "The party's agreed journey has ended.",
            atStop: reason => {
                const current = game.currentRun(), world = game.atHand;
                const followed = world && followedParty(game.db, world, body.id);
                if (!world || !followed || !current.cultivator.alive) return [];
                const question = pendingPartyQuestion(world, followed.leader.id)
                    ?? putTheRouteToTheParty(world, followed.leader.id, body.id, routineTime(world),
                        followed.binding.id + ':stop:' + routineTime(world), reason);
                if (!question) return [];
                projectPartyFollower(game.db, world, body.id);
                return [`${followed.leader.name} asks the party whether to continue, rest or turn back.`];
            } }, resolvesOnTurn, finishTurn);
    const world = game.atHand, leaderId = party?.leader.id;
    const question = world && leaderId && pendingPartyQuestion(world, leaderId);
    if (question && question.id !== questionBefore?.id) {
        const leader = world!.npcs.find(person => person.id === leaderId)!;
        const line = `${leader.name} asks the party whether to continue, rest or turn back.`;
        if (!execution.facts.lines.includes(line)) execution.facts.lines.push(line);
        execution.facts.required = [...(execution.facts.required ?? []), line];
    }
    return execution;

}

/** A scene reply is one voice; the actual decision changes the existing course. */
export function answerFollowingParty(game: GameService, run: Run, body: Cultivator,
    input: string, registerTurn = true): Execution | null {
    const world = game.atHand;
    if (!world || game.fight) return null;
    const leave = /^(?:i\s+)?(?:leave|quit|depart from)\s+(?:the|this|your|our)\s+party[.!]?$/i.test(input.trim());
    const party = followedParty(game.db, world, body.id);
    if (!party) return leave && partyFollowerClaim(game.db, body.id)
        ? endUnavailableFollowing(game, run, body, registerTurn) : null;
    const question = pendingPartyQuestion(world, party.leader.id);
    const replying = /^(?:i\s+)?(?:(?:tell|ask)\s+(?:the|our)\s+party\s+(?:to\s+)?|(?:say|answer|reply)\s+)?(?:continue|press on|carry on|keep going|rest|stop for the night|(?:turn|go|head) back)[.!]?$/i.test(input.trim());
    const choice: PartyCourseChoice | null = /\b(?:turn(?:ing)?|go|head)\s+back\b/i.test(input) ? 'turn_back'
        : /\b(?:rest|stop for the night)\b/i.test(input) ? 'rest'
        : /\b(?:continue|press on|carry on|keep going)\b/i.test(input) ? 'continue' : null;
    if (!leave && (!question || !choice || !replying)) return null;
    const day = routineTime(world);
    if (leave) {
        if (party.leader.activity?.vesselId || party.leader.activity?.airCourseLocationId)
            return refused('engine.leaveActualParty', 'interact', factsForRefusal("You are still aboard the party's passage.",
                'The party has not disembarked on ground where you can leave it.', 'Nothing spent.'));
        const point = roadPositionOfNpc(world.locations, party.leader, day);
        const locationId = point ? groundWhereAPartyStopped(world, party.leader.id,
            party.leader.activity!.sinceDay, day, point, party.locationId) : party.locationId;
        const place = world.locations.find(row => row.id === locationId)!;
        game.repos.cultivators.update(body.id, { location: place.name });
        game.repos.cultivators.standIn(body.id, null);
        if (point?.kind === 'edge') {
            const target = world.locations.find(row => row.id === party.leader.activity!.returnTo);
            if (target) writeFlag(game.db, body.id, FLAG_ROAD_STOPPED, JSON.stringify({
                to: target.name, from: place.name, road: point.admittedDays,
                walked: point.fraction * point.admittedDays, stoppedLocationId: locationId }));
        }
        clearFlag(game.db, body.id, FOLLOWING);
        removeFollowerFromItinerary(world, body.id, party.itinerary.id);
        appendWorldFact(world, makeFact({ day, kind: 'gathering', locationId, visibility: 'secret',
            causes: [party.binding.id], summary: 'The follower left the party.',
            actors: [{ id: body.id, name: body.name, role: 'left_party' },
                { id: party.leader.id, name: party.leader.name, role: 'party_leader' }],
            witnessIds: [body.id, ...party.members.map(person => person.id)],
            data: { partyFollowerLeft: party.binding.id, itineraryFactId: party.itinerary.id } }),
            { bystanders: false, recur: false });
        if (question) {
            thePartyAnswers(world, question, null, null, day);
            applyPartyCourseDecision(world, party.leader.id, day);
        }
        game.theWorldMoved();
        return game.freeAction(run, 'interact', factsForToolResult('You left the party.', [
            'You left the party.', `You remain at ${place.name}.` ]), registerTurn);
    }
    const fresh = game.repos.cultivators.getById(body.id)!;
    if (worldLocationFor(world, fresh.location)?.id !== question!.locationId)
        return refused('engine.answerActualParty', 'interact', factsForRefusal("The party's discussion is out of reach.",
            "Your actual body is not at the party's held ground.", 'Nothing spent.'));
    const result = thePartyAnswers(world, question!, { id: body.id, name: body.name,
        ordinal: body.realmOrdinal, charm: body.attributes.charm,
        factionId: body.sectId ?? null, alignment: world.factions.find(house => house.id === body.sectId)?.alignment ?? null,
        ranked: body.sectId != null }, choice!, day);
    if (!result) return refused('engine.answerActualParty', 'interact', factsForRefusal('The party cannot settle this reply.',
        'Its actual leader or company is no longer at this discussion.', 'Nothing spent.'));
    applyPartyCourseDecision(world, party.leader.id, day);
    projectPartyFollower(game.db, world, body.id, day);
    game.theWorldMoved();
    return game.freeAction(run, 'interact', factsForToolResult('The party settled its course.', [
        ...result.voices.map(voice => `${voice.personId === body.id ? body.name
            : world.npcs.find(person => person.id === voice.personId)!.name} answered ${voice.choice === 'turn_back'
                ? 'turn back' : voice.choice}.`), result.decision.summary,
        ...(result.chosen === 'rest' ? ['The party is resting until the next dawn.'] : []) ]));
}

/** A real fight holds the admitted company at its reached physical ground. */
export function holdTheFollowingPartyForAFight(game: GameService, body: Cultivator,
    occurrenceId: string, day: number): string | null {
    const world = game.atHand, party = world && followedParty(game.db, world, body.id, day);
    if (!world || !party) return null;
    const carried = !!(party.leader.activity!.vesselId || party.leader.activity!.airCourseLocationId);
    const point = roadPositionOfNpc(world.locations, party.leader, day);
    const locationId = point ? groundWhereAPartyStopped(world, party.leader.id,
        party.leader.activity!.sinceDay, day, point, party.locationId) : party.locationId;
    const people = new Set([body.id, ...party.members.map(person => person.id)]);
    const event = appendWorldFact(world, makeFact({ day, kind: 'gathering', locationId, visibility: 'public',
        causes: [party.binding.id], summary: carried ? 'The party was attacked aboard its passage.' : 'The party was attacked at its reached ground.',
        actors: [{ id: body.id, name: body.name, role: 'party_member' },
            ...party.members.map(person => ({ id: person.id, name: person.name,
                role: person.id === party.leader.id ? 'party_leader' : 'party_member' }))],
        witnessIds: [...people], data: { partyFight: true, occurrenceId, leaderId: party.leader.id,
            playerId: body.id, itineraryFactId: party.itinerary.id, partyFightBinding: party.binding.id } }), { bystanders: false, recur: false });
    // A passenger's fight does not pause the real captain's accepted course.
    if (carried) return event.id;
    for (let at = 0; at < world.npcs.length; at++) {
        const person = world.npcs[at]!;
        if (!people.has(person.id) || person.status !== 'alive' || !person.activity) continue;
        world.npcs[at] = { ...(person.id === body.id ? person : setLocation(person, locationId, day)),
            activity: { ...person.activity, partyFightId: event.id } };
    }
    projectPartyFollower(game.db, world, body.id, day);
    return event.id;
}

/** The survivor hears the leader's question only once the foreground fight has ended. */
export function theFollowingPartyAfterAFight(game: GameService, body: Cultivator,
    fightFactId: string): string[] {
    const world = game.atHand, event = world && witnessIndexFor(world).byId.get(fightFactId);
    if (!world || event?.data.partyFight !== true) return [];
    const day = routineTime(world), delay = Math.max(0, day - event.day);
    for (let at = 0; at < world.npcs.length; at++) {
        const person = world.npcs[at]!, activity = person.activity;
        if (!activity || activity.partyFightId !== event.id) continue;
        const { partyFightId: fought, ...course } = activity;
        world.npcs[at] = { ...person, activity: { ...course, sinceDay: course.sinceDay + delay,
            untilDay: course.untilDay == null ? null : course.untilDay + delay } };
    }
    if (!factsWithDataValue(world, 'partyFightEnded', event.id).length) {
        appendWorldFact(world, makeFact({ day, kind: 'gathering', locationId: event.locationId,
            visibility: 'secret', causes: [event.id], summary: 'The party fight ended.',
            actors: event.actors, witnessIds: event.witnessIds,
            data: { partyFightEnded: event.id } }), { bystanders: false, recur: false });
    }
    if (!body.alive || typeof event.data.leaderId !== 'string') { game.theWorldMoved(); return []; }
    const question = putTheRouteToTheParty(world, event.data.leaderId, body.id, day,
        event.id, "The party's fight ended.");
    if (!question) { game.theWorldMoved(); return []; }
    projectPartyFollower(game.db, world, body.id, day);
    game.theWorldMoved();
    const leader = world.npcs.find(person => person.id === event.data.leaderId)!;
    return [`${leader.name} asks the party whether to continue, rest or turn back.`];
}

/** An aboard discussion waits for actual landfall; it cannot commandeer the hull. */
function askAfterThePartyFightOnReachedGround(game: GameService, body: Cultivator): string[] {
    const world = game.atHand, party = world && followedParty(game.db, world, body.id);
    if (!world || !party || !body.alive || game.fight) return [];
    for (const event of factsWithDataValue(world, 'partyFightBinding', party.binding.id)) {
        if (!factsWithDataValue(world, 'partyFightEnded', event.id).length
            || factsWithDataValue(world, 'partyQuestionEvent', event.id).length) continue;
        const question = putTheRouteToTheParty(world, party.leader.id, body.id,
            routineTime(world), event.id, "The party's fight ended.");
        if (!question) continue;
        projectPartyFollower(game.db, world, body.id);
        return [`${party.leader.name} asks the party whether to continue, rest or turn back.`];
    }
    return [];
}
