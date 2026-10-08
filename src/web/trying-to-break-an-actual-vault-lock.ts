/** Explicit physical vault-lock destruction; no approach, admission or stock grant.
 * The owner ruling permits force when a key is missing. The generated own-lock
 * entry rating and the existing NPC door-strength reader are the authorities.
 * This records the physical deed, not an invented repair invoice or settlement.
 */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { asARoomIsNamed, namesThisRoom } from './walking-inside-the-walls.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { whatTheyCouldBreakADoorWith } from './who-comes-to-settle-an-account.js';
import { pathTo, reachThrough, roomStageFor } from '../engine/world/architecture.js';
import { canAct, hasBody } from '../engine/cultivation/existence.js';
import { isAtLeast } from '../engine/social/discovery.js';
import { whereCompoundsAre, theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { theActualVaultLock, whetherTheActualVaultLockCanBeBroken, breakTheActualVaultLock } from '../engine/world/forcing-an-actual-vault-lock.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';

/** Existing explicit door/lock target syntax, shared by physical door adapters. */
export function targetNameForDoorDestruction(said: string): string | null {
    const match = said.match(/^(?:the\s+)?(?:door|lock)\s+(?:of|on|to)\s+(.+)$/i)
        ?? said.match(/^(.+?)\s+(?:door|lock)$/i);
    return match?.[1] ?? null;
}

export async function tryingToBreakAnActualVaultLock(game: GameService, run: Run,
    supplied: Cultivator, said: string): Promise<Execution | null> {
    // A named object without a door/lock expression retains ordinary destruction.
    const namedDoor = targetNameForDoorDestruction(said);
    if (!namedDoor) return null;
    const world = game.atHand ?? await game.loadWorld();
    const body = game.repos.cultivators.getById(supplied.id);
    const reject = (line: string) => refused('engine.actualVaultLock', 'destroy',
        factsForRefusal(line, line, 'Actual vault lock attempt: no physical breach or movement.'));
    if (!world || !body || !canAct(body.existenceState) || !hasBody(body.existenceState)) return reject('No living body here can attempt that door.');
    const hereId = game.worldPlaceOf(body);
    const compounds = whereCompoundsAre(world);
    const seat = theSeatOfTheCompound(world, hereId, compounds);
    const compound = seat ? compounds.bySeat.get(seat.id) : null;
    if (!compound || !seat) return reject('There is no reachable house vault lock here.');
    const membership = game.repos.sects.getMembership(body.id);
    const house = membership ? game.repos.sects.getById(membership.sectId) : null;
    const onDay = routineTime(world);
    const wanted = asARoomIsNamed(namedDoor);
    const standing = membership && house ? { sectId: membership.sectId,
        rankIndex: membership.rankIndex, rankCount: house.ranks.length,
        joinedOnDay: membership.joinedOnDay } : null;
    const known = world.locations.filter(room => compound.inside.has(room.id)
        && namesThisRoom(room, wanted) && isAtLeast(roomStageFor(room,
            howThisCultivatorStandsInTheHouseHolding({ ground: room, cultivator: body,
                standing, objects: world.objects, onDay }).viewer), 'placed'));
    if (known.length !== 1) return reject('No uniquely known vault door here is called that.');
    const target = known[0];
    const lock = theActualVaultLock(target);
    if (!lock) return reject('That door has no modeled noncyclic vault lock to break. Its other barriers remain.');
    if (target.parentId !== hereId) return reject(`The lock on ${target.name} is not within reach. Go to its actual outside ground first.`);
    const parent = world.locations.find(row => row.id === target.parentId)!;
    const access = howThisCultivatorStandsInTheHouseHolding({ ground: parent, cultivator: body,
        standing, objects: world.objects, onDay }).access;
    const reach = reachThrough(pathTo(world.locations, parent.id), access, { enteredAt: seat.id });
    if (reach.stoppedAt !== null || reach.level === 'barred') return reject(`The way to that door is barred. ${reach.reason}`);
    const strength = whatTheyCouldBreakADoorWith(world, body);
    const answer = whetherTheActualVaultLockCanBeBroken(target, strength)!;
    if (!answer.force.reaches) return reject(answer.force.cause);
    // The fact and physical change commit synchronously from these fresh reads.
    const fact = appendWorldFact(world, makeFact({ day: onDay, kind: 'object_destroyed',
        summary: `${body.name} broke the lock on ${target.name}.`,
        actors: [{ id: body.id, name: body.name, role: 'actor' }],
        locationId: parent.id, place: parent.name,
        factionIds: target.controllingFactionId ? [target.controllingFactionId] : [],
        data: { brokeWhat: lock.name, doorLocationId: target.id, doorStandsAt: lock.standsAt, doorRatingSource: lock.source }
    }), { recur: false });
    const changed = breakTheActualVaultLock(target, { strength, onDay,
        byName: body.name, causeFactId: fact.id })!;
    world.locations[world.locations.indexOf(target)] = changed.location;
    fact.locationChangeIds.push(changed.change.id);
    game.theWorldMoved();
    return game.freeAction(run, 'destroy', factsForToolResult(`The lock on ${target.name} is broken.`,
        [answer.force.cause, 'The lock is removed. Other gates, wards, room hazards and goods retain their actual state.'],
        `Physical vault lock breach ${changed.change.id}; fact ${fact.id}. No repair price or property settlement was invented.`));
}
