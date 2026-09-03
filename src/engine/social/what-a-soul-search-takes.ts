/**
 * Reading what somebody is carrying, out of them, without asking.
 *
 * ── IT IS NOT AN ART ─────────────────────────────────────────────────────
 *
 * There is no `Technique` row for this, no manual, no teacher and no house
 * that teaches it. The design owner's ruling is that it opens with the nascent
 * soul and everybody above that line has it - so it is a CAPABILITY read off
 * the realm, exactly like a lifespan, and not a thing anybody acquires.
 *
 * That distinction is the whole reason the trope works, and it is worth being
 * explicit about because building it as an art would look almost identical and
 * would quietly destroy it. If it were taught, a courier would fear only the
 * houses that teach it and a pill would be a precaution against a named enemy.
 * Because everyone above the line has it, ANYBODY WHO TAKES YOU ALIVE CAN READ
 * YOU - and the pill stops being a counter to a technique and becomes the
 * standing answer to being captured at all.
 *
 * `handleLearn` must never reach this. If somebody asks to be taught it the
 * honest answer is that it is not taught: it opens with the nascent soul, and
 * either you have one or you do not.
 *
 * ── THE FLOOR IS NOT A BAD ROLL ──────────────────────────────────────────
 *
 * Below the line this is not a difficult attempt, it is not an attempt. Those
 * are two different refusals and the second is the interesting sentence, so
 * `WhyNothingCameBack` keeps them apart rather than folding both into failure.
 *
 * ── AND IT GENERATES NOTHING ─────────────────────────────────────────────
 *
 * Every row that comes out corresponds to a row that was in there. A soul
 * search cannot produce a fact its subject did not hold, cannot raise a
 * whisper into certainty, and cannot reach a claim they never had - reading
 * somebody's mind gives you what was in the mind and no more. So the stage is
 * capped at what the VICTIM held, and the searcher's rung buys HOW MUCH comes
 * across, never how good it is.
 *
 * That is also what makes it safe to wire: it is a copy with provenance, and
 * `source_from_holder_id` and `source_via_record_id` already exist on the row
 * to say whose mind it came out of and which of their memories it was.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { stageFromSource, type KnowingStage } from './discovery.js';
import type { SoulState } from '../world/npc-state.js';
import type { SourceKind } from './knowledge.js';

/** The realm the capability opens at. Everybody at or above it has it. */
export const THE_REALM_A_SOUL_SEARCH_OPENS_AT = 'nascent_soul';

/**
 * The lowest ordinal that can attempt one, read off the ladder.
 *
 * Not the literal 21. The ladder has been rewritten more than once and a
 * constant copied out of it is a coincidence maintained by attention - the
 * same failure `maxHpForOrdinal` names in `realms.ts`.
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
 * What a soul is in a condition to give up.
 *
 * `fading` and an identity at zero is the poison pill's whole effect: a body
 * with nothing left in it. Kept here rather than at the call site so that the
 * pill, when it is built, only has to set the state - the search already knows
 * what an emptied soul reads as.
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
 * The source a taken memory is filed under.
 *
 * `confessed` would be a lie - it means somebody dealing with you about their
 * own business - and every other existing kind is capped below `known`, which
 * would silently degrade what was read out of a mind into hearsay. So this is
 * its own kind, and `stageCeilingFor` gives it a `known` ceiling: the cap that
 * matters is the one the subject's own stage imposes, applied below.
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
 * The gap at which a search stops being a forcing.
 *
 * Below this the reader is barely able to open them and gets in by tearing.
 * At or above it the engine's own reading of a one-sided event applies -
 * "resolved in one action with nothing contested" - and nothing is contested
 * because nothing had to be overcome. So the same number decides how much
 * comes across AND what it costs them, which is deliberate: two functions
 * reading the same gap through two tables is how they start disagreeing.
 */
const OPENS_WITHOUT_FORCING_AT = 3;

/**
 * How much of somebody a search of this size opens.
 *
 * Deterministic on the rung gap, with no roll and no stream. The engine
 * already resolves a sufficiently one-sided confrontation this way - "resolved
 * in one action with nothing contested and no exchange rolled" - and a mind
 * held open by somebody four realms above is the same kind of event. Rolling
 * it would price the same gap twice and make the same capture read differently
 * on two runs of the same seed.
 *
 * At a level gap nothing opens: two nascent souls are a contest this function
 * does not adjudicate, and `they_held` is the honest answer until somebody
 * designs the contest.
 */
function howMuchOpens(realmGap: number, heldInAll: number): number {
    if (realmGap <= 0) return 0;
    if (realmGap === 1) return Math.min(heldInAll, 1);
    if (realmGap === 2) return Math.ceil(heldInAll / 2);
    return heldInAll;
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT IT COSTS THE PERSON WHO WAS READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * The four states a soul is in, worst last.
 *
 * `NpcRecord.soulState`'s own values, ordered here because the field is a set
 * of names and the harm is a walk down them. Nothing else in the engine
 * orders them, so this is the one place that says which way is down.
 */
export const SOUL_STATES_WORST_LAST: readonly SoulState[] =
    ['intact', 'damaged', 'fragmented', 'fading'];

/**
 * What a search did to the person it read.
 *
 * ── THE DAMAGE IS INVERSE TO THE GAP, WHICH IS THE WHOLE MODEL ───────────
 *
 * A reader barely able to open somebody gets in by tearing. A reader four
 * realms above does not have to: the engine's own account of a sufficiently
 * one-sided event is "resolved in one action with nothing contested", and
 * nothing is contested because nothing had to be overcome.
 *
 * So being read by a monster is survivable and being read by somebody near
 * your own rung ruins you. That is not the intuitive way round and it is the
 * one the rest of the engine already argues for - and it makes the middle of
 * the range the dangerous part, which is where players actually live.
 *
 * It also means one axis does both jobs. The gap that decides how much comes
 * across decides what it cost, and a second table priced off the same number
 * would be two answers to one question waiting to disagree.
 *
 * ── AND SOMEBODY CAN BE READ UNTIL THERE IS NOTHING LEFT ─────────────────
 *
 * Three steps from `intact` to `fading`, so a person held and forced open
 * three times ends where the poison pill puts them: a soul that is going, and
 * a body a later search finds empty. The same axis at a different setting,
 * arrived at by a different road, with no machinery either end had to know
 * about. Nothing here is a special case for it.
 *
 * ── AND HEAVEN DOES NOT GRADE IT ─────────────────────────────────────────
 *
 * A rescuer reading a captive to find where the children were taken pays the
 * same price out of the same soul as an inquisitor. The effects follow from
 * what was done. What it was FOR is the ledger's business, not this
 * function's.
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
 * Price the search against the body it was done to.
 *
 * Pure, and separate from `whatASoulSearchTakes` only because the caller
 * writes them to two different places - the searcher's knowledge rows and the
 * subject's record. Both read the same `realmGap` off the same search.
 */
export function whatASoulSearchCost(
    search: ASoulSearch,
    subject: TheStateOfASoul
): WhatTheSearchCostThem {
    const before = subject.soulState as SoulState;

    // Nothing got in, so nothing was torn. That covers the floor, the empty
    // soul and the one that held - including `they_held`, which is somebody
    // keeping a reader out rather than surviving one.
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
 * Read them.
 *
 * Pure: state in, what came across out. No I/O, no mutation, and no roll. The
 * caller writes the rows and applies whatever the search cost the subject -
 * that cost is the next piece and is deliberately not decided here.
 */
export function whatASoulSearchTakes(attempt: ASoulSearchAttempt): ASoulSearch {
    const { searcherOrdinal, subjectOrdinal, subject, held } = attempt;
    const realmGap = realmsBetween(searcherOrdinal, subjectOrdinal);
    const nothing = (why: WhyNothingCameBack): ASoulSearch =>
        ({ opened: false, why, took: [], heldInAll: held.length, realmGap });

    // The gate first, because it is not a failure and must not be reported as
    // one. Somebody at Core Formation has not searched badly; there is no
    // nascent soul to search with.
    if (!canSearchASoul(searcherOrdinal)) return nothing('below_the_line');

    // Then what is actually in there. A soul that is fading holds nothing that
    // survives being read, whatever rows are still filed under the id - which
    // is exactly what the pill buys, and why it is a denial rather than a race.
    if (subject.soulState === 'fading' || subject.identityContinuity <= 0) {
        return nothing('nothing_left');
    }

    // Only first-person positive stances. `ignorant` is the ABSENCE of a
    // memory rather than one, on the same reading `memoryCandidates` takes of
    // the same table, and taking somebody's ignorance is not a thing.
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
