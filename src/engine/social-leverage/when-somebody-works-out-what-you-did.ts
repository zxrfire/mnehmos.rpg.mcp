/**
 * The day somebody understands what an attachment actually was, and the grudge
 * that opens then.
 *
 * WHY THIS IS ITS OWN EVENT AND NOT A SIDE EFFECT
 * ----------------------------------------------
 * A grudge that opens the instant a manoeuvre succeeds is a different thing
 * from one that opens eleven years later when somebody finally works out what
 * happened - and the second is far better, because the intervening years are
 * years the player spent believing it had worked cleanly. The tie was real
 * state the whole time, readable, decaying nothing, sitting in the same table
 * as every other tie. Then one day it is read differently.
 *
 * So the discovery is a dated event with its own roll, on its own schedule,
 * and it can perfectly well never fire. Somebody dying still attached and
 * still wrong about it is a legitimate outcome and the commonest one.
 *
 * A FAILED ATTEMPT AND A DISCOVERED SUCCESSFUL ONE ARE DIFFERENT INJURIES
 * ----------------------------------------------------------------------
 * `an-attempt-to-move-somebody.ts` writes refusals at `slight` or `serious`
 * and can write nothing heavier. Everything `grave` and `unforgivable` in this
 * subsystem is written here. That gap is the design: being turned down is an
 * embarrassment, and being used and finding out afterwards is what makes
 * somebody an enemy for three hundred years. The cause is `betrayal` rather
 * than `humiliation` for the same reason.
 *
 * NOTHING NEW IS BEING BUILT
 * --------------------------
 * The consequence layer is `grudges.ts`, unchanged. `grudge_opened` is already
 * one of the commonest events in a live world, already upstream of killings
 * and of houses moving on houses, and already inherited on death. An
 * instrumental attachment that is worked out just adds a row to a ledger that
 * three hundred years of machinery is already reading. The direction is the
 * one the rest of the codebase already uses: the AGGRIEVED party holds it.
 *
 * Pure and seeded. Same seed, same tie, same day, same answer.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import type { DayIndex } from '../social/common.js';
import { DAYS_PER_YEAR } from '../social/common.js';
import type { ObligationInput, Severity } from '../social/grudges.js';
import type { AskWeight, UnspokenTruth } from './an-attempt-to-move-somebody.js';
import { severityWithHouse, whenItIsDoneToOneOfOurs } from './what-a-house-will-do-about-it.js';
import type { SectAlignment } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT MAKES IT COME OUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance per year that nothing in particular gives it away.
 *
 * Low, and it has to be: the ordinary case is that people do not find out.
 * Ten years of quiet is roughly even money at this rate, which is about right
 * for something that only ever surfaces because somebody eventually compares
 * two things they were told.
 */
const PER_YEAR_BASE = 0.06;

/**
 * Added per year when the actor never returned it.
 *
 * The real tell, and it is read straight off the two halves of the tie. Being
 * the only one who ever crosses the distance is a thing a person notices, and
 * it accumulates.
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
 *
 * Calling the favour in is the loudest thing that can happen to a lie like
 * this, because it is the moment the ask stops being deniable. Whether it
 * lands is still a roll - people forgive a great deal from somebody they are
 * attached to, and that is exactly why this is worth risking.
 */
const ON_BEING_SPENT = 0.35;

/** Nobody is ever certain, and nobody is ever safe. */
const YEARLY_FLOOR = 0.01;
const YEARLY_CEILING = 0.6;

// ─────────────────────────────────────────────────────────────────────────
// THE ROLL
// ─────────────────────────────────────────────────────────────────────────

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
     * The subject's `insight`, 1..4, when the caller has an attribute row.
     * Comprehension is the attribute for working a thing out, and it is worth
     * about as little here as charm is worth on the other side.
     */
    subjectInsight?: number;
    rng: CultivationRNG;
}

/**
 * The chance, for this stretch of days, that they put it together.
 *
 * Exported so a probe can print the curve. The yearly rate is scaled by the
 * span actually elapsed rather than being applied per tick, so a world that
 * advances in ten-year chunks and one that advances yearly agree.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT OPENS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How badly they take it, decided once, here, at creation.
 *
 * Two things set it and both are stored numbers rather than judgements: how
 * far in they were, and what was riding on it. Somebody who gave up nothing
 * over a courtesy has been embarrassed. Somebody who was `defining`-strong and
 * did something against their own interest for it has lost years of their life
 * to a thing that was not what they were told.
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
 * `subjectName` and `actorName` are carried into the description because a
 * record nobody can read in two centuries is the exact failure `grudges.ts`
 * exists to prevent, and by then there may be nobody left who could look the
 * ids up.
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

// ─────────────────────────────────────────────────────────────────────────

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
