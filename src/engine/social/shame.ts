/**
 * Shame: a fact about somebody that other people hold, and that lowers them. Not a
 * grudge (which is between two parties) and not a secret (whose whole value is that
 * it has not got out) - this one IS out, among the people who matter, and costs
 * standing every time it is remembered.
 */

import { stableId, type DayIndex } from './common.js';
import type { Severity } from './grudges.js';

/**
 * What the shame is actually about. Concrete, for the same reason `GrudgeCause`
 * is: a record whose cause is "disgrace" is one nobody can narrate from in
 * forty years.
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
    /**
     * Something grave they did, that the people near them know about.
     */
    | 'known_for_a_grave_deed'
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
     * Who knows. Nothing in this module widens the list on its own - somebody
     * has to tell somebody, which is the gossip layer's business.
     */
    heldBy: string[];
    /**
     * True when it is simply known and the list has stopped meaning anything.
     * Kept separate from `heldBy` rather than derived from its length: a fact
     * three people hold on purpose and one three people happen to have heard
     * are not the same fact.
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
 * Severity and description are required rather than defaulted, for the reason
 * `createObligation` requires them: a record nobody characterised is useless the
 * first time anybody has to narrate from it.
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

// The world layer holds NPCs and not ledgers - there is no obligation table in
// `WorldState` - so a shame produced by a world pass travels on the person, the
// way `discovery.ts` puts a knowing stage on a tag: one prefixed string,
// encoded and decoded here so no caller ever parses it.

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

/**
 * The shames on this person's tags. Empty is the normal case. Decodes only the
 * causes in `CAUSES`, which does NOT list `known_for_a_grave_deed`, so a tag
 * carrying that cause reads back as nothing.
 */
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
