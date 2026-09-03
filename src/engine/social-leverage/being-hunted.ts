/**
 * Who is actually coming for somebody, and who has only written the name down.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HALF OF THE RULING THIS ANSWERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on being something:
 *
 *   > you'd just be hunted down (or too powerful for them to touch you)
 *
 * Both halves already had machinery and neither had a reader. Feuds and blood
 * feuds are in the ledger and are permanent until settled; houses already take
 * up what is done to their own. What was missing is that **being hunted was a
 * row in a table rather than a state somebody is in and can act against** - the
 * played sheet's `Feuds` line reads off `Cultivator.feuds`, a JSON array of
 * free-text party labels with exactly one writer anywhere in `src/`, on the MCP
 * combat path. In the played game nothing has ever written it, so the sheet
 * says *"No one is currently hunting you"* to a cultivator with a province
 * behind them. That is AGENTS.md's *a field nothing writes* at its most exact:
 * it is not inert, it reads as a value, and the value is a lie with a straight
 * face.
 *
 * The fix is the one that entry itself prescribes - *prefer deriving to storing
 * where the answer moves* - and the answer moves constantly, because whether
 * somebody can come for you changes every time either of you crosses a rung.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ALMOST NOTHING HERE IS NEW
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Two of the three axes in `what-a-house-does-when-it-catches-you.ts` are
 * exactly the two questions "is this person hunting me" needs, and they are
 * imported rather than restated:
 *
 *   CAN THEY BE MADE TO   `canTheyBeMadeToPayForActing`. The strongest elder in
 *   PAY FOR ACTING        the province is not hunting anybody whose house
 *                         theirs would have to answer to. The matter goes over
 *                         your head instead, which is not you getting away with
 *                         it and is also not somebody on the road behind you.
 *   ARE YOU WORTH THE     `whetherYouAreWorthTheTrouble`, off `REGARD_BANDS`.
 *   TROUBLE               `beneath_notice` is contempt rather than mercy, and
 *                         `beyond_them` is the owner's other half in one word.
 *
 * The third axis - what kind of house caught you - is not asked here, on that
 * file's own ruling: alignment decides the KIND of answer and never whether one
 * is coming. A righteous house hunts exactly as hard as a demonic one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LINE FOR SOMEBODY THEY CANNOT REACH
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A refusal names a route, including in reverse. Silence is the wrong answer
 * for a house that would move against somebody and cannot: what they have is a
 * name on a page and nothing behind it, and being told so is information about
 * where you stand - the same information `dismissed` carries at the other end
 * of the ladder. `assessGap` already refuses a fight seven realms up as *a
 * decision the stronger party makes alone*, and this is the social reading of
 * the same gap.
 *
 * The record still stands, which is what a house has against somebody beyond
 * its reach and is not nothing: it is permanent, it is inheritable, and the gap
 * is not.
 *
 * Pure. No state, no rolls, no I/O.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import { WHAT_A_RECORD_COUNTS_FOR } from './personal-alignment.js';
import {
    canTheyBeMadeToPayForActing,
    whetherYouAreWorthTheTrouble,
    type Backing,
    type SomethingToLose,
    type WhatMakesThemWorthIt,
    type WhetherActingIsAvailable,
    type WhetherToBother
} from './what-a-house-does-when-it-catches-you.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TWO SIDES
// ─────────────────────────────────────────────────────────────────────────

/** The person the accounts are about. */
export interface TheQuarry {
    id: string;
    /** Their rung. The only ladder reading in this file. */
    ordinal: number;
    /**
     * What their house is worth to somebody thinking of moving on them.
     *
     * `Backing`'s own three values, and the middle one is why it is not a
     * boolean: somebody nominally on a roll whose house would not put its
     * weight behind them is in the worst position of anybody.
     */
    backing: Backing;
    /** What makes them worth spending something on. Steps the band. */
    worth?: WhatMakesThemWorthIt;
}

/**
 * Somebody holding a record, as far as this question is concerned.
 *
 * A holder may be a HOUSE. Every column in the ledger is an id and nothing
 * requires a person, which is how a house comes to be the one carrying it -
 * and a house has a rung the same way a person does, read off whoever answers
 * for it. The caller supplies both.
 */
export interface AHolder extends SomethingToLose {
    id: string;
    name: string;
    ordinal: number;
}

/** One open account, with the two questions answered about it. */
export interface APursuer {
    holderId: string;
    holderName: string;
    kind: 'grudge' | 'blood_feud';
    severity: Severity;
    sinceDay: DayIndex;
    /** The record's own words. Written once, read forever, never parsed. */
    what: string;
    /** True where nobody alive was ever expected to settle it. */
    carriedRatherThanSettled: boolean;
    acting: WhetherActingIsAvailable;
    bother: WhetherToBother;
}

export interface BeingHunted {
    /** True where at least one holder both may act and thinks it worth doing. */
    hunted: boolean;
    /** The ones who can come, heaviest first. */
    coming: readonly APursuer[];
    /**
     * The ones who cannot, heaviest first.
     *
     * Three different reasons, kept apart on the row rather than collapsed:
     * their own house would pay for it, you are beneath their notice, or you
     * are past anything they could do.
     */
    namesWithNothingBehindThem: readonly APursuer[];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Who is coming, and who is not.
 *
 * `holders` is who each id on the ledger actually is. **Anybody absent from it
 * is left out entirely**, and that is the correct failure rather than a
 * convenient one: a record whose holder the caller cannot place is a record
 * nobody has been shown to be in a position to act on, and inventing a default
 * rung for them would manufacture a pursuer out of a missing lookup.
 */
export function whoIsComingForYou(input: {
    quarry: TheQuarry;
    /** Every record naming them. Settled ones are ignored. */
    ledger: readonly ObligationRecord[];
    holders: ReadonlyMap<string, AHolder>;
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): BeingHunted {
    const coming: APursuer[] = [];
    const nothing: APursuer[] = [];

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (record.kind !== 'grudge' && record.kind !== 'blood_feud') continue;
        if (record.subjectId !== input.quarry.id) continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        const holder = input.holders.get(record.holderId);
        if (!holder) continue;

        const acting = canTheyBeMadeToPayForActing({
            aggrieved: holder,
            backing: input.quarry.backing
        });
        const bother = whetherYouAreWorthTheTrouble({
            theirOrdinal: holder.ordinal,
            yourOrdinal: input.quarry.ordinal,
            ...(input.quarry.worth ? { worth: input.quarry.worth } : {})
        });

        const row: APursuer = {
            holderId: holder.id,
            holderName: holder.name,
            kind: record.kind,
            severity: record.severity,
            sinceDay: record.incurredOnDay,
            what: record.description,
            carriedRatherThanSettled: record.kind === 'blood_feud',
            acting,
            bother
        };

        (acting === 'they_can_act' && bother === 'worth_mounting' ? coming : nothing)
            .push(row);
    }

    coming.sort(heaviestFirst);
    nothing.sort(heaviestFirst);

    return {
        hunted: coming.length > 0,
        coming,
        namesWithNothingBehindThem: nothing,
        line: lineFor(coming, nothing)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// PLUMBING
// ─────────────────────────────────────────────────────────────────────────

function heaviestFirst(a: APursuer, b: APursuer): number {
    const byWeight = WHAT_A_RECORD_COUNTS_FOR[b.severity] - WHAT_A_RECORD_COUNTS_FOR[a.severity];
    if (byWeight !== 0) return byWeight;
    // Oldest first among equals, so a listing is stable and reads as a history.
    if (a.sinceDay !== b.sinceDay) return a.sinceDay - b.sinceDay;
    return a.holderId < b.holderId ? -1 : a.holderId > b.holderId ? 1 : 0;
}

function lineFor(coming: readonly APursuer[], nothing: readonly APursuer[]): string {
    if (coming.length === 0 && nothing.length === 0) {
        return 'Nobody holds anything against them. There is no account open and nobody has '
            + 'their name written down anywhere.';
    }
    if (coming.length === 0) {
        const worst = nothing[0]!;
        const why = worst.bother === 'beyond_them'
            ? `Nothing ${worst.holderName} could do about it would reach them.`
            : worst.bother === 'beneath_notice'
                ? `${worst.holderName} does not think them worth the rice.`
                : `${worst.holderName} would have to answer to somebody for starting it.`;
        return `${nothing.length} ${nothing.length === 1 ? 'account is' : 'accounts are'} open `
            + `against them and none of the holders is in a position to act on one. ${why} `
            + 'They have written the name down and there is nothing behind it, which is not '
            + 'the same as the record going away: it is permanent, it is inherited, and the '
            + 'gap that makes it harmless is not.';
    }
    const worst = coming[0]!;
    return `${coming.length} of ${coming.length + nothing.length} open `
        + `${coming.length + nothing.length === 1 ? 'account' : 'accounts'} against them `
        + `${coming.length === 1 ? 'is' : 'are'} held by somebody who may act and thinks it `
        + `worth doing. The heaviest is ${worst.holderName}'s, ${worst.severity}, from day `
        + `${worst.sinceDay}`
        + (worst.carriedRatherThanSettled
            ? ', and it is written to be carried rather than settled.'
            : '.');
}
