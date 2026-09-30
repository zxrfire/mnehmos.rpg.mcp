/** A conveyance build persists across turns. Tracked materials are retired through ruin when delivered. */

import type Database from 'better-sqlite3';

import type { Cultivator } from '../schema/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    canRefineGrade,
    refiningRealmNameFor
} from '../engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import {
    conveyanceKeptAs,
    deliver,
    fractionStocked,
    launch,
    layDownKeel,
    mintCraft,
    readyToLaunch,
    requiredOrdinalForRecipe,
    successRateFor,
    totalComponentsRequired,
    whatIsStillShort,
    workDaysAllowedSoFar,
    workOn,
    type Berth,
    type ConveyanceRecipe,
    type MaterialLot
} from '../engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { ruin, type ObjectRecord } from '../engine/world/possessions.js';
import { theRowsThatGoWithAStack } from './stack-and-its-row.js';
import { howAMaterialIsStored } from '../engine/world/hunting-a-spirit-beast.js';
import { getBeastMaterial } from '../data/cultivation/beasts.js';
import {
    CONVEYANCE_RECIPES,
    getConveyanceRecipe,
    requireConveyance
} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {
    clearFlag,
    everythingInThePouch,
    readJsonFlag,
    removeFromPouch,
    writeFlag
} from '../server/consolidated/cultivation-support.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SLIP, BETWEEN TURNS
// ─────────────────────────────────────────────────────────────────────────

export const FLAG_ON_THE_STOCKS = 'craft_on_the_stocks';

/** A build in progress. The engine's `Berth` plus the day it was begun. */
export interface OnTheStocks extends Berth {
    startedOnDay: number;
}

/**
 * Days one pair of hands puts in before looking up.
 *
 * A cap on the TURN and never on the build. A player who names a span gets the
 * span they named; where nobody named one this is what is spent, and the number
 * is said out loud in the report, because an engine that substitutes a figure
 * and reports it back as the player's intention is telling them their own
 * intention. Same rule as `train`'s.
 */
export const DAYS_AT_THE_BENCH = 30;

export function readTheStocks(
    db: Database.Database,
    cultivatorId: string
): OnTheStocks | null {
    const held = readJsonFlag<OnTheStocks>(db, cultivatorId, FLAG_ON_THE_STOCKS);
    if (!held || typeof held.recipeId !== 'string' || !Array.isArray(held.delivered)) return null;
    if (!getConveyanceRecipe(held.recipeId)) return null;
    return {
        recipeId: held.recipeId,
        delivered: held.delivered.map(n => Math.max(0, Math.floor(Number(n) || 0))),
        workDaysDone: Math.max(0, Math.floor(Number(held.workDaysDone) || 0)),
        spent: held.spent ?? {},
        startedOnDay: Math.max(0, Math.floor(Number(held.startedOnDay) || 0))
    };
}

export function writeTheStocks(
    db: Database.Database,
    cultivatorId: string,
    stocks: OnTheStocks
): void {
    writeFlag(db, cultivatorId, FLAG_ON_THE_STOCKS, JSON.stringify(stocks));
}

export function clearTheStocks(db: Database.Database, cultivatorId: string): void {
    clearFlag(db, cultivatorId, FLAG_ON_THE_STOCKS);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS IN THE POUCH, AS THE BILL READS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The pouch as material lots.
 *
 * Tracked materials need their individual held rows as well as their pouch count.
 */
export function lotsInThePouch(
    db: Database.Database,
    cultivatorId: string,
    objects: readonly ObjectRecord[] = []
): MaterialLot[] {
    const lots: MaterialLot[] = [];
    for (const entry of everythingInThePouch(db, cultivatorId)) {
        const material = getBeastMaterial(entry.itemId);
        if (!material) continue;
        const count = howAMaterialIsStored(material) === 'counted'
            ? entry.quantity
            : theRowsThatGoWithAStack(objects, cultivatorId, material.id, entry.quantity).length;
        lots.push({
            id: material.id,
            grade: material.grade,
            core: material.core,
            count: Math.max(0, Math.floor(count))
        });
    }
    return lots;
}

const WHAT_PEOPLE_CALL_A_BUILD: Readonly<Record<string, string>> = Object.freeze({
    boat: 'build-spirit-boat',
    hull: 'build-spirit-boat',
    ship: 'build-spirit-boat',
    barge: 'build-spirit-boat',
    skiff: 'build-spirit-boat',
    keel: 'build-spirit-boat',
    carriage: 'build-carriage-mortal',
    cart: 'build-carriage-mortal',
    wagon: 'build-carriage-mortal',
    waggon: 'build-carriage-mortal',
    coach: 'build-carriage-mortal'
});

/** Words that lift a carriage off the cheapest bill onto a deeper one. */
const DEEPER_CARRIAGE: Readonly<Record<string, string>> = Object.freeze({
    shod: 'build-carriage-earth',
    rimmed: 'build-carriage-earth',
    earth: 'build-carriage-earth',
    named: 'build-carriage-heaven',
    titled: 'build-carriage-heaven',
    heaven: 'build-carriage-heaven'
});

/**
 * The bill somebody meant, or null.
 *
 * The catalog's own names first, because the game prints "A drawn carriage" and
 * a player must be able to type back what the game printed. Then the nouns,
 * then a grade word that lifts a carriage onto a deeper bill - so "an iron-rimmed
 * carriage" and "an earth-grade carriage" both land on the earth bill, and a
 * bare "a carriage" lands on the cheapest one rather than on a guess.
 */
export function whichBillTheyMeant(said: string): ConveyanceRecipe | null {
    const text = said.toLowerCase();
    const words = text.match(/[a-z]+/g) ?? [];
    if (words.length === 0) return null;

    for (const recipe of CONVEYANCE_RECIPES) {
        if (text.includes(recipe.name.toLowerCase())) return recipe;
    }

    let base: string | null = null;
    for (const word of words) {
        const hit = WHAT_PEOPLE_CALL_A_BUILD[word];
        if (hit !== undefined) { base = hit; break; }
    }
    if (base === null) return null;

    if (base.startsWith('build-carriage')) {
        for (const word of words) {
            const deeper = DEEPER_CARRIAGE[word];
            if (deeper !== undefined) return getConveyanceRecipe(deeper) ?? null;
        }
    }
    return getConveyanceRecipe(base) ?? null;
}

/** Whether the sentence is somebody walking away from what is on the slip. */
export function isAbandoning(said: string): boolean {
    return /\b(?:abandon|abandons|abandoning|scrap|scraps|scrapping|give up on|giving up on|break up|burn)\b/
        .test(said.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────
// THE PLAN
//
// Split in two because the days have to be known before they can be spent and
// the writes have to happen after: `planTheBuild` reads and decides, the caller
// runs the time skip, `landTheBuild` writes. The same shape `gather` has.
// ─────────────────────────────────────────────────────────────────────────

export interface BuildPlan {
    /**
     * `listing`, `refused` and `abandoned` cost nothing. `work` spends days.
     *
     * `abandoned` is a free action that nevertheless CHANGED something, which
     * is why it is its own kind rather than a refusal wearing the words: a
     * caller that renders it as a refusal has told the player the slip is clear
     * while it stands there. See {@link planTheBuild}.
     */
    kind: 'listing' | 'refused' | 'abandoned' | 'work';
    headline: string;
    lines: string[];
    structure: string[];
    /** Set on `work` only. */
    recipe?: ConveyanceRecipe;
    /** The slip with this turn's deliveries already on it. `work` only. */
    berth?: OnTheStocks;
    /** What comes out of the pouch for those deliveries, by material id. */
    toConsume?: Record<string, number>;
    /** Days the slip will absorb this turn. At least 1 on a `work` plan. */
    daysToWork?: number;
}

function billLines(
    recipe: ConveyanceRecipe,
    berth: Berth | null,
    lots: readonly MaterialLot[]
): string[] {
    const stocked = berth ?? layDownKeel(recipe);
    const provisional = deliver(stocked, recipe, lots);
    const short = whatIsStillShort(provisional, recipe);
    const lines = [
        `${recipe.name} wants ${totalComponentsRequired(recipe)} pieces at ${recipe.grade} grade `
        + `and ${recipe.workDays} days of work.`
    ];
    if (short.length === 0) {
        lines.push('Everything it asks for is either on the slip or in your pouch.');
    } else {
        lines.push(
            'Short of '
            + short.map(s => `${s.short} of ${s.line.wants}`).join('; ')
            + '.'
        );
        if (short.some(s => s.line.mustBeCore)) {
            lines.push("A core must be carried as an individual object with its provenance, as well as counted in the pouch.");
        }
    }
    return lines;
}

/**
 * What is worth knowing before anybody lays a keel. A read, and free.
 *
 * Reached by "what could I build", by naming nothing, and by naming something
 * that is not a bill. AGENTS.md: a refusal names a route, and the route here is
 * the four bills with what each wants and which of them this pair of hands can
 * work at all.
 */
function theListing(
    cultivator: Cultivator,
    lots: readonly MaterialLot[],
    stocks: OnTheStocks | null,
    unresolved: string
): BuildPlan {
    const lines: string[] = [];
    const structure: string[] = [];

    if (unresolved.length >= 2) {
        lines.push(
            `Nothing you know how to build is a ${unresolved}. What a yard makes is what carries `
            + 'people and what they are taking with them.'
        );
    }

    if (stocks) {
        const recipe = getConveyanceRecipe(stocks.recipeId)!;
        lines.push(
            `There is already ${recipe.name.toLowerCase()} on the stocks, begun on day `
            + `${stocks.startedOnDay}, ${stocks.workDaysDone} of ${recipe.workDays} days of work `
            + 'into it.',
            ...billLines(recipe, stocks, lots)
        );
        structure.push(
            `On the stocks: ${recipe.id}, delivered [${stocks.delivered.join(', ')}] against `
            + `[${recipe.components.map(c => c.count).join(', ')}], ${stocks.workDaysDone}/`
            + `${recipe.workDays} work days, ${Math.round(fractionStocked(stocks, recipe) * 100)}% `
            + 'stocked.'
        );
    }

    for (const recipe of CONVEYANCE_RECIPES) {
        const canWork = canRefineGrade(recipe.grade, cultivator.realmOrdinal);
        lines.push(
            `${recipe.name}: ${billLines(recipe, null, lots)[0]} `
            + (canWork
                ? `You could work ${recipe.grade}-grade material.`
                : `It wants ${refiningRealmNameFor(recipe.grade)} to work at all, and you stand at `
                  + `${rankName(cultivator.realmOrdinal)}.`)
        );
        structure.push(
            `${recipe.id}: ${recipe.grade} grade, requires ordinal `
            + `${requiredOrdinalForRecipe(recipe)}, ${recipe.workDays} work days, base `
            + `${Math.round(recipe.baseSuccessRate * 100)}%; `
            + (canWork ? 'within reach.' : 'out of reach at this rung.')
        );
    }

    const counted = lots.reduce((n, l) => n + l.count, 0);
    lines.push(counted === 0
        ? 'You have nothing in the pouch a hull would take. What a yard eats is what comes off a '
          + 'body: hide, plate, bone, sinew.'
        : `You are carrying ${counted} piece${counted === 1 ? '' : 's'} a yard could use.`);

    return {
        kind: 'listing',
        headline: stocks ? 'What is on the stocks, and what else could be.' : 'What a yard makes.',
        lines,
        structure
    };
}

export interface PlanInput {
    db: Database.Database;
    cultivator: Cultivator;
    /** What the player said after the verb. May be empty. */
    said: string;
    /**
     * The whole sentence, where the caller has it.
     *
     * `extractSubject` hands back the object of the verb - "the cart" out of "I
     * abandon the cart" - so the word that says they are walking away from it
     * is not in `said` at all. Read for that one question and nothing else.
     */
    raw?: string;
    today: number;
    /** A span the player named, if they named one. */
    days?: number;
    objects?: readonly ObjectRecord[];
}

/**
 * Decide what this turn of building is, without writing anything.
 *
 * Every gate below is somebody else's function asked a question. Nothing about
 * bills, grades, rungs or how far work may run ahead of materials is decided
 * here.
 */
export function planTheBuild(input: PlanInput): BuildPlan {
    const { db, cultivator, today } = input;
    const said = (input.said ?? '').trim();
    const lots = lotsInThePouch(db, cultivator.id, input.objects);
    const stocks = readTheStocks(db, cultivator.id);

    // ── WALKING AWAY FROM IT ─────────────────────────────────────────────
    //
    // THE ONE PLACE THIS FUNCTION WRITES, and it writes because the alternative
    // is worse. Everything else here decides and hands the decision back; if
    // the clear were left to the caller, a caller that forgot would print "it
    // comes off the stocks" over a slip that is still standing, which is the
    // class of defect this whole module was written to stop. One function, one
    // call site, and no way to render the sentence without the act.
    if (stocks && isAbandoning(input.raw ?? said)) {
        const recipe = getConveyanceRecipe(stocks.recipeId)!;
        clearTheStocks(db, cultivator.id);
        return {
            kind: 'abandoned',
            headline: `${recipe.name} comes off the stocks.`,
            lines: [
                `You break up what there was of ${recipe.name.toLowerCase()}. Everything already `
                + 'worked into it stays worked into it, which is to say it is gone; the days are '
                + 'gone too. The ground where it stood is clear.',
                'Say what you want to build and the yard is yours again.'
            ],
            structure: [
                `Abandoned ${recipe.id} after ${stocks.workDaysDone}/${recipe.workDays} work days `
                + `and ${Object.values(stocks.spent).reduce((n, v) => n + v, 0)} piece(s) spent. `
                + 'Materials already delivered are not returned.'
            ]
        };
    }

    const wanted = whichBillTheyMeant(said);

    // ── A BILL NOBODY NAMED, OR ONE NOBODY MAKES ─────────────────────────
    if (!wanted && !stocks) {
        return theListing(cultivator, lots, stocks, said);
    }

    // Naming nothing while something is on the stocks means carry on with it.
    const recipe = wanted ?? getConveyanceRecipe(stocks!.recipeId)!;

    // ── ANOTHER KEEL WHILE ONE IS ALREADY LAID ───────────────────────────
    if (stocks && stocks.recipeId !== recipe.id) {
        const already = getConveyanceRecipe(stocks.recipeId)!;
        return {
            kind: 'refused',
            headline: `${already.name} is already on the stocks.`,
            lines: [
                `You have ${already.name.toLowerCase()} standing half-built, `
                + `${already.workDays - Math.min(stocks.workDaysDone, already.workDays)} days of `
                + 'work short of finished. One person, one slip: putting a second keel down beside '
                + 'it finishes neither.',
                'Carry on with it, or break it up and start the other.'
            ],
            structure: [
                `Refused ${recipe.id}: ${already.id} occupies the slip at `
                + `${stocks.workDaysDone}/${already.workDays} work days.`
            ]
        };
    }

    // ── THE RUNG ─────────────────────────────────────────────────────────
    //
    // The same gate the cauldron keeps, and a refusal that names what would
    // work: the bills this pair of hands could take instead.
    if (!canRefineGrade(recipe.grade, cultivator.realmOrdinal)) {
        const reachable = CONVEYANCE_RECIPES.filter(
            r => canRefineGrade(r.grade, cultivator.realmOrdinal)
        );
        return {
            kind: 'refused',
            headline: `${recipe.name} is above your hands.`,
            lines: [
                `${recipe.name} is ${recipe.grade}-grade work. It wants `
                + `${refiningRealmNameFor(recipe.grade)} or better, and you stand at `
                + `${rankName(cultivator.realmOrdinal)}. Below that the pieces do not answer the `
                + 'hand holding them, however many of them you have.',
                reachable.length === 0
                    ? 'There is nothing on any bill you could work today.'
                    : 'What you could lay a keel for: '
                      + reachable.map(r => `${r.name.toLowerCase()} (${r.grade} grade, `
                          + `${totalComponentsRequired(r)} pieces, ${r.workDays} days)`).join('; ')
                      + '.'
            ],
            structure: [
                `Refused ${recipe.name}: it is written for ${refiningRealmNameFor(recipe.grade)}, `
                + `and this cultivator stands at ${rankName(cultivator.realmOrdinal)}. `
                + `Within reach: ${reachable.map(r => r.name).join(', ') || 'none'}.`
            ]
        };
    }

    // ── DELIVER WHAT THE POUCH HAS ───────────────────────────────────────
    const before: OnTheStocks = stocks ?? { ...layDownKeel(recipe), startedOnDay: today };
    const after = deliver(before, recipe, lots);
    const toConsume: Record<string, number> = {};
    for (const [id, total] of Object.entries(after.spent)) {
        const already = before.spent[id] ?? 0;
        if (total > already) toConsume[id] = total - already;
    }
    const berth: OnTheStocks = { ...after, startedOnDay: before.startedOnDay };

    const short = whatIsStillShort(berth, recipe);
    const ceiling = workDaysAllowedSoFar(berth, recipe);
    const room = Math.max(0, ceiling - berth.workDaysDone);

    const lines: string[] = [];
    const structure: string[] = [];

    if (!stocks) {
        lines.push(
            `You lay ${recipe.name.toLowerCase()} down. ${recipe.workDays} days of work, `
            + `${totalComponentsRequired(recipe)} pieces at ${recipe.grade} grade, and nobody to `
            + 'divide either with.'
        );
    }
    const put = Object.entries(toConsume).reduce((n, [, v]) => n + v, 0);
    if (put > 0) {
        lines.push(
            `${put} piece${put === 1 ? '' : 's'} out of the pouch and onto the slip: `
            + Object.entries(toConsume)
                .map(([id, n]) => `${n} x ${getBeastMaterial(id)?.name ?? id}`)
                .join(', ') + '.'
        );
    }

    // ── NOTHING TO DO ────────────────────────────────────────────────────
    //
    // A slip the materials have stalled is a refusal rather than a day spent,
    // because there is genuinely nothing for a pair of hands to do at it, and
    // charging days for standing next to it would be the softening AGENTS.md
    // forbids with the sign reversed.
    if (room === 0 && !readyToLaunch(berth, recipe)) {
        // Any delivery this turn is REAL and is recorded here for the same
        // reason the abandon branch clears here: the two must not come apart.
        // In practice nothing arrives on this path - every bill in the catalog
        // buys at least one day of work per piece, so a delivery always opens
        // room - and a slip with nothing on it and no work in it is not written
        // at all, because a phantom keel would occupy the yard.
        for (const [id, n] of Object.entries(toConsume)) {
            removeFromPouch(db, cultivator.id, id, n);
        }
        const anything = berth.workDaysDone > 0 || berth.delivered.some(n => n > 0);
        if (anything) writeTheStocks(db, cultivator.id, berth);
        return {
            kind: 'refused',
            headline: `${recipe.name} has gone as far as the materials reach.`,
            lines: [
                ...lines,
                'The hands have gone as far as the materials reach. Short of '
                + short.map(s => `${s.short} of ${s.line.wants}`).join('; ') + '.',
                'Go and get the rest. The slip keeps.'
            ],
            structure: [
                `${recipe.id}: delivered [${berth.delivered.join(', ')}] against `
                + `[${recipe.components.map(c => c.count).join(', ')}], `
                + `${Math.round(fractionStocked(berth, recipe) * 100)}% stocked, work ceiling `
                + `${ceiling} days, ${berth.workDaysDone} done. No room to work.`
            ],
            recipe
        };
    }

    const asked = input.days === undefined
        ? DAYS_AT_THE_BENCH
        : Math.max(1, Math.round(input.days));
    const daysToWork = Math.max(1, Math.min(asked, Math.max(room, 1)));

    if (input.days === undefined) {
        structure.push(
            `No span named; DAYS_AT_THE_BENCH is ${DAYS_AT_THE_BENCH} and the slip has room for `
            + `${room}, so ${daysToWork} day(s) go in.`
        );
    }

    return {
        kind: 'work',
        headline: stocks
            ? `Back to ${recipe.name.toLowerCase()}.`
            : `${recipe.name} goes down on the stocks.`,
        lines,
        structure,
        recipe,
        berth,
        toConsume,
        daysToWork
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE WRITE
// ─────────────────────────────────────────────────────────────────────────

export interface BuildOutcome {
    lines: string[];
    structure: string[];
    /** For the call log. Every one of these is a real write. */
    calls: { name: string; summary: string }[];
    /** A tracked craft that was minted, for the caller to put in the world. */
    minted: ObjectRecord | null;
    /**
     * A counted conveyance that was finished, for the caller to make the vehicle it is: an item
     * that goes with its builder and can be left behind (`a-vehicle.ts`). Null otherwise.
     */
    builtCounted?: string | null;
    /** Whether the slip is now empty, either finished or lost. */
    slipCleared: boolean;
}

export interface LandInput {
    db: Database.Database;
    cultivator: Cultivator;
    plan: BuildPlan;
    runSeed: string;
    today: number;
    /** Where it is moored if it turns out to be a tracked thing. */
    mooredAt: string;
    objects?: ObjectRecord[];
}

/**
 * Spend the materials, put the days in, and launch if it is finished.
 *
 * Everything consequential is the engine module's: `workOn` decides how many of
 * the offered days the slip absorbs, `launch` rolls it from the run seed, and
 * `mintCraft` decides whether there is an object at all. This writes what they
 * answered and never more than that.
 *
 * ONLY EVER CALLED ON A `work` PLAN. Every other kind has already done whatever
 * it does, so there is no arrangement in which a caller forgets to follow one
 * up and prints a sentence over a world that did not move.
 */
export function landTheBuild(input: LandInput): BuildOutcome {
    const { db, cultivator, plan, today } = input;
    if (plan.kind !== 'work') {
        throw new Error(`landTheBuild wants a work plan, got ${plan.kind}.`);
    }
    const recipe = plan.recipe!;
    const lines: string[] = [];
    const structure: string[] = [];
    const calls: { name: string; summary: string }[] = [];

    // ── MATERIALS OUT OF THE POUCH ───────────────────────────────────────
    //
    // Before anything else, because a slip that records a delivery the pouch
    // still holds is the exact fabrication this whole module exists to avoid.
    for (const [id, n] of Object.entries(plan.toConsume ?? {})) {
        const material = getBeastMaterial(id);
        const tracked = material && howAMaterialIsStored(material) !== 'counted';
        const rows = theRowsThatGoWithAStack(input.objects ?? [], cultivator.id, id, n);
        if (tracked && rows.length !== n) throw new Error('The tracked material is no longer held.');
        const ok = removeFromPouch(db, cultivator.id, id, n);
        if (!ok) throw new Error('The material is no longer in the pouch.');
        for (const at of rows) input.objects![at] = ruin(input.objects![at]!, {
            onDay: today, source: `worked into ${recipe.name}`
        });
        calls.push({
            name: 'storage.removeFromPouch',
            summary: `${id} x${n} out of ${cultivator.id}'s pouch and onto ${recipe.id}`
                + '.'
        });
    }

    let berth: Berth = plan.berth!;
    const worked = workOn(berth, recipe, {
        days: plan.daysToWork!,
        // One pair of hands. A yard divides the work and a person does not.
        hands: [cultivator.realmOrdinal]
    });
    berth = worked.berth;
    lines.push(
        `${worked.daysWorked} day${worked.daysWorked === 1 ? '' : 's'} at it. `
        + `${berth.workDaysDone} of ${recipe.workDays} days of work are in it now.`
    );
    if (worked.stoppedBecause) lines.push(worked.stoppedBecause);
    structure.push(
        `${recipe.name}, worked on: asked ${plan.daysToWork} days, absorbed ${worked.daysWorked}, `
        + `${berth.workDaysDone}/${recipe.workDays} done at `
        + `${Math.round(fractionStocked(berth, recipe) * 100)}% stocked.`
    );
    calls.push({
        name: 'engine.workOn',
        summary: `${recipe.id}: +${worked.daysWorked} day(s), `
            + `${berth.workDaysDone}/${recipe.workDays}.`
    });

    if (!readyToLaunch(berth, recipe)) {
        writeTheStocks(db, cultivator.id, {
            ...berth, startedOnDay: (plan.berth as OnTheStocks).startedOnDay
        });
        const short = whatIsStillShort(berth, recipe);
        lines.push(short.length === 0
            ? 'It stands where you left it, and it is only days now.'
            : 'It stands where you left it. Short of '
              + short.map(s => `${s.short} of ${s.line.wants}`).join('; ') + '.');
        return { lines, structure, calls, minted: null, slipCleared: false };
    }

    // ── THE LAUNCH ───────────────────────────────────────────────────────
    const rate = successRateFor(recipe, cultivator.realmOrdinal);
    const outcome = launch(
        `${input.runSeed}:${cultivator.id}:${(plan.berth as OnTheStocks).startedOnDay}`,
        berth, recipe, cultivator.realmOrdinal
    );
    clearTheStocks(db, cultivator.id);
    structure.push(
        `${recipe.name}, attempted at ${rankName(cultivator.realmOrdinal)}: rate `
        + `${(outcome.rate * 100).toFixed(1)}% (base ${(recipe.baseSuccessRate * 100).toFixed(0)}% `
        + `plus the margin over what it is written for), rolled `
        + `${outcome.roll.toFixed(3)} - ${outcome.launched ? 'holds' : 'does not hold'}. `
        + `Rate quoted before the roll was ${(rate * 100).toFixed(1)}%.`
    );

    if (!outcome.launched) {
        lines.push(outcome.narrationHint);
        calls.push({
            name: 'engine.launch',
            summary: `${recipe.id} failed at ${(outcome.rate * 100).toFixed(1)}%; `
                + `${Object.values(outcome.spent).reduce((n, v) => n + v, 0)} piece(s) lost.`
        });
        return { lines, structure, calls, minted: null, slipCleared: true };
    }

    lines.push(outcome.narrationHint);

    // WHICH SIDE OF THE LINE IT LANDS ON IS THE GRADE'S. `conveyanceKeptAs` is
    // the single authority, exactly as the world side asks it.
    if (conveyanceKeptAs(recipe.grade) === 'tracked') {
        const minted = mintCraft(recipe, {
            id: `obj-craft-${cultivator.id}-${today}`,
            name: recipe.name,
            ownerId: cultivator.id,
            ownerName: cultivator.name,
            wrightId: cultivator.id,
            wrightName: cultivator.name,
            bestHandOrdinal: cultivator.realmOrdinal,
            onDay: today,
            mooredAt: input.mooredAt,
            description: `Built by ${cultivator.name}, alone, at ${input.mooredAt}.`
        });
        lines.push(
            `It is yours, and its record starts with you: who built it, on what day, out of `
            + 'what. Nobody will ever have to ask you where it came from.'
        );
        calls.push({
            name: 'world.mintCraft',
            summary: `${minted?.id} (${recipe.name}, rated ${minted?.power}) minted to `
                + `${cultivator.id}, moored at ${input.mooredAt}, provenance link 1 of 1.`
        });
        return { lines, structure, calls, minted, slipCleared: true };
    }

    // Counted grade, and still a vehicle: it goes with its builder and can be left behind, which
    // a count in the pouch cannot. The caller makes it, where there is a world to stand it in.
    const conveyanceId = recipe.producesConveyanceId;
    lines.push(
        `${requireConveyance(conveyanceId).name} is yours, and it goes with you. Say where you are `
        + 'going and that you are riding, and it will be under you.'
    );
    structure.push(`${conveyanceId} finished by ${cultivator.id}, ${recipe.grade} grade; the caller makes the vehicle.`);
    calls.push({
        name: 'world.aVehicleOf',
        summary: `${conveyanceId} finished by ${cultivator.id} (${recipe.grade} grade).`
    });
    return { lines, structure, calls, minted: null, slipCleared: true, builtCounted: conveyanceId };
}
