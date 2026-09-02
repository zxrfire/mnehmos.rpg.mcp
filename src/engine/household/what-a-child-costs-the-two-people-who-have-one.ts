/**
 * What a child costs the two people who have one, and what the child is.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NO NEW CLOCK, NO NEW CONSTANT, AND NO SECOND MODEL OF WHAT A CHILD IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The far end of this is entirely built. `engine/birth/birth.ts` decides what
 * a child of a given family IS - `RaisedInside`, `onTheRoll`, `stillToClear`,
 * where the life opens, whose roll carries them - and
 * `spending-a-word-to-place-a-child.ts` decides what it costs to place them.
 * A child of a match must enter through that path and not a parallel one, so
 * nothing here writes a birth, a placement, or a rung.
 *
 * WHAT WAS MISSING IS THE NEAR END: two people deciding to have one, when, and
 * what the years cost them. That is this file, and it is three answers.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE COST IS YEARS, AND THE YEARS ARE ALREADY THE THING THIS GAME CHARGES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no penalty here and there must not be one. A decade spent raising
 * somebody is a decade not spent cultivating, and the time-skip primitive
 * already charges for time the same way for every use of it. What this module
 * adds is the honest reading of what that stretch IS to each parent, and it is
 * the ratio the ladder already carries:
 *
 *     the years / `lifespanForOrdinal(their rung)`
 *
 * Nothing is authored. The consequence is sharp and it was not designed in -
 * it is what the existing curve says. **The same twelve years are most of a
 * mortal-band life and a rounding error at the top of the ladder.** So houses
 * at height have generations and a thin-county family has one child who works,
 * and the reason is arithmetic that was already in `realms.ts`.
 *
 * That also makes the decision a real one in the middle of the ladder, which
 * is where almost everybody in this world is: `AGENTS.md`'s Late Age premise
 * is that most people stall, and somebody who has stalled is somebody for whom
 * a decade costs less than it would have. The verb is the decision. The engine
 * spends the time the way it spends time everywhere.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHOSE THE CHILD IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Read off exactly what `birth.ts` reads: `intakeRouteOf`, where a roster that
 * is a lineage is `'adoption'`, and a lineage is entered `by blood`. Two
 * lineages and the child is of both. Neither, and the child is on no roll and
 * stands at the same gate as somebody who walked up the mountain - which
 * `birth.ts` already says in as many words.
 *
 * The surname follows the roll and not the parent, because that is what the
 * catalog already says: `houseSurname` is the family, the family is what the
 * house is, and everybody on the roll carries it *"except somebody who married
 * in and declined to change"*. Where BOTH sides are lines the engine does not
 * decide - it says so, because two houses settling that between them is the
 * negotiation and not a default anybody should be able to read off a field.
 *
 * And what the child carries of a line is `bloodlineTierForChild`, called and
 * not copied. It reads both parents symmetrically and there is no dilution
 * constant anywhere in this repo.
 *
 * Pure. Rows in, an answer out.
 */

import { lifespanForOrdinal } from '../cultivation/realms.js';
import { CULTIVATION_BEGINS_AT_AGE } from '../cultivation/what-a-road-in-reach-costs-to-walk.js';
import { bloodlineTierForChild, type AbilityTier } from '../world/hunting-a-spirit-beast.js';
import { intakeRouteOf } from '../../data/cultivation/sects.js';
import type { APartyToAMatch } from './what-a-house-would-take-for-a-match.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The years before a child can be handed on to anybody.
 *
 * Not a new number. `CULTIVATION_BEGINS_AT_AGE` is the age at which a road can
 * be walked at all, so it is the age at which a child can be placed at a
 * house, taught, or sent anywhere - and the years before it are years somebody
 * has to be there for. Re-exported under the name this file's question uses so
 * a reader is not left wondering where twelve came from.
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
 *
 * `years` is the caller's, because the decision is the player's and the engine
 * prices it rather than choosing it. A stretch shorter than
 * {@link YEARS_BEFORE_A_CHILD_CAN_BE_PLACED} is not refused - it is reported
 * as what it is, which is a child somebody else finished raising.
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

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT THE CHILD IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whose roll a child of this match is born onto, and under what name.
 *
 * Everything here is derived. There is no branch on a faction id anywhere and
 * there must not be one - `birth.ts`'s third contract rule - so a catalog
 * change that made a house a lineage would move this with it.
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
     *
     * Null in two cases and they are not the same case: no line on either
     * side, where there is no house name to carry; and a line on both, where
     * the two houses settle it and {@link bothSidesAreLines} says so.
     */
    theNameTheyCarry: string | null;
    /** True when both parents are on lineage rolls and the name is negotiated. */
    bothSidesAreLines: boolean;
    /**
     * What they carry of a line, from `bloodlineTierForChild`, unchanged.
     *
     * Symmetric in the two parents by construction, and it steps down where
     * only one of them carries it. Three generations of that and there is
     * nothing left to show anybody.
     */
    theLineTheyCarry: AbilityTier | null;
    /**
     * True when the line steps down at this generation.
     *
     * Not a new fact - a comparison of the existing function's answer against
     * the better of what the parents hold - and it is what a house is looking
     * at when it approves or refuses a match.
     */
    theLineStepsDownHere: boolean;
    note: string;
}

/**
 * What a child of these two parents is, before anybody has done anything.
 *
 * No rung, no progress and no rank. `birth.ts`'s first contract rule is that
 * an origin buys inputs and never rank, and a child of a match is subject to
 * it exactly as a child of anything else is.
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
