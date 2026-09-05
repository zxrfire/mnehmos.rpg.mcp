/**
 * What saying no to somebody leaves behind.
 *
 * A refusal is a deed and `social-leverage/what-a-deed-leaves.ts` already prices
 * any deed off what it cost against what the payer had, so there is no refusal
 * severity table here and no branch on marriage anywhere.
 *
 * MOST REFUSALS OPEN NOTHING, AND THE GATE IS CATEGORICAL - not a threshold on
 * what was staked. People and houses refuse constantly and must be able to
 * without accumulating enemies, so what decides it is whether there was anything
 * between the two of them when the no was said ({@link TheRoute}). What was
 * staked decides how HEAVY, never whether.
 *
 * The player declining a suitor and a house declining the player are the same
 * call with the parties swapped. No player branch, no NPC branch.
 */

import type { DayIndex } from '../social/common.js';
import {
    whatADeedLeaves,
    type Party,
    type Reach,
    type WhatADeedLeaves
} from '../social-leverage/what-a-deed-leaves.js';
import {
    aRefusalOpensAnAccount,
    type TheRoute
} from './which-route-a-match-took-and-what-a-house-can-make-stick.js';

// WHAT WAS STAKED

/**
 * What the side that asked had riding on the answer. Every field is something
 * the negotiation already produced: nothing here is measured for this purpose
 * and nothing is authored.
 */
export interface WhatTheAskingSideStaked {
    /** How high the best singular thing they put down carries somebody. */
    theBestOnTheTable: number;
/**
 * Their own rung, which is what the offer is weighed against.
 * `what-a-deed-leaves.ts`'s central rule: a hundred stones off a beggar and a
 * hundred off a house treasury are not the same deed.
 */
    theyReachTo: number;
    /**
     * True when they had been told yes and were then refused.
     *
     * Straight onto the deed's `promised`, which is the existing step for a
     * word given first and not kept.
     */
    hadBeenToldYes?: boolean;
}

/**
 * Whether a refusal leaves anything at all.
 */
export function aRefusalLeavesSomething(route: TheRoute): boolean {
    return aRefusalOpensAnAccount(route);
}

/**
 * What was staked, as the fraction `what-a-deed-leaves.ts` prices deeds on.
 *
 * Clamped to 0..1 at both ends. An offer above the asker's own rung is capped
 * at everything they had, because there is nothing above everything.
 */
export function howMuchOfWhatTheyHad(staked: WhatTheAskingSideStaked): number {
    const reach = Math.max(1, staked.theyReachTo);
    return Math.max(0, Math.min(1, staked.theBestOnTheTable / reach));
}

// THE REFUSAL

export interface WhatDecliningLeaves {
    /**
     * The records, from the module that owns them. Null on the ordinary route,
     * which is most refusals and is not a failure.
     */
    left: WhatADeedLeaves | null;
    /** What the asking side staked, as the fraction that was priced. */
    ofWhatTheyHad: number;
    /** Engine-authored and factual. Never narration. */
    note: string;
}

/**
 * Say no, and say what it left.
 */
export function whatDecliningSomebodyLeaves(input: {
    /** The party who said no. */
    declining: Party;
    /** The party who was told no. */
    asking: Party;
    /**
     * THE GATE. Which consent came first, and therefore whether the no is
     * declining a proposal or taking away a thing that already existed.
     */
    route: TheRoute;
    /** How heavy, never whether. */
    staked: WhatTheAskingSideStaked;
    onDay: DayIndex;
    /**
     * How far the refused side can get at the one who refused, in the
     * consequence layer's own vocabulary. Supplied by the caller, as that
     * module requires.
     */
    reach?: Reach;
    /**
     * Who knows it happened. Omit and everybody involved does.
     */
    knownTo?: readonly string[];
    witnesses?: number;
    /** What was actually said. Narrator prose, never parsed. */
    description?: string;
}): WhatDecliningLeaves {
    const ofWhatTheyHad = howMuchOfWhatTheyHad(input.staked);

    if (!aRefusalLeavesSomething(input.route)) {
        return {
            left: null,
            ofWhatTheyHad,
            note:
                'They asked and were told no. There was nothing between the two of them yet, so '
                + 'a proposal was declined rather than anything being taken away, and nobody is '
                + 'owed anything.'
        };
    }

    const description = input.description
        ?? 'The two of them had already agreed it, and it was refused anyway.';

    const left = whatADeedLeaves({
        deed: {
            // DATA, carried onto the record and read by nothing. Both words
            // are the ledger's own: `broken_oath` where a word had been given
            // and was not kept, and `humiliation` where it had not, which is
            // what being sent away in front of people is.
            cause: (input.staked.hadBeenToldYes ?? false) ? 'broken_oath' : 'humiliation',
            // Only ever reached on the `person first` route, where what is
            // refused is a thing that already existed rather than an offer.
            // The asking side paid. They put something down and were sent away
            // with it, and the record is theirs to hold.
            paidBy: 'subject',
            cost: ofWhatTheyHad,
            // Nothing was consumed. An offer refused comes home with them, and
            // pretending otherwise would double-charge a player who tried.
            irreversible: false,
            // The person's yes is what is being overridden, and a word given
            // first is a step in both directions - the deed model's own rule,
            // written long before anybody thought about a match.
            promised: true,
            onDay: input.onDay,
            description,
            knownTo: input.knownTo,
            witnesses: input.witnesses,
            tags: ['match', 'declined']
        },
        actor: input.declining,
        subject: input.asking,
        reach: input.reach
    });

    return {
        left,
        ofWhatTheyHad,
        note: left.note
    };
}
