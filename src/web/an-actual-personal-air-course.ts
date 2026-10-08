import { heldPersonalFlightArt } from '../engine/world/the-personal-flight-art-they-hold.js';
import { aRoofOverWhereTheyStand } from './where-the-nights-were-spent.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';
/** An accepted personal flight is a real body course, never an owned-object stand-in. */
import type Database from 'better-sqlite3';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { PhysicalCarrier } from './a-physical-span.js';
import { CultivatorRepository } from '../storage/repos/cultivator.repo.js';
import { worldLocationFor } from '../engine/world/place-lookup.js';
import { airPositionAt, stopAnAirCourse, beginAnAirCourse } from '../engine/world/an-air-course-in-the-world.js';
import { acceptedAirCourse } from '../engine/world/position-on-an-accepted-air-course.js';
import { canFlyByTheirOwnBody, quoteAnAirJourney, conveyanceOfPersonalFlight } from '../engine/world/what-an-air-journey-takes.js';
import { brokenStatusesOn } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { readJsonFlag, clearFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { executeActualPaidPassage } from './an-actual-paid-passage.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { useHeldTechnique } from '../server/consolidated/technique-manage.js';
import { INNATE_FLIGHT_LAUNCH_QI } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { exteriorGroundOfDeparture } from '../engine/world/departure-approach.js';
import { walkToTheDeparture } from './walking-to-a-departure.js';

const ACTIVE = 'personal_air_course';
export function personalAirCourseClaim(db: Database.Database, bodyId: string): { locationId: string } | null {
    return readJsonFlag<{ locationId: string }>(db, bodyId, ACTIVE);
}
export function holdPersonalAirCourse(db: Database.Database, bodyId: string, locationId: string): void {
    writeFlag(db, bodyId, ACTIVE, JSON.stringify({ locationId }));
}

export function personalAirSource(db: Database.Database, world: WorldState, body: Cultivator,
    onDay = routineTime(world), acceptedSiteId?: string): PhysicalCarrier | null {
    const claim = acceptedSiteId ? { locationId: acceptedSiteId } : personalAirCourseClaim(db, body.id);
    const site = claim && world.locations.find(place => place.id === claim.locationId);
    const fact = site && typeof site.data.airCourseId === 'string'
        ? witnessIndexFor(world).byId.get(site.data.airCourseId) : null;
    const course = fact && acceptedAirCourse(fact, body.id);
    const position = site && airPositionAt(world, site, onDay);
    if (!site || !course || !position || course.vesselId !== null) return null;
    const actualPlace = worldLocationFor(world, body.location);
    const reached = position.kind === 'place' && position.fraction === 1;
    const unavailable = !body.alive ? 'The actual flying body died.'
        : actualPlace?.id !== site.id && !(reached && actualPlace?.id === course.toId)
            ? 'The body no longer occupies this accepted flight.'
        : typeof site.data.airStoppedFactId === 'string' ? 'The earlier flight stopped at its actual airborne point.'
        : course.artId === null && !canFlyByTheirOwnBody(body.realmOrdinal, brokenStatusesOn(body.injuries))
            ? 'The actual bodily flight capability is no longer held.'
        : course.artId !== null && !personalFlightArt(body, course.artId)
            ? 'The actual held flight art, rung or school no longer permits this course.' : null;
    return { locationId: reached && position.kind === 'place' ? position.locationId : site.id,
        boardedOnDay: course.departureDay, endsOnDay: course.arrivalDay,
        boardingMoment: course.moment, unavailable };
}

/** This runs at the actual native boundary, including native body death. */
export function projectPersonalAirPassenger(db: Database.Database, world: WorldState, bodyId: string,
    onDay: number): void {
    const claim = personalAirCourseClaim(db, bodyId);
    const site = claim && world.locations.find(place => place.id === claim.locationId);
    if (!site) return;
    const repos = new CultivatorRepository(db), body = repos.getById(bodyId);
    if (!body) return;
    const source = personalAirSource(db, world, body, onDay);
    if (!source || source.unavailable) {
        stopAnAirCourse(world, site, onDay, source?.unavailable ?? 'The actual accepted flight is unavailable.');
        clearFlag(db, bodyId, ACTIVE);
        return;
    }
    const position = airPositionAt(world, site, onDay);
    if (position?.kind === 'place' && position.fraction === 1) {
        const destination = world.locations.find(place => place.id === position.locationId);
        if (destination && body.alive) repos.update(bodyId, { location: destination.name, standingIn: null });
        clearFlag(db, bodyId, ACTIVE);
    }
}

/** Native current-scene encounters and the held body clock are shared with real transport. */
export async function spendOnPersonalAirCourse(game: GameService, run: Run, body: Cultivator,
    days = Infinity, resolvesOnTurn = run.turn + 1, finishTurn = true) {
    const claim = personalAirCourseClaim(game.db, body.id), world = game.atHand;
    const site = claim && world?.locations.find(place => place.id === claim.locationId);
    const fact = site && typeof site.data.airCourseId === 'string'
        ? witnessIndexFor(world!).byId.get(site.data.airCourseId) : null;
    const course = fact && acceptedAirCourse(fact, body.id);
    if (!site || !world || !course) return null;
    const fresh = game.repos.cultivators.getById(body.id) ?? body;
    const actual = personalAirSource(game.db, world, fresh);
    if (!actual || actual.unavailable) return refused('engine.personalAirCourse', 'ride', factsForRefusal(
        'The actual flight cannot continue.', actual?.unavailable ?? 'Its accepted physical source is absent.',
        'No new art use, launch, location write or body time.'));
    const destination = world.locations.find(place => place.id === course.toId);
    if (!destination) return null;
    const source = (day = routineTime(game.atHand!)) => personalAirSource(game.db, game.atHand!,
        game.repos.cultivators.getById(body.id) ?? body, day, site.id);
    const execution = await executeActualPaidPassage(game, run, fresh, { service: 'air', to: destination.name,
        days: Number.isFinite(days) ? days : Math.max(0, course.arrivalDay - routineTime(world)), walkingDays: 0,
        stones: 0, escort: 0, bought: 'Continuing the actual personal flight.' }, undefined,
        { source, overWater: false, airborne: true, crew: () => [] }, resolvesOnTurn, finishTurn);
    const after = game.currentRun();
    if (execution.cutShort || execution.timeSkip?.interrupted || !after.cultivator.alive) {
        stopAnAirCourse(game.atHand!, site, routineTime(game.atHand!),
            execution.cutShort?.what ?? execution.timeSkip?.interruptReason ?? 'The actual flying body can no longer continue.');
        clearFlag(game.db, body.id, ACTIVE);
    }
    return execution;
}

/** Actual held arts use the existing school/rung gate, not the presence of a word in the plan. */
export function personalFlightArt(body: Cultivator, requested?: string) {
    return heldPersonalFlightArt(body.realmOrdinal, body.knownTechniques, requested);
}

/** Coordinates never authorize passing through a physical enclosure or private doorway. */
export function airExteriorReadiness(game: GameService, body: Cultivator, toName: string) {
    const world = game.atHand, to = world && worldLocationFor(world, toName);
    const area = world && theAreaTheyAreIn(world, body)?.area;
    if (to?.tags.includes('interior') || to && ['precinct', 'hall', 'chamber', 'vault'].includes(to.kind))
        return refused('engine.airExterior', 'ride', factsForRefusal('That is an interior, not a landing ground.',
            'Reach its exterior and use its ordinary door, access and invitation authority.',
            'Coordinates inherited from a parent do not pass a wall. No qi, fuel, receipt or time spent.'));
    if (aRoofOverWhereTheyStand(game, world, body) || area?.for === 'room')
        return refused('engine.airExterior', 'ride', factsForRefusal('The body is still inside a physical enclosure.',
            'Use the ordinary exit to actual exterior ground before launching.',
            'The flight does not bypass walls, a private door, a seal or its native exit clock. Nothing spent.'));
    return null;
}

/** All physical/route/art/qi reads precede the ordinary native art-use debit. */
export async function launchPersonalAirJourney(game: GameService, run: Run, body: Cultivator,
    toName: string, artId: string | null, days = Infinity):Promise<import('./turn-wire-shapes.js').Execution> {
    const world = game.atHand;
    const physical = world && worldLocationFor(world, body.location);
    const from = physical && exteriorGroundOfDeparture(world!, physical.id), to = world && worldLocationFor(world, toName);
    if(to&&(to.tags.includes('interior')||['precinct','hall','chamber','vault'].includes(to.kind))){
        const readiness=airExteriorReadiness(game,body,toName);
        if(readiness)return readiness;
    }
    const conveyance = conveyanceOfPersonalFlight(artId);
    const art = artId ? personalFlightArt(body, artId) : null;
    const qi = art?.qiCost ?? INNATE_FLIGHT_LAUNCH_QI;
    const quote = from && to && conveyance && world
        ? quoteAnAirJourney(world.locations, from.id, to.id, conveyance, null, 1,
            { facts: witnessIndexFor(world).byId, onDay: routineTime(world) }) : null;
    if (!body.alive || !world || !from || !to || !conveyance || !quote || !(quote.daysOneWay > 0)
        || (artId === null ? !canFlyByTheirOwnBody(body.realmOrdinal, brokenStatusesOn(body.injuries)) : !art))
        return refused('engine.airJourney', 'ride', factsForRefusal('This body cannot launch that flight.',
            artId === null ? 'Bodily flight opens at Void Tribulation, ordinal 29. An actual held flight art remains its own route.'
                : 'The actual held art, required rung and school gate must all permit it.',
            'No qi, body time, craft or location was spent; missing physical geometry cannot become a road-based air quote.'));
    if (body.qi < qi) return refused('engine.airJourney', 'ride', factsForRefusal('Not enough qi to launch.',
        'The launch costs ' + qi + ' qi; ' + body.qi + ' is held. Nothing is spent.',
        'The ordinary native per-use cost is not an invented daily upkeep.'));
    const approach=await walkToTheDeparture(game,run,body,from.id,null);
    if(approach)return approach;
    const current=game.currentRun();
    if(current.run.elapsedDays!==run.elapsedDays||current.cultivator.location!==body.location
        ||current.cultivator.standingIn!==body.standingIn)
        return launchPersonalAirJourney(game,current.run,current.cultivator,toName,artId,days);
    const readiness=airExteriorReadiness(game,body,toName);
    if(readiness)return readiness;
    if (art) {
        const charged = await useHeldTechnique({ action: 'use', cultivatorId: body.id, techniqueId: art.id },
            { resolvesOnTurn: run.turn + 1, finishTurn: false });
        if (!('used' in charged) || charged.used !== true) return refused('technique_manage.use', 'ride',
            factsForRefusal('The actual flight art cannot be used.', JSON.stringify(charged), 'No course was accepted.'));
    } else game.repos.cultivators.applyDeltas(body.id, { qi: -INNATE_FLIGHT_LAUNCH_QI });
    const previous=personalAirCourseClaim(game.db,body.id);
    const oldSite=previous&&world.locations.find(place=>place.id===previous.locationId);
    if(oldSite)stopAnAirCourse(world,oldSite,routineTime(world),'The actual body changed its heading.');
    const accepted = beginAnAirCourse(world, { bodyId: body.id, bodyName: body.name, fromId: from.id, toId: to.id,
        conveyanceId: conveyance.id, power: null, vesselId: null, artId, onDay: routineTime(world),
        runId: run.id, runElapsedDays: run.elapsedDays, heads: 1 });
    if (!accepted) throw new Error('Validated native air launch lost its actual course');
    game.repos.cultivators.update(body.id, { location: accepted.location.id, standingIn: null });
    holdPersonalAirCourse(game.db, body.id, accepted.location.id);
    game.theWorldMoved();
    const launchedBody = game.repos.cultivators.getById(body.id);
    if (!launchedBody) throw new Error('The actual launched body disappeared');
    const execution = await spendOnPersonalAirCourse(game, run, launchedBody, days);
    if (!execution) throw new Error('An accepted native air course lost its body receipt');
    execution.calls.unshift({ name: art ? 'technique_manage.use' : 'engine.bodyFlightLaunch', action: 'ride', ok: true,
        summary: qi + ' qi spent once at launch; direct metric separation ' + quote.distanceLi + ' li.' });
    execution.facts.lines.unshift('The flight launched with ' + qi + ' qi spent.');
    return execution;
}
