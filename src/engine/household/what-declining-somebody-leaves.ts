/**
 * What saying no to somebody leaves behind.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A REFUSAL IS A DEED, AND THERE IS ALREADY ONE MODEL OF WHAT A DEED LEAVES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `social-leverage/what-a-deed-leaves.ts` prices any deed at all, in either
 * direction, off what it cost the person who paid AGAINST WHAT THEY HAD, and
 * its own charter is that *"nothing in it branches on what the deed was"*. So
 * there is no refusal severity table here, no scale of humiliation, and no
 * branch on marriage anywhere: a refused proposal arrives at that module as a
 * cost and a `promised` flag, exactly like everything else, and comes back as
 * a record the ledger already knows how to carry, inherit and settle.
 *
 * The `promised` step is the one that matters and it was already there: *"a
 * word given first is worth a step in both directions"*. Being told yes and
 * then refused is a different injury from being refused, and the model has
 * said so since before anybody thought about marriage.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ONE IMPLEMENTATION, BOTH DIRECTIONS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The player declining a suitor and a house declining the player are the same
 * call with the two parties swapped. There is no player branch, no NPC branch,
 * and nothing anywhere reads which of the two is being played - which is the
 * symmetry rule the rest of the repo runs on, applied to the one move where it
 * would have been easiest to write two.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * MOST REFUSALS OPEN NOTHING, AND THE GATE IS CATEGORICAL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A refusal that always opens an account is a trap - it makes "no" a move
 * nobody can afford, and then a proposal is a purchase from the other side.
 * People and houses refuse constantly and must be able to without accumulating
 * enemies for it, or the world fills up with records that mean nothing.
 *
 * WHAT DECIDES IT IS NOT A THRESHOLD ON WHAT WAS STAKED. It is whether there
 * was anything between the two of them when the no was said, which is
 * {@link TheRoute} and is a value rather than a number:
 *
 *   family first   the answer came before there was anything. Declining a
 *                  proposal is declining a proposal, and it costs nobody.
 *   person first   the two of them had already agreed. A no here takes away a
 *                  thing that existed, and that is a different act.
 *
 * What was staked decides how HEAVY, never whether. That is the deed model's
 * own arithmetic and this file supplies the fraction rather than a rule.
 *
 * Pure. Rows in, rows out.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT WAS STAKED
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the side that asked had riding on the answer.
 *
 * Every field is something the negotiation already produced. Nothing here is
 * measured for this purpose and nothing is authored: `theBestOnTheTable` and
 * `theyReachTo` come straight off `whatItWouldTake`'s answer and the asking
 * party's own rung.
 */
export interface WhatTheAskingSideStaked {
    /** How high the best singular thing they put down carries somebody. */
    theBestOnTheTable: number;
    /**
     * Their own rung, which is what the offer is weighed against.
     *
     * `what-a-deed-leaves.ts`'s central rule: a hundred stones off a beggar
     * and a hundred stones off a house treasury are not the same deed. An
     * offer that reaches as high as the person making it is most of what they
     * had; the same offer from somebody three realms above is nothing.
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
 *
 * The whole of the gate, in one line, reading the route and nothing else.
 * Exported so a caller can say "nothing came of it" honestly rather than
 * inferring it from an empty list, and so the rule is testable on its own.
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

// ─────────────────────────────────────────────────────────────────────────
// THE REFUSAL
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * `declining` is whoever refused and `asking` is whoever was refused, and that
 * is the only thing the two arguments mean. Either may be the played
 * character.
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
     *
     * The field that makes a private no different from a public one, and it is
     * `what-a-deed-leaves.ts`'s own: a principal not on the list opens no
     * account, because a grudge is held against somebody and they have no name
     * to put on it.
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
