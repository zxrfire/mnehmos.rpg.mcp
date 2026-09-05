/**
 * The order the two consents came in, the power to make a refusal stick, and
 * whether the person goes along with an arrangement they did not make.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationInput } from '../social/grudges.js';
import {
    whatADeedLeaves,
    type Party,
    type Reach,
    type WhatADeedLeaves
} from '../social-leverage/what-a-deed-leaves.js';
import {
    canTheyBeMadeToPayForActing,
    reachFor,
    type Backing,
    type SomethingToLose
} from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import { bandForGap } from '../cultivation/regard.js';
import { DEFINING_STANDING } from '../world/when-somebody-does-not-come-back.js';

// THE TWO ROUTES

/**
 * Which consent came first, which is the only thing that separates the two.
 *
 * Written as an order rather than as two features, so a third order - if
 * anybody ever finds one - is a value and not a branch.
 */
export type TheRoute =
    /** The house answered before there was anything between the two of them. */
    | 'family first'
    /** They agreed, and the house is being told rather than asked. */
    | 'person first';

/**
 * Whether a refusal by the house opens an account at all.
 *
 * THE GATE IS CATEGORICAL AND NOT A THRESHOLD, and it must not become one. It is
 * not that a refusal after a yes is heavier - an ordinary refusal opens nothing
 * at all. Houses refuse constantly and must be able to without accumulating
 * enemies, or the world fills up with records that mean nothing. A house
 * refusing a match the two of them already made has taken something away.
 */
export function aRefusalOpensAnAccount(route: TheRoute): boolean {
    return route === 'person first';
}

/**
 * What a house refusing something the two of them already made leaves behind.
 */
export function whatRefusingAMatchTheyAlreadyMadeLeaves(input: {
    route: TheRoute;
    /** The house, or whoever spoke for it. */
    theHouse: Party;
    /** The suitor, who now holds it. */
    theSuitor: Party;
    /**
     * How much of what the suitor had was riding on it, 0..1.
     *
     * Decides how HEAVY, never whether. The negotiation already produced it:
     * the best thing put down against the suitor's own reach.
     */
    ofWhatTheyHad: number;
    onDay: DayIndex;
    /** How far the suitor can get at the house. The caller's, as always. */
    reach?: Reach;
    knownTo?: readonly string[];
    description?: string;
}): WhatADeedLeaves | null {
    if (!aRefusalOpensAnAccount(input.route)) return null;

    return whatADeedLeaves({
        deed: {
            // The ledger's own word for being made less of in front of people,
            // carried onto the record and read by nothing.
            cause: 'humiliation',
            paidBy: 'subject',
            cost: Math.max(0, Math.min(1, input.ofWhatTheyHad)),
            irreversible: true,
            promised: true,
            onDay: input.onDay,
            description: input.description
                ?? 'The two of them had agreed it, and the house said no to a thing that already '
                   + 'existed rather than to a question anybody had asked.',
            knownTo: input.knownTo,
            tags: ['match', 'refused_after_a_yes']
        },
        actor: input.theHouse,
        subject: input.theSuitor,
        reach: input.reach
    });
}

/** The records that refusal opens, or an empty list. */
export function accountsARefusalOpens(left: WhatADeedLeaves | null): readonly ObligationInput[] {
    return left?.opens ?? [];
}

// WHAT A HOUSE CAN MAKE STICK

/**
 * What is left when the house says no, given who the two parties are.
 *
 * Non-exhaustive by construction: it is what one existing call and one boolean
 * produce, so a fifth position is a fifth value rather than a fifth branch.
 */
export type WhatIsLeftWhenTheHouseSaysNo =
    /** Their answer is real, because they could make it cost something. */
    | 'a negotiation'
    /** Nothing follows from their no. It was never a negotiation. */
    | 'the refusal changes nothing'
    /** They can be leaned on, which is coercion and is priced as a wrong. */
    | 'they can be pressed'
    /** Go together and be pursued, or want it and not have it. */
    | 'elope, or give up';

export interface TheStandingBetweenThem {
    /**
     * The family, as the reprisal layer's own question: is there anything of
     * theirs that acting would cost?
     */
    theFamily: SomethingToLose;
    /** What the suitor's own house is worth against them. */
    theSuitorsBacking: Backing;
    /**
     * Whether the suitor is above the family in a way nothing they do reaches.
     */
    theSuitorIsOutOfTheirReach: boolean;
}

/**
 * Whether nothing this family does reaches the person they are refusing.
 *
 * Asks whether the FAMILY can reach the SUITOR, so the gap is read from the
 * family's side. Measured in play, a rung-44 cultivator putting a match to a
 * house standing at 29 read `beneath` looking down (`dismissed` wants seventeen
 * rungs) and `unreachable` looking up (which wants nine), and the code took the
 * looking-down reading and told an immortal to elope or give up. The two bands
 * are not mirror images, so which way round the gap is measured decides it.
 */
export function theSuitorIsPastWhatTheyCouldReach(
    theFamilyReachesTo: number,
    theSuitorReachesTo: number
): boolean {
    return bandForGap(theFamilyReachesTo - theSuitorReachesTo) === 'unreachable';
}

export interface WhatTheHousesNoIsWorth {
    is: WhatIsLeftWhenTheHouseSaysNo;
    /** The `Reach` the family has, in the ledger's own word. */
    theirReach: Reach;
    /** Engine-authored and factual. Never narration. */
    line: string;
}

/**
 * What a house's refusal is actually worth, and therefore what is left.
 */
export function whatTheHousesNoIsWorth(
    standing: TheStandingBetweenThem
): WhatTheHousesNoIsWorth {
    const available = canTheyBeMadeToPayForActing({
        aggrieved: standing.theFamily,
        backing: standing.theSuitorsBacking
    });
    const theirReach = reachFor(available);

    if (standing.theSuitorIsOutOfTheirReach) {
        // Their answer was never a negotiation. It is not that they were
        // overruled - it is that nothing followed from what they said, which
        // they knew while saying it.
        return {
            is: available === 'they_can_act'
                ? 'they can be pressed'
                : 'the refusal changes nothing',
            theirReach,
            line: available === 'they_can_act'
                ? 'They can still start something, and they are in no position to finish it. '
                  + 'What is on the table is not a price - it is whether they are leaned on, and '
                  + 'a match agreed that way is a match and a wrong, and both are written down.'
                : 'Their no follows from nothing. Nobody would act on it, nobody would answer for '
                  + 'them if they tried, and they knew that while they were saying it.'
        };
    }

    if (available === 'they_can_act' && standing.theSuitorsBacking === 'none') {
        // The mirror. A family who can act, against somebody nobody answers
        // for. Two roads and both of them cost.
        return {
            is: 'elope, or give up',
            theirReach,
            line: 'They can act and there is nobody who would have to be dealt with first. What '
                + 'is left is going anyway and being pursued, or wanting it and not having it - '
                + 'and being told exactly why is the ordinary result of being outmatched here.'
        };
    }

    return {
        is: 'a negotiation',
        theirReach,
        line: 'Their answer is real, because something follows from it. What each side wants is '
            + 'what this is about.'
    };
}

// AND WHETHER THE PERSON GOES ALONG WITH IT

/**
 * What this person has of their own, as the two things the world already keeps.
 * NOT A PERSONALITY MODEL AND MUST NOT BECOME ONE: both fields are counted off
 * rows that exist for other reasons - goal rows and relationship standings - so
 * a reader of the person's own entry could have predicted the answer. A
 * `compliance` number here would be invisible to that reader.
 */
export interface WhatThePersonHasOfTheirOwn {
    /** Open wants this match would serve. Counted off their goal rows. */
    wantsItServes: number;
    /** Open wants this match would foreclose. Same rows, other direction. */
    wantsItForecloses: number;
    /**
     * How strongly they already stand toward somebody who is not the match.
     */
    standingTowardSomebodyElse: number;
}

export type WhetherTheyGoAlong =
    | 'goes along with it'
    | 'will not have it';

export interface ThePersonsOwnAnswer {
    answer: WhetherTheyGoAlong;
    /**
     * Why, in terms a reader of this person's entry would recognise.
     *
     * The point of deriving rather than storing: the sentence names the want
     * or the tie, and both of those are things somebody could have looked up.
     */
    because: string;
}

/**
 * Whether somebody accepts a match their house agreed to.
 */
export function whetherTheyGoAlongWithIt(
    theirs: WhatThePersonHasOfTheirOwn
): ThePersonsOwnAnswer {
    if (theirs.standingTowardSomebodyElse >= DEFINING_STANDING) {
        return {
            answer: 'will not have it',
            because: 'They already stand toward somebody at the height this world calls '
                + 'defining, and an arrangement does not reach past that. Anybody who had asked '
                + 'about them would have been told.'
        };
    }
    if (theirs.wantsItForecloses > 0) {
        return {
            answer: 'will not have it',
            because: `It closes ${theirs.wantsItForecloses === 1 ? 'the thing' : 'things'} they `
                + 'are actually after, and they have been after it long enough for it to be on '
                + 'their own account of themselves.'
        };
    }
    if (theirs.wantsItServes > 0) {
        return {
            answer: 'goes along with it',
            because: 'It gets them something they were already trying to get, which is a better '
                + 'reason than obedience and a more reliable one.'
        };
    }
    return {
        answer: 'goes along with it',
        because: 'Nothing of theirs is in the way. That is not enthusiasm and it is not '
            + 'obedience - there is simply nothing they are giving up by it.'
    };
}
