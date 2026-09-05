/**
 * "There is nothing further for you here."
 *
 * This does NOT fire off an ordinal. A master would know because a master is
 * higher on the ladder and can read a student, so the trigger is an ASSESSMENT
 * and the quality of the assessor is the quality of the answer.
 *
 * It does not resolve. `docs/world/houses/discovery.md`: the send-off grants the
 * DIRECTION, not the answer, and this module never names a place. It is also
 * refusable - a player who sits in the cave until they die of old age has chosen
 * a legitimate ending.
 */

import { forStream } from '../cultivation/rng.js';
import { regardFor } from '../cultivation/regard.js';
import type { Membership } from './types.js';

// THE ASSESSMENT

/**
 * Somebody qualified looking at a student, and what they concluded.
 */
export interface Assessment {
    assessorId: string;
    assessorName: string;
    /** The assessor's own rung. What makes the read good or a guess. */
    assessorOrdinal: number;
    /** The student's rung. */
    studentOrdinal: number;
/**
 * The cultivation layer's answer to "has this person stopped moving for a reason
 * that will not pass". Supplied, never derived here: the cultivation layer owns
 * the dao minimums, and a second opinion computed in this file would drift from
 * the real gate within a month.
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

// THE BEAT

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
     */
    correct: boolean;
    /** Engine-authored and factual. Grants the direction and no more. */
    line: string;
    /** Staying is allowed, and refusing costs nothing anybody writes down. */
    refusable: true;
}

/**
 * A master looking at a student and acting on what they saw.
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
 * The line, which says less the better the teacher is. A master who can read the
 * student exactly does not justify it; one who is guessing hedges, and the hedge
 * is the only signal the player gets about how much to trust it.
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

// NOBODY IS WATCHING

/**
 * What the world offers somebody with no master.
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
