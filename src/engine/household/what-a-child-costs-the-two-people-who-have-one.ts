/**
 * What a child costs the two people who have one, and what the child is.
 */

import { lifespanForOrdinal } from '../cultivation/realms.js';
import { CULTIVATION_BEGINS_AT_AGE } from '../cultivation/what-a-road-in-reach-costs-to-walk.js';
import { bloodlineTierForChild, type AbilityTier } from '../world/hunting-a-spirit-beast.js';
import { intakeRouteOf } from '../../data/cultivation/sects.js';
import type { APartyToAMatch } from './what-a-house-would-take-for-a-match.js';

// WHAT IT COSTS

/**
 * The years before a child can be handed on to anybody.
 */
export const YEARS_BEFORE_A_CHILD_CAN_BE_PLACED = CULTIVATION_BEGINS_AT_AGE;

/** What a stretch of years is to one person, priced against their own span. */
export interface WhatTheYearsAreToThem {
    personId: string;
    years: number;
    /**
     * The fraction of a whole life at their rung. The entire price, and it is
     * `realms.ts`'s curve rather than anything decided here.
     */
    ofAWholeLifeAtTheirRung: number;
}

export interface WhatAChildCosts {
    /** One entry per parent. Different numbers for the same years, which is the point. */
    toEachOfThem: readonly [WhatTheYearsAreToThem, WhatTheYearsAreToThem];
    /** The years asked for, clamped to the floor below which nobody can be handed on. */
    years: number;
    /** True when the stretch is shorter than the child can be placed after. */
    shorterThanTheChildCanBeHandedOn: boolean;
    note: string;
}

/**
 * What a stretch of years spent on a child is to the two people spending it.
 * There is no penalty here and there must not be one - the time-skip primitive
 * already charges for time the same way for every use of it. What this adds is
 * the honest reading of what that stretch IS to each parent.
 */
export function whatAChildCosts(input: {
    one: APartyToAMatch;
    other: APartyToAMatch;
    years: number;
}): WhatAChildCosts {
    const years = Math.max(0, input.years);
    const short = years < YEARS_BEFORE_A_CHILD_CAN_BE_PLACED;

    const price = (who: APartyToAMatch): WhatTheYearsAreToThem => {
        const span = lifespanForOrdinal(who.reachesTo);
        return {
            personId: who.personId,
            years,
            ofAWholeLifeAtTheirRung: span > 0 ? years / span : 0
        };
    };

    const toEachOfThem: [WhatTheYearsAreToThem, WhatTheYearsAreToThem] =
        [price(input.one), price(input.other)];

    return {
        toEachOfThem,
        years,
        shorterThanTheChildCanBeHandedOn: short,
        note:
            `${years} years, which is ${asShare(toEachOfThem[0].ofAWholeLifeAtTheirRung)} of a `
            + `whole life at ${input.one.personId}'s rung and `
            + `${asShare(toEachOfThem[1].ofAWholeLifeAtTheirRung)} at ${input.other.personId}'s. `
            + (short
                ? `A child cannot be placed anywhere until ${YEARS_BEFORE_A_CHILD_CAN_BE_PLACED}, `
                  + 'so a shorter stretch than that means somebody else finished it.'
                : 'They are years nobody was cultivating in, and the engine charges for them the '
                  + 'way it charges for any other years.')
    };
}

function asShare(fraction: number): string {
    if (fraction <= 0) return 'none';
    if (fraction >= 1) return 'more than the whole';
    const pct = fraction * 100;
    return pct < 1 ? 'under a hundredth' : `about ${Math.round(pct)} in a hundred`;
}

// AND WHAT THE CHILD IS

/**
 * Whose roll a child of this match is born onto, and under what name. Everything
 * is derived: there is no branch on a faction id anywhere and there must not be
 * one - `birth.ts`'s third contract rule.
 */
export interface WhatTheChildIs {
    /**
     * Every house whose roll carries them from birth, and by what route.
     *
     * `'by blood'` in every case, because that is the only route a birth
     * takes: a ward is `'by taking'` and this is not one.
     */
    rolls: readonly { houseId: string; onTheRoll: 'by blood' }[];
    /**
     * Which house's name they carry, or null where the engine does not decide.
     */
    theNameTheyCarry: string | null;
    /** True when both parents are on lineage rolls and the name is negotiated. */
    bothSidesAreLines: boolean;
    /**
     * What they carry of a line, from `bloodlineTierForChild`, unchanged.
     */
    theLineTheyCarry: AbilityTier | null;
    /**
     * True when the line steps down at this generation.
     */
    theLineStepsDownHere: boolean;
    note: string;
}

/**
 * What a child of these two parents is, before anybody has done anything. No
 * rung, no progress and no rank: `birth.ts`'s first contract rule is that an
 * origin buys inputs and never rank, and a child of a match is subject to it
 * exactly as a child of anything else is.
 */
export function whatTheChildIs(input: {
    one: APartyToAMatch;
    other: APartyToAMatch;
    /**
     * The surname each house's roll carries, supplied by the caller off the
     * catalog. Absent for a house with no line name, which is most of them.
     */
    houseSurnames?: Readonly<Record<string, string>>;
}): WhatTheChildIs {
    const { one, other } = input;
    const surnames = input.houseSurnames ?? {};

    const lineHouses: string[] = [];
    for (const side of [one, other]) {
        if (side.houseId === null) continue;
        // The same read `birth.ts` makes: a roster that is a lineage is
        // `'adoption'`, and a lineage is entered by blood.
        if (intakeRouteOf(side.houseId) !== 'adoption') continue;
        if (side.onTheRoll !== 'by blood') continue;
        if (!lineHouses.includes(side.houseId)) lineHouses.push(side.houseId);
    }

    const theLineTheyCarry =
        bloodlineTierForChild(one.carriesTheLineAt, other.carriesTheLineAt);
    const held = betterOf(one.carriesTheLineAt, other.carriesTheLineAt);
    const theLineStepsDownHere = held !== null && theLineTheyCarry !== held;

    const bothSidesAreLines = lineHouses.length > 1;
    const theNameTheyCarry = lineHouses.length === 1
        ? surnames[lineHouses[0]] ?? null
        : null;

    return {
        rolls: lineHouses.map(houseId => ({ houseId, onTheRoll: 'by blood' as const })),
        theNameTheyCarry,
        bothSidesAreLines,
        theLineTheyCarry,
        theLineStepsDownHere,
        note:
            (lineHouses.length === 0
                ? 'On no house\'s roll. They stand at the same gate as somebody who walked up the '
                  + 'mountain.'
                : bothSidesAreLines
                    ? 'On both rolls, by blood, at no rank on either - and the name is the thing '
                      + 'the two houses have to settle, because each of them is a family before '
                      + 'it is an institution.'
                    : `On one roll, by blood, at no rank in it${theNameTheyCarry === null ? '' : `, carrying ${theNameTheyCarry}`}.`)
            + ' '
            + (theLineTheyCarry === null
                ? 'They carry no line.'
                : theLineStepsDownHere
                    ? `They carry the line at ${theLineTheyCarry}, which is a step down from what `
                      + 'their parents hold. Two more generations of that and the family will say '
                      + 'it has a thing and be unable to show anybody.'
                    : `They carry the line at ${theLineTheyCarry}, held rather than spent.`)
    };
}

const TIER_ORDER: readonly AbilityTier[] = ['latent', 'grown', 'final'];

function betterOf(a: AbilityTier | null, b: AbilityTier | null): AbilityTier | null {
    if (a === null) return b;
    if (b === null) return a;
    return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}
