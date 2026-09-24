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
import { TOO_LITTLE_TO_BE_BELIEVED } from './somebody-puts-a-name-to-it.js';

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

/** Carried by a house that has stopped looking, naming who it stopped looking for. */
export const GAVE_UP_LOOKING_FOR = 'gave-up-looking-for|';

/** Carried by a house between attempts, counting how many have come back empty. */
export const LOOKED_AND_FOUND_NOTHING = 'looked-and-found-nothing|';

/**
 * How many empty-handed parties a house sends before it stops.
 *
 * THREE, and the point is that it is a number rather than forever. A house
 * that never stops looking has a standing errand nobody can close and a name
 * its board says every year for a century; a house that stops after one did
 * not care. Three is a house that tried.
 */
export const HOW_OFTEN_A_HOUSE_TRIES = 3;

/** How many empty parties this house has sent after them. */
export function howOftenTheyHaveLooked(
    house: Pick<FactionRecord, 'tags'>,
    personId: string
): number {
    const tag = house.tags.find(t => t.startsWith(`${LOOKED_AND_FOUND_NOTHING}${personId}|`));
    return tag ? Number(tag.split('|')[2] ?? 0) : 0;
}

/** Whether this house has stopped looking for them. */
export function theyHaveStoppedLooking(
    house: Pick<FactionRecord, 'tags'>,
    personId: string
): boolean {
    return house.tags.includes(`${GAVE_UP_LOOKING_FOR}${personId}`);
}

/**
 * The house, told where to look by somebody who claims to know.
 *
 * A house that gave up is a house that ran out of places to send people, not
 * one that stopped caring - so a name and a place reopen it. The empty count
 * goes with the giving-up mark, because a house starting again on new word is
 * not three-quarters of the way to giving up again.
 *
 * WHOSE WORD, AND THE SAME BAR AS A NAME. A house does not take the word of a
 * man it holds a grudge against; being unknown is not being distrusted, which
 * is the whole of how a stranger gets heard. See `somebody-puts-a-name-to-it.ts`
 * - the two are the same act about different facts, and a caller that has both
 * should expect them to agree about who is believed.
 */
export function theHouseIsToldWhereToLook(
    state: WorldState,
    input: { houseId: string; personId: string; toldById: string | null; onDay: number }
): boolean {
    const at = state.factions.findIndex(f => f.id === input.houseId);
    if (at < 0) return false;
    const house = state.factions[at]!;
    if (!theyHaveStoppedLooking(house, input.personId)) return false;

    if (input.toldById !== null && !theyWouldTakeTheirWord(state, house, input.toldById)) {
        return false;
    }

    state.factions[at] = {
        ...house,
        tags: house.tags.filter(
            t => t !== `${GAVE_UP_LOOKING_FOR}${input.personId}`
                && !t.startsWith(`${LOOKED_AND_FOUND_NOTHING}${input.personId}|`)
        )
    };
    return true;
}

/**
 * Whether anybody answering for this house would hear this person out.
 *
 * Read off the roll rather than off an office, because a house hears a thing
 * through whoever is standing at the gate - and one elder holding a grudge
 * does not stop the house listening if the rest do not.
 */
function theyWouldTakeTheirWord(
    state: WorldState,
    house: FactionRecord,
    tellerId: string
): boolean {
    let heardBy = 0;
    for (const npc of state.npcs) {
        if (npc.factionId !== house.id || npc.status !== 'alive') continue;
        const tie = npc.relationships.find(r => r.targetId === tellerId);
        if (tie === undefined || tie.standing > TOO_LITTLE_TO_BE_BELIEVED) heardBy++;
    }
    return heardBy > 0;
}

/** The house's row after a party came back with nothing. */
export function aPartyCameBackWithNothing<H extends Pick<FactionRecord, 'tags'>>(
    house: H,
    personId: string
): H {
    const been = howOftenTheyHaveLooked(house, personId) + 1;
    const kept = house.tags.filter(
        t => !t.startsWith(`${LOOKED_AND_FOUND_NOTHING}${personId}|`)
    );
    return {
        ...house,
        tags: been >= HOW_OFTEN_A_HOUSE_TRIES
            ? [...kept, `${GAVE_UP_LOOKING_FOR}${personId}`]
            : [...kept, `${LOOKED_AND_FOUND_NOTHING}${personId}|${been}`]
    };
}

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
        const lost = whoTheHouseHasLostTrackOf(house)
            .filter(one => alive.has(one.personId) && !theyHaveStoppedLooking(house, one.personId));
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
        tags: [...npc.tags, `${OUT_LOOKING_FOR}${afterId}|${lastSeenAt ?? ''}`],
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
