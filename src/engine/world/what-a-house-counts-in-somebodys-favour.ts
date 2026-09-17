/**
 * What a house counts in somebody's favour, in the units it pays a player in.
 *
 * Merit is service, and it is held against ONE house: the house somebody
 * served. It is `contribution` on the player's membership, and the world's
 * people carry the same figure on `NpcRecord.merit`, in the same units and
 * against the same curve, so a player and an NPC standing at one door are
 * measured by one rule.
 *
 * WHAT COUNTS, AND ONLY WHAT THE WORLD ALREADY DECIDES:
 *
 *   coming home     a sending or a posting whose term ran out and who came back
 *                   to the house. Priced as the board prices an errand of that
 *                   length at that height - `CONTRIBUTION_BASE`,
 *                   `CONTRIBUTION_PER_ORDINAL`, `ORDINARY_DUTY_DAYS` - so a
 *                   twelve-year posting is worth what twelve years of errands
 *                   are. Credited where the term closes.
 *   attention       teaching disciples or giving a lecture, priced as a player's
 *                   talk is priced: the errand rate for the days given, times the
 *                   house's own people in the set, thinned by `shareOfAttention`.
 *                   Credited where the attention is given.
 *
 * HELD AGAINST A HOUSE, NOT CARRIED. Somebody who walks out, is taken by a
 * splinter, or is enrolled somewhere new starts at nothing there, which is what
 * a membership row does for the player. The row keeps which house it counts
 * for, so no pass that moves a person between houses has to remember to clear
 * it: a count for another house reads as none.
 */

import {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    ORDINARY_DUTY_DAYS
} from '../encounters/duties.js';
import { shareOfAttention } from '../cultivation/cultivation.js';
import type { NpcRecord } from './npc-state.js';

/** What this house counts in their favour. Nothing, for any other house. */
export function meritWith(npc: Pick<NpcRecord, 'merit'>, houseId: string | null): number {
    if (houseId === null || !npc.merit || npc.merit.houseId !== houseId) return 0;
    return npc.merit.points;
}

/** The same row with this much more counted by their own house. */
export function creditMerit(npc: NpcRecord, points: number): NpcRecord {
    if (npc.factionId === null || !(points > 0)) return npc;
    return {
        ...npc,
        merit: { houseId: npc.factionId, points: meritWith(npc, npc.factionId) + Math.round(points) }
    };
}

/** What the board pays for this many days of errands pitched at this height. */
export function whatServiceIsWorth(ordinal: number, days: number): number {
    if (!(days > 0)) return 0;
    const perErrand = CONTRIBUTION_BASE + Math.max(0, ordinal) * CONTRIBUTION_PER_ORDINAL;
    return perErrand * (days / ORDINARY_DUTY_DAYS);
}

/**
 * What giving attention for this many days is worth to the teacher's house.
 *
 * The player's talk is priced by this too: `whatATalkIsWorthToTheHouse`
 * (`src/web/a-teacher-giving-you-their-attention.ts`) calls it and rounds.
 */
export function whatAttentionIsWorth(
    teacherOrdinal: number,
    days: number,
    listenersOfTheHouse: number,
    listeners: number
): number {
    if (listenersOfTheHouse <= 0) return 0;
    return whatServiceIsWorth(teacherOrdinal, days) * listenersOfTheHouse * shareOfAttention(listeners);
}
