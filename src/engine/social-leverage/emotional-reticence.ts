/**
 * How much of what a moment does to somebody actually shows.
 *
 * The design owner: *"maybe they say nothing and are stoic, maybe they are
 * emotional"*. Both halves are required, so silence is reachable and is decided
 * by the engine off state rather than by the model's mood.
 *
 * Its own stream and not a second reading of open-handedness: a generous person
 * can be silent and a grasping one loud. A test pins the correlation at nothing.
 */

import { forStream } from '../cultivation/rng.js';

/**
 * The stream name. The person goes in the SEED slot and this in the STREAM slot,
 * the reverse of how `forStream` usually reads, because there is no run or world
 * seed here. Changing either slot moves every disposition in every world.
 */
const HOW_MUCH_A_PERSON_LETS_SHOW = 'disposition:reticence';

/**
 * Two draws averaged: a triangular distribution peaking at nought. One uniform
 * makes every second person an extreme; three or more pushes the ends so far out
 * that a run never meets anybody notably stoic or notably raw.
 */
const DRAWS = 2;

/**
 * How much this person keeps off their face, on -1..+1.
 *
 *   -1   it is all on the outside, always
 *    0   the ordinary answer, which is most people
 *   +1   nothing gets out that they did not decide to let out
 *
 * Total: any string answers, so a caller never has to guard.
 */
export function reticenceOf(personId: string): number {
    const id = (personId ?? '').trim();
    if (id.length === 0) return 0;
    const rng = forStream(id, HOW_MUCH_A_PERSON_LETS_SHOW);
    let total = 0;
    for (let i = 0; i < DRAWS; i++) total += rng.next();
    return round4((total / DRAWS) * 2 - 1);
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

/** Where a reading stops being worth a sentence. Set to match the other axis. */
const WORTH_SAYING = 0.4;

/** Where it is the first thing anybody would tell you about them. */
const MARKED = 0.75;

/**
 * The number said in words, or null when there is nothing to say.
 *
 * BANDS DESCRIBE A NUMBER; THEY DO NOT SELECT A BEHAVIOUR. Nothing reads which
 * sentence came back, and a tenth kind of person must stay a different number
 * with a different sentence and no new branch.
 *
 * Written as what somebody would observe rather than as a label, because a word
 * that names the axis invites an enum later.
 */
export function howMuchTheyLetShow(reticence: number): string | null {
    if (!Number.isFinite(reticence)) return null;
    if (reticence >= MARKED) {
        return 'nothing reaches their face that they did not put there, and people who have '
            + 'known them for years say the same';
    }
    if (reticence >= WORTH_SAYING) {
        return 'keeps more off their face than most people manage';
    }
    if (reticence <= -MARKED) {
        return 'is entirely legible, and has never been anything else';
    }
    if (reticence <= -WORTH_SAYING) {
        return 'shows a little more than most people do';
    }
    return null;
}

/** Exported for tests and probes that pin the bands. */
export const RETICENCE_BANDS = Object.freeze({ WORTH_SAYING, MARKED, DRAWS });
