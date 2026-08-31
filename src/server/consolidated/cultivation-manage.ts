/**
 * Consolidated Cultivation Tool — `cultivation_manage`
 *
 * The cultivator's own life: rolled talent, accumulated progress, the long
 * seclusion, and the bottleneck that ends most runs.
 *
 * AUTHORITY BOUNDARY
 * ------------------
 * Nothing here accepts an outcome.
 *
 *   create_cultivator  rolls spirit root and attributes SERVER-SIDE from the run
 *                      seed. Any attempt to supply talent is rejected outright
 *                      rather than ignored, so a caller that tried is told it
 *                      failed instead of quietly narrating a lie.
 *   cultivate          hands the whole duration to `simulateTimeSkip` and writes
 *                      exactly what came back — injuries, ranks, death and all.
 *                      A ten-year skip is one call and one transaction.
 *   breakthrough       hands the attempt to `attemptBreakthrough` and returns the
 *                      complete itemised modifier list and the raw roll. The
 *                      numbers are never hidden and never softened.
 *
 * Every random draw comes from `forStream(run.seed, ...)`. There is no
 * `Math.random()` in this file.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import {
    AmbientQiSchema,
    MAX_RANKS_PER_TURN,
    STARTING_SPIRIT_STONES,
    type Cultivator,
    type Element
} from '../../schema/cultivation.js';
import {
    DAYS_PER_YEAR,
    MAX_ORDINAL,
    attemptBreakthrough,
    canAttemptBreakthrough,
    computeBreakthroughOdds,
    computeCultivationRate,
    daysToNextBreakthrough,
    describeDeath,
    forStream,
    fullLadder,
    getSpiritRoot,
    isBreakthroughEligible,
    isRealmBoundary,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    rollAttributes,
    rollSpiritRoot,
    simulateTimeSkip,
    triggersHeavenlyTribulation,
    tribulationStrikeCount,
    tribulationStrikeSurvival,
    WEIGHT_TOTAL,
    type CultivationOptions
} from '../../engine/cultivation/index.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import {
    DEFAULT_LOCATION,
    FLAG_PENDING_PILL,
    clearFlag,
    currentAmbient,
    describeCultivator,
    effectiveLocationId,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    isOnGrainAbstinence,
    listPouch,
    listTolls,
    persistFoundation,
    persistToll,
    ranksGainedThisTurn,
    readJsonFlag,
    recordRankGained,
    reconstructSkipInjuries,
    resolveActiveRun,
    round2,
    round4,
    skipEndState,
    summariseInjury,
    tollConditionsFor,
    totalDays,
    type CultivationRepos,
    type PendingPill
} from './cultivation-support.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ACTIONS = [
    'create_cultivator', 'get', 'list', 'cultivate', 'breakthrough', 'status', 'ladder'
] as const;
type CultivationAction = typeof ACTIONS[number];

/**
 * Talent-shaped keys a caller must never supply.
 *
 * Rejected loudly rather than stripped: a schema that silently drops
 * `spiritRoot` lets an agent believe it chose one and narrate accordingly,
 * which is precisely the hallucination surface this engine exists to close.
 */
const FORBIDDEN_TALENT_KEYS = [
    'spiritRoot', 'spirit_root', 'spiritroot', 'root',
    'attributes', 'might', 'insight', 'fortune', 'charm',
    'talent', 'grade', 'elements',
    'realmOrdinal', 'realm_ordinal', 'realm', 'cultivationProgress', 'cultivation_progress'
];

/** Derived, not chosen: a body holds ash in proportion to Might. */
function maxHpFor(might: number, ordinal: number): number {
    return 20 + might * 10 + ordinal * 5;
}

/** Derived, not chosen: an aperture's throughput follows Insight. */
function maxQiFor(insight: number, ordinal: number): number {
    return 10 + insight * 5 + ordinal * 4;
}

/** How the time is being spent. Sealed seclusion is the full rate. */
const FOCUS_MULTIPLIERS = {
    seclusion: 1,
    steady: 0.6,
    travelling: 0.3,
    idle: 0
} as const;
type FocusMode = keyof typeof FOCUS_MULTIPLIERS;

/** Sect support per rank step: elder guidance, arrays, a stipend that feeds you. */
const SECT_BONUS_PER_RANK = 0.05;

/** One ration fills the belly once, and a full belly covers 50 turn-actions. */
export const RATION_COST_STONES = 2;

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const CreateCultivatorSchema = z
    .object({
        action: z.literal('create_cultivator'),
        name: z.string().min(1).max(100).describe('The cultivator\'s name. The only thing the caller chooses.'),
        kind: z.enum(['pc', 'npc', 'enemy', 'neutral']).optional().default('pc'),
        location: z.string().optional().describe('Free-text place name where the run begins'),
        seed: z.string().min(1).optional()
            .describe('Run seed. Omit to mint one. Supplying a known seed replays a known run; it does not choose talent.'),
        age: z.number().min(0).max(200).optional().default(16),
        runId: z.string().optional().describe('Attach an NPC cultivator to an existing run instead of opening one')
    })
    .passthrough()
    .superRefine((value, ctx) => {
        for (const key of FORBIDDEN_TALENT_KEYS) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [key],
                    message:
                        `Talent is not caller-chosen. "${key}" is rolled server-side from the run seed and locked for the run. ` +
                        'Remove it and call again; the engine will tell you what was drawn.'
                });
            }
        }
    });

const GetSchema = z.object({
    action: z.literal('get'),
    cultivatorId: z.string().optional().describe('Defaults to the active run\'s cultivator')
});

const ListSchema = z.object({
    action: z.literal('list'),
    runId: z.string().optional(),
    kind: z.enum(['pc', 'npc', 'enemy', 'neutral']).optional(),
    alive: z.boolean().optional()
});

const CultivateSchema = z.object({
    action: z.literal('cultivate'),
    cultivatorId: z.string().optional(),
    days: z.number().min(0).max(3_650_000).optional(),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional()
        .describe('"I cultivate for ten years" is one call; the engine resolves it in one pass'),
    focus: z.enum(['seclusion', 'steady', 'travelling', 'idle']).optional().default('seclusion'),
    techniqueId: z.string().optional()
        .describe('Cultivation manual practised throughout. Must already be known.'),
    location: z.string().optional().describe('Move here first; ambient qi follows the place'),
    rations: z.number().int().min(0).max(10_000).optional().default(0)
        .describe(`Rations to carry. Each costs ${RATION_COST_STONES} spirit stones and refills the belly once.`),
    autoBreakthrough: z.boolean().optional().default(true),
    randomEvents: z.boolean().optional().default(true)
});

const BreakthroughSchema = z.object({
    action: z.literal('breakthrough'),
    cultivatorId: z.string().optional()
});

const StatusSchema = z.object({
    action: z.literal('status'),
    cultivatorId: z.string().optional()
});

const LadderSchema = z.object({
    action: z.literal('ladder'),
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL).optional().default(0),
    toOrdinal: z.number().int().min(0).max(MAX_ORDINAL).optional().default(MAX_ORDINAL)
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Roll talent from a seeded sub-stream.
 *
 * The stream coordinate includes a nonce so two cultivators created in the same
 * run do not share a draw, and excludes anything the caller controls beyond the
 * name — there is no input that biases the result toward a better root.
 */
function rollTalent(seed: string, nonce: number) {
    const rootRng = forStream(seed, 'spirit_root', nonce);
    const attrRng = forStream(seed, 'attributes', nonce);
    const spiritRoot = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);
    return { spiritRoot, attributes };
}

/** Rate options assembled from persisted state only. No caller-supplied bonuses. */
function cultivationOptionsFor(
    repos: CultivationRepos,
    cultivator: Cultivator,
    focus: FocusMode,
    techniqueId: string | undefined
): { options: CultivationOptions; techniqueElement: Element | null; techniqueName: string | null } {
    let techniqueBonus = 1;
    let techniqueElement: Element | null = null;
    let techniqueName: string | null = null;

    if (techniqueId) {
        const known = repos.techniques.getKnown(cultivator.id, techniqueId);
        const catalog = getTechnique(techniqueId);
        if (known && catalog) {
            techniqueName = catalog.name;
            techniqueElement = catalog.element ?? null;
            const root = getSpiritRoot(cultivator.spiritRoot);
            const matched =
                catalog.element !== null && root.elements.includes(catalog.element);
            // Mastery is the multiplier's spine: a manual you half understand
            // is half a manual.
            techniqueBonus =
                1 + known.mastery * 0.5 * (matched ? root.matchedTechniqueBonus / 2 : 1);
        }
    }

    let sectBonus = 1;
    const membership = repos.sects.getMembership(cultivator.id);
    if (membership) sectBonus = 1 + SECT_BONUS_PER_RANK * (membership.rankIndex + 1);

    return {
        options: {
            techniqueBonus,
            sectBonus,
            locationBonus: 1,
            focusMultiplier: FOCUS_MULTIPLIERS[focus]
        },
        techniqueElement,
        techniqueName
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCreateCultivator(
    args: z.infer<typeof CreateCultivatorSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const kind = args.kind ?? 'pc';

    let seed: string;
    let runIdToAttach: string | null = null;
    let openRun = false;

    if (kind === 'pc') {
        // One live run at a time. Without this a caller could create cultivator
        // after cultivator until a single root came up, which is exactly the
        // reroll the genre — and permadeath — forbid.
        const existing = repos.runs.getActiveRun();
        if (existing && !args.runId) {
            return guidingError(
                'active_run_exists',
                `Run ${existing.id} is still live. Talent is drawn once per run and there is no reroll.`,
                {
                    runId: existing.id,
                    cultivatorId: existing.cultivatorId,
                    hint: 'End or finish the current run before starting another. run_manage({ action: "current" }) shows it.'
                }
            );
        }
        if (args.runId) {
            const run = repos.runs.getById(args.runId);
            if (!run || run.status !== 'active') {
                return guidingError('unknown_run', `No active run with id ${args.runId}.`);
            }
            seed = run.seed;
            runIdToAttach = run.id;
        } else {
            seed = args.seed ?? randomUUID();
            openRun = true;
        }
    } else {
        const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();
        if (!run) {
            return guidingError(
                'no_active_run',
                'An NPC cultivator needs a run to draw its talent from.',
                { hint: 'Create the player cultivator first; that opens the run.' }
            );
        }
        seed = run.seed;
        runIdToAttach = run.id;
    }

    // Nonce keyed to how many cultivators this seed has already produced, so
    // repeated creation is deterministic yet never repeats a draw.
    const nonce = repos.cultivators.list().length;
    const { spiritRoot, attributes } = rollTalent(seed, nonce);

    const id = randomUUID();
    const maxHp = maxHpFor(attributes.might, 0);
    const maxQi = maxQiFor(attributes.insight, 0);

    const created = repos.db.transaction(() => {
        const cultivator = repos.cultivators.create({
            id,
            runId: runIdToAttach ?? undefined,
            name: args.name,
            kind,
            spiritRoot: spiritRoot.key,
            attributes,
            realmOrdinal: 0,
            cultivationProgress: 0,
            hp: maxHp,
            maxHp,
            qi: maxQi,
            maxQi,
            age: args.age ?? 16,
            location: args.location ?? DEFAULT_LOCATION,
            spiritStones: STARTING_SPIRIT_STONES
        });
        const run = openRun ? repos.runs.startRun({ cultivatorId: id, seed }) : null;
        return { cultivator, run };
    })();

    const run = created.run ?? (runIdToAttach ? repos.runs.getById(runIdToAttach) : null);
    const stored = repos.cultivators.getById(id)!;

    return {
        created: true,
        cultivator: describeCultivator(repos, stored, run),
        talentRoll: {
            seedStream: `spirit_root / attributes, nonce ${nonce}`,
            spiritRoot: spiritRoot.key,
            spiritRootName: spiritRoot.name,
            grade: spiritRoot.grade,
            probability: round4(spiritRoot.weight / WEIGHT_TOTAL),
            description: spiritRoot.description,
            attributes,
            locked: true,
            note: 'Rolled by the engine from the run seed. There is no tool anywhere that changes it.'
        },
        run: run
            ? { id: run.id, seed: run.seed, status: run.status, turn: run.turn, elapsedDays: run.elapsedDays }
            : null
    };
}

export async function handleGet(args: z.infer<typeof GetSchema>): Promise<object> {
    const repos = ensureCultivationDb();

    if (args.cultivatorId) {
        const cultivator = repos.cultivators.getById(args.cultivatorId);
        if (!cultivator) {
            return guidingError('unknown_cultivator', `No cultivator with id ${args.cultivatorId}.`, {
                hint: 'cultivation_manage({ action: "list" }) shows every cultivator in this campaign.'
            });
        }
        const run = cultivator.runId ? repos.runs.getById(cultivator.runId) : null;
        return { cultivator: describeCultivator(repos, cultivator, run) };
    }

    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;
    return { cultivator: describeCultivator(repos, resolved.cultivator, resolved.run) };
}

export async function handleList(args: z.infer<typeof ListSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const cultivators = repos.cultivators.list({
        runId: args.runId,
        kind: args.kind,
        alive: args.alive
    });

    return {
        count: cultivators.length,
        cultivators: cultivators.map(c => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
            rank: rankName(c.realmOrdinal),
            realmOrdinal: c.realmOrdinal,
            spiritRoot: c.spiritRoot,
            spiritRootName: getSpiritRoot(c.spiritRoot).name,
            progress: round2(c.cultivationProgress),
            progressRequired: progressRequiredForOrdinal(c.realmOrdinal),
            breakthroughEligible: isBreakthroughEligible(c),
            age: round2(c.age),
            location: c.location,
            sectId: c.sectId,
            sectRank: c.sectRank,
            alive: c.alive,
            deathCause: c.deathCause
        }))
    };
}

export async function handleCultivate(args: z.infer<typeof CultivateSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run } = resolved;
    let cultivator = resolved.cultivator;

    const days = totalDays(args);
    if (days <= 0) {
        return guidingError('no_duration', 'Cultivating for no time at all does nothing.', {
            hint: 'Supply days, months or years — e.g. { months: 3 } or { years: 10 }.'
        });
    }

    // ── Move first, if asked. Where you sit decides the ambient band. ──
    if (args.location && args.location !== cultivator.location) {
        repos.cultivators.update(cultivator.id, { location: args.location });
        cultivator = repos.cultivators.getById(cultivator.id)!;
    }

    // ── Provisions are bought, not declared. ──
    const rations = args.rations ?? 0;
    const rationCost = rations * RATION_COST_STONES;
    if (rationCost > cultivator.spiritStones) {
        return guidingError(
            'insufficient_stones',
            `${rations} rations cost ${rationCost} spirit stones; ${cultivator.name} holds ${cultivator.spiritStones}.`,
            { required: rationCost, held: cultivator.spiritStones }
        );
    }
    if (rationCost > 0) {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -rationCost });
        cultivator = repos.cultivators.getById(cultivator.id)!;
    }

    if (args.techniqueId && !repos.techniques.knows(cultivator.id, args.techniqueId)) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`,
            { hint: 'technique_manage({ action: "learn", techniqueId }) first.' }
        );
    }

    const startDay = Math.floor(run.elapsedDays);
    const focus = (args.focus ?? 'seclusion') as FocusMode;
    const { options, techniqueElement, techniqueName } = cultivationOptionsFor(
        repos, cultivator, focus, args.techniqueId
    );
    const locationId = effectiveLocationId(repos.db, run.id, cultivator.location, startDay);

    // ── THE SIMULATION. One call, however long the duration. ──
    const result = simulateTimeSkip(cultivator, days, {
        seed: run.seed,
        locationId,
        turn: run.turn,
        startDay,
        options,
        techniqueElement,
        // The Vault charges at every realm boundary crossed during the skip,
        // and it chooses from what this run has actually accumulated. Handing
        // it real rows is what makes "you can read the ledger and see the shape
        // of who you used to be" true rather than decorative.
        toll: tollConditionsFor(repos, cultivator),
        rations,
        grainAbstinence: isOnGrainAbstinence(repos.db, cultivator.id, startDay),
        autoBreakthrough: args.autoBreakthrough ?? true,
        randomEvents: args.randomEvents ?? true
    });

    // ── PERSISTENCE. Everything the simulation decided, or nothing at all. ──
    const before = cultivator;
    const end = skipEndState(before, result);
    const injuries = reconstructSkipInjuries(result, run.turn);
    const ranksGained = Math.max(0, end.realmOrdinal - before.realmOrdinal);
    const nextTurn = run.turn + 1;

    const persist = repos.db.transaction(() => {
        for (const injury of injuries) {
            repos.cultivators.addInjury(before.id, {
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn
            });
        }

        if (ranksGained > 0) {
            repos.cultivators.advanceRealm(before.id, ranksGained);
        }

        // Every instalment the Vault charged during the skip, in the same
        // transaction as the ranks it charged them for.
        for (const toll of result.tolls ?? []) {
            persistToll(repos, run, before.id, toll);
        }

        // Deltas are computed against the row as it stands AFTER the advance,
        // so the stored state equals the simulated state exactly rather than
        // approximately. advanceRealm zeroes progress and the stagnation clock;
        // these deltas put back whatever the simulation actually ended on.
        const mid = repos.cultivators.getById(before.id)!;
        repos.cultivators.applyDeltas(before.id, {
            hp: end.hp - mid.hp,
            qi: end.qi - mid.qi,
            satiety: end.satiety - mid.satiety,
            starvationTurns: end.starvationTurns - mid.starvationTurns,
            spiritStones: end.spiritStones - mid.spiritStones,
            cultivationProgress: end.cultivationProgress - mid.cultivationProgress,
            age: end.age - mid.age,
            yearsAtCurrentRealm: end.yearsAtCurrentRealm - mid.yearsAtCurrentRealm
        });

        repos.techniques.tickCooldowns(before.id, Math.floor(result.simulatedDays));

        // The run clock must be advanced BEFORE the run is closed: advanceDays
        // and incrementTurn only touch active runs, and a death stops the clock
        // at the day it happened, not at the day that was asked for.
        repos.runs.advanceDays(run.id, result.simulatedDays);
        repos.runs.incrementTurn(run.id, 1);
        if (ranksGained > 0) recordRankGained(repos.db, before.id, nextTurn, ranksGained);

        if (result.died && result.deathCause) {
            repos.cultivators.markDead(
                before.id,
                result.deathCause,
                nextTurn,
                describeDeath(result.deathCause, {
                    name: before.name,
                    realmOrdinal: end.realmOrdinal,
                    age: end.age
                })
            );
        }
    });
    persist();

    const after = repos.cultivators.getById(before.id)!;
    const runAfter = repos.runs.getById(run.id)!;
    const rate = computeCultivationRate(
        before,
        currentAmbient(repos.db, run, before.location, startDay),
        options
    );

    return {
        cultivated: true,
        requestedDays: result.requestedDays,
        simulatedDays: result.simulatedDays,
        simulatedYears: round2(result.simulatedDays / DAYS_PER_YEAR),
        stoppedEarly: result.interrupted,
        interruptReason: result.interruptReason,
        died: result.died,
        deathCause: result.deathCause,
        rate: {
            perDay: round4(rate.perDay),
            base: rate.base,
            factors: rate.factors.map(f => ({
                source: f.source,
                label: f.label,
                multiplier: round4(f.multiplier)
            })),
            technique: techniqueName,
            focus,
            note: 'Rate is a product of these multipliers. Nothing the caller passed sets it directly.'
        },
        deltas: {
            ...result.deltas,
            cultivationProgress: round2(result.deltas.cultivationProgress),
            age: round2(result.deltas.age)
        },
        injuriesPersisted: injuries.map(i => ({
            severity: i.severity,
            source: i.source,
            sustainedOnTurn: i.sustainedOnTurn
        })),
        tolls: (result.tolls ?? []).map(toll => ({
            fromOrdinal: toll.fromOrdinal,
            toOrdinal: toll.toOrdinal,
            fromRank: rankName(toll.fromOrdinal),
            toRank: rankName(toll.toOrdinal),
            boundaryIndex: toll.boundaryIndex,
            outcome: toll.outcome,
            risk: round4(toll.risk),
            roll: round4(toll.roll),
            modifiers: toll.modifiers.map(m => ({ source: m.source, delta: round4(m.delta) })),
            taken: toll.taken,
            narrationHint: toll.narrationHint
        })),
        injuryReconciliation: {
            engineReported: result.deltas.injuriesGained,
            persisted: injuries.length,
            consistent: injuries.length === result.deltas.injuriesGained
        },
        events: result.events.map(e => ({
            kind: e.kind,
            dayOffset: e.dayOffset,
            yearOffset: round2(e.dayOffset / DAYS_PER_YEAR),
            summary: e.summary,
            interrupts: e.interrupts,
            data: e.data
        })),
        cultivator: describeCultivator(repos, after, runAfter),
        run: {
            id: runAfter.id,
            status: runAfter.status,
            turn: runAfter.turn,
            elapsedDays: round2(runAfter.elapsedDays),
            elapsedYears: round2(runAfter.elapsedDays / DAYS_PER_YEAR),
            peakOrdinal: runAfter.peakOrdinal,
            endedAt: runAfter.endedAt
        }
    };
}

export async function handleBreakthrough(
    args: z.infer<typeof BreakthroughSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const day = Math.floor(run.elapsedDays);
    const alreadyGained = ranksGainedThisTurn(repos.db, cultivator.id, run.turn);

    const eligibility = canAttemptBreakthrough(cultivator, {
        ranksGainedThisTurn: alreadyGained
    });
    if (!eligibility.eligible) {
        return guidingError(
            `breakthrough_${eligibility.reason}`,
            eligibilityMessage(eligibility.reason, cultivator, eligibility),
            {
                reason: eligibility.reason,
                rank: rankName(cultivator.realmOrdinal),
                progressAvailable: round2(eligibility.progressAvailable),
                progressRequired: eligibility.progressRequired,
                progressRemaining: round2(
                    Math.max(0, eligibility.progressRequired - eligibility.progressAvailable)
                ),
                maxRanksPerTurn: MAX_RANKS_PER_TURN,
                hint:
                    eligibility.reason === 'insufficient_progress'
                        ? 'cultivation_manage({ action: "cultivate", months: N }) accumulates the qi.'
                        : undefined
            }
        );
    }

    // A pill consumed for its breakthrough boost was recorded when it was
    // consumed. The caller cannot pass a potency here; the engine reads what
    // was actually swallowed and spends it.
    const pending = readJsonFlag<PendingPill>(repos.db, cultivator.id, FLAG_PENDING_PILL);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);

    const result = attemptBreakthrough(cultivator, {
        rng: forStream(run.seed, 'breakthrough', day, cultivator.realmOrdinal),
        ambient,
        turn: run.turn,
        pill: pending ? { name: pending.name, potency: pending.potency } : null,
        ranksGainedThisTurn: alreadyGained,
        // Real candidates from real rows: known techniques and the people in
        // this run who know this cultivator. The Vault picks; nobody asks.
        toll: tollConditionsFor(repos, cultivator)
    });

    const nextTurn = run.turn + 1;
    const died = result.outcome === 'death';
    const deathCause = died
        ? (result.tribulation ? 'heavenly_tribulation' as const : 'failed_breakthrough' as const)
        : null;

    const persist = repos.db.transaction(() => {
        for (const injury of result.injuriesSustained) {
            repos.cultivators.addInjury(cultivator.id, {
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                cultivationPenalty: injury.cultivationPenalty,
                breakthroughPenalty: injury.breakthroughPenalty,
                treated: injury.treated
            });
        }

        if (result.outcome === 'success') {
            // advanceRealm clears the progress that was consumed and restarts
            // the stagnation clock, which is exactly what a success does.
            repos.cultivators.advanceRealm(cultivator.id, result.toOrdinal - result.fromOrdinal);
            recordRankGained(repos.db, cultivator.id, nextTurn, 1);

            // The rank and its price are one event, so they share one transaction.
            if (result.foundationEstablished) {
                persistFoundation(repos, cultivator.id, result.foundationEstablished);
            }
            if (result.toll) {
                persistToll(repos, run, cultivator.id, result.toll);
            }
        } else {
            repos.cultivators.applyDeltas(cultivator.id, {
                cultivationProgress: -result.progressConsumed
            });
        }

        if (pending) clearFlag(repos.db, cultivator.id, FLAG_PENDING_PILL);

        repos.runs.incrementTurn(run.id, 1);

        if (died && deathCause) {
            repos.cultivators.markDead(
                cultivator.id,
                deathCause,
                nextTurn,
                describeDeath(deathCause, cultivator)
            );
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        attempted: true,
        outcome: result.outcome,
        fromOrdinal: result.fromOrdinal,
        fromRank: rankName(result.fromOrdinal),
        toOrdinal: result.toOrdinal,
        toRank: rankName(result.toOrdinal),
        wasRealmBoundary: isRealmBoundary(result.fromOrdinal),
        // The whole arithmetic, itemised. Never summarised, never hidden.
        odds: {
            finalChance: round4(result.finalChance),
            finalChancePercent: round2(result.finalChance * 100),
            roll: round4(result.roll),
            succeededBecause: `roll ${round4(result.roll)} ${result.roll < result.finalChance ? '<' : '>='} chance ${round4(result.finalChance)}`,
            modifiers: result.modifiers.map(m => ({
                source: m.source,
                delta: round4(m.delta),
                deltaPercent: round2(m.delta * 100)
            })),
            modifierSum: round4(result.modifiers.reduce((sum, m) => sum + m.delta, 0)),
            ambient,
            pillApplied: pending ? { name: pending.name, potency: pending.potency } : null
        },
        tribulation: result.tribulation,
        // The toll is not a footnote. It is what the crossing actually cost,
        // and the narrator must report it exactly as the engine chose it.
        toll: result.toll
            ? {
                outcome: result.toll.outcome,
                boundaryIndex: result.toll.boundaryIndex,
                risk: round4(result.toll.risk),
                roll: round4(result.toll.roll),
                modifiers: result.toll.modifiers.map(m => ({
                    source: m.source,
                    delta: round4(m.delta)
                })),
                taken: result.toll.taken,
                narrationHint: result.toll.narrationHint
            }
            : null,
        foundationEstablished: result.foundationEstablished,
        injuriesSustained: result.injuriesSustained.map(summariseInjury),
        progressConsumed: round2(result.progressConsumed),
        died,
        deathCause,
        narrationHint: result.narrationHint,
        cultivator: describeCultivator(repos, after, runAfter),
        run: {
            id: runAfter.id,
            status: runAfter.status,
            turn: runAfter.turn,
            elapsedDays: round2(runAfter.elapsedDays),
            peakOrdinal: runAfter.peakOrdinal
        }
    };
}

function eligibilityMessage(
    reason: string | null,
    cultivator: Cultivator,
    eligibility: { progressAvailable: number; progressRequired: number }
): string {
    switch (reason) {
        case 'insufficient_progress':
            return (
                `${cultivator.name} holds ${eligibility.progressAvailable.toFixed(1)} of the ` +
                `${eligibility.progressRequired} qi-units ${rankName(cultivator.realmOrdinal)} requires.`
            );
        case 'at_ladder_summit':
            return `${cultivator.name} stands at ${rankName(MAX_ORDINAL)}. There is nothing above it but the Lid.`;
        case 'rank_cap_reached_this_turn':
            return `Only ${MAX_RANKS_PER_TURN} rank may be gained per turn. Bottlenecks are meant to be lived through.`;
        case 'dead':
            return `${cultivator.name} is dead.`;
        default:
            return 'Breakthrough is not permitted from this state.';
    }
}

export async function handleStatus(args: z.infer<typeof StatusSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const day = Math.floor(run.elapsedDays);
    const ambient = currentAmbient(repos.db, run, cultivator.location, day);
    const rate = computeCultivationRate(cultivator, ambient, {});
    const odds = computeBreakthroughOdds(cultivator, { ambient, pill: null });
    const pending = readJsonFlag<PendingPill>(repos.db, cultivator.id, FLAG_PENDING_PILL);
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);

    return {
        name: cultivator.name,
        rank: rankName(cultivator.realmOrdinal),
        realmOrdinal: cultivator.realmOrdinal,
        spiritRoot: getSpiritRoot(cultivator.spiritRoot).name,
        attributes: cultivator.attributes,
        progress: `${round2(cultivator.cultivationProgress)}/${required}`,
        breakthroughEligible: isBreakthroughEligible(cultivator),
        daysToEligible: Number.isFinite(daysToNextBreakthrough(cultivator, rate.perDay))
            ? daysToNextBreakthrough(cultivator, rate.perDay)
            : null,
        nextIsRealmBoundary: odds.isBoundary,
        breakthroughChanceNow: round4(odds.finalChance),
        tribulationAhead: triggersHeavenlyTribulation(cultivator.realmOrdinal)
            ? {
                strikes: tribulationStrikeCount(cultivator.realmOrdinal),
                perStrikeSurvival: round4(tribulationStrikeSurvival(cultivator, ambient))
            }
            : null,
        hp: `${cultivator.hp}/${cultivator.maxHp}`,
        qi: `${cultivator.qi}/${cultivator.maxQi}`,
        satiety: cultivator.satiety,
        onGrainAbstinence: isOnGrainAbstinence(repos.db, cultivator.id, day),
        age: round2(cultivator.age),
        lifespanRemaining: round2(
            lifespanForOrdinal(cultivator.realmOrdinal) - cultivator.age
        ),
        yearsAtCurrentRealm: round2(cultivator.yearsAtCurrentRealm),
        untreatedInjuries: cultivator.injuries.filter(i => !i.treated).length,
        spiritStones: cultivator.spiritStones,
        location: cultivator.location,
        ambient,
        cultivationPerDay: round4(rate.perDay),
        sect: cultivator.sectId ? { id: cultivator.sectId, rank: cultivator.sectRank } : null,
        knownTechniques: cultivator.knownTechniques.length,
        pouch: listPouch(repos.db, cultivator.id).length,
        pendingBreakthroughPill: pending,
        foundation: cultivator.foundationQuality,
        tollsPaid: listTolls(repos.db, cultivator.id).map(t => ({
            boundary: `${rankName(t.fromOrdinal)} -> ${rankName(t.toOrdinal)}`,
            outcome: t.outcome,
            taken: t.taken ? `${t.taken.kind}: ${t.taken.label}` : null
        })),
        run: {
            id: run.id,
            turn: run.turn,
            elapsedDays: round2(run.elapsedDays),
            elapsedYears: round2(run.elapsedDays / DAYS_PER_YEAR),
            peakRank: rankName(run.peakOrdinal)
        }
    };
}

export async function handleLadder(args: z.infer<typeof LadderSchema>): Promise<object> {
    const from = Math.min(args.fromOrdinal ?? 0, args.toOrdinal ?? MAX_ORDINAL);
    const to = Math.max(args.fromOrdinal ?? 0, args.toOrdinal ?? MAX_ORDINAL);
    const ladder = fullLadder().filter(e => e.ordinal >= from && e.ordinal <= to);

    return {
        totalRanks: MAX_ORDINAL + 1,
        fromOrdinal: from,
        toOrdinal: to,
        ranks: ladder,
        note:
            'Ordinal-addressed on purpose: "is Core Formation above Foundation Perfection" is an integer ' +
            'comparison, never a name comparison. Progress cost grows at 1.35^ordinal; realm boundaries ' +
            'carry a 2.5x progress tax and a 0.45x odds penalty.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<CultivationAction, ActionDefinition> = {
    create_cultivator: {
        schema: CreateCultivatorSchema,
        handler: handleCreateCultivator,
        aliases: ['create', 'new', 'roll', 'begin'],
        description: 'Create a cultivator; the engine rolls spirit root and attributes from the run seed'
    },
    get: {
        schema: GetSchema,
        handler: handleGet,
        aliases: ['fetch', 'find', 'inspect'],
        description: 'Full cultivator state including derived rank, progress and eligibility'
    },
    list: {
        schema: ListSchema,
        handler: handleList,
        aliases: ['all', 'query'],
        description: 'List cultivators'
    },
    cultivate: {
        schema: CultivateSchema,
        handler: handleCultivate,
        aliases: ['seclusion', 'meditate', 'time_skip', 'skip'],
        description: 'Resolve a stretch of cultivation — days, months or years — in one deterministic pass'
    },
    breakthrough: {
        schema: BreakthroughSchema,
        handler: handleBreakthrough,
        aliases: ['advance', 'attempt', 'push'],
        description: 'Attempt the next rank; returns the full itemised odds and the raw roll'
    },
    status: {
        schema: StatusSchema,
        handler: handleStatus,
        aliases: ['summary', 'sheet'],
        description: 'Compact state summary for the narrator'
    },
    ladder: {
        schema: LadderSchema,
        handler: handleLadder,
        aliases: ['ranks', 'realms', 'table'],
        description: 'The 45-rank reference table'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITION & HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export const CultivationManageTool = {
    name: 'cultivation_manage',
    description: `Cultivators, cultivation, and the bottleneck that ends most runs.

THE RULE: you narrate, this tool decides. Never state an outcome this tool did not return.

LIFECYCLE:
1. create_cultivator - the engine rolls spirit root and the four innate attributes from the run
   seed. Talent is NOT caller-chosen; supplying spiritRoot/attributes/etc is rejected.
2. cultivate - "three months" or "ten years" in ONE call. Resolves progress, food, deviation,
   encounters, automatic breakthroughs and death in a single deterministic pass, and returns an
   event digest to narrate. Stops early on death, a wounding breakthrough, a major encounter, or
   the third untreated meridian injury.
3. breakthrough - one attempt at the next rank. Returns every modifier and the raw roll.
   Do not soften them: a torn meridian is a torn meridian.
4. status / get / list - read state. ladder - the 45-rank reference table.

PERMADEATH: when this tool reports a death, the run is closed in the same transaction. There is
no revive, reload or rollback anywhere in this engine.

Actions: ${ACTIONS.join(', ')}
Aliases: create/new/roll->create_cultivator, seclusion/meditate/skip->cultivate, advance/push->breakthrough`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        runId: z.string().optional(),
        name: z.string().optional(),
        kind: z.enum(['pc', 'npc', 'enemy', 'neutral']).optional(),
        location: z.string().optional(),
        seed: z.string().optional(),
        age: z.number().optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional(),
        focus: z.enum(['seclusion', 'steady', 'travelling', 'idle']).optional(),
        techniqueId: z.string().optional(),
        rations: z.number().int().optional(),
        autoBreakthrough: z.boolean().optional(),
        randomEvents: z.boolean().optional(),
        alive: z.boolean().optional(),
        fromOrdinal: z.number().int().optional(),
        toOrdinal: z.number().int().optional(),
        ambient: AmbientQiSchema.optional()
    })
};

export async function handleCultivationManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    return decorate(response);
}

/** Rich formatting over the JSON payload, matching the house pattern. */
function decorate(response: McpResponse): McpResponse {
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        const hasError = data.error === true || typeof data.error === 'string';

        if (hasError) {
            output = RichFormatter.header('Cultivation Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
            if (data.issues) {
                output += RichFormatter.section('Validation Issues');
                output += RichFormatter.list(
                    data.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
                );
            }
        } else if (data.created) {
            output = RichFormatter.header(`Cultivator: ${data.cultivator?.name}`, '🧘');
            output += RichFormatter.keyValue({
                'ID': data.cultivator?.id,
                'Spirit Root': `${data.talentRoll?.spiritRootName} (${data.talentRoll?.grade})`,
                'Draw Odds': `${((data.talentRoll?.probability ?? 0) * 100).toFixed(1)}%`,
                'Rank': data.cultivator?.realm?.name,
                'Run': data.run?.id
            });
            output += RichFormatter.section('Innate Attributes (locked)');
            output += RichFormatter.keyValue(data.talentRoll?.attributes ?? {});
        } else if (data.cultivated) {
            output = RichFormatter.header('Cultivation Resolved', '⛰️');
            output += RichFormatter.keyValue({
                'Requested': `${data.requestedDays} days`,
                'Simulated': `${data.simulatedDays} days (${data.simulatedYears} years)`,
                'Stopped early': data.stoppedEarly ? data.interruptReason : 'no',
                'Rate/day': data.rate?.perDay,
                'Died': data.died ? data.deathCause : 'no'
            });
            if (data.events?.length) {
                output += RichFormatter.section('Event Digest');
                output += RichFormatter.table(
                    ['Day', 'Kind', 'Summary'],
                    data.events.map((e: { dayOffset: number; kind: string; summary: string }) => [
                        String(e.dayOffset), e.kind, e.summary
                    ])
                );
            }
        } else if (data.attempted) {
            output = RichFormatter.header(`Breakthrough: ${data.outcome}`, '⚡');
            output += RichFormatter.keyValue({
                'From': data.fromRank,
                'To': data.toRank,
                'Chance': `${data.odds?.finalChancePercent}%`,
                'Roll': data.odds?.roll,
                'Died': data.died ? data.deathCause : 'no'
            });
            output += RichFormatter.section('Modifier Breakdown');
            output += RichFormatter.table(
                ['Source', 'Delta'],
                (data.odds?.modifiers ?? []).map((m: { source: string; delta: number }) => [
                    m.source, m.delta.toFixed(4)
                ])
            );
        } else if (data.ranks) {
            output = RichFormatter.header('The Cultivation Ladder', '🪜');
            output += RichFormatter.table(
                ['#', 'Rank', 'Lifespan', 'Progress', 'Base odds'],
                data.ranks.map((r: {
                    ordinal: number; name: string; lifespanYears: number;
                    progressRequired: number; baseBreakthroughChance: number; isBoundary: boolean;
                }) => [
                    String(r.ordinal),
                    r.isBoundary ? `${r.name} *` : r.name,
                    String(r.lifespanYears),
                    String(r.progressRequired),
                    r.baseBreakthroughChance.toFixed(3)
                ])
            );
            output += '\n*`*` marks a realm boundary: 2.5x progress cost, 0.45x odds, and the failure table that kills.*\n';
        } else {
            output = RichFormatter.header('Cultivation', '🧘');
            output += RichFormatter.keyValue({
                'Name': data.name ?? data.cultivator?.name,
                'Rank': data.rank ?? data.cultivator?.realm?.name,
                'Progress': data.progress ?? data.cultivator?.progress?.current,
                'Ambient': data.ambient
            });
        }

        output += RichFormatter.embedJson(data, 'CULTIVATION_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}

export { CreateCultivatorSchema, CultivateSchema, BreakthroughSchema };
