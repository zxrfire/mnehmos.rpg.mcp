/**
 * A house sends a search party after one of its own.
 *
 * The same shape as any other party it dispatches: somebody free is given a
 * term and a place to come back to, and what the errand was FOR rides on the
 * row as a tag. The term closes in `bringHomeWhoeverIsDue` like every other,
 * and `whatASearchBroughtBack` decides what it was worth.
 *
 * ITS OWN FIRST. A house that has anybody free sends them; paper on a town wall
 * is what it does when it does not, which `whoEachHouseIsLookingFor` already
 * decides. This is the other half of that, and the two read the same condition
 * from opposite sides.
 *
 * ONE AT A TIME, per house per year. A house that has lost four people does not
 * empty its yard after them, and a search that finds nothing leaves the mark
 * standing - so the next year's pass sends somebody again, which is a house
 * that has not given up rather than a house with nothing to do.
 */

import type { WorldState, FactionRecord } from './world-state.js';
import { forStream } from '../cultivation/rng.js';
import {
    isTheWorldsToMove,
    setLocation,
    type NpcRecord
} from './npc-state.js';
import { freeToTakeWork, OUT_LOOKING_FOR } from './a-disciple-takes-work-off-the-board.js';
import { whoTheHouseHasLostTrackOf } from './who-a-house-has-lost-track-of.js';
import { isBelowTheLid } from './layers.js';

const DAYS_PER_YEAR = 365;

/**
 * How long a house gives a search before it wants them back.
 *
 * Long enough to be a journey and short enough that a disciple is not lost to
 * it: a year out and a year back, and whatever they found is what they found.
 */
export const YEARS_A_SEARCH_RUNS: readonly [number, number] = [1, 3];

/** How many of its own a house will have out looking at once. */
export const HOW_MANY_A_HOUSE_SENDS = 1;

export interface WhoWentLooking {
    houseId: string;
    searcherId: string;
    afterId: string;
}

/** Every house sends somebody after one of its own, where it has anybody to send. */
export function theHousesSendSomebodyLooking(state: WorldState, day: number): WhoWentLooking[] {
    const went: WhoWentLooking[] = [];
    const alive = new Set(state.npcs.filter(n => n.status !== 'physically_dead').map(n => n.id));

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        const lost = whoTheHouseHasLostTrackOf(house).filter(one => alive.has(one.personId));
        if (lost.length === 0) continue;

        // Already out after somebody. A house looking is a house looking.
        const roll: number[] = [];
        let alreadyOut = false;
        for (let i = 0; i < state.npcs.length; i++) {
            const npc = state.npcs[i]!;
            if (npc.factionId !== house.id || npc.status !== 'alive') continue;
            if (npc.tags.some(t => t.startsWith(OUT_LOOKING_FOR))) { alreadyOut = true; break; }
            if (freeToTakeWork(npc) && isTheWorldsToMove(npc)) roll.push(i);
        }
        if (alreadyOut || roll.length === 0) continue;

        const rng = forStream(state.seed, 'a-house-sends-somebody-looking', house.id, String(day));
        const at = roll[rng.int(0, roll.length - 1)]!;
        const searcher = state.npcs[at]!;
        const after = lost[rng.int(0, lost.length - 1)]!;
        const years = rng.int(YEARS_A_SEARCH_RUNS[0], YEARS_A_SEARCH_RUNS[1]);

        // A SEARCH IS NOT BLIND, AND THE TASK IS WHERE IT IS NOT BLIND FROM.
        // The house dispatched them, so what they were up to is on the errand
        // itself - where it took them, who went along, when they were due.
        // `markMissing` leaves that activity standing precisely so it survives
        // them going missing: the errand that took them is the last true thing
        // anybody has. A search reads it rather than guessing.
        const lostRow = state.npcs.find(n => n.id === after.personId) ?? null;
        state.npcs[at] = withTheErrand(
            searcher, house, after.personId, day, years,
            lostRow?.locationId ?? null,
            lostRow?.activity?.withIds ?? []
        );
        went.push({ houseId: house.id, searcherId: searcher.id, afterId: after.personId });
    }
    return went;
}

/** The row, out on it. */
function withTheErrand(
    npc: NpcRecord,
    house: FactionRecord,
    afterId: string,
    day: number,
    years: number,
    /** Where the lost one was last standing, as the house has it. */
    lastSeenAt: string | null,
    /** Who went out with them. The first people anybody asks. */
    whoWasWithThem: readonly string[]
): NpcRecord {
    const out: NpcRecord = {
        ...npc,
        tags: [...npc.tags, `${OUT_LOOKING_FOR}${afterId}`],
        activity: {
            kind: 'out_with_a_party',
            note: `Out after one of the ${house.name}'s own.`,
            withIds: [...whoWasWithThem],
            sinceDay: day,
            untilDay: day + years * DAYS_PER_YEAR,
            // HOME IS THE HOUSE. The errand ends where the answer is wanted,
            // whatever ground the looking took them over.
            returnTo: house.seatLocationId ?? npc.locationId
        }
    };
    // AND THEY START WHERE THE TRAIL DOES. The house knows what they were up
    // to; a search that began at the compound gate would be the house
    // forgetting its own dispatch book.
    return lastSeenAt === null ? out : setLocation(out, lastSeenAt, day);
}
