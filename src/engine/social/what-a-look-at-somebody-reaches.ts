/**
 * What looking at a person actually gets you, and where the look stops.
 *
 * WHY THIS EXISTS
 * ---------------
 * `look at <somebody>` answered with the place - the ambient band, the weather
 * and who else was about - because the object of the sentence was thrown away
 * before the engine ever saw it. That is a routing bug and it is fixed in the
 * parser. This module is the other half: once the sentence reaches a person,
 * something has to say what a look is worth.
 *
 * THE TWO AXES ARE ALREADY DECIDED, AND THEY ARE NOT COLLAPSED
 * -----------------------------------------------------------
 * `docs/world/houses/trust.md` settles this and is not restated here. Its ruling in
 * one line - *realm is capability, worldview is reference* - is that what a
 * reader gets out of a person depends on two independent things about the
 * READER, and that they must never become one number.
 *
 * The perceptual axis already reaches the played game: the party read says what
 * rung somebody stands at and whether they are beyond comparison, and that is
 * the realm axis doing its job. **The reference axis did not.** It is
 * {@link KnowingStage} - held per subject, in `discovery.ts` - and no read in
 * the played game ever printed it, so a face the cultivator had dealt with for
 * years and a face they had merely been in a room with came back identical.
 *
 * This module is that one missing sentence and nothing more. It takes the
 * stage the reader holds and says what the look reached, in the ladder's own
 * vocabulary rather than a paraphrase of it.
 *
 * AND WHAT A LOOK CANNOT REACH, WHICH IS THE POINT OF SAYING SO
 * ------------------------------------------------------------
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY` in `src/data/cultivation/beasts.ts` rules
 * that the deepest thing there is to notice about a person surfaces *in
 * conversation about ordinary things, over time, and never in a look* - and
 * that it is not a fact about beasts at all, but about anybody whose records
 * are empty where yours are full. That constant is the authority and is not
 * copied here; what is here is the consequence for this verb, which is that a
 * look has a ceiling and the engine should say where it is rather than let a
 * narrator imply there is more in the picture than the engine put there.
 *
 * Nothing in this file ranks anybody by cultivation, reads a realm, or takes a
 * threshold - the charter of `src/engine/social/`. It reads a stage and returns
 * two sentences. Pure: same stage, same answer, forever.
 */

import { STAGE_MEANING, isAtLeast, type KnowingStage } from './discovery.js';

export interface WhatALookReaches {
    /** The reader's position on this person, unchanged by having looked. */
    stage: KnowingStage;
    /**
     * The ladder's own words for the rung, verbatim.
     *
     * For the MECHANICAL channel and not for prose. `STAGE_MEANING` is written
     * about a subject of any kind - "they have been in a room with it" - and it
     * is deliberately not paraphrased here: its own header says that five
     * paraphrases of a rung is how a ladder acquires a seventh nobody agreed
     * to. {@link WhatALookReaches.line} is the sentence for a face.
     */
    reference: string;
    /**
     * One engine-authored sentence about this face, for the player.
     *
     * Two branches and no table, off {@link WhatALookReaches.hasDealtWithThem}
     * alone - so it says the thing that changes what a reader can do with a
     * face without re-stating the ladder rung by rung.
     */
    line: string;
    /**
     * The ceiling. One sentence, always present, and deliberately the same
     * sentence at every stage: a look does not get better at this.
     */
    ceiling: string;
    /**
     * True when the reader has dealings to draw on rather than a face.
     *
     * The one thing a caller might branch on, and it is a fact about the
     * READER's records rather than about the person being looked at.
     */
    hasDealtWithThem: boolean;
}

/**
 * The floor at which a reader has something behind the face.
 *
 * `encountered` - "you have been in a room with it". Below that they are
 * looking at somebody they have only ever been told about, and the look is the
 * first thing they have had of their own.
 */
export const A_FACE_YOU_HAVE_SOMETHING_BEHIND: KnowingStage = 'encountered';

/**
 * What a look at this person is worth to this reader.
 *
 * Takes the stage and nothing else. It does not take a rung, and it must not:
 * how much of somebody's cultivation a reader can make out is the perceptual
 * axis, it is answered where the party is read, and folding the two together
 * here would be the collapse `trust.md` forbids by name.
 */
export function whatALookAtSomebodyReaches(
    stage: KnowingStage,
    /** Whose face it is. Named so the sentence is about a person and not a row. */
    name: string
): WhatALookReaches {
    const dealt = isAtLeast(stage, A_FACE_YOU_HAVE_SOMETHING_BEHIND);
    return {
        stage,
        reference: STAGE_MEANING[stage],
        line: dealt
            ? `${name} is somebody this cultivator has already stood in front of, so there is `
              + 'something behind the face and not only the face.'
            : `${name} is a face with nothing behind it yet - whatever is known of them was got `
              + 'at second hand, and looking harder adds none of it.',
        ceiling:
            'What a look cannot reach is what somebody has a reference for, which shows in '
            + 'ordinary conversation over time and not in a face.',
        hasDealtWithThem: dealt
    };
}
