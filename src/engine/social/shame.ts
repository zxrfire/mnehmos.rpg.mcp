/**
 * Shame: a fact about somebody that other people hold, and that lowers them.
 *
 * The third thing this layer stores about a person, beside what they are owed
 * (`grudges.ts`) and what they are hiding (`secrets.ts`), and it is neither of
 * those:
 *
 *   A GRUDGE   is between two parties. Somebody did something to somebody.
 *   A SECRET   is a fact whose whole value is that it has not got out.
 *   SHAME      is a fact that IS out, or out among the people who matter, and
 *              that costs its subject standing every time it is remembered.
 *
 * It is deliberately not a morality system. Nothing here scores a person,
 * nothing accumulates, nothing decays, and no code anywhere asks this module
 * whether somebody is good. It answers one question - what does this person
 * carry that other people know about - and it answers it in the same register
 * the obligation ledger uses, with the same four rules:
 *
 *   1. NOTHING EXPIRES. A record leaves the carried ledger exactly one way:
 *      something happens and somebody writes down what lifted it.
 *   2. SEVERITY IS A STORED WORD. `Severity` is the ledger's own vocabulary,
 *      imported rather than restated, so that nothing downstream can be
 *      tempted to do arithmetic on it.
 *   3. IT IS HELD BY PEOPLE, NOT BY THE WORLD. `heldBy` is who knows. A shame
 *      two people hold is a different fact from one a province holds, and the
 *      difference is the whole of what concealment buys.
 *   4. NOTHING IS RANKED BY CULTIVATION. This module imports no realm, no
 *      ordinal and no power.
 *
 * ── Why it exists, and what asked for it ─────────────────────────────────
 *
 * Fostering. A child their parent's own house cannot keep is placed with
 * somebody the parent knows, and there are two entirely different reasons that
 * happens: the house has a bar its own members' children do not clear, which
 * is nobody's fault and is not concealed - and the birth is one the household
 * will not own, which is. See
 * `src/engine/world/a-child-their-own-house-will-not-keep.ts`, which is this
 * module's first caller and the reason the concealment and the shame are one
 * object rather than two: the record naming what would be lost carries, in the
 * same row, the short list of people who already know.
 */

import { stableId, type DayIndex } from './common.js';
import type { Severity } from './grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A RECORD IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the shame is actually about.
 *
 * Concrete, for the same reason `GrudgeCause` is: a record whose cause is
 * "disgrace" is a record nobody can narrate from in forty years.
 */
export type ShameCause =
    /** A child the household will not own. The one this module was built for. */
    | 'birth_outside_the_household'
    /** Placed above their ability and kept on as staff. See `WASHING_OUT`. */
    | 'washed_out_of_a_placement'
    /** Put out of a house, by that house, in front of it. */
    | 'expelled'
    /** Swore a thing and did not do it. Its own grudge exists separately. */
    | 'broke_an_oath'
    /** Ran, and was seen to. */
    | 'fled_a_fight'
    | 'other';

export type ShameStatus = 'carried' | 'lifted';

/** The only way out. Written when something actually happened, never on a timer. */
export interface ShameLifted {
    how: 'acknowledged' | 'made_good' | 'outlived_the_people_who_knew' | 'proven_false';
    onDay: DayIndex;
    note: string;
}

export interface ShameRecord {
    id: string;
    /** Whose it is. Not necessarily whose fault it is. */
    subjectId: string;
    cause: ShameCause;
    severity: Severity;
    incurredOnDay: DayIndex;
    /** What happened, in plain words. Narrator prose, never parsed. */
    description: string;
    /**
     * Who knows. The short list, and it is the interesting field.
     *
     * A shame held by two people is a private arrangement; the same fact held
     * by a province is a life. Nothing in this module widens the list on its
     * own - somebody has to tell somebody, and that is the gossip layer's
     * business rather than this one's.
     */
    heldBy: string[];
    /**
     * True when it is simply known, and the list has stopped meaning anything.
     * Kept separate from `heldBy` rather than derived from its length: a fact
     * three people hold on purpose and a fact three people happen to have
     * heard are not the same fact.
     */
    common: boolean;
    status: ShameStatus;
    lifted: ShameLifted | null;
    recordedOnDay: DayIndex;
}

export interface ShameInput {
    subjectId: string;
    cause: ShameCause;
    severity: Severity;
    onDay: DayIndex;
    description: string;
    heldBy?: readonly string[];
    common?: boolean;
    /** Overrides the derived id. Use when replaying a persisted record. */
    id?: string;
}

/**
 * Write one down.
 *
 * Severity and description are required rather than defaulted, for the reason
 * `createObligation` requires them: a record nobody characterised is a record
 * that will be useless the first time anybody has to narrate from it.
 */
export function createShame(input: ShameInput): ShameRecord {
    return {
        id: input.id ?? stableId('shame', input.subjectId, input.cause, input.onDay),
        subjectId: input.subjectId,
        cause: input.cause,
        severity: input.severity,
        incurredOnDay: input.onDay,
        description: input.description,
        heldBy: [...new Set(input.heldBy ?? [])].sort(),
        common: input.common ?? false,
        status: 'carried',
        lifted: null,
        recordedOnDay: input.onDay
    };
}

/** Somebody else finds out. The record does not change; the list does. */
export function nowKnownTo(record: ShameRecord, holderIds: readonly string[]): ShameRecord {
    return { ...record, heldBy: [...new Set([...record.heldBy, ...holderIds])].sort() };
}

/** It stops costing anything, and the reason is written down. */
export function liftShame(record: ShameRecord, lifted: ShameLifted): ShameRecord {
    return { ...record, status: 'lifted', lifted };
}

/** True when this person's own record is being kept from them. */
export function isConcealedFrom(record: ShameRecord, personId: string): boolean {
    return !record.common && !record.heldBy.includes(personId);
}

// ─────────────────────────────────────────────────────────────────────────
// CARRYING IT ON A PERSON
//
// The world layer holds NPCs, not ledgers - `driver.ts` hands social rows back
// to its caller rather than storing them, and there is no obligation table in
// `WorldState`. So a shame produced by a world pass has to travel on the
// person, and it travels the way `discovery.ts` puts a knowing stage on a tag:
// one prefixed string, encoded and decoded here so no caller ever parses it.
// ─────────────────────────────────────────────────────────────────────────

export const SHAME_TAG_PREFIX = 'shame:';

const CAUSES: readonly ShameCause[] = [
    'birth_outside_the_household',
    'washed_out_of_a_placement',
    'expelled',
    'broke_an_oath',
    'fled_a_fight',
    'other'
] as const;

export function shameTag(cause: ShameCause): string {
    return `${SHAME_TAG_PREFIX}${cause}`;
}

/** Every shame this person is carrying on their tags. Empty is the normal case. */
export function shameCausesFromTags(tags: readonly string[]): ShameCause[] {
    const out: ShameCause[] = [];
    for (const tag of tags) {
        if (!tag.startsWith(SHAME_TAG_PREFIX)) continue;
        const value = tag.slice(SHAME_TAG_PREFIX.length) as ShameCause;
        if (CAUSES.includes(value) && !out.includes(value)) out.push(value);
    }
    return out;
}

export function isCarryingShame(tags: readonly string[]): boolean {
    return shameCausesFromTags(tags).length > 0;
}
