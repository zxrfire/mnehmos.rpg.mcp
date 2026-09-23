/**
 * WHETHER THE WORK HOLDS, AND WHAT COMES OFF THE BENCH WHEN IT DOES.
 *
 * One making path for every pair of hands: a player at their own bench and a
 * maker finishing somebody's commission both come here, so the odds a furnace
 * adds to and the thing that is minted cannot differ by who is holding the
 * hammer.
 *
 * ── THE ODDS ─────────────────────────────────────────────────────────────
 *
 * A made thing had no roll, and a refining furnace had nothing to add to. The
 * two failures already ruled for made things are a pill, which burns its
 * ingredients when the cauldron does not hold, and a hull, which can fail on
 * the slipway (`successRateFor`). A worked artifact is read off the second: it
 * is as hard to bring off as the easiest hull of its grade, at the same margin
 * per rung, and the furnace it is worked at adds `whatThisVesselAddsFor` on
 * top. No figure is chosen here; the base is the yard's own.
 *
 * A SLIP IS NOT ROLLED. Nobody has ruled that paper can fail, and a talisman is
 * cut wherever the cutter sits rather than at a furnace.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { CONVEYANCE_RECIPES } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { theVesselFor, whatThisVesselAddsFor } from '../cultivation/what-you-refine-in.js';
import { successRateFor } from '../world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import {
    cutATalisman,
    whatWasFoldedIn
} from '../world/a-talisman-is-one-act-somebody-already-paid-for.js';
import { howMuchAGradeIsWorthTracking, makeObject, type ObjectRecord } from '../world/possessions.js';
import type { WhatYouAskedThemToMake } from './commissioning-a-craft.js';

/** The ceiling the yard holds its own odds to, read rather than restated. */
function theBestOddsAnyWorkHas(): number {
    return successRateFor({ ...CONVEYANCE_RECIPES[0]!, baseSuccessRate: 1 }, Number.MAX_SAFE_INTEGER);
}

export interface TheOddsOfTheWork {
    /** False for a slip, which is not rolled. */
    rolled: boolean;
    /** 0..1. One where nothing is rolled. */
    chance: number;
    /** The yard's figure for a hand at this rung, before the vessel. */
    base: number;
    /** What the vessel added, zero where there was none or it did not answer. */
    fromTheVessel: number;
}

/**
 * The odds a made thing of this grade comes off this hand whole.
 *
 * `vessel` is the grade of the refining furnace they are working at, or null for
 * whatever the room has, which adds nothing: the yard's figure was written
 * without one.
 */
export function theOddsTheWorkHolds(
    ask: Pick<WhatYouAskedThemToMake, 'grade' | 'slip'>,
    makerOrdinal: number,
    vessel: TechniqueGrade | null
): TheOddsOfTheWork {
    if (ask.slip) return { rolled: false, chance: 1, base: 1, fromTheVessel: 0 };
    const hulls = CONVEYANCE_RECIPES.filter(recipe => recipe.grade === ask.grade);
    const base = hulls.length === 0
        ? 0
        : Math.max(...hulls.map(recipe => successRateFor(recipe, makerOrdinal)));
    const fromTheVessel = vessel === null
        ? 0
        : whatThisVesselAddsFor(theVesselFor('an_artifact').kind, vessel, makerOrdinal);
    return {
        rolled: true,
        chance: Math.min(theBestOddsAnyWorkHas(), base + fromTheVessel),
        base,
        fromTheVessel
    };
}

/**
 * The thing, minted and nobody's yet: the caller hands it to whoever it is for.
 *
 * A slip is cut; anything else is an artifact at the significance its grade
 * earns, standing at the rung of the hand that made it.
 */
export function mintAMadeThing(input: {
    id: string;
    ask: WhatYouAskedThemToMake;
    maker: { id: string; name: string; ordinal: number };
    onDay: number;
}): ObjectRecord {
    const { ask, maker } = input;
    if (ask.slip) {
        return cutATalisman({
            id: input.id,
            name: ask.named,
            grade: ask.grade,
            what: ask.slip,
            crafterId: maker.id,
            crafterName: maker.name,
            crafterOrdinal: maker.ordinal,
            onDay: input.onDay
        });
    }
    return makeObject({
        id: input.id,
        name: ask.named,
        kind: 'artifact',
        significance: howMuchAGradeIsWorthTracking(ask.grade),
        description: `${ask.grade}-grade work, made by ${maker.name}.`,
        power: whatWasFoldedIn(maker.ordinal),
        tags: ['made', `grade:${ask.grade}`]
    });
}
