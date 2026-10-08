import {playersAwaitingPilotsWord,beginPilotsOnwardAtEndpoint} from './a-pilots-onward-word.js';
import {playersAwaitingDriversWord,beginDriversOnwardAtEndpoint} from './a-drivers-onward-word.js';
import {settleLostPublicPassages} from '../engine/world/passenger-on-a-vessel.js';
import {playersAwaitingOnwardPassage,beginAgreedOnwardPassagesAtPort} from './a-captains-onward-word.js';
import { arrivalCourseOfFact, recordActualBodyArrival } from '../engine/world/a-body-that-actually-arrived.js';
import { projectPersonalAirPassenger } from './an-actual-personal-air-course.js';
import { physicalPassageScene, selectedAreaOnActualCarrier } from './the-actual-carrier-scene.js';
import { projectOwnedPassenger } from './an-owned-passage.js';
/** Accepted public passengers follow the actual source at the current world boundary. */
import type Database from 'better-sqlite3';
import type { WorldState } from '../engine/world/world-state.js';
import { CultivatorRepository } from '../storage/repos/cultivator.repo.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { shipPassengerAt } from '../engine/world/passenger-on-a-vessel.js';
import { carryThePaidPassenger } from './a-paid-carriage-on-the-road.js';
import { recordedVoyage, endTheVoyage } from './a-ship-at-sea.js';

export function projectActualPassengers(db: Database.Database, world: WorldState,
    playerId:string,onDay:number):void {
    settleLostPublicPassages(world,onDay);
    const ids=new Set([playerId,...playersAwaitingOnwardPassage(world),...playersAwaitingDriversWord(world),...playersAwaitingPilotsWord(world)]);
    for(const id of ids) projectOneActualPassenger(db,world,id,onDay);
    beginAgreedOnwardPassagesAtPort(db,world,onDay);
    beginDriversOnwardAtEndpoint(db,world,onDay);
    beginPilotsOnwardAtEndpoint(db,world,onDay);
    for(const id of ids) projectOneActualPassenger(db,world,id,onDay);
}

function projectOneActualPassenger(db: Database.Database, world: WorldState,
    playerId: string, onDay: number): void {
    projectPersonalAirPassenger(db, world, playerId, onDay);
    carryThePaidPassenger(db, world, playerId);
    projectOwnedPassenger(db, world, playerId, onDay);
    const claim = recordedVoyage(db, playerId);
    if (!claim?.receiptId) return;
    const repos = new CultivatorRepository(db), body = repos.getById(playerId);
    if (!body?.alive) { endTheVoyage(db, playerId); return; }
    const actual = shipPassengerAt(world, claim.receiptId, onDay);
    const place = actual?.locationId && world.locations.find(row => row.id === actual.locationId);
    if (!actual || !place) return;
    const master = actual.crew.find(person => person.identity.occupation === 'shipmaster') ?? actual.crew[0];
    const deck = master ? theAreasOf(world, place).whereIs.get(master.id) : undefined;
    // First commit the existing actual carrier ground, then derive its current hull area.
    // SQL standingIn is the only selected-area fact; an hourly region shuffle cannot move it.
    const carried = repos.update(playerId, { location:place.name, standingIn:body.standingIn })!;
    const scene = physicalPassageScene({db}, carried, world, onDay);
    repos.standIn(playerId, scene ? selectedAreaOnActualCarrier(world, scene, carried) : deck ?? null);
    if (actual.arrived && actual.unavailable === null) {
        recordActualBodyArrival(world, { id: carried.id, name: carried.name, alive: carried.alive, locationId: place.id },
            arrivalCourseOfFact(actual.receipt), onDay, actual.receipt);
    }
    if (actual.arrived) endTheVoyage(db, playerId);
}
