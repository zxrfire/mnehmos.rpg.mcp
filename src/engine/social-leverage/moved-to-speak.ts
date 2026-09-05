/**
 * What a moment asks of somebody standing in it, and whether they answer aloud.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS WAS WRITTEN AGAINST
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Measured by playing a pinned run and reading the phase-3 prompt verbatim.
 * Three rounds of a fight, and the whole of what the narrator was told about
 * the person being fought:
 *
 *     Qi Condensation Layer 1 strikes at Qi Condensation Layer 2. Advantage
 *     0.82; 4 damage. ...
 *     You are on 36 of 40; Kong Liekuan is on 39 of 43.
 *
 * A hit-point pool and a rank label. Two other people were standing in the
 * square for all three rounds and were not mentioned once. Being taken into a
 * house came back as *"Taken on by Sand Well Carriers, ranked Skin"* - the most
 * personal event in the setting, with nobody in it. So the prose was dry
 * because the narrator had no person to write, not because it wrote badly.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS DECIDES, AND WHAT IT MUST NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It decides WHETHER somebody speaks. It never decides what they say.
 *
 * That split is the authority rule applied to speech, and it falls the right
 * way round. Whether a person answers is a consequence of state - what this
 * cost them, what they have left, what answering would cost - so it is the
 * engine's, and leaving it to the model means silence arrives when the model
 * is feeling terse rather than when the world is. The WORDS are interpretation
 * and are the narrator's, and there is no table of them here.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HEAVENS ARE HEARTLESS, AND THAT IS AN ARITHMETIC CONSTRAINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md's epigraph: a rescue and a killing are the same kind of event, and
 * the engine does not grade. So {@link Bearing.moved} is SIGNED and the weight
 * is its magnitude. A gift and a robbery of the same fraction of what somebody
 * had produce the same number, reach the same band, and cost the same to
 * answer. The sign selects which of two parallel sentences is returned, and
 * `tests/engine/social-leverage/moved-to-speak.test.ts` asserts the two sides
 * have the same band count and the same thresholds - because an implementation
 * with more to say about harm than about generosity has smuggled in a moral
 * weighting, and it would look plausible every time.
 *
 * Nothing here reads what the act WAS. There is no cause, no verb name and no
 * enum of situations, for the same reason `what-a-deed-leaves.ts` carries a
 * `cause` it never looks at: *a tenth kind of moment must need no new branch.*
 * Being robbed, being given something, being admitted, being refused and
 * watching somebody else be killed are five values of two numbers.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY SILENCE IS AN OUTPUT AND NOT A FAILURE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner: *"maybe they say nothing and are stoic, maybe they are
 * emotional."* A channel that emits on every turn reads as a tic within three
 * turns, so `aloud` is false far more often than not and the reading still
 * says what the silence looked like. Somebody swallowing it IS a reaction and
 * is worth a sentence; what is worth nothing is a sentence about somebody
 * whom nothing has happened to, which is why {@link whatThisAsksOfThem}
 * returns a null reading below {@link WORTH_A_SENTENCE}.
 */

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING ASKED
// ─────────────────────────────────────────────────────────────────────────

export interface Bearing {
    /**
     * How much of what they had this moment moved, signed, -1..+1.
     *
     * Negative is away from them, positive is toward them, nought is
     * untouched. A FRACTION and never an amount, which is what makes twenty
     * stones a catastrophe for one person and unremarkable for another out of
     * the same event - the term `what-a-deed-leaves.ts` prices every deed on.
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
     *
     * How a witness is priced, and the reason witnessing needs no case of its
     * own: somebody nothing happened to is moved by a share of what they
     * watched happen. A bystander to a lavish gift and a bystander to a
     * killing are the same arithmetic, which is the point.
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

// ─────────────────────────────────────────────────────────────────────────
// THE CONSTANTS, AND WHY EACH IS WHERE IT IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of what they watched lands on somebody it did not happen to.
 *
 * Not small. Standing next to somebody who has just been killed is one of the
 * loudest things that can happen to a person who was not touched, and a share
 * low enough to keep bystanders quiet would delete the case the owner named
 * explicitly. Not 1 either: it did not happen to them, and the difference
 * between watching and paying has to survive.
 */
export const WITNESS_SHARE = 0.35;

/**
 * The floor for somebody the other party actually dealt with.
 *
 * Being spoken to is itself something to answer, and without this a scene
 * where the player asked somebody a question and nothing came of it has no
 * person in it - which is exactly the reading the measurement found. It sits
 * just above {@link WORTH_A_SENTENCE} so that being dealt with always produces
 * a person, and well below the point where it produces speech on its own.
 */
export const BEING_DEALT_WITH = 0.12;

/** Below this, nothing has happened to them that is worth a sentence. */
export const WORTH_A_SENTENCE = 0.08;

/** The band boundaries. Shared by both signs, which is the symmetry guarantee. */
export const TOUCHED = 0.25;
export const SET_BACK = 0.55;

/**
 * The gap at which answering somebody above you costs everything you have.
 *
 * Eight rungs is `describeStanding`'s own "far enough ahead that the
 * difference is not a matter of effort" band. Past that, speaking up is not
 * courage, it is a decision about whether to survive the afternoon, and the
 * quiet that follows a strong person taking something is the setting working
 * rather than the channel failing.
 */
export const SPEAKING_UP_COSTS_EVERYTHING_AT = 8;

/** What somebody standing with their own people pays instead. */
export const BACKED_PAYS = 0.4;

/**
 * What saying anything costs, before anybody's standing is considered.
 *
 * MEASURED AND ADDED. Without it the cost of answering somebody at or above
 * your own rung was nought, so every witness to anything spoke, and a played
 * admission produced three consecutive sentences that were word-for-word
 * identical except for the name. That is the tic the whole channel exists to
 * avoid, and it arrived on the first run.
 *
 * A floor is also the truthful reading. Saying a thing out loud commits you to
 * having said it in front of whoever is standing there, whatever your rung -
 * so nobody speaks for free, and the ones who do have a reason that came from
 * somewhere.
 */
export const SPEAKING_AT_ALL_COSTS = 0.3;

/**
 * How little of the cost somebody with nothing left still pays.
 *
 * Cornered people talk. A person on the last of their body is not weighing
 * what a complaint will cost them next month, and a model that kept them
 * silent at the exact moment they have least to lose would be wrong about the
 * commonest scene in this game.
 */
const RUINED_STILL_PAYS = 0.25;

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

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
        aloud: shown > cost && weight >= WORTH_A_SENTENCE,
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
 * ── THE SHAPE, AND WHY IT IS NOT A PHRASE TABLE ──────────────────────────
 *
 * Three bands over one number, with the sign choosing between parallel sets.
 * `describeStanding` and `howTheyHoldWhatTheyHave` are the precedent and the
 * rule is theirs: BANDS DESCRIBE A NUMBER, THEY DO NOT SELECT A BEHAVIOUR.
 * Nothing downstream reads which sentence came back, so a tenth kind of moment
 * is a different number and no new code.
 *
 * The sets are the three values of `Math.sign(moved)` - it went away from them,
 * it came to them, it happened to somebody else - and the third splits once on
 * whether the other party addressed them, because somebody standing in front of
 * the player while nothing came of it is not a bystander and reading as one was
 * a false sentence rather than a missing case. Every set has the same three
 * bands at the same two thresholds, and a test asserts that rather than leaving
 * it to whoever edits this next.
 *
 * Nothing here names a cause. "What they had is gone" is true of a robbery, a
 * fine, a lost wager, a house that dissolved under them and a thing the engine
 * has not been taught yet.
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
 *
 * Kept beside the reading rather than in the caller, because a scene where
 * everybody speaks and a scene where somebody visibly does not are different
 * scenes, and the second one is content. It says nothing about why: whether
 * they are stoic, frightened or uninterested is the narrator's to read off the
 * standing and the disposition it is given alongside.
 */
export function whetherTheySayIt(aloud: boolean): string {
    return aloud
        ? 'They answer it out loud.'
        : 'They do not say anything, and the not saying is visible.';
}

// ─────────────────────────────────────────────────────────────────────────

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
