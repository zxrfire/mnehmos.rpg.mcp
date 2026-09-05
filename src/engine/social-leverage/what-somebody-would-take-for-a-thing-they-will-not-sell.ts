/**
 * What somebody would take for a thing they will not sell. The design owner: *"just
 * be like: I need xyz, what's your price?"*
 */

import type { WhatANeedDoesToAPrice } from '../world/what-an-open-need-does-to-an-ask-and-to-a-price.js';

/**
 * One thing put down. THE MEDIUM IS NOT A FIELD HERE AND MUST NEVER BECOME ONE:
 * `what` is a label no conditional reads, and {@link OnTheTable.carriesThemTo}
 * decides everything.
 */
export interface OnTheTable {
    /** Echoed into the line. Read by no conditional here or downstream. */
    what: string;
    /**
     * How high it carries the person receiving it. The whole of the pricing.
     * Below zero reads as zero rather than being rejected: a thing that carries
     * nobody anywhere is on the table and worth nothing.
     */
    carriesThemTo: number;
    /**
     * Whether it is theirs afterwards, and theirs alone. A FUNGIBLE OFFER IS
     * PRICED AT NOTHING here however large, because above the cash line the
     * reason money fails is that anybody can have more of it. Same statement
     * `PURSE_REACH` makes in the resolver, and the two must not disagree.
     */
    singular: boolean;
}

/**
 * How the holder is holding it. DELIBERATELY NOT A REASON: two live models
 * already answer WHY for different kinds of holder, and both collapse onto
 * these four facts. A tenth reason needs no line here.
 */
export interface HowTheyAreHoldingIt {
    /**
     * Whether their own claim can wait. False is a PRESENT NEED and a refusal at
     * any figure; true is a store put by, which is an asset with a price.
     */
    theirClaimCanWait: boolean;
    /**
     * Whether saying yes was ever theirs to say. `immortal-items.ts`: *"there is no
     * version of the problem where the player finds the right person and applies
     * enough pressure."* A player must be able to tell this apart from a price they
     * have not met, or they spend a run hunting a lever that is not there.
     */
    theirsToGive: boolean;
    /** How high the thing carries whoever ends up with it. The asking price. */
    itCarriesTo: number;
    /**
     * How high its holder can reach. Read ONLY to say whether the thing is above
     * their own head. It does not move the price: the price is the object's rung
     * whoever holds it.
     */
    theyReachTo: number;
}

/**
 * Why what is on the table does not move it. The first two name something the
 * player CANNOT do differently and the last two something they can, which is
 * the point of separating them: a refusal must not name a door nobody built.
 */
export type WhyItDoesNotMove =
    /** A present need. No figure reaches it, and none should. */
    | 'they_need_it_themselves'
    /** Arithmetic rather than a lever. Nobody is being refused. */
    | 'the_answer_is_not_theirs_to_give'
    /** Nothing singular was put down. Money is not the medium up here. */
    | 'nothing_was_put_down'
    /** Something was, and it does not reach as high as the thing does. */
    | 'what_was_put_down_does_not_reach';

export interface WhatItWouldTake {
    /** Whether the trade is one they would entertain. Never whether they agree. */
    itIsATrade: boolean;
    /**
     * The height an offer has to reach: the thing's own rung. Stated even where
     * nothing would move it - on a present need the price is real and only the
     * timing is not.
     */
    theHeightToReach: number;
    /** The best thing on the table, at what it carries them to. Zero for nothing. */
    theBestOnTheTable: number;
    /** The label of whatever that was, for the sentence. Null when nothing was. */
    theBestPutDown: string | null;
    /** Null exactly when {@link itIsATrade} is true. */
    why: WhyItDoesNotMove | null;
    /**
     * Engine-authored and factual. Every branch names what WOULD work, which is
     * the standard `asking.md` sets for a refusal.
     */
    line: string;
}

/**
 * What the holder would take, and whether this is it.
 */
export function whatItWouldTake(
    holding: HowTheyAreHoldingIt,
    table: readonly OnTheTable[]
): WhatItWouldTake {
    const bar = Math.max(0, holding.itCarriesTo);

    // Priced BEFORE anything is refused: the price is a fact about the object
    // and stays true when the timing does not.
    let best: OnTheTable | null = null;
    for (const item of table) {
        if (!item.singular) continue;
        const carries = Math.max(0, item.carriesThemTo);
        if (best === null || carries > Math.max(0, best.carriesThemTo)) best = item;
    }
    const offered = best === null ? 0 : Math.max(0, best.carriesThemTo);
    const put = best?.what ?? null;

    const shape = {
        theHeightToReach: bar,
        theBestOnTheTable: offered,
        theBestPutDown: put
    };

    // Nobody is refusing. There is nothing here to reach.
    if (!holding.theirsToGive) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'the_answer_is_not_theirs_to_give',
            line: 'Whoever is holding this does not decide where it goes. It is counted, it is '
                + 'owed somewhere, and releasing one is a decision somebody else takes - so there '
                + 'is no price here and no person to put one to. What would work is finding one '
                + 'held by somebody who can simply say yes.'
        };
    }

    // A present need is not a bargaining position: not a seller at any figure.
    if (!holding.theirClaimCanWait) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'they_need_it_themselves',
            line: 'They are not holding this against a day that may come. They need it, and they '
                + `need it now, so there is no figure and no trade - what it would take is for `
                + 'that to stop being true, or for the thing to be found somewhere else.'
        };
    }

    // From here the answer is a price and the only question is whether it is met.
    if (best === null) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'nothing_was_put_down',
            line: `They would part with it, and not for money. What it would take is something `
                + `singular that carries somebody to ${rung(bar)} or better - an art nobody else `
                + 'teaches, a thing out of a hole nobody else has been down, a debt from '
                + 'somebody standing that high, or a service only you could do. Name what you '
                + 'have, not what you can pay.'
        };
    }

    if (offered < bar) {
        return {
            ...shape,
            itIsATrade: false,
            why: 'what_was_put_down_does_not_reach',
            line: `${best.what} carries somebody to ${rung(offered)}, and what they are holding `
                + `carries somebody to ${rung(bar)}. They can do that arithmetic while you are `
                + 'still talking. What would work is something that reaches at least as high as '
                + 'the thing you are asking for.'
        };
    }

    return {
        ...shape,
        itIsATrade: true,
        why: null,
        line: `${best.what} carries somebody to ${rung(offered)} and what they are holding `
            + `carries somebody to ${rung(bar)}, so what you have put down serves them at least `
            + 'as well as keeping it does. That is a trade they would entertain, which is not the '
            + 'same as one they have agreed to.'
    };
}

/**
 * A rung as a number and NOT a realm name: ladder bounds live in `realms.ts`,
 * and restating them here is how they go stale.
 */
function rung(ordinal: number): string {
    return `rung ${Math.max(0, Math.round(ordinal))}`;
}

/**
 * How heavy an ask this is, once the price is known. Returned as two booleans and
 * NOT as an `AskWeight`, so this module never imports the resolver's vocabulary and
 * the resolver never imports this one's.
 */
export interface HowHeavyThisAskIs {
    /** True where the price was met. The caller maps this to its ask weight. */
    thePriceWasMet: boolean;
    /**
     * The resolver's `theyWantSomethingFromYou` term. True exactly when
     * something singular was put down that reaches them - not when the player
     * merely turned up, and not for money on a table money does not reach.
     */
    theyWantWhatIsInFrontOfThem: boolean;
}

/**
 * The two facts the resolver needs. Kept here and not in the caller: a second
 * caller deriving it its own way is how two callers come to disagree about what
 * a met price is.
 */
export function howHeavyThisAskIs(answer: WhatItWouldTake): HowHeavyThisAskIs {
    return {
        thePriceWasMet: answer.itIsATrade,
        theyWantWhatIsInFrontOfThem: answer.itIsATrade
    };
}

/**
 * The holder's side, built from the ONE model that decides it.
 */
export function howTheyAreHoldingIt(
    need: { effect: WhatANeedDoesToAPrice } | null,
    itCarriesTo: number,
    theyReachTo: number
): HowTheyAreHoldingIt {
    return {
        theirClaimCanWait: need?.effect !== 'will_not_part_with_it_at_any_price',
        theirsToGive: need?.effect !== 'the_answer_is_not_theirs_to_give',
        itCarriesTo,
        theyReachTo
    };
}

/** Exported so a probe and a test can pin the shape without resolving one. */
export const WHAT_IT_WOULD_TAKE_CONSTANTS = Object.freeze({
    /**
     * There is no threshold in this module and that is the point. Anything that
     * appeared here would be a price somebody chose.
     */
    theBarIsTheObjectsOwnRung: true
});
