/**
 * What nights spent outdoors cost a body below Foundation Establishment.
 *
 * The owner's ruling: below Foundation, a night outdoors costs body HP, which is
 * what makes an inn, a room or a paid seat worth having. Foundation and above
 * take nothing from weather.
 *
 * Each night is drawn on its own stream (`a-night-in-the-open`, keyed on the
 * run day), so adding nights shifts no other draw. A night is fair, raw or foul;
 * winter and hard country (a province with glacier, high peak or desert ground)
 * make the worse nights likelier.
 *
 * Weather wears a body down and does not kill it: exposure alone stops at
 * {@link EXPOSURE_FLOOR_FRACTION} of the maximum. Wounds and hunger still kill.
 * The floor is the default pending the owner.
 *
 * PURE. The caller says which nights were outdoors and what the weather reads.
 */

import { forStream } from './rng.js';
import { FOUNDATION_ORDINAL } from './realms.js';

/** Exposure alone never takes a body below this share of its maximum HP. */
export const EXPOSURE_FLOOR_FRACTION = 0.25;

type TheNight = 'fair' | 'raw' | 'foul';

/** Share of maximum HP one night takes. */
const WHAT_A_NIGHT_TAKES: Readonly<Record<TheNight, number>> = {
    fair: 0,
    raw: 0.02,
    foul: 0.05
};

/**
 * Cumulative odds of a fair night, then of a fair-or-raw one, by how hard the
 * weather is: 0 ordinary, 1 winter or hard country, 2 both.
 */
const THE_ODDS_OF_A_NIGHT: readonly (readonly [number, number])[] = [
    [0.5, 0.9],
    [0.3, 0.75],
    [0.15, 0.55]
];

export interface NightsInTheOpen {
    /** Run days, one per night spent outdoors. */
    nights: readonly number[];
    seed: string;
    realmOrdinal: number;
    hp: number;
    maxHp: number;
    hardCountry: boolean;
    isWinter: (day: number) => boolean;
}

export interface WhatTheNightsCost {
    nights: number;
    rawNights: number;
    foulNights: number;
    /** HP actually taken, after the floor. */
    taken: number;
    hpAfter: number;
    /** True when the floor is what stopped it. */
    heldAtTheFloor: boolean;
}

/** HP below which exposure takes nothing more. */
export function theExposureFloor(maxHp: number): number {
    return Math.ceil(maxHp * EXPOSURE_FLOOR_FRACTION);
}

/**
 * What these nights outdoors cost, or nothing at Foundation Establishment and above.
 */
export function whatTheNightsInTheOpenCost(input: NightsInTheOpen): WhatTheNightsCost {
    const hp = Math.max(0, Math.floor(input.hp));
    const untouched: WhatTheNightsCost = {
        nights: input.nights.length, rawNights: 0, foulNights: 0, taken: 0, hpAfter: hp, heldAtTheFloor: false
    };
    if (input.realmOrdinal >= FOUNDATION_ORDINAL || input.nights.length === 0 || input.maxHp <= 0) {
        return untouched;
    }

    let share = 0;
    let rawNights = 0;
    let foulNights = 0;
    for (const day of input.nights) {
        const hardness = Math.min(2, (input.hardCountry ? 1 : 0) + (input.isWinter(day) ? 1 : 0));
        const [fair, rawOrBetter] = THE_ODDS_OF_A_NIGHT[hardness]!;
        const roll = forStream(input.seed, 'a-night-in-the-open', day).next();
        const night: TheNight = roll < fair ? 'fair' : roll < rawOrBetter ? 'raw' : 'foul';
        if (night === 'raw') rawNights++;
        if (night === 'foul') foulNights++;
        share += WHAT_A_NIGHT_TAKES[night];
    }

    const cost = Math.round(share * input.maxHp);
    const room = Math.max(0, hp - theExposureFloor(input.maxHp));
    const taken = Math.min(cost, room);
    return {
        nights: input.nights.length,
        rawNights,
        foulNights,
        taken,
        hpAfter: hp - taken,
        heldAtTheFloor: cost > room
    };
}
