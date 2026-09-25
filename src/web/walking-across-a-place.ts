/**
 * Walking from one area of a place to another: the street to the inn, the gate to the forecourt.
 *
 * A place's people are read into areas of at most three (`where-in-a-place-somebody-is-standing.ts`)
 * and the player stands in one of them, so who is "here" is who is in that one. This is the walk
 * between them, and what the scene is told about the rest. The same shape as
 * `walking-inside-the-walls.ts`: every area of a place is open to anybody in it, except that the
 * forecourt of a house is behind its gate, and the gate is asked.
 *
 * WHERE THE PLAYER IS, stored as the area they walked to (`Cultivator.standingIn`) and cleared by
 * any change of `location`, so arriving anywhere by road lands where a road arrives.
 *
 * NO DAY PASSES. A place is crossed in the time it takes to walk it.
 */

import {
    aRoomOfTheirOwn,
    theAreasOf,
    theOneOnWatchAtTheGate,
    whoCouldBeSentToTheGate,
    whereInThisPlaceTheyStand,
    npcsInTheArea,
    type AnAreaOfAPlace,
    type WhatAnAreaIsFor
} from '../engine/world/where-in-a-place-somebody-is-standing.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import { theHouseWhoseGateThisIs, whatTheGateOfThisHouseSays } from './walking-up-to-a-house.js';
import { whereTheyAreLodged } from './a-room-at-an-inn.js';

/** The words for a kind of area, where a place has no area by that exact name. */
const A_WORD_FOR: ReadonlyArray<[RegExp, WhatAnAreaIsFor]> = [
    [/^(?:street|streets|square|out|outside)$/, 'street'],
    [/^(?:market|markets|marketplace|market place|stalls?|stall row|row)$/, 'market'],
    [/^(?:inn|teahouse|tea house|tavern|wine shop|wineshop|eating house|restaurant|downstairs|common room)$/, 'table'],
    [/^(?:gate|gates|outside the gate|out|outside)$/, 'gate'],
    [/^(?:forecourt|courtyard|yard|in|inside)$/, 'forecourt']
];

/**
 * A room of their own at the inn: "my room", "the room", "upstairs", "my bed", and a bare
 * "room" or "bed", which is how a model hands the same sentence over (played: "ok head up to
 * my room" came as target "room", and reached a house's interior room somewhere else).
 */
const A_ROOM_OF_THEIR_OWN = /^\s*(?:the\s+)?(?:inn\s+)?(?:room|bed)\s*$|\b(?:(?:my|our|the)\s+(?:inn\s+)?(?:room|bed)|upstairs)\b/i;

/** What a player typed, as an area would be named, without its article. */
function asAnAreaIsNamed(said: string): string {
    return said.trim().toLowerCase()
        .replace(/[.!?]+$/, '')
        .replace(/^(?:back\s+)?(?:out\s+|in\s+|inside\s+|into\s+|over\s+|across\s+|down\s+)?(?:to\s+)?/, '')
        .replace(/^the\s+/, '')
        .trim();
}

function ownName(area: AnAreaOfAPlace): string {
    return area.name.replace(/^the\s+/, '');
}

/** The area of this place a sentence names, or null where it names none. */
function theAreaNamed(areas: readonly AnAreaOfAPlace[], wanted: string): AnAreaOfAPlace | null {
    if (wanted.length === 0) return null;
    const exact = areas.find(area => ownName(area) === wanted)
        ?? areas.find(area => wanted.length >= 4 && ownName(area).endsWith(` ${wanted}`));
    if (exact) return exact;
    for (const [word, kind] of A_WORD_FOR) {
        if (!word.test(wanted)) continue;
        const first = areas.find(area => area.for === kind);
        if (first) return first;
    }
    return null;
}

/** The place this player is standing in and the area of it, or null where the world has neither. */
export function theAreaTheyAreIn(
    world: WorldState | null,
    cultivator: Pick<Cultivator, 'location' | 'standingIn' | 'sectId'>
): { place: LocationRecord; area: AnAreaOfAPlace } | null {
    if (!world) return null;
    const place = worldLocationFor(world, cultivator.location);
    if (!place) return null;
    return { place, area: whereInThisPlaceTheyStand(world, place, cultivator.standingIn, cultivator.sectId ?? null) };
}

/**
 * The other areas of the place this player is standing in, by name, for the scene: every one
 * somebody is in, and the first of each kind.
 */
export function theRestOfThisPlace(game: GameService, cultivator: Cultivator): string[] {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here) return [];
    const { areas, whereIs } = theAreasOf(game.atHand, here.place);
    const occupied = new Set(whereIs.values());
    const firsts = new Set(areas.filter((area, i) => areas.findIndex(one => one.for === area.for) === i).map(a => a.id));
    return areas
        .filter(area => area.id !== here.area.id && (occupied.has(area.id) || firsts.has(area.id)))
        .map(area => area.name);
}

/**
 * The place as the scene names it: the place, and the area of it where that is not simply where
 * a road arrives. Outside a house's gate is always said, so a scene never puts somebody the gate
 * turned away inside the grounds.
 */
export function thePlaceAsTheSceneNamesIt(game: GameService, cultivator: Cultivator, place: string): string {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!here || !game.atHand) return place;
    const first = theAreasOf(game.atHand, here.place).areas[0]!;
    return here.area.id === first.id && here.area.for !== 'gate' ? place : `${place}, ${here.area.name}`;
}

/**
 * Where a life opens in its town: the area of it holding the most people they grew up knowing,
 * then the most people, so a run opens among faces with names rather than in an empty street.
 * Arriving by road is still the street. Returns the cultivator as stored after.
 */
export function openAmongThePeopleOfTheirPlace(game: GameService, cultivator: Cultivator): Cultivator {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here) return cultivator;
    const { areas, whereIs } = theAreasOf(game.atHand, here.place);
    const score = (areaId: string): [number, number] => {
        const ids = [...whereIs.entries()].filter(([, at]) => at === areaId).map(([id]) => id);
        return [ids.filter(id => game.knowledge.isAwareOf(cultivator.id, 'cultivator', id)).length, ids.length];
    };
    const best = areas.map(area => ({ area, by: score(area.id) }))
        .reduce((top, one) => (one.by[0] > top.by[0] || (one.by[0] === top.by[0] && one.by[1] > top.by[1]) ? one : top));
    game.repos.cultivators.standIn(cultivator.id, best.area.id);
    return game.repos.cultivators.getById(cultivator.id) ?? cultivator;
}

/** Stand them in the first area of a kind of the place they are in, where it has one. */
export function standThemIn(game: GameService, cultivator: Cultivator, kind: WhatAnAreaIsFor): void {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here) return;
    const area = theAreasOf(game.atHand, here.place).areas.find(one => one.for === kind);
    if (area) game.repos.cultivators.standIn(cultivator.id, area.id);
}

/** Whether the gate lets this person in: on the roll and known, or brought in by a host. */
export function theGateLetsThemIn(way: string): boolean {
    return way === 'on the roll' || way === 'brought in';
}

/**
 * Whether this player is standing outside a house's gate, and what the gate says to them, where
 * it would not let them through. Null where they are not outside one, or it lets them in.
 */
export function theGateBetweenThemAndIt(
    game: GameService,
    cultivator: Cultivator
): { facts: string[]; structure: string } | null {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here || here.area.for !== 'gate') return null;
    const house = theHouseWhoseGateThisIs(game.atHand, here.place.name);
    if (!house) return null;
    const said = whatTheGateOfThisHouseSays(game, cultivator, house);
    return theGateLetsThemIn(said.way) ? null : { facts: said.facts, structure: said.structure };
}

/**
 * A walk across the place this player is standing in, or null where the sentence is not about an
 * area of it and the ordinary road should answer it.
 */
export async function aWalkAcrossThePlace(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined
): Promise<Execution | null> {
    const said = (target ?? '').trim();
    if (said.length === 0) return null;
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    const here = theAreaTheyAreIn(world, cultivator);
    if (!world || !here) return null;

    // THE ROOM THEY PAID FOR, alone but for whoever is with them. Played: "head up to my room"
    // reached a house's interior room somewhere else and was refused. See `aRoomOfTheirOwn`.
    // A ROOM OF THEIR OWN, which the owner puts "at an inn (or in your sect, or a cave)": the room
    // paid for at the inn here, or their quarters at their own house's seat once past its gate. A
    // cave that is theirs is the whole place. Anywhere else "my room" is the home read's to answer.
    const aRoomIsMeant = A_ROOM_OF_THEIR_OWN.test(said);
    const atTheirOwnSeat = aRoomIsMeant && cultivator.sectId !== null
        && theHouseWhoseGateThisIs(world, here.place.name)?.factionId === cultivator.sectId
        && theGateBetweenThemAndIt(game, cultivator) === null;
    const theirs = aRoomIsMeant && (whereTheyAreLodged(game, cultivator) !== null || atTheirOwnSeat);
    let destination = theirs ? aRoomOfTheirOwn(here.place, cultivator.id) : null;
    destination ??= theAreaNamed(theAreasOf(world, here.place).areas, asAnAreaIsNamed(said));
    if (destination === null) return null;

    if (destination.id === here.area.id) {
        // "Out" from where a road arrives is out of the place, which is the road's to answer.
        if (destination.for === 'street' || destination.for === 'gate' || destination.for === 'here') return null;
        return refused('engine.walkAcrossThePlace', 'move', factsForRefusal(
            `You are already in ${destination.name}.`,
            `You are standing in ${destination.name} already.`,
            `walkAcrossThePlace: destination ${destination.id} is where they stand. Nothing spent.`
        ));
    }

    // THE FORECOURT IS BEHIND THE GATE, and the gate is asked.
    if (destination.for === 'forecourt') {
        const shut = theGateBetweenThemAndIt(game, cultivator);
        if (shut) {
            return refused('engine.walkAcrossThePlace', 'move', factsForRefusal(
                shut.facts[0] ?? 'The gate does not let you through.',
                shut.facts.join(' '),
                `walkAcrossThePlace: ${here.area.id} to ${destination.id} stopped at the gate. ${shut.structure}`
            ));
        }
    }

    // ── THE WALK ─────────────────────────────────────────────────────────
    game.repos.cultivators.standIn(cultivator.id, destination.id);
    game.repos.runs.incrementTurn(run.id, 1);
    const people = npcsInTheArea(world, destination.id).filter(npc => npc.id !== cultivator.id);
    const line = `You walk from ${here.area.name} to ${destination.name}.`;
    const facts = factsForToolResult(line, [
        line,
        people.length === 0
            ? 'Nobody is there.'
            : `${people.length} ${people.length === 1 ? 'person is' : 'people are'} there.`
    ]);
    facts.structure.push(
        `walkAcrossThePlace: ${here.area.id} to ${destination.id}, in ${here.place.id}. No time passed; `
        + `${people.length} standing there by npcsInTheArea.`
    );
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'world.walkAcrossThePlace',
            action: 'move',
            summary: `${cultivator.name} walked to ${destination.name} in ${here.place.name}. No time passed.`,
            ok: true
        }]
    };
}

/**
 * Crossing to somebody the player named who is at this place in another area of it.
 *
 * A person seen before is named, and one standing across the square is a walk away, so an act
 * put to them by name crosses to them first rather than finding nobody. Only by their whole name,
 * which is what the act would have taken had they been in the same area; only at this place; and
 * never past a gate that would not open. Returns the cultivator as stored after and the line that
 * says so, or null where nothing moved.
 */
export function crossToWhoeverTheyNamed(
    game: GameService,
    cultivator: Cultivator,
    target: string | undefined
): { cultivator: Cultivator; line: string; structure: string } | null {
    const wanted = (target ?? '').trim().toLowerCase();
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (wanted.length === 0 || !game.atHand || !here) return null;
    const { areas, whereIs } = theAreasOf(game.atHand, here.place);
    // The name, or the name with the rest of the sentence after it: "Kong Kelin with 200 stones".
    const named = game.atHand.npcs
        .filter(npc => whereIs.has(npc.id)
            && (wanted === npc.name.toLowerCase() || wanted.startsWith(`${npc.name.toLowerCase()} `)))
        .sort((a, b) => b.name.length - a.name.length)[0];
    const theirs = named ? areas.find(area => area.id === whereIs.get(named.id)) : undefined;
    if (!named || !theirs || theirs.id === here.area.id) return null;
    if (theirs.for === 'forecourt' && theGateBetweenThemAndIt(game, cultivator)) return null;
    game.repos.cultivators.standIn(cultivator.id, theirs.id);
    return {
        cultivator: game.repos.cultivators.getById(cultivator.id) ?? cultivator,
        line: `You cross to ${theirs.name}, where ${named.name} is.`,
        structure: `crossToWhoeverTheyNamed: ${here.area.id} to ${theirs.id} for ${named.id}. No time passed.`
    };
}

/** What somebody on watch at a gate is at, for the day somebody arrives at it. */
const ON_WATCH = 'on watch at the gate';

/**
 * The one on watch at this house's gate, said as a fact on arriving at it.
 *
 * The owner: a house's gate ALWAYS has a disciple of it on watch, one of the (at most three)
 * people there. The read picks them (`theOneOnWatchAtTheGate`: the lowest rung the house has in
 * its yard); where nobody of the house is in the yard, the lowest rung inside its walls is sent
 * down to it. Their activity is written as the watch for the day, so the card agrees with the
 * line. Where the house has nobody home, the gate is shut and the line says so.
 */
export function theWatchAtTheGate(
    game: GameService,
    seat: LocationRecord,
    houseName: string
): { line: string; structure: string } {
    const world = game.atHand!;
    const day = Math.floor(world.currentDay);
    const watch = theOneOnWatchAtTheGate(world, seat) ?? whoCouldBeSentToTheGate(world, seat);
    if (watch === null) {
        return {
            line: `Nobody of ${houseName} is on the gate, and it is shut.`,
            structure: `theWatchAtTheGate(${seat.id}): nobody of the house inside its walls; the gate is shut.`
        };
    }
    // A scene somebody is in stays theirs: only somebody at nothing shared is put on the watch.
    const at = world.npcs.findIndex(npc => npc.id === watch.id);
    const now = world.npcs[at]!;
    if (!(now.activity && now.activity.withIds.length > 0)) {
        world.npcs[at] = {
            ...now,
            locationId: seat.id,
            activity: { kind: 'the_work_of_their_rank', note: ON_WATCH, withIds: [], sinceDay: day, untilDay: day }
        };
        game.theWorldMoved();
    }
    return {
        line: `${watch.name}, a disciple of ${houseName}, is on watch at the gate.`,
        structure: `theWatchAtTheGate(${seat.id}): ${watch.id} at rung ${watch.factionRankIndex}.`
    };
}
