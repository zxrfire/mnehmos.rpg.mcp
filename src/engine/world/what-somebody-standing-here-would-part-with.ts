/**
 * What the cultivator standing next to you would part with, and why.
 */

import { quoteSale } from '../cultivation/market.js';
import { earningsPerYear } from '../cultivation/origin.js';

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
// WHY IT MOVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why this particular person would let this particular thing go.
 */
export type WhyTheyWouldPartWithIt =
    | 'not_theirs_to_be_seen_with'
    | 'they_need_stones'
    | 'it_is_beyond_them'
    | 'they_have_outgrown_it';

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
        they_have_outgrown_it: 0.5
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
            awkwardToHold: thing.awkwardToHold as 0 | 1
        });
    }

    return { who, offers, withheld };
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
        not_theirs_to_be_seen_with:
            'It is not theirs and they are not of the house it belongs to, which anybody who '
            + 'knows it can see at a glance. They are not asking much and they are not going to '
            + 'say where it came from.',
        they_need_stones:
            'They need the stones more than they need it, and they are not pretending otherwise. '
            + 'The price is what somebody who has to sell today asks.',
        it_is_beyond_them:
            'It is pitched above where they are standing, so it is worth nothing to them and '
            + 'they know it is worth something to somebody. They are in no hurry about it.',
        they_have_outgrown_it:
            'They have climbed past where it stops being any use, so it does nothing for them '
            + 'and they would rather have the stones. Nothing is pressing them either way.'
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
