/**
 * Asking a thing that can say no for a piece of its own body.
 *
 * It was already ruled and written down that above `BEAST_CHANGE_ORDINAL` a
 * beast is a person, so its material may be asked for rather than cut off a
 * corpse, and that this is the only road to the heaven-grade version a
 * righteous house has - `THREE_ROADS_TO_WHAT_A_PERSON_CARRIES` states it and
 * points at the offer ladder. Nothing put the question. This is the road.
 *
 * ── IT IS A HAGGLE, AND THERE IS ONLY ONE HAGGLE ────────────────────────
 *
 * `whatAHaggleSentenceIs` reads the sentence, `whatTheyWillTakeFor` says which
 * medium this party is on, `whereTheOfferLanded` says where the offer landed
 * and names the rung that would have worked, and `howTheHaggleWent` writes the
 * price statement and the refusal. None of that is re-expressed here.
 *
 * What is here is the one answer `howTheHaggleWent` has no shape for, because
 * nothing in it is a figure: the grant. That function closes on arithmetic -
 * did the stones cover the ask - and the whole point of this counter is that
 * stones never do. So the gate for a grant is `theRightKindOfThing`, which is
 * the same ladder reading `howTheHaggleWent` itself defers to before it does
 * any arithmetic at all.
 *
 * ── WHY A REFUSAL IS THE NORMAL ANSWER ──────────────────────────────────
 *
 * The ask sits below the cash line, so money is refused before the arithmetic
 * is reached, and the refusal carries the rung. What moves it is not the size
 * of the offer but what you ARE to them: an open account they owe you is the
 * FAVOUR rung, and standing on it is what a kindness bought. Goodwill is not a
 * number here and never was - it changes which rung you are standing on, and
 * the ask is the same size either way.
 */

import type { Beast } from '../data/cultivation/beasts.js';
import {
    howTheHaggleWent,
    type HowTheHaggleWent,
    type WhatTheHaggleSaid,
    type WhatWasPutDown
} from './going-back-and-forth-over-a-price.js';
import {
    whatTheyWillTakeFor,
    whereTheOfferLanded,
    type WhatTheyWillTake
} from '../engine/social-leverage/what-they-will-take-instead-of-money.js';
import {
    theAskThisIs,
    whatAPieceIsPricedAt,
    whatGivingItCosts,
    type APieceOfItself,
    type WhatGivingItCost
} from '../engine/world/what-it-costs-to-give-away-a-piece-of-yourself.js';

export interface HowTheAskForAPieceWent {
    /** True only where the thing actually pulled the piece out. */
    granted: boolean;
    answer: HowTheHaggleWent['answer'];
    headline: string;
    lines: string[];
    structure: string[];
    /** What it cost the giver. Null on every answer but a grant. */
    cost: WhatGivingItCost | null;
    /** Which rung they are on, so a caller can report it without recomputing. */
    wants: WhatTheyWillTake;
    offered: WhatTheyWillTake;
}

/**
 * Whether what this one wants is a thing a person could go and DO.
 *
 * Off `veinRelation`, which is the column that already answers it: a creature
 * that holds ground wants you finished and gone, one that follows or drains
 * wants what the earth has, and one that is INDIFFERENT to ground holds no
 * deed anywhere - so what it wants is held or done by somebody. That is the
 * definition of a service, and it is read rather than authored.
 */
function theyNeedSomethingDone(beast: Beast): boolean {
    return beast.veinRelation === 'indifferent';
}

export function howTheAskForAPieceWent(input: {
    beast: Beast;
    piece: APieceOfItself;
    sentence: WhatTheHaggleSaid;
    putDown: WhatWasPutDown;
    /**
     * True where the player holds an open favour this creature owes them. The
     * FAVOUR rung, and the only thing a kindness buys.
     */
    theyOweYou: boolean;
    purse: number;
    turn: number;
    onDay: number;
    /** Who else is standing there. Empty is the private case. */
    seenBy: readonly string[];
}): HowTheAskForAPieceWent {
    const { beast, piece } = input;

    const wants = whatTheyWillTakeFor(beast.id, {
        ask: theAskThisIs(),
        // There is no board anywhere with a figure for a piece of somebody.
        hasACashPrice: false,
        theyNeedSomethingDone: theyNeedSomethingDone(beast)
    });
    // WHAT WAS PUT DOWN, IN THE LADDER'S OWN VOCABULARY. An account they owe
    // outranks anything in the hand, which is why it is read first.
    const offered: WhatTheyWillTake = input.theyOweYou
        ? 'a favour'
        : input.putDown.goods !== null ? 'goods' : 'stones';
    const landed = whereTheOfferLanded(wants, offered);

    const went = howTheHaggleWent(
        input.sentence,
        {
            name: piece.material.name,
            askStones: whatAPieceIsPricedAt(piece),
            sellerName: beast.name,
            theRateIsTheRate: false
        },
        input.putDown,
        landed,
        input.purse
    );

    const ladder =
        `${beast.id} is on the ${wants} rung for a piece of itself; what was put down reads `
        + `as ${offered}. Right kind of thing = ${landed.theRightKindOfThing}. `
        + `${piece.material.name} is ${piece.inTheCatalog ? 'a catalog row' : 'minted on the '
            + 'spot - this species carries no material entry, which is the contract and not a gap'}.`;

    // ASKING WHAT IT WOULD TAKE COSTS NOTHING, AND NOTHING COMES OFF ANYBODY.
    // The ladder line is appended because the figure alone is the misleading
    // half: there is a number and it is not what this closes on.
    if (input.sentence === 'asked_the_price') {
        return {
            granted: false,
            answer: went.answer,
            headline: went.headline,
            lines: [...went.lines, landed.line],
            structure: [went.structure, ladder],
            cost: null,
            wants,
            offered
        };
    }

    if (!landed.theRightKindOfThing) {
        return {
            granted: false,
            answer: went.answer,
            headline: went.headline,
            lines: went.lines,
            structure: [went.structure, ladder],
            cost: null,
            wants,
            offered
        };
    }

    // ── THE GRANT ────────────────────────────────────────────────────────
    //
    // It agrees, and then it does it to itself. The engine states the three
    // facts and no more than the three: what was pulled out, what that leaves
    // in the body, and who watched. Wincing is the narrator's.
    const cost = whatGivingItCosts({
        beast,
        piece,
        turn: input.turn,
        onDay: input.onDay,
        seenBy: input.seenBy
    });

    const years = `${cost.growsBackInYears} year${cost.growsBackInYears === 1 ? '' : 's'}`;
    return {
        granted: true,
        answer: 'yes',
        headline: `${beast.name} gives up ${piece.material.name}.`,
        lines: [
            `It takes ${piece.material.name} off its own body and holds it out. Nothing was cut `
            + `off it and nothing died: there was no such thing a moment ago, and now there is `
            + 'one.',
            `${cost.wound.description} ${cost.doesNotComeBack
                ? 'Nothing in the world closes this one.'
                : `${years} is what the body needs, and it is not shortened by anything.`}`,
            cost.shame === null
                ? 'Nobody else is standing here, and what it did costs it nothing in front of '
                  + 'anybody.'
                : `${input.seenBy.length} other${input.seenBy.length === 1 ? '' : 's'} watched it `
                  + `take itself apart because it was asked. That is a ${cost.shame.severity} `
                  + 'thing to be known for, and the people who saw it are the ones who know.',
            `The account is spent. What you were standing on is gone, and the next ask is made `
            + 'from wherever you stand without it.'
        ],
        structure: [went.structure, ladder, cost.note],
        cost,
        wants,
        offered
    };
}
