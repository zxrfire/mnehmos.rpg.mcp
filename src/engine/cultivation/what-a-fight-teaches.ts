/**
 * What a fight teaches, and what it does not.
 *
 * Design owner, on combat:
 *
 *   "where is attack? Fighting should give you comprehension of your art (and
 *    your cultivation too, to some extent). You can't get to 46 only by
 *    fighting but you do learn."
 *
 * Two halves, and the second one is a constraint rather than a reward.
 *
 * ── THIS IS NOT A NEW AXIS ───────────────────────────────────────────────
 *
 * `understanding.ts` already models comprehension - a domain, a subject, a
 * degree that climbs to `dao`, and an achievement behind every insight that
 * makes it traceable. `docs/world/climbing/understanding.md` is the design
 * record. Nothing here invents a second understanding; what it decides is the
 * one question that file leaves open, which is what a FIGHT contributes.
 *
 * The answer that file already implies: exposure buys understanding, and a
 * fight is exposure of a particular kind - your own art, used against
 * resistance, at a rung that either stretched you or did not. So a fight is an
 * `AchievementKind` like any other, its access is `phenomenon` because it
 * happened TO you, and the comprehension is about the art you actually fought
 * with. Fighting bare teaches nothing about any art, because there was no art.
 *
 * ── WHAT THE FIGHT HAS TO HAVE BEEN ──────────────────────────────────────
 *
 * Beating somebody far below you teaches nothing, because there was no
 * resistance. That is a statement about the DISTANCE between two parties, and
 * this world already has one instrument for that: `REGARD_BANDS`, read through
 * `bandForGap`. It is reached for here rather than inventing a second scale,
 * and the consequence is that the line where a fight stops teaching is the
 * table's own line and moves when the table moves.
 *
 *   gap = your ordinal - theirs
 *
 *   stretch / overmatched / unreachable   they are above you.       teaches most
 *   matched   (0..3 below)                at you, near enough.      teaches
 *   assured   (4..9 below)                no resistance.            nothing
 *   beneath / dismissed                   not a fight at all.       nothing
 *
 * Note where `matched` ends: somebody three rungs under you still teaches you
 * something, and the fourth rung is where it stops. That boundary is not a
 * judgement made here - it is where `REGARD_BANDS` already says the world stops
 * treating an attempt as a thing being attempted.
 *
 * ── THE CEILING, WHICH IS THE ACTUAL DESIGN DECISION ─────────────────────
 *
 * "You can't get to 46 only by fighting but you do learn." Both halves have to
 * be true at once, and the second is easy while the first is the whole
 * difficulty: any per-fight payment large enough to feel real is a payment a
 * patient player can repeat.
 *
 * So there are two ceilings and they work differently.
 *
 *   COMPREHENSION is capped by the machinery it feeds into, not by anything
 *   here. An insight stops at `MAX_DEGREE`, and what understanding is worth at
 *   a crossing is capped at `MAX_SUBSTITUTION` - a third of the requirement and
 *   not a sliver more. So a cultivator with a perfect comprehension of their own
 *   art, bought entirely with blood, still has to accumulate two thirds of every
 *   rung. That is the owner's sentence, and it was already enforced before this
 *   file existed.
 *
 *   ACCUMULATION is capped HERE, structurally, and with no stored counter:
 *   fighting pays into a rung only while the rung is under
 *   `FIGHT_CARRIES_AT_MOST` complete. Past that point a fight is worth zero qi
 *   and the rest has to be cultivated. Nothing has to be remembered for this to
 *   hold - it reads `cultivationProgress`, which the world already keeps and
 *   already maintains - so it cannot rot the way a stored "how much of this came
 *   from fighting" column would. See AGENTS.md, `a field nothing writes`.
 *
 * The rate is the other number, and it is deliberately absurd in the right
 * direction. `tests/engine/cultivation/what-a-fight-teaches.test.ts` measures
 * how many qualifying fights it would take to carry one rung and asserts the
 * figure, so the decision cannot be quietly reverted by somebody who finds it
 * surprising.
 *
 * ── PURE, AND IT ROLLS NOTHING ───────────────────────────────────────────
 *
 * This module returns a CHANCE and an AMOUNT. It does not draw, and it is
 * deliberately not called from inside `resolveConfrontation`'s exchange loop:
 * a draw added to that stream shifts every later draw off it, and combat is the
 * most seeded thing in the engine. The caller rolls on its own stream
 * (`forStream(runSeed, 'fight-teaches', ...)`), which is what keeps every
 * existing confrontation byte-identical.
 */

import type { Element, InsightDomain } from '../../schema/cultivation.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { bandForGap } from './regard.js';
import { progressRequiredForOrdinal } from './realms.js';
import { domainForSubject } from './understanding.js';
import type { ConfrontationOutcome } from './combat.js';

// ─────────────────────────────────────────────────────────────────────────
// THE RATE, AND THE CEILING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance one qualifying fight forms or deepens a comprehension of the art it
 * was fought with, against an opponent at your own height.
 *
 * Set against the two rates already in `understanding.ts` that this is a
 * sibling of. A survived heavenly tribulation is 0.25 and a survived crippling
 * deviation is 0.12, and both of those are events a cultivator meets a handful
 * of times in a life. A fight is not: somebody can pick one every week. So the
 * per-event figure has to be an order below theirs, and at 0.02 a cultivator
 * needs about fifty real fights for one degree and about two hundred and fifty
 * to carry one comprehension from nothing to `dao` - which is a life spent
 * fighting, which is exactly what it should cost.
 */
export const FIGHT_INSIGHT_CHANCE = 0.02;

/**
 * Share of the CURRENT rung's requirement one qualifying fight is worth in raw
 * accumulation, against an opponent at your own height.
 *
 * A fifth of a percent. Two hundred and fifty fights to the rung at `matched`,
 * a hundred and twenty-five against somebody above you - before
 * `FIGHT_CARRIES_AT_MOST` cuts it off partway, which makes the real figure
 * larger still and the completion impossible at any figure.
 *
 * Expressed as a share of the requirement rather than as a flat number so it
 * scales with the ladder, the same reasoning `bottleneckSubstitution` gives:
 * a flat award is irrelevant at Void Refinement and overwhelming at Qi
 * Condensation, and the point is that it is small everywhere.
 */
export const FIGHT_PROGRESS_SHARE = 0.002;

/**
 * How far into a rung fighting can carry somebody, and no further.
 *
 * Three fifths. Past that, a fight is worth zero qi and the remainder has to
 * come from cultivating, so "you cannot get to 46 only by fighting" is
 * structurally true rather than true because the rate is small - a patient
 * player cannot grind past it at any number of repetitions, and no counter has
 * to be kept for it to hold.
 *
 * Three fifths rather than a half because the sentence is "you do learn": the
 * majority of a rung being reachable through violence is what makes a fighting
 * life a real road, and the last two fifths being closed is what makes it not
 * the only one.
 */
export const FIGHT_CARRIES_AT_MOST = 0.6;

/**
 * What each band of distance is worth, against 1 at `matched`.
 *
 * Exhaustive over `RegardBand` on purpose. A band added to `REGARD_BANDS` will
 * not compile until somebody decides here whether a fight at that distance
 * teaches anything, which is the right place for that decision to be forced.
 *
 * The three bands where the opponent is ABOVE you are all worth double and none
 * of them more than double. Fighting somebody out of your reach is the best
 * teacher there is and it is also how people die; paying it at four times would
 * make the correct play a series of suicidal fights, which is not the same
 * sentence as "you learn most from a hard fight".
 */
export const FIGHT_TEACHING_BY_BAND: Readonly<Record<RegardBand, number>> = Object.freeze({
    /** Nine or more rungs above you. If you lived through it, you learned. */
    unreachable: 2,
    /** Four to eight above. */
    overmatched: 2,
    /** One to three above. */
    stretch: 2,
    /** At you, or up to three under. Ordinary risk, ordinary lesson. */
    matched: 1,
    /** Four to nine under. No resistance, nothing learned. */
    assured: 0,
    /** Ten to sixteen under. Not a fight. */
    beneath: 0,
    /** Seventeen or more under. Not an event. */
    dismissed: 0
});

/**
 * Outcomes that are not a fight having happened.
 *
 * `no_contest` is the gap ending it before a die was rolled, which is the one
 * case where the exchange count would be zero anyway. It is named as well as
 * counted so the reason a player learned nothing can be stated rather than
 * inferred from an empty list.
 */
const TAUGHT_NOTHING: readonly ConfrontationOutcome[] = Object.freeze(['no_contest']);

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

/** What the caller knows about a fight that just resolved, from one side of it. */
export interface AFightThatHappened {
    /** The rung the learner stands on. */
    yourOrdinal: number;
    /** The rung the person they fought stands on. */
    theirOrdinal: number;
    /**
     * Exchanges the learner was actually part of. Zero is not a fight, whatever
     * the outcome says.
     */
    exchanges: number;
    outcome: ConfrontationOutcome;
    /**
     * What the art they fought with is ABOUT - 'sword', 'formation', 'fist'.
     * Null for somebody who fought bare, and a bare fight teaches no art,
     * because there was no art in it.
     */
    subject: string | null;
    /** The art's element, when it has one. Widens what the fight can open. */
    element?: Element | null;
    /**
     * Qi already accumulated toward the current rung. Read, never written, and
     * it is what makes `FIGHT_CARRIES_AT_MOST` need no stored counter.
     */
    cultivationProgress: number;
}

/** What one side of one fight is worth to the person who lived through it. */
export interface WhatAFightTaught {
    /** The band the distance fell in. */
    band: RegardBand;
    /** Rungs between them, learner minus opponent. Negative when they were above. */
    gap: number;
    /** What the band was worth, against 1. Zero means the fight taught nothing. */
    weight: number;
    /**
     * Chance this fight formed or deepened a comprehension. THE CALLER ROLLS,
     * on its own stream. Zero when there was nothing to comprehend.
     */
    comprehensionChance: number;
    /**
     * What the comprehension would be about, or null when there is none to be
     * had - no art, or no resistance.
     */
    about: { domain: InsightDomain; subject: string } | null;
    /** Qi-units toward the current rung. The caller applies it. */
    progress: number;
    /** Why it reads this way. Engine-authored fact, never narration. */
    why: string;
}

/**
 * What one side of one fight taught the person who lived through it.
 *
 * Pure, draws nothing, and returns zero for the ordinary case of a strong
 * cultivator putting down somebody who could not touch them.
 */
export function whatAFightTaught(fight: AFightThatHappened): WhatAFightTaught {
    const gap = Math.floor(fight.yourOrdinal) - Math.floor(fight.theirOrdinal);
    const band = bandForGap(gap);
    const weight = FIGHT_TEACHING_BY_BAND[band];

    const nothing = (why: string): WhatAFightTaught => ({
        band, gap, weight: 0, comprehensionChance: 0, about: null, progress: 0, why
    });

    if (fight.exchanges <= 0) {
        return nothing('Nothing was exchanged, so there was nothing to learn from.');
    }
    if (TAUGHT_NOTHING.includes(fight.outcome)) {
        return nothing(
            `The gap ended it before anything was contested (${fight.outcome}), and an `
            + 'uncontested encounter teaches nobody anything.'
        );
    }
    if (weight <= 0) {
        return nothing(
            `${gap} rungs below reads as ${band}: there was no resistance in it, so there was `
            + 'nothing in it to understand. Beating somebody who cannot reach you is practice '
            + 'against a post.'
        );
    }

    // ── WHAT IT TAUGHT ABOUT THE ART ─────────────────────────────────────
    // The art actually used, and nothing else. Somebody who fought bare-handed
    // learned about fighting and not about the sword they left at home.
    const about = fight.subject === null
        ? null
        : { domain: domainForSubject(fight.subject), subject: fight.subject };
    const comprehensionChance = about === null ? 0 : FIGHT_INSIGHT_CHANCE * weight;

    // ── AND WHAT IT WAS WORTH IN RAW ACCUMULATION ────────────────────────
    const required = progressRequiredForOrdinal(Math.floor(fight.yourOrdinal));
    const ceiling = required === null ? 0 : required * FIGHT_CARRIES_AT_MOST;
    const already = Math.max(0, fight.cultivationProgress);
    const room = Math.max(0, ceiling - already);
    const progress = required === null
        ? 0
        : Math.min(room, required * FIGHT_PROGRESS_SHARE * weight);

    return {
        band,
        gap,
        weight,
        comprehensionChance,
        about,
        progress,
        why:
            `${gap === 0 ? 'At your own rung' : gap < 0 ? `${-gap} rungs above you` : `${gap} rungs below you`}`
            + `, which reads as ${band} and is worth ${weight} times an ordinary fight. `
            + (about === null
                ? 'Fought bare, so there is no art in it to comprehend. '
                : `Comprehension of ${about.subject} advances on a ${(comprehensionChance * 100).toFixed(1)}% chance. `)
            + (required === null
                ? 'There is no rung above to accumulate toward.'
                : room <= 0
                    ? `Accumulation gained nothing: this rung is already past `
                      + `${(FIGHT_CARRIES_AT_MOST * 100).toFixed(0)}% and fighting carries nobody further than that.`
                    : `${progress.toFixed(1)} qi toward the rung, which fighting can carry to `
                      + `${(FIGHT_CARRIES_AT_MOST * 100).toFixed(0)}% of it and no further.`)
    };
}

/**
 * How many qualifying fights it would take to carry one rung, if fighting could
 * carry a whole one - which it cannot.
 *
 * Reported rather than used: it is the number the design decision is actually
 * about, and it exists so a probe or a test can state it instead of
 * re-deriving it from two constants and getting it wrong.
 */
export function fightsToCarryARung(band: RegardBand = 'matched'): number {
    const weight = FIGHT_TEACHING_BY_BAND[band];
    if (weight <= 0) return Infinity;
    return 1 / (FIGHT_PROGRESS_SHARE * weight);
}

/**
 * How many qualifying fights fighting will actually pay for, before
 * `FIGHT_CARRIES_AT_MOST` stops paying.
 *
 * From an empty rung. The remainder of every rung, at every rung, has to be
 * cultivated, which is the whole of the ceiling.
 */
export function fightsBeforeTheRungStopsPaying(band: RegardBand = 'matched'): number {
    return fightsToCarryARung(band) * FIGHT_CARRIES_AT_MOST;
}
