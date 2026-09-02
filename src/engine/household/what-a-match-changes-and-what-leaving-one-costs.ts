/**
 * What a match writes when it is agreed, and what it costs to walk out of one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE WALKING-OUT HALF WAS ALREADY WRITTEN AND HAD NO CALLER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `social-leverage/what-would-settle-an-account-this-heavy.ts` carries
 * `settleItWithABinding` and `whatWalkingOutOfItCosts`, both complete, both
 * argued out in detail, and **neither has a caller anywhere in `src/`**. Its
 * `WalkingOut.reopened` field is explicit that `null` - an arrangement that
 * settled nothing - *"is the common case and is not a degenerate one"*, and
 * that most people who leave one *"simply do not want it, which is a whole and
 * sufficient reason"*. So the module was written expecting a producer of
 * ordinary matches. There has never been one. This file is it.
 *
 * That module also owns the `oath` with cause `marriage_pact`, which
 * `grudges.ts` has had in its vocabulary since it was written and which
 * nothing has ever produced. Nothing new is added to either.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT A MATCH ACTUALLY CHANGES, AND IT IS FOUR THINGS THAT ALREADY EXIST
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   THE TIE       Two `spouse` relationships, both directions, at
 *                 `SPOUSE_STANDING` - the constant
 *                 `world/the-ties-an-ordinary-life-produces.ts` already uses
 *                 for the only source of `spouse` in the world. A match is a
 *                 second source of the same tie at the same strength, not a
 *                 stronger one.
 *
 *   THE WORD      An `oath`, cause `marriage_pact`, held by the person bound
 *                 about the house that holds them to it. Same direction as
 *                 `settleItWithABinding`, so one walk-out function reads both.
 *
 *   THE ROLL      A lineage roster is entered `by blood`, which is already how
 *                 a child becomes a member from birth (`birth.ts`). A match is
 *                 the other way somebody comes to be of a line, and it does
 *                 not confer a rung: `RaisedInside` is emphatic that being on
 *                 a roll is not being on a rung, and this changes neither.
 *
 *   THE STANDING  A fact between two houses, emitted for the register to hold.
 *                 Nothing here computes what two houses think of each other.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND WHAT LEAVING COSTS, WHICH IS WHAT MAKES THE REST MEAN ANYTHING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nothing stops anybody. `AGENTS.md`: *agency - do not ban it, and do not
 * soften it*. The engine says what it cost.
 *
 * The ledger half is `whatWalkingOutOfItCosts`, called and not reimplemented:
 * the account the arrangement was closing reopens at its original weight and
 * its original date, and a second record opens with `broken_oath` and the
 * leaver's own name on it. What this file adds is the part that is about a
 * roll rather than a record, and it is not a new rule either - it is the
 * ordinary consequence of coming off a roster, read through `doorsOf`, which
 * `spending-a-word-to-place-a-child.ts` already uses to say what a house's
 * doors are. Somebody who ran stands outside the bar they were standing
 * inside, and the only instrument that moves a bar is a word from somebody
 * high enough - which is why a runaway's road and a rogue's road are the same
 * road.
 *
 * Pure. Rows in, rows out. Nothing is persisted here.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT WRITES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whose roll the match moves somebody onto, and it may move nobody.
 *
 * A lineage roster is entered by blood, so a match into one puts somebody on
 * it. Two lineages, and each side keeps its own - the marriage is between the
 * houses and neither roster absorbs the other. Neither, and nothing moves.
 */
export interface WhoseRollItChanges {
    personId: string;
    houseId: string;
    onTheRoll: 'by blood';
}

export interface WhatAMatchChanges {
    /**
     * Two rows, one each way, at the strength the world already uses.
     *
     * `relationships.ts` is directed, so both halves are written explicitly.
     * They are identical apart from the direction, which is the whole of what
     * "no asymmetry" means here.
     */
    ties: readonly [Relationship, Relationship];
    /**
     * The word given, as an `oath` the ledger already has the cause for.
     *
     * Held by the person bound, about the house holding them to it - which is
     * `settleItWithABinding`'s direction, so `whatWalkingOutOfItCosts` reads
     * this record without knowing which of the two produced it.
     */
    binding: ObligationRecord | null;
    /** Every roll entry the match produces. Empty where neither side is a line. */
    rolls: readonly WhoseRollItChanges[];
    /**
     * The two houses, for the standing register. A fact, not a score.
     *
     * Null when either side answers to nobody, because a match involving a
     * rogue is a match between two people and the register has nothing to
     * hold about it.
     */
    betweenTheHouses: readonly [string, string] | null;
    note: string;
}

/**
 * Write what a match changes.
 *
 * `bound` names which of the two the word is held against, and it is a
 * parameter rather than a rule because both are possible and neither is the
 * default: a match a house extracted binds the person it was extracted from,
 * and a match two people wanted binds nobody. Passing `null` is the second
 * case and is the ordinary one.
 */
export function whatAMatchChanges(input: {
    one: APartyToAMatch;
    other: APartyToAMatch;
    onDay: DayIndex;
    /**
     * The party the word is held against, and the house holding them to it.
     *
     * Null for a match nobody was bound into, which writes no oath at all -
     * and therefore nothing to walk out of, which is correct: two people who
     * chose each other have given no house anything to collect.
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

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT LEAVING COSTS
// ─────────────────────────────────────────────────────────────────────────

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
     *
     * Null when there was no word to break - two people who chose each other
     * and then did not stay, which costs the world nothing to record and is
     * the commonest way one of these ends.
     */
    onTheLedger: WalkingOut | null;
    /** Every roll they come off. Empty for somebody who was on none. */
    offTheRolls: readonly WhatComesOffTheRoll[];
    note: string;
}

/**
 * What it costs to leave a match, whoever is leaving and whyever they are.
 *
 * Three things are true of this function and all three are deliberate:
 *
 *   - **It refuses nothing.** There is no branch on who is leaving, what they
 *     stand at, or whether anybody would approve. The engine's job is to say
 *     what it cost.
 *   - **It is the same code for the player and for anybody else.** A player
 *     matched by their own house and running from it, and an NPC running from
 *     a clan that will not marry out, are the same call.
 *   - **It invents no escalation.** `whatWalkingOutOfItCosts` reopens the old
 *     account at its own weight and its own date, and this adds nothing to it.
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
    const onTheLedger = input.binding === null ? null : whatWalkingOutOfItCosts({
        binding: input.binding,
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
