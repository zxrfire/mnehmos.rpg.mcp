/**
 * How much of what a moment does to somebody actually shows.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on people answering the things that happen to them:
 *
 *   > maybe they say nothing and are stoic, maybe they are emotional
 *
 * Both halves are required. A channel that always emits something reads as a
 * tic within three turns, and a world where everybody swallows it is the dry
 * prose this exists to fix. So silence has to be REACHABLE and it has to be
 * DECIDED - by the engine, off state - rather than left to whether the model
 * felt like writing dialogue this turn.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT IS A SECOND SCALAR AND NOT A SECOND USE OF THE FIRST
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `how-freely-somebody-parts-with-what-they-have.ts` is the shape this copies,
 * deliberately and down to the arithmetic, and its header carries the argument
 * for why a disposition is a number rather than an enum. What it does NOT
 * carry is this axis: how open-handed somebody is says what they will let go
 * of, and says nothing about whether they say so. A generous person can be
 * silent and a grasping one loud, and collapsing the two would make every
 * scene's speech predictable from its economics.
 *
 * So it is drawn from its own stream. The two are independent by construction,
 * and a test pins the correlation at nothing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS NOT A PERSONALITY, AND NOTHING SWITCHES ON IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `whatThisAsksOfThem` in `moved-to-speak.ts` multiplies by it and nothing
 * anywhere branches on which band it fell in. AGENTS.md: *"if a new case
 * requires a new branch, the shape is wrong"* - a tenth kind of person is a
 * different number with a different sentence, and no code.
 */

import { forStream } from '../cultivation/rng.js';

/**
 * The stream name.
 *
 * A constant in the STREAM slot with the person in the SEED slot, which is the
 * reverse of how `forStream` usually reads and is copied on purpose from
 * `how-freely-somebody-parts-with-what-they-have.ts`: there is no run seed and
 * no world seed in this question, and putting the person where the seed goes
 * says so. Changing either slot moves every disposition in every world.
 */
const HOW_MUCH_A_PERSON_LETS_SHOW = 'disposition:reticence';

/**
 * Two draws averaged: a triangular distribution peaking at nought.
 *
 * The same number as the open-handedness draw and for the same reason. One
 * uniform makes every second person an extreme; three or more pushes the ends
 * so far out that a run never meets anybody notably stoic or notably raw,
 * which are the two people this exists to put in the world.
 */
const DRAWS = 2;

/**
 * How much this person keeps off their face, on -1..+1.
 *
 *   -1   it is all on the outside, always
 *    0   the ordinary answer, which is most people
 *   +1   nothing gets out that they did not decide to let out
 *
 * Deterministic in the id and total: any string answers, including one this
 * world has never seen, so a caller never has to guard.
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
 * BANDS DESCRIBE A NUMBER; THEY DO NOT SELECT A BEHAVIOUR. Nothing in the
 * engine reads which sentence came back. It exists so that somebody whose
 * arithmetic is unusual READS unusual, which is the half a term in a threshold
 * cannot carry on its own.
 *
 * Written as what somebody would observe rather than as a label, because
 * "stoic" and "emotional" are the two examples the owner reached for and not
 * the set, and a word that names the axis invites an enum later.
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
