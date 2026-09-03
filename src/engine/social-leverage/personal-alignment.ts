/**
 * What a person is, read off what they have done rather than off whose roll
 * they are on.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner:
 *
 *   > you should be able to get to 44 using plain english, as a neutral,
 *   > righteous, or demonic/evil cultivator.
 *   >
 *   > also note that these are independent of techniques - you could cultivate
 *   > a righteous sect's technique and be evil, you'd just be hunted down (or
 *   > too powerful for them to touch you)
 *
 * What was true before this file: `SectAlignment` is a field ON A SECT, and a
 * player's alignment was read six times in `web/game.ts` as
 * `mySect?.alignment ?? null`. So a cultivator who had robbed and maimed their
 * way across two provinces read `righteous` if they were on a righteous roll,
 * and read NOTHING AT ALL if they were on none. Neither is a person.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * DERIVED, NEVER STORED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The same argument the shelf-against-roster reading makes about a house, with
 * more force: **where a person sits is a question, not a property.** A stored
 * house trajectory drifts the first time somebody dies; a stored alignment
 * would be stale the moment after it was written, because what somebody IS
 * changes every time they do something. AGENTS.md, on the field nobody wrote:
 * *"a stored value that nothing maintains is a slower version of the same
 * defect"*.
 *
 * So there is no column here and no setter. There is one question asked of the
 * obligation ledger, which is already the world's memory of what people have
 * done to each other, is already permanent until settled, and is already
 * inherited.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE AXIS IS, AND IT IS NOT ONE THIS FILE INVENTED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `data/cultivation/demonic-sects-and-what-they-are-willing-to-do.ts` already
 * answers *what makes a demonic body demonic*, and its answer is two questions
 * asked of every entry:
 *
 *     WHO PAYS, AND DID THEY AGREE.
 *
 * It says in the same breath what the axis is NOT: *"not cruelty, not power,
 * and not how much the province dislikes them"*. `docs/world/houses/asking.md`
 * says the other half - the righteous/demonic axis in this world is about
 * **method and permission**, and is *not about being nice*.
 *
 * That axis is already two fields on a deed, and they are the only two fields
 * `what-a-deed-leaves.ts` reads to decide a direction:
 *
 *     WHO PAID       `Deed.paidBy`. `actor` - they bore the cost themselves,
 *                    for somebody else. `subject` - they took it out of
 *                    somebody else.
 *     DID THEY AGREE the same field, from the other end. A thing taken out of
 *                    a person is a thing that person did not hand over.
 *
 * And the ledger has already recorded that direction, once, in a word: a
 * `favor` is held BY the person who paid, and a `grudge` or a `blood_feud` is
 * held ABOUT the person who took. So this file reads a kind and a severity and
 * nothing else. **It does not read a cause**, on `grudges.ts`'s own standing
 * rule that the cause list is data - *"if you ever find a `switch` on one of
 * these values deciding an outcome, that switch is the bug"* - and it reads no
 * faction, no ordinal, no technique and no realm.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RIGHTEOUS IS NOT THE ABSENCE OF WRONGS, AND THIS FILE INVENTS NO VIRTUE
 * COUNTER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It did not have to. `what-a-deed-leaves.ts` states, as the single most
 * important property it has, that **kindness and harm are the same machinery
 * pointed two ways**: one scoring function, both directions, *"or the good half
 * quietly becomes decoration"*. A favour owed to somebody is a deed they paid
 * for, priced by the identical arithmetic that priced the wrong.
 *
 * So the good side is already counted, already weighted, and already in the
 * ledger. What this file adds is the reading, and the reading is an ORDERING
 * rather than a net:
 *
 *     DEMONIC    decided first, on what they have taken out of other people,
 *                ALONE.
 *     RIGHTEOUS  decided second, on what they have paid out of themselves for
 *                other people, ALONE, and only among those the first question
 *                did not answer.
 *     NEUTRAL    everybody else, INCLUDING somebody who has never done
 *                anything. A person with an empty record is neutral. They are
 *                not righteous, and this is the half the old reading got most
 *                wrong.
 *
 * **Harm does not net off against charity, and that is deliberate.** A person
 * who has murdered and also given generously is demonic and generous, not
 * neutral - which is the same thing this directory already insists on when it
 * says a demonic robe must not imply a tight fist and that *"kind elders exist
 * just as greedy demonic cultivators exist"*. Disposition is a separate axis
 * and lives in `how-freely-somebody-parts-with-what-they-have.ts`, off a
 * person's id and nothing else. Nothing here touches it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT BINDS NPCs BY CONSTRUCTION, BECAUSE IT NEVER MEETS A PLAYER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The input is obligation rows and an id. There is no player type in the
 * signature and no place to put one, exactly the way
 * `how-freely-somebody-parts-with-what-they-have.ts` has no place to put a
 * faction. A world where only the player has a reputation is a world where
 * nobody else has done anything, and the way to make that unreachable is to
 * leave the distinction out of the type rather than to remember not to use it.
 *
 * Pure. No state, no rolls, no I/O, no ladder. Same inputs, same answer.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A RECORD COUNTS FOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * What each band of record is worth towards a reading of somebody.
 *
 * Written out rather than derived from `severityRank`, on
 * `a-deed-enters-the-world-as-a-fact.ts`'s precedent and for its stated reason:
 * `severityRank` says in its own comment that it is for sorting and filtering
 * and never for weighting. These four numbers are a judgement about when a
 * pattern of behaviour stops being events and becomes a method, and a judgement
 * should be readable and arguable in one place.
 *
 * The jump is at `grave`, and it is where it is because that is where the rest
 * of the world already starts carrying the thing: `isHeavy` is true from
 * `grave`, and it is the band at which kin hold a record too and a house
 * becomes a party. Below it the numbers are small enough that a lifetime of
 * petty unpleasantness does not add up to a method - which is the correct
 * answer, because a method is what somebody is willing to do and not what they
 * are like on a bad day.
 */
export const WHAT_A_RECORD_COUNTS_FOR: Readonly<Record<Severity, number>> =
    Object.freeze({
        slight: 0.05,
        serious: 0.25,
        grave: 1,
        unforgivable: 2
    });

/**
 * The point at which a run of deeds stops being events and reads as a method.
 *
 * ONE constant, used for both directions, because there is one scoring function
 * and both directions run through it. A second threshold for the good side
 * would be the exact softening `what-a-deed-leaves.ts` was written to prevent.
 *
 * What it buys, at the numbers above: one `unforgivable`; or two `grave`; or
 * eight `serious`; or forty `slight`. So a single killing done on a given word
 * is a method, two cripplings are a method, and a career of ordinary theft is a
 * method by the time it is a career.
 */
export const WHAT_MAKES_IT_A_METHOD = 2;

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

export interface WhatSomebodyIs {
    /**
     * The word, and it is the SAME word a house wears.
     *
     * Not a parallel vocabulary. A person and a house are being asked the same
     * question about method, so a fourth alignment tomorrow reaches both
     * without this file changing. `SectAlignmentSchema` stays exactly where it
     * is and stays a field on a sect; what is added is a second, different
     * source for the same three words when the subject is a person.
     *
     * Never null. Somebody who has done nothing is `neutral`.
     */
    alignment: SectAlignment;
    /** What they have taken out of other people, on the scale above. */
    taken: number;
    /** What they have paid out of themselves for other people. */
    paid: number;
    /** Distinct wrongs standing open against them. */
    wrongs: number;
    /** Distinct kindnesses standing open in their favour. */
    kindnesses: number;
    /** True where the ledger holds nothing either way about them. */
    nothingEitherWay: boolean;
    /** The heaviest thing standing against them, or null. */
    worst: Severity | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Read the ledger and say what the person in it has made of themselves.
 *
 * ── WHAT IS COUNTED ──────────────────────────────────────────────────────
 *
 *   TAKEN  `grudge` and `blood_feud` rows where they are the SUBJECT. The
 *          ledger's own direction: a wrong is held about the person who did it.
 *   PAID   `favor` rows where they are the HOLDER. Also the ledger's own
 *          direction: *"a favour is owed TO the holder"*, so the holder is the
 *          person who paid for it.
 *
 * Everything else is deliberately silent. A `favor` where they are the SUBJECT
 * is somebody else's virtue and says nothing about them. `debt`, `oath` and
 * `leverage` are positions rather than deeds - a debt is owed, an oath binds, a
 * piece of leverage sits there - and none of them is a transfer somebody made
 * out of anybody. An oath BROKEN is a wrong, and it arrives as one, with a
 * grudge on it, priced by what it cost.
 *
 * ── OPEN RECORDS ONLY, WHICH IS ALSO THE ROAD BACK ───────────────────────
 *
 * `grudges.ts` allows a record to leave the open ledger exactly one way:
 * somebody writes a {@link ObligationRecord.settlement} saying what happened.
 * Reading the open ledger therefore gives redemption for free and gives it the
 * world's own shape - a wrong that was avenged, repaid, compensated, forgiven
 * or proven false has been ANSWERED, and the world has stopped holding it
 * against anybody. Nothing new had to be built to let somebody stop being what
 * they were, and nothing here decays, ages or forgives on its own.
 *
 * A record written `fromBelief` counts. That is `grudges.ts`'s own position on
 * one - *"a feud founded on a lie kills people exactly as thoroughly"* - and
 * the exit for a lie already exists and is `proven_false`, which is a
 * settlement, which takes it out of this reading.
 *
 * ── AND ONE DEED IS COUNTED ONCE ─────────────────────────────────────────
 *
 * `whatADeedLeaves` opens a record for the person it happened to, one for each
 * of their kin at the same weight, and one for their house; `inheritOnDeath`
 * copies each of those again to every heir. Counting rows would therefore price
 * a victim's FAMILY SIZE as the actor's character, and a wrong done to somebody
 * with nine brothers would be four times the wrong done to an orphan. So rows
 * are collapsed onto the deed behind them - the triggering fact where there is
 * one, and the original holder, day and cause where there is not - and the
 * heaviest copy stands.
 */
export function whatTheirRecordMakesThem(input: {
    personId: string;
    /** Everything the ledger holds that names them, in any capacity. */
    ledger: readonly ObligationRecord[];
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhatSomebodyIs {
    const against = new Map<string, Severity>();
    const forThem = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        const took = (record.kind === 'grudge' || record.kind === 'blood_feud')
            && record.subjectId === input.personId;
        const paid = record.kind === 'favor' && record.holderId === input.personId;
        if (!took && !paid) continue;

        // A record and a deed are not the same thing. See the header.
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const into = took ? against : forThem;
        const standing = into.get(key);
        if (standing === undefined || heavier(record.severity, standing)) {
            into.set(key, record.severity);
        }
    }

    const taken = total(against);
    const paidOut = total(forThem);
    const worst = heaviestOf(against);

    // ORDER, NOT ARITHMETIC. Demonic is asked first and asked of `taken`
    // alone, so nothing anybody gives away answers for what they took.
    const alignment: SectAlignment = taken >= WHAT_MAKES_IT_A_METHOD
        ? 'demonic'
        : paidOut >= WHAT_MAKES_IT_A_METHOD
            ? 'righteous'
            : 'neutral';

    return {
        alignment,
        taken,
        paid: paidOut,
        wrongs: against.size,
        kindnesses: forThem.size,
        nothingEitherWay: against.size === 0 && forThem.size === 0,
        worst,
        line: lineFor(alignment, against.size, forThem.size, taken, paidOut, worst)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// PLUMBING
// ─────────────────────────────────────────────────────────────────────────

function total(bands: ReadonlyMap<string, Severity>): number {
    let sum = 0;
    for (const severity of bands.values()) sum += WHAT_A_RECORD_COUNTS_FOR[severity];
    // Two decimal places, so a caller comparing two readings is comparing the
    // same arithmetic and not a float tail.
    return Math.round(sum * 100) / 100;
}

function heavier(a: Severity, b: Severity): boolean {
    return WHAT_A_RECORD_COUNTS_FOR[a] > WHAT_A_RECORD_COUNTS_FOR[b];
}

function heaviestOf(bands: ReadonlyMap<string, Severity>): Severity | null {
    let worst: Severity | null = null;
    for (const severity of bands.values()) {
        if (worst === null || heavier(severity, worst)) worst = severity;
    }
    return worst;
}

function lineFor(
    alignment: SectAlignment,
    wrongs: number,
    kindnesses: number,
    taken: number,
    paid: number,
    worst: Severity | null
): string {
    const ledger =
        `${wrongs} open against them (${taken.toFixed(2)}), `
        + `${kindnesses} in their favour (${paid.toFixed(2)}), `
        + `at ${WHAT_MAKES_IT_A_METHOD} for a method.`;

    if (alignment === 'demonic') {
        return 'What they have taken out of other people is not a run of bad afternoons any '
            + `more, it is how they get things done${worst ? `, and the worst of it is ${worst}` : ''}. `
            + ledger;
    }
    if (alignment === 'righteous') {
        return 'They have paid for other people out of themselves often enough and heavily '
            + 'enough that it is what they do rather than what they once did. '
            + ledger;
    }
    if (wrongs === 0 && kindnesses === 0) {
        return 'The world holds nothing either way about them. That is not innocence and it is '
            + 'not virtue - nobody has anything on them because they have not done anything. '
            + ledger;
    }
    return 'They have done things in both directions and neither is a pattern yet. '
        + ledger;
}
