/**
 * What a fight teaches, and what it does not.
 */

import type { Element, InsightDomain } from '../../schema/cultivation.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { bandForGap } from './regard.js';
import { progressRequiredForOrdinal } from './realms.js';
import { domainForSubject } from './understanding.js';
import type { ConfrontationOutcome } from './combat.js';

// THE RATE, AND THE CEILING

/**
 * Chance one qualifying fight forms or deepens a comprehension of the art it was
 * fought with, against an opponent at your own height.
 */
export const FIGHT_INSIGHT_CHANCE = 0.02;

/**
 * Share of the CURRENT rung's requirement one qualifying fight is worth in raw
 * accumulation, against an opponent at your own height.
 */
export const FIGHT_PROGRESS_SHARE = 0.002;

/**
 * How far into a rung fighting can carry somebody, and no further.
 */
export const FIGHT_CARRIES_AT_MOST = 0.6;

/**
 * What each band of distance is worth, against 1 at `matched`.
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
 */
const TAUGHT_NOTHING: readonly ConfrontationOutcome[] = Object.freeze(['no_contest']);

// THE READING

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

    // WHAT IT TAUGHT ABOUT THE ART
    // The art actually used, and nothing else. Somebody who fought bare-handed
    // learned about fighting and not about the sword they left at home.
    const about = fight.subject === null
        ? null
        : { domain: domainForSubject(fight.subject), subject: fight.subject };
    const comprehensionChance = about === null ? 0 : FIGHT_INSIGHT_CHANCE * weight;

    // AND WHAT IT WAS WORTH IN RAW ACCUMULATION
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
 */
export function fightsToCarryARung(band: RegardBand = 'matched'): number {
    const weight = FIGHT_TEACHING_BY_BAND[band];
    if (weight <= 0) return Infinity;
    return 1 / (FIGHT_PROGRESS_SHARE * weight);
}

/**
 * How many qualifying fights fighting will actually pay for, before
 * `FIGHT_CARRIES_AT_MOST` stops paying.
 */
export function fightsBeforeTheRungStopsPaying(band: RegardBand = 'matched'): number {
    return fightsToCarryARung(band) * FIGHT_CARRIES_AT_MOST;
}
