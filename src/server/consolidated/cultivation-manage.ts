/**
 * Consolidated Cultivation Tool - `cultivation_manage`
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
 *                      exactly what came back - injuries, ranks, death and all.
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
import {
    PLAYER_ROLL_IDENTITY,
    cutTo,
    daysActuallySpent,
    encountersFor,
    recordEncounters,
    withEncounterDeltas
} from '../../web/encounters.js';
import { KnowledgeGate } from '../../web/knowledge.js';
import { worldForRun } from '../state/cultivation-world.js';
import type { EncounterActivity } from '../../engine/encounters/types.js';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import {
    AmbientQiSchema,
    ApproachSchema,
    MAX_RANKS_PER_TURN,
    type Cultivator,
    type Element,
    type ManualQuality
} from '../../schema/cultivation.js';
import {
    DAYS_PER_YEAR,
    MAX_ORDINAL,
    attemptBreakthrough,
    canAttemptBreakthrough,
    canEndRunVoluntarily,
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
    maxHpForOrdinal,
    maxQiForOrdinal,
    progressRequiredForOrdinal,
    openingPosition,
    rankName,
    rollAttributes,
    rollOrigin,
    rollSpiritRoot,
    simulateTimeSkip,
    triggersHeavenlyTribulation,
    tribulationStrikeCount,
    tribulationStrikeSurvival,
    WEIGHT_TOTAL,
    type CultivationOptions
} from '../../engine/cultivation/index.js';
import { rollSex } from '../../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import {
    advanceWorldForCultivator,
    beginRunInWorld,
    listWorlds,
    seedForNextRun,
    type WorldSummary
} from '../state/cultivation-world.js';
import {
    AssessSchema,
    UnderstandingSchema,
    handleAssess,
    handleUnderstanding
} from './cultivation-perception.js';
import {
    ForageSchema,
    MarketSchema,
    WorkSchema,
    handleForage,
    handleMarket,
    handleWork
} from './cultivation-mortal.js';
import {
    DEFAULT_LOCATION,
    FLAG_PENDING_PILL,
    describeGround,
    groundStandingFor,
    clearFlag,
    currentAmbient,
    describeCultivator,
    discoveryContextFor,
    effectiveLocationId,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    isOnGrainAbstinence,
    listPouch,
    listTolls,
    persistFoundation,
    persistImmortalStatus,
    persistToll,
    persistUnderstanding,
    persistVisions,
    ranksGainedThisTurn,
    readJsonFlag,
    recordRankGained,
    resolveActiveRun,
    round2,
    round4,
    skipEndState,
    summariseInjury,
    summariseInsight,
    tollConditionsFor,
    totalDays,
    type CultivationRepos,
    type PendingPill,
    type TollApplication
} from './cultivation-support.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ACTIONS = [
    'create_cultivator', 'get', 'list', 'cultivate', 'breakthrough', 'status', 'ladder',
    // The narrator's two standing questions, answered by the engine rather than
    // guessed at: what happens if they try, and what have they comprehended.
    'assess', 'understanding',
    // The low-realm loop. Most cultivators are poor and most of a life is spent
    // paying for the next month of it.
    'work', 'market',
    // The ground, priced by who is standing on it.
    'forage'
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

/**
 * Derived, not chosen, and derived in exactly one place.
 *
 * The curve and its calibration live in `realms.ts` under "what a rung buys in
 * body". A second formula here is how the player and the world came to be
 * built differently, so this is a re-export and must stay one.
 */
const maxHpFor = maxHpForOrdinal;
const maxQiFor = maxQiForOrdinal;

/** How the time is being spent. Sealed seclusion is the full rate. */
const FOCUS_MULTIPLIERS = {
    seclusion: 1,
    steady: 0.6,
    travelling: 0.3,
    idle: 0
} as const;
type FocusMode = keyof typeof FOCUS_MULTIPLIERS;

/** Sect support per rank step: elder guidance, arrays, a stipend that feeds you. */
export const SECT_BONUS_PER_RANK = 0.05;

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
    /**
     * Rations ALREADY bought and not yet eaten, carried into a resumed stretch.
     *
     * Added to `rations` and deliberately NOT charged for. Food is bought per
     * stretch, so a caller that resumes an interrupted span would otherwise buy
     * the same pack twice - the rule `src/web/README.md` states for the
     * seclusion crossroads ("the clock is neither handed back nor charged
     * twice"), which reads `endState.rationsRemaining` off the engine and hands
     * it to the resumption. This is the same field on the tool path, and it
     * exists because the two paths must not disagree about what a resumed skip
     * costs. `advance_days` is the caller.
     */
    carriedRations: z.number().int().min(0).max(10_000).optional().default(0),
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
 * Roll everything a cultivator is dealt, from seeded sub-streams.
 *
 * Three things, not two: a spirit root, four attributes, and a place to have
 * been born into. The stream coordinate includes a nonce so two cultivators
 * created in the same run do not share a draw, and excludes anything the caller
 * controls beyond the name - there is no input that biases the result toward a
 * better root or a better birth.
 *
 * `origin` gets its own named stream rather than consuming from the root's, so
 * adding it does not perturb the root or the attributes of any seed that has
 * already been played. An existing run replays to the same talent it always had.
 */
function rollTalent(seed: string, nonce: number) {
    const rootRng = forStream(seed, 'spirit_root', nonce);
    const attrRng = forStream(seed, 'attributes', nonce);
    const originRng = forStream(seed, 'origin', nonce);
    const spiritRoot = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);
    const origin = rollOrigin(originRng.next());
    // Its own stream, for the same reason every line above it has one.
    const sex = rollSex(forStream(seed, 'sex', nonce).next());
    return { spiritRoot, attributes, origin, sex };
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
    // How well the book is written, which is a fact about the object rather
    // than about how much of it you have learned. `techniqueBonus` above is
    // mastery; this is the other axis, and the engine prices it against what
    // this cultivator can take off the page. See `manual-quality.ts`.
    let techniqueQuality: ManualQuality | null = null;

    if (techniqueId) {
        const known = repos.techniques.getKnown(cultivator.id, techniqueId);
        const catalog = getTechnique(techniqueId);
        if (known && catalog) {
            techniqueName = catalog.name;
            techniqueElement = catalog.element ?? null;
            techniqueQuality = catalog.quality;
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
            techniqueQuality,
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
        // reroll the genre - and permadeath - forbid.
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
            // A run is a life lived inside a world that was already running, so
            // its seed hangs off the WORLD's rather than being minted beside
            // it. That is what makes run three of a world always the same run
            // three, and what stops opening a new life perturbing any stream
            // the world has already drawn from. A caller-supplied seed is a
            // deliberate replay of one specific run and is honoured as-is.
            seed = args.seed ?? (await seedForNextRun()).seed;
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
    const { spiritRoot, attributes, origin, sex } = rollTalent(seed, nonce);

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
            origin: origin.key,
            sex,
            // What the family put behind them, not a starting bonus. For nine
            // births in ten this is STARTING_SPIRIT_STONES and nothing else.
            spiritStones: origin.spiritStones
        });
        const run = openRun ? repos.runs.startRun({ cultivatorId: id, seed }) : null;
        return { cultivator, run };
    })();

    const run = created.run ?? (runIdToAttach ? repos.runs.getById(runIdToAttach) : null);
    const stored = repos.cultivators.getById(id)!;

    // The world records that this life is being lived here, and on what day it
    // began. That start day is what joins the two clocks afterwards - a run's
    // elapsed days are measured from it - and it is what makes the NEXT life
    // start in a world this one has already changed.
    let world: WorldSummary | null = null;
    if (run && kind === 'pc') {
        try {
            await beginRunInWorld(run, stored);
            world = listWorlds().find(w => w.active) ?? null;
        } catch {
            // A world that cannot be opened must not stop a life from starting.
            // The cultivator exists and is committed; the join can be made on
            // the first cultivate instead.
            world = null;
        }
    }

    return {
        created: true,
        // The outer object. Runs are its children, and their seeds derive from
        // its own - which is why the previous cultivator's grave is on this map.
        world,
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
        // The third dealt thing. Reported as a position, never as an
        // assessment: nothing here says whether it is a good place to be born,
        // and nothing recommends a path from it.
        originRoll: {
            seedStream: `origin, nonce ${nonce}`,
            // Unrounded on purpose. The three rarest origins together are four
            // births in a hundred thousand and the rarest of them is far below
            // that, and round4 would report those as a probability of zero.
            ...openingPosition(origin.key),
            locked: true,
            note: 'Where this life started. It confers stones, placement, access, standing and supplied risk. It confers no realm, no rank, no admission and no progress.'
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
            hint: 'Supply days, months or years - e.g. { months: 3 } or { years: 10 }.'
        });
    }

    // ── Move first, if asked. Where you sit decides the ambient band. ──
    if (args.location && args.location !== cultivator.location) {
        repos.cultivators.update(cultivator.id, { location: args.location });
        cultivator = repos.cultivators.getById(cultivator.id)!;
    }

    // ── Provisions are bought, not declared. ──
    //
    // Bought is `rations`. `carriedRations` is what a previous stretch paid for
    // and did not eat, so it is added to the pack and charged for nothing.
    const bought = args.rations ?? 0;
    const carried = args.carriedRations ?? 0;
    const rations = bought + carried;
    const rationCost = bought * RATION_COST_STONES;
    if (rationCost > cultivator.spiritStones) {
        return guidingError(
            'insufficient_stones',
            `${bought} rations cost ${rationCost} spirit stones; ${cultivator.name} holds ${cultivator.spiritStones}.`,
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

    // What this cultivator is near enough to comprehend, assembled from rows
    // that exist: arts they can actually read, a sect that will teach, ground
    // somebody has already found. Omitting it is not neutral - it is the
    // difference between an inner disciple and a hermit, and the engine has no
    // library of its own to fall back on.
    const discovery = discoveryContextFor(repos, cultivator, {
        runId: run.id,
        practisingTechniqueId: args.techniqueId ?? null
    });

    // What the ground itself does to somebody who has no business on it. The
    // four thresholds have been calibrated across every place in the world for
    // a long time and until now nothing read them while a cultivator was
    // standing there; this is the join, and it is what makes "better ground is
    // a risk you choose" true rather than a comment.
    const ground = await groundStandingFor(run, cultivator);

    // Barred is a refusal, not a slow death: turned away at the door, no time
    // passed, and the reason names both bars so the player learns that the
    // ladder of places exists.
    if (ground && !ground.consequence.admitted) {
        return guidingError('turned_away_at_the_door', ground.consequence.reason, {
            ...describeGround(ground),
            hint: 'Somewhere lower first. Every place in the world has these four bars, and they are what a rank is FOR.'
        });
    }

    // ══ WHO REACHES THEM WHILE THE SPAN RUNS ═════════════════════════════
    //
    // ── THE DEFECT THIS CLOSES ───────────────────────────────────────────
    //
    // The encounter pipeline - `encountersFor` -> `withEncounterDeltas` ->
    // `recordEncounters` - had exactly ONE caller in the repository:
    // `seclusion-verbs.ts`. So the only span in which a real person could
    // reach the player was the one where they had chosen to sit down and
    // cultivate. Every other span - `work`, and anything else routed through
    // this handler - went through `simulateTimeSkip`'s own internal grid,
    // which raises a `major_encounter` interrupt and nothing else. That file
    // says so in its own words: nothing there materialises anybody.
    //
    // Sitting still was therefore a perfect shield, not because idle is safe
    // but because the arrival machinery was wired only to the verb that is not
    // idle. The design owner's ruling is the opposite - somebody can try to rob
    // you while you are idle, and being idle stops you annoying people, not
    // people from harming you.
    //
    // ── AND IT IS THE SAME SEQUENCE, NOT A SECOND ONE ────────────────────
    //
    // Deliberately the four steps in the order `encounters.ts` documents, with
    // the same truncations, because a second arrival system built for this
    // handler is exactly the fork that made the two paths disagree in the first
    // place. Where the two spans differ is the ACTIVITY, which is a parameter
    // the table already carries: `ARRIVAL_EXPOSURE` prices `labour` at 1.1 and
    // `seclusion` at 0.55, so somebody earning among people is MORE exposed
    // than somebody meditating. That ordering is the ruling, already written
    // down, and it needed a caller rather than a number.
    //
    // `randomEvents: false` means no arrivals at all. That is what an operator
    // standing a world up passes through `advance_days`, and being robbed while
    // arranging a precondition is not a thing they asked for.
    const activity: EncounterActivity = focus === 'travelling'
        ? 'travel'
        // Not cultivating is the whole of what `idle` says, and `labour` is the
        // table's own row for spending a span earning rather than gathering qi.
        // `activityForVerb` defaults to it for the same reason.
        : focus === 'idle' ? 'labour' : 'seclusion';

    let arrivals: ReturnType<typeof encountersFor> | null = null;
    let lived = days;
    let arrivingCultivator = cultivator;
    if (args.randomEvents ?? true) {
        try {
            arrivals = encountersFor(
                {
                    repos,
                    knowledge: new KnowledgeGate(repos.db),
                    world: await worldForRun(run)
                },
                {
                    seed: run.seed,
                    startDay,
                    days,
                    activity,
                    cultivator,
                    // The row id is a randomUUID and would make the run
                    // irreproducible from its seed. Same reason as the skip's
                    // own `rollIdentity` below.
                    rollIdentity: PLAYER_ROLL_IDENTITY
                }
            );
            // Cut at the first thing that interrupts. THIS IS THE TURN: an
            // arrival stops the span and hands control back, which is what
            // separates being robbed from a die deciding you lost something.
            lived = daysActuallySpent(arrivals, startDay, days);
            arrivingCultivator = withEncounterDeltas(cultivator, arrivals);
        } catch {
            // A world that cannot be built is not a reason to lose the span.
            // The cultivator's own time still passes; nobody arrives in it.
            arrivals = null;
            lived = days;
            arrivingCultivator = cultivator;
        }
    }

    // ── THE SIMULATION. One call, however long the duration. ──
    const result = simulateTimeSkip(arrivingCultivator, lived, {
        seed: run.seed,
        // Judged rather than copied, because the field defaults to the row id
        // and a caller with a stable id should pass nothing.
        //
        // This one is not stable. `create_cultivator` above mints the id with
        // `randomUUID()`, and `resolveActiveRun` resolves a RUN - so what
        // reaches here is always a player character with a random id, never a
        // catalog NPC. The "two cultivators in one world must not draw alike"
        // case that justifies the per-cultivator component cannot arise here,
        // because a run has exactly one player.
        //
        // The second reason is the stronger one. This is the SAME cultivator
        // the command bar drives through `GameService`, reached through the
        // other door, and that door now passes the identity. Leaving this one
        // alone would mean the same character comprehending different things
        // depending on which surface advanced their clock - the identical
        // defect as the two cultivate paths computing disjoint halves of one
        // options object, which is a bug this file has already had once.
        rollIdentity: PLAYER_ROLL_IDENTITY,
        locationId,
        turn: run.turn,
        startDay,
        options,
        techniqueElement,
        hostility: ground?.hostility ?? undefined,
        // The Price of Advancement is charged at every realm boundary crossed
        // during the skip, and what is cut away is chosen from what this run
        // has actually accumulated. Handing it real rows is what makes "you can
        // read the ledger and see the shape of who you used to be" true rather
        // than decorative.
        toll: tollConditionsFor(repos, cultivator),
        rations,
        grainAbstinence: isOnGrainAbstinence(repos.db, cultivator.id, startDay),
        autoBreakthrough: args.autoBreakthrough ?? true,
        randomEvents: args.randomEvents ?? true,
        understanding: discovery.context
    });

    // ── PERSISTENCE. Everything the simulation decided, or nothing at all. ──
    const before = cultivator;
    const end = skipEndState(before, result);
    // The engine's own records, ids and penalties intact. Nothing is inferred
    // from its narration any more.
    const injuries = result.injuriesSustained;
    const ranksGained = Math.max(0, end.realmOrdinal - before.realmOrdinal);
    const nextTurn = run.turn + 1;

    const tollApplications: TollApplication[] = [];

    const persist = repos.db.transaction(() => {
        for (const injury of injuries) {
            repos.cultivators.addInjury(before.id, {
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                woundType: injury.woundType,
                cultivationPenalty: injury.cultivationPenalty,
                breakthroughPenalty: injury.breakthroughPenalty,
                treated: injury.treated
            });
        }

        if (ranksGained > 0) {
            repos.cultivators.advanceRealm(before.id, ranksGained);
        }

        // A skip can cross 12 -> 13 and can resolve the last crossing. Both
        // results are facts about the cultivator that the ordinal does not
        // encode, and a 'false_immortal' in particular is what bars every
        // further attempt - losing it would let the Lid open twice.
        if (result.foundationEstablished) {
            persistFoundation(repos, before.id, result.foundationEstablished);
        }
        if (result.immortalStatusGained) {
            persistImmortalStatus(repos, before.id, result.immortalStatusGained);
        }

        // Every instalment charged during the skip, in the same
        // transaction as the ranks it charged them for. The application result
        // is kept so the response can show that what the ledger names was
        // genuinely removed, not merely recorded.
        for (const toll of result.tolls ?? []) {
            tollApplications.push(persistToll(repos, run, before.id, toll));
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
            bleedingTurns: end.bleedingTurns - mid.bleedingTurns,
            // A DELTA, not an end state. The purse is the one field here that
            // is not exclusively the skip's, and writing it absolutely reverts
            // any spend made between the caller's snapshot and this call -
            // which is how a bribe came to report "10 spirit stones went with
            // it" and leave the player one stone richer. `web/apply.ts` carries
            // the measurement and the argument; this is the same write on the
            // tool path, and its header states that the two paths must not
            // disagree about what a skip persists.
            spiritStones: end.spiritStones - before.spiritStones,
            cultivationProgress: end.cultivationProgress - mid.cultivationProgress,
            age: end.age - mid.age,
            yearsAtCurrentRealm: end.yearsAtCurrentRealm - mid.yearsAtCurrentRealm
        });

        // Comprehension, and the events that produced it. Written in the same
        // transaction as the rest of the skip: an insight the engine formed
        // that the row does not show is the same failure as a breakthrough the
        // narrator invented, and this write path was missing entirely - the
        // column existed, the engine filled the field, and nothing carried it
        // to rest.
        persistUnderstanding(repos, before.id, result.insightsGained, result.achievements);
        // Visions are beliefs with no fact behind them. They go to the
        // knowledge layer, never to the cultivator's capability.
        persistVisions(repos.db, result.visions);

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

    // ── STEP 4: what the arrivals left behind, AFTER the skip. ───────────
    //
    // After, because a knowledge record is a write and phase 3 only ever gets a
    // licence to mention something that is already true.
    //
    // `cutTo` first, and it is not optional. The encounter layer cut its window
    // at ITS first interrupt; the skip then stopped wherever it liked - a wound,
    // a threshold, a death - and everything between those two days is a span the
    // cultivator never reached. Without this, a run that ended on day 5 records
    // the people it would have met on day 2995. `encounters.ts` carries three
    // playtests that found exactly that.
    //
    // `repos` is passed, so ordinary contact accumulates into a real tie rather
    // than every meeting being another first.
    let arrivalsRecorded: ReturnType<typeof recordEncounters> | null = null;
    if (arrivals) {
        const reached = cutTo(arrivals, startDay, result.simulatedDays);
        arrivalsRecorded = recordEncounters(
            new KnowledgeGate(repos.db), after, startDay + result.simulatedDays, reached, repos
        );
    }

    // ── THE WORLD MOVED TOO. ──
    // A ten-year seclusion is ten years of somebody else's decisions. The world
    // advances by exactly the span that was LIVED, not the span that was asked
    // for, and what comes back is filtered through what this cultivator has a
    // knowledge record for - so a faction they have never heard of arrives as a
    // closed road rather than as a named report.
    //
    // Deliberately non-fatal. The cultivator's own state is already committed
    // by the transaction above, and losing that because the world could not be
    // built would be the worse failure by a wide margin. A null digest is an
    // honest "nothing reached you", which is also the commonest true answer.
    let world: Awaited<ReturnType<typeof advanceWorldForCultivator>> = null;
    let worldError: string | null = null;
    try {
        world = await advanceWorldForCultivator(runAfter, after, result.simulatedDays);
    } catch (error) {
        worldError = error instanceof Error ? error.message : String(error);
    }

    const rate = computeCultivationRate(
        before,
        currentAmbient(repos.db, run, before.location, startDay),
        options
    );

    // ── WHAT WAS ASKED FOR, NOT WHAT THE ARRIVAL LEFT OF IT ─────────────
    //
    // The skip was handed `lived`, so `result.requestedDays` is the span AFTER
    // an arrival cut it, and reporting that would tell a caller who asked for
    // ten years and got two hundred days that the whole span ran. That is the
    // exact invisible-truncation defect `advance_days` was carrying, one layer
    // down, and it would have arrived with this change.
    const cutShortByAnArrival = lived < days;
    // The one that stopped it. There is at most one, by construction: the
    // window is cut at its first interrupting occurrence.
    const interrupting = arrivals?.occurrences.find(o => o.interrupts) ?? null;
    return {
        cultivated: true,
        requestedDays: days,
        simulatedDays: result.simulatedDays,
        // Somebody turned up and the span stopped so it could be answered.
        // Null is the ordinary case and the honest one.
        interruptedByAnArrival: cutShortByAnArrival
            ? {
                daysLived: result.simulatedDays,
                daysUnspent: days - result.simulatedDays,
                // ── IT HAS TO NAME WHAT ARRIVED ──────────────────────────
                //
                // Read off the interrupting OCCURRENCE, not off
                // `RecordedEncounters.met`. `met` holds people whose standing
                // moved - a relationship contact - and is empty for precisely
                // the arrivals that stop a span: measured, four worlds out of
                // four cut at day 120 by "8 bandits block the road at Kettle,
                // strongest is Qi Condensation Layer 3", with `met` empty every
                // time. Reporting that as an unnamed somebody would have been
                // the withdrawn `ground` member in a different costume - a span
                // that went badly rather than a thing that arrived.
                what: interrupting?.kind ?? null,
                account: interrupting?.event?.summary ?? null,
                // Whether it can be answered rather than only suffered. A
                // confrontation is the turn being handed back, which is the
                // whole difference between being robbed and a die deciding it.
                canBeAnswered: interrupting?.confrontation !== undefined
                    && interrupting?.confrontation !== null,
                note:
                    'The span stopped because something reached them, not because the days ran ' +
                    'out. Being idle is not a shield; what it buys is that nobody acquires a ' +
                    'grievance with you, which is a different thing.'
            }
            : null,
        // Everything the arrivals left. Engine-authored: `lines` is safe for a
        // narrator, `structure` is the operator channel and is never narrated.
        arrivals: arrivalsRecorded
            ? {
                met: arrivalsRecorded.met,
                learned: arrivalsRecorded.learned,
                lines: arrivalsRecorded.lines,
                structure: arrivalsRecorded.structure,
                activity
            }
            : null,
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
        injuriesSustained: injuries.map(summariseInjury),
        // What the pack still holds. Reported so a caller resuming an
        // interrupted span can hand it back through `carriedRations` instead of
        // buying the same food twice - see that field's note above.
        rationsRemaining: result.endState.rationsRemaining ?? 0,
        tolls: (result.tolls ?? []).map((toll, index) => ({
            fromOrdinal: toll.fromOrdinal,
            toOrdinal: toll.toOrdinal,
            fromRank: rankName(toll.fromOrdinal),
            toRank: rankName(toll.toOrdinal),
            boundaryIndex: toll.boundaryIndex,
            outcome: toll.outcome,
            risk: round4(toll.risk),
            roll: round4(toll.roll),
            modifiers: toll.modifiers.map(m => ({ source: m.source, delta: round4(m.delta) })),
            takenAll: toll.takenAll,
            applied: tollApplications[index]?.applied ?? false,
            appliedDetail: tollApplications[index]?.details ?? [],
            narrationHint: toll.narrationHint
        })),
        foundationEstablished: result.foundationEstablished,
        immortalStatusGained: result.immortalStatusGained,
        // What was comprehended, and what produced it. Empty is the ordinary
        // result and the honest one: most cultivators finish a run with none.
        understanding: {
            insightsGained: result.insightsGained.map(summariseInsight),
            achievements: result.achievements.map(a => ({
                id: a.id,
                kind: a.kind,
                onDay: a.onDay,
                summary: a.summary
            })),
            visionsFiled: result.visions.length,
            // Not a hint about what to pursue. It is the list of things that
            // were within reach at all, which is what decides whether any of
            // this could have happened.
            accessHeld: discovery.sources
        },
        // The world, over the same span, as it actually reached them.
        worldDigest: world
            ? {
                fromDay: world.result.digest?.fromDay ?? world.fromDay,
                toDay: world.result.digest?.toDay ?? world.toDay,
                headline: world.result.digest?.headline ?? null,
                heard: world.result.digest?.lines ?? [],
                unheard: world.result.digest?.unheard ?? 0,
                unattributed: world.result.digest?.unattributed ?? 0,
                note:
                    'Filtered through this cultivator\'s knowledge records. Anything named here ' +
                    'is a name they hold; anything unattributed must stay unattributed in narration.'
            }
            : null,
        // Set only when the world pass itself failed. The cultivation result
        // above still stands and was written; nothing about it is in doubt.
        worldUnavailable: worldError,
        events: [...result.events, ...(arrivalsRecorded?.events ?? [])]
            .sort((a, b) => a.dayOffset - b.dayOffset)
            .map(e => ({
            kind: e.kind,
            dayOffset: e.dayOffset,
            yearOffset: round2(e.dayOffset / DAYS_PER_YEAR),
            summary: e.summary,
            interrupts: e.interrupts,
            data: e.data
        })),
        cultivator: describeCultivator(repos, after, runAfter),
        // What the ground is, and what it did. Null when the world layer does
        // not name this place - a road, a hillside - which is the honest answer
        // rather than a fabricated set of bars.
        ground: ground ? describeGround(ground) : null,
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
                progressRemaining:
                    eligibility.progressRequired === null
                        ? null
                        : round2(
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
        pill: pending ? {
            name: pending.name,
            potency: pending.potency,
            // Both carried straight off the record written when it was
            // swallowed. A graded pill takes the real band curve; the
            // count is what makes the fifth one worth less than the first.
            ...(pending.grade ? { grade: pending.grade } : {}),
            priorPillsTaken: pending.priorPillsTaken ?? 0
        } : null,
        ranksGainedThisTurn: alreadyGained,
        // Real candidates from real rows: known techniques and the people in
        // this run who know this cultivator. The crossing picks; nobody asks.
        toll: tollConditionsFor(repos, cultivator)
    });

    const nextTurn = run.turn + 1;
    // An array rather than a nullable local: TypeScript does not track an
    // assignment made inside the transaction closure, and would narrow a
    // `let` back to null at the read site below.
    const tollApplications: TollApplication[] = [];
    // 'false_immortal' is emphatically NOT terminal. The tribulation was
    // survived and the Lid opened; the crossing simply did not complete. The
    // cultivator stands exactly where they were, permanently barred from ever
    // trying again, and goes on living - which is the worse outcome, and the
    // point. Only 'death' ends a run here.
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
                woundType: injury.woundType,
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
            if (result.toll) {
                tollApplications.push(persistToll(repos, run, cultivator.id, result.toll));
            }
        } else {
            repos.cultivators.applyDeltas(cultivator.id, {
                cultivationProgress: -result.progressConsumed
            });

            // A False Immortal does not advance and is not dead, so it lands
            // here - and the status still has to be written, because it is the
            // record that bars every further attempt. The engine refuses the
            // re-attempt by reading it back.
            if (result.toll) {
                tollApplications.push(persistToll(repos, run, cultivator.id, result.toll));
            }
        }

        if (result.foundationEstablished) {
            persistFoundation(repos, cultivator.id, result.foundationEstablished);
        }
        if (result.immortalStatusGained) {
            persistImmortalStatus(repos, cultivator.id, result.immortalStatusGained);
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
                // takenAll is authoritative: the ascension crossing collects
                // the whole remaining ledger at once, and `taken` is only its
                // first entry.
                takenAll: result.toll.takenAll,
                taken: result.toll.taken,
                // Proof the ledger is not lying: everything named is gone.
                applied: tollApplications[0]?.applied ?? false,
                appliedDetail: tollApplications[0]?.details ?? [],
                narrationHint: result.toll.narrationHint
            }
            : null,
        foundationEstablished: result.foundationEstablished,
        immortalStatusGained: result.immortalStatusGained,
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
    eligibility: { progressAvailable: number; progressRequired: number | null }
): string {
    switch (reason) {
        case 'insufficient_progress':
            // No figure above the Lid: the requirement is not in these units and
            // there is no honest number to put in the sentence.
            if (eligibility.progressRequired === null) {
                return (
                    `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}. What is above ` +
                    'that is not measured in qi, and no quantity of it is the missing piece.'
                );
            }
            return (
                `${cultivator.name} holds ${eligibility.progressAvailable.toFixed(1)} of the ` +
                `${eligibility.progressRequired} qi-units ${rankName(cultivator.realmOrdinal)} requires.`
            );
        case 'at_ladder_summit':
            return `${cultivator.name} stands at ${rankName(MAX_ORDINAL)}. There is nothing above it at all.`;
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
        immortalStatus: cultivator.immortalStatus,
        mayEndRunVoluntarily: canEndRunVoluntarily(cultivator).legal,
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
        description: 'Resolve a stretch of cultivation - days, months or years - in one deterministic pass'
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
    },
    assess: {
        schema: AssessSchema,
        handler: handleAssess,
        aliases: ['can', 'capability', 'predicates', 'try'],
        description:
            'What happens if they try: attempt / survive / succeed / understand / force, ' +
            'each with the arithmetic and a stated reason'
    },
    understanding: {
        schema: UnderstandingSchema,
        handler: handleUnderstanding,
        aliases: ['insights', 'dao', 'comprehension', 'road'],
        description: 'Comprehensions held, the Dao they add up to, and what that road opens and closes'
    },
    work: {
        schema: WorkSchema,
        handler: (args: unknown) =>
            handleWork(args as z.infer<typeof WorkSchema>, runCultivate),
        aliases: ['job', 'labour', 'labor', 'earn', 'hire'],
        description: 'Take an occupation for a span. Wages paid for days actually worked; cultivation runs at zero.'
    },
    market: {
        schema: MarketSchema,
        handler: handleMarket,
        aliases: ['prices', 'shop', 'cost', 'settlement'],
        description: 'Local prices, what this settlement has, and how mortals here treat this cultivator'
    },
    forage: {
        schema: ForageSchema,
        handler: (args: unknown) =>
            handleForage(args as z.infer<typeof ForageSchema>, runCultivate),
        aliases: ['gather', 'herbs', 'pick', 'search_ground'],
        description:
            'Search the ground for spirit herbs. What comes back, how much of it, and how long it '
            + 'takes are one measurement off the asker\'s rung - and ground they have outgrown stops '
            + 'being searched at all.'
    }
};

/**
 * `work` runs the same span `cultivate` does, and adds a wage.
 *
 * Injected rather than imported so the mortal-world module never reaches back
 * into this file: there is one time skip in the cultivation surface, and this
 * is the function that owns it.
 */
async function runCultivate(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = CultivateSchema.parse(args);
    return (await handleCultivate(parsed)) as Record<string, unknown>;
}

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

BEFORE YOU NARRATE A RISK: assess. Five separate answers - can they attempt it, survive it,
succeed at it, understand what they found, force it over resistance - each with the arithmetic
and a stated reason. The engine never says "unavailable"; it says what happens when you try, and
only attempt refuses, and only for physical reasons (a sealed door, a shut window, not being
there). Never decide for yourself that something is possible.

UNDERSTANDING: understanding returns the comprehensions this cultivator holds, where each came
from, the Dao they add up to, and what that road opens and closes. Comprehension needs something
to comprehend FROM - a teacher, a readable manual, ground that has something to teach. Without
access a road is not harder, it is ABSENT. Never tell a player a Dao would suit them.

THE LOW REALMS: work takes a job for a span (wages for days actually worked; cultivation runs at
zero for the whole of it), market shows local prices, what this settlement has and lacks, and how
mortals here actually treat someone at this rank, forage searches the ground for herbs. Thirty
stones is the starting purse and a decent cave is sixty a month. Most of a cultivating life is
spent paying for the next month of it.

THE WORLD ANSWERS BY HEIGHT. Every one of those returns a regard block: the measured gap between
the asker's rung and the rung the thing is pitched at, the band that gap falls in, and the
multipliers that follow from it - how much comes back, how long it takes, what it costs, what a
fight there does. The two refusals are both real answers and both come with reasons. unreachable
means it is over their head and is not put in front of them. dismissed means it is beneath them
and everyone present can see what they are. work with no occupationId also returns withheld:
what is going here that is NOT being put to this person, and why. Narrate the reason. An empty list
is never the whole story.

APPROACH - WHAT YOU KNOW AND THE ENGINE CANNOT. Every action above accepts an optional approach:
{ intent, tone, leverage, audience, concealed, presentedAs, patience, witnessOrdinal, note }. Put
in it what the player is attempting, how they are putting it, what is actually behind the ask, who
is watching, and what rung they are letting the room believe. The engine reduces all of it to two
bounded numbers - an apparent rung, and a pressure of at most two rungs either way - and decides
everything else. Concealment is the interesting one: the room meets the apparent rung, the ground
meets the real one, so a disguised elder is offered a porter's job and does it in a tenth of the
time. You supply context. You never supply an outcome, and the engine will not read one.

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
        ambient: AmbientQiSchema.optional(),
        against: z.enum(['place', 'opponent', 'inscription']).optional(),
        place: z.string().optional(),
        opponentId: z.string().optional(),
        siteId: z.string().optional(),
        alertness: z.number().optional(),
        preparation: z.number().int().optional(),
        occupationId: z.string().optional(),
        category: z.string().optional(),
        biome: z.string().optional(),
        approach: ApproachSchema.optional()
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
                    progressRequired: number | null; baseBreakthroughChance: number; isBoundary: boolean;
                }) => [
                    String(r.ordinal),
                    r.isBoundary ? `${r.name} *` : r.name,
                    String(r.lifespanYears),
                    // Null on the two rungs above the Lid, and it is a statement
                    // rather than a missing value: immortal qi is not this
                    // currency. `String(null)` printed the word "null" in the
                    // player-facing table, which is a database artifact standing
                    // where the engine had something to say.
                    r.progressRequired === null ? 'not in this currency' : String(r.progressRequired),
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
