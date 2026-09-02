/**
 * "There is nothing further for you here."
 *
 * The door between act one and act two, and the narrative form of a mechanical
 * ceiling the player is going to hit anyway.
 *
 * ── Why it is a beat and not a message ───────────────────────────────────
 *
 * There is a rung where sitting in a cave stops working: the dao minimum bites,
 * and nothing within reach suits the person sitting there. The game can present
 * that as a wall of failed rolls, or somebody the player knows can look at them
 * and say to go. Same mechanic, opposite feeling, and the second one teaches
 * the suitability rule from a character rather than from a refusal message -
 * which is the best available tutorial and costs nothing.
 *
 * ── Somebody qualified has to have looked ────────────────────────────────
 *
 * This does NOT fire off an ordinal. A master would know because a master is
 * higher on the ladder, has walked the road, and can read a student - so the
 * trigger is an ASSESSMENT by somebody in a position to make one, and the
 * quality of the assessor is the quality of the answer:
 *
 *   far above    they see it exactly, and they are right
 *   near         they see that something is wrong and may misread which axis
 *   at or below  they are guessing, and a confident guess costs the student
 *                years, which is the most expensive currency in the game
 *
 * Being wrong is a feature and not an edge case. A master who keeps a student
 * too long because they cannot see what the student has already understood is
 * one of the better failures available, and it makes leaving a bad master a
 * real decision rather than an ungrateful one.
 *
 * ── The rogue case falls out ─────────────────────────────────────────────
 *
 * No master means nobody is assessing you, so nobody tells you, and you find
 * out by failing. That asymmetry needs no special case: {@link sendOffFor}
 * returns null without an assessor, and {@link unattachedSignFor} is the
 * lonelier equivalent the world offers instead - a stranger's remark, a body
 * in a ruin who evidently tried the same thing. It grants the same direction
 * and grants it worse.
 *
 * ── What it does not do ──────────────────────────────────────────────────
 *
 * It does not resolve. `docs/world/houses/discovery.md`: the send-off grants the
 * DIRECTION, not the answer. Nobody hands the player a map to the thing that
 * suits them, and this module never names a place. It is also refusable -
 * staying is a choice, and a player who sits in the cave until they die of old
 * age has chosen a legitimate ending and should be allowed to have it.
 */

import { forStream } from '../cultivation/rng.js';
import { regardFor } from '../cultivation/regard.js';
import type { Membership } from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody qualified looking at a student, and what they concluded.
 *
 * Supplied, never derived here. The stall itself is the cultivation layer's -
 * it owns the dao minimums, and a second opinion computed in this file would
 * drift from the real gate within a month. What this module owns is what
 * happens once somebody has looked.
 */
export interface Assessment {
    assessorId: string;
    assessorName: string;
    /** The assessor's own rung. What makes the read good or a guess. */
    assessorOrdinal: number;
    /** The student's rung. */
    studentOrdinal: number;
    /**
     * The cultivation layer's answer to "has this person stopped moving for a
     * reason that more sitting will not fix". The truth, before the assessor
     * has been allowed to misread it.
     */
    stalled: boolean;
    /** Which axis actually stalled, when the caller knows. Never invented. */
    axis?: 'dao' | 'suitability' | 'ground' | 'foundation' | null;
}

/** How good the reading was, which is a function of the gap and nothing else. */
export type ReadQuality = 'exact' | 'partial' | 'guess';

export function readQualityFor(assessment: Assessment): ReadQuality {
    // The student is the thing being read, so the assessor is the asker and
    // the student's rung is the gate. Same band table as everything else.
    const regard = regardFor(assessment.studentOrdinal, assessment.assessorOrdinal);
    if (regard.band === 'beneath' || regard.band === 'dismissed') return 'exact';
    if (regard.band === 'assured') return 'exact';
    if (regard.band === 'matched') return 'partial';
    return 'guess';
}

// ─────────────────────────────────────────────────────────────────────────
// THE BEAT
// ─────────────────────────────────────────────────────────────────────────

export interface SendOff {
    kind: 'send_off';
    assessorId: string;
    assessorName: string;
    /** Their house, when the assessor speaks for one. */
    factionId: string | null;
    factionName: string | null;
    quality: ReadQuality;
    /**
     * What the assessor believes. NOT necessarily what is true - compare
     * `correct`, which the narrator must never be shown.
     */
    verdict: 'go' | 'stay';
    /**
     * Whether the belief matches the cultivation layer's answer.
     *
     * Engine-only. A player who is told to go too early should find out by
     * spending years, not by reading a flag, so nothing that reaches a narrator
     * may carry this.
     */
    correct: boolean;
    /** Engine-authored and factual. Grants the direction and no more. */
    line: string;
    /** Staying is allowed, and refusing costs nothing anybody writes down. */
    refusable: true;
}

/**
 * A master looking at a student and acting on what they saw.
 *
 * Returns null when nobody looked, when the assessor is not in a position to
 * have an opinion worth acting on, and when the read came back "keep going" -
 * all three of which are silence, and silence is the ordinary case.
 *
 * Deterministic: the same assessor reading the same student on the same day
 * reaches the same conclusion, including the same mistake.
 */
export function sendOffFor(input: {
    seed: string;
    onDay: number;
    studentId: string;
    assessment: Assessment | null;
    membership: Membership | null;
}): SendOff | null {
    const { assessment } = input;
    if (!assessment) return null;

    const quality = readQualityFor(assessment);
    const rng = forStream(
        input.seed, 'enc.sendoff', input.onDay, assessment.assessorId, input.studentId
    );
    const slip = rng.next();

    // What they conclude, which is the truth seen through however well they can
    // see it. A guess is wrong often enough to matter and right often enough to
    // be worth listening to, which is what makes a mediocre teacher a genuine
    // dilemma rather than an obvious one to leave.
    const wrongChance = quality === 'exact' ? 0 : quality === 'partial' ? 0.12 : 0.35;
    const misread = slip < wrongChance;
    const believesStalled = misread ? !assessment.stalled : assessment.stalled;

    if (!believesStalled) return null;

    return {
        kind: 'send_off',
        assessorId: assessment.assessorId,
        assessorName: assessment.assessorName,
        factionId: input.membership?.factionId ?? null,
        factionName: input.membership?.factionName ?? null,
        quality,
        verdict: 'go',
        correct: believesStalled === assessment.stalled,
        line: lineFor(assessment, quality),
        refusable: true
    };
}

/**
 * The line, which says less the better the teacher is.
 *
 * A master who can read the student exactly does not need to justify it and
 * does not. One who is guessing hedges, and the hedge is the only signal the
 * player gets about how much to trust it - which is the correct amount of
 * information: enough to wonder, never enough to check.
 */
function lineFor(assessment: Assessment, quality: ReadQuality): string {
    const who = assessment.assessorName;
    const opening = `${who} has looked at this cultivator and says there is nothing further for them here.`;

    const direction = 'No place was named and no method was suggested. ' +
        'The instruction was to go and come back having understood something.';

    if (quality === 'exact') {
        return `${opening} They did not explain how they knew. ${direction}`;
    }
    if (quality === 'partial') {
        return `${opening} They took some time over it first. ${direction}`;
    }
    return `${opening} They are ${Math.abs(assessment.studentOrdinal - assessment.assessorOrdinal)} rungs ` +
        `from where the cultivator stands, and reading somebody at that distance is not something ` +
        `anybody does reliably. ${direction}`;
}

// ─────────────────────────────────────────────────────────────────────────
// NOBODY IS WATCHING
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the world offers somebody with no master.
 *
 * The same direction, arriving worse: no assessment, no authority, no chance
 * to ask a follow-up question, and no way to tell whether it applies to them.
 * `sourceKind` is `inferred` rather than `told` on purpose - nobody told them
 * anything; they worked it out standing over the evidence.
 *
 * Returns null unless the stall is real, because the world does not offer this
 * as encouragement. It is only ever the same fact arriving through a worse
 * channel.
 */
export function unattachedSignFor(input: {
    seed: string;
    onDay: number;
    studentId: string;
    /** The cultivation layer's answer. Not this module's to compute. */
    stalled: boolean;
    /** Where they are standing, for the sign to be found in. */
    placeName: string;
}): { kind: 'unattached_sign'; line: string; sourceKind: 'inferred'; refusable: true } | null {
    if (!input.stalled) return null;

    const rng = forStream(input.seed, 'enc.sign', input.onDay, input.studentId);
    const which = rng.int(0, SIGNS.length - 1);

    return {
        kind: 'unattached_sign',
        line: `${SIGNS[which].replace('{place}', input.placeName)} Nobody said anything to this ` +
            'cultivator about it, and there is nobody to ask whether it applies to them.',
        sourceKind: 'inferred',
        refusable: true
    };
}

/**
 * Ways the world says it without saying it.
 *
 * Each one is evidence rather than advice, and each one is deniable. The body
 * in the ruin is the sharpest: somebody else stood exactly here, drew exactly
 * this conclusion, and it is not obvious from the remains whether they were
 * right.
 */
const SIGNS: readonly string[] = [
    'A body well off the road at {place} was somebody who sat in one place a long ' +
        'time and then stopped, and what they were carrying is all of the same grade ' +
        'and none of it is worn.',
    'The ground at {place} has been worked by this cultivator for long enough that ' +
        'the marks where they sit are cut into it, and nothing has changed in a while.',
    'Somebody passing through {place} looked at this cultivator for slightly too long, ' +
        'said nothing worth repeating, and went on.',
    'A manual worked at {place} for years opens now to the same page it always ' +
        'opened to, and the page has stopped saying anything new.'
];
