/**
 * Recording where somebody stands in a house, and who taught them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TWO MEASUREMENTS THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * PROMOTION WAS ABOUT VEINS. `promotion` was the third-heaviest kind in the
 * ledger - 1,667 rows over two thousand years - and not one of them was about a
 * person. `factKindFor` maps a scheduled `assessment` onto it, and every
 * assessment on the books is a grant renewal, so the whole kind read:
 *
 *     The Ashen Forge Clan's grant on its vein comes up for renewal.
 *
 * Meanwhile `applyPromotions` raised people through their houses every year and
 * wrote the rank onto the record without writing anything to the ledger, so
 * "ranked second at the Court" - a line the target biography wants - could not
 * be recovered from the world's own history at all.
 *
 * TIES HAD NO DATES. `the-ties-an-ordinary-life-produces.ts` writes master and
 * disciple ties from who is actually carrying whom through which book, and the
 * ties are real and resolve. What they had was no beginning: a tie carries
 * `sinceDay`, but nothing in the ledger said the day it formed or the day it
 * ended, so a life could hold a master and never record taking one.
 *
 * ── The scope limit, which is the hard part ──────────────────────────────
 *
 * Not every rank is a life event. A house with nine ranks promotes constantly at
 * the bottom, and writing all of it back would refill the ledger with exactly
 * the kind of row that was just cleared out of it. The test is whether it would
 * belong in a life somebody reads two centuries later.
 *
 * So a promotion is recorded when it reaches the upper half of the house's own
 * ladder - see {@link worthRecordingRank} - which is read off `house.ranks`
 * rather than chosen, so a three-rank clan and a nine-rank sect each get the
 * answer their own structure implies and no constant here has to know about
 * either. Everything below that is a rank on the record and nothing more.
 *
 * A master is recorded whichever rank it happens at, because taking a master is
 * a life event at every altitude and there is exactly one of them per person at
 * a time.
 */

import { makeFact, type HistoricalFact } from './history.js';
import { rankName } from '../cultivation/realms.js';
import type { NpcRecord } from './npc-state.js';
import type { Promotion } from './promotion-inside-a-house.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';

/**
 * Whether reaching this rank is a thing a life would mention.
 *
 * The upper half of the house's own ladder. A promotion into the inner ranks is
 * a standing somebody holds and other people notice; a step inside the outer
 * ranks is a Tuesday.
 */
export function worthRecordingRank(toRank: number, rankCount: number): boolean {
    if (rankCount <= 1) return false;
    return toRank >= Math.ceil(rankCount / 2);
}

/** The house's own word for a rank, never the index into its ladder. */
function titleOf(state: WorldState, factionId: string, rank: number): { house: string; title: string; ranks: number } | null {
    const house = state.factions.find(f => f.id === factionId);
    if (!house || house.ranks.length === 0) return null;
    return {
        // Houses are named with their article in the catalog - "the Kang Hall" -
        // and a summary that adds another says "the the Kang Hall".
        house: house.name.replace(/^[Tt]he\s+/, ""),
        title: house.ranks[Math.min(rank, house.ranks.length - 1)] ?? `rank ${rank}`,
        ranks: house.ranks.length
    };
}

/**
 * Write a promotion worth writing.
 *
 * Returns null for the ordinary churn, which is most of it and is deliberately
 * not recorded.
 */
export function recordPromotion(
    state: WorldState,
    npc: NpcRecord,
    promotion: Promotion,
    day: number
): HistoricalFact | null {
    const seat = titleOf(state, promotion.factionId, promotion.toRank);
    if (!seat) return null;
    if (!worthRecordingRank(promotion.toRank, seat.ranks)) return null;

    return appendWorldFact(state, makeFact({
        day,
        kind: 'promotion',
        scale: promotion.toRank >= seat.ranks - 1 ? 'regional' : 'local',
        summary:
            `${npc.name} was raised to ${seat.title} of the ${seat.house}` +
            `, at ${rankName(npc.cultivation.realmOrdinal)}.`,
        actors: [{ id: npc.id, name: npc.name, role: 'raised' }],
        locationId: npc.locationId,
        factionIds: [promotion.factionId],
        visibility: 'faction',
        magnitude: Math.min(1, 0.2 + (promotion.toRank / Math.max(1, seat.ranks)) * 0.4),
        causeKnown: true,
        data: {
            fromRank: promotion.fromRank,
            toRank: promotion.toRank,
            rankCount: seat.ranks,
            realmOrdinal: npc.cultivation.realmOrdinal
        }
    // Two promotions to the same seat in one house are two events in a life,
    // even where the sentence comes out the same - a career is a sequence, and
    // folding it would delete the sequence.
    }), { recur: false });
}

/**
 * Write the day a teaching line began.
 *
 * Both sides in one row, because it is one event: a master took a disciple and
 * a disciple took a master, and two rows would be the same fact twice with the
 * back-links split across them.
 */
export function recordMasterTaken(
    state: WorldState,
    disciple: NpcRecord,
    master: NpcRecord,
    manualName: string | null,
    day: number
): HistoricalFact {
    return appendWorldFact(state, makeFact({
        day,
        kind: 'promotion',
        scale: 'local',
        summary:
            `${disciple.name} took ${master.name} as master` +
            (manualName ? `, and is being carried through ${manualName}` : '') + '.',
        actors: [
            { id: disciple.id, name: disciple.name, role: 'disciple' },
            { id: master.id, name: master.name, role: 'master' }
        ],
        locationId: disciple.locationId,
        factionIds: disciple.factionId ? [disciple.factionId] : [],
        visibility: 'faction',
        magnitude: 0.3,
        causeKnown: true,
        data: {
            masterOrdinal: master.cultivation.realmOrdinal,
            discipleOrdinal: disciple.cultivation.realmOrdinal
        }
    }), { recur: false });
}

/**
 * Write the day a teaching line ended, and why.
 *
 * The reason is read off state rather than judged: a master who died is a
 * different ending from a disciple who outgrew them, and the difference is
 * exactly what makes the row worth having two centuries later.
 */
export function recordMasterLost(
    state: WorldState,
    disciple: NpcRecord,
    master: NpcRecord,
    reason: 'died' | 'outgrown' | 'parted',
    day: number
): HistoricalFact {
    const what =
        reason === 'died'
            ? `${disciple.name}'s master ${master.name} died, and the line ended there.`
            : reason === 'outgrown'
                ? `${disciple.name} passed ${master.name}, who has nothing further to teach them.`
                : `${disciple.name} and ${master.name} are no longer master and disciple.`;
    return appendWorldFact(state, makeFact({
        day,
        kind: 'promotion',
        scale: 'personal',
        summary: what,
        actors: [
            { id: disciple.id, name: disciple.name, role: 'disciple' },
            { id: master.id, name: master.name, role: 'master' }
        ],
        locationId: disciple.locationId,
        factionIds: disciple.factionId ? [disciple.factionId] : [],
        visibility: 'faction',
        magnitude: 0.25,
        causeKnown: reason !== 'parted',
        data: { reason }
    }), { recur: false });
}
