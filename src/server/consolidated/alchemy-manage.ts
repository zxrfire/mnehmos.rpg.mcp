/**
 * Consolidated Alchemy Tool - `alchemy_manage`
 *
 * Pills are the only reliable way to undo damage in this world, and they are
 * scarce. This tool owns refining them, swallowing them, and the pouch they sit
 * in.
 *
 * AUTHORITY BOUNDARY
 * ------------------
 * - `refine` never accepts a result. The caller names a recipe; the engine
 *   checks the pouch, computes the odds from the recipe's base rate plus realm
 *   margin, Insight and any supplementary herbs, rolls a seeded stream, consumes
 *   the ingredients either way, and only then decides whether a pill exists.
 * - `consume_pill` never accepts an effect. The pill's own catalog row decides
 *   what happens, the engine applies it, and toxicity accumulates on the body
 *   whether or not anyone wanted it to.
 * - A pill taken for its breakthrough boost is RECORDED, not returned as advice:
 *   `cultivation_manage.breakthrough` reads the persisted record and spends it.
 *   There is no way to assert a pill bonus at the moment of the attempt.
 */

import { z } from 'zod';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import { SATIETY_MAX, type InjurySeverity, type Pill } from '../../schema/cultivation.js';
import {
    createInjury,
    describeDeath,
    evaluateDeathConditions,
    forStream,
    rankName,
    ordinaryWoundFor,
    rollInjurySeverity,
    treatWorstInjury
} from '../../engine/cultivation/index.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import {
    medicineNeededFor,
    medicineRank,
    medicineReaches
} from '../../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import {
    canRefineGrade,
    whyTheCauldronRefuses
} from '../../engine/cultivation/who-can-refine-a-grade-of-medicine.js';
// The physician's refusal already names the cure, at what a counter in this
// province charges, with whether the purse covers it. The pill path refusing on
// the SAME ladder must say the SAME sentence, or the game contradicts itself on
// the surface where it used to contradict itself in the resolver.
import {
    whatWouldCloseThisWound,
    whatToSayAboutTheCure
} from '../../web/what-would-close-this-wound.js';
import {
    getPill,
    lifespanRefusalReason,
    lifespanYearsFor,
    MODERN_REFINEMENT,
    PILLS
} from '../../data/cultivation/pills.js';
import { RECIPES, getRecipe } from '../../data/cultivation/recipes.js';
import { getHerb } from '../../data/cultivation/herbs.js';
// The leaf, deliberately, and NOT `cultivation-mortal.js` which re-exports it:
// that module and `cultivation-manage.js` are in a live cycle, and reaching
// this function through it flips the evaluation order and takes the server out
// at boot. See `where-a-cultivator-is-standing.ts`.
import { standingOf } from './where-a-cultivator-is-standing.js';
import { gradeRank } from '../../data/cultivation/techniques.js';
import {
    FLAG_GRAIN_ABSTINENCE_UNTIL,
    FLAG_BREAKTHROUGH_PILLS_TAKEN,
    FLAG_PENDING_PILL,
    FLAG_PILL_TOXICITY,
    addToPouch,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    listPouch,
    pouchQuantity,
    readNumberFlag,
    removeFromPouch,
    resolveActiveRun,
    round2,
    round4,
    summariseInjury,
    writeFlag,
    type PendingPill
} from './cultivation-support.js';

const ACTIONS = ['list_recipes', 'refine', 'consume_pill', 'inventory'] as const;
type AlchemyAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// TUNING
// ═══════════════════════════════════════════════════════════════════════════

/** Odds gained per realm ordinal above the recipe's requirement. */
export const REFINE_REALM_MARGIN_PER_ORDINAL = 0.015;
/** Ceiling on that margin. Standing above a formula stops helping eventually. */
export const REFINE_REALM_MARGIN_CAP = 0.2;
/** Odds gained per point of Insight above the 2-point pivot. */
export const REFINE_INSIGHT_PER_POINT = 0.03;
/** Ceiling on the contribution of supplementary herbs. */
export const REFINE_SUPPLEMENT_CAP = 0.15;

/** Mirrors the breakthrough clamp: never certain, never hopeless. */
export const MIN_REFINE_CHANCE = 0.02;
export const MAX_REFINE_CHANCE = 0.97;

/**
 * Accumulated toxicity the body absorbs before a meridian gives out.
 *
 * Pills are not free healing. Ten mortal-grade pills, or two heaven-grade ones,
 * and the medicine becomes the injury. Crossing the threshold mints a real
 * poison injury through the same path every other wound takes.
 */
export const TOXICITY_TOLERANCE = 3;

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ListRecipesSchema = z.object({
    action: z.literal('list_recipes'),
    cultivatorId: z.string().optional(),
    includeOutOfReach: z.boolean().optional().default(false)
        .describe('Also list formulas whose required realm is above this cultivator'),
    effect: z.string().optional().describe('Filter by the produced pill\'s effect')
});

const RefineSchema = z.object({
    action: z.literal('refine'),
    recipeId: z.string(),
    cultivatorId: z.string().optional(),
    supplements: z.array(z.object({
        herbId: z.string(),
        quantity: z.number().int().min(1).max(99)
    })).optional().default([])
        .describe('Extra herbs thrown in to improve the odds. Consumed whether it works or not.')
});

const ConsumePillSchema = z.object({
    action: z.literal('consume_pill'),
    pillId: z.string(),
    cultivatorId: z.string().optional()
});

const InventorySchema = z.object({
    action: z.literal('inventory'),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleListRecipes(
    args: z.infer<typeof ListRecipesSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const held = new Map(listPouch(repos.db, cultivator.id).map(e => [e.itemId, e.quantity]));

    const rows = RECIPES.filter(recipe => {
        if (!(args.includeOutOfReach ?? false) && recipe.requiredOrdinal > cultivator.realmOrdinal) {
            return false;
        }
        if (args.effect) {
            const pill = getPill(recipe.producesPillId);
            if (!pill || pill.effect !== args.effect) return false;
        }
        return true;
    }).map(recipe => {
        const pill = getPill(recipe.producesPillId);
        const ingredients = recipe.ingredients.map(ing => {
            const herb = getHerb(ing.itemId);
            return {
                itemId: ing.itemId,
                name: herb?.name ?? ing.itemId,
                required: ing.quantity,
                held: held.get(ing.itemId) ?? 0,
                short: Math.max(0, ing.quantity - (held.get(ing.itemId) ?? 0))
            };
        });
        return {
            id: recipe.id,
            name: recipe.name,
            provenance: recipe.provenance,
            sourceNote: recipe.sourceNote,
            requiredOrdinal: recipe.requiredOrdinal,
            requiredRank: rankName(recipe.requiredOrdinal),
            withinReach: recipe.requiredOrdinal <= cultivator.realmOrdinal,
            baseSuccessRate: recipe.baseSuccessRate,
            estimatedSuccessRate: round4(
                refineChance(recipe.baseSuccessRate, cultivator.realmOrdinal, recipe.requiredOrdinal,
                    cultivator.attributes.insight, 0).chance
            ),
            produces: pill
                ? { id: pill.id, name: pill.name, grade: pill.grade, effect: pill.effect, potency: pill.potency, toxicity: pill.toxicity }
                : null,
            ingredients,
            canAttempt:
                recipe.requiredOrdinal <= cultivator.realmOrdinal &&
                ingredients.every(i => i.short === 0)
        };
    });

    return {
        cultivator: { id: cultivator.id, name: cultivator.name, rank: rankName(cultivator.realmOrdinal) },
        count: rows.length,
        recipes: rows,
        note: 'estimatedSuccessRate excludes supplements. The engine rolls the real number at refine time.'
    };
}

/** The itemised odds. Exposed the same way breakthrough odds are: in full. */
function refineChance(
    baseRate: number,
    ordinal: number,
    requiredOrdinal: number,
    insight: number,
    supplementBonus: number
): { chance: number; modifiers: Array<{ source: string; delta: number }> } {
    const modifiers: Array<{ source: string; delta: number }> = [
        { source: 'recipe_base', delta: baseRate }
    ];

    const margin = Math.min(
        REFINE_REALM_MARGIN_CAP,
        Math.max(0, ordinal - requiredOrdinal) * REFINE_REALM_MARGIN_PER_ORDINAL
    );
    modifiers.push({ source: 'realm_margin', delta: margin });
    modifiers.push({ source: 'insight', delta: (insight - 2) * REFINE_INSIGHT_PER_POINT });
    if (supplementBonus !== 0) {
        modifiers.push({ source: 'supplementary_herbs', delta: supplementBonus });
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const clamped = Math.max(MIN_REFINE_CHANCE, Math.min(MAX_REFINE_CHANCE, raw));
    if (clamped !== raw) {
        modifiers.push({ source: clamped > raw ? 'clamp:floor' : 'clamp:ceiling', delta: clamped - raw });
    }
    return { chance: clamped, modifiers };
}

export async function handleRefine(args: z.infer<typeof RefineSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const recipe = getRecipe(args.recipeId);
    if (!recipe) {
        return guidingError('unknown_recipe', `No formula with id ${args.recipeId}.`, {
            hint: 'alchemy_manage({ action: "list_recipes" }) lists what is in reach.'
        });
    }
    if (recipe.requiredOrdinal > cultivator.realmOrdinal) {
        // ── WHICH OF THE TWO WALLS IT IS ──────────────────────────────────
        //
        // A formula can be out of reach for two different reasons and a player
        // told the wrong one goes and does the wrong thing about it. If the
        // GRADE's materials are past them, no amount of practice at this recipe
        // helps and the answer is rungs. If only this particular formula is
        // hard, they are working the right materials and merely need a few more
        // rungs of the realm they are already climbing.
        //
        // The grade wall is the design owner's ruling and it is the one that
        // ends at "nobody": immortal grade is not refined below the Lid at all,
        // so the refusal there names the OTHER roads to a dose rather than a
        // rung nobody can reach. AGENTS.md - a refusal names what would work,
        // and never removes the verb.
        const gradeOfPill = getPill(recipe.producesPillId)?.grade;
        const gradeWall = gradeOfPill !== undefined
            && !canRefineGrade(gradeOfPill, cultivator.realmOrdinal)
            ? whyTheCauldronRefuses(gradeOfPill, cultivator.realmOrdinal)
            : null;
        return guidingError(
            'realm_too_low',
            `${recipe.name} requires ${rankName(recipe.requiredOrdinal)}; ${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}. `
            + (gradeWall ?? 'The cauldron would take the difference out of the alchemist.'),
            {
                requiredOrdinal: recipe.requiredOrdinal,
                currentOrdinal: cultivator.realmOrdinal,
                grade: gradeOfPill ?? null,
                blockedByGrade: gradeWall !== null
            }
        );
    }

    // ── Ingredients must actually be in the pouch. ──
    const missing = recipe.ingredients
        .map(ing => {
            const herb = getHerb(ing.itemId);
            const held = pouchQuantity(repos.db, cultivator.id, ing.itemId);
            return {
                itemId: ing.itemId,
                name: herb?.name ?? ing.itemId,
                required: ing.quantity,
                held,
                short: ing.quantity - held,
                // Where it grows and how high the ground has to be before it
                // gives any up. Both are already on the herb row; a refusal
                // that omits them tells somebody to go and get a thing without
                // saying where, or whether they can.
                biome: herb?.biome ?? null,
                harvestOrdinal: herb?.harvestOrdinal ?? null
            };
        })
        .filter(i => i.held < i.required);
    if (missing.length > 0) {
        // ── A REFUSAL THAT DOES NOT NAME ITS CAUSE IS A BROKEN FEATURE ────
        //
        // This said `${recipe.name} cannot be attempted.` and stopped, with the
        // shortfall sitting in the payload where no player ever sees it. Found
        // by playing: a cultivator dying of untreated meridian injuries typed
        // "I refine a Minor Healing Pill" and was told that sentence, which is
        // indistinguishable from an unfinished subsystem - and it sits directly
        // on the only road out of the commonest death in the game.
        //
        // The branch immediately above already does this properly ("requires
        // Qi Condensation Layer 7; Torn stands at Qi Condensation Layer 1"), so
        // the fix is to match its sibling rather than to invent a style.
        //
        // WHERE IT GROWS, not just what is missing. Every recipe in the
        // catalog wants only herbs that grow at or below the rung the recipe
        // itself demands (asserted in
        // `tests/server/alchemy-refusals-name-their-cause.test.ts`), so
        // anybody who has got past the branch above can go and pick every one
        // of these - which makes naming the ground an instruction rather than
        // an observation. Biome, not a place name: the world has many
        // riverbanks and the engine is not choosing one for them.
        const shortOf = missing.map(i => `${i.short} x ${i.name}`).join(', ');
        const where = ` ${missing.map(i => `${i.name} grows ${i.biome === null
            ? 'somewhere nobody has written down'
            : `on ${String(i.biome).replace(/_/g, ' ')}`}`).join('; ')}.`;
        return guidingError(
            'missing_ingredients',
            `${recipe.name} cannot be attempted: the pouch is short of ${shortOf}. `
            + 'Ingredients burn whether or not a pill comes out, so the cauldron will not '
            + `open on a partial set.${where}`,
            {
                missing,
                hint: 'Gather or buy the herbs first. The engine will not refine from an empty pouch.'
            }
        );
    }

    const supplements = args.supplements ?? [];
    let supplementBonus = 0;
    const supplementDetail: Array<Record<string, unknown>> = [];
    for (const supplement of supplements) {
        const herb = getHerb(supplement.herbId);
        if (!herb) {
            return guidingError('unknown_herb', `No herb with id ${supplement.herbId}.`);
        }
        const held = pouchQuantity(repos.db, cultivator.id, supplement.herbId);
        if (held < supplement.quantity) {
            return guidingError(
                'missing_ingredients',
                `${cultivator.name} holds ${held} ${herb.name}, not ${supplement.quantity}.`,
                { herbId: supplement.herbId, held, required: supplement.quantity }
            );
        }
        const contribution = 0.01 * (gradeRank(herb.grade) + 1) * supplement.quantity;
        supplementBonus += contribution;
        supplementDetail.push({
            herbId: herb.id,
            name: herb.name,
            grade: herb.grade,
            quantity: supplement.quantity,
            contribution: round4(contribution)
        });
    }
    supplementBonus = Math.min(REFINE_SUPPLEMENT_CAP, supplementBonus);

    const odds = refineChance(
        recipe.baseSuccessRate,
        cultivator.realmOrdinal,
        recipe.requiredOrdinal,
        cultivator.attributes.insight,
        supplementBonus
    );

    const rng = forStream(run.seed, 'alchemy', run.turn, recipe.id);
    const roll = rng.next();
    const succeeded = roll < odds.chance;
    const pill = getPill(recipe.producesPillId);

    const persist = repos.db.transaction(() => {
        // Ingredients burn whether or not a pill comes out. That is what makes
        // a failed refinement expensive rather than merely disappointing.
        for (const ing of recipe.ingredients) {
            removeFromPouch(repos.db, cultivator.id, ing.itemId, ing.quantity);
        }
        for (const supplement of supplements) {
            removeFromPouch(repos.db, cultivator.id, supplement.herbId, supplement.quantity);
        }
        if (succeeded && pill) {
            addToPouch(repos.db, cultivator.id, pill.id, 'pill', 1);
        }
        repos.runs.incrementTurn(run.id, 1);
    });
    persist();

    return {
        refined: true,
        succeeded,
        recipe: { id: recipe.id, name: recipe.name, provenance: recipe.provenance },
        odds: {
            finalChance: round4(odds.chance),
            finalChancePercent: round2(odds.chance * 100),
            roll: round4(roll),
            modifiers: odds.modifiers.map(m => ({ source: m.source, delta: round4(m.delta) })),
            supplements: supplementDetail
        },
        ingredientsConsumed: [
            ...recipe.ingredients.map(i => ({
                itemId: i.itemId,
                name: getHerb(i.itemId)?.name ?? i.itemId,
                quantity: i.quantity
            })),
            ...supplements.map(s => ({
                itemId: s.herbId,
                name: getHerb(s.herbId)?.name ?? s.herbId,
                quantity: s.quantity
            }))
        ],
        produced: succeeded && pill
            ? { id: pill.id, name: pill.name, grade: pill.grade, effect: pill.effect, potency: pill.potency }
            : null,
        narrationHint: succeeded && pill
            ? `The cauldron held. One ${pill.name} at ${round2(odds.chance * 100)}% odds.`
            : `The cauldron did not hold. The ingredients are slag, at ${round2(odds.chance * 100)}% odds.`,
        pouch: projectPouch(repos.db, cultivator.id)
    };
}

export async function handleConsumePill(
    args: z.infer<typeof ConsumePillSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const pill = getPill(args.pillId);
    if (!pill) {
        return guidingError('unknown_pill', `No pill with id ${args.pillId}.`);
    }
    if (pouchQuantity(repos.db, cultivator.id, pill.id) < 1) {
        return guidingError(
            'pill_not_held',
            `${cultivator.name} is not carrying a ${pill.name}.`,
            { hint: 'alchemy_manage({ action: "inventory" }) shows the pouch.' }
        );
    }

    const day = Math.floor(run.elapsedDays);
    const nextTurn = run.turn + 1;
    const effect = resolvePillEffect(
        cultivator, pill, day,
        readNumberFlag(repos.db, cultivator.id, FLAG_BREAKTHROUGH_PILLS_TAKEN, 0)
    );

    // ── Toxicity: the medicine keeps its own ledger. ──
    const toxicityBefore = readNumberFlag(repos.db, cultivator.id, FLAG_PILL_TOXICITY, 0);
    const toxicityAfterRaw = toxicityBefore + pill.toxicity;
    const poisoned = toxicityAfterRaw >= TOXICITY_TOLERANCE;
    const toxicityAfter = poisoned ? toxicityAfterRaw - TOXICITY_TOLERANCE : toxicityAfterRaw;
    const toxicityRng = forStream(run.seed, 'pill_toxicity', run.turn, pill.id);
    const poisonSeverity = rollInjurySeverity(toxicityRng);
    const poisonInjury = poisoned
        ? createInjury(
            {
                severity: poisonSeverity,
                source: 'poison',
                turn: nextTurn,
                woundType: ordinaryWoundFor('poison', poisonSeverity),
                description: `Accumulated pill toxicity finally told. ${pill.name} was one too many.`
            },
            toxicityRng
        )
        : null;

    let death: { cause: string; description: string } | null = null;

    const persist = repos.db.transaction(() => {
        if (!removeFromPouch(repos.db, cultivator.id, pill.id, 1)) {
            throw new Error(`Pouch changed underneath the write for ${pill.id}`);
        }

        if (effect.deltas) repos.cultivators.applyDeltas(cultivator.id, effect.deltas);
        for (const injuryId of effect.treatedInjuryIds) {
            repos.cultivators.treatInjury(injuryId, nextTurn);
        }
        for (const [key, value] of Object.entries(effect.flags)) {
            writeFlag(repos.db, cultivator.id, key, value);
        }

        if (poisonInjury) {
            repos.cultivators.addInjury(cultivator.id, {
                id: poisonInjury.id,
                severity: poisonInjury.severity,
                source: poisonInjury.source,
                description: poisonInjury.description,
                sustainedOnTurn: poisonInjury.sustainedOnTurn,
                woundType: poisonInjury.woundType,
                cultivationPenalty: poisonInjury.cultivationPenalty,
                breakthroughPenalty: poisonInjury.breakthroughPenalty
            });
        }
        writeFlag(repos.db, cultivator.id, FLAG_PILL_TOXICITY, String(round4(toxicityAfter)));

        repos.runs.incrementTurn(run.id, 1);

        const after = repos.cultivators.getById(cultivator.id)!;
        const cause = evaluateDeathConditions(after);
        if (cause) {
            death = { cause, description: describeDeath(cause, after) };
            repos.cultivators.markDead(cultivator.id, cause, nextTurn, death.description);
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        consumed: true,
        pill: {
            id: pill.id,
            name: pill.name,
            grade: pill.grade,
            effect: pill.effect,
            potency: pill.potency,
            toxicity: pill.toxicity
        },
        applied: effect.summary,
        deltas: effect.deltas ?? {},
        injuriesTreated: effect.treatedInjuries.map(summariseInjury),
        pendingBreakthroughPill: effect.pendingPill,
        toxicity: {
            before: round4(toxicityBefore),
            after: round4(toxicityAfter),
            tolerance: TOXICITY_TOLERANCE,
            crossedThreshold: poisoned,
            injury: poisonInjury ? summariseInjury(poisonInjury) : null
        },
        died: death !== null,
        death,
        cultivator: describeCultivator(repos, after, runAfter),
        pouch: projectPouch(repos.db, cultivator.id)
    };
}

interface PillApplication {
    summary: string;
    deltas: Record<string, number> | null;
    treatedInjuryIds: string[];
    treatedInjuries: ReturnType<typeof treatWorstInjury>['injuries'];
    flags: Record<string, string>;
    pendingPill: PendingPill | null;
}

/**
 * Turn a pill's catalog row into state changes.
 *
 * Every branch reads the pill's own `effect` and `potency`. There is no path
 * here for a caller to say what a pill does.
 */
function resolvePillEffect(
    cultivator: Parameters<typeof describeCultivator>[1],
    pill: Pill,
    currentDay: number,
    /** How many breakthrough pills this life has already had. Read, never written. */
    priorPillsTaken: number
): PillApplication {
    const base: PillApplication = {
        summary: '',
        deltas: null,
        treatedInjuryIds: [],
        treatedInjuries: [],
        flags: {},
        pendingPill: null
    };

    switch (pill.effect) {
        case 'heal_hp': {
            const healed = Math.min(pill.potency, cultivator.maxHp - cultivator.hp);
            return {
                ...base,
                deltas: { hp: pill.potency },
                // SAY WHEN IT COULD NOT HAVE DONE ANYTHING. A restorative
                // swallowed at full does nothing, is gone anyway, and adds
                // toxicity - so it is strictly worse than not taking it, and
                // "0 HP restored" alone reads as bad luck rather than as a
                // wasted pill. The engine knows both numbers here.
                summary: healed <= 0
                    ? `No HP restored: already at ${cultivator.hp} of ${cultivator.maxHp}. `
                      + `The pill is gone and it did nothing (potency ${pill.potency}).`
                    : `${Math.max(0, Math.round(healed))} HP restored (potency ${pill.potency}).`
            };
        }
        case 'restore_qi': {
            const restored = Math.min(pill.potency, cultivator.maxQi - cultivator.qi);
            return {
                ...base,
                deltas: { qi: pill.potency },
                // Same as HP above. Found by playing: a fresh cultivator at
                // 30/30 qi spent eighteen of thirty spirit stones on a
                // Qi-Gathering Pill, was told "0 qi restored (potency 15)",
                // and carried 0.10 of toxicity for it.
                summary: restored <= 0
                    ? `No qi restored: already at ${cultivator.qi} of ${cultivator.maxQi}. `
                      + `The pill is gone and it did nothing (potency ${pill.potency}).`
                    : `${Math.max(0, Math.round(restored))} qi restored (potency ${pill.potency}).`
            };
        }
        case 'treat_injury': {
            // ── THE GRADE HAS TO REACH THE WOUND, AND IT USED NOT TO ──────
            //
            // Found by playing, and it is why that run survived: a 60-stone
            // MORTAL Clear Meridian Pill closed a CRIPPLING tear one turn after
            // a physician had refused the same wound in as many words. The
            // ladder in `what-grade-of-medicine-a-wound-needs.ts` was consulted
            // by `GameService.treat` and by nothing on this path, so the game
            // held two positions on the same question and the cheaper one won.
            //
            // `treatWorstInjury` has taken a `reaches` predicate since the two
            // axes were built; this branch simply never passed one. Both axes
            // are the wound's: how bad it is, and how large the body carrying
            // it is. Neither has anything to do with who REFINED the pill -
            // that is `who-can-refine-a-grade-of-medicine.ts`, a different
            // ladder answering a different question, and the two must not be
            // read into each other.
            const count = Math.max(1, Math.round(pill.potency));
            const reaches = (severity: InjurySeverity): boolean =>
                medicineReaches(pill.grade, severity, cultivator.realmOrdinal);
            let injuries = cultivator.injuries;
            const treated: typeof cultivator.injuries = [];
            for (let i = 0; i < count; i++) {
                const step = treatWorstInjury(injuries, reaches);
                if (!step.treated) break;
                injuries = step.injuries;
                treated.push(step.treated);
            }

            // ── AND WHEN IT DOES NOT REACH, IT SAYS WHAT WOULD ───────────
            //
            // "Nothing to treat. The pill was wasted." is true and useless: it
            // reads as "you had no wounds" to somebody who is visibly carrying
            // several. A refusal is only finished when it names the thing that
            // would work at its price, which is the shape the physician's
            // refusal already has, so it uses the physician's own sentence.
            // Permanent wounds are excluded on purpose. `treatWorstInjury`
            // skips them whatever grade is applied, and no medicine below the
            // structural-repair catalog closes one - so counting them here
            // would have the engine promise a cure that does not exist, which
            // is the mirror of the defect being fixed.
            const outOfReach = injuries.filter(injury =>
                !injury.treated
                && !isPermanentWound(injury.woundType)
                && !reaches(injury.severity));
            const cure = outOfReach.length > 0
                ? whatWouldCloseThisWound(
                    outOfReach,
                    cultivator.realmOrdinal,
                    cultivator.spiritStones,
                    // Where they are standing, so this surface quotes the same
                    // figure the counter charges. The physician's refusal, the
                    // situation panel and this sentence are the three places
                    // the cure gets named, and they now name one price.
                    standingOf(cultivator).regionId)
                : null;

            let summary: string;
            if (treated.length > 0) {
                summary = `${treated.length} meridian injur${treated.length === 1 ? 'y' : 'ies'} `
                    + `knitted: ${treated.map(t => t.severity).join(', ')}.`;
                if (outOfReach.length > 0) {
                    summary += ` ${outOfReach.length} left open: `
                        + `${pill.grade}-grade medicine does not reach them.`
                        + (cure ? ` ${whatToSayAboutTheCure(cure)}` : '');
                }
            } else if (outOfReach.length > 0) {
                const needed = outOfReach
                    .map(injury => medicineNeededFor(injury.severity, cultivator.realmOrdinal))
                    .sort((a, b) => medicineRank(b) - medicineRank(a))[0];
                summary = `Past what a ${pill.grade}-grade medicine reaches. The pill is gone `
                    + `and it did nothing: ${outOfReach.length} untreated wound(s) on a body at `
                    + `${rankName(cultivator.realmOrdinal)}, wanting ${needed}-grade medicine.`
                    + (cure ? ` ${whatToSayAboutTheCure(cure)}` : '');
            } else {
                summary = 'Nothing to treat. The pill was wasted.';
            }

            return {
                ...base,
                treatedInjuryIds: treated.map(t => t.id),
                treatedInjuries: treated,
                summary
            };
        }
        case 'cleanse_deviation': {
            const count = Math.max(1, Math.round(pill.potency));
            const deviationInjuries = cultivator.injuries
                .filter(i => !i.treated && i.source === 'qi_deviation')
                .slice(0, count);
            return {
                ...base,
                treatedInjuryIds: deviationInjuries.map(i => i.id),
                treatedInjuries: deviationInjuries,
                summary: deviationInjuries.length
                    ? `${deviationInjuries.length} deviation-torn meridian(s) cleared.`
                    : 'No deviation damage to clear. The pill was wasted.'
            };
        }
        case 'boost_breakthrough': {
            // The grade and the count go on the record AT CONSUMPTION, not at
            // the attempt. `attemptBreakthrough` prices a graded pill through
            // the real band curve and an ungraded one through the legacy flat
            // `potency` path, and every pill in the catalog has a grade - so
            // omitting it was routing every player pill down the fallback that
            // exists for a synthesised pill with no catalog row behind it.
            //
            // The count is stamped here for a reason that is not convenience:
            // permanent tolerance is a fact about the body that swallowed the
            // pill on the day it swallowed it. Read at the attempt instead, a
            // pill held through four later pills would grow weaker in the
            // pouch, which is not something a pouch does.
            const pending: PendingPill = {
                pillId: pill.id,
                name: pill.name,
                potency: pill.potency,
                grade: pill.grade,
                priorPillsTaken
            };
            return {
                ...base,
                flags: {
                    [FLAG_PENDING_PILL]: JSON.stringify(pending),
                    [FLAG_BREAKTHROUGH_PILLS_TAKEN]: String(priorPillsTaken + 1)
                },
                pendingPill: pending,
                summary:
                    `Held for the next bottleneck: +${round2(pill.potency * 100)} percentage points ` +
                    `nominal, at ${pill.grade} grade, against ${priorPillsTaken} breakthrough pill(s) ` +
                    'already taken in this life. The engine prices it at the moment of the attempt, ' +
                    'and it is spent whether the attempt succeeds or not.'
            };
        }
        case 'advance_progress':
            return {
                ...base,
                deltas: { cultivationProgress: pill.potency },
                summary: `${pill.potency} qi-units of cultivation progress condensed directly.`
            };
        case 'extend_lifespan': {
            // Lifespan is a realm property; a longevity pill buys years by
            // taking them off the clock, not by raising the ceiling.
            //
            // What it buys is decided by `lifespanYearsFor`, not by `potency`,
            // because a refinement is bounded by the refiner: nothing any
            // living alchemist can set holds past three hundred years, and
            // nothing they can set holds at all in a body past Nascent Soul.
            // The rule is about who made the pill and never about which pill
            // it is - see `MODERN_REFINEMENT` in `pills.ts`.
            //
            // A refusal is still a consumption. The pill is spent either way,
            // which is the honest outcome and the one a narrator has to be
            // able to report: the engine says it did nothing, and the prose
            // does not get to soften that.
            const years = lifespanYearsFor(pill, cultivator.realmOrdinal);
            const refusal = lifespanRefusalReason(pill, cultivator.realmOrdinal);
            if (years <= 0) {
                return {
                    ...base,
                    deltas: {},
                    summary: refusal
                        ?? 'The refinement did not set. The pill was wasted.'
                };
            }
            const capped = years < pill.potency;
            return {
                ...base,
                deltas: { age: -years },
                summary: capped
                    ? `${years} years taken back off the body's clock. The pill is rated for `
                        + `${pill.potency}, and no refinement set by a living hand holds longer than `
                        + `${MODERN_REFINEMENT.maxLifespanYears}.`
                    : `${years} years taken back off the body's clock.`
            };
        }
        case 'sate_hunger':
            return {
                ...base,
                deltas: {
                    satiety: Math.min(SATIETY_MAX, Math.round(pill.potency)),
                    starvationTurns: -1000
                },
                summary: `Belly filled: +${Math.round(pill.potency)} satiety, starvation clock reset.`
            };
        case 'grain_abstinence': {
            const until = currentDay + Math.max(1, Math.round(pill.potency));
            return {
                ...base,
                flags: { [FLAG_GRAIN_ABSTINENCE_UNTIL]: String(until) },
                summary:
                    `Grain abstinence until in-world day ${until} (${Math.round(pill.potency)} days). ` +
                    'The flesh stops keeping mortal arithmetic; a long seclusion becomes survivable.'
            };
        }
    }
}

function projectPouch(db: ReturnType<typeof ensureCultivationDb>['db'], cultivatorId: string) {
    return listPouch(db, cultivatorId).map(entry => {
        if (entry.kind === 'pill') {
            const pill = getPill(entry.itemId);
            return {
                kind: 'pill' as const,
                id: entry.itemId,
                name: pill?.name ?? entry.itemId,
                grade: pill?.grade ?? null,
                effect: pill?.effect ?? null,
                potency: pill?.potency ?? null,
                toxicity: pill?.toxicity ?? null,
                value: pill?.value ?? null,
                quantity: entry.quantity
            };
        }
        const herb = getHerb(entry.itemId);
        return {
            kind: 'herb' as const,
            id: entry.itemId,
            name: herb?.name ?? entry.itemId,
            grade: herb?.grade ?? null,
            biome: herb?.biome ?? null,
            value: herb?.value ?? null,
            quantity: entry.quantity
        };
    });
}

export async function handleInventory(args: z.infer<typeof InventorySchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const pouch = projectPouch(repos.db, cultivator.id);
    const day = Math.floor(run.elapsedDays);

    return {
        cultivator: { id: cultivator.id, name: cultivator.name },
        spiritStones: cultivator.spiritStones,
        pills: pouch.filter(p => p.kind === 'pill'),
        herbs: pouch.filter(p => p.kind === 'herb'),
        totalValue: pouch.reduce((sum, p) => sum + (p.value ?? 0) * p.quantity, 0),
        toxicity: {
            accumulated: round4(readNumberFlag(repos.db, cultivator.id, FLAG_PILL_TOXICITY, 0)),
            tolerance: TOXICITY_TOLERANCE
        },
        grainAbstinenceUntilDay:
            readNumberFlag(repos.db, cultivator.id, FLAG_GRAIN_ABSTINENCE_UNTIL, -1) > day
                ? readNumberFlag(repos.db, cultivator.id, FLAG_GRAIN_ABSTINENCE_UNTIL, -1)
                : null,
        catalogSize: { pills: PILLS.length, recipes: RECIPES.length }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<AlchemyAction, ActionDefinition> = {
    list_recipes: {
        schema: ListRecipesSchema,
        handler: handleListRecipes,
        aliases: ['recipes', 'formulas', 'list'],
        description: 'Formulas in reach, with ingredient stock and estimated odds'
    },
    refine: {
        schema: RefineSchema,
        handler: handleRefine,
        aliases: ['craft', 'concoct', 'brew'],
        description: 'Attempt a refinement; the engine rolls it and burns the ingredients either way'
    },
    consume_pill: {
        schema: ConsumePillSchema,
        handler: handleConsumePill,
        aliases: ['consume', 'take_pill', 'swallow', 'eat_pill'],
        description: 'Swallow a pill; the engine applies its catalog effect and its toxicity'
    },
    inventory: {
        schema: InventorySchema,
        handler: handleInventory,
        aliases: ['pouch', 'bag', 'stock'],
        description: 'Pills, herbs, spirit stones and accumulated toxicity'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const AlchemyManageTool = {
    name: 'alchemy_manage',
    description: `Pills: refining them, swallowing them, and paying for them.

- list_recipes  formulas in reach, what they need, what is in the pouch, estimated odds
- refine        the engine rolls success from the recipe's base rate plus realm margin, Insight
                and any supplementary herbs. Ingredients burn whether or not a pill comes out.
- consume_pill  the pill's own catalog row decides the effect. Toxicity accumulates on the body
                and eventually becomes a real poison injury.
- inventory     the pouch, spirit stones, accumulated toxicity, grain-abstinence status

A pill taken to help a breakthrough is RECORDED and spent by cultivation_manage.breakthrough at
the moment of the attempt. There is no way to assert a pill bonus into an attempt.

Actions: ${ACTIONS.join(', ')}
Aliases: recipes/formulas->list_recipes, craft/brew->refine, swallow->consume_pill, pouch->inventory`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        recipeId: z.string().optional(),
        pillId: z.string().optional(),
        effect: z.string().optional(),
        includeOutOfReach: z.boolean().optional(),
        supplements: z.array(z.object({
            herbId: z.string(),
            quantity: z.number().int()
        })).optional()
    })
};

export async function handleAlchemyManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Alchemy Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
            if (data.missing) {
                output += RichFormatter.section('Missing Ingredients');
                output += RichFormatter.table(
                    ['Herb', 'Need', 'Have'],
                    data.missing.map((m: { name: string; required: number; held: number }) => [
                        m.name, String(m.required), String(m.held)
                    ])
                );
            }
        } else if (data.refined) {
            output = RichFormatter.header(
                data.succeeded ? 'Refinement Succeeded' : 'Refinement Failed',
                data.succeeded ? '⚗️' : '💨'
            );
            output += RichFormatter.keyValue({
                'Formula': data.recipe?.name,
                'Chance': `${data.odds?.finalChancePercent}%`,
                'Roll': data.odds?.roll,
                'Produced': data.produced?.name ?? 'nothing'
            });
        } else if (data.consumed) {
            output = RichFormatter.header(`Consumed: ${data.pill?.name}`, '💊');
            output += RichFormatter.keyValue({
                'Effect': data.pill?.effect,
                'Applied': data.applied,
                'Toxicity': `${data.toxicity?.after}/${data.toxicity?.tolerance}`
            });
            if (data.toxicity?.crossedThreshold) {
                output += RichFormatter.alert('Accumulated pill toxicity tore a meridian.', 'warning');
            }
        } else if (data.recipes) {
            output = RichFormatter.header(`Formulas (${data.count})`, '📗');
            output += RichFormatter.table(
                ['Name', 'Req.', 'Base', 'Est.', 'Ready'],
                data.recipes.map((r: Record<string, unknown>) => [
                    String(r.name), String(r.requiredRank), String(r.baseSuccessRate),
                    String(r.estimatedSuccessRate), r.canAttempt ? 'yes' : 'no'
                ])
            );
        } else if (data.pills) {
            output = RichFormatter.header('Pouch', '🎒');
            output += RichFormatter.keyValue({
                'Spirit stones': data.spiritStones,
                'Pills': data.pills.length,
                'Herbs': data.herbs.length,
                'Toxicity': `${data.toxicity?.accumulated}/${data.toxicity?.tolerance}`
            });
        } else {
            output = RichFormatter.header('Alchemy', '⚗️');
            output += JSON.stringify(data, null, 2) + '\n';
        }

        output += RichFormatter.embedJson(data, 'ALCHEMY_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
