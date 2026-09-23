/**
 * Face won and lost away from a fight.
 *
 * `what-a-face-is-worth.ts` states what face is and how it scales, and its
 * header promises three roads onto it: deeds people saw, public defeats, and
 * being exposed. NONE OF THEM WAS WIRED. `theirFaceMoves` was called from two
 * places in the whole world - a duel on the yard, and the killing pass charging
 * somebody for being seen to kill beneath themselves - so face was a currency
 * only violence minted. Measured on `afford-a` at a thousand years, over the
 * twelve people then carrying a removal from office: mean face **zero**.
 *
 * The design owner, asked whether face should move outside violence: *"of
 * course. teaching someone, having your sect win a tournament, you do what makes
 * sense."* Both an answer and a licence - the list is not closed, so what the
 * world already knows how to notice should write here rather than waiting to be
 * named.
 *
 * ── WHAT A WRITER HAS TO SAY ─────────────────────────────────────────────
 *
 * What happened, and who saw it. Nothing else: `whatBeingWatchedIsWorth` already
 * turns a count of witnesses into a multiplier, `A_PUBLIC_WIN` is the unit
 * everything is stated against, and `whatTheGapIsWorth` prices who the other
 * party was. A writer that computed its own scale would be a second opinion
 * about the same question.
 *
 * ── AND WHY BEING EXPOSED IS THE ONE THAT MATTERED MOST ──────────────────
 *
 * The expose route is the owner's stated normal way a seat changes hands in a
 * righteous or neutral house, running at 31 to 32 cases a century against
 * killing for a seat at 0.4. A holder turned out of an office in front of the
 * room lost NOTHING by it: not the room's opinion of them, not the province's.
 * That was the largest hole in the set, and {@link theRoomTurnedThemOut} is it.
 *
 * UNMEASURED at the time of writing. What has to be read afterwards: the mean
 * face over the people carrying a removal, and how many people in a world have
 * any face at all. If it is still near zero for ordinary members then these
 * writers fire for a handful of people and face is still not a currency.
 */

import { A_PUBLIC_WIN, theirFaceMoves, whatBeingWatchedIsWorth, whatTheGapIsWorth } from './what-a-face-is-worth.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/**
 * What being turned out of an office in front of the room costs.
 *
 * Heavier than a lost duel: a duel is one afternoon and this is the house
 * stating what it thinks of somebody. Stated in public wins, like everything
 * else here.
 */
export const WHAT_BEING_TURNED_OUT_COSTS = 2;

/** What carrying somebody through a wall is worth to the one who taught them. */
export const WHAT_A_DISCIPLE_CROSSING_IS_WORTH = 0.5;

/** What a house winning its own tournament is worth to everybody on the roll. */
export const WHAT_A_HOUSE_WINNING_IS_WORTH = 0.15;

/** The room's own people, for a thing done in front of them. */
export const A_ROOM_SAW_IT = 12;

/**
 * Somebody was turned out of an office, or off the roll, in front of the room.
 *
 * The one road the file's header promised and nothing walked. Witnesses are the
 * room rather than the province: what the province hears is the fact the expose
 * writes, and doubling it here would price the same event twice.
 */
export function theRoomTurnedThemOut(
    state: WorldState,
    npcId: string,
    day: number,
    expelled: boolean
): number {
    const cost = A_PUBLIC_WIN * WHAT_BEING_TURNED_OUT_COSTS
        * (expelled ? 1.5 : 1) * whatBeingWatchedIsWorth(A_ROOM_SAW_IT);
    theirFaceMoves(state, npcId, -Number(cost.toFixed(2)), day);
    return cost;
}

/**
 * A disciple of theirs went through a wall.
 *
 * The owner's own example: *"teaching someone"*. Worth more the further past the
 * teacher's own standing the student reached, which is `whatTheGapIsWorth` read
 * in the direction it was built for - carrying somebody to a height near your
 * own is the thing a master is remembered for.
 */
export function theirDiscipleCrossed(
    state: WorldState,
    master: Pick<NpcRecord, 'id' | 'cultivation'>,
    student: Pick<NpcRecord, 'id' | 'cultivation'>,
    witnesses: number,
    day: number
): number {
    const won = A_PUBLIC_WIN * WHAT_A_DISCIPLE_CROSSING_IS_WORTH
        * whatTheGapIsWorth(master.cultivation.realmOrdinal, student.cultivation.realmOrdinal)
        * whatBeingWatchedIsWorth(witnesses);
    theirFaceMoves(state, master.id, Number(won.toFixed(2)), day);
    return won;
}

/**
 * A house won its own conclave, and the whole roll takes something from it.
 *
 * The owner: *"having your sect win a tournament"* - the house, not only the
 * winner. Small per person and large in aggregate, which is what a house's
 * standing is made of.
 */
export function theHouseWasSeenToWin(
    state: WorldState,
    houseId: string,
    entrants: number,
    day: number
): number {
    let moved = 0;
    const each = A_PUBLIC_WIN * WHAT_A_HOUSE_WINNING_IS_WORTH
        * whatBeingWatchedIsWorth(Math.max(A_ROOM_SAW_IT, entrants));
    for (const npc of state.npcs) {
        if (npc.factionId !== houseId || npc.status !== 'alive') continue;
        theirFaceMoves(state, npc.id, Number(each.toFixed(2)), day);
        moved++;
    }
    return moved;
}
