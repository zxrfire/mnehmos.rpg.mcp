/**
 * What looking at a person gets you, and where the look stops. The reference axis
 * only: the perceptual one is answered in the party read.
 */

import { STAGE_MEANING, isAtLeast, type KnowingStage } from './discovery.js';

export interface WhatALookReaches {
    /** The reader's position on this person, unchanged by having looked. */
    stage: KnowingStage;
    /**
     * The ladder's own words for the rung, verbatim, for the MECHANICAL
     * channel. Do not paraphrase it here: five paraphrases of a rung is how a
     * ladder acquires a seventh nobody agreed to. {@link WhatALookReaches.line}
     * is the sentence for a face.
     */
    reference: string;
    /** One engine-authored sentence about this face, for the player. */
    line: string;
    /**
     * The ceiling, always present and deliberately the same sentence at every
     * stage: a look does not get better at this.
     */
    ceiling: string;
    /**
     * True when the reader has dealings to draw on rather than a face. A fact
     * about the READER's records, not about the person looked at.
     */
    hasDealtWithThem: boolean;
}

/** The floor at which a reader has something behind the face of their own. */
export const A_FACE_YOU_HAVE_SOMETHING_BEHIND: KnowingStage = 'encountered';

/**
 * Takes the stage and nothing else. It must not take a rung: folding capability
 * into reference is the collapse `docs/world/houses/trust.md` forbids by name.
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
