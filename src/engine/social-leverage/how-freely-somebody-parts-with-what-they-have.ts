/**
 * How freely a particular person parts with what they have.
 */

import { forStream } from '../cultivation/rng.js';

/** The stream name. There is no world seed in this function and must not be one. */
const HOW_A_PERSON_HOLDS_WHAT_THEY_HAVE = 'disposition:open_handedness';

/**
 * Most people are ordinary and the ends are the interesting part.
 */
const DRAWS = 2;

/**
 * How open-handed this person is, on -1..+1. Nothing switches on it: a caller
 * multiplies by it, and a tenth kind of person is a different scalar and no code.
 */
export function openHandednessOf(personId: string): number {
    const id = (personId ?? '').trim();
    if (id.length === 0) return 0;
    // The person goes in the SEED slot and the constant in the stream slot,
    // which is the reverse of how `forStream` usually reads. Do not "fix" the
    // argument order - the derived string differs, and every disposition in
    // every world would move.
    const rng = forStream(id, HOW_A_PERSON_HOLDS_WHAT_THEY_HAVE);
    let total = 0;
    for (let i = 0; i < DRAWS; i++) total += rng.next();
    return round4((total / DRAWS) * 2 - 1);
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

/**
 * Where a reading stops being worth a sentence.
 */
const WORTH_SAYING = 0.4;

/**
 * Where it is the first thing anybody would tell you about them. Also moved:
 * 0.6 marked one person in six, 0.75 marks about one in sixteen.
 */
const MARKED = 0.75;

/**
 * The number said in words, or null when there is nothing to say.
 */
export function howTheyHoldWhatTheyHave(openHandedness: number): string | null {
    if (!Number.isFinite(openHandedness)) return null;
    if (openHandedness >= MARKED) {
        return 'gives things away, and has been doing it long enough that people '
            + 'have stopped being surprised by it';
    }
    if (openHandedness >= WORTH_SAYING) {
        return 'parts with things more easily than most people do';
    }
    if (openHandedness <= -MARKED) {
        return 'does not let go of what is theirs, and is known for it';
    }
    if (openHandedness <= -WORTH_SAYING) {
        return 'holds on to what is theirs a little harder than most people do';
    }
    return null;
}

/**
 * The same fact from the other side: how a refusal from THIS person reads.
 */
export function whatTheirRefusalIsLike(openHandedness: number): string | null {
    if (!Number.isFinite(openHandedness)) return null;
    if (openHandedness >= MARKED) {
        return 'They are not a person who says no easily, and they said it anyway - so '
            + 'what stopped them was the thing itself and not the asking.';
    }
    if (openHandedness >= WORTH_SAYING) {
        return 'They part with things more readily than most, which makes this a no about '
            + 'what was asked rather than about you.';
    }
    if (openHandedness <= -MARKED) {
        return 'Nothing leaves their hands that does not have to. Anyone who has dealt with '
            + 'them twice would have expected this one.';
    }
    if (openHandedness <= -WORTH_SAYING) {
        return 'They hold on to what is theirs, and a no from them costs them nothing to say.';
    }
    return null;
}

/** Exported for tests and probes that pin the bands. */
export const DISPOSITION_BANDS = Object.freeze({ WORTH_SAYING, MARKED, DRAWS });
