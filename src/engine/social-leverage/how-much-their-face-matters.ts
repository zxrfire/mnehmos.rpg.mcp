/**
 * How much somebody's face matters to them: one of a person's traits, drawn from their id on a
 * stream of its own, like `openHandednessOf` and `reticenceOf`.
 *
 * A trait reads every fact, not one situation (AGENTS.md, "A trait reads every fact"). This one
 * reads a stolen robe, a duel lost in front of the hall, an insult and a refusal alike: how much
 * being seen to have lost costs them, beside what was lost. Not read off an alignment, a house
 * or a rung.
 */

import { forStream } from '../cultivation/rng.js';

/** The stream name. Changing it moves every disposition in every world. */
const HOW_MUCH_THEIR_FACE_MATTERS = 'disposition:face';

/** Two draws averaged, peaking at nought, for `reticenceOf`'s reason. */
const DRAWS = 2;

/**
 * How much this person's face matters to them, on -1..+1.
 *   -1   they would tell the whole hall, if it got them their things back
 *    0   most people
 *   +1   they would rather lose it twice than be seen to have lost it once
 */
export function faceOf(personId: string): number {
    const id = (personId ?? '').trim();
    if (id.length === 0) return 0;
    const rng = forStream(id, HOW_MUCH_THEIR_FACE_MATTERS);
    let total = 0;
    for (let i = 0; i < DRAWS; i++) total += rng.next();
    return Math.round(((total / DRAWS) * 2 - 1) * 1e4) / 1e4;
}
