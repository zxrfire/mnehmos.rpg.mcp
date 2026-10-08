/** One residence damage commit for an actual player attempt or resolved NPC arrival. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { EncounterOccurrence } from '../engine/encounters/types.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { theActualResidenceDoor, whetherTheResidenceDoorCanBeBroken,
    breakTheResidenceDoor } from '../engine/world/a-residence-door-that-was-broken.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { resolveKnownPlace } from './entities.js';
import { canAct, hasBody } from '../engine/cultivation/existence.js';
import { whatTheyCouldBreakADoorWith } from './who-comes-to-settle-an-account.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { pathTo, reachThrough } from '../engine/world/architecture.js';
import { betweenRoadEndpoints } from './a-road-stopped-partway.js';
import { targetNameForDoorDestruction } from './trying-to-break-an-actual-vault-lock.js';

function commitDamage(game: GameService, target: LocationRecord,
    actor: { id: string; name: string }, strength: number, at: LocationRecord): string | null {
    const world = game.atHand;
    if (!world) return null;
    const answer = whetherTheResidenceDoorCanBeBroken(target, strength);
    if (!answer?.force.reaches) return null;
    const onDay = routineTime(world);
    const fact = appendWorldFact(world, makeFact({ day: onDay, kind: 'object_destroyed',
        summary: `${actor.name} broke ${answer.door.material.name} at ${target.name}.`,
        actors: [{ id: actor.id, name: actor.name, role: 'actor' }], locationId: at.id, place: at.name,
        factionIds: target.controllingFactionId ? [target.controllingFactionId] : [],
        data: { brokeWhat: `${answer.door.material.name} at ${target.name}`,
            doorLocationId: target.id, doorStandsAt: answer.door.material.standsAt,
            doorMaterial: answer.door.material.material }
    }), { recur: false });
    const changed = breakTheResidenceDoor(target, { strength, onDay,
        byName: actor.name, causeFactId: fact.id })!;
    world.locations[world.locations.indexOf(target)] = changed.location;
    fact.locationChangeIds.push(changed.change.id);
    game.theWorldMoved();
    return answer.force.cause;
}

/** Null retains the ordinary vault/object destroy path for non-residence targets. */
export async function tryingToBreakAnActualResidenceDoor(game: GameService, run: Run,
    supplied: Cultivator, said: string): Promise<Execution | null> {
    const namedDoor = targetNameForDoorDestruction(said);
    if (!namedDoor) return null;
    const world = game.atHand ?? await game.loadWorld();
    const body = game.repos.cultivators.getById(supplied.id);
    const reject = (line: string) => refused('engine.actualResidenceDoor', 'destroy',
        factsForRefusal(line, line, 'Residence door attempt: no breach, movement or transfer.'));
    if (!body || !canAct(body.existenceState) || !hasBody(body.existenceState)) {
        return reject('No living body here can attempt that door.');
    }
    if (betweenRoadEndpoints(game.db, body)) return reject('You are between road endpoints; that doorway is not within reach.');
    if (!world) return null;
    const resolved = resolveKnownPlace(namedDoor, body, game.scopeFor(body));
    const target = resolved ? world.locations.find(row => row.id === resolved.id) : null;
    const actualDoor = target ? theActualResidenceDoor(target) : null;
    if (!target || !actualDoor) return null;
    const hereId = game.worldPlaceOf(body);
    if (hereId !== target.id && hereId !== target.parentId) {
        return reject(`The door at ${target.name} is not within reach. Go to its actual outside ground first.`);
    }
    const here = world.locations.find(row => row.id === hereId);
    if (!here) return reject('There is no actual ground here from which to reach that door.');
    const membership = game.repos.sects.getMembership(body.id);
    const house = membership ? game.repos.sects.getById(membership.sectId) : null;
    const access = howThisCultivatorStandsInTheHouseHolding({ ground: here, cultivator: body,
        standing: membership && house ? { sectId: membership.sectId,
            rankIndex: membership.rankIndex, rankCount: house.ranks.length,
            joinedOnDay: membership.joinedOnDay } : null,
        objects: world.objects, onDay: routineTime(world) }).access;
    const reach = reachThrough(pathTo(world.locations, here.id), access, { enteredAt: here.id });
    if (reach.stoppedAt !== null || reach.level === 'barred') return reject(`The way to that door is barred. ${reach.reason}`);
    if (actualDoor.brokenOnDay !== null) return reject(`The physical door at ${target.name} is already broken. Other barriers retain their actual state.`);
    const strength = whatTheyCouldBreakADoorWith(world, body);
    const answer = whetherTheResidenceDoorCanBeBroken(target, strength)!;
    if (!answer.force.reaches) return reject(answer.force.cause);
    const cause = commitDamage(game, target, body, strength, here)!;
    return game.freeAction(run, 'destroy', factsForToolResult(`The physical door at ${target.name} is broken.`,
        [cause, 'Its qi seals, opening cycle, other gates and goods retain their actual state.'],
        'The actual residence slab was broken; no new permission, repair price or property settlement was invented.'));
}

/**
 * Invoked only by theyCameAtYou after a happened, selected, actionable arrival.
 * A future roll is not an actual arrival. Existing run-frame time is compared
 * within that same frame; the deed timestamp uses canonical actual world time.
 */
export function recordTheResidenceDoorBreachAtThisArrival(game: GameService, run: Run,
    supplied: Cultivator, occurrence: EncounterOccurrence,
    actor: { id: string; name: string; realmOrdinal: number }): Execution | null {
    const receipt = occurrence.door;
    if (receipt?.what !== 'broke_in' || !receipt.locationId) return null;
    const reject = (line: string) => refused('engine.actualResidenceDoorArrival', 'seclude',
        factsForRefusal(line, line, 'No actual residence door breach or fight committed. The prior span remains spent.'));
    const world = game.atHand;
    const body = game.repos.cultivators.getById(supplied.id);
    if (!world || !body || occurrence.absoluteDay > run.elapsedDays) return reject('That door arrival has not actually been reached.');
    if (!canAct(body.existenceState) || !hasBody(body.existenceState)) return reject('No living sitter remains here for that arrival.');
    const worldActor = world.npcs.find(row => row.id === actor.id);
    const actorExistence = worldActor?.status ?? game.repos.cultivators.getById(actor.id)?.existenceState;
    if (!actorExistence || !canAct(actorExistence) || !hasBody(actorExistence)) {
        return reject('No actual living sender remains to breach that residence door.');
    }
    if (betweenRoadEndpoints(game.db, body) || game.worldPlaceOf(body) !== receipt.locationId) {
        return reject('The sitter is no longer at the actual residence door named by that arrival.');
    }
    const target = world.locations.find(row => row.id === receipt.locationId);
    const actual = target ? theActualResidenceDoor(target) : null;
    if (!target || !actual) return reject('That arrival no longer has an actual residence door here.');
    // Already removed means no second breach; an actual attack can still follow.
    if (actual.brokenOnDay !== null) {
        delete occurrence.door;
        return null;
    }
    const strength = whatTheyCouldBreakADoorWith(world, actor);
    const answer = whetherTheResidenceDoorCanBeBroken(target, strength)!;
    if (!answer.force.reaches) return reject(answer.force.cause);
    commitDamage(game, target, actor, strength, target);
    // This transient happened receipt now describes the actual resolved material/force.
    occurrence.door = { ...receipt, doorName: answer.door.material.name,
        doorStandsAt: answer.door.material.standsAt, theirStrength: strength };
    return null;
}
