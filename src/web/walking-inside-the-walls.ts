/**
 * Walking from one room of a compound to another.
 *
 * `growCompound` cuts every seated house a gatehouse, a forecourt, precincts and
 * rooms, and the ordinary move verb reached none of them: a room's name is
 * `<house>: the lecture hall`, which is not a string a player types, and the
 * loose match that `worldLocationFor` falls back on would have sent somebody
 * to the first lecture hall in the world, in whichever house the catalog listed
 * first. So a player on a house's ground could not go in, and could not come
 * back out.
 *
 * ── WHAT DECIDES IT, ALL OF IT ALREADY BUILT ─────────────────────────────
 *
 *   which rooms there are     the compound this player is standing in, and no
 *                             other house's rooms
 *   whether they know where   `roomStageFor` at `placed`, the floor
 *                             `roomsVisibleTo` names for the rooms a viewer
 *                             could set out for. Below it the answer is the
 *                             same as for a room that does not exist, so the
 *                             refusal does not tell anybody what is inside
 *   whether they get there    `reachThrough` down `pathTo`, from the seat: the
 *                             walls and doors between the gate and the room
 *   whether they are seen     the trust read a lecture hall already uses, over
 *                             whoever of the house is standing in the room
 *
 * The seat is the gate and the forecourt it opens on, so going out to the
 * forecourt, the gatehouse or the gate is going back to the seat, and nothing
 * stops anybody walking out of a building.
 *
 * NO DAY PASSES. A compound is crossed in the time it takes to walk it, which
 * is the same flat nothing that looking at it costs.
 */

import { isAtLeast } from '../engine/social/discovery.js';
import {
    pathTo,
    purposeOf,
    reachThrough,
    roomStageFor
} from '../engine/world/architecture.js';
import type { LocationRecord } from '../engine/world/locations.js';
import {
    npcsStandingIn,
    theSeatOfTheCompound,
    whereCompoundsAre
} from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { ROOMS_A_THING_IS_MADE_IN, type WhatIsBeingMade } from '../engine/world/architecture.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import {
    A_MASTERS_DWELLING,
    theLessonYourMasterCalledYouTo,
    whereYourMasterLives
} from './a-master-calls-their-disciples-in.js';

/** The words for going back to the seat: the gate, and the court it opens on. */
const BACK_TO_THE_GATE =
    /^(?:out|outside|(?:the\s+)?(?:gate|gates|gatehouse|forecourt|courtyard|entrance|front|mouth|entry\s+cut))$/;

/** A name that is about a room, whether or not this house has that room. */
const A_ROOM_WORD =
    /\b(?:hall|halls|yard|pavilion|archive|quarters|dormitory|refectory|infirmary|workshop|cell|cells|chamber|room|treasury|residence|precinct|court|gatehouse|forecourt|cut|cuts|floor)\b/;

/** The words a compound's own ground is called by, after its name. */
const A_GROUND_WORD = /\s+(?:grounds?|compound|seat|estate|ground)$/;

/**
 * Whether what they said is the house's own name rather than a room in it.
 *
 * The seat row is named `<house> grounds`, so both the bare name and the name
 * with a ground word after it are the same place. Compared whole rather than
 * contained: a room called the Azure Hall inside the Azure Cloud Pavilion is
 * still a room.
 */
function namesTheHouseItself(seat: LocationRecord, wanted: string): boolean {
    const bare = (said: string): string =>
        said.toLowerCase().replace(A_GROUND_WORD, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const asked = bare(wanted);
    return asked.length > 0 && asked === bare(seat.name);
}

/** What a player typed, as a room would be named. */
function asARoomIsNamed(said: string): string {
    return said.trim().toLowerCase()
        .replace(/[.!?]+$/, '')
        .replace(/^(?:back\s+)?(?:out\s+|in\s+|inside\s+|into\s+)?(?:to\s+)?/, '')
        .replace(/^the\s+/, '')
        .trim();
}

/** A room's own name, without its house. */
export function aRoomsOwnName(room: LocationRecord): string {
    const at = room.name.indexOf(': ');
    return (at < 0 ? room.name : room.name.slice(at + 2)).replace(/^the\s+/i, '');
}

function namesThisRoom(room: LocationRecord, wanted: string): boolean {
    const own = aRoomsOwnName(room).toLowerCase();
    const purpose = (purposeOf(room) ?? '').replace(/_/g, ' ');
    return own === wanted || purpose === wanted || (wanted.length >= 4 && own.endsWith(` ${wanted}`));
}

/**
 * Going to the room a piece of work is done in, before doing it.
 *
 * Somebody of a house who sits down to refine a pill or work a made thing inside
 * that house's walls does it in the room cut for it, the same rooms
 * `ROOMS_A_THING_IS_MADE_IN` reads the house's own people into. Only your own
 * house, only where it has the room, and only through the same walls a walk
 * goes through: a room this person could not walk to is not one they go to
 * work in. Nothing else moves them, and a communication talisman, which is cut
 * wherever the cutter is sitting, moves nobody.
 *
 * Returns the line that says where they went, or null where they stayed put.
 */
export function intoTheRoomTheWorkIsDoneIn(
    game: GameService,
    cultivator: Cultivator,
    making: WhatIsBeingMade | null
): string | null {
    const world = game.atHand;
    if (!world || making === null) return null;
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    const compounds = whereCompoundsAre(world);
    const hereId = game.worldPlaceOf(cultivator);
    const seat = theSeatOfTheCompound(world, hereId, compounds);
    if (seat === null || hereId === null) return null;
    const compound = compounds.bySeat.get(seat.id)!;
    if (compound.houseId !== membership.sectId) return null;
    const room = ROOMS_A_THING_IS_MADE_IN[making]
        .map(purpose => compound.rooms.get(purpose))
        .find((one): one is LocationRecord => one !== undefined);
    if (!room || room.id === hereId) return null;
    const house = game.repos.sects.getById(membership.sectId);
    const { access } = howThisCultivatorStandsInTheHouseHolding({
        ground: room,
        cultivator,
        standing: house
            ? { sectId: membership.sectId, rankIndex: membership.rankIndex, rankCount: house.ranks.length }
            : null,
        onDay: Math.floor(world.currentDay)
    });
    const reach = reachThrough(pathTo(world.locations, room.id), access, { enteredAt: seat.id });
    if (reach.stoppedAt !== null || reach.level === 'barred') return null;
    game.repos.cultivators.update(cultivator.id, { location: room.name });
    return `You go to ${room.name} to do the work.`;
}

/**
 * A walk inside the walls of the compound this player is standing in, or null
 * where the sentence is not about one and the ordinary road should answer it.
 */
export async function aWalkInsideTheWalls(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined
): Promise<Execution | null> {
    const said = (target ?? '').trim();
    if (said.length === 0) return null;
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    if (!world) return null;

    const compounds = whereCompoundsAre(world);
    const hereId = game.worldPlaceOf(cultivator);
    const seat = theSeatOfTheCompound(world, hereId, compounds);
    if (seat === null || hereId === null) return null;
    const here = world.locations.find(row => row.id === hereId)!;
    const compound = compounds.bySeat.get(seat.id)!;
    const wanted = asARoomIsNamed(said);

    // ── WHICH ROOM ───────────────────────────────────────────────────────
    const inside = world.locations.filter(row => compound.inside.has(row.id)
        && purposeOf(row) !== 'formation_node');
    // Where the player's master lives, named as that, and whether the master
    // has called them there. See `a-master-calls-their-disciples-in.ts`.
    const called = theLessonYourMasterCalledYouTo(game, world, cultivator);
    const named = BACK_TO_THE_GATE.test(wanted)
        ? seat
        : A_MASTERS_DWELLING.test(wanted)
            ? whereYourMasterLives(game, world, cultivator)?.dwelling ?? null
            : inside.find(row => namesThisRoom(row, wanted)) ?? null;
    const destination = named !== null && ['gatehouse', 'forecourt'].includes(purposeOf(named) ?? '')
        ? seat
        : named;

    // ── NAMING THE HOUSE IS NOT NAMING A ROOM IN IT ──────────────────────
    //
    // The design owner's ruling on arriving: *"Saying you go to the sect lands
    // you at the gate. you have to cash in that favor with the host, right? you
    // have to get waved past the people at the door."* So a sentence that names
    // the HOUSE is about its gate, and it belongs to the road rather than to
    // this walk across a compound - handed back as null so the travel verb
    // answers it with the gate read, where a host who owes you can walk you in.
    //
    // Measured, and it is the third time tonight a word has matched inside a
    // name rather than as the thing named: a player standing at the gate of the
    // Azure Cloud Pavilion typed "I travel to the Azure Cloud Pavilion grounds"
    // and this refused it, because `A_ROOM_WORD` lists `pavilion` - which is in
    // the HOUSE'S OWN NAME. The answer was "nobody has shown you anywhere
    // called Azure Cloud Pavilion grounds inside Azure Cloud Pavilion grounds",
    // which is the engine telling somebody standing at a door that the door is
    // not there.
    //
    // Only the house's own name, with a ground word after it if they said one.
    // A room whose name merely contains the house's is still a room.
    if (namesTheHouseItself(seat, wanted)) return null;

    const membership = game.repos.sects.getMembership(cultivator.id);
    const house = membership ? game.repos.sects.getById(membership.sectId) : null;
    const standingIn = (ground: LocationRecord) => howThisCultivatorStandsInTheHouseHolding({
        ground,
        cultivator,
        standing: membership && house
            ? { sectId: membership.sectId, rankIndex: membership.rankIndex, rankCount: house.ranks.length }
            : null,
        onDay: Math.floor(world.currentDay)
    });

    // NOT A ROOM THIS PERSON COULD SET OUT FOR. The same answer whether the
    // house has no such room or has one they have not been shown, so asking is
    // not a way to find out what is inside.
    // Being called somewhere is being told where it is.
    const invited = destination !== null && called?.dwelling.id === destination.id;
    const known = destination !== null
        && (destination.id === seat.id || invited
            || isAtLeast(roomStageFor(destination, standingIn(destination).viewer), 'placed'));
    if (!known) {
        const elsewhere = worldLocationFor(world, said);
        if (!A_ROOM_WORD.test(wanted) && !(elsewhere?.tags.includes('interior'))) return null;
        return refused('engine.walkInsideTheWalls', 'move', factsForRefusal(
            `Nowhere inside ${seat.name} you could walk to by that name.`,
            `Nobody has shown you anywhere called ${said} inside ${seat.name}. What you can find `
            + 'your way to in here is what you can see from where you are standing, and what the '
            + 'house has shown you.',
            `walkInsideTheWalls: "${wanted}" names no room of ${compound.houseId} placed for this `
            + 'viewer (roomStageFor below placed, or no such room). Location unchanged, no time passed.'
        ));
    }

    if (destination.id === here.id) {
        return refused('engine.walkInsideTheWalls', 'move', factsForRefusal(
            `You are already in ${aRoomsOwnName(destination)}.`,
            `You are standing in ${destination.name} already.`,
            `walkInsideTheWalls: destination ${destination.id} is where they stand. Nothing spent.`
        ));
    }

    // ── WHETHER THEY GET THERE ───────────────────────────────────────────
    // Out is always open: nothing stops anybody leaving a building. And a
    // disciple called to their master's room is let through to it; nobody else is.
    if (destination.id !== seat.id && !invited) {
        const reach = reachThrough(
            pathTo(world.locations, destination.id), standingIn(destination).access, { enteredAt: seat.id }
        );
        if (reach.stoppedAt !== null || reach.level === 'barred') {
            const stop = world.locations.find(row => row.id === reach.stoppedAt) ?? destination;
            return refused('engine.walkInsideTheWalls', 'move', factsForRefusal(
                `You do not get as far as ${aRoomsOwnName(destination)}.`,
                stop.id === destination.id
                    ? `${destination.name} does not let you in. ${reach.reason}`
                    : `The way to ${aRoomsOwnName(destination)} goes through ${stop.name}, and you `
                      + `do not get past it. ${reach.reason}`,
                `reachThrough(${destination.id}) from ${seat.id}: ${reach.level}, stopped at `
                + `${reach.stoppedAt ?? 'nothing (barred at the room)'}. Location unchanged, no time passed.`
            ));
        }
    }

    // ── THE WALK ─────────────────────────────────────────────────────────
    game.repos.cultivators.update(cultivator.id, { location: destination.name });
    game.repos.runs.incrementTurn(run.id, 1);
    const walked: Cultivator = { ...cultivator, location: destination.name };
    const people = npcsStandingIn(world, destination.id, compounds);
    const out = destination.id === seat.id;
    const line = out
        ? `You walk out of ${aRoomsOwnName(here)} and back to the gate, and you are standing at ${seat.name}.`
        : `You walk from ${here.id === seat.id ? 'the gate' : aRoomsOwnName(here)} into ${destination.name}.`;
    const facts = factsForToolResult(line, [
        line,
        people.length === 0
            ? 'Nobody is in it.'
            : `${people.length} ${people.length === 1 ? 'person is' : 'people are'} in it.`
    ]);
    facts.required = [line];
    facts.structure.push(
        `walkInsideTheWalls: ${here.id} to ${destination.id}, inside ${seat.id}. No time passed; `
        + `${people.length} standing there by npcsStandingIn.`
    );
    const execution: Execution = {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'world.walkInsideTheWalls',
            action: 'move',
            summary: `${cultivator.name} walked to ${destination.name}. Location written, no time passed.`,
            ok: true
        }]
    };

    // ── AND WHETHER THE HOUSE'S PEOPLE IN THE ROOM SEE THEY DO NOT BELONG ──
    if (!out) {
        const seen = game.whetherTheySeeYouDoNotBelongAmong(run, walked, '', {
            witnesses: people,
            doing: `walking into ${aRoomsOwnName(destination)}`,
            frontOfTheRoom: null,
            action: 'move'
        });
        if (seen.caught) {
            seen.caught.facts.lines.unshift(line);
            return seen.caught;
        }
        if (seen.passed) execution.facts.structure.push(seen.passed);
    }
    return execution;
}
