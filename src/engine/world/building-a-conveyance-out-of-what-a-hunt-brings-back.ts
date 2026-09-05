/**
 * Building a hull, a carriage or a saddle out of what a hunting party brought home:
 * the bill of materials, who can do the work, how long it takes, and what a house
 * that ran out halfway is left holding.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { gradeRank } from '../../data/cultivation/techniques.js';
import { forStream } from '../cultivation/rng.js';
import { makeObject, type KeptAs, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import {
    canRefineGrade,
    refiningOrdinalFor,
    refiningRealmNameFor
} from '../cultivation/who-can-refine-a-grade-of-medicine.js';

// ─────────────────────────────────────────────────────────────────────────
// THE BILL
// ─────────────────────────────────────────────────────────────────────────

/**
 * One line of a bill of materials.
 */
export interface ComponentRequirement {
    /** What the wright asks for, in the words they use at the yard. */
    wants: string;
    grade: TechniqueGrade;
    count: number;
    /**
     * True where only condensed cultivation will do. `BeastMaterial.core`.
     * The one line in any bill that more of something else cannot satisfy.
     */
    mustBeCore: boolean;
}

export interface ConveyanceRecipe {
    id: string;
    name: string;
    producesConveyanceId: string;
    /** What the finished thing is made of, which decides everything else. */
    grade: TechniqueGrade;
    components: readonly ComponentRequirement[];
    /**
     * Days of work by one pair of hands that clears the rung. Not elapsed days
     * for a house: a yard with four qualified wrights divides this, and a house
     * with one does not.
     */
    workDays: number;
    /** Before the crafter's margin over the rung is applied. */
    baseSuccessRate: number;
}

/**
 * Which of the two stored tiers a conveyance of this grade is in.
 */
export function conveyanceKeptAs(grade: TechniqueGrade): KeptAs {
    return refiningOrdinalFor(grade) >= refiningOrdinalFor('heaven') ? 'tracked' : 'counted';
}

/**
 * What a conveyance of this grade is stamped as when it becomes a row.
 */
export function significanceForConveyance(grade: TechniqueGrade): ObjectSignificance {
    return conveyanceKeptAs(grade) === 'tracked' ? 'significant' : 'mundane';
}

/**
 * The rung a wright must have reached to work this at all.
 */
export function requiredOrdinalForRecipe(recipe: ConveyanceRecipe): number {
    return refiningOrdinalFor(recipe.grade);
}

/** Total pieces a bill asks for, cores included. */
export function totalComponentsRequired(recipe: ConveyanceRecipe): number {
    return recipe.components.reduce((n, c) => n + Math.max(0, Math.floor(c.count)), 0);
}

/** Cores a bill asks for. The line a house cannot buy its way past cheaply. */
export function coresRequired(recipe: ConveyanceRecipe): number {
    return recipe.components
        .filter(c => c.mustBeCore)
        .reduce((n, c) => n + Math.max(0, Math.floor(c.count)), 0);
}

// THE SLIP

/** Material on hand, in the only three fields the bill reads. */
export interface MaterialLot {
    /** For reporting what was spent. Never matched against. */
    id: string;
    grade: TechniqueGrade;
    core: boolean;
    count: number;
}

/** A half-built thing on the stocks. */
export interface Berth {
    recipeId: string;
    /** Delivered so far, parallel to `recipe.components`. */
    delivered: readonly number[];
    /** Work put in by qualified hands. Cannot outrun the materials. */
    workDaysDone: number;
    /** What was consumed, by lot id, for the ledger and for the argument. */
    spent: Readonly<Record<string, number>>;
}

export function layDownKeel(recipe: ConveyanceRecipe): Berth {
    return {
        recipeId: recipe.id,
        delivered: recipe.components.map(() => 0),
        workDaysDone: 0,
        spent: {}
    };
}

// THE ONE LADDER, IMPORTED RATHER THAN RETYPED. This held a private copy of the
// grade order and ranked on its index, which is exactly the drift a second copy
// produces: `gradeRank` now ties immortal and chaos - they are peers in power - and
// the local copy went on believing chaos outranked immortal.
const gradeIndex = gradeRank;

/**
 * Whether a lot satisfies a line.
 */
export function lotSatisfies(lot: MaterialLot, line: ComponentRequirement): boolean {
    if (line.mustBeCore && !lot.core) return false;
    return gradeIndex(lot.grade) >= gradeIndex(line.grade);
}

/**
 * Put materials on the slip.
 */
export function deliver(
    berth: Berth,
    recipe: ConveyanceRecipe,
    lots: readonly MaterialLot[]
): Berth {
    const delivered = berth.delivered.slice();
    const spent: Record<string, number> = { ...berth.spent };
    const remaining = lots.map(l => ({ ...l, count: Math.max(0, Math.floor(l.count)) }));

    const order = recipe.components
        .map((line, index) => ({ line, index }))
        .sort((a, b) =>
            Number(b.line.mustBeCore) - Number(a.line.mustBeCore)
            || gradeIndex(b.line.grade) - gradeIndex(a.line.grade)
            || a.index - b.index
        );

    for (const { line, index } of order) {
        let short = Math.max(0, Math.floor(line.count) - delivered[index]);
        if (short === 0) continue;
        // Cheapest adequate lot first, so a heaven core is not poured into a
        // mortal line while a mortal hide is standing in the yard.
        const usable = remaining
            .map((lot, i) => ({ lot, i }))
            .filter(({ lot }) => lot.count > 0 && lotSatisfies(lot, line))
            .sort((a, b) =>
                Number(a.lot.core) - Number(b.lot.core)
                || gradeIndex(a.lot.grade) - gradeIndex(b.lot.grade)
                || (a.lot.id < b.lot.id ? -1 : 1)
            );
        for (const { lot, i } of usable) {
            if (short === 0) break;
            const take = Math.min(short, lot.count);
            remaining[i] = { ...remaining[i], count: remaining[i].count - take };
            delivered[index] += take;
            spent[lot.id] = (spent[lot.id] ?? 0) + take;
            short -= take;
        }
    }

    return { ...berth, delivered, spent };
}

export interface Shortfall {
    line: ComponentRequirement;
    delivered: number;
    short: number;
}

/** What is still missing, line by line. Empty means the slip is stocked. */
export function whatIsStillShort(berth: Berth, recipe: ConveyanceRecipe): Shortfall[] {
    return recipe.components
        .map((line, index) => ({
            line,
            delivered: berth.delivered[index] ?? 0,
            short: Math.max(0, Math.floor(line.count) - (berth.delivered[index] ?? 0))
        }))
        .filter(s => s.short > 0);
}

/** Fraction of the bill on the slip, 0..1, by piece count rather than by line. */
export function fractionStocked(berth: Berth, recipe: ConveyanceRecipe): number {
    const need = totalComponentsRequired(recipe);
    if (need === 0) return 1;
    const have = recipe.components.reduce(
        (n, line, i) => n + Math.min(Math.floor(line.count), berth.delivered[i] ?? 0),
        0
    );
    return Math.max(0, Math.min(1, have / need));
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Days of work the slip will accept given what has been delivered.
 */
export function workDaysAllowedSoFar(berth: Berth, recipe: ConveyanceRecipe): number {
    return Math.floor(recipe.workDays * fractionStocked(berth, recipe));
}

export interface WorkResult {
    berth: Berth;
    /** Days actually absorbed. Less than asked for when the slip is starved. */
    daysWorked: number;
    /** Null where the hands could work. Names the cause where they could not. */
    stoppedBecause: string | null;
}

/**
 * Put hands on it.
 */
export function workOn(
    berth: Berth,
    recipe: ConveyanceRecipe,
    input: { days: number; hands: readonly number[] }
): WorkResult {
    const qualified = input.hands.filter(o => canRefineGrade(recipe.grade, o)).length;
    if (qualified === 0) {
        return {
            berth,
            daysWorked: 0,
            stoppedBecause: `Nobody in the yard can work ${recipe.grade}-grade material. It wants `
                + `${refiningRealmNameFor(recipe.grade)} or better, and below that the pieces do `
                + 'not answer the hand holding them.'
        };
    }
    const ceiling = workDaysAllowedSoFar(berth, recipe);
    const room = Math.max(0, ceiling - berth.workDaysDone);
    if (room === 0) {
        const short = whatIsStillShort(berth, recipe);
        return {
            berth,
            daysWorked: 0,
            stoppedBecause: short.length === 0
                ? 'It is finished as far as work goes. What is left is the launching.'
                : 'The hands have gone as far as the materials reach. '
                    + short.map(s => `${s.short} short of ${s.line.wants}`).join(', ') + '.'
        };
    }
    const asked = Math.max(0, Math.floor(input.days)) * qualified;
    const daysWorked = Math.min(asked, room);
    return {
        berth: { ...berth, workDaysDone: berth.workDaysDone + daysWorked },
        daysWorked,
        stoppedBecause: daysWorked < asked
            ? 'The work ran out before the days did, and what stopped it is the bill.'
            : null
    };
}

/** Whether everything is on the slip and every day of work is in it. */
export function readyToLaunch(berth: Berth, recipe: ConveyanceRecipe): boolean {
    return whatIsStillShort(berth, recipe).length === 0
        && berth.workDaysDone >= recipe.workDays;
}

// ─────────────────────────────────────────────────────────────────────────
// THE LAUNCH
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much a wright's margin over the required rung is worth, per rung.
 */
export const MARGIN_PER_RUNG = 0.02;

/** The odds, before anything is rolled, so a house can be told them. */
export function successRateFor(recipe: ConveyanceRecipe, bestHandOrdinal: number): number {
    if (!canRefineGrade(recipe.grade, bestHandOrdinal)) return 0;
    const margin = bestHandOrdinal - requiredOrdinalForRecipe(recipe);
    const rate = recipe.baseSuccessRate + margin * MARGIN_PER_RUNG;
    return Math.max(0, Math.min(0.98, rate));
}

export interface LaunchOutcome {
    recipeId: string;
    launched: boolean;
    roll: number;
    rate: number;
    /** Materials consumed either way. A failed hull is not a refund. */
    spent: Readonly<Record<string, number>>;
    /**
     * The rung the finished thing is rated at, or null where the recipe
     * produces a counted thing and there is nothing to rate.
     */
    ratedAt: number | null;
    narrationHint: string;
}

/**
 * The rung a finished craft carries, or null where it carries none.
 */
export function ratedOrdinalFor(recipe: ConveyanceRecipe, bestHandOrdinal: number): number | null {
    if (conveyanceKeptAs(recipe.grade) === 'counted') return null;
    return Math.max(refiningOrdinalFor('heaven'), Math.floor(bestHandOrdinal));
}

/**
 * Mint the object a successful heaven-grade launch produces.
 */
export function mintCraft(
    recipe: ConveyanceRecipe,
    input: {
        id: string;
        name: string;
        ownerId: string;
        ownerName: string;
        wrightId: string;
        wrightName: string;
        bestHandOrdinal: number;
        onDay: number;
        mooredAt: string;
        description?: string;
    }
): ObjectRecord | null {
    const power = ratedOrdinalFor(recipe, input.bestHandOrdinal);
    if (power === null) return null;
    const record = makeObject({
        id: input.id,
        name: input.name,
        kind: 'artifact',
        significance: significanceForConveyance(recipe.grade),
        power,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        // Moored, never carried. A craft with a possessor is a craft
        // `bestObjectHeldBy` in `gatherings.ts` would arm somebody with.
        possessorId: null,
        locationId: null,
        description: input.description ?? '',
        data: {
            conveyanceId: recipe.producesConveyanceId,
            mooredAt: input.mooredAt,
            builtYearsAgo: 0,
            builtOnDay: input.onDay
        },
        tags: ['conveyance', 'moored', 'own-build']
    });
    record.provenance.push({
        onDay: input.onDay,
        holderId: input.ownerId,
        holderName: input.ownerName,
        how: 'crafted',
        source: `${input.wrightName}'s yard`,
        previousHolderId: null,
        previousHolderName: null,
        factId: null,
        note: `Built by ${input.wrightName} at ordinal ${input.bestHandOrdinal}, out of `
            + `${totalComponentsRequired(recipe)} pieces and ${coresRequired(recipe)} core`
            + `${coresRequired(recipe) === 1 ? '' : 's'}, over ${recipe.workDays} days of work.`
    });
    // Whoever built it can say where it came from, which is the whole of what
    // a clean chain buys and is the ordinary write of the fourth layer.
    record.knownOwnershipBy = [input.ownerId, input.wrightId].filter(
        (id, i, all) => all.indexOf(id) === i
    ).sort();
    return record;
}

/**
 * Resolve it, once, from a seed.
 */
export function launch(
    runSeed: string,
    berth: Berth,
    recipe: ConveyanceRecipe,
    bestHandOrdinal: number
): LaunchOutcome {
    const rate = successRateFor(recipe, bestHandOrdinal);
    const ready = readyToLaunch(berth, recipe);
    if (!ready) {
        return {
            recipeId: recipe.id,
            launched: false,
            roll: 1,
            rate,
            spent: berth.spent,
            ratedAt: null,
            narrationHint: 'It is not finished. Nothing was attempted and nothing was lost, '
                + 'which is the one mercy in the whole business.'
        };
    }
    const rng = forStream(runSeed, 'conveyance-launch', recipe.id, String(bestHandOrdinal));
    const roll = rng.next();
    const launched = roll < rate;
    return {
        recipeId: recipe.id,
        launched,
        roll,
        rate,
        spent: berth.spent,
        ratedAt: launched ? ratedOrdinalFor(recipe, bestHandOrdinal) : null,
        narrationHint: launched
            ? 'It holds. Everything that went into it is now one thing and the yard is empty.'
            : 'It does not hold, and it does not half hold. Every piece that went in went in, '
                + 'and there is nothing on the slip worth the wood it is lying on.'
    };
}
