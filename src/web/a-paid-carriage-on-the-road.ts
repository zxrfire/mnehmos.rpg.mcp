import { arrivalCourseOfFact, recordActualBodyArrival } from '../engine/world/a-body-that-actually-arrived.js';
/** A paid claim points to the accepted passage; the real driver owns its clock. */
import { actualCarrierScene, selectedAreaOnActualCarrier } from './the-actual-carrier-scene.js';
import type Database from 'better-sqlite3';
import { CultivatorRepository } from '../storage/repos/cultivator.repo.js';
import { clearFlag, readJsonFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { publicCarriagePassage, groundOfTheAcceptedCarriage } from '../engine/world/public-carriages.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { stoppedRoadPoint } from '../engine/world/where-a-carriage-stopped.js';
import { roadContinuationAhead } from '../engine/world/road-course.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { loosePlaceKey } from './knowledge.js';
import { factsForRefusal, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

const STOPPED_ROAD = 'road_stopped';
interface APaidRoad { kind: 'paid_carriage'; receiptId: string }

export function thePaidCarriageClaim(db: Database.Database, playerId: string): APaidRoad | null {
    const held = readJsonFlag<Partial<APaidRoad>>(db, playerId, STOPPED_ROAD);
    return held?.kind === 'paid_carriage' && typeof held.receiptId === 'string'
        ? { kind: 'paid_carriage', receiptId: held.receiptId } : null;
}

export function keepThePaidCarriage(db: Database.Database, playerId: string, receiptId: string): void {
    writeFlag(db, playerId, STOPPED_ROAD, JSON.stringify({ kind: 'paid_carriage', receiptId } satisfies APaidRoad));
}

export function leaveThePaidCarriage(db: Database.Database, playerId: string): void {
    if (thePaidCarriageClaim(db, playerId)) clearFlag(db, playerId, STOPPED_ROAD);
}

/** Every clock boundary, including fractional conversations, reads the actual holder. */
export function carryThePaidPassenger(db: Database.Database, world: WorldState, playerId: string): void {
    const claim = thePaidCarriageClaim(db, playerId);
    if (!claim) return;
    const repository = new CultivatorRepository(db);
    const body = repository.getById(playerId);
    if (!body?.alive) { leaveThePaidCarriage(db, playerId); return; }
    const passage = publicCarriagePassage(world, claim.receiptId, playerId, routineTime(world));
    if (!passage) {
        const actualGround = groundOfTheAcceptedCarriage(world, claim.receiptId, playerId, routineTime(world));
        const ground = actualGround && world.locations.find(place => place.id === actualGround);
        if (ground) repository.update(playerId, { location: ground.name, standingIn: null });
        leaveThePaidCarriage(db, playerId);
        const point=ground&&stoppedRoadPoint(world.locations,ground.id);
        const accepted=world.history.facts.find(fact=>fact.id===claim.receiptId);
        const to=typeof accepted?.data.toLocationId==='string'?world.locations.find(place=>place.id===accepted.data.toLocationId):undefined;
        const course=point&&to&&roadContinuationAhead(world.locations,point,to.id);
        if(ground&&course&&course.days>0)writeFlag(db,playerId,STOPPED_ROAD,JSON.stringify({from:ground.name,to:to!.name,road:course.days,walked:0,stoppedLocationId:ground.id}));
        return;
    }
    const ground = world.locations.find(place => place.id === passage.locationId);
    if (!ground) { leaveThePaidCarriage(db, playerId); return; }
    const area = theAreasOf(world, ground).whereIs.get(passage.driver.id);
    const carried = repository.update(playerId, { location:ground.name, standingIn:body.standingIn })!;
    const scene = actualCarrierScene({db}, carried, world, routineTime(world));
    repository.standIn(playerId, scene ? selectedAreaOnActualCarrier(world, scene, carried) : area ?? null);
    if (passage.arrived) {
        recordActualBodyArrival(world, { id: carried.id, name: carried.name, alive: carried.alive, locationId: ground.id },
            arrivalCourseOfFact(passage.receipt), routineTime(world), passage.receipt);
        leaveThePaidCarriage(db, playerId);
    }
}

/** Same destination/continue uses the paid ride; an explicit other way disembarks. */
export async function continueThePaidCarriage(game: GameService, run: Run, player: Cultivator,
    target: string | undefined, mode: 'move' | 'ride' | 'passage', explicitlyOnFoot = false): Promise<Execution | null> {
    const claim = thePaidCarriageClaim(game.db, player.id);
    if (!claim || !game.atHand) return null;
    if (explicitlyOnFoot) { leaveThePaidCarriage(game.db, player.id); return null; }
    const passage = publicCarriagePassage(game.atHand, claim.receiptId, player.id, routineTime(game.atHand));
    if (!passage) {
        leaveThePaidCarriage(game.db, player.id);
        return refused('engine.thePaidCarriage', mode, factsForRefusal(
            'That paid carriage cannot carry you onward.',
            'Its actual driver or carriage is no longer carrying this passage. No new fare was paid.',
            'The old paid claim cannot recall a departed or lost carrier.'));
    }
    const to = game.atHand.locations.find(place => place.id === passage.leg.toId);
    const ground = game.atHand.locations.find(place => place.id === passage.locationId);
    const wanted = (target ?? '').trim();
    const sameWay = wanted.length === 0 || /^(?:on|onward|onwards|ahead|forward)$/i.test(wanted)
        || loosePlaceKey(wanted) === loosePlaceKey(to?.name ?? '');
    if (!sameWay) { leaveThePaidCarriage(game.db, player.id); return null; }
    if (!ground || loosePlaceKey(placeName(player)) !== loosePlaceKey(ground.name)) {
        leaveThePaidCarriage(game.db, player.id);
        return refused('engine.thePaidCarriage', mode, factsForRefusal(
            'The carriage is no longer beside you.', 'Your paid seat does not move its actual driver back here.',
            'Actual passenger ground does not match the actual carrier. Nothing spent.'));
    }
    if (passage.arrived || !to) { leaveThePaidCarriage(game.db, player.id); return null; }
    const done = await game.takeTheSeat(run, player, { service: 'carriage', to: to.name,
        days: passage.remainingDays, walkingDays: 0, stones: 0, escort: 0,
        bought: 'Continuing the same paid carriage; no second fare.', roadReceiptId: claim.receiptId });
    if (done.outcome !== 'executed' || done.cutShort || done.timeSkip?.died
        || !game.repos.cultivators.getById(player.id)?.alive) return done;
    const after = game.currentRun();
    if (loosePlaceKey(placeName(after.cultivator)) === loosePlaceKey(to.name)) {
        const arrived = `The already paid carriage reached ${to.name}; no additional fare was charged.`;
        done.facts.lines.push(arrived); (done.facts.required ??= []).push(arrived);
        done.facts.headline = `${to.name}, by the already paid carriage.`;
        game.noteEncounter(after.cultivator, after.run, { kind: 'place', id: to.name, name: to.name },
            'witnessed', `Arrived aboard the accepted carriage on day ${after.run.elapsedDays}.`);
    }
    return done;
}

