/**
 * The player's master calls their disciples to where they live, and the player
 * is one of them.
 *
 * The rule is `where-a-master-takes-their-own-disciples.ts`: a closed lesson is
 * a `teaching` activity whose set is the master's own disciples, held where the
 * master lives, and the placement read finds them there. This file is the
 * player's end of it, and it is three things:
 *
 *   told      when a lesson of their master's begins, or they come inside the
 *             walls while one is running, the player is told who has called
 *             them and where. Read off the turn's own clock and the place they
 *             stood at its start, so nothing records having said it
 *   the way   "my master's quarters" names the room, and being called is being
 *             told where it is
 *   the door  being called is what lets a disciple past the walls between the
 *             gate and that room. Nobody else is let past them by this: an
 *             uninvited person walking to it meets whatever the walls and the
 *             people in the room ordinarily are, which is not a refusal written
 *             for the occasion
 *
 * THE MASTER IS THE ONE THE PLAYER KNELT TO (`theMasterTheyKneltTo`), and the
 * call reaches the player only inside the compound the master is at. A master
 * calls the disciples within earshot of the hall; one three provinces away is
 * not in the room to be called.
 */

import type { LocationRecord } from '../engine/world/locations.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import {
    isAClosedLesson,
    whereAMasterLives
} from '../engine/world/where-a-master-takes-their-own-disciples.js';
import { theSeatOfTheCompound, whereCompoundsAre } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import { theMasterTheyKneltTo } from './encounters.js';
import type { GameService } from './turn-engine.js';

/** "my master's quarters", "my teacher's cave abode", and the other ways of naming where a master lives. */
export const A_MASTERS_DWELLING =
    /^(?:my|our)\s+(?:master|teacher|shifu|shizun|mentor)(?:'s|s|s')?\s+(?:quarters|dwelling|residence|abode|cave(?:\s+abode)?|rooms?|house|home|lodgings?|courtyard|chambers?)$/;

/** The player's master, where they live, and whether that is inside the compound the player is in. */
export function whereYourMasterLives(
    game: Pick<GameService, 'repos' | 'worldPlaceOf'>,
    world: WorldState,
    cultivator: Cultivator
): { master: NpcRecord; dwelling: LocationRecord } | null {
    const masterId = theMasterTheyKneltTo(game.repos, cultivator.id);
    const master = masterId === null ? undefined : world.npcs.find(n => n.id === masterId);
    if (!master || master.status !== 'alive') return null;
    const dwelling = whereAMasterLives(world, master);
    if (dwelling === null) return null;
    const compounds = whereCompoundsAre(world);
    const seat = theSeatOfTheCompound(world, game.worldPlaceOf(cultivator), compounds);
    if (seat === null || theSeatOfTheCompound(world, dwelling.id, compounds)?.id !== seat.id) return null;
    return { master, dwelling };
}

export interface YourMasterCalledYou {
    master: NpcRecord;
    dwelling: LocationRecord;
    sinceDay: number;
    untilDay: number | null;
}

/** The closed lesson the player's master is holding and has called them to, or null. */
export function theLessonYourMasterCalledYouTo(
    game: Pick<GameService, 'repos' | 'worldPlaceOf'>,
    world: WorldState,
    cultivator: Cultivator
): YourMasterCalledYou | null {
    const theirs = whereYourMasterLives(game, world, cultivator);
    if (!theirs) return null;
    const { master, dwelling } = theirs;
    const day = Math.floor(world.currentDay);
    const byId = new Map(world.npcs.map(n => [n.id, n] as const));
    if (!isAClosedLesson(byId, master, day)) return null;
    // At home: the master is at the seat of the compound their room is in.
    if (master.locationId !== theSeatOfTheCompound(world, dwelling.id)?.id) return null;
    return { master, dwelling, sinceDay: master.activity!.sinceDay, untilDay: master.activity!.untilDay ?? null };
}

/**
 * Tell the player they have been called, on the turn it becomes true for them:
 * the lesson began while this turn's days were passing, or they came inside the
 * walls this turn. Null on every other turn, and where they are already in the room.
 */
export function settleWhetherYourMasterHasCalledYou(
    game: GameService,
    before: Cultivator,
    now: Cultivator,
    clockOnEntry: number
): { lines: string[]; structure: string } | null {
    const world = game.atHand;
    if (!world || !now.alive) return null;
    const called = theLessonYourMasterCalledYouTo(game, world, now);
    if (!called) return null;
    const here = game.worldPlaceOf(now);
    if (here === called.dwelling.id) return null;

    const worldDayAtEntry = Math.floor(world.currentDay) - (Math.floor(game.currentRun().run.elapsedDays) - Math.floor(clockOnEntry));
    const begunThisTurn = called.sinceDay > worldDayAtEntry;
    const seatNow = theSeatOfTheCompound(world, here)?.id ?? null;
    const cameInThisTurn = theSeatOfTheCompound(world, game.worldPlaceOf(before))?.id !== seatNow;
    if (!begunThisTurn && !cameInThisTurn) return null;

    const days = called.untilDay === null ? null : Math.max(1, called.untilDay - Math.floor(world.currentDay));
    return {
        lines: [
            `${called.master.name} has called their disciples to ${called.dwelling.name} for a lesson of their own`
            + (days === null ? '.' : `, for the next ${days} day${days === 1 ? '' : 's'}.`)
            + ' You are one of them.'
        ],
        structure: `theLessonYourMasterCalledYouTo: ${called.master.id} teaching a closed set at ${called.dwelling.id} `
            + `since world day ${called.sinceDay}; ${begunThisTurn ? 'begun this turn' : 'came inside the walls this turn'}.`
    };
}
