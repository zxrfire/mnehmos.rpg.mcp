/**
 * What a moment asks of somebody standing in it, and whether they answer aloud.
 */

export interface Bearing {
    /**
     * How much of what they had this moment moved, signed, -1..+1.
     */
    moved: number;
    /** What is left of the body, 0..1. */
    bodyLeft: number;
    /**
     * How they stand to the party they would be answering, in rungs.
     *
     * Theirs minus the other's, so negative is looking up at somebody.
     */
    rungsOverTheOther: number;
    /** Whether anybody standing here answers for them. */
    backed: boolean;
    /**
     * The heaviest thing this moment did to anybody in it, 0..1.
     */
    sceneWeight: number;
    /** Whether the other party dealt with them directly, whatever came of it. */
    dealtWith: boolean;
    /** How much they let show, -1..+1. `reticenceOf` in `emotional-reticence.ts`. */
    reticence: number;
}

export interface WhatItAsksOfThem {
    /** How much this moment is asking of them, 0..1. */
    weight: number;
    /** What answering it out loud would cost them, 0..1. */
    cost: number;
    /** Whether they answer it aloud. The narrator writes the words. */
    aloud: boolean;
    /**
     * What a person in the room could observe about their situation.
     *
     * Null when nothing has happened to them worth a sentence, which is most
     * people in most scenes.
     */
    reading: string | null;
}

/**
 * How much of what they watched lands on somebody it did not happen to.
 */
export const WITNESS_SHARE = 0.35;

/**
 * The floor for somebody the other party actually dealt with.
 *
 * Enough to clear `WORTH_A_SENTENCE` and no more, which is the whole of what it
 * is for: being spoken to earns a reading when nothing else about them moved.
 * It is deliberately NOT the reason they answer - raising it until it cleared
 * the cost of answering also pinned the reading, and three rounds of a fight
 * wearing somebody down produced the same sentence three times. What happened
 * to them and whether they answer are two questions.
 */
export const BEING_DEALT_WITH = 0.12;

/** Below this, nothing has happened to them that is worth a sentence. */
export const WORTH_A_SENTENCE = 0.08;

/** The band boundaries. Shared by both signs, which is the symmetry guarantee. */
export const TOUCHED = 0.25;
export const SET_BACK = 0.55;

/**
 * The gap at which answering somebody above you costs everything you have.
 */
export const SPEAKING_UP_COSTS_EVERYTHING_AT = 8;

/** What somebody standing with their own people pays instead. */
export const BACKED_PAYS = 0.4;

/**
 * What saying anything costs, before anybody's standing is considered.
 */
export const SPEAKING_AT_ALL_COSTS = 0.3;

/**
 * How little of the cost somebody with nothing left still pays. Cornered people
 * talk, and a model that kept them silent at the moment they have least to lose
 * would be wrong about the commonest scene in this game.
 */
const RUINED_STILL_PAYS = 0.25;

export function whatThisAsksOfThem(bearing: Bearing): WhatItAsksOfThem {
    const moved = finite(bearing.moved);
    const bodyLeft = clamp01(finite(bearing.bodyLeft, 1));
    const sceneWeight = clamp01(finite(bearing.sceneWeight));

    const weight = clamp01(Math.max(
        Math.abs(moved),
        1 - bodyLeft,
        WITNESS_SHARE * sceneWeight,
        bearing.dealtWith ? BEING_DEALT_WITH : 0
    ));

    const cost = costOfAnswering(bearing, bodyLeft);

    // -1 shows double, +1 shows nothing. The multiplication is the whole of
    // how disposition enters: nothing switches on which band it fell in.
    const shown = weight * (1 - clampSigned(finite(bearing.reticence)));

    return {
        weight: round4(weight),
        cost: round4(cost),
        // BEING DEALT WITH IS NOT A WEIGHT THAT HAS TO CLEAR A COST. The
        // design owner: *if i'm talking to a dude then yeah he should say
        // something every turn. if not then probably not, unless i do something
        // that affects them.* Cost is the question for somebody deciding
        // whether to speak up about a thing that was not put to them. Leaving
        // a question hanging in front of witnesses is a deliberate act and not
        // what temperament produces; what temperament decides is how much of
        // themselves is in the answer, and that is the reticence clause and a
        // different sentence. Measured before this: the verb had the person
        // answering *straight away and at length* while the scene line
        // underneath said the not saying was visible.
        aloud: bearing.dealtWith === true || (shown > cost && weight >= WORTH_A_SENTENCE),
        reading: readingFor(weight, moved, bearing.dealtWith === true)
    };
}

function costOfAnswering(bearing: Bearing, bodyLeft: number): number {
    const lookingUp = Math.max(0, -finite(bearing.rungsOverTheOther));
    const gap = clamp01(lookingUp / SPEAKING_UP_COSTS_EVERYTHING_AT);
    const raw = SPEAKING_AT_ALL_COSTS + (1 - SPEAKING_AT_ALL_COSTS) * gap;
    const backed = bearing.backed ? BACKED_PAYS : 1;
    return clamp01(raw * backed * (RUINED_STILL_PAYS + (1 - RUINED_STILL_PAYS) * bodyLeft));
}

/**
 * What somebody in the room could see about their situation.
 */
function readingFor(weight: number, moved: number, dealtWith: boolean): string | null {
    if (weight < WORTH_A_SENTENCE) return null;
    const band = weight >= SET_BACK ? 2 : weight >= TOUCHED ? 1 : 0;

    if (moved < 0) {
        return [
            'A little of what they had has gone, and they have registered it.',
            'A serious piece of what they had has gone, and they are standing in front of '
                + 'whoever it went to.',
            'What they had is gone. There is no part of this they can absorb and carry on '
                + 'as they were.'
        ][band];
    }
    if (moved > 0) {
        return [
            'A little more than they had has come to them, and they have registered it.',
            'A serious piece more than they had is theirs, and they are standing in front of '
                + 'whoever it came from.',
            'More has come to them than they had. There is no part of this they can absorb '
                + 'and carry on as they were.'
        ][band];
    }
    if (dealtWith) {
        return [
            'Nothing of theirs moved. They are the one it was put to, and it came to nothing.',
            'Nothing of theirs moved. They are the one it was put to, in front of whoever '
                + 'else is standing here, and it came to nothing.',
            'Nothing of theirs moved, and they were at the middle of it from the first word '
                + 'to the last.'
        ][band];
    }
    return [
        'Nothing of this was theirs. They saw it.',
        'Nothing of this was theirs. They saw all of it, from close enough to be counted '
            + 'as having been there.',
        'Nothing of this was theirs, and they were near enough that it could as easily '
            + 'have been.'
    ][band];
}

/**
 * The silence, said as what it looked like.
 */
export function whetherTheySayIt(aloud: boolean): string {
    return aloud
        ? 'They answer it out loud.'
        : 'They do not say anything, and the not saying is visible.';
}

function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampSigned(n: number): number {
    return n < -1 ? -1 : n > 1 ? 1 : n;
}

function finite(n: number, fallback = 0): number {
    return Number.isFinite(n) ? n : fallback;
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}
