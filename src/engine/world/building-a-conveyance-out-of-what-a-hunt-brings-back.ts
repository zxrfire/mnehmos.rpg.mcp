/**
 * Building a hull, a carriage or a saddle out of what a hunting party brought
 * home: the bill of materials, who can do the work, how long it takes, and what
 * a house that ran out halfway is left holding.
 *
 * WHY THIS EXISTS, WHICH IS NOT "BOATS SHOULD BE CRAFTABLE"
 * --------------------------------------------------------
 * Until now a beast material had one destination. It went into a pill, or into
 * something somebody fights with, and that made the whole material economy a
 * single pipe: what a hunt brings back is either the one thing a recipe named
 * or it is worth its weight and nothing more. Craft gives materials a second
 * destination, and the second destination asks a different question of them,
 * which is the only reason it is not the first pipe wearing a hat.
 *
 * WHAT A HULL WANTS AND WHY IT IS NOT WHAT A CAULDRON WANTS
 * ---------------------------------------------------------
 * A cauldron asks for a NAMED thing and refuses a substitute. `recipes.ts`
 * keys every ingredient to a specific herb id, and a refinement missing the one
 * herb is a refinement that does not happen however much else is on the bench.
 * That makes alchemy an errand: find this, come back.
 *
 * A hull asks for a QUANTITY AT A GRADE and does not care which animal it came
 * off. What it needs is material that holds together under load for weeks at a
 * time, and there are a hundred ways to be that. So a bill of materials here
 * names a grade and a count, and any beast that yields at that grade satisfies
 * it - which makes building a schedule rather than an errand, makes a hunting
 * ground worth working rather than worth searching, and means a beast added to
 * the catalog next year is automatically useful to every shipwright in the
 * world without anybody editing a recipe.
 *
 * The one exception is the core, and it is an exception with a reason rather
 * than a flavour: a core is condensed cultivation and nothing else in the world
 * is. `beasts.ts` carries it as its own boolean for exactly that reason, and a
 * hull that has to stay up over open water needs one at its centre. That is the
 * single line in any bill that cannot be met by bringing more of something else.
 *
 * THE LOOP THIS CLOSES
 * --------------------
 * `BEAST_CORE_ORDINAL` is 17, so a Core Formation party can take a heaven-grade
 * core off an animal. `refiningOrdinalFor('heaven')` is 29, so only a Void
 * Refinement hand can work one. Those two numbers are already in the engine and
 * neither was written for this, and between them they produce the whole economy
 * without a rule: a poor house can hunt the material and cannot use it, so it
 * sells it; a rich house buys what it cannot spare the years to take. A house
 * that gets one craft gets its next one faster, because the craft carries the
 * party that takes the next core. A house with none hunts on foot and builds
 * slowly, and that is what decline looks like from the inside without anybody
 * having to narrate decline.
 *
 * WHY THIS IS NOT AN EXTENSION OF `RecipeSchema`
 * ----------------------------------------------
 * It was the first thing tried and it does not fit, in two places that are both
 * load-bearing rather than cosmetic. `RecipeSchema.producesPillId` is required
 * and the suite asserts it resolves to a real pill; a conveyance is not a pill
 * and half of what is built here is not an object at all. And
 * `ingredients: { itemId, quantity }` is the named-thing shape above, which is
 * precisely the shape a hull must not have. The vocabulary is deliberately kept
 * identical - `components`, `baseSuccessRate`, a required rung derived from the
 * grade - so the two read as siblings, and nothing about success, rungs or
 * grades is decided twice.
 *
 * PURE. State in, deltas out. No mutation of inputs. The one stochastic step
 * takes a seeded stream.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
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
 *
 * `wants` is what the wright is actually after and is said aloud; the gate is
 * `grade`, `count` and `mustBeCore`, all three of which are fields
 * `BEAST_MATERIALS` already carries. Nothing here reads a name.
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
    /** The `Conveyance.id` this produces. */
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
 *
 * ONE LINE, AND EVERYTHING ELSE READS IT. `ratedOrdinalFor` asks it whether
 * there is an ordinal to give, `significanceForConveyance` asks it what tier to
 * stamp, and `craft` in the catalog asks it whether a row may exist at all. The
 * defect this exists to prevent is the one where each of those three decides
 * separately and two of them are right: the rule was previously upheld by an
 * early return in one place and by authoring discipline in the other, which is
 * `docs/world/things/items.md`'s line ASSERTED rather than ENFORCED.
 *
 * The threshold is not a number written here. It is where `items.md` already
 * puts it - the grade at which the population that can make the thing stops
 * being large enough to restock it - and `refiningOrdinalFor` is the function
 * that knows where that is. Mortal and earth grade are made by enough hands
 * that nobody cares which carriage you took; heaven grade is a few dozen hands
 * in the world, so which one it is and how it got here is a question somebody
 * should be able to ask two centuries later.
 */
export function conveyanceKeptAs(grade: TechniqueGrade): KeptAs {
    return refiningOrdinalFor(grade) >= refiningOrdinalFor('heaven') ? 'tracked' : 'counted';
}

/**
 * What a conveyance of this grade is stamped as when it becomes a row.
 *
 * `mundane` is the counted tier and is what a drawn carriage is, forever. The
 * tracked tier's floor is `significant` rather than `notable` because a hull is
 * never an incidental object - but a caller may raise it within the tracked
 * tier, and `keptAs` is what stops anybody raising it ACROSS the line.
 */
export function significanceForConveyance(grade: TechniqueGrade): ObjectSignificance {
    return conveyanceKeptAs(grade) === 'tracked' ? 'significant' : 'mundane';
}

/**
 * The rung a wright must have reached to work this at all.
 *
 * Delegated, never restated. This is the same gate that decides who refines a
 * grade of medicine, for the same reason: what stops somebody is the materials
 * not answering the hand holding them, and a hull is made of the same four
 * grades a pill is. A second table here would be a second opinion about the
 * ladder, and it would drift.
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

// ─────────────────────────────────────────────────────────────────────────
// THE SLIP
//
// A build is a durable thing that outlives the day it started, because the
// interesting state is the middle: a house three bones short with a keel
// already laid has a situation, and a boolean has none.
// ─────────────────────────────────────────────────────────────────────────

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

const GRADE_ORDER: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

function gradeIndex(grade: TechniqueGrade): number {
    return GRADE_ORDER.indexOf(grade);
}

/**
 * Whether a lot satisfies a line.
 *
 * Grade may be MET OR EXCEEDED, and that is the one asymmetry against alchemy
 * worth stating: a recipe's ingredients sit below the pill they make and
 * substituting up is meaningless, whereas a hull only ever benefits from better
 * material in it. A core satisfies a non-core line and is a waste of a core;
 * nothing satisfies a core line but a core.
 */
export function lotSatisfies(lot: MaterialLot, line: ComponentRequirement): boolean {
    if (line.mustBeCore && !lot.core) return false;
    return gradeIndex(lot.grade) >= gradeIndex(line.grade);
}

/**
 * Put materials on the slip.
 *
 * Assignment is deliberate rather than greedy-by-arrival: the hardest lines are
 * filled first, so a core does not get spent on a line that a bone would have
 * met. Hardest is a core line before a plain one, then the higher grade, then
 * the line's own order in the bill, which keeps the result stable for the same
 * inputs in any order.
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
 *
 * Work cannot outrun the materials, which is the whole of what makes a
 * shortfall a situation rather than a delay: a house that is three cores short
 * does not carry on building and stop at the end, it stops now, with a yard
 * full of qualified hands and nothing for them to do.
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
 *
 * `hands` divides the work, and a house with nobody at the rung divides it by
 * zero hands and gets nowhere, which is the ordinary case for the good grades
 * and is why almost nothing at heaven grade is ever built.
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
 *
 * Small on purpose. What decides whether a hull holds together is overwhelmingly
 * whether it was built out of the right materials by somebody who could work
 * them at all, and standing four rungs clear of the bar is worth something
 * without being worth everything - a house sending its strongest elder to the
 * yard should improve its odds and should not be able to buy certainty with
 * rank, which is the shape every other gate in this engine keeps.
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
 *
 * THE GRADE DECIDES THE SIDE OF THE LINE AND NOTHING MOVES IT. Only a
 * heaven-grade recipe produces anything with an ordinal, because only at heaven
 * grade is the thing a tracked individual at all - below it there is no "which
 * one" to rate, permanently, and an earth-grade carriage does not become an
 * individual by being old, by being famous or by having survived something.
 *
 * Note what this reads and what it does not. It reads `recipe.grade`, never the
 * grade of what was fed in. Putting heaven-grade material into an earth-grade
 * carriage makes an earth-grade carriage; a build creates a new thing rather
 * than promoting anything, and nothing in this world is ever worth more than it
 * was made. The only grade movement that exists anywhere is `shardPower`, and
 * it goes down.
 *
 * Where there IS an ordinal it is the wright's own rung, because the best thing
 * that went into a hull was the hand that worked it. That is bounded below by
 * the bar the materials set and above by the wright, and nothing else touches it.
 */
export function ratedOrdinalFor(recipe: ConveyanceRecipe, bestHandOrdinal: number): number | null {
    if (conveyanceKeptAs(recipe.grade) === 'counted') return null;
    return Math.max(refiningOrdinalFor('heaven'), Math.floor(bestHandOrdinal));
}

/**
 * Mint the object a successful heaven-grade launch produces.
 *
 * A NEWLY BUILT CRAFT IS THE OPPOSITE OF EVERYTHING ELSE TRACKED IN THIS WORLD,
 * and that is worth having rather than smoothing over. `HOW_A_FORTY_FIVE_EXISTS`
 * in `artifacts.ts` is entirely about objects nobody can find a giver for: a
 * sent-down thing with a founder and a year, or a shard from a place where
 * something happened that everybody close enough to record was killed by. This
 * has a maker, a day and a witness, and its chain starts at link one with
 * nothing missing.
 *
 * So a house's own new hull and an inherited hull at the same rating are
 * identical in every number and are different objects socially, and the
 * difference is free: it is already in the provenance chain and nothing here
 * restates it. What the world does with that - who can be asked, what a clean
 * chain is worth at a counter, why a house says which of its craft it built -
 * is the possession layer's business and is already written.
 *
 * Returns null for a counted recipe, which mints nothing and increments a line.
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
 *
 * A failure consumes the materials and leaves the yard with nothing, which is
 * the honest price and is why a heaven-grade launch is an event a house
 * remembers. Nothing here decides what a house DOES about that; the debt, the
 * blame and whoever has to be told are the social layer's business.
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
