/**
 * How a vein changes hands, other than by a rival seizing it.
 *
 * A rival seizing it is `vein_lost` in the pressure table, and it can only
 * happen between two houses that already hate each other. On its own it made
 * the veins of a world trade back and forth along one hostile edge. These are
 * the other ways, each read off something the world already holds:
 *
 *   taken in a war  the holder is losing a war by `A_WAR_TAKES_A_VEIN_AT`, or
 *                   lost the one settled this year, and the house it fought can
 *                   work the vein.
 *   sold            the holder's purse is thinning or empty, and a house on
 *                   terms with it is rich enough to pay and still keep its
 *                   own wages in hand. A grant is never sold.
 *   given up        the holder cannot pay its people and nobody on its roll
 *                   can work the vein, or the holder has ended.
 *   claimed         a vein nobody has held for `A_VEIN_LIES_UNHELD_YEARS` goes
 *                   to the nearest house that can work it.
 *
 * One change a vein a year, tried in that order. A house losing a war loses
 * the vein whatever its purse says, and a house that can sell does not walk
 * away.
 *
 * Pure. The world as plain rows in, what changes hands out. The writes are
 * `applyWhoHoldsTheVeins` in `the-world-changing-on-its-own.ts`.
 */

import { howThePurseIsRunning, WHAT_A_HOUSE_KEEPS_IN_HAND } from './what-a-house-does-when-it-cannot-pay.js';

/**
 * Years of what a vein pays its buyer that it sells for.
 *
 * A vein is bought for what it will pay back, and ten years is the horizon a
 * house plans a vein on: less and every house with a surplus buys, more and a
 * short house can never find a buyer inside a century.
 */
const A_VEIN_SELLS_FOR_YEARS_OF_WHAT_IT_PAYS = 10;

/**
 * How far behind in a war the holder must be before the other side takes its
 * vein. `losing` is the holder's own share of its strength spent, less the
 * other side's (`howAHouseIsFaring`), so a fifth is a war going clearly one way.
 */
const A_WAR_TAKES_A_VEIN_AT = 0.2;

/**
 * How long a vein given up lies with nobody on it before a house moves people
 * onto it: long enough to be known as empty, and to survey.
 */
const A_VEIN_LIES_UNHELD_YEARS = 5;

interface AVeinAsItStands {
    id: string;
    /** The realm a house's strongest must reach to work it. */
    worksAt: number;
    holderId: string | null;
    /** The day it was last given up, or null where nobody ever held it and gave it up. */
    unheldSinceDay: number | null;
}

interface AHouseAsItStands {
    id: string;
    /** False for a house that has ended. */
    live: boolean;
    members: number;
    purse: number;
    payroll: number;
    /** The strongest realm on its roll. */
    strongest: number;
    /** What one vein would pay this house in a year. */
    aVeinPaysIt: number;
    /**
     * The war it fought this year, how badly it was losing, and whether the war
     * was settled this year. Null at peace.
     */
    war: { againstId: string; losing: number; settled: boolean } | null;
    /** The houses it would sit down with. */
    onTermsWith: readonly string[];
    /**
     * Whether it holds its ground on a grant from a house above it. A grant is
     * not the holder's to sell; it is renewed or withdrawn (`vein_lost`).
     */
    holdsOnAGrant: boolean;
}

export type HowAVeinChangedHands = 'taken_in_war' | 'sold' | 'given_up' | 'claimed';

interface AVeinChangesHands {
    veinId: string;
    how: HowAVeinChangedHands;
    fromId: string | null;
    toId: string | null;
    /** Stones from the buyer to the seller. Zero for anything but a sale. */
    price: number;
}

/**
 * Every vein that changes hands this year, and how.
 *
 * Houses are read as they stand when the pass begins, except that the stones
 * of a sale have moved before the next vein is read.
 */
export function whoseVeinsChangeHands(input: {
    veins: readonly AVeinAsItStands[];
    houses: readonly AHouseAsItStands[];
    /** Days from a house's seat to a vein, or null where it cannot get there. */
    daysFrom: (houseId: string, veinId: string) => number | null;
    onDay: number;
    daysPerYear: number;
}): AVeinChangesHands[] {
    const byId = new Map<string, AHouseAsItStands>(input.houses.map(h => [h.id, { ...h }]));
    const out: AVeinChangesHands[] = [];
    const canWork = (h: AHouseAsItStands, vein: AVeinAsItStands): boolean =>
        h.live && h.members > 0 && h.strongest >= vein.worksAt
        && input.daysFrom(h.id, vein.id) !== null;
    const nearestFirst = (vein: AVeinAsItStands) => (a: AHouseAsItStands, b: AHouseAsItStands): number =>
        (input.daysFrom(a.id, vein.id) ?? Infinity) - (input.daysFrom(b.id, vein.id) ?? Infinity)
        || b.purse - a.purse
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

    for (const vein of [...input.veins].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const holder = vein.holderId === null ? null : byId.get(vein.holderId);
        // A holder the caller did not hand in is not the world's to move.
        if (holder === undefined) continue;

        if (holder !== null && !holder.live) {
            out.push({ veinId: vein.id, how: 'given_up', fromId: vein.holderId, toId: null, price: 0 });
            continue;
        }

        if (holder === null) {
            if (vein.unheldSinceDay === null) continue;
            if (input.onDay - vein.unheldSinceDay < A_VEIN_LIES_UNHELD_YEARS * input.daysPerYear) continue;
            const claimer = [...byId.values()]
                .filter(h => canWork(h, vein) && h.war === null
                    && howThePurseIsRunning(h.purse, h.payroll) !== 'cannot_pay')
                .sort(nearestFirst(vein))[0];
            if (!claimer) continue;
            out.push({ veinId: vein.id, how: 'claimed', fromId: null, toId: claimer.id, price: 0 });
            continue;
        }

        if (holder.war !== null && (holder.war.losing >= A_WAR_TAKES_A_VEIN_AT
            || (holder.war.settled && holder.war.losing > 0))) {
            const taker = byId.get(holder.war.againstId);
            if (taker && canWork(taker, vein)) {
                out.push({ veinId: vein.id, how: 'taken_in_war', fromId: holder.id, toId: taker.id, price: 0 });
                continue;
            }
        }

        // A SOLVENT HOLDER DOES NOT SELL, whatever it is offered. Selling to
        // whoever would work a vein better emptied every authored holding in
        // the first decade of every seed, the same way each time.
        const purse = howThePurseIsRunning(holder.purse, holder.payroll);
        const shortBy = holder.payroll - holder.purse;
        const buyer = holder.holdsOnAGrant || purse === 'solvent' ? undefined : holder.onTermsWith
            .map(id => byId.get(id))
            .filter((h): h is AHouseAsItStands => h !== undefined && h.id !== holder.id && canWork(h, vein))
            .filter(h => priceOf(h) >= shortBy
                && h.purse - priceOf(h) >= WHAT_A_HOUSE_KEEPS_IN_HAND * h.payroll)
            .sort(nearestFirst(vein))[0];
        if (buyer) {
            const price = priceOf(buyer);
            buyer.purse -= price;
            holder.purse += price;
            out.push({ veinId: vein.id, how: 'sold', fromId: holder.id, toId: buyer.id, price });
            continue;
        }

        if (purse === 'cannot_pay' && (holder.members === 0 || holder.strongest < vein.worksAt)) {
            out.push({ veinId: vein.id, how: 'given_up', fromId: holder.id, toId: null, price: 0 });
        }
    }
    return out;
}

function priceOf(buyer: AHouseAsItStands): number {
    return Math.round(A_VEIN_SELLS_FOR_YEARS_OF_WHAT_IT_PAYS * buyer.aVeinPaysIt);
}
