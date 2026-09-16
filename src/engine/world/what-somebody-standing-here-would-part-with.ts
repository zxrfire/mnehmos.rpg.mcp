/**
 * What the person standing next to you would part with, and why.
 *
 * TWO POPULATIONS, ONE SQUARE, and which of them somebody belongs to is a fact
 * about THEM rather than about the thing in their hands or the ground under
 * their feet. The design owner: *"rando npcs only sell random mortal items"*,
 * *"a cultivator only sells cultivator items"*. A villager behind a barrow
 * deals in the mortal board; somebody on the ladder deals in what they are
 * carrying, and never in maize.
 *
 * {@link whatTheyDealIn} is the whole of the split and it needed no new field:
 * `FOUNDATION_ORDINAL` already draws the line, in the words of the module that
 * owns the ladder - *"below it a character is a mortal with a party trick,
 * above it they are a cultivator"* - and three other passes already read it as
 * exactly that. Each side has its own entry point below, which is what keeps
 * the same object in two pairs of hands two different transactions.
 */

import { quoteSale } from '../cultivation/market.js';
import { earningsPerYear } from '../cultivation/origin.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing in somebody's hands, as the columns that decide whether it moves.
 */
export interface AThingInSomebodysHands {
    id: string;
    name: string;
    /**
     * The rung from which this is any use to a holder at all.
     */
    usableFrom: number;
    /**
     * The rung past which it does nothing further for its holder.
     *
     * A manual's `cap` - where the crossing it teaches leaves a reader. Once
     * the holder stands at or beyond this, the thing is surplus.
     */
    usefulUntil: number;
    /**
     * What one of these is worth in spirit stones, before anybody's situation
     * is read into it. The caller's number, off the thing's own catalog.
     */
    listStones: number;
    /**
     * How uncomfortable this is to be seen holding. 0..3.
     */
    awkwardToHold: 0 | 1 | 2 | 3;
    /** Who would want a word about it, when anybody would. A faction id. */
    whoWouldWantAWord: string | null;
    /**
     * Whether the holder can make another and keep this one.
     */
    copyable: boolean;
    /**
     * What would change hands is a copy, and the original stays where it is.
     */
    whatMovesIsACopy?: boolean;
    /**
     * A need this thing answers that the caller knows about and this module cannot
     * see. A refusal at any figure.
     */
    theyStillNeedIt?: boolean;
}

/**
 * One row of the mortal board, as a person behind a barrow deals in it.
 *
 * No `usableFrom`, no `usefulUntil`, no mastery and nothing withheld: a bowl of
 * millet carries nobody anywhere, and a stallholder who sells one has another.
 * The whole of it is a name and what they are asking.
 */
export interface AThingOnTheirCounter {
    id: string;
    name: string;
    /** What they want for it, in whole spirit stones. The board's own figure. */
    askStones: number;
}

/** The person holding it, as the three columns that decide their posture. */
export interface SomebodyStandingHere {
    id: string;
    name: string;
    ordinal: number;
    /** What is in their purse. On the roster for every person in the world. */
    spiritStones: number;
    /** Their house, or null. Decides whose signature is theirs to wear. */
    factionId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH OF THE TWO THEY ARE
// ─────────────────────────────────────────────────────────────────────────

/** Which board somebody's stock comes off. */
export type WhatTheyDealIn = 'the_mortal_board' | 'what_they_hold';

/**
 * The split, derived and stored nowhere.
 *
 * Read the rung and nothing else: a person's trade is not a column anybody
 * writes and would drift from their rung the moment they crossed. Measured over
 * three seeded worlds and 647 people standing in 81 squares, the world's own
 * data already obeyed this - every single seller was at or above
 * `FOUNDATION_ORDINAL`, and not one person below it offered anything at all.
 */
export function whatTheyDealIn(who: Pick<SomebodyStandingHere, 'ordinal'>): WhatTheyDealIn {
    return who.ordinal < FOUNDATION_ORDINAL ? 'the_mortal_board' : 'what_they_hold';
}

// ─────────────────────────────────────────────────────────────────────────
// WHY IT MOVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why this particular person would let this particular thing go.
 */
export type WhyTheyWouldPartWithIt =
    | 'not_theirs_to_be_seen_with'
    | 'they_need_stones'
    | 'it_is_beyond_them'
    | 'they_have_outgrown_it'
    /**
     * It is their trade. The only reason on the mortal side of the split, and
     * the one reason that is about the seller rather than about the thing.
     */
    | 'it_is_what_they_deal_in';

/**
 * Why nobody is going to be selling you this one.
 *
 * A refusal that names a way out, which is this repo's pattern. All three have
 * one, and none of them is money.
 */
export type WhyItDoesNotMove =
    | 'it_is_their_own_house_s'
    | 'nobody_alive_could_replace_it'
    | 'they_are_going_to_need_it'
    /**
     * They hold it and they have not mastered it, so there is no copy to sell.
     */
    | 'they_could_not_write_one_out';

/**
 * How badly somebody wants a thing gone, as where their ask sits between what a
 * counter would give them and what the thing is worth.
 */
export const HOW_BADLY_THEY_WANT_IT_GONE:
    Readonly<Record<WhyTheyWouldPartWithIt, number>> = Object.freeze({
        not_theirs_to_be_seen_with: 1,
        they_need_stones: 1,
        it_is_beyond_them: 0,
        they_have_outgrown_it: 0.5,
        // A stallholder is not eager and is not pressed. The board's figure is
        // the figure, and it is the same one for the next person in the queue.
        it_is_what_they_deal_in: 0
    });

/**
 * How thin a purse has to be before it is a reason to sell something.
 */
export const A_YEAR_OF_THEIR_OWN_INCOME = 1;

/** True when the purse would not cover a year of what they earn. */
export function theirPurseIsThin(who: SomebodyStandingHere): boolean {
    return who.spiritStones < earningsPerYear(who.ordinal) * A_YEAR_OF_THEIR_OWN_INCOME;
}

/**
 * Whether this is the thing they are currently living on.
 */
export function itIsTheThingTheyAreStillUsing(
    who: SomebodyStandingHere,
    thing: Pick<AThingInSomebodysHands, 'usableFrom' | 'usefulUntil'>
): boolean {
    return thing.usableFrom <= who.ordinal && who.ordinal < thing.usefulUntil;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ANSWER
// ─────────────────────────────────────────────────────────────────────────

export interface AnOfferStandingHere {
    sellerId: string;
    sellerName: string;
    thingId: string;
    name: string;
    why: WhyTheyWouldPartWithIt;
    /** What they are asking, in whole spirit stones. Never below one. */
    askStones: number;
    /** What the thing is worth before anybody's situation is read into it. */
    listStones: number;
    /** What a counter would have given them for it. The floor of the band. */
    counterStones: number;
    usableFrom: number;
    usefulUntil: number;
    /**
     * Who would want a word about it, when anybody would.
     */
    whoWouldWantAWord: string | null;
    /** The awkwardness rung, for the record and for the provenance note. */
    awkwardToHold: 0 | 1;
    /**
     * Which side of the split this came off, carried so a caller wording the
     * offer does not have to re-derive it and cannot get it wrong. A copy is
     * written out and a bowl of millet is handed over, and one sentence cannot
     * describe both.
     */
    fromTheMortalBoard: boolean;
}

export interface WhyThisOneStaysWhereItIs {
    thingId: string;
    name: string;
    why: WhyItDoesNotMove;
}

/**
 * Everything one person standing here would let go of, and everything they would
 * not.
 */
export interface WhatThisPersonWouldDo {
    who: SomebodyStandingHere;
    offers: AnOfferStandingHere[];
    withheld: WhyThisOneStaysWhereItIs[];
}

/**
 * Read one person against everything in their hands.
 */
export function whatThisPersonWouldPartWith(
    who: SomebodyStandingHere,
    holding: readonly AThingInSomebodysHands[]
): WhatThisPersonWouldDo {
    const offers: AnOfferStandingHere[] = [];
    const withheld: WhyThisOneStaysWhereItIs[] = [];
    const thinPurse = theirPurseIsThin(who);

    for (const thing of holding) {
        // ── THE THREE THAT DO NOT MOVE ───────────────────────────────────
        //
        // In this order, because each is a stronger fact than the one after
        // it. A thing nobody alive could make again is not for sale even by
        // somebody starving who owes its owner nothing; their own house's is
        // not for sale however little they want it; and a need that is running
        // now outranks any figure.
        if (thing.awkwardToHold === 3) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'nobody_alive_could_replace_it'
            });
            continue;
        }
        if (thing.awkwardToHold === 2) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'it_is_their_own_house_s'
            });
            continue;
        }
        // AND THE THING THEY CANNOT WRITE OUT. What would move is a copy, and
        // making one takes having taken the thing to its end - so a holder
        // short of that has nothing to offer rather than an object to hand
        // over. Ahead of the present-need rule because it is a harder fact:
        // needing a thing is about today, and not being able to reproduce it is
        // about what they are.
        if (thing.whatMovesIsACopy === true && !thing.copyable) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'they_could_not_write_one_out'
            });
            continue;
        }
        // A COPY IS NOT A PARTING. Nothing leaves the holder's hands, so the
        // rule that protects the road they are walking has nothing to protect.
        // See {@link AThingInSomebodysHands.copyable}.
        if (!thing.copyable
            && (thing.theyStillNeedIt === true || itIsTheThingTheyAreStillUsing(who, thing))) {
            withheld.push({
                thingId: thing.id, name: thing.name, why: 'they_are_going_to_need_it'
            });
            continue;
        }

        const why = whyThisOneWouldGo(who, thing, thinPurse);
        if (why === null) continue;

        // ── THE BAND, AND WHERE IN IT ────────────────────────────────────
        //
        // `quoteSale` is asked the question it was written to answer: this
        // person, at this rung, putting this thing on a counter. Its figure is
        // the least anybody would take; list is the most anybody would ask.
        const counter = quoteSale({
            item: { requiredOrdinal: thing.usableFrom },
            listStones: thing.listStones,
            quantity: 1,
            seller: { ordinal: who.ordinal }
        });
        const eager = HOW_BADLY_THEY_WANT_IT_GONE[why];
        const ask = thing.listStones + (counter.offeredStones - thing.listStones) * eager;

        offers.push({
            sellerId: who.id,
            sellerName: who.name,
            thingId: thing.id,
            name: thing.name,
            why,
            askStones: Math.max(1, Math.round(ask)),
            listStones: thing.listStones,
            counterStones: counter.offeredStones,
            usableFrom: thing.usableFrom,
            usefulUntil: thing.usefulUntil,
            whoWouldWantAWord: thing.whoWouldWantAWord,
            awkwardToHold: thing.awkwardToHold as 0 | 1,
            fromTheMortalBoard: false
        });
    }

    return { who, offers, withheld };
}

/**
 * Read one person against the board they deal in.
 *
 * The mortal half of the split, and it is a different shape from the half above
 * rather than the same one with a filter on it. Nothing is withheld, because
 * nothing here is scarce: the mortal board carries no quantity anywhere on it,
 * on purpose, and a stallholder who sells a bowl of millet has another. Nothing
 * is discounted either - what they are asking is what the counter beside them
 * asks, and a person who did not set the rate does not move it.
 */
export function whatThisPersonWouldSellOverACounter(
    who: SomebodyStandingHere,
    stock: readonly AThingOnTheirCounter[]
): WhatThisPersonWouldDo {
    return {
        who,
        offers: stock.map(row => ({
            sellerId: who.id,
            sellerName: who.name,
            thingId: row.id,
            name: row.name,
            why: 'it_is_what_they_deal_in' as const,
            askStones: Math.max(1, Math.round(row.askStones)),
            listStones: Math.max(1, Math.round(row.askStones)),
            counterStones: Math.max(1, Math.round(row.askStones)),
            // A thing nobody climbs with opens nowhere and stops nowhere, and
            // the reach clause is dropped rather than printed as 0 to 0.
            usableFrom: 0,
            usefulUntil: 0,
            whoWouldWantAWord: null,
            awkwardToHold: 0 as const,
            fromTheMortalBoard: true
        })),
        withheld: []
    };
}

/**
 * Which of the four readings explains this sale, or null when none does.
 */
export function whyThisOneWouldGo(
    who: SomebodyStandingHere,
    thing: AThingInSomebodysHands,
    thinPurse: boolean
): WhyTheyWouldPartWithIt | null {
    if (thing.awkwardToHold === 1) return 'not_theirs_to_be_seen_with';
    // A copy costs the copyist months of their life. Somebody who does not
    // need the money does not spend them, whatever else is true of the thing -
    // so a comfortable holder of a copyable book is offering nothing, and the
    // three readings below are about a thing actually leaving somebody's hands.
    if (thing.copyable) return thinPurse ? 'they_need_stones' : null;
    if (thinPurse) return 'they_need_stones';
    if (thing.usableFrom > who.ordinal) return 'it_is_beyond_them';
    if (thing.usefulUntil <= who.ordinal) return 'they_have_outgrown_it';
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS SAID ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The clause that explains the ask, in the seller's own situation.
 */
export const WHY_THEY_ARE_SELLING: Readonly<Record<WhyTheyWouldPartWithIt, string>> =
    Object.freeze({
        // LEADING WITH THE SUBJECT, NOT WITH `It is`. Both of these opened on a
        // dummy subject, which is the construction `the-engine-does-not-close-
        // on-the-weather` bans: the engine states the fact and the narrator
        // decides how a sentence starts. Same facts, said directly.
        not_theirs_to_be_seen_with:
            'They did not come by it honestly and they are not of the house it belongs to, '
            + 'which anybody who knows it can see at a glance. They are not asking much and '
            + 'they are not going to say where it came from.',
        they_need_stones:
            'They need the stones more than they need it, and they are not pretending otherwise. '
            + 'The price is what somebody who has to sell today asks.',
        it_is_beyond_them:
            'They cannot use a thing pitched this far above where they are standing, and they '
            + 'know it is worth something to somebody who can. They are in no hurry about it.',
        they_have_outgrown_it:
            'They have climbed past where it stops being any use, so it does nothing for them '
            + 'and they would rather have the stones. Nothing is pressing them either way.',
        it_is_what_they_deal_in:
            'This is what they deal in, and there is more of it behind them. The figure is the '
            + 'one the counters here quote and it is the same figure for the next person in the '
            + 'queue.'
    });

/** Why this one is not moving, and what would have to be true instead. */
export const WHY_IT_STAYS_WHERE_IT_IS: Readonly<Record<WhyItDoesNotMove, string>> =
    Object.freeze({
        it_is_their_own_house_s:
            'It is their own house\'s. Selling it is not an expensive thing to do, it is the '
            + 'thing a house pursues somebody across a lifetime for, and no figure you can name '
            + 'changes that. The road to it is the house, not the seller.',
        nobody_alive_could_replace_it:
            'It sits at the top of a shelf, and once it is out it is out - no house can undo '
            + 'that and none of them forgive it. It will not be bought here or anywhere.',
        they_are_going_to_need_it:
            'They are going to need it themselves, and inside the year. A present need is not a '
            + 'price you have not met; it is a refusal. Coming back after their crossing is a '
            + 'different conversation.',
        they_could_not_write_one_out:
            'They hold it and they have not taken it to the end, so there is no copy for them to '
            + 'sell and nothing they could do about that today. What moves a thing like this is '
            + 'somebody who mastered it, and there are not many of those.'
    });
