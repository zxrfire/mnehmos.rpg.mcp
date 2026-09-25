/**
 * What a house asks of somebody who is not one of its own.
 *
 * Ground a house holds used to be one gate - are you on the roll - and a
 * model-free affordance sweep of 222 squares refused it `not_of_the_house` 666
 * times, with dao ground reachable 0% at the bottom band, 2% through the middle
 * and 6% at the top. Whose ground it is decides more than membership does. A
 * terrace can stand open, can be the house's own and nobody else's, or can be
 * had on terms the house sets, and only the middle one was missing.
 *
 * THE TERMS ARE PRICED OFF WHAT THE ENGINE ALREADY PRICES. No new currency and
 * no new ledger:
 *
 *   a fee            a season at the best rate open at the ground's own floor,
 *                    off `whatACultivatorCanEarnAt`, in the stones cash converts to.
 *   a copy           `couldWriteOutACopy`, which is the one thing in the engine
 *                    that answers whether somebody could put an art on paper,
 *                    asked about an art the house has not already got.
 *   good relations   the obligation ledger, read by the caller and handed in as
 *                    a list of houses. A house that is owed nothing by this
 *                    person is a house this person is a stranger to.
 *
 * The three are not interchangeable and that is deliberate: a purse does not
 * answer the house that wants somebody it knows, and being known does not
 * answer the house that wants paying.
 */

import { CASH_PER_STONE } from '../../data/cultivation/mortal-world.js';
import { whatACultivatorCanEarnAt } from '../../data/cultivation/what-a-cultivator-can-earn.js';
import { getSect } from '../../data/cultivation/sects.js';
import { couldWriteOutACopy, manualsOf } from './manuals.js';

/**
 * Who a house lets sit on ground it holds.
 *
 * One field rather than an access kind beside a terms field, because two
 * statements of one fact drift. Which of the three kinds this is is derived by
 * {@link accessKindOf}.
 */
export type WhoMaySit = 'anybody' | 'its own' | 'a fee' | 'a copy' | 'good relations';

export type AccessKind = 'public' | 'private' | 'restricted';

export function accessKindOf(admits: string): AccessKind {
    return admits === 'anybody' ? 'public' : admits === 'its own' ? 'private' : 'restricted';
}

/** The first thing an outsider is short of at a gate the house will open. */
export type ShortOfTheTerms = 'the_fee' | 'nothing_to_write_out' | 'a_stranger_to_them';

/**
 * What somebody can put up at a gate that asks for something.
 *
 * Absent means nothing, which is the honest reading for every record that does
 * not carry one. Every NPC in the world is in that position today: the world's
 * own people reach a house's ground by being of that house, and nobody has
 * built the pass where an NPC pays their way onto somebody else's terrace. That
 * is a gap and not a decision.
 */
export interface WhatTheyCouldPutUp {
    spiritStones: number;
    /** Art ids they hold. Which of them they could write out is derived. */
    holds: readonly string[];
    /** Houses that have reason to be glad to see them. */
    onGoodTermsWith: readonly string[];
}

/**
 * A season, which is what an outsider is buying when they pay at a gate.
 *
 * Not the whole road: `YEARS_A_ROAD_COSTS` charges a held ground forty years of
 * practice, and a house that wanted forty years of somebody's keep up front
 * would be refusing rather than charging.
 */
export const MONTHS_A_TERM_ON_HELD_GROUND = 3;

/**
 * The best-paid month open to somebody standing at this rung.
 *
 * THE MEDIAN IS THE WRONG INSTRUMENT HERE, measured: `copyistMonthlyCash` takes
 * the median of everything at or below a rung, the board carries fourteen
 * mortal-wage rows at ordinal 0, and the median therefore barely moves - a fee
 * built on it came out at 23 stones for ground addressed to Core Formation and
 * at 18 for ground addressed to a beginner. A gate nobody notices is not a gate,
 * and the probe found `the_fee` fired zero times out of 1702 reads.
 *
 * The top of the board moves the way the ladder does, and it is also the right
 * quantity: what the season costs the person paying is what they could have
 * earned with it.
 */
function bestOpenMonthlyCash(ordinal: number): number | null {
    let best: number | null = null;
    for (const term of whatACultivatorCanEarnAt(ordinal)) {
        if (best === null || term.cashPerMonth > best) best = term.cashPerMonth;
    }
    return best;
}

/**
 * What a house asks, in spirit stones, to let a stranger sit for a season.
 *
 * Scaled by the ground's own floor because that is who the ground is addressed
 * to, and read off what a cultivator can earn rather than off a table here, so a house
 * cannot end up charging for a season what a bowl of millet costs.
 *
 * Null where nothing is paid at that height. It is not a fee
 * of zero: a house whose terrace nobody can be paid to stand on is not a house
 * that takes stones for it.
 */
export function feeForSittingOn(fromOrdinal: number): number | null {
    const wage = bestOpenMonthlyCash(fromOrdinal);
    if (wage === null) return null;
    return Math.max(1, Math.ceil((wage * MONTHS_A_TERM_ON_HELD_GROUND) / CASH_PER_STONE));
}

/** Everything this house already has on paper. */
function whatTheHouseAlreadyHolds(factionId: string): Set<string> {
    return new Set([
        ...(getSect(factionId)?.teaches ?? []),
        ...manualsOf(factionId).map(m => m.id)
    ]);
}

/**
 * An art this person could write out that the house has not got, or null.
 *
 * Both halves matter. A copy of something on their own shelf is not payment,
 * and an art somebody holds but could not put on paper is not an offer - it is
 * a thing they know.
 */
export function whatTheyCouldWriteOutForAHouse(
    factionId: string,
    ordinal: number,
    holds: readonly string[]
): string | null {
    const theirs = whatTheHouseAlreadyHolds(factionId);
    for (const id of holds) {
        if (theirs.has(id)) continue;
        if (couldWriteOutACopy({ realmOrdinal: ordinal }, id)) return id;
    }
    return null;
}

/**
 * The first term this outsider has not met, or null when the gate opens.
 *
 * Called only for somebody who is NOT of the house. A house's own people are
 * rationed by the ladder and nothing here touches that.
 */
/**
 * A place a house holds, as this rule needs to read it.
 *
 * DELIBERATELY NOT A DAO GROUND. The question "may somebody not of this house be
 * here" is the same question about a terrace, a compound, a shelf and a door,
 * and a second model for any of them would be the bespoke thing. What a caller
 * supplies is the three facts the terms are priced off.
 */
export interface APlaceAHouseHolds {
    admits: string;
    heldByFactionId: string | null;
    /** The rung the place is addressed to. What the fee is scaled by. */
    fromOrdinal: number;
}

export function whatAHouseAsksOf(
    place: APlaceAHouseHolds,
    ordinal: number,
    couldPutUp: WhatTheyCouldPutUp | undefined
): ShortOfTheTerms | null {
    const putUp = couldPutUp ?? { spiritStones: 0, holds: [], onGoodTermsWith: [] };
    switch (place.admits) {
        case 'a fee': {
            const fee = feeForSittingOn(place.fromOrdinal);
            return fee !== null && putUp.spiritStones >= fee ? null : 'the_fee';
        }
        case 'a copy': {
            if (!place.heldByFactionId) return 'nothing_to_write_out';
            return whatTheyCouldWriteOutForAHouse(
                place.heldByFactionId, ordinal, putUp.holds
            ) === null
                ? 'nothing_to_write_out'
                : null;
        }
        case 'good relations':
            return place.heldByFactionId
                && putUp.onGoodTermsWith.includes(place.heldByFactionId)
                ? null
                : 'a_stranger_to_them';
        default:
            return null;
    }
}
