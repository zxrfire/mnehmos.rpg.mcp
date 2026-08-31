/**
 * The game service - phase 2, and the only thing in this package that writes.
 *
 * Read the method bodies with one question in mind: *where does a value from a
 * model response become a row?* The answer is nowhere. A narrator can reach
 * this class in exactly one way - `Narrator.plan()` returns a member of a closed
 * enum plus a bounded `days` and an 80-character place name - and every number
 * that lands in SQLite after that comes out of `simulateTimeSkip`,
 * `attemptBreakthrough` or `applyDeltas`.
 *
 * `Narrator.narrate()` is called *after* the write, with the result of the
 * write, and its return value goes to exactly one place: the play log, as prose.
 * There is no branch anywhere below that inspects it.
 *
 * The service takes its `Database` by injection, so tests drive a real engine
 * over an in-memory database with no HTTP and no network. It then installs that
 * handle as the process database and builds its repositories through
 * `ensureCultivationDb`, which is what keeps this front door and the MCP tool
 * front door writing the same rows the same way - a second implementation of
 * "what a crossing took" would eventually disagree with the first, and the
 * disagreement would be a corrupted save rather than a failing test.
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import {
    SATIETY_MAX,
    STARTING_SPIRIT_STONES,
    type AmbientQi,
    type BreakthroughResult,
    type Cultivator,
    type Run,
    type SimEvent,
    type TimeSkipResult
} from '../schema/cultivation.js';
import { ambientForBlock } from '../engine/cultivation/ambient.js';
import { attemptBreakthrough, canAttemptBreakthrough } from '../engine/cultivation/breakthrough.js';
import { rankName } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import { rollAttributes, rollSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { ACTIONS_PER_FULL_SATIETY, describeDeath } from '../engine/cultivation/survival.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { rollHerb } from '../data/cultivation/index.js';
import { setDb } from '../storage/index.js';
import { SECTS, getSect, getTechnique } from '../data/cultivation/index.js';
import { handleRefine } from '../server/consolidated/alchemy-manage.js';
import { handlePractise } from '../server/consolidated/technique-manage.js';
import {
    FLAG_NAME_TAKEN,
    ensureCultivationDb,
    addToPouch,
    isGuidingErrorBody,
    listTolls,
    persistFoundation,
    persistToll,
    readFlag,
    tollConditionsFor,
    type CultivationRepos,
    type TollLedgerEntry
} from '../server/consolidated/cultivation-support.js';
import { applyTimeSkip, tollLine } from './apply.js';
import {
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_SECLUSION_DAYS,
    GATHERING_DAYS,
    MAX_CULTIVATION_DAYS,
    TRAINING_DAYS,
    type ActionName,
    type PlanSource,
    type PlannedAction
} from './actions.js';
import {
    knownTechniqueNames,
    nearbyNames,
    pouchNames,
    resolveAnything,
    resolveHerb,
    resolveParty,
    resolvePlace,
    resolveRecipe,
    resolveTechnique,
    type KnowledgeScope
} from './entities.js';
import { KnowledgeGate, type AwarenessRow } from './knowledge.js';
import {
    factsForBreakthrough,
    factsForEat,
    factsForGather,
    factsForInteraction,
    factsForInvestigation,
    factsForLook,
    factsForMove,
    factsForRefusal,
    factsForStatus,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    type EngineFacts
} from './facts.js';
import { PlayLog, type LogEntry } from './log.js';
import type { Narrator } from './narrator.js';
import { composeStateSummary } from './prompt.js';
import {
    cultivatorView,
    derivedView,
    ledgerRowView,
    refusalText,
    rosterRowView,
    runView,
    type DerivedView,
    type LedgerRowView,
    type RosterRowView,
    type RunView
} from './view.js';

// ─────────────────────────────────────────────────────────────────────────
// CHARACTER CREATION
// Not engine constants: the cultivation engine has no opinion about starting
// HP, and inventing one inside src/engine would be inventing a game rule in a
// module whose whole claim is that it only computes. They live here, where the
// web deployment's own choices belong.
// ─────────────────────────────────────────────────────────────────────────

export const STARTING_AGE = 16;
export const STARTING_LOCATION = 'Sweptground';
/** Base HP plus ten per point of Might: 30 to 50 at creation. */
export const BASE_HP = 20;
export const HP_PER_MIGHT = 10;
/** Base qi plus five per point of Insight: 15 to 30 at creation. */
export const BASE_QI = 10;
export const QI_PER_INSIGHT = 5;

/** Spirit stones for one ration. A ration refills the belly to full: 50 days. */
export const PROVISION_COST_STONES = 2;
/** Spirit stones for one meal at `eat`. */
export const MEAL_COST_STONES = 1;

/** Days a `travel` or `wait` action consumes. */
export const SHORT_ACTION_DAYS = 1;
/** Focus multipliers for time spent on something other than sealed seclusion. */
export const TRAVEL_FOCUS = 0.15;
export const GATHERING_FOCUS = 0.2;
export const WAITING_FOCUS = 0.25;

/** Engine event summaries appended to the log per action, at most. */
const MAX_LOGGED_EVENTS = 40;

/**
 * How prepared a crossing counts as, 0..1.
 *
 * The engine wants a number for "a chosen site, a cleared schedule, nobody
 * hunting you". This deployment models one of those honestly - whether the
 * purse actually covered the food for the whole stretch - so a fully
 * provisioned seclusion is half-prepared and nothing else is. Striking the
 * barrier on command is a deliberate but unaided choice.
 */
export const PROVISIONED_PREPARATION = 0.5;
export const DELIBERATE_PREPARATION = 0.25;
/** A shut door, a chosen site, and nobody coming through it. */
export const SEALED_PREPARATION = 0.75;
/** Below this, a crossing counts as hurried: too little time to sit properly. */
export const HURRIED_BELOW_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────
// ERRORS AND WIRE SHAPES
// ─────────────────────────────────────────────────────────────────────────

/** A refusal with an HTTP status. The message is safe to show a player. */
export class GameError extends Error {
    constructor(message: string, readonly status = 400) {
        super(message);
        this.name = 'GameError';
    }
}

export interface StateView {
    run: RunView;
    cultivator: Cultivator;
    ambient: AmbientQi;
    derived: DerivedView;
    /** Everything the crossings have cut away from this cultivator, oldest first. */
    tolls: TollLedgerEntry[];
    log: LogEntry[];
}

/**
 * One step the engine actually took, for the client's inspector.
 *
 * This list is the visible proof of the project's central claim. A player who
 * suspects the narration of flattering them can open it and read the engine's
 * own one-line account of every routine that ran - `summary` is always sourced
 * from facts.ts or from a `SimEvent.summary`, never from narrator prose.
 */
export interface ToolCallRecord {
    /** The engine routine or repository call that ran. */
    name: string;
    /** What it was doing: the player-facing verb, or the kind of ruling. */
    action: string;
    /** The engine's factual one-liner. Never narration. */
    summary: string;
    /** False when the engine declined to act - an ineligible attempt, a refusal. */
    ok: boolean;
    /** Present on the routing step: whether the model or the parser chose. */
    source?: PlanSource;
    /** Present when a fallback ran, saying why. */
    note?: string;
}

export interface ActResult {
    narration: string;
    events: SimEvent[];
    toolCalls: ToolCallRecord[];
    state: StateView;
}

export interface CultivateResult {
    timeSkip: TimeSkipResult;
    state: StateView;
}

export interface BreakthroughApiResult {
    result: BreakthroughResult;
    state: StateView;
}

export interface GameServiceOptions {
    db: Database.Database;
    narrator: Narrator;
    adminMode?: boolean;
    /** Injectable for tests that need a reproducible run. */
    seedFactory?: () => string;
}

/** What an action did, before it is narrated. */
interface Execution {
    facts: EngineFacts;
    events: SimEvent[];
    timeSkip: TimeSkipResult | null;
    breakthrough: BreakthroughResult | null;
    outcome: 'executed' | 'refused';
    /** Every engine call this action made, in the order it made them. */
    calls: ToolCallRecord[];
}

// ─────────────────────────────────────────────────────────────────────────
// THE SERVICE
// ─────────────────────────────────────────────────────────────────────────

export class GameService {
    private readonly db: Database.Database;
    /**
     * The same repository bundle the MCP tools use, so the two front doors
     * cannot drift apart about what a crossing took or how a skip is written.
     */
    private readonly repos: CultivationRepos;
    private readonly log: PlayLog;
    /**
     * What each cultivator has heard of.
     *
     * The enforcement behind docs/world/discovery.md: everything that reaches a
     * prompt or an entity resolver is filtered through this first, so the
     * narrator is never handed a name the player has not earned.
     */
    private readonly knowledge: KnowledgeGate;
    private readonly narrator: Narrator;
    private readonly seedFactory: () => string;

    readonly adminMode: boolean;

    constructor(options: GameServiceOptions) {
        this.db = options.db;
        this.narrator = options.narrator;
        this.adminMode = options.adminMode ?? false;
        this.seedFactory = options.seedFactory ?? (() => randomUUID());

        // This deployment is single-operator against one database, so the
        // injected handle IS the process database. Installing it as the
        // ambient one lets `ensureCultivationDb` build the exact repository
        // bundle the MCP tools use - including its auxiliary tables - instead
        // of this layer growing a parallel set that could drift.
        setDb(this.db);
        this.repos = ensureCultivationDb();
        this.log = new PlayLog(this.db);
        this.knowledge = new KnowledgeGate(this.db);
    }

    // ── run lifecycle ────────────────────────────────────────────────────

    /**
     * Roll a cultivator and open a run.
     *
     * Talent is rolled here, from a seed minted here, using the engine's own
     * `rollSpiritRoot` and `rollAttributes`. The request body carries a name and
     * nothing else that is read: a client that posts
     * `{name, spiritRoot: 'mutated_lightning', attributes: {...}}` gets the same
     * roll it would have got by posting the name alone. Talent is not earned,
     * cannot be improved, and is not negotiable - that is the genre, and it is
     * also why the client is not trusted with it.
     */
    async newRun(name: string): Promise<{ run: RunView; cultivator: Cultivator }> {
        const trimmed = name.trim();
        if (trimmed.length === 0) throw new GameError('A cultivator needs a name.');
        if (trimmed.length > 60) throw new GameError('That name is too long; sixty characters at most.');

        const active = this.repos.runs.getActiveRun();
        if (active) {
            throw new GameError(
                'A run is already in progress. Runs end when the cultivator dies; there is no abandoning one.',
                409
            );
        }

        const seed = this.seedFactory();
        const root = rollSpiritRoot(forStream(seed, 'creation', 'spirit_root').next());
        const attributeStream = forStream(seed, 'creation', 'attributes');
        const attributes = rollAttributes([
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next()
        ]);

        const maxHp = BASE_HP + attributes.might * HP_PER_MIGHT;
        const maxQi = BASE_QI + attributes.insight * QI_PER_INSIGHT;

        const created = this.db.transaction(() => {
            const cultivator = this.repos.cultivators.create({
                id: randomUUID(),
                name: trimmed,
                kind: 'pc',
                spiritRoot: root.key,
                attributes,
                realmOrdinal: 0,
                cultivationProgress: 0,
                hp: maxHp,
                maxHp,
                qi: maxQi,
                maxQi,
                satiety: SATIETY_MAX,
                starvationTurns: 0,
                age: STARTING_AGE,
                yearsAtCurrentRealm: 0,
                spiritStones: STARTING_SPIRIT_STONES,
                location: STARTING_LOCATION,
                alive: true
            });
            const run = this.repos.runs.startRun({ cultivatorId: cultivator.id, seed });
            return { cultivator: this.repos.cultivators.getById(cultivator.id)!, run };
        })();

        // The world a villager starts with: where they stand, and the one sect
        // anybody in the county could name. Everything else in the world is
        // unheard of and has to be learned from a source they can point at.
        const awareness = this.knowledge.seedStartingAwareness(
            created.cultivator.id, 0, STARTING_LOCATION, localSect()
        );

        const ambient = this.ambientFor(created.cultivator, created.run);
        const facts = factsForLook(created.cultivator, ambient);
        const opening = await this.narrator.narrate(facts, {
            place: placeName(created.cultivator),
            ambient,
            awareness
        });

        this.log.append(created.run.id, [
            {
                role: 'engine',
                turn: 0,
                text:
                    `${created.cultivator.name} begins at ${rankName(0)}, age ${STARTING_AGE}, in ${STARTING_LOCATION}. ` +
                    `${root.name}; Might ${attributes.might}, Insight ${attributes.insight}, ` +
                    `Fortune ${attributes.fortune}, Charm ${attributes.charm}. ` +
                    'Talent is rolled once and never redrawn.'
            },
            { role: 'narrator', turn: 0, text: opening.text }
        ]);

        return { run: runView(created.run), cultivator: cultivatorView(created.cultivator) };
    }

    /** The current run, whether it is still live or already in the ledger. */
    state(): StateView {
        const { run, cultivator } = this.currentRun();
        return this.stateView(run, cultivator);
    }

    // ── actions ──────────────────────────────────────────────────────────

    /**
     * Free-text intent, resolved in three strictly separated phases.
     *
     * Phase 1 chooses a verb (model, validated, or deterministic parser).
     * Phase 2 runs it through the engine and writes the result.
     * Phase 3 describes what phase 2 decided.
     *
     * The state returned to the client is re-read from the database after
     * phase 2 and is not touched by phase 3.
     */
    async act(input: string): Promise<ActResult> {
        const trimmed = input.trim();
        if (trimmed.length === 0) throw new GameError('Say something.');
        if (trimmed.length > 2000) throw new GameError('That is too long. Two thousand characters at most.');

        const { run, cultivator } = this.requireLiveRun();
        const ambient = this.ambientFor(cultivator, run);

        // ── phase 1 ──
        const plan = await this.narrator.plan(
            trimmed,
            composeStateSummary({
                cultivator,
                run,
                ambient,
                sectName: this.sectNameFor(cultivator),
                knownTechniques: this.knownTechniqueNames(cultivator),
                awareness: this.awarenessOf(cultivator)
            })
        );

        // ── phase 2 ──
        const execution = await this.execute(plan.action, run, cultivator, ambient);

        const after = this.currentRun();
        const scene = {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator)
        };

        // ── phase 3 ──
        const narration = await this.narrator.narrate(execution.facts, scene);

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: trimmed },
            ...this.engineEntries(execution, after.run.turn),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return {
            narration: narration.text,
            events: execution.events,
            toolCalls: [
                routingCall(plan),
                ...execution.calls,
                narrationCall(narration)
            ],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    /** Seclusion, requested directly by the UI rather than through free text. */
    async cultivate(days: number): Promise<CultivateResult> {
        const requested = Math.floor(Number(days));
        if (!Number.isFinite(requested) || requested < 1) {
            throw new GameError('Cultivation needs a whole number of days, at least one.');
        }
        if (requested > MAX_CULTIVATION_DAYS) {
            throw new GameError(`The longest seclusion this engine will resolve in one pass is ${MAX_CULTIVATION_DAYS} days.`);
        }

        const { run, cultivator } = this.requireLiveRun();
        const ambient = this.ambientFor(cultivator, run);
        const execution = this.runSeclusion(run, cultivator, ambient, requested);
        if (!execution.timeSkip) throw new GameError('The simulation produced no result.', 500);

        const after = this.currentRun();
        const narration = await this.narrator.narrate(execution.facts, {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator)
        });

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `Seclusion - ${humanDays(requested)}.` },
            ...this.engineEntries(execution, after.run.turn),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return { timeSkip: execution.timeSkip, state: this.stateView(after.run, after.cultivator) };
    }

    /** Strike the barrier now. Refuses loudly when the engine says it is not legal. */
    async breakthrough(): Promise<BreakthroughApiResult> {
        const { run, cultivator } = this.requireLiveRun();
        const eligibility = canAttemptBreakthrough(cultivator);
        if (!eligibility.eligible) {
            throw new GameError(refusalText(eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired));
        }

        const ambient = this.ambientFor(cultivator, run);
        const execution = this.strikeBarrier(run, cultivator, ambient);
        if (!execution.breakthrough) throw new GameError('The engine produced no breakthrough result.', 500);

        const after = this.currentRun();
        const narration = await this.narrator.narrate(execution.facts, {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator)
        });

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: 'Strike the barrier.' },
            ...this.engineEntries(execution, after.run.turn),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return { result: execution.breakthrough, state: this.stateView(after.run, after.cultivator) };
    }

    // ── read-only surfaces ───────────────────────────────────────────────

    ledger(limit = 50): { runs: LedgerRowView[] } {
        const rows = this.repos.runs.deathLedger(limit).map(run => {
            const cultivator = this.repos.cultivators.getById(run.cultivatorId);
            return ledgerRowView(run, cultivator?.name ?? 'Unnamed');
        });
        return { runs: rows };
    }

    /**
     * Every cultivator in the world, read-only.
     *
     * Gated on ADMIN mode, which per context.md lifts content gates and never
     * the authority rule: this endpoint reads rows and adds display names. It
     * has no write path, so there is nothing here for ADMIN to be dangerous
     * with.
     */
    roster(): { roster: RosterRowView[] } {
        if (!this.adminMode) {
            throw new GameError('Admin mode is off. Set ADMIN_MODE=true to enable the roster.', 403);
        }
        const player = this.repos.runs.getActiveRun()?.cultivatorId
            ?? this.repos.runs.deathLedger(1)[0]?.cultivatorId
            ?? null;
        return { roster: this.repos.cultivators.roster().map(entry => rosterRowView(entry, player)) };
    }

    // ── engine execution (phase 2) ───────────────────────────────────────

    /**
     * Run one action.
     *
     * Exhaustive over the closed set by construction: adding a name to
     * ACTION_NAMES without adding a case here is a compile error, which is the
     * point of the enum being closed in the first place.
     *
     * Read the `interact` and `move` branches with one thing in mind: neither
     * of them looks at `action.intent` to decide anything. The intent is passed
     * to the facts so the narrator can say what was attempted, and that is all
     * it is ever allowed to do. An outcome selected by the word the player
     * typed would be an outcome the engine did not compute.
     */
    private async execute(
        action: PlannedAction,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi
    ): Promise<Execution> {
        switch (action.action) {
            case 'cultivate':
                return this.runSeclusion(run, cultivator, ambient, action.days ?? DEFAULT_CULTIVATION_DAYS);

            case 'seclude':
                return this.runSeclusion(
                    run, cultivator, ambient, action.days ?? DEFAULT_SECLUSION_DAYS, { sealed: true }
                );

            case 'breakthrough': {
                const eligibility = canAttemptBreakthrough(cultivator);
                if (!eligibility.eligible) {
                    return refused('engine.canAttemptBreakthrough', 'breakthrough', factsForRefusal(
                        'The barrier does not move.',
                        refusalText(eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired)
                    ));
                }
                return this.strikeBarrier(run, cultivator, ambient);
            }

            case 'move':
                return this.move(run, cultivator, ambient, action.target, action.intent ?? 'travel');

            case 'investigate':
                return this.investigate(run, cultivator, ambient, action.target);

            case 'interact':
                return this.interact(run, cultivator, action.target, action.intent ?? 'talk');

            case 'train_technique':
                return this.train(cultivator, action.target);

            case 'refine':
                return this.refine(cultivator, action.target);

            case 'gather':
                return this.gather(run, cultivator, ambient, action.target);

            case 'wait':
                return this.shortSkip(run, cultivator, ambient, WAITING_FOCUS, 'Waiting');

            case 'eat':
                return this.eat(run, cultivator);

            case 'status': {
                const eligibility = canAttemptBreakthrough(cultivator);
                return this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible
                ));
            }

            case 'look':
                return this.freeAction(run, 'look', factsForLook(cultivator, ambient));
        }
    }

    // ── the three semantic actions ───────────────────────────────────────

    /**
     * Going somewhere, however it was meant.
     *
     * One engine path for every intent. `flee`, `enter`, `approach` and
     * `travel` all resolve identically because the engine has no basis yet for
     * treating them differently, and manufacturing one in this layer would be a
     * mechanic invented in the narration tier.
     *
     * TODO(world): route through `assessCapability` once `world_locations` is
     * populated, so entering a sealed ruin is answered by "can attempt / can
     * survive / can succeed" against that location's thresholds. The rule then
     * stays the same: the attempt is always permitted, circumstances decide.
     */
    private move(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Execution {
        const place = resolvePlace(target);
        if (!place) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                'No destination was named, so nothing moved. Places in this world are plain and ' +
                'physical - Sweptground, the Low Fall, Scarwater. Name one.'
            ));
        }

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, SHORT_ACTION_DAYS, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: TRAVEL_FOCUS },
            rations: 0,
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: place.name
        });

        // Standing somewhere is how a place stops being a rumour. Recorded with
        // its source so a place walked to and a place read about stay different
        // facts.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: place.name, name: place.name },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        return {
            facts: factsForMove(cultivator, applied.cultivator, place.name, intent, skip, ambient, ambientAfter),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.update',
                    action: 'move',
                    summary: `Location set to "${place.name}" (intent: ${intent}); ambient qi there is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('move', skip, null),
                ...tollCalls(applied.tollLines)
            ]
        };
    }

    /**
     * Examining something.
     *
     * Reads state and reports it. The subject must resolve to a real row or a
     * real catalog entry, so a player cannot examine a person the world does
     * not contain and receive a description of them.
     *
     * TODO(world): once `assessCapability` is wired, run the `understand`
     * predicate over the subject so that an inscription above the cultivator's
     * comprehension yields partial or wrong readings rather than the full
     * record. Comprehension is archaeology, and it should be able to fail.
     */
    private investigate(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Execution {
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return this.freeAction(run, 'investigate', factsForLook(cultivator, ambient));
        }

        const scope = this.scopeFor(cultivator);
        const subject = resolveAnything(this.repos, query, cultivator, scope);
        if (!subject) {
            // Worded so that it does not confirm existence either. "You have
            // never heard of it" and "it is not there" have to look the same
            // from inside, or the refusal itself becomes the answer key.
            return refused('engine.resolveEntity', 'investigate', factsForRefusal(
                `Nothing you know of by that name.`,
                `"${query}" is not something this cultivator has heard of, and nothing they can ` +
                `see answers to it. The engine will not describe what the player has no ` +
                `knowledge of, and it will not confirm whether such a thing exists. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        // Examining a thing is a source. Record it with its provenance rather
        // than letting the knowledge exist only in the transcript.
        const learned = this.noteEncounter(
            cultivator, run, subject, 'witnessed', `Examined at ${placeName(cultivator)}.`
        );

        // `subject.facts` is what was perceived and goes to the narrator.
        // `subject.structure` is the schema behind it - governance, ordinals,
        // grades - and goes only to the inspector below. A category handed to a
        // narrator becomes a briefing, and there is no briefing in this world.
        const facts = factsForInvestigation(cultivator, ambient, subject.name, subject.facts);
        facts.structure.push(...subject.structure);
        if (learned) {
            facts.lines.push(
                `${subject.name} is now a name this cultivator holds, learned by looking at it.`
            );
        }

        const execution = this.freeAction(run, 'investigate', facts);
        execution.calls = [
            {
                name: 'engine.readState',
                action: 'investigate',
                summary: `Resolved "${query}" to ${subject.kind} ${subject.id}. Read only: no time passed, nothing changed.`,
                ok: true
            },
            ...structureCalls(subject.structure)
        ];
        if (learned) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_surfaced',
                summary: `${subject.name} recorded as known (source: witnessed, at ${placeName(cultivator)}).`,
                ok: true
            });
        }
        return execution;
    }

    /**
     * Approaching a person or a faction.
     *
     * Two halves, and the split is the design. The engine CAN state, from real
     * rows, who this party is and what stands between them; it CANNOT yet
     * resolve what came of the approach, because the social layer that would
     * decide it - relationships, obligations, what each side knows and wants -
     * is not something this layer may invent.
     *
     * So the attempt is recorded and the facts are reported, and the result is
     * marked unresolved rather than narrated. "I try to sneak into the sect" is
     * an attempt, not an infiltration.
     */
    private interact(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                'Nobody in particular.',
                'No person or faction was named, so nobody was approached. ' +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const party = resolveParty(this.repos, query, cultivator, scope);
        if (!party) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                `Nobody you know of by that name.`,
                `"${query}" is nobody this cultivator has heard of and nobody standing in front of ` +
                `them, so there was nobody to approach. The engine will not conjure a person to ` +
                `have a conversation with, and it will not say whether such a person exists. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        this.noteEncounter(
            cultivator, run, party, 'witnessed', `Approached at ${placeName(cultivator)}.`
        );

        const unresolved =
            'The engine can say who they are and what stands between you; it cannot yet say what ' +
            'came of the approach. Resolving that needs the social layer (relationships, grudges, ' +
            'obligations, what each side knows) and the capability predicates. Until those land, ' +
            'nothing was agreed and no state changed.';

        const execution = this.freeAction(
            run, 'interact',
            factsForInteraction(cultivator, party.name, intent, party.facts, unresolved)
        );
        execution.outcome = 'refused';
        execution.calls = [
            {
                name: 'engine.resolveParty',
                action: 'interact',
                summary: `Resolved "${query}" to ${party.kind} ${party.id}. ${party.facts[0]}`,
                ok: true
            },
            ...structureCalls(party.structure),
            {
                name: 'engine.resolveInteraction',
                action: intent,
                summary:
                    'Attempt recorded; outcome not resolvable yet. No agreement, no exchange, no ' +
                    'change of standing. The intent label was carried to the narrator and read by ' +
                    'no conditional.',
                ok: false
            }
        ];
        return execution;
    }

    // ── logistics ────────────────────────────────────────────────────────

    /**
     * Alchemy, through the same handler the MCP tool surface calls.
     *
     * Not reimplemented here. `alchemy_manage.refine` owns the odds, the
     * ingredient burn and the pouch write, and a second implementation would
     * eventually disagree with the first about what a failed cauldron costs.
     */
    private async refine(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();
        const recipe = query.length >= 2 ? resolveRecipe(query) : null;
        if (!recipe) {
            const held = pouchNames(this.db, cultivator.id);
            return refused('engine.resolveRecipe', 'refine', factsForRefusal(
                query.length >= 2 ? `No formula called ${query}.` : 'No formula named.',
                `The cauldron needs a formula the world actually holds. ` +
                `In the pouch: ${held.join(', ') || 'nothing'}. ` +
                'Knowledge in this world is recovered, not invented: a formula is dug out of a tomb, ' +
                'not thought up at the cauldron.'
            ));
        }

        const result = await handleRefine({
            action: 'refine',
            recipeId: recipe.id,
            cultivatorId: cultivator.id,
            supplements: []
        });

        return this.fromToolResult('alchemy_manage.refine', 'refine', result, recipe.name);
    }

    /**
     * Practising an art, through `technique_manage.practise`.
     *
     * That handler owns mastery accrual and rolls a deviation check on the same
     * terms the time-skip uses, so practising a conflicting art is not free
     * just because it is short. The target must be an art the cultivator
     * actually knows.
     */
    private async train(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();
        const technique = query.length >= 2 ? resolveTechnique(this.repos, query, cultivator.id) : null;
        const known = technique ? this.repos.techniques.getKnown(cultivator.id, technique.id) : null;

        if (!technique || !known) {
            const knows = knownTechniqueNames(this.repos, cultivator.id);
            return refused('engine.resolveTechnique', 'train_technique', factsForRefusal(
                technique ? `${technique.name} is not known.` : 'No art named.',
                technique
                    ? `${cultivator.name} has never been taught ${technique.name}. A manual is somebody ` +
                      `else's memory, and it has to be found before it can be read. ` +
                      `Known: ${knows.join(', ') || 'nothing at all'}.`
                    : `Name an art to practise. Known: ${knows.join(', ') || 'nothing at all'}.`
            ));
        }

        const result = await handlePractise({
            action: 'practise',
            techniqueId: technique.id,
            cultivatorId: cultivator.id,
            days: TRAINING_DAYS
        });

        return this.fromToolResult('technique_manage.practise', 'train_technique', result, technique.name);
    }

    /**
     * Foraging.
     *
     * Time passes through the simulator; what the ground gives up is drawn from
     * the herb catalog's own weighted table on a seeded sub-stream, and lands in
     * the shared pouch. The whole point of the Late Age is that you might not
     * out-cultivate a prodigy but you can out-dig them, and nothing else in the
     * verb set reaches that.
     */
    private gather(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Execution {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, GATHERING_DAYS, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: GATHERING_FOCUS },
            rations: 0,
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });

        // A named herb narrows the draw to that herb if it is within reach;
        // otherwise the catalog's weighted table decides, which is the honest
        // answer to "I look for something useful".
        const wanted = (target ?? '').trim().length >= 2 ? resolveHerb(target!.trim()) : null;
        const rng = forStream(run.seed, 'web_forage', startDay, placeName(cultivator));
        const rolled = rollHerb(applied.cultivator.realmOrdinal, rng.next());
        const found = wanted && rolled && rolled.id === wanted.id ? rolled : rolled;

        const pouched = found && found.harvestOrdinal <= applied.cultivator.realmOrdinal ? found : null;
        if (pouched) {
            addToPouch(this.db, cultivator.id, pouched.id, 'herb', 1);
        }

        const calls: ToolCallRecord[] = [
            ...skipCalls('gather', skip, null),
            ...tollCalls(applied.tollLines),
            {
                name: pouched ? 'storage.addToPouch' : 'engine.rollHerb',
                action: 'gather',
                summary: pouched
                    ? `One ${pouched.name} (${pouched.grade}) added to the pouch.`
                    : found
                        ? `${found.name} grows here but wants ${found.harvestOrdinal} ordinal to take safely. Left where it was.`
                        : 'The catalog offered nothing within reach at this realm.',
                ok: true
            }
        ];

        return {
            facts: factsForGather(
                cultivator, applied.cultivator, skip, ambient,
                pouched ? { name: pouched.name, grade: pouched.grade, value: pouched.value } : null
            ),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    }

    /**
     * Fold an MCP handler's return value into an Execution.
     *
     * Those handlers return either a guiding error body or a result object with
     * an engine-authored `narrationHint`. Both are facts; the error is simply
     * the fact that the engine declined, and it is passed through rather than
     * softened.
     */
    private fromToolResult(
        name: string,
        action: ActionName,
        result: object,
        subject: string
    ): Execution {
        if (isGuidingErrorBody(result)) {
            const hint = typeof result.hint === 'string' ? ` ${result.hint}` : '';
            return refused(name, action, factsForRefusal(
                `${subject}: refused.`,
                `${result.message}${hint}`
            ));
        }

        const body = result as Record<string, unknown>;
        const hint = typeof body.narrationHint === 'string' ? body.narrationHint : null;
        const lines = [
            `${subject}: the engine resolved it.`,
            ...(hint ? [hint] : []),
            ...summariseToolBody(body)
        ];

        return {
            facts: factsForToolResult(hint ?? `${subject}: resolved.`, lines),
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{ name, action, summary: hint ?? lines.join(' '), ok: true }]
        };
    }

    /**
     * Cultivating, provisioned out of the purse.
     *
     * The engine's food clock is not a nuisance to be routed around: a full
     * belly covers fifty turn-consuming actions, so a decade of unattended
     * cultivation genuinely is impossible without provisions, and buying them
     * is the "eat, or keep the stones" choice made concrete. Provisions are
     * bought up front at whatever the purse covers; when it does not cover the
     * whole stretch, the engine starves the remainder, which is correct.
     *
     * `sealed` is what separates `seclude` from `cultivate`, and it is a real
     * bargain rather than a flavour: closed-door seclusion turns off random
     * events, which buys safety from encounters at the price of every
     * opportunity that would have found you. Both halves are the engine's.
     */
    private runSeclusion(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        days: number,
        options: { sealed?: boolean } = {}
    ): Execution {
        const sealed = options.sealed ?? false;
        const provisioning = this.buyProvisions(cultivator, days);
        const provisioned = provisioning.cultivator;
        const prepared = provisioning.covered >= days;

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(provisioned, days, {
            seed: run.seed,
            locationId: placeName(provisioned),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: 1 },
            techniqueElement: null,
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: true,
            randomEvents: !sealed,
            // A boundary crossed inside this stretch exacts its price, and it
            // can only take what the run actually owns. Handing it the real
            // rows is what makes the price a delete rather than an assertion.
            toll: {
                ...tollConditionsFor(this.repos, provisioned),
                // A sealed crossing is a prepared one: the door is shut, the
                // site was chosen, nobody is coming through it.
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: days < HURRIED_BELOW_DAYS
            },
            foundation: {
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: days < HURRIED_BELOW_DAYS
            }
        });

        const applied = applyTimeSkip(this.repos, { before: provisioned, run, skip });
        const verb: ActionName = sealed ? 'seclude' : 'cultivate';

        const facts = factsForTimeSkip(
            provisioned, applied.cultivator, skip, ambient,
            sealed ? 'Closed-door seclusion' : 'Seclusion'
        );
        facts.lines.unshift(provisioning.line);
        if (sealed) {
            facts.lines.unshift(
                'The door was sealed: no encounter and no opportunity could reach this stretch. ' +
                'Safety was bought with every chance that would have found you.'
            );
        }
        facts.lines.push(...applied.tollLines);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [...skipCalls(verb, skip, provisioning.line), ...tollCalls(applied.tollLines)]
        };
    }

    private shortSkip(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        focus: number,
        label: string,
        days = SHORT_ACTION_DAYS
    ): Execution {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, days, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: focus },
            rations: 0,
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });

        return {
            facts: factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, label),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: skipCalls(label.toLowerCase().startsWith('practice') ? 'train_technique' : 'wait', skip, null)
        };
    }

    /**
     * One breakthrough attempt, applied.
     *
     * `advanceRealm` is deliberately not used: it zeroes accumulated progress,
     * and the engine's own rule is that a successful attempt consumes exactly
     * `progressConsumed` and the overflow carries. Writing the absolute state
     * keeps this layer agreeing with `simulateTimeSkip`, which does the same.
     */
    private strikeBarrier(run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const absDay = Math.floor(run.elapsedDays);
        const result = attemptBreakthrough(cultivator, {
            rng: forStream(run.seed, 'breakthrough', absDay, cultivator.realmOrdinal),
            ambient,
            turn: run.turn,
            ranksGainedThisTurn: 0,
            // Striking the barrier on command is deliberate but unaided: the
            // cultivator chose the moment, and nothing was bought for it.
            toll: {
                ...tollConditionsFor(this.repos, cultivator),
                preparation: DELIBERATE_PREPARATION
            },
            foundation: { preparation: DELIBERATE_PREPARATION, hurried: false }
        });

        const tollLines: string[] = [];
        const after = this.db.transaction((): Cultivator => {
            for (const injury of result.injuriesSustained) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn
                });
            }

            const advanced = result.outcome === 'success';
            let updated = this.repos.cultivators.update(cultivator.id, {
                realmOrdinal: result.toOrdinal,
                cultivationProgress: Math.max(0, cultivator.cultivationProgress - result.progressConsumed),
                yearsAtCurrentRealm: advanced ? 0 : cultivator.yearsAtCurrentRealm
            });
            if (!updated) throw new GameError('Cultivator vanished mid-breakthrough.', 500);

            // The engine cannot re-derive the foundation from the ordinal
            // later, so persisting it is the caller's job.
            if (result.foundationEstablished) {
                persistFoundation(this.repos, cultivator.id, result.foundationEstablished);
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            // The instalment, charged in the same transaction as the crossing
            // that triggered it.
            if (result.toll) {
                persistToll(this.repos, run, cultivator.id, result.toll);
                tollLines.push(tollLine(result.toll));
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            this.repos.runs.incrementTurn(run.id, 1);
            if (updated.realmOrdinal > run.peakOrdinal) {
                this.repos.runs.updatePeakOrdinal(run.id, updated.realmOrdinal);
            }

            if (result.outcome === 'death') {
                const cause = result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough';
                return this.repos.cultivators.markDead(
                    cultivator.id, cause, run.turn + 1, describeDeath(cause, updated)
                ) ?? updated;
            }
            return updated;
        })();

        const calls: ToolCallRecord[] = [{
            name: 'engine.attemptBreakthrough',
            action: 'breakthrough',
            summary:
                `${(result.finalChance * 100).toFixed(1)}% final chance, rolled ${result.roll.toFixed(4)} - ` +
                `${result.outcome}. ${result.narrationHint}`,
            ok: true
        }];
        for (const injury of result.injuriesSustained) {
            calls.push({
                name: 'cultivator.addInjury',
                action: 'injury_sustained',
                summary: `${injury.severity} meridian injury recorded: ${injury.description}`,
                ok: true
            });
        }
        calls.push({
            name: 'cultivator.update',
            action: 'persist',
            summary:
                `Rank ${cultivator.realmOrdinal} → ${after.realmOrdinal}; ` +
                `${Math.round(result.progressConsumed)} qi-units consumed, ` +
                `${Math.round(after.cultivationProgress)} left banked.`,
            ok: true
        });
        if (result.foundationEstablished) {
            calls.push({
                name: 'engine.assessFoundation',
                action: 'foundation_established',
                summary: `Foundation laid: ${result.foundationEstablished}. It is what every later rank stands on.`,
                ok: true
            });
        }
        calls.push(...tollCalls(tollLines));
        if (result.outcome === 'death') {
            calls.push({
                name: 'cultivator.markDead',
                action: 'death',
                summary: `Run closed: ${result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough'}. Permadeath - no reload.`,
                ok: true
            });
        }

        const facts = factsForBreakthrough(cultivator, after, result, ambient);
        facts.lines.push(...tollLines);

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: result,
            outcome: 'executed',
            calls
        };
    }

    private eat(run: Run, cultivator: Cultivator): Execution {
        if (cultivator.satiety >= SATIETY_MAX && cultivator.starvationTurns === 0) {
            return refused('cultivator.applyDeltas', 'eat', factsForRefusal(
                'Already fed.',
                'The belly is full. Nothing was bought and nothing was spent.'
            ));
        }
        if (cultivator.spiritStones < MEAL_COST_STONES) {
            return refused('cultivator.applyDeltas', 'eat', factsForRefusal(
                'Nothing to buy it with.',
                `A meal costs ${MEAL_COST_STONES} spirit stone and the purse holds ${cultivator.spiritStones}. ` +
                'Half the deaths in this world are logistical.'
            ));
        }

        const restored = SATIETY_MAX - cultivator.satiety;
        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, {
                satiety: restored,
                starvationTurns: -cultivator.starvationTurns,
                spiritStones: -MEAL_COST_STONES
            });
            if (!updated) throw new GameError('Cultivator vanished mid-meal.', 500);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        return {
            facts: factsForEat(after, restored, MEAL_COST_STONES),
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'cultivator.applyDeltas',
                action: 'eat',
                summary:
                    `Satiety +${restored} to ${after.satiety}/100, starvation counter cleared, ` +
                    `${MEAL_COST_STONES} spirit stone spent (${after.spiritStones} left).`,
                ok: true
            }]
        };
    }

    /**
     * An action that costs a turn of attention and nothing else. No day passes,
     * no satiety is burned, no roll is made - looking around must never be able
     * to kill you, and in a permadeath game that is a rule, not a courtesy.
     */
    private freeAction(run: Run, action: ActionName, facts: EngineFacts): Execution {
        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.readState',
                action,
                summary: `${facts.headline} Read only - no time passed and no value changed.`,
                ok: true
            }]
        };
    }

    private buyProvisions(
        cultivator: Cultivator,
        days: number
    ): { cultivator: Cultivator; rations: number; covered: number; line: string } {
        const wanted = Math.ceil(days / ACTIONS_PER_FULL_SATIETY);
        const affordable = Math.floor(cultivator.spiritStones / PROVISION_COST_STONES);
        const rations = Math.max(0, Math.min(wanted, affordable));
        const cost = rations * PROVISION_COST_STONES;

        if (rations === 0) {
            return {
                cultivator,
                rations: 0,
                covered: Math.floor(cultivator.satiety / 2),
                line:
                    `No provisions were bought (${cultivator.spiritStones} spirit stones, ` +
                    `${PROVISION_COST_STONES} per ration). The belly covers ${Math.floor(cultivator.satiety / 2)} days and then starvation begins.`
            };
        }

        const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost });
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const covered = rations * ACTIONS_PER_FULL_SATIETY + Math.floor(cultivator.satiety / 2);
        return {
            cultivator: updated,
            rations,
            covered,
            line: covered >= days
                ? `Provisions bought: ${rations} ration${rations === 1 ? '' : 's'} for ${cost} spirit stones, covering the whole stretch. ${updated.spiritStones} stones left.`
                : `Provisions bought: ${rations} ration${rations === 1 ? '' : 's'} for ${cost} spirit stones - food for about ${humanDays(covered)} of the ${humanDays(days)} asked for. After that the belly is empty and five turns later it is fatal.`
        };
    }

    // ── plumbing ─────────────────────────────────────────────────────────

    private ambientFor(cultivator: Cultivator, run: Run): AmbientQi {
        return ambientForBlock(run.seed, placeName(cultivator), Math.floor(run.elapsedDays));
    }

    /** The newest run - live if there is one, otherwise the last one to end. */
    private currentRun(): { run: Run; cultivator: Cultivator } {
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.deathLedger(1)[0] ?? null;
        if (!run) throw new GameError('No run has been started yet.', 404);
        const cultivator = this.repos.cultivators.getById(run.cultivatorId);
        if (!cultivator) throw new GameError('This run has no cultivator. The save is inconsistent.', 500);
        return { run, cultivator };
    }

    /**
     * Who is asking, and what they have heard of.
     *
     * Passed to every entity resolver so that a sect the player has never heard
     * named simply does not resolve. `here` lets anyone standing in the same
     * place resolve regardless, which is the `encountered` stage of
     * discovery.md: you can see who is in the room without being told a name.
     */
    private scopeFor(cultivator: Cultivator): KnowledgeScope {
        return {
            gate: this.knowledge,
            holderId: cultivator.id,
            here: cultivator.location
        };
    }

    /** Everything this cultivator has heard of. The narrator's whitelist. */
    private awarenessOf(cultivator: Cultivator): AwarenessRow[] {
        return this.knowledge.awareness(cultivator.id);
    }

    /**
     * What the player could have meant, drawn only from what they know.
     *
     * A refusal that listed every recruiting sect in the catalog would leak the
     * world through the error path, which is exactly the door discovery.md is
     * shutting. This lists people in the room and names already held.
     */
    private knownNamesLine(cultivator: Cultivator, scope: KnowledgeScope): string {
        const names = nearbyNames(this.repos, cultivator, scope);
        return names.length > 0
            ? `Known to this cultivator, or standing here: ${names.join(', ')}.`
            : 'This cultivator has heard of nobody and nowhere but the ground under them.';
    }

    /**
     * Record that the player has now encountered something.
     *
     * discovery.md is explicit that each step up the ladder of knowing needs a
     * source, and that a name learned from a drunk and a name read in an
     * archive are different facts. So awareness is written with its provenance
     * rather than left to exist only in the transcript, which is where it would
     * be unauditable and unrevisable.
     */
    private noteEncounter(
        cultivator: Cultivator,
        run: Run,
        entity: { kind: string; id: string; name: string },
        sourceKind: 'witnessed' | 'told' | 'read',
        note: string
    ): boolean {
        const kind = entity.kind;
        if (kind !== 'cultivator' && kind !== 'sect' && kind !== 'place') return false;
        return this.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind,
            id: entity.id,
            name: entity.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind,
            sourceNote: note,
            stance: sourceKind === 'witnessed' ? 'knows' : 'believes'
        });
    }

    /** True once a crossing has taken this cultivator's name. */
    private nameTaken(cultivator: Pick<Cultivator, 'id'>): boolean {
        return readFlag(this.db, cultivator.id, FLAG_NAME_TAKEN) === '1';
    }

    /**
     * The run, for a caller that intends to change it.
     *
     * Death is terminal. Refusing every mutating call afterwards is enforced
     * here rather than in each handler, so a new endpoint cannot forget it.
     */
    private requireLiveRun(): { run: Run; cultivator: Cultivator } {
        const current = this.currentRun();
        if (current.run.status !== 'active' || !current.cultivator.alive) {
            throw new GameError(
                `${current.cultivator.name} is dead (${current.run.deathCause ?? current.cultivator.deathCause ?? 'unrecorded'}). ` +
                'The run is closed: there is no reload, no revival, and no continuation. Begin a new run.',
                409
            );
        }
        return current;
    }

    /**
     * The sect's display name for a cultivator's `sectId`.
     *
     * Two sources, in the order that respects an operator's own edits: a sect
     * written into this database wins, and the shipped catalog in
     * `src/data/cultivation` answers for the ids that were never persisted. An
     * id that resolves to neither yields null rather than itself - the sheet
     * shows "unaffiliated" instead of a database key.
     */
    sectNameFor(cultivator: Pick<Cultivator, 'sectId'>): string | null {
        if (!cultivator.sectId) return null;
        return this.repos.sects.getById(cultivator.sectId)?.name
            ?? getSect(cultivator.sectId)?.name
            ?? null;
    }

    /**
     * Display names for the arts the cultivator knows, resolved through the same
     * two sources as sects. An id the catalog does not hold is passed through
     * as-is rather than dropped: an unknown art the player nonetheless owns is
     * worth mentioning, and inventing a name for it would be worse.
     */
    private knownTechniqueNames(cultivator: Cultivator): string[] {
        return cultivator.knownTechniques.map(id => getTechnique(id)?.name ?? id);
    }

    private stateView(run: Run, cultivator: Cultivator): StateView {
        return {
            run: runView(run),
            cultivator: cultivatorView(cultivator),
            ambient: this.ambientFor(cultivator, run),
            derived: derivedView(cultivator, {
                sectName: this.sectNameFor(cultivator),
                nameTaken: this.nameTaken(cultivator)
            }),
            // "You can look at the ledger and see the shape of who you used to
            // be" is a design requirement, so the ledger is on the wire.
            tolls: listTolls(this.db, cultivator.id),
            log: this.log.list(run.id)
        };
    }

    /**
     * Engine rulings, as log lines. Sourced only from facts.ts and SimEvents.
     *
     * The structure channel is included here and NOT in the narrator prompt.
     * The log is the operator's record, where a rank ordinal and a governance
     * category are exactly the right words; the prose is where they would
     * become a briefing the world does not contain.
     */
    private engineEntries(execution: Execution, turn: number): LogEntry[] {
        const entries: LogEntry[] = [{ role: 'engine', turn, text: execution.facts.headline }];
        for (const line of execution.facts.structure) {
            entries.push({ role: 'engine', turn, text: line });
        }
        for (const event of execution.events.slice(0, MAX_LOGGED_EVENTS)) {
            entries.push({ role: 'engine', turn, text: `Day ${Math.round(event.dayOffset)}: ${event.summary}` });
        }
        if (execution.events.length > MAX_LOGGED_EVENTS) {
            entries.push({
                role: 'engine',
                turn,
                text: `(${execution.events.length - MAX_LOGGED_EVENTS} further events are in the seclusion digest.)`
            });
        }
        return entries;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A time-skip, broken into the calls it actually made.
 *
 * Every `summary` here is either composed from the digest's own numbers or is a
 * `SimEvent.summary` verbatim - engine strings, not prose. The per-event rows
 * are what make the inspector worth opening: a decade of seclusion shows up as
 * the breakthroughs, deviations and opportunities the engine ruled, in order,
 * next to whatever the narration made of them.
 */
function skipCalls(action: string, skip: TimeSkipResult, provisioning: string | null): ToolCallRecord[] {
    const calls: ToolCallRecord[] = [];

    if (provisioning) {
        calls.push({
            name: 'cultivator.applyDeltas',
            action: 'buy_provisions',
            summary: provisioning,
            ok: true
        });
    }

    calls.push({
        name: 'engine.simulateTimeSkip',
        action,
        summary:
            `${skip.simulatedDays} of ${skip.requestedDays} day(s) resolved in one deterministic pass` +
            (skip.interrupted ? `, interrupted: ${skip.interruptReason ?? 'unspecified'}` : '') +
            `. ${skip.events.length} event(s); ` +
            `${skip.deltas.realmOrdinal >= 0 ? '+' : ''}${skip.deltas.realmOrdinal} rank, ` +
            `${Math.round(skip.deltas.cultivationProgress)} progress, ` +
            `${skip.deltas.injuriesGained} injury(ies).`,
        ok: true
    });

    for (const event of skip.events.slice(0, MAX_LOGGED_EVENTS)) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: event.kind,
            summary: `Day ${Math.round(event.dayOffset)}: ${event.summary}`,
            ok: true
        });
    }
    if (skip.events.length > MAX_LOGGED_EVENTS) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: 'events_elided',
            summary: `${skip.events.length - MAX_LOGGED_EVENTS} further event(s) are in the seclusion digest.`,
            ok: true
        });
    }

    calls.push({
        name: 'storage.applyTimeSkip',
        action: 'persist',
        summary:
            `Wrote the result: ${skip.simulatedDays} day(s) of in-world time, ` +
            `${skip.deltas.injuriesGained} injury row(s), one turn.`,
        ok: true
    });

    if (skip.died) {
        calls.push({
            name: 'cultivator.markDead',
            action: 'death',
            summary: `Run closed: ${skip.deathCause}. Permadeath - no reload, no revival.`,
            ok: true
        });
    }

    return calls;
}

/**
 * The handful of fields worth reading off an MCP handler's result.
 *
 * Deliberately a small allowlist rather than a dump of the whole body: these
 * results are large, and everything not listed here is either an id the player
 * cannot use or a projection the sheet already shows.
 */
function summariseToolBody(body: Record<string, unknown>): string[] {
    const lines: string[] = [];

    const odds = body.odds as { finalChancePercent?: number; roll?: number } | undefined;
    if (odds && typeof odds.finalChancePercent === 'number') {
        lines.push(`Odds were ${odds.finalChancePercent}%, rolled ${odds.roll ?? 'unrecorded'}.`);
    }

    const produced = body.produced as { name?: string; effect?: string } | null | undefined;
    if (produced?.name) {
        lines.push(`Produced: ${produced.name}${produced.effect ? ` (${produced.effect})` : ''}.`);
    }

    const consumed = body.ingredientsConsumed as Array<{ name?: string; quantity?: number }> | undefined;
    if (Array.isArray(consumed) && consumed.length > 0) {
        lines.push(
            'Consumed whether it worked or not: ' +
            consumed.map(i => `${i.quantity ?? 1} x ${i.name ?? 'unknown'}`).join(', ') + '.'
        );
    }

    if (typeof body.masteryBefore === 'number' && typeof body.masteryAfter === 'number') {
        lines.push(
            `Mastery ${(body.masteryBefore * 100).toFixed(0)}% to ${(body.masteryAfter * 100).toFixed(0)}%.`
        );
    }
    const deviation = body.deviation as { deviated?: boolean; summary?: string } | undefined;
    if (deviation?.deviated && deviation.summary) lines.push(deviation.summary);

    return lines;
}

/**
 * The one sect a villager could name.
 *
 * discovery.md: a new cultivator's world is "the county, the local sect that
 * takes disciples, the market town, and whatever their grandmother believed".
 * There is no locality model yet, so the nearest honest stand-in is the
 * catalog's lowest-admission body that takes applicants at all - the one a
 * person with no cultivation would plausibly have heard mentioned. Exactly one,
 * because the point is that the list is almost empty.
 *
 * TODO(world): once regions exist, this should be the sect whose territory
 * contains the starting location, not the softest entry in the catalog.
 */
function localSect(): { id: string; name: string } | null {
    const candidates = SECTS.filter(sect => sect.recruits);
    if (candidates.length === 0) return null;

    const chosen = candidates.reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id)
            ? sect
            : best);

    return { id: chosen.id, name: chosen.name };
}

/**
 * Structural truth, as inspectable rows.
 *
 * These are the categories the narrator is never shown: ordinals, grades,
 * governance, rank ladders. They are precisely what an operator auditing a run
 * wants, and precisely what would turn a scene into a lecture.
 */
function structureCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.structure',
        action: 'not_narrated',
        summary: line,
        ok: true
    }));
}

/** What the crossings cut away, as inspectable rows. */
function tollCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.evaluateToll',
        action: 'toll_charged',
        summary: line,
        ok: true
    }));
}

function refused(name: string, action: string, facts: EngineFacts): Execution {
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'refused',
        calls: [{ name, action, summary: facts.lines[0] ?? facts.headline, ok: false }]
    };
}

/**
 * The routing step, as an inspectable row.
 *
 * Deliberately first in the list and deliberately explicit about where the verb
 * came from: this is the one place a model influenced anything, and a player
 * auditing the run should be able to see that it influenced only this.
 */
function routingCall(plan: { action: PlannedAction; source: PlanSource; note?: string }): ToolCallRecord {
    const args = [
        plan.action.days !== undefined ? `days=${plan.action.days}` : null,
        plan.action.target !== undefined ? `target="${plan.action.target}"` : null
    ].filter(Boolean).join(', ');

    return {
        name: 'narrator.plan',
        action: plan.action.action,
        summary:
            (plan.source === 'model'
                ? 'Intent routed by the model to '
                : 'Intent parsed deterministically to ') +
            `${plan.action.action}${args ? `(${args})` : '()'}` +
            (plan.note ? ` - ${plan.note}` : '') +
            '. The verb is a member of a closed set; nothing else from the response was read.',
        ok: true,
        source: plan.source,
        ...(plan.note ? { note: plan.note } : {})
    };
}

/** The prose step. Listed so it is visibly separate from, and after, the engine. */
function narrationCall(narration: { source: 'model' | 'fallback'; note: string | null }): ToolCallRecord {
    return {
        name: 'narrator.narrate',
        action: 'narrate',
        summary: narration.source === 'model'
            ? 'Prose written by the model from the engine facts above. Not read back into state.'
            : `Prose rendered directly from the engine's own account${narration.note ? ` (${narration.note})` : ''}.`,
        ok: true,
        source: narration.source,
        ...(narration.note ? { note: narration.note } : {})
    };
}

