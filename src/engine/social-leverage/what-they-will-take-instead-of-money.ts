/**
 * What somebody will take, and why being asked for money is the good outcome.
 *
 * `haggle` routed to the market read and every price in the world was fixed, so
 * an offer refused was the end of an exchange rather than information about it.
 * The ruling: mortal prices do not move, item for item is the real mechanic at
 * high tiers, and what happens depends on what the person will accept - so a
 * player can CHANGE WHAT THEY OFFER, which only works if a refusal says which
 * medium this person is on.
 *
 * ── THE LADDER RUNS FROM SAFE TO DANGEROUS ──────────────────────────────
 *
 * The corpus is explicit that a stranger asking for spirit stones is a RELIEF,
 * because the alternative is worse: a favour owed, a service somebody has to go
 * and perform, a hold over you. So this is not a flat list of acceptable media.
 * It has a direction, and somebody who will not take money and names something
 * else has turned a screw:
 *
 *     stones  <  goods  <  a favour  <  a service  <  a hold
 *
 * ── AND IT IS DERIVED, NOT AUTHORED ─────────────────────────────────────
 *
 * Which rung somebody is on is read off numbers that already decide it and are
 * not restated here: `PURSE_REACH` says how far a purse reaches for an ask of
 * this weight, `COIN_STOPS_BEING_THE_MEDIUM_AT` is where the cash line falls,
 * `openHandednessOf` is the per-person scalar the world already rolls for how
 * freely somebody parts with what they have, and an open need of theirs is the
 * one thing that turns a price into a service.
 *
 * Nothing here decides whether an offer is ACCEPTED. That is
 * `whatItWouldTake`'s arithmetic and it is untouched: this says what the offer
 * has to be MADE OF before that arithmetic is worth doing.
 *
 * ── AND EACH RUNG HAS TO BE MADE OF SOMETHING ───────────────────────────
 *
 * Naming a rung nothing in the engine can produce is the same defect as having
 * no ladder. `a service` was that for a long time: measured, the one changed
 * beast reachable everywhere wanted one 93% of the time and nothing anywhere
 * recorded that a service had been done. It is
 * `a-service-is-something-done.ts` now, and a caller reading this ladder reads
 * that for what standing on this rung is made of.
 */

import type { AskWeight } from './an-attempt-to-move-somebody.js';
import {
    COIN_STOPS_BEING_THE_MEDIUM_AT,
    LEVERAGE_ATTEMPT_CONSTANTS
} from './an-attempt-to-move-somebody.js';
import { DISPOSITION_BANDS, openHandednessOf } from './how-freely-somebody-parts-with-what-they-have.js';

/**
 * The medium somebody will take, mildest first.
 *
 * `a hold` is one rung and not three. Standing, a secret and a debt they can
 * call differ in what they are made of and not in what they cost the person
 * handing one over, which is the axis this ladder is about.
 */
export type WhatTheyWillTake = 'stones' | 'goods' | 'a favour' | 'a service' | 'a hold';

export const WHAT_THEY_WILL_TAKE_IN_ORDER: readonly WhatTheyWillTake[] =
    ['stones', 'goods', 'a favour', 'a service', 'a hold'];

/** How far up the ladder a medium sits. Higher is worse for the person paying. */
export function howFarUpTheLadder(medium: WhatTheyWillTake): number {
    return WHAT_THEY_WILL_TAKE_IN_ORDER.indexOf(medium);
}

export interface WhatIsBeingAskedFor {
    /** How heavy the ask is, in the vocabulary the resolver already prices. */
    ask: AskWeight;
    /**
     * Whether the thing has a price on a board anywhere. A bowl of millet does;
     * an art nobody else teaches does not, and no figure is the honest answer
     * for it rather than a large one.
     */
    hasACashPrice: boolean;
    /**
     * An open need of theirs the asker could actually serve. What turns a price
     * into a service: somebody who wants a thing done wants it done by you.
     */
    theyNeedSomethingDone: boolean;
}

/**
 * Which rung of the ladder this person is on for this ask.
 *
 * The person's own disposition moves it one rung either way and no further.
 * Somebody generous asks for the milder thing; somebody grasping asks for the
 * worse one. Neither turns a betrayal into a purchase - the ask is the floor.
 */
export function whatTheyWillTakeFor(
    personId: string,
    asked: WhatIsBeingAskedFor
): WhatTheyWillTake {
    const reach = LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH[asked.ask];
    const moneyReaches = reach > COIN_STOPS_BEING_THE_MEDIUM_AT;

    let at = moneyReaches
        ? (asked.hasACashPrice ? 0 : 1)
        : (asked.theyNeedSomethingDone ? 3 : 2);

    // THE ASK IS THE FLOOR, and nobody's disposition lifts it. A generous
    // person asks for the milder thing; there is no milder thing than a hold
    // over you when what is being asked for ends them if it is found out.
    const floor = reach <= LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH.a_betrayal
        ? 4
        : moneyReaches ? 0 : 2;
    at = Math.max(at, floor);

    const openHanded = openHandednessOf(personId);
    if (openHanded >= DISPOSITION_BANDS.MARKED) at -= 1;
    else if (openHanded <= -DISPOSITION_BANDS.MARKED) at += 1;
    return WHAT_THEY_WILL_TAKE_IN_ORDER[
        Math.min(WHAT_THEY_WILL_TAKE_IN_ORDER.length - 1, Math.max(floor, at))
    ];
}

/**
 * What a refusal has to tell the player, which is where they stand on the
 * ladder and which way to move.
 */
export interface WhereTheOfferLandedOnTheLadder {
    /** What they will take. */
    wants: WhatTheyWillTake;
    /** What was put in front of them. */
    offered: WhatTheyWillTake;
    /**
     * True where the offer is made of the right thing. Whether it is ENOUGH is
     * a separate question and this module does not answer it.
     */
    theRightKindOfThing: boolean;
    /** Whether naming something else is a step up in what it costs the asker. */
    theyHaveTurnedTheScrew: boolean;
    /** Engine-authored, and it always names the medium that would work. */
    line: string;
}

const IN_WORDS: Readonly<Record<WhatTheyWillTake, string>> = {
    stones: 'spirit stones',
    goods: 'something you are carrying',
    'a favour': 'an open account with your name on it',
    'a service': 'something done, by you, that they cannot do themselves',
    'a hold': 'something they could use against you afterwards'
};

export function whereTheOfferLanded(
    wants: WhatTheyWillTake,
    offered: WhatTheyWillTake
): WhereTheOfferLandedOnTheLadder {
    const gap = howFarUpTheLadder(wants) - howFarUpTheLadder(offered);
    const shape = {
        wants,
        offered,
        theRightKindOfThing: gap <= 0,
        theyHaveTurnedTheScrew: howFarUpTheLadder(wants) > 0
    };
    // THE RELIEF CASE, AND IT HAS TO READ AS ONE. Being quoted a figure is the
    // mildest thing that can happen at a table like this, and it is said
    // whichever way the gap runs: it is a fact about what is being asked for
    // rather than about what was put down.
    const relief = wants === 'stones'
        ? 'They want paying. Whatever else was in the air, this is a price, and a price is '
          + 'the cheapest thing anybody here could have asked you for. '
        : '';
    if (gap <= 0) {
        return {
            ...shape,
            line: `${relief}What is in front of them is ${IN_WORDS[offered]}, and what they `
                + `want is ${IN_WORDS[wants]}. That is the right kind of thing, which is not `
                + 'yet the same as enough of it.'
        };
    }
    return {
        ...shape,
        line: `${relief}They will not take ${IN_WORDS[offered]} for this. What they want is `
            + `${IN_WORDS[wants]}, which costs you more than money would have - and that is `
            + 'the answer to what you are asking for, not their opinion of you.'
    };
}

/**
 * Why a price on a board does not move, in the world's own terms.
 *
 * Not a blank look and not a rules note. A quoted rate is quoted because the
 * person quoting it does not set it, which is a fact about the counter rather
 * than about how hard the player pushed.
 */
export function whyAQuotedPriceDoesNotMove(what: string, quotedIn: string): string {
    return `${what} is not priced by whoever is handing it over. The rate is the rate, it is `
        + `the same rate for the next person in the queue, and it is quoted ${quotedIn}. `
        + 'Pushing on it gets you the same figure said more slowly. Haggling starts where '
        + 'the board stops - over a thing only one person has.';
}
