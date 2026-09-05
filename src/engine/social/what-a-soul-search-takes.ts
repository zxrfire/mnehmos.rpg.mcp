/**
 * Reading what somebody is carrying, out of them, without asking.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { stageFromSource, type KnowingStage } from './discovery.js';
import type { SoulState } from '../world/npc-state.js';
import type { SourceKind } from './knowledge.js';

/** The realm the capability opens at. Everybody at or above it has it. */
export const THE_REALM_A_SOUL_SEARCH_OPENS_AT = 'nascent_soul';

/**
 * The lowest ordinal that can attempt one, read off the ladder. Not the literal
 * 21: the ladder has been rewritten more than once, and a constant copied out
 * of it is a coincidence maintained by attention.
 */
export function soulSearchOpensAt(): number {
    const tier = REALM_TIERS.find(row => row.key === THE_REALM_A_SOUL_SEARCH_OPENS_AT);
    if (!tier) {
        throw new Error(
            `No realm tier is keyed ${THE_REALM_A_SOUL_SEARCH_OPENS_AT}. Soul searching is gated `
            + 'on a realm rather than a number, so a renamed tier has to fail loudly here rather '
            + 'than silently opening the capability to everybody or to nobody.'
        );
    }
    return tier.ordinalStart;
}

/** Whether this body has a nascent soul, which is the whole of the gate. */
export function canSearchASoul(ordinal: number): boolean {
    return realmForOrdinal(ordinal).ordinalStart >= soulSearchOpensAt();
}

/**
 * What a soul is in a condition to give up. `fading` with an identity at zero
 * is the poison pill's whole effect, kept here so the pill, when it is built,
 * only has to set the state.
 */
export interface TheStateOfASoul {
    /** `intact`, `damaged`, `fragmented`, `fading` - `NpcRecord.soulState`. */
    readonly soulState: string;
    /** 0..1. `NpcRecord.identityContinuity`. */
    readonly identityContinuity: number;
}

/** One thing they were holding, as it sits on the row. */
export interface AMemoryHeld {
    readonly id: string;
    readonly claimKey: string;
    readonly statement: string;
    readonly stance: string;
    readonly confidence: number;
    /** The stage THEY held it at. The ceiling on what can come across. */
    readonly stage: KnowingStage;
}

export type WhyNothingCameBack =
    /** No nascent soul. Not a failed attempt - not an attempt. */
    | 'below_the_line'
    /** The soul is gone or going. This is what a swallowed pill leaves. */
    | 'nothing_left'
    /** A whole soul holding nothing anybody would want. */
    | 'nothing_held'
    /** Theirs held against yours. The only one of the four that is a contest. */
    | 'they_held';

export interface WhatCameAcross {
    readonly id: string;
    readonly claimKey: string;
    readonly statement: string;
    /** Never above the stage they held it at. */
    readonly stage: KnowingStage;
    readonly confidence: number;
}

export interface ASoulSearch {
    readonly opened: boolean;
    readonly why: WhyNothingCameBack | null;
    readonly took: readonly WhatCameAcross[];
    /** How many they were holding, whether or not it came across. */
    readonly heldInAll: number;
    /** Major realms of gap. Negative when the subject is the stronger. */
    readonly realmGap: number;
}

export interface ASoulSearchAttempt {
    readonly searcherOrdinal: number;
    readonly subjectOrdinal: number;
    readonly subject: TheStateOfASoul;
    readonly held: readonly AMemoryHeld[];
}

/**
 * The source a taken memory is filed under. Its own kind because `confessed`
 * would be a lie and every other kind caps below `known`. `stageCeilingFor`
 * gives it a `known` ceiling; the cap that matters is the subject's own stage,
 * applied below.
 */
export const TAKEN_OUT_OF_SOMEBODY: SourceKind = 'taken';

const REALM_STARTS: readonly number[] = REALM_TIERS.map(tier => tier.ordinalStart);

/** Which major realm an ordinal sits in, as a position on the ladder. */
function realmIndexOf(ordinal: number): number {
    const start = realmForOrdinal(ordinal).ordinalStart;
    return REALM_STARTS.filter(row => row <= start).length;
}

/** How many major realms separate two ordinals. Positive favours the first. */
function realmsBetween(searcher: number, subject: number): number {
    return realmIndexOf(searcher) - realmIndexOf(subject);
}

/**
 * The gap at which a search stops being a forcing. Below it the reader gets in
 * by tearing; at or above it nothing is contested because nothing had to be
 * overcome. The same number decides how much comes across AND what it costs
 * them, deliberately: two tables over one gap is how they start disagreeing.
 */
const OPENS_WITHOUT_FORCING_AT = 3;

/**
 * How much of somebody a search of this size opens.
 */
function howMuchOpens(realmGap: number, heldInAll: number): number {
    if (realmGap <= 0) return 0;
    if (realmGap === 1) return Math.min(heldInAll, 1);
    if (realmGap === 2) return Math.ceil(heldInAll / 2);
    return heldInAll;
}

/**
 * The four states a soul is in, worst last. `NpcRecord.soulState`'s own values,
 * ordered here because the harm is a walk down them. Nothing else in the engine
 * orders them, so this is the one place that says which way is down.
 */
export const SOUL_STATES_WORST_LAST: readonly SoulState[] =
    ['intact', 'damaged', 'fragmented', 'fading'];

/**
 * What a search did to the person it read.
 */
export interface WhatTheSearchCostThem {
    readonly before: SoulState;
    readonly after: SoulState;
    /** 0 or 1. A single search never takes more than one step. */
    readonly stepsDown: number;
    /** Why it cost what it did, for the record rather than for a branch. */
    readonly because:
        | 'nothing_was_opened'
        | 'forced'
        | 'opened_without_forcing';
}

function stepDown(state: SoulState): SoulState {
    const at = SOUL_STATES_WORST_LAST.indexOf(state);
    // An unknown value must not silently become `intact`. A soul state this
    // function has never heard of is a schema change, and answering anyway
    // would hide it.
    if (at < 0) {
        throw new Error(
            `Unknown soul state "${state}". SOUL_STATES_WORST_LAST is the one place that orders `
            + 'them, so a value added to `SoulState` has to be added here in the same breath.'
        );
    }
    return SOUL_STATES_WORST_LAST[Math.min(at + 1, SOUL_STATES_WORST_LAST.length - 1)];
}

/**
 * Price the search against the body it was done to. Separate from
 * `whatASoulSearchTakes` only because the caller writes them to two different
 * places; both read the same `realmGap` off the same search.
 */
export function whatASoulSearchCost(
    search: ASoulSearch,
    subject: TheStateOfASoul
): WhatTheSearchCostThem {
    const before = subject.soulState as SoulState;

    // Nothing got in, so nothing was torn: the floor, the empty soul and
    // `they_held`, which is keeping a reader out rather than surviving one.
    if (!search.opened) {
        return { before, after: before, stepsDown: 0, because: 'nothing_was_opened' };
    }

    if (search.realmGap >= OPENS_WITHOUT_FORCING_AT) {
        return { before, after: before, stepsDown: 0, because: 'opened_without_forcing' };
    }

    const after = stepDown(before);
    return { before, after, stepsDown: after === before ? 0 : 1, because: 'forced' };
}

/**
 * Read them. Pure: state in, what came across out, with no I/O, no mutation and
 * no roll. The caller writes the rows and applies `whatASoulSearchCost`.
 */
export function whatASoulSearchTakes(attempt: ASoulSearchAttempt): ASoulSearch {
    const { searcherOrdinal, subjectOrdinal, subject, held } = attempt;
    const realmGap = realmsBetween(searcherOrdinal, subjectOrdinal);
    const nothing = (why: WhyNothingCameBack): ASoulSearch =>
        ({ opened: false, why, took: [], heldInAll: held.length, realmGap });

    // The gate first, because it is not a failure and must not be reported as
    // one: somebody at Core Formation has not searched badly, there is no
    // nascent soul to search with.
    if (!canSearchASoul(searcherOrdinal)) return nothing('below_the_line');

    // Then what is in there. A fading soul holds nothing that survives being
    // read, whatever rows are still filed under the id - which is what the pill
    // buys, and why it is a denial rather than a race.
    if (subject.soulState === 'fading' || subject.identityContinuity <= 0) {
        return nothing('nothing_left');
    }

    // Only first-person positive stances. `ignorant` is the ABSENCE of a memory
    // rather than one, and taking somebody's ignorance is not a thing.
    const worthTaking = held.filter(row => row.stance === 'knows' || row.stance === 'believes');
    if (worthTaking.length === 0) return nothing('nothing_held');

    const opens = howMuchOpens(realmGap, worthTaking.length);
    if (opens === 0) return nothing('they_held');

    // Ordered so the same subject read twice gives up the same things in the
    // same order, and so a partial read is the strongest of what they had
    // rather than whichever row the table returned first.
    const ordered = [...worthTaking].sort((a, b) =>
        b.confidence - a.confidence || a.id.localeCompare(b.id));

    return {
        opened: true,
        why: null,
        heldInAll: held.length,
        realmGap,
        took: ordered.slice(0, opens).map(row => ({
            id: row.id,
            claimKey: row.claimKey,
            statement: row.statement,
            // THE CAP THAT MATTERS. Never above what they held it at, and
            // never above what the method itself could deliver.
            stage: stageFromSource(TAKEN_OUT_OF_SOMEBODY, row.stage),
            // Nor more certain than they were. A rung buys how much comes
            // across, never how good it is.
            confidence: row.confidence
        }))
    };
}
