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
 *
 * THREE FACTS AND NOTHING ELSE: which way it went for them, how much of what
 * they had it was, and what their part in it was. The narrator writes what that
 * looks like on a face.
 *
 * These were twelve finished sentences with the reaction already in them - "and
 * they have registered it", "there is no part of this they can absorb and carry
 * on as they were", "from close enough to be counted as having been there". An
 * engine knows a magnitude and a role. It does not know what somebody has
 * registered, and writing it down as though it does leaves the narrator
 * arguing with a conclusion instead of describing a person.
 *
 * The cost of the old shape was not only tone. The deterministic renderer
 * prints these verbatim, so the SAME long sentence arrived under the same
 * person on every turn of a fight - and a line a player has read four times has
 * stopped being atmosphere whatever it says.
 */
function readingFor(weight: number, moved: number, dealtWith: boolean): string | null {
    if (weight < WORTH_A_SENTENCE) return null;
    const band = weight >= SET_BACK ? 2 : weight >= TOUCHED ? 1 : 0;

    if (moved < 0) {
        return [
            'They lost a little of what they had.',
            'They lost a serious piece of what they had, to whoever is in front of them.',
            'They lost all of it.'
        ][band];
    }
    if (moved > 0) {
        return [
            'They gained a little.',
            'They gained a serious piece, from whoever is in front of them.',
            'They gained more than they had.'
        ][band];
    }
    if (dealtWith) {
        return [
            'Nothing of theirs moved. It was put to them and came to nothing.',
            'Nothing of theirs moved. It was put to them in front of the others.',
            'Nothing of theirs moved. They were at the middle of it throughout.'
        ][band];
    }
    // A WITNESS IS SOMEBODY DOING SOMETHING, NOT A VANTAGE POINT.
    //
    // These read "They saw all of it, FROM CLOSE BY" and "they were NEAR ENOUGH
    // that it could have been", which is an inspector recording where somebody
    // was standing and what they could therefore have perceived - and the
    // second one is a guess about a thing that did not happen on top of it.
    // Measured over the reference corpus, a group in this genre acts: *"The
    // others were appalled as they looked onto the chase below."* The engine
    // cannot know appalled. It can say they watched, which is what they did.
    return [
        'None of it was theirs. They watched.',
        'None of it was theirs. They watched all of it.',
        'None of it was theirs. It happened next to them.'
    ][band];
}

/**
 * Whether they said anything.
 *
 * BOTH ARE FACTS AND BOTH ARE VISIBLE, which is the whole content: the room can
 * tell either way. Saying so in the sentence - *"out loud"*, *"where the others
 * can see it"* - is the engine reporting the modality of its own observation on
 * top of the observation, and it arrived under every person in every scene.
 */
export function whetherTheySayIt(aloud: boolean): string {
    return aloud ? 'They answer.' : 'They say nothing.';
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
