/**
 * What a match writes when it is agreed, and what it costs to walk out of one.
 *
 * `social-leverage/what-would-settle-an-account-this-heavy.ts` carries
 * `settleItWithABinding` and `whatWalkingOutOfItCosts`, both complete and
 * neither with a caller anywhere in `src/`. It was written expecting a producer
 * of ordinary matches; this file is it.
 *
 * Nothing stops anybody. `AGENTS.md`: *agency - do not ban it, and do not soften
 * it*. The engine says what it cost.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord } from '../social/grudges.js';
import { createOath } from '../social/grudges.js';
import type { Relationship } from '../social/relationships.js';
import { createRelationship } from '../social/relationships.js';
import { SPOUSE_STANDING } from '../world/the-ties-an-ordinary-life-produces.js';
import {
    whatWalkingOutOfItCosts,
    type WalkingOut
} from '../social-leverage/what-would-settle-an-account-this-heavy.js';
import { doorsOf } from '../birth/spending-a-word-to-place-a-child.js';
import type { APartyToAMatch } from './what-a-house-would-take-for-a-match.js';

// WHAT IT WRITES

/**
 * Whose roll the match moves somebody onto, and it may move nobody.
 */
export interface WhoseRollItChanges {
    personId: string;
    houseId: string;
    onTheRoll: 'by blood';
}

export interface WhatAMatchChanges {
    /**
     * Two rows, one each way, at the strength the world already uses.
     */
    ties: readonly [Relationship, Relationship];
    /**
     * The word given, as an `oath` the ledger already has the cause for.
     */
    binding: ObligationRecord | null;
    /** Every roll entry the match produces. Empty where neither side is a line. */
    rolls: readonly WhoseRollItChanges[];
    /**
     * The two houses, for the standing register. A fact, not a score.
     */
    betweenTheHouses: readonly [string, string] | null;
    note: string;
}

/**
 * Write what a match changes.
 */
export function whatAMatchChanges(input: {
    one: APartyToAMatch;
    other: APartyToAMatch;
    onDay: DayIndex;
    /**
     * The party the word is held against, and the house holding them to it.
     */
    bound?: { personId: string; toHouseId: string; terms: string } | null;
    /** What was actually said, for the ledger. Narrator prose, never parsed. */
    note?: string;
}): WhatAMatchChanges {
    const { one, other, onDay } = input;
    const bound = input.bound ?? null;

    const history = input.note
        ?? 'A match agreed between two parties, and written down by whoever had standing to '
           + 'write it down.';

    const ties: [Relationship, Relationship] = [
        spouseTie(one.personId, other.personId, onDay, history),
        spouseTie(other.personId, one.personId, onDay, history)
    ];

    const binding = bound === null ? null : createOath({
        holderId: bound.personId,
        subjectId: bound.toHouseId,
        cause: 'marriage_pact',
        // A word given is serious. It is not grave and it is not slight, and
        // where a match is closing an account `settleItWithABinding` sets the
        // weight from the account instead - which is that function's rule and
        // is not restated here.
        severity: 'serious',
        onDay,
        description:
            `${bound.personId} is bound to ${one.personId === bound.personId ? other.personId : one.personId}`
            + ' by an arrangement between houses.',
        terms: bound.terms,
        dueOnDay: null,
        participants: [one.personId, other.personId, bound.toHouseId],
        tags: ['binding', 'match']
    });

    const rolls: WhoseRollItChanges[] = [];
    // A lineage roster is entered by blood. Each side that is a line takes the
    // other onto it; a line does not absorb a line.
    if (one.onTheRoll === 'by blood' && one.houseId !== null) {
        rolls.push({ personId: other.personId, houseId: one.houseId, onTheRoll: 'by blood' });
    }
    if (other.onTheRoll === 'by blood' && other.houseId !== null) {
        rolls.push({ personId: one.personId, houseId: other.houseId, onTheRoll: 'by blood' });
    }

    const betweenTheHouses: [string, string] | null =
        one.houseId !== null && other.houseId !== null && one.houseId !== other.houseId
            ? [one.houseId, other.houseId]
            : null;

    return {
        ties,
        binding,
        rolls,
        betweenTheHouses,
        note:
            `A match stands between ${one.personId} and ${other.personId}. `
            + (rolls.length === 0
                ? 'Neither roll moves; neither house keeps a line.'
                : `${rolls.length === 2 ? 'Both' : 'One'} of them is now on a roll they were not `
                  + 'on, by blood, at no rank in it.')
            + (binding === null
                ? ' No word was given to anybody, so there is nothing here to break.'
                : ' A word was given, and it is held by a house rather than by a person.')
    };
}

function spouseTie(
    fromId: string,
    toId: string,
    onDay: DayIndex,
    history: string
): Relationship {
    return createRelationship({
        fromId,
        toId,
        type: 'spouse',
        onDay,
        label: 'Their household.',
        // The world's own constant for this tie. A match does not produce a
        // stronger spouse than a household does, and if it did there would be
        // two kinds of marriage in the world.
        strength: SPOUSE_STANDING,
        significance: 'defining',
        history
    });
}

// AND WHAT LEAVING COSTS

/** What comes off a roll when somebody walks away from the house holding it. */
export interface WhatComesOffTheRoll {
    houseId: string;
    /**
     * The bar they now stand outside of, from `doorsOf` - the house's own
     * lowest door, unmodified. Null for a house the catalog has no doors for.
     */
    theLowestDoorNowInFrontOfThem: number | null;
    whatWasLost: string;
}

export interface WhatLeavingCosts {
    /**
     * The ledger half, from the module that owns it. Unmodified.
     */
    onTheLedger: WalkingOut | null;
    /** Every roll they come off. Empty for somebody who was on none. */
    offTheRolls: readonly WhatComesOffTheRoll[];
    note: string;
}

/**
 * What it costs to leave a match, whoever is leaving and whyever they are.
 */
export function whatLeavingAMatchCosts(input: {
    /** The oath being broken, or null where none was given. */
    binding: ObligationRecord | null;
    /**
     * The account the match was closing, where it was closing one.
     *
     * Omit for a match that settled nothing, which
     * `whatWalkingOutOfItCosts` names as the common case.
     */
    closed?: ObligationRecord | null;
    leaverId: string;
    leaverName: string;
    /** Every house whose roll carried them by blood through this match. */
    rollsTheyWereOn: readonly string[];
    onDay: DayIndex;
}): WhatLeavingCosts {
    // A binding with no beneficiary is a corrupt row rather than a nameless
    // account - a word is always given TO somebody - so it is treated as no
    // binding at all. `subject_id` became nullable for grudges, where not
    // knowing who did it is a real state; there is no such state for an oath.
    const bound = input.binding !== null && input.binding.subjectId !== null
        ? (input.binding as typeof input.binding & { subjectId: string })
        : null;
    const onTheLedger = bound === null ? null : whatWalkingOutOfItCosts({
        binding: bound,
        closed: input.closed ?? null,
        leaverId: input.leaverId,
        leaverName: input.leaverName,
        onDay: input.onDay
    });

    const offTheRolls = input.rollsTheyWereOn.map<WhatComesOffTheRoll>(houseId => {
        const doors = doorsOf(houseId);
        return {
            houseId,
            theLowestDoorNowInFrontOfThem: doors?.lowestDoor ?? null,
            whatWasLost:
                'The roll, and everything the roll was. They were on it by blood and are not on '
                + 'it now, which means the name, whatever the house was standing between them '
                + 'and, and the door they were already inside. '
                + (doors === undefined
                    ? 'What it would take to be on it again is not something the catalog can say.'
                    : `Standing outside it, the lowest door is rung ${doors.lowestDoor}, and the `
                      + 'only instrument that moves a bar is a word from somebody high enough.')
        };
    });

    return {
        onTheLedger,
        offTheRolls,
        note: onTheLedger === null
            ? 'Nobody had been given a word, so nothing is owed and nothing has reopened. What it '
              + 'cost is the roll and whatever the roll was worth.'
            : onTheLedger.note
    };
}
