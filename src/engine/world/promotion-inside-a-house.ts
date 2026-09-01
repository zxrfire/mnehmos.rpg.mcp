/**
 * Rising through a house's ranks, and finding out you cannot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `factionRankIndex` was written at seeding and at recruitment and never
 * advanced again. Every runtime write in the whole simulation set it to 0
 * (joining), -1 (expulsion), or a leadership succession. There was no promotion
 * anywhere, and `history.ts` had carried a `'promotion'` fact kind the entire
 * time with nothing to file it.
 *
 * Measured over five centuries:
 *
 *     seeding   in a house 314   ranks {0:115, 1:87, 2:37, 3:19, 4:32, 5:24}
 *     500y      in a house 364   ranks {0:340, 1:23, 5:1}
 *
 * The pyramid did not decay - it inverted into a slab. And because
 * `shelfReach(0, …)` entitles a rank-0 member to exactly one book however deep
 * their house's shelf is, 340 of 364 house members were permanently entitled to
 * the primer and nothing else. The book-ceiling histogram at year 500 was
 * `{0:239, 13:260, 17:3}`: nobody alive held a manual reaching past 17.
 *
 * This is the same failure as the one `refreshChosen` was written to fix, one
 * level up - a designation written only at world creation - and it was the real
 * reason the high band drained, not the shelf gaps.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PYRAMID IS SEATS, NOT A CURVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A house is not shaped like a pyramid because a distribution says so. It is
 * shaped like one because THERE ARE ONLY SO MANY SEATS at each rank, and the
 * seats are the constraint people actually feel. An outer disciple who has
 * earned promotion and cannot have it because the inner hall is full is in a
 * completely different situation from one who simply is not good enough, and
 * only the first of those produces a story.
 *
 * So promotion needs three things at once, and the interesting one is the last:
 *
 *   THE HEIGHT     each rank expects an ordinal, interpolated between what the
 *                  house admits at and what its strongest member stands at. You
 *                  cannot be an elder of a house whose elders are all Core
 *                  Formation while you are still gathering qi.
 *   THE MERIT      among everybody who qualifies, the house takes the strongest.
 *                  Favour counts: the chosen are promoted over their seniors,
 *                  which is what being favoured MEANS.
 *   THE SEAT       and there has to be one. Ranks narrow sharply, and in a world
 *                  where a Nascent Soul elder lives eight hundred years, seats
 *                  at the top do not come free often. Nobody is promoted into a
 *                  full hall, however good they are.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THIS IS WHY YOU HAVE TO LEAVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The blockage is the point, not a side effect. A cultivator who has outgrown
 * their rank, cannot be promoted because the seats above them are held by people
 * who will not die for six centuries, and is therefore stuck on a book that
 * stopped carrying them years ago, has exactly one move: GO SOMEWHERE ELSE.
 *
 * That is the pressure the whole setting runs on. Staying where you were born
 * is the losing line, and it loses for a reason a player can see coming and act
 * on rather than a number quietly failing to rise. `blockedAt` reports it, so
 * the narrator can say it out loud before it costs somebody a century.
 */

import type { NpcRecord } from './npc-state.js';
import type { FactionRecord } from './world-state.js';
import type { WorldState } from './world-state.js';

/**
 * How many people a house will seat at each rank.
 *
 * Halving upward, floored at one, because a house with nobody in its top seat
 * is not a house with a vacancy - it is a house without a master, which is a
 * different and much larger event handled by the succession machinery.
 *
 * The bottom rank is uncapped. A house can always take another sweeper, and the
 * limit on its intake is what it can feed rather than how many stools it has.
 */
export function seatsAtRank(rankIndex: number, rankCount: number, members: number): number {
    if (rankIndex <= 0) return Number.MAX_SAFE_INTEGER;
    if (rankIndex >= rankCount) return 0;
    const share = members / Math.pow(2, rankIndex);
    return Math.max(1, Math.floor(share));
}

/**
 * The height a rank expects.
 *
 * Interpolated between what the house admits at and what its strongest member
 * actually stands at, so a great house's inner disciples are stronger than a
 * poor house's elders - which is true, is the reason anybody wants to move up,
 * and needs no table to say it.
 */
export function ordinalExpectedAt(
    rankIndex: number,
    rankCount: number,
    admissionOrdinal: number,
    powerOrdinal: number
): number {
    if (rankCount <= 1) return admissionOrdinal;
    const share = rankIndex / (rankCount - 1);
    return Math.round(admissionOrdinal + share * Math.max(0, powerOrdinal - admissionOrdinal));
}

export interface Promotion {
    npcId: string;
    factionId: string;
    fromRank: number;
    toRank: number;
}

/** Why somebody who has outgrown their rank is still standing in it. */
export type BlockedReason = 'no_seat' | 'outranked' | 'not_yet';

export interface Blocked {
    npcId: string;
    factionId: string;
    atRank: number;
    reason: BlockedReason;
}

interface HouseView {
    house: FactionRecord;
    members: NpcRecord[];
    atRank: number[];
}

function viewOf(state: WorldState): Map<string, HouseView> {
    const byFaction = new Map<string, HouseView>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId || npc.factionRankIndex < 0) continue;
        let v = byFaction.get(npc.factionId);
        if (!v) {
            const house = state.factions.find(f => f.id === npc.factionId);
            if (!house || house.dissolvedOnDay !== null) continue;
            v = { house, members: [], atRank: new Array(house.ranks.length).fill(0) };
            byFaction.set(npc.factionId, v);
        }
        v.members.push(npc);
        const r = Math.min(npc.factionRankIndex, v.atRank.length - 1);
        v.atRank[r]++;
    }
    return byFaction;
}

/**
 * Everybody a house would raise this year, and everybody it cannot.
 *
 * Pure: it decides and reports, and the caller writes. Both halves are returned
 * because the ones it CANNOT raise are the more useful output - they are the
 * people about to leave.
 */
export function assessPromotions(state: WorldState): {
    promotions: Promotion[];
    blocked: Blocked[];
} {
    const promotions: Promotion[] = [];
    const blocked: Blocked[] = [];

    for (const { house, members, atRank } of viewOf(state).values()) {
        const rankCount = house.ranks.length;
        const admission = Number(house.resources.admission_ordinal ?? 0);
        const power = Number(house.resources.power_ordinal ?? admission);

        // Consider each rank from the top down, so a seat freed by promoting
        // somebody up is available to the person below them in the same pass.
        // A house does not wait a year between filling two links of one chain.
        for (let rank = rankCount - 1; rank >= 1; rank--) {
            const seats = seatsAtRank(rank, rankCount, members.length);
            const bar = ordinalExpectedAt(rank, rankCount, admission, power);

            const candidates = members
                .filter(m => m.factionRankIndex === rank - 1)
                .filter(m => m.cultivation.realmOrdinal >= bar)
                // Favour is a promotion over somebody, so it sorts first.
                .sort((a, b) => {
                    const fa = a.tags.includes('chosen') ? 1 : 0;
                    const fb = b.tags.includes('chosen') ? 1 : 0;
                    if (fa !== fb) return fb - fa;
                    return b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                        || a.id.localeCompare(b.id);
                });
            if (candidates.length === 0) continue;

            const room = Math.max(0, seats - atRank[rank]);
            for (let i = 0; i < candidates.length; i++) {
                const npc = candidates[i];
                if (i < room) {
                    promotions.push({
                        npcId: npc.id, factionId: house.id,
                        fromRank: rank - 1, toRank: rank
                    });
                    atRank[rank]++;
                    atRank[rank - 1]--;
                } else {
                    blocked.push({
                        npcId: npc.id, factionId: house.id, atRank: rank - 1,
                        reason: room === 0 ? 'no_seat' : 'outranked'
                    });
                }
            }
        }
    }
    return { promotions, blocked };
}

/**
 * Has this cultivator run out of house?
 *
 * True when they have met the bar for the next rank and are not going to get it
 * - the hall above them is full of people who are not leaving. This is the
 * moment the setting is built around, and it should be legible to the player
 * BEFORE they spend another sixty years finding out the hard way.
 */
export function blockedAt(state: WorldState, npc: NpcRecord): Blocked | null {
    if (!npc.factionId || npc.factionRankIndex < 0) return null;
    const { blocked } = assessPromotions(state);
    return blocked.find(b => b.npcId === npc.id) ?? null;
}
