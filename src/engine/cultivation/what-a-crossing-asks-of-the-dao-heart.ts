/**
 * 道心 - what a crossing asks about the life that arrived at it.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import { WHAT_A_RECORD_COUNTS_FOR } from '../social-leverage/personal-alignment.js';

// THE SCALE

/**
 * The weight at which a life reads as nothing but loose ends.
 */
export const A_LIFE_THAT_IS_ALL_LOOSE_ENDS = 4;

/**
 * The most an unsettled record may cost a crossing.
 */
export const MAX_DAO_HEART_STRAIN = 0.12;

// THE OATH TO TEACH

/**
 * How long a master may go without giving a disciple their attention before the
 * oath to teach reads as neglected.
 *
 * The design owner: *"the oath to teach counts as a debt. It affects the
 * master's breakthroughs and his dao heart."* A master who honours it pays
 * nothing; one who neglects it pays. Neglect is read off time, because refusing
 * and simply never getting round to it leave the same thing behind: no
 * attention given.
 *
 * THREE TURNS OF THE WORLD'S OWN ATTENTION PASS. `giveThisYearsAttention` sets a
 * master in front of their disciples once a year where they are free and in the
 * same place, and calls attention recent for `ATTENTION_IS_RECENT_FOR_DAYS`
 * (365). A year missed is a busy year: a copy on the desk, an errand. Three
 * running is a master who is not teaching. The figure is `3 x 365` rather than
 * an import so this file stays below the world; a test holds the two equal.
 */
export const THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS = 3 * 365;

/**
 * Whether a master is keeping their oath to teach one disciple, as of a day.
 *
 * Kept while the last attention given, or the day the oath was sworn where none
 * has been, is within {@link THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS}.
 */
export function whetherTheOathToTeachIsKept(input: {
    onDay: number;
    swornOnDay: number;
    lastAttentionOnDay?: number | null;
}): boolean {
    const last = Math.max(input.swornOnDay, input.lastAttentionOnDay ?? -Infinity);
    return input.onDay - last <= THE_OATH_TO_TEACH_IS_NEGLECTED_AFTER_DAYS;
}

/** What one neglected oath to teach weighs: the oath's own severity when it is sworn. */
const A_NEGLECTED_OATH_TO_TEACH_WEIGHS: Severity = 'serious';

/**
 * What a master's neglected disciples ask of a crossing, read off the ties.
 *
 * For somebody the world holds, whose bond is a pair of ties rather than a pair
 * of ledger rows: a `disciple` tie on the master's side, with the day it was
 * made and the last day attention passed along it. The same rule and the same
 * scale as the ledger read below, so a master in the world and a master at the
 * player's table pay the same for the same neglect.
 */
export function whatNeglectedDisciplesAskOfTheDaoHeart(input: {
    ties: readonly { kind: string; sinceDay: number; lastAttentionOnDay?: number | null }[];
    onDay: number;
}): WhatTheCrossingAsks {
    let open = 0;
    for (const tie of input.ties) {
        if (tie.kind !== 'disciple') continue;
        if (whetherTheOathToTeachIsKept({
            onDay: input.onDay, swornOnDay: tie.sinceDay, lastAttentionOnDay: tie.lastAttentionOnDay
        })) continue;
        open++;
    }
    const weight = Math.round(open * WHAT_A_RECORD_COUNTS_FOR[A_NEGLECTED_OATH_TO_TEACH_WEIGHS] * 100) / 100;
    const heaviest = open > 0 ? A_NEGLECTED_OATH_TO_TEACH_WEIGHS : null;
    return {
        open,
        weight,
        heaviest,
        share: Math.min(1, weight / A_LIFE_THAT_IS_ALL_LOOSE_ENDS),
        line: lineFor(open, weight, heaviest)
    };
}

// THE READ

export interface WhatTheCrossingAsks {
    /** Distinct unfinished things, after kin copies are collapsed onto the deed. */
    open: number;
    /** Their total on the ledger's own scale, with the direction thrown away. */
    weight: number;
    /** The heaviest one standing, or null where the ledger holds nothing. */
    heaviest: Severity | null;
    /**
     * What the crossing is handed, 0..1.
     */
    share: number;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the ledger says is unfinished about this person, as of a day.
 */
export function whatACrossingAsksOfTheDaoHeart(input: {
    personId: string;
    ledger: readonly ObligationRecord[];
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhatTheCrossingAsks {
    // Collapsed onto the DEED rather than the record, on
    // `personal-alignment.ts`'s rule and for its stated reason: a wrong done to
    // a man with nine brothers is not nine times the wrong done to an orphan,
    // and `inheritOnDeath` writes a copy per heir. Heaviest copy stands.
    const unfinished = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;
        // A PARTY TO IT, either way round. The direction is read here and
        // nowhere else, and it is read only to decide whether this row is about
        // them at all - never to decide which of the two it is.
        if (record.holderId !== input.personId && record.subjectId !== input.personId) continue;

        // THE OATH TO TEACH IS THE MASTER'S, AND ONLY WHEN IT IS NEGLECTED. Not
        // direction-blind, on the design owner's ruling that it weighs on the
        // master: the disciple it is sworn about carries nothing for it, and a
        // master keeping it carries nothing either. With no day to read against
        // nothing can be shown to be neglected, so it weighs nothing.
        if (record.kind === 'oath' && record.cause === 'teaching_term') {
            if (record.holderId !== input.personId || input.asOfDay === undefined) continue;
            if (whetherTheOathToTeachIsKept({ onDay: input.asOfDay, swornOnDay: record.incurredOnDay })) continue;
        }

        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const standing = unfinished.get(key);
        if (standing === undefined
            || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]) {
            unfinished.set(key, record.severity);
        }
    }

    let weight = 0;
    let heaviest: Severity | null = null;
    for (const severity of unfinished.values()) {
        weight += WHAT_A_RECORD_COUNTS_FOR[severity];
        if (heaviest === null
            || WHAT_A_RECORD_COUNTS_FOR[severity] > WHAT_A_RECORD_COUNTS_FOR[heaviest]) {
            heaviest = severity;
        }
    }
    // Two places, so two callers comparing readings compare the same arithmetic
    // and not a float tail. Same rounding `personal-alignment.ts` uses.
    weight = Math.round(weight * 100) / 100;

    const share = Math.min(1, weight / A_LIFE_THAT_IS_ALL_LOOSE_ENDS);
    const open = unfinished.size;

    return { open, weight, heaviest, share, line: lineFor(open, weight, heaviest) };
}

function lineFor(open: number, weight: number, heaviest: Severity | null): string {
    if (open === 0) {
        return 'Nothing on the record is unfinished. A wall asks and there is nothing to answer.';
    }
    return `${open} unfinished ${open === 1 ? 'account' : 'accounts'} (${weight.toFixed(2)} of `
        + `${A_LIFE_THAT_IS_ALL_LOOSE_ENDS}), the heaviest ${heaviest}. Direction is not read: `
        + 'a thing owed and a thing owing weigh the same, and settling one is settling it '
        + 'whichever way it was settled.';
}
