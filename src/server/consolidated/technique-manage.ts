/**
 * Consolidated Technique Tool - `technique_manage`
 *
 * Arts: what a cultivator can learn, how well they hold it, and what it costs
 * them to hold something their meridians were not built for.
 *
 * AUTHORITY BOUNDARY
 * ------------------
 * - `list_available` filters by realm ordinal and by spirit-root compatibility,
 *   and applies the root's own `techniqueAvailability` as a seeded per-run draw.
 *   A mutated-lightning cultivator does not get to decide that a lightning
 *   manual happens to be lying around; the run seed decided that already.
 * - `learn` never silently accepts a conflicting element. It routes the attempt
 *   through the engine's deviation logic (`rollDeviation` / `resolveDeviation`)
 *   and persists whatever that produced - a torn meridian, burned progress, lost
 *   HP, and death if the state was already at the edge.
 * - `practise` and `use` compute their own numbers. The caller supplies days or
 *   a target, never a mastery value, a damage roll or a result.
 */

import { z } from 'zod';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import { DiceEngine } from '../../math/dice.js';
import type { Technique } from '../../schema/cultivation.js';
import {
    DAYS_PER_YEAR,
    conflictsWithRoot,
    deriveSeed,
    deviationRisk,
    evaluateDeathConditions,
    forStream,
    getSpiritRoot,
    rankName,
    resolveDeviation,
    rollDeviation
} from '../../engine/cultivation/index.js';
import {
    TECHNIQUES,
    findTechniquesForOrdinal,
    getTechnique,
    gradeRank
} from '../../data/cultivation/techniques.js';
import {
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    resolveActiveRun,
    round2,
    round4,
    summariseInjury,
    type CultivationRepos
} from './cultivation-support.js';
import { describeDeath } from '../../engine/cultivation/survival.js';

const ACTIONS = ['list_available', 'learn', 'practise', 'use', 'forget'] as const;
type TechniqueAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// TUNING
// Documented here because the engine module does not own technique mastery.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mastery gained per day of dedicated practice at neutral Insight on a
 * mortal-grade art. 0.004 puts full mastery of a mortal manual at roughly 250
 * days - long enough that mastery is a commitment, short enough that a first
 * art is masterable inside a Qi Condensation lifetime.
 */
export const MASTERY_BASE_PER_DAY = 0.004;

/** Insight 1..4 maps to 0.75x .. 1.5x. Comprehension is archaeology. */
function insightFactor(insight: number): number {
    return 0.5 + insight * 0.25;
}

/** Higher grades are slower to internalise: mortal 1x down to chaos 1/5x. */
function gradeFactor(grade: Technique['grade']): number {
    return 1 / (1 + gradeRank(grade));
}

/** Practising the wrong element is not merely dangerous, it is slow. */
const CONFLICT_MASTERY_FACTOR = 0.5;

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ListAvailableSchema = z.object({
    action: z.literal('list_available'),
    cultivatorId: z.string().optional(),
    category: z.enum(['attack', 'defense', 'movement', 'support', 'cultivation', 'forbidden']).optional(),
    includeConflicting: z.boolean().optional().default(true)
        .describe('Show arts whose element fights this root, with the deviation risk stated'),
    includeForbidden: z.boolean().optional().default(false)
});

const LearnSchema = z.object({
    action: z.literal('learn'),
    techniqueId: z.string().describe('Catalog id of the art'),
    cultivatorId: z.string().optional()
});

const PractiseSchema = z.object({
    action: z.literal('practise'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional(),
    days: z.number().min(1).max(3_650_000).optional().default(30),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional()
});

const UseSchema = z.object({
    action: z.literal('use'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional(),
    targetId: z.string().optional().describe('Narrative target label; the engine records it, it does not resolve combat here')
});

const ForgetSchema = z.object({
    action: z.literal('forget'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether the world of THIS run contains a copy of this art the cultivator
 * could plausibly get hold of.
 *
 * Mutated roots cultivate faster and hit harder than anyone and then discover
 * the world has almost no manuals they can use. That scarcity is a property of
 * the run, not of the moment, so the draw is keyed to (seed, techniqueId) and
 * gives the same answer every time it is asked.
 */
function isAvailableInRun(seed: string, spiritRootKey: string, technique: Technique): boolean {
    const root = getSpiritRoot(spiritRootKey as Parameters<typeof getSpiritRoot>[0]);
    if (root.techniqueAvailability >= 1) return true;
    // Scarcity only bites on arts of the root's own element; everything else is
    // as common as it ever was (and as useless to this root as it ever was).
    if (technique.element === null || !root.elements.includes(technique.element)) return true;
    return forStream(seed, 'technique_availability', technique.id).next() < root.techniqueAvailability;
}

/** The catalog row must exist before the join table can reference it. */
function ensureCatalogRow(repos: CultivationRepos, technique: Technique): void {
    if (!repos.techniques.getById(technique.id)) repos.techniques.upsert(technique);
}

function projectTechnique(
    technique: Technique,
    spiritRootKey: string,
    extra: Record<string, unknown> = {}
): Record<string, unknown> {
    const root = getSpiritRoot(spiritRootKey as Parameters<typeof getSpiritRoot>[0]);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);
    return {
        id: technique.id,
        name: technique.name,
        category: technique.category,
        grade: technique.grade,
        element: technique.element,
        requiredOrdinal: technique.requiredOrdinal,
        requiredRank: rankName(technique.requiredOrdinal),
        qiCost: technique.qiCost,
        damage: technique.damage,
        cooldown: technique.cooldown,
        description: technique.description,
        rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral',
        matchedBonus: matched ? root.matchedTechniqueBonus : 1,
        ...extra
    };
}

function totalPractiseDays(args: { days?: number; months?: number; years?: number }): number {
    const days = args.days ?? 0;
    const months = args.months ?? 0;
    const years = args.years ?? 0;
    return Math.floor(days + months * 30 + years * DAYS_PER_YEAR);
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleListAvailable(
    args: z.infer<typeof ListAvailableSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const root = getSpiritRoot(cultivator.spiritRoot);
    const known = new Set(repos.techniques.listKnown(cultivator.id).map(t => t.id));

    const eligible = findTechniquesForOrdinal(cultivator.realmOrdinal, {
        category: args.category,
        excludeForbidden: !(args.includeForbidden ?? false)
    });

    const compatible: Record<string, unknown>[] = [];
    const conflicting: Record<string, unknown>[] = [];
    let scarcityFiltered = 0;

    for (const technique of eligible) {
        if (!isAvailableInRun(run.seed, cultivator.spiritRoot, technique)) {
            scarcityFiltered++;
            continue;
        }
        const conflicts =
            technique.element !== null && conflictsWithRoot(root, technique.element);
        const wrongElement =
            technique.element !== null && !root.elements.includes(technique.element) && !conflicts;

        // An art of an element the root cannot channel at all is not learnable;
        // an art that FIGHTS the root is learnable and dangerous, which is the
        // trade the genre is actually about.
        if (wrongElement) continue;

        const projected = projectTechnique(technique, cultivator.spiritRoot, {
            known: known.has(technique.id)
        });

        if (conflicts) {
            const risk = deviationRisk(cultivator, { techniqueElement: technique.element });
            conflicting.push({
                ...projected,
                deviationRiskPerCheck: round4(risk.risk),
                deviationSources: risk.sources.map(s => ({ source: s.source, delta: round4(s.delta) })),
                warning:
                    'Learning this routes through the engine\'s qi-deviation logic. It may tear meridians on the spot.'
            });
        } else {
            compatible.push(projected);
        }
    }

    return {
        cultivator: { id: cultivator.id, name: cultivator.name, rank: rankName(cultivator.realmOrdinal) },
        spiritRoot: {
            key: root.key,
            name: root.name,
            elements: root.elements,
            techniqueAvailability: root.techniqueAvailability
        },
        realmOrdinal: cultivator.realmOrdinal,
        compatible,
        conflicting: (args.includeConflicting ?? true) ? conflicting : [],
        counts: {
            compatible: compatible.length,
            conflicting: conflicting.length,
            gatedByRealm: TECHNIQUES.filter(t => t.requiredOrdinal > cultivator.realmOrdinal).length,
            unavailableInThisRun: scarcityFiltered
        },
        note:
            scarcityFiltered > 0
                ? `${scarcityFiltered} arts for this root exist but no copy has surfaced in this run. That is decided by the run seed, not by asking again.`
                : undefined
    };
}

export async function handleLearn(args: z.infer<typeof LearnSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const technique = getTechnique(args.techniqueId);
    if (!technique) {
        return guidingError('unknown_technique', `No art with id ${args.techniqueId} exists.`, {
            hint: 'technique_manage({ action: "list_available" }) lists what this cultivator can reach.'
        });
    }

    if (repos.techniques.knows(cultivator.id, technique.id)) {
        return guidingError('already_known', `${cultivator.name} already knows ${technique.name}.`, {
            hint: 'Use practise to raise mastery.'
        });
    }

    if (technique.requiredOrdinal > cultivator.realmOrdinal) {
        return guidingError(
            'realm_too_low',
            `${technique.name} requires ${rankName(technique.requiredOrdinal)}; ${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}.`,
            {
                requiredOrdinal: technique.requiredOrdinal,
                currentOrdinal: cultivator.realmOrdinal
            }
        );
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    if (
        technique.element !== null &&
        !root.elements.includes(technique.element) &&
        !conflictsWithRoot(root, technique.element)
    ) {
        return guidingError(
            'incompatible_element',
            `A ${root.name} cannot channel ${technique.element} at all. The aperture is the wrong shape.`,
            { rootElements: root.elements, techniqueElement: technique.element }
        );
    }

    if (!isAvailableInRun(run.seed, cultivator.spiritRoot, technique)) {
        return guidingError(
            'no_copy_in_this_run',
            `${technique.name} exists, but no copy has surfaced in this run. Manuals for a ${root.name} are scarce.`,
            {
                techniqueAvailability: root.techniqueAvailability,
                hint: 'This is fixed by the run seed. Asking again returns the same answer.'
            }
        );
    }

    const conflicts =
        technique.element !== null && conflictsWithRoot(root, technique.element);

    const day = Math.floor(run.elapsedDays);
    const nextTurn = run.turn + 1;

    // ── Conflicting arts route through the deviation engine. ──
    let deviation: {
        deviated: boolean;
        risk: number;
        roll: number;
        resolution: ReturnType<typeof resolveDeviation> | null;
    } | null = null;

    if (conflicts) {
        const check = rollDeviation(
            cultivator,
            forStream(run.seed, 'technique_learn', day, technique.id),
            { techniqueElement: technique.element }
        );
        deviation = {
            deviated: check.deviated,
            risk: round4(check.risk),
            roll: round4(check.roll),
            resolution: check.deviated
                ? resolveDeviation(
                    cultivator,
                    forStream(run.seed, 'technique_learn_resolve', day, technique.id),
                    { turn: nextTurn, escalate: true }
                )
                : null
        };
    }

    let death: { cause: string; description: string } | null = null;

    const persist = repos.db.transaction(() => {
        ensureCatalogRow(repos, technique);
        repos.techniques.learn(cultivator.id, technique.id, 0);

        if (deviation?.resolution) {
            const res = deviation.resolution;
            for (const injury of res.injuries) {
                repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    cultivationPenalty: injury.cultivationPenalty,
                    breakthroughPenalty: injury.breakthroughPenalty
                });
            }
            repos.cultivators.applyDeltas(cultivator.id, {
                cultivationProgress: -res.progressLost,
                hp: -res.hpLost
            });
        }

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
    const known = repos.techniques.getKnown(cultivator.id, technique.id);

    return {
        learned: true,
        technique: projectTechnique(technique, cultivator.spiritRoot, {
            mastery: known?.mastery ?? 0
        }),
        elementConflict: conflicts,
        deviation: deviation
            ? {
                risk: deviation.risk,
                roll: deviation.roll,
                deviated: deviation.deviated,
                severity: deviation.resolution?.severity ?? null,
                progressLost: deviation.resolution ? round2(deviation.resolution.progressLost) : 0,
                hpLost: deviation.resolution?.hpLost ?? 0,
                injuries: (deviation.resolution?.injuries ?? []).map(summariseInjury),
                summary: deviation.resolution?.summary ?? 'The conflicting qi settled without tearing anything. This time.'
            }
            : null,
        died: death !== null,
        death,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handlePractise(args: z.infer<typeof PractiseSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    const technique = getTechnique(args.techniqueId);
    if (!known || !technique) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`,
            { hint: 'technique_manage({ action: "learn", techniqueId }) first.' }
        );
    }
    if (known.mastery >= 1) {
        return guidingError(
            'already_mastered',
            `${technique.name} is already at full mastery. There is nothing further to understand.`,
            { mastery: known.mastery }
        );
    }

    const days = totalPractiseDays(args);
    if (days <= 0) {
        return guidingError('no_duration', 'Practising for no time at all does nothing.');
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);

    const perDay =
        MASTERY_BASE_PER_DAY *
        insightFactor(cultivator.attributes.insight) *
        gradeFactor(technique.grade) *
        (matched ? root.matchedTechniqueBonus / 2 : 1) *
        (conflicts ? CONFLICT_MASTERY_FACTOR : 1);

    const gain = Math.min(1 - known.mastery, perDay * days);

    const day = Math.floor(run.elapsedDays);
    const nextTurn = run.turn + 1;

    // One deviation check per practice session, on the same terms the time-skip
    // uses. Practising a conflicting art is not free just because it is short.
    const check = rollDeviation(
        cultivator,
        forStream(run.seed, 'technique_practise', day, technique.id),
        { techniqueElement: technique.element }
    );
    const resolution = check.deviated
        ? resolveDeviation(
            cultivator,
            forStream(run.seed, 'technique_practise_resolve', day, technique.id),
            { turn: nextTurn }
        )
        : null;

    let death: { cause: string; description: string } | null = null;

    const persist = repos.db.transaction(() => {
        repos.techniques.addMastery(cultivator.id, technique.id, gain);

        if (resolution) {
            for (const injury of resolution.injuries) {
                repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    cultivationPenalty: injury.cultivationPenalty,
                    breakthroughPenalty: injury.breakthroughPenalty
                });
            }
        }

        repos.cultivators.applyDeltas(cultivator.id, {
            age: days / DAYS_PER_YEAR,
            yearsAtCurrentRealm: days / DAYS_PER_YEAR,
            cultivationProgress: resolution ? -resolution.progressLost : 0,
            hp: resolution ? -resolution.hpLost : 0
        });

        repos.techniques.tickCooldowns(cultivator.id, days);
        repos.runs.advanceDays(run.id, days);
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
    const nowKnown = repos.techniques.getKnown(cultivator.id, technique.id);

    return {
        practised: true,
        technique: technique.name,
        techniqueId: technique.id,
        days,
        masteryBefore: round4(known.mastery),
        masteryAfter: round4(nowKnown?.mastery ?? known.mastery),
        masteryGained: round4(gain),
        masteryPerDay: round4(perDay),
        factors: {
            insight: round2(insightFactor(cultivator.attributes.insight)),
            grade: round2(gradeFactor(technique.grade)),
            rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral'
        },
        deviation: {
            risk: round4(check.risk),
            roll: round4(check.roll),
            deviated: check.deviated,
            summary: resolution?.summary ?? null,
            injuries: (resolution?.injuries ?? []).map(summariseInjury)
        },
        died: death !== null,
        death,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleUse(args: z.infer<typeof UseSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    const technique = getTechnique(args.techniqueId);
    if (!known || !technique) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`
        );
    }
    if (known.cooldownRemaining > 0) {
        return guidingError(
            'on_cooldown',
            `${technique.name} is not ready: ${known.cooldownRemaining} turns remain.`,
            { cooldownRemaining: known.cooldownRemaining }
        );
    }
    if (cultivator.qi < technique.qiCost) {
        return guidingError(
            'insufficient_qi',
            `${technique.name} costs ${technique.qiCost} qi; ${cultivator.name} holds ${cultivator.qi}.`,
            { required: technique.qiCost, held: cultivator.qi }
        );
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);

    // Mastery gates the effect. A quarter-learned art half-works, and the
    // engine says by how much rather than leaving it to prose.
    const effectMultiplier = round4(
        (0.25 + 0.75 * known.mastery) * (matched ? root.matchedTechniqueBonus : 1)
    );

    let roll: { expression: string; total: number; steps: string[]; scaled: number } | null = null;
    if (technique.damage) {
        const dice = new DiceEngine(
            deriveSeed(run.seed, 'technique_use', run.turn, technique.id)
        );
        const outcome = dice.roll(technique.damage);
        // `CalculationResult.result` is number | string because the same shape
        // carries algebraic answers; a dice expression always yields a number.
        const total = typeof outcome.result === 'number' ? outcome.result : Number(outcome.result);
        roll = {
            expression: technique.damage,
            total,
            steps: outcome.steps,
            scaled: Math.round(total * effectMultiplier)
        };
    }

    const nextTurn = run.turn + 1;
    const persist = repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { qi: -technique.qiCost });
        repos.techniques.markUsed(cultivator.id, technique.id, nextTurn);
        repos.runs.incrementTurn(run.id, 1);
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        used: true,
        technique: technique.name,
        techniqueId: technique.id,
        category: technique.category,
        target: args.targetId ?? null,
        qiSpent: technique.qiCost,
        qiRemaining: after.qi,
        mastery: round4(known.mastery),
        effectMultiplier,
        rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral',
        roll,
        cooldown: technique.cooldown,
        note:
            'The engine rolled this from the run seed. Narrate the number it returned; do not invent a different one. ' +
            'Combat resolution against a specific opponent belongs to combat_action.'
    };
}

export async function handleForget(args: z.infer<typeof ForgetSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    if (!known) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`
        );
    }

    const forgotten = repos.techniques.forget(cultivator.id, args.techniqueId);
    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        forgotten,
        techniqueId: args.techniqueId,
        techniqueName: known.name,
        masteryLost: round4(known.mastery),
        knownTechniques: after.knownTechniques,
        note: 'What is put down is put down. Re-learning starts the mastery clock again from zero.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<TechniqueAction, ActionDefinition> = {
    list_available: {
        schema: ListAvailableSchema,
        handler: handleListAvailable,
        aliases: ['list', 'available', 'catalog'],
        description: 'Arts this cultivator could learn, gated by realm ordinal and spirit root'
    },
    learn: {
        schema: LearnSchema,
        handler: handleLearn,
        aliases: ['study', 'acquire'],
        description: 'Learn an art; conflicting elements route through the deviation engine'
    },
    practise: {
        schema: PractiseSchema,
        handler: handlePractise,
        aliases: ['practice', 'train', 'drill'],
        description: 'Spend time raising mastery'
    },
    use: {
        schema: UseSchema,
        handler: handleUse,
        aliases: ['cast', 'invoke', 'perform'],
        description: 'Use an art; spends qi, starts its cooldown, rolls its effect'
    },
    forget: {
        schema: ForgetSchema,
        handler: handleForget,
        aliases: ['unlearn', 'drop'],
        description: 'Put an art down'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const TechniqueManageTool = {
    name: 'technique_manage',
    description: `Cultivation arts: what can be learned, how well it is held, and what it costs.

- list_available  arts gated by realm ordinal AND spirit-root compatibility. Conflicting arts are
                  listed separately with their deviation risk, because taking one is a real trade.
- learn           an art whose element fights the root routes through the engine's qi-deviation
                  logic. It can tear meridians on the spot, and it can kill.
- practise        spend days/months/years raising mastery. Time passes; deviation is checked.
- use             spends qi, starts the cooldown, rolls the effect from the run seed.
- forget          put an art down; mastery is lost.

Mutated roots (lightning, ice) will find most of their own manuals simply absent from a run. That
is decided by the run seed. Asking again returns the same answer.

Actions: ${ACTIONS.join(', ')}
Aliases: list/available->list_available, practice/train->practise, cast/invoke->use`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        techniqueId: z.string().optional(),
        targetId: z.string().optional(),
        category: z.enum(['attack', 'defense', 'movement', 'support', 'cultivation', 'forbidden']).optional(),
        includeConflicting: z.boolean().optional(),
        includeForbidden: z.boolean().optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional()
    })
};

export async function handleTechniqueManage(
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
            output = RichFormatter.header('Technique Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.compatible) {
            output = RichFormatter.header('Available Arts', '📜');
            output += RichFormatter.keyValue({
                'Spirit Root': data.spiritRoot?.name,
                'Rank': data.cultivator?.rank,
                'Compatible': data.counts?.compatible,
                'Conflicting': data.counts?.conflicting,
                'Gated by realm': data.counts?.gatedByRealm,
                'Absent from this run': data.counts?.unavailableInThisRun
            });
            if (data.compatible.length) {
                output += RichFormatter.section('Compatible');
                output += RichFormatter.table(
                    ['Name', 'Grade', 'Element', 'Req.', 'Qi', 'Known'],
                    data.compatible.map((t: Record<string, unknown>) => [
                        String(t.name), String(t.grade), String(t.element ?? '-'),
                        String(t.requiredOrdinal), String(t.qiCost), t.known ? 'yes' : ''
                    ])
                );
            }
            if (data.conflicting?.length) {
                output += RichFormatter.section('Conflicting (qi deviation risk)');
                output += RichFormatter.table(
                    ['Name', 'Element', 'Risk/check'],
                    data.conflicting.map((t: Record<string, unknown>) => [
                        String(t.name), String(t.element), String(t.deviationRiskPerCheck)
                    ])
                );
            }
        } else if (data.learned) {
            output = RichFormatter.header(`Learned: ${data.technique?.name}`, '📖');
            if (data.deviation?.deviated) {
                output += RichFormatter.alert(data.deviation.summary, 'warning');
            }
            if (data.died) output += RichFormatter.alert(data.death?.description ?? 'Dead.', 'error');
        } else if (data.practised) {
            output = RichFormatter.header(`Practised: ${data.technique}`, '🥋');
            output += RichFormatter.keyValue({
                'Days': data.days,
                'Mastery': `${data.masteryBefore} -> ${data.masteryAfter}`,
                'Deviated': data.deviation?.deviated ? 'yes' : 'no'
            });
        } else if (data.used) {
            output = RichFormatter.header(`Used: ${data.technique}`, '⚔️');
            output += RichFormatter.keyValue({
                'Qi spent': data.qiSpent,
                'Mastery': data.mastery,
                'Effect x': data.effectMultiplier,
                'Roll': data.roll ? `${data.roll.expression} = ${data.roll.total} (scaled ${data.roll.scaled})` : '-'
            });
        } else {
            output = RichFormatter.header('Techniques', '📜');
            output += JSON.stringify(data, null, 2) + '\n';
        }

        output += RichFormatter.embedJson(data, 'TECHNIQUE_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
