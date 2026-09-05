/**
 * What a house would take for somebody on its roll, and who else has a say.
 */

import type { AbilityTier } from '../world/hunting-a-spirit-beast.js';
import { bloodlineTierForChild } from '../world/hunting-a-spirit-beast.js';
import type { ObligationRecord } from '../social/grudges.js';
import {
    howHeavyThisAskIs,
    whatItWouldTake,
    type HowHeavyThisAskIs,
    type HowTheyAreHoldingIt,
    type OnTheTable,
    type WhatItWouldTake
} from '../social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import { bandForGap } from '../cultivation/regard.js';
import type { RegardBand } from '../../schema/cultivation.js';

// THE TWO SIDES, WHICH ARE ONE TYPE

/**
 * One person in a match, from either side of it.
 */
export interface APartyToAMatch {
    personId: string;
    /**
     * The rung they stand at. The one scale everything in this engine is
     * priced on, and the whole of what they carry a house to.
     */
    reachesTo: number;
    /**
     * What they carry of a line, in the three tiers the ability ladder already
     * uses. Null for the overwhelming majority of people, who carry nothing.
     */
    carriesTheLineAt: AbilityTier | null;
    /** The house they answer to, or null for somebody who answers to nobody. */
    houseId: string | null;
    /**
     * How that house's roll carries them, in `birth.ts`'s own three values.
     */
    onTheRoll: 'by blood' | 'by taking' | null;
}

/**
 * The house being asked, as the three facts that decide its answer.
 *
 * Every one of them is counted off the world rather than authored, so a house
 * that gains or loses a carrier changes its own answer with no edit here.
 */
export interface TheHouseBeingAsked {
    houseId: string;
    /** The rung the house itself reaches. Read only against the other side's. */
    reachesTo: number;
    /**
     * How many OTHER people on this roll carry the line at the tier this person
     * carries it at.
     */
    othersCarryingTheLineAsWell: number;
}

// PUTTING A LEDGER FAVOUR ON THE TABLE

/**
 * A favour already owed, as something that can be put down.
 */
export function aFavourOwedPutOnTheTable(
    record: Pick<ObligationRecord, 'id' | 'kind' | 'subjectId' | 'status'>,
    whoOwesItReachesTo: number
): OnTheTable {
    return {
        what: `a word from ${record.subjectId}, owed since it was earned`,
        carriesThemTo: Math.max(0, whoOwesItReachesTo),
        // A settled record is a receipt rather than an asset. It goes on the
        // table at nothing rather than being refused, which is the same shape
        // as everything else here: an offer that reaches nowhere is priced,
        // not rejected.
        singular: record.status === 'open' && record.kind === 'favor'
    };
}

// WHAT THE HOUSE WOULD TAKE

/** What a house is short of, read off what it has rather than off a table. */
export type WhatTheHouseIsShortOf =
    /** Its line is wasting and this match would waste it further. It wants blood. */
    | 'a carrier for the line'
    /** Its line holds either way. What it is selling is the rung. */
    | 'nothing it cannot buy';

export interface WhatAHouseWouldTake {
    /**
     * The price, from the module that owns pricing. Unmodified.
     *
     * `theHeightToReach` is the person's own rung, because that is what the
     * house gives up and what anybody else would give for it.
     */
    price: WhatItWouldTake;
    /** The two facts `resolveAttempt` needs, from that module's own mapping. */
    weight: HowHeavyThisAskIs;
    /** What this house wants, derived from its line and never from a row. */
    shortOf: WhatTheHouseIsShortOf;
    /**
     * What the children of this match would carry, from `bloodlineTierForChild`,
     * unchanged and uncopied.
     */
    theLineTheChildrenWouldCarry: AbilityTier | null;
    /** True when the match costs this house the tier it currently holds. */
    theLineStepsDown: boolean;
    /** How far apart the two stand, in the vocabulary used everywhere else. */
    howFarApart: RegardBand;
    /** Engine-authored and factual. Never narration. */
    line: string;
}

/**
 * What a house would take for somebody on its roll, and whether this is it.
 */
export function whatAHouseWouldTakeForAMatch(input: {
    house: TheHouseBeingAsked;
    /** Who is being asked for. Their side of the match. */
    theirs: APartyToAMatch;
    /** Who is proposing. The other side. Identical type, no other difference. */
    theOther: APartyToAMatch;
    /** Everything put down. Open, unbranched, and never a currency. */
    table: readonly OnTheTable[];
}): WhatAHouseWouldTake {
    const { house, theirs, theOther, table } = input;

    // The one existing rule, called rather than restated. It reads both sides
    // and nothing else - not their houses, not who proposed, not their rungs.
    const theLineTheChildrenWouldCarry =
        bloodlineTierForChild(theirs.carriesTheLineAt, theOther.carriesTheLineAt);

    const theLineStepsDown =
        theirs.carriesTheLineAt !== null
        && theLineTheChildrenWouldCarry !== theirs.carriesTheLineAt;

    // The last carrier of a line that this match would end is a present need,
    // and `what-somebody-would-take-for-a-thing-they-will-not-sell.ts` has
    // already ruled on what a present need is worth. A house with one spare
    // prices its own decay instead, which is the behaviour the owner described
    // and it comes out of the same count.
    const theLastOfIt = theLineStepsDown && house.othersCarryingTheLineAsWell === 0;

    const holding: HowTheyAreHoldingIt = {
        theirClaimCanWait: !theLastOfIt,
        theirsToGive: theirs.onTheRoll !== null,
        itCarriesTo: theirs.reachesTo,
        theyReachTo: house.reachesTo
    };

    const price = whatItWouldTake(holding, table);
    const shortOf: WhatTheHouseIsShortOf =
        theLineStepsDown ? 'a carrier for the line' : 'nothing it cannot buy';
    const howFarApart = bandForGap(theOther.reachesTo - theirs.reachesTo);

    return {
        price,
        weight: howHeavyThisAskIs(price),
        shortOf,
        theLineTheChildrenWouldCarry,
        theLineStepsDown,
        howFarApart,
        line: sentenceFor({ price, shortOf, theLastOfIt, theirs, house })
    };
}

function sentenceFor(input: {
    price: WhatItWouldTake;
    shortOf: WhatTheHouseIsShortOf;
    theLastOfIt: boolean;
    theirs: APartyToAMatch;
    house: TheHouseBeingAsked;
}): string {
    const { price, shortOf, theLastOfIt } = input;

    if (price.why === 'the_answer_is_not_theirs_to_give') {
        return 'This house does not decide where that person goes. They live on its ground and '
            + 'are not on its roll, so there is nobody here to put a price to. What would work is '
            + 'asking them, or asking whoever their family is.';
    }
    if (price.why === 'they_need_it_themselves' && theLastOfIt) {
        return 'They are the last of the line this house still has, and the match would end it '
            + 'inside three generations. There is no figure, because what is being asked for is '
            + 'the house itself. What would work is a match that holds the line rather than '
            + 'spending it, or waiting until there is somebody else who carries it.';
    }
    if (price.why === 'they_need_it_themselves') {
        return 'The house needs them where they are and needs it now. There is no figure and no '
            + 'trade until that stops being true.';
    }
    if (shortOf === 'a carrier for the line') {
        return 'The house will hear it, and what it wants is not money: this match spends a line '
            + 'it has left, so what it is weighing is whether what comes back is worth what goes '
            + `out. Put down something singular that carries somebody to rung ${price.theHeightToReach} `
            + 'or better - an art, a thing out of a hole nobody else has been down, a word from '
            + 'somebody standing that high, or a place found for somebody it owes.';
    }
    if (price.why === 'nothing_was_put_down') {
        return 'The house would discuss it, and not for a purse. What it would take is something '
            + `singular that carries somebody to rung ${price.theHeightToReach} or better. Name what `
            + 'you have, not what you can pay.';
    }
    if (price.why === 'what_was_put_down_does_not_reach') {
        return `${price.theBestPutDown} carries somebody to rung ${price.theBestOnTheTable}, and `
            + `they are giving up somebody who carries a house to rung ${price.theHeightToReach}. `
            + 'They can do that arithmetic while you are still talking.';
    }
    return `${price.theBestPutDown} carries somebody to rung ${price.theBestOnTheTable} and they `
        + `are giving up rung ${price.theHeightToReach}, so what is on the table serves the house `
        + 'at least as well as keeping them does. That is a match the house would entertain, '
        + 'which is not the same as one anybody has agreed to.';
}

// AND WHO ELSE HAS A SAY

/**
 * The three parties, named once.
 *
 * `'the person'` is here so that a caller enumerating who has a say cannot
 * silently omit them, and this module answers for the other two only.
 */
export type WhoHasASay = 'the house' | 'the parents' | 'the person';

export interface WhatAPartySays {
    party: WhoHasASay;
    /**
     * Null for `'the person'`, always, and that is the design rather than a
     * gap: consent is `resolveAttempt`'s and there must not be a second model
     * of it. A caller that wants the third answer runs that resolver.
     */
    inFavour: boolean | null;
    because: string;
}

export interface WhoAgreesAndWhoDoesNot {
    says: readonly WhatAPartySays[];
    /**
     * True when the two parties this module can answer for disagree.
     */
    theyDisagree: boolean;
    /**
     * True when the two answered parties are both in favour and the only remaining
     * question is the person's.
     */
    onlyThePersonIsLeftToAsk: boolean;
}

/**
 * What the head of the house and the parents each say, and where they differ.
 */
export function whoAgreesAndWhoDoesNot(
    answer: WhatAHouseWouldTake
): WhoAgreesAndWhoDoesNot {
    const houseInFavour = answer.weight.thePriceWasMet;

    // A parent watching the line step down is against it, and a parent whose
    // grandchildren would carry what they carry, or better, is not. Where
    // there is no line either way the question is the ordinary one about how
    // far apart the two families stand.
    const parentsInFavour = answer.theLineStepsDown
        ? false
        : !PARENTS_BALK_AT.includes(answer.howFarApart);

    const says: WhatAPartySays[] = [
        {
            party: 'the house',
            inFavour: houseInFavour,
            because: houseInFavour
                ? 'What is on the table serves the house at least as well as keeping them does.'
                : answer.line
        },
        {
            party: 'the parents',
            inFavour: parentsInFavour,
            because: answer.theLineStepsDown
                ? 'Their grandchildren would carry less of the line than their children do, and '
                  + 'three generations of that is a family that says it has a thing and cannot '
                  + 'show you.'
                : parentsInFavour
                    ? 'Nothing of theirs is spent by it and the two families are not so far apart '
                      + 'that it would be remarked on.'
                    : `The two stand ${answer.howFarApart} of each other, and a family notices `
                      + 'that long before a house does.'
        },
        {
            party: 'the person',
            inFavour: null,
            because: 'Not answered here. Whether somebody can be moved is the one resolver that '
                + 'answers it, and it reads no house, no alignment and nothing about who either '
                + 'of them is.'
        }
    ];

    return {
        says,
        theyDisagree: houseInFavour !== parentsInFavour,
        onlyThePersonIsLeftToAsk: houseInFavour && parentsInFavour
    };
}

/**
 * The bands at which a family objects on distance alone. The two ends, and only
 * the two ends: a match across a gulf is remarked on in both directions and
 * everything in between is ordinary. Pinned by
 * `a-family-objects-at-the-ends-and-nowhere-else.test.ts`.
 */
export const PARENTS_BALK_AT: readonly RegardBand[] = Object.freeze([
    'unreachable',
    'dismissed'
] as const);
