/**
 * The day somebody understands what an attachment actually was, and the grudge that
 * opens then.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import type { DayIndex } from '../social/common.js';
import { DAYS_PER_YEAR } from '../social/common.js';
import type { ObligationInput, Severity } from '../social/grudges.js';
import type { AskWeight, UnspokenTruth } from './an-attempt-to-move-somebody.js';
import { severityWithHouse, whenItIsDoneToOneOfOurs } from './what-a-house-will-do-about-it.js';
import type { SectAlignment } from '../../schema/cultivation.js';

/**
 * Chance per year that nothing in particular gives it away. Low, and it has to
 * be: ten years of quiet is roughly even money at this rate.
 */
const PER_YEAR_BASE = 0.06;

/**
 * Added per year when the actor never returned it. The real tell, read straight
 * off the two halves of the tie: being the only one who ever crosses the distance
 * is a thing a person notices, and it accumulates.
 */
const PER_YEAR_UNRETURNED = 0.05;

/** Added per year per person who saw the manoeuvre happen. */
const AUDIENCE_PER_YEAR: Record<UnspokenTruth['audience'], number> = {
    alone: 0,
    few: 0.02,
    crowd: 0.05,
    peers: 0.08,
    // Somebody above them was watching and had the practice to read it.
    superiors: 0.1,
    // People with a reason to look hard, and a reason to tell them.
    enemies: 0.14
} as const;

/**
 * A single jump, applied on the day the actor spends the attachment.
 */
const ON_BEING_SPENT = 0.35;

/** Nobody is ever certain, and nobody is ever safe. */
const YEARLY_FLOOR = 0.01;
const YEARLY_CEILING = 0.6;

export interface DiscoveryCheck {
    truth: UnspokenTruth;
    /** The day the world has reached. */
    onDay: DayIndex;
    /** How many days have passed since the last check. */
    daysElapsed: number;
    /**
     * True on the check that runs immediately after the actor cashed the
     * attachment in - called a favour, asked for the thing it was for.
     */
    justSpent?: boolean;
    /**
     * The subject's `insight`, 1..4, when the caller has an attribute row. Worth
     * about as little here as charm is worth on the other side.
     */
    subjectInsight?: number;
    rng: CultivationRNG;
}

/**
 * The chance, for this stretch of days, that they put it together.
 */
export function oddsOfWorkingItOut(check: DiscoveryCheck): number {
    const years = Math.max(0, check.daysElapsed) / DAYS_PER_YEAR;
    const unreturned = check.truth.theirStrength - check.truth.yourStrength;

    const yearly = clamp(
        PER_YEAR_BASE +
            Math.max(0, unreturned) * PER_YEAR_UNRETURNED +
            AUDIENCE_PER_YEAR[check.truth.audience] +
            ((check.subjectInsight ?? 2) - 2) * 0.02,
        YEARLY_FLOOR,
        YEARLY_CEILING
    );

    // Compounded rather than multiplied, so a long span cannot exceed one and
    // a very long one approaches certainty without ever reaching it.
    const overTheSpan = 1 - Math.pow(1 - yearly, years);
    const spent = check.justSpent ? ON_BEING_SPENT : 0;

    return round4(clamp(overTheSpan + spent - overTheSpan * spent, 0, 0.99));
}

/** Whether this is the day. One roll, from the caller's seeded stream. */
export function haveTheyWorkedItOut(check: DiscoveryCheck): boolean {
    return check.rng.next() < oddsOfWorkingItOut(check);
}

/**
 * How badly they take it, decided once, here, at creation. Two stored numbers
 * rather than judgements: how far in they were, and what was riding on it.
 */
function severityOfBeingUsed(theirStrength: number, ask: AskWeight): Severity {
    if (theirStrength >= 0.75 && ask === 'a_betrayal') return 'unforgivable';
    if (theirStrength >= 0.6 || ask === 'a_betrayal') return 'grave';
    if (theirStrength >= 0.4 || ask === 'against_their_interest') return 'serious';
    return 'slight';
}

export interface DiscoveryOutcome {
    /** The grudge to write. Held by the aggrieved party, as everywhere else. */
    grudge: ObligationInput;
    /** What the subject's house does about it, once it knows. */
    verdict: ReturnType<typeof whenItIsDoneToOneOfOurs>;
    /**
     * The tie should be ended rather than deleted - `endRelationship`, reason
     * `severed`. A dead master is still a master and a lie that was believed
     * for eleven years is still eleven years.
     */
    endTheTieReason: string;
    /** Engine-authored factual line. Never narration. */
    line: string;
}

/**
 * The records the day produces.
 *
 * The names are carried into the description because by the time somebody reads
 * it there may be nobody left who could look the ids up.
 */
export function whatTheyDoAboutIt(input: {
    truth: UnspokenTruth;
    onDay: DayIndex;
    actorName: string;
    subjectName: string;
    /** The subject's house, for the second half of the alignment split. */
    subjectAlignment: SectAlignment | null;
    subjectRanked: boolean;
    subjectFactionId: string | null;
}): DiscoveryOutcome {
    const personal = severityOfBeingUsed(input.truth.theirStrength, input.truth.ask);
    const verdict = whenItIsDoneToOneOfOurs({
        alignment: input.subjectAlignment,
        ranked: input.subjectRanked,
        wasAnAttachment: true,
        ask: input.truth.ask
    });
    const severity = severityWithHouse(personal, verdict.severityFloor);
    const years = Math.round((input.onDay - input.truth.formedOnDay) / DAYS_PER_YEAR);

    const grudge: ObligationInput = {
        kind: 'grudge',
        // The aggrieved party holds it. Same direction as everywhere else.
        holderId: input.truth.aboutId,
        subjectId: input.truth.heldById,
        cause: 'betrayal',
        severity,
        onDay: input.onDay,
        description:
            `${input.subjectName} worked out what ${input.actorName} had been doing. ` +
            `${years === 0 ? 'It had not been long' : `It had been ${years} year${years === 1 ? '' : 's'}`}` +
            `, and there had been something wanted from it the whole time.`,
        participants:
            verdict.houseIsAParty && input.subjectFactionId ? [input.subjectFactionId] : [],
        tags: [
            'used',
            `ask:${input.truth.ask}`,
            `house:${verdict.response}`
        ]
    };

    return {
        grudge,
        verdict,
        endTheTieReason: 'severed',
        line:
            `${input.subjectName} understands now what it was for. ` +
            verdict.note
    };
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

/** Exported for tests and probes that pin the curve. */
export const DISCOVERY_CONSTANTS = Object.freeze({
    PER_YEAR_BASE,
    PER_YEAR_UNRETURNED,
    AUDIENCE_PER_YEAR,
    ON_BEING_SPENT,
    YEARLY_FLOOR,
    YEARLY_CEILING
});
