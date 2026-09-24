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
 *                   Credited where the attention is given. What a lecture IS, open
 *                   and closed, is written once in
 *                   `how-far-up-the-world-reaches.md`.
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
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';

/** What this house counts in their favour. Nothing, where it counts none. */
export function meritWith(npc: Pick<NpcRecord, 'merit'>, houseId: string | null): number {
    if (houseId === null || !npc.merit) return 0;
    return npc.merit.find(row => row.houseId === houseId)?.points ?? 0;
}

/** Every house that counts something in their favour, most first. */
export function whoCountsThemFavourably(
    npc: Pick<NpcRecord, 'merit'>
): readonly { houseId: string; points: number }[] {
    return [...(npc.merit ?? [])].sort((a, b) => b.points - a.points);
}

/**
 * The same row with this much more counted by a named house.
 *
 * FOR ANY HOUSE, INCLUDING ONE THEY DO NOT BELONG TO. A stranger who brings a
 * house its dead back has done it a service, and a house weighing that stranger
 * for a seat later reads this - `whatAnOutsiderMustStandAt` is a realm bar and
 * says the rest is how badly the house wants them, which is what a record of
 * service is evidence of.
 */
export function creditMeritWith(npc: NpcRecord, houseId: string, points: number): NpcRecord {
    if (!(points > 0) || !isTheWorldsToMove(npc)) return npc;
    const held = npc.merit ?? [];
    const at = held.findIndex(row => row.houseId === houseId);
    const next = [...held];
    const gained = Math.round(points);
    if (at >= 0) next[at] = { houseId, points: next[at]!.points + gained };
    else next.push({ houseId, points: gained });
    return { ...npc, merit: next };
}

/**
 * The same row with this much more counted by their own house.
 *
 * AND NEVER ON THE PLAYER'S ROW. Their count is `contribution` on their
 * membership, and the row's `merit` is a projection of it refreshed off the
 * sheet every turn (`the-player-as-a-row-the-world-can-invite.ts`), so a credit
 * written here would be wiped before any door read it - the purse defect one
 * field over, and closed in the same place the four other guards are asked:
 * `isTheWorldsToMove`. What the player earns is credited to the membership by
 * the play layer, which is the one store a promotion then reads for them.
 */
export function creditMerit(npc: NpcRecord, points: number): NpcRecord {
    if (npc.factionId === null) return npc;
    return creditMeritWith(npc, npc.factionId, points);
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
