/**
 * How crowded the ground under this cultivator is, said in numbers a player can act on.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Crowding is the strongest environmental lever in the game and the player
 * could not see it, ask about it, or act on it.
 *
 * Measured by a playtester across five places with the same character and the
 * same manual: 0.171 qi-units a day at the emptiest, 0.763 at the busiest. A
 * 4.5x spread - LARGER THAN THE ENTIRE THIN-TO-NORMAL AMBIENT BAND RANGE - and
 * `thin` ground with nobody on it beat `normal` ground with a crowd on it by
 * 2.7x. It decides whether the Foundation wall is passable at all: 38 years of
 * sitting on empty ground against 87 to 165 on crowded ground, measured against
 * a hundred-year lifespan.
 *
 * The engine knew it exactly and never said it. Its own encounter line reads
 * "Sweptground comfortably carries 3 cultivators and currently holds 9"; the
 * character sheet said `Ambient qi: THIN` and nothing whatever about who else
 * was standing there. So the highest-value decision available to a player was
 * invisible, and the run that found it died at the Foundation wall while its
 * player did the right thing repeatedly in the wrong place.
 *
 * ── This module states, it does not decide ───────────────────────────────
 *
 * Every number here comes from `engine/cultivation/cultivation.ts` -
 * `carryingCapacityFor`, `qiDrawOf`, `crowdingMultiplier` - which is the same
 * arithmetic the rate itself is computed from. Nothing is recomputed and no
 * threshold is invented, for the reason the ambient band already learned the
 * hard way: a second table beside the first is a disagreement waiting to
 * happen, and the player is the one who finds it.
 *
 * ── Draw, not heads, and BOTH are reported ───────────────────────────────
 *
 * The engine measures occupancy in DRAW - a Nascent Soul cultivator does not
 * take what an outer disciple takes, and one Deity Transformation elder crowds
 * out sixteen mortals. That is the right model and it is not what a person
 * standing in a market counts. So both go out: the headcount because it is what
 * a player perceives, and the draw because it is what the engine acts on. Where
 * they disagree, the gap is the interesting fact - nine people who are mostly
 * elders are not nine people.
 */

import {
    carryingCapacityFor,
    crowdingMultiplier,
    groundIsBarren,
    qiDrawOf,
    BARREN_GROUND_CEILING
} from '../engine/cultivation/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';

export interface CrowdingRead {
    /** The place, as the player would name it. */
    placeName: string;
    /** Mortal-equivalent draws this ground carries comfortably. */
    supported: number;
    /** Mortal-equivalent draws actually on it, this cultivator included. */
    drawing: number;
    /** Bodies, which is a different number and is the one a player counts. */
    heads: number;
    /**
     * The share of the ground's qi actually available, 0..1.
     *
     * Exactly `crowdingMultiplier`, which is exactly what multiplies the rate.
     * 1 means the ground is not the thing in the way.
     */
    share: number;
    /** True when the ground is too poor to carry anybody past Qi Condensation. */
    barren: boolean;
    /** One sentence, engine-authored, for the sheet and for the answer. */
    line: string;
}

export interface CrowdingInput {
    placeName: string;
    /** USABLE qi here, 0..1 - the world layer's `spiritualDensity`. */
    density: number;
    /**
     * Realm ordinals of everyone drawing on this ground, this cultivator
     * INCLUDED. The same list `groundFor` hands the rate.
     */
    occupantOrdinals: readonly number[];
}

/**
 * The read. Null is not a case here - a caller with no world has no ground to
 * describe and should not call, rather than be handed zeroes that look measured.
 */
export function howCrowdedThisGroundIs(input: CrowdingInput): CrowdingRead {
    const ground = { density: input.density, occupantOrdinals: input.occupantOrdinals };
    const supported = carryingCapacityFor(input.density);
    const drawing = qiDrawOf(input.occupantOrdinals);
    const heads = input.occupantOrdinals.length;
    const share = crowdingMultiplier(ground);
    const barren = groundIsBarren(ground);

    return {
        placeName: input.placeName,
        supported,
        drawing: round1(drawing),
        heads,
        share,
        barren,
        line: sentenceFor(input.placeName, supported, drawing, heads, share, barren)
    };
}

/**
 * What a surveyor would write down.
 *
 * Three cases, and the middle one is the point: a place at capacity is not
 * "fine", it is one arrival away from costing everybody something, and a player
 * who is choosing where to spend forty years wants to know which side of the
 * line they are on before they sit down rather than after.
 *
 * The heads figure is quoted beside the draw whenever they disagree, because
 * "nine people" and "the draw of twenty-two" are different facts about the same
 * nine people and the gap is the whole reason draw is the model.
 */
function sentenceFor(
    place: string,
    supported: number,
    drawing: number,
    heads: number,
    share: number,
    barren: boolean
): string {
    const who = heads === 1
        ? 'nobody else is drawing on it'
        : `${heads} are drawing on it`;
    // Draw and heads coincide only when everybody present is a mortal-equivalent
    // draw of one, which is nobody above the bottom of the ladder.
    const draw = Math.abs(drawing - heads) < 0.05
        ? ''
        : ` - the draw of ${round1(drawing)}, because a high cultivator does not take what a low one takes`;

    const barrenNote = barren
        ? ` The ground itself is too poor to carry anybody past ${rankName(BARREN_GROUND_CEILING)}, `
          + 'however empty it gets.'
        : '';

    if (share >= 1) {
        return `${place} comfortably carries a draw of ${supported}, and ${who}${draw}. `
            + `Nothing here is being shared thin.${barrenNote}`;
    }

    const percent = Math.round(share * 100);
    return `${place} comfortably carries a draw of ${supported}, and ${who}${draw}. `
        + `Qi drawn by one is not available to another, so cultivation here runs at `
        + `${percent}% of what this ground would give somebody sitting on it alone.${barrenNote}`;
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}
