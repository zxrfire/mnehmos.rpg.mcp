/**
 * Who answers for a beast that was killed, and only where somebody found out.
 */

import {
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    type Beast
} from '../../data/cultivation/beasts.js';
import { REACHABLE_FROM, canPointAt, type KnowingStage } from '../social/discovery.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationCause } from '../social/grudges.js';
import {
    whatADeedLeaves,
    type Deed,
    type Party,
    type Reach,
    type WhatADeedLeaves,
    type WhoPaid
} from '../social-leverage/what-a-deed-leaves.js';

// ─────────────────────────────────────────────────────────────────────────
// WHETHER THERE IS ANYTHING TO ANSWER FOR
// ─────────────────────────────────────────────────────────────────────────

export type Answerability =
    /**
     * Below `BEAST_CORE_ORDINAL`. A hunt returned an amount, not an animal.
     * Nobody was relying on that one because there was no that one.
     */
    | 'not_an_individual'
    /**
     * At or above `BEAST_CHANGE_ORDINAL`. This is not a hunt and this module
     * has no business pricing it - see
     * {@link WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE}.
     */
    | 'a_person_was_killed'
    /** A tracked animal, and nobody was standing behind it. It was nobody's. */
    | 'nobody_stood_behind_it'
    /** A tracked animal somebody was standing behind. There is a transfer. */
    | 'answerable';

/**
 * Whether the world has anybody to answer to about this killing.
 */
export function answerabilityOf(beast: Beast, standing: Party | null): Answerability {
    if (beast.ordinal >= BEAST_CHANGE_ORDINAL) return 'a_person_was_killed';
    if (beast.ordinal < BEAST_CORE_ORDINAL) return 'not_an_individual';
    return standing === null ? 'nobody_stood_behind_it' : 'answerable';
}

/** True where the hunt returned an amount rather than a particular animal. */
export function isAnAmountRatherThanAnAnimal(beast: Beast): boolean {
    return beast.ordinal < BEAST_CORE_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO CAN PUT A NAME TO IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What each rung of the ladder of knowing amounts to, about a killing.
 */
export const WHAT_A_STAGE_MEANS_ABOUT_A_KILLING: Readonly<Record<KnowingStage, string>> =
    Object.freeze({
        unaware: 'As far as they are concerned it did not happen.',
        whisper: 'A word going round about something out on that ground, and nothing they could act on.',
        named: 'They know the thing is dead. Nobody has a name for whose doing it was, so no account opens and nobody repeats it with a name on it.',
        placed: 'They can say who. This is the rung at which it starts costing you.',
        encountered: 'They were on the ground while it happened.',
        known: 'They watched you do it.'
    });

/**
 * Everybody who can put a name to the killing.
 */
export function whoCanPointAtYou(
    stages: ReadonlyMap<string, KnowingStage>
): readonly string[] {
    const named: string[] = [];
    for (const [id, stage] of stages) {
        if (canPointAt(stage)) named.push(id);
    }
    return named;
}

/** The rung at which a killing acquires a name and can open an account. */
export const A_KILLING_ACQUIRES_A_NAME_AT: KnowingStage = REACHABLE_FROM;

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY LOST, WHICH IS THE DIRECTION AND NOT THE SIZE
// ─────────────────────────────────────────────────────────────────────────

export type WhatTheyLost =
    /** Righteous. It was doing something for them, and now nothing is. */
    | 'the thing and what it was doing'
    /** Neutral. It was theirs and now they have not got it. */
    | 'the thing itself'
    /** Demonic. It had been taking from them and now cannot. */
    | 'nothing, and they are better off';

export function whatTheyLost(beast: Beast): WhatTheyLost {
    switch (beast.disposition) {
        case 'righteous': return 'the thing and what it was doing';
        case 'demonic': return 'nothing, and they are better off';
        default: return 'the thing itself';
    }
}

/**
 * Which side of the transfer paid, which is the entire direction of the model.
 */
export function whoPaidFor(beast: Beast): WhoPaid {
    return beast.disposition === 'demonic' ? 'actor' : 'subject';
}

/**
 * The share of what they had, for a caller with nothing better.
 */
export function shareOfWhatTheyHad(input: {
    beast: Beast;
    /** How many of it they actually had. Defaults to what stands together. */
    howManyTheyHad?: number;
}): number {
    const held = Math.max(1, Math.floor(input.howManyTheyHad ?? input.beast.groupSize));
    return 1 / held;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TRANSFER
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ledger's word for it, in each direction.
 */
const CAUSE_FOR: Readonly<Record<WhoPaid, ObligationCause>> = Object.freeze({
    subject: 'harvested',
    actor: 'saved_life'
});

export interface AKillToAnswerFor {
    beast: Beast;
    /**
     * Whoever was standing behind it, or null where it was nobody's.
     */
    standing: Party | null;
    killer: Party;
    /**
     * Where each party stands on the ladder of knowing about THIS KILLING.
     *
     * Supplied, never derived. Anybody absent is `unaware` and cannot open
     * anything, which is the ordinary case.
     */
    stages: ReadonlyMap<string, KnowingStage>;
    onDay: DayIndex;
    /** Plain words for the ledger. Written by the caller; never parsed. */
    description: string;
    /** How many people were on the ground. A tag and a shame term, not a weight. */
    witnesses?: number;
    /** How far the aggrieved side can get at the killer. Unbacked by default. */
    reach?: Reach;
    /** What it cost them, against what they had. See {@link shareOfWhatTheyHad}. */
    cost?: number;
    /** Overrides the ledger's word for it, where the caller has a better one. */
    cause?: ObligationCause;
}

export interface WhatTheKillLeft {
    answerability: Answerability;
    whatTheyLost: WhatTheyLost | null;
    /** The transfer in the ordinary shape, or null where there was none. */
    deed: Deed | null;
    /** Everything it leaves, from the one scoring function. Null with no deed. */
    leaves: WhatADeedLeaves | null;
    /** Everybody who can put a name to it. Derived from the stages, never given. */
    knownTo: readonly string[];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What a killing leaves behind, priced by the machinery that prices everything
 * else.
 */
export function whatTheKillLeft(input: AKillToAnswerFor): WhatTheKillLeft {
    const { beast, standing, killer } = input;
    const answerability = answerabilityOf(beast, standing);
    const knownTo = whoCanPointAtYou(input.stages);

    if (answerability !== 'answerable' || standing === null) {
        return {
            answerability,
            whatTheyLost: null,
            deed: null,
            leaves: null,
            knownTo,
            line: LINE_FOR[answerability]
        };
    }

    const paidBy = whoPaidFor(beast);
    const deed: Deed = {
        cause: input.cause ?? CAUSE_FOR[paidBy],
        paidBy,
        cost: input.cost ?? shareOfWhatTheyHad({ beast }),
        // Below the change the body is the whole of them: no nascent soul
        // leaves, no seam regrows, nothing comes back. `THE_BEAST_ROAD.death`
        // says so, and it is the one field on a deed this file can answer with
        // certainty rather than by asking the caller.
        irreversible: true,
        onDay: input.onDay,
        description: input.description,
        knownTo,
        ...(input.witnesses === undefined ? {} : { witnesses: input.witnesses }),
        tags: [
            'beast_kill',
            `disposition:${beast.disposition}`,
            `beast:${beast.id}`,
            `rung:${beast.ordinal}`
        ]
    };

    const leaves = whatADeedLeaves({
        deed,
        // A kindness is held by whoever paid for it. The killer went out and
        // did the dangerous thing, so on the demonic side the killer is the
        // actor holding a favour, and on the other two the standing party is
        // the subject holding a record. One expression, both directions.
        actor: killer,
        subject: standing,
        ...(input.reach ? { reach: input.reach } : {})
    });

    return {
        answerability,
        whatTheyLost: whatTheyLost(beast),
        deed,
        leaves,
        knownTo,
        line: knownTo.length === 0
            ? 'Nobody can put a name to it. The thing is dead, whoever was standing behind '
              + 'it may well know that, and there is no account open because there is nobody '
              + 'for it to be against.'
            : `${knownTo.length} ${knownTo.length === 1 ? 'party can' : 'parties can'} say `
              + `whose doing it was. ${leaves.note}`
    };
}

const LINE_FOR: Readonly<Record<Answerability, string>> = Object.freeze({
    not_an_individual:
        'It was an amount rather than an animal. Nobody was relying on that one, because '
        + 'there was no that one, and nothing about it is a thing anybody holds against you.',
    nobody_stood_behind_it:
        'It was nobody\'s. It stood on ground nobody holds and lived off nothing anybody '
        + 'was counting, so there is no party and no account - which is most of the hunting '
        + 'trade and the reason it is a trade.',
    a_person_was_killed:
        'It was past the change. This was not a hunt and it is not priced here - what was '
        + 'killed was a person, and it goes where a person\'s killing goes.',
    answerable: ''
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE LINE AT THE TOP, WHICH IS NOT THIS FILE'S TO PRICE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why {@link answerabilityOf} stops at `BEAST_CHANGE_ORDINAL` and hands the
 * question on, and what is missing behind that hand-off.
 */
export const WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE = {
    theRule:
        `At and above ordinal ${BEAST_CHANGE_ORDINAL} it is not hunting. It is killing a `
        + 'person, and the world should treat it exactly as it treats killing any other '
        + 'person at that rung. Nothing about it should be written twice.',
    whatIsMissing:
        'A changed beast has no row among the people. The catalog carries three that speak '
        + 'and the world seeds none of them, so a killing finds no house, no kin and no '
        + 'roster to open an account with. The ordinary path would work; there is nobody '
        + 'standing in it.',
    doNotPatchItHere:
        'A consequence table for changed beasts would make the design mean its opposite. '
        + 'What is wanted is the roster row, after which this file has nothing to say about '
        + 'them and correctly says nothing.'
} as const;
