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
import { MAX_ORDINAL, rankName } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import { rollAttributes, rollSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { SATIETY_COST_PER_ACTION } from '../schema/cultivation.js';
 import {
    ACTIONS_PER_FULL_SATIETY,
    describeDeath,
    evaluateDeathConditions,
    satietyBurnMultiplier,
    stillNeedsToEat
} from '../engine/cultivation/survival.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { rollHerb } from '../data/cultivation/index.js';
import {
    PRICES,
    cashToStones,
    findWorkForOrdinal,
    getPrice
} from '../data/cultivation/mortal-world.js';
import { localPrice } from '../data/cultivation/regions.js';
import {
    treatWorstInjuries,
    untreatedInjuries,
    untreatedInjuryCount
} from '../engine/cultivation/injuries.js';
import type { Injury } from '../schema/cultivation.js';
import { ladderOddsReport, type LadderOddsReport } from '../engine/world/ladder-odds.js';
import { round2 } from '../server/consolidated/cultivation-support.js';
import { setDb } from '../storage/index.js';
import { resetCultivationWorlds } from '../server/state/cultivation-world.js';
import { SECTS, getSect, getTechnique } from '../data/cultivation/index.js';
import { handleRefine } from '../server/consolidated/alchemy-manage.js';
import { handleCultivate } from '../server/consolidated/cultivation-manage.js';
import { handleMarket, handleWork, standingOf } from '../server/consolidated/cultivation-mortal.js';
import { handleAssess } from '../server/consolidated/cultivation-perception.js';
import {
    handleJoin,
    handleLeave,
    handleSiphon,
    handleList,
    handlePromote,
    handleStanding,
    handleStipend
} from '../server/consolidated/sect-manage.js';
import {
    handleAdmission,
    handleCurriculum,
    handleExpel,
    handleOrder,
    handleRecruit
} from '../server/consolidated/sect-leadership.js';
import { handleResolve } from '../server/consolidated/combat-manage.js';
import { handleLearn, handlePractise } from '../server/consolidated/technique-manage.js';
import {
    FLAG_NAME_TAKEN,
    ensureCultivationDb,
    addToPouch,
    isGuidingErrorBody,
    listTolls,
    persistFoundation,
    persistToll,
    readFlag,
    writeFlag,
    tollConditionsFor,
    type CultivationRepos,
    type TollLedgerEntry
} from '../server/consolidated/cultivation-support.js';
import { applyTimeSkip, tollLine } from './apply.js';
import {
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_ERRAND,
    DEFAULT_SECLUSION_DAYS,
    DEFAULT_WORK_DAYS,
    GATHERING_DAYS,
    MAX_CULTIVATION_DAYS,
    TRAINING_DAYS,
    DEFAULT_RECALL_INTENT,
    DEFAULT_SITE_INTENT,
    RECALL_INTENTS,
    SITE_INTENTS,
    parseCount,
    type ActionName,
    type PlanSource,
    type PlannedAction,
    type RecallIntent,
    type SiteIntent
} from './actions.js';
import {
    knownTechniqueNames,
    nearbyNames,
    pouchNames,
    resolveAnything,
    resolveCultivator,
    worldLocationFor,
    type ResolvedEntity,
    resolveHerb,
    resolveParty,
    resolvePill,
    resolvePlace,
    resolvePrice,
    resolveRecipe,
    resolveSect,
    resolveTechnique,
    matchScore,
    MATCH_THRESHOLD,
    type KnowledgeScope
} from './entities.js';
import { KnowledgeGate, placeKey, type AwarenessRow } from './knowledge.js';
import {
    SiteLedger,
    awarenessOfSite,
    claimantOf,
    faceOf,
    forceAt,
    forceOrdinalOf,
    nameableSites,
    prizeImmortalItemIds,
    prizeOther,
    prizeTechniqueIds,
    readGates,
    resolveSite,
    type FateEvidence,
    type GateVerdict
} from './trials.js';
import { SITES, enterSite, type Site } from '../data/cultivation/inheritance-trials.js';
import { assessPower, resolveExchange } from '../engine/cultivation/combat.js';
import { askedAbout } from './asked.js';
import {
    hearingProse,
    offerHearing,
    othersPresent,
    recordHearing,
    type AnswerReach,
    type Hearing,
    type HearingIntent
} from './hearsay.js';
import { observableHere, observedLine } from './practices.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import { advanceWorldForCultivator, worldForRun } from '../server/state/cultivation-world.js';
import { planNextRun, recordRun, lastFinishedRun } from '../engine/world/legacy.js';
import type { PlayerDigest } from '../engine/world/digest.js';
import type { WorldState } from '../engine/world/world-state.js';
import { locationHistory } from '../engine/world/locations.js';
import {
    factsForBreakthrough,
    factsForEat,
    factsForGather,
    factsForInteraction,
    factsForCompany,
    factsForInvestigation,
    factsForLook,
    factsForMove,
    factsForPlaceHistory,
    factsForGateRefused,
    factsForSiteFace,
    factsForSiteInterior,
    factsForSiteListing,
    factsForDao,
    factsForHolding,
    factsForRecall,
    factsForSiteTaken,
    factsForTreatment,
    factsForUnsupported,
    type Company,
    type SiteFace,
    factsForRefusal,
    factsForStatus,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    type EngineFacts
} from './facts.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import { daoOf } from '../engine/cultivation/dao.js';
import { PlayLog, type LogEntry } from './log.js';
import type { Narrator } from './narrator.js';
import { composeStateSummary } from './prompt.js';
import { handleAdminManage, isAdminModeEnabled } from '../server/consolidated/admin-manage.js';
import {
    cultivatorView,
    derivedView,
    ledgerRowView,
    refusalText,
    rosterRowView,
    runView,
    worldRosterRow,
    daoView,
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
/**
 * Whose database is currently the ambient one.
 *
 * `setDb` installs a PROCESS-global handle, and so do the world caches
 * downstream of it. One service per process is the deployment and never
 * notices; two in one process silently share whichever was built last,
 * which is how a run in one database ended up standing in a crowd of a
 * hundred and forty-three people from another.
 */
let ambientDb: Database.Database | null = null;

/**
 * Phrases that point at a person rather than naming one.
 *
 * Kept deliberately narrow. Everything here is a role, a pronoun or a
 * demonstrative - words that cannot be somebody's name - so a misspelled
 * real name never lands here and quietly gets the wrong person.
 */
const POINTING = /^(?:the |that |this |a |an |some )?(?:nearest |closest |nearby |other |old |young |first )*(?:cultivator|cultivators|person|people|man|woman|men|women|elder|stranger|passerby|local|villager|guard|steward|merchant|trader|monk|beggar|one|fellow|him|her|them|they)$/i;

export const PROVISION_COST_STONES = 2;

/**
 * Where rations bought ahead of time are kept.
 *
 * A per-cultivator counter rather than a new table: the engine already owns
 * a flag store keyed exactly this way, and a schema change to hold one
 * integer would be a migration this layer has no business writing.
 */
const FLAG_RATIONS_HELD = 'rations_held';
/** Spirit stones for one meal at `eat`. */
export const MEAL_COST_STONES = 1;

/** Days a `travel` or `wait` action consumes. */
export const SHORT_ACTION_DAYS = 1;
/**
 * Days spent going into an inheritance ground.
 *
 * A deployment choice like `SHORT_ACTION_DAYS`, not an engine constant: the
 * engine has no opinion about how long a shaft is. What it buys is that going
 * in is never free - the food clock runs, the world moves, and a cultivator
 * who walks into a grave on their last ration can die of the walk rather than
 * of the grave, through exactly the survival layer everything else dies
 * through.
 */
export const ENTERING_DAYS = 3;
/**
 * A course of mortal care, in days.
 *
 * The catalog names it: `price-splint-and-month` is "Splint and a month of
 * care", and its note says it is the mortal alternative to a healing pill -
 * slower, cheaper, and it leaves you out of the fight for a season. The month
 * is the catalog's number; the season is what it feels like after two of them.
 */
export const TREATMENT_DAYS = 30;
/** Focus multipliers for time spent on something other than sealed seclusion. */
export const TRAVEL_FOCUS = 0.15;
export const GATHERING_FOCUS = 0.2;
export const WAITING_FOCUS = 0.25;
/** Nobody gathers qi while climbing down a lined shaft in the dark. */
export const ENTERING_FOCUS = 0.05;
/**
 * Lying still with a torn meridian is not seclusion.
 *
 * Not zero: the month passes and the body is doing something with it. Low
 * enough that nobody treats an infirmary as a cheap cave, which they would at
 * five stones a month if it cultivated.
 */
export const TREATMENT_FOCUS = 0.1;

/**
 * A price as the mortal-economy tool reports it.
 *
 * Both currencies, because the world has two on purpose: `mortal-world.ts`
 * anchors a hundred cash to the spirit stone precisely so that ordinary life
 * is priced in cash and cultivation is priced in stones.
 */
interface MarketPrice {
    name?: string;
    category?: string;
    unit?: string;
    cash?: number;
    spiritStones?: number;
    affordable?: boolean;
}

/**
 * Categories that belong to ordinary life and are priced in cash.
 *
 * Rendering a bowl of millet as 0.01 spirit stones throws away the whole point
 * of the second currency and produces a number nobody can hold in their head.
 * One cash for the millet, a hundred and twenty for a month of rations: those
 * are figures a player can reason with.
 */
const MORTAL_CATEGORIES = new Set(['food', 'lodging', 'transport', 'medicine', 'service']);

/** What a thing costs, in whichever currency it is actually sold in. */
/**
 * How many lines of a price board get read out.
 *
 * Every count in the paragraph underneath is taken against this same
 * slice. A board that lists eight and reasons about twenty-five is telling
 * the player about goods they cannot see.
 */
const MARKET_LINES = 8;

function priceOf(item: MarketPrice): string {
    const unit = item.unit ? ` the ${item.unit}` : '';
    const mortal = item.category === undefined || MORTAL_CATEGORIES.has(item.category);

    if (mortal && typeof item.cash === 'number') {
        return `${Math.round(item.cash)} cash${unit}`;
    }
    if (typeof item.spiritStones === 'number') {
        return `${round2(item.spiritStones)} spirit stones${unit}`;
    }
    return `an unmarked price${unit}`;
}

/**
 * The purse, in both currencies.
 *
 * The conversion appears here and almost nowhere else, which is where it
 * belongs: changing a stone for cash is the small moment a cultivator has when
 * they discover their savings are somebody's month of dinners.
 */
function describePurseCash(purse: { cash?: number; spiritStones?: number }): string {
    const stones = typeof purse.spiritStones === 'number' ? purse.spiritStones : 0;
    const cash = typeof purse.cash === 'number' ? purse.cash : stones * 100;
    if (stones === 0) return `${Math.round(cash)} cash and no stones`;
    return `${stones} spirit stones, which is ${Math.round(cash)} cash`;
}

/** Market board categories the parser can narrow to. */
const MARKET_CATEGORIES = [
    'food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information'
] as const;

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
/**
 * The actions that only mean anything among mortals.
 *
 * Everything left out is still legal above the Lid: looking at where you are,
 * reading your own sheet, sitting down to cultivate, weighing an attempt. What
 * is here is the mortal economy and mortal society, neither of which a True
 * Immortal is standing in.
 */
const MORTAL_WORLD_ACTIONS: readonly ActionName[] = [
    'work', 'market', 'provision', 'eat', 'gather', 'interact', 'sect', 'move',
    // An inheritance ground is a hole in a hillside in the province. A True
    // Immortal is not standing near one, and the trip back down costs nine
    // strikes of the heaviest tribulation there is.
    'site'
] as const;

/**
 * The words that mean "the library" rather than naming anything in it.
 *
 * A curriculum sentence carries the noun phrase the parser found after the
 * verb, and for the commonest phrasing that phrase IS the question - "what the
 * sect teaches". Refusing to resolve it is what keeps a request to see the
 * shelf from becoming a generational decree about an art nobody named.
 */
const GENERIC_LIBRARY_PHRASE =
    /\b(?:what|which|curriculum|curricula|library|shelf|taught|teach|teaches|teaching|methods|list|everything|anything|else)\b/i;

/**
 * How many things done to a place are read out at once.
 *
 * A place that has been fought over for three thousand years has a long log,
 * and a wall of them is a chronicle rather than an answer. The most recent
 * changes are the ones that made it what it is now.
 */
const PLACE_CHANGES_SHOWN = 3;

/** The ways of saying "here" that are not the name of anywhere. */
const HERE_ITSELF =
    /^(?:this|that|the)?\s*(?:place|ground|village|town|city|region|area|spot|here|it|ruin|ruins)$/i;

/**
 * The words that mean "the site in front of me" rather than naming one.
 *
 * The same defect `GENERIC_LIBRARY_PHRASE` exists for, and the same fix. The
 * parser hands over the noun phrase it found after the verb, and for the
 * commonest phrasings that phrase is generic - "the door", "the grave", "what
 * is behind the plate". Handing one of those to a fuzzy matcher resolves it:
 * "door" is contained in "The Door That Wants Somebody Not In the Record" and
 * scores over the threshold, so "I study the door" would open a specific
 * fate-gated trial three provinces away that the player has never heard of.
 * A generic phrase names nothing and falls through to the site at hand.
 */
const GENERIC_SITE_PHRASE =
    /^(?:the |a |an |this |that |it |what |whatever )*(?:door|doorway|gate|gateway|gate frame|threshold|marker|headstone|entrance|shaft|plate|standing stone|site|sites|place|trial|trials|grave|graves|tomb|tombs|crypt|crypts|barrow|barrows|undercroft|interment|inheritance|inheritance ground|inheritance grounds|grave goods?|prize|contents|manuals?|is behind.*|is inside.*|is in there|is left|behind.*|inside.*)$/i;

/**
 * Which elder a sentence meant, out of the ones the house actually holds.
 *
 * Matched against the roster the tool just returned rather than against
 * anything the player asserted, and a query that names nobody resolves to
 * nobody so the listing stands. Names are tried before rank titles and never
 * mixed with them: every elder in a house shares a title, so scoring the two
 * together lets "Elder Fang" match the word "Elder" on somebody else and
 * dismiss a person the player never named. This is the one leadership act that
 * lands the day it is spoken, and it takes the elder's whole line out with
 * them - a near miss here is not a near miss, it is the wrong person gone.
 */
function elderNamed(listing: object, query: string | undefined): string | null {
    const wanted = (query ?? '').trim();
    if (wanted.length < 3 || ANY_ELDER_AT_ALL.test(wanted)) return null;

    const elders = (listing as {
        elders?: Array<{ elderId?: string; name?: string | null; rankTitle?: string | null }>;
    }).elders ?? [];

    const pick = (nameOf: (e: { name?: string | null; rankTitle?: string | null }) => string | null) => {
        let winner: string | null = null;
        let winningScore = 0;
        for (const elder of elders) {
            const candidate = elder.elderId ? nameOf(elder) : null;
            if (!candidate) continue;
            const score = matchScore(wanted, candidate);
            if (score >= MATCH_THRESHOLD && score > winningScore) {
                winner = elder.elderId!;
                winningScore = score;
            }
        }
        return winner;
    };

    return pick(e => e.name ?? null) ?? pick(e => e.rankTitle ?? null);
}

/** "an elder", "one of the elders" - a rung, not a person. */
const ANY_ELDER_AT_ALL =
    /^(?:one of\s+)?(?:the|an?|any|some|my|our)?\s*elders?$/i;

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

/**
 * ADMIN, spoken in play. Matched at the head of the input only, so a sentence
 * that merely contains the word is an ordinary turn - "the admin of the sect
 * refused me" must not open a tool surface.
 */
const ADMIN_PREFIX = /^admin(?![a-z])[:\s-]*/i;

/** Mirrors `admin_manage`'s own action list, for the guiding error only. */
const ADMIN_ACTIONS = [
    'roster', 'spawn_encounter', 'spawn_site', 'grant_item',
    'set_ambient', 'set_location', 'advance_days', 'set_realm', 'audit_log'
] as const;

export interface ActResult {
    narration: string;
    events: SimEvent[];
    toolCalls: ToolCallRecord[];
    state: StateView;
}

export interface CultivateResult {
    timeSkip: TimeSkipResult;
    state: StateView;
    /**
     * The same prose a typed command would have produced.
     *
     * This was always being written - narrated, and appended to the log -
     * and then dropped on the floor before the response was built, so a
     * player who clicked got a table of deltas and a player who typed got
     * the game. One design, two front doors, and only one of them had it.
     */
    narration: string;
}

export interface BreakthroughApiResult {
    result: BreakthroughResult;
    state: StateView;
    /** As above: the click path narrates the same way the typed path does. */
    narration: string;
}

export interface GameServiceOptions {
    db: Database.Database;
    narrator: Narrator;
    /**
     * Whether the world advances alongside the cultivator.
     *
     * The world itself is owned by `src/server/state/cultivation-world.ts` and
     * is addressed by run, not held here. This flag exists only so a test can
     * run the cultivation engine on its own without paying to seed several
     * hundred people it is not asserting anything about.
     */
    worldEnabled?: boolean;
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
    /**
     * A name somebody said in this scene, decided and recorded by the engine.
     *
     * Carried on the execution rather than fetched during narration so that the
     * knowledge record is written in phase 2, where writes belong, and phase 3
     * only ever receives a licence to mention what is already true.
     */
    hearing?: Hearing | null;
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
    /**
     * What this run has done to the inheritance grounds it has found.
     *
     * Over `cultivation_sites`, which the schema already keeps for exactly
     * this and whose own comment says a site outlives the run that turned it
     * up. Same posture as `KnowledgeGate` over `knowledge_records`: a narrow
     * reader and writer, not a second table.
     */
    private readonly sites: SiteLedger;
    /** Whether time passing for the cultivator also passes for everyone else. */
    readonly worldEnabled: boolean;
    /**
     * The world, loaded once per action.
     *
     * Resolving who is standing in front of the player needs the world, and it
     * is asked several times in the course of one action - by the scope, by the
     * hearing check, by a refusal deciding whether anybody is about. Loading it
     * once at the top of the action and holding it is the difference between
     * one rebuild and five.
     */
    private atHand: WorldState | null = null;
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
        this.sites = new SiteLedger(this.db);
        this.worldEnabled = options.worldEnabled ?? true;
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
    /**
     * Point the ambient handle at this service's database.
     *
     * Called at the top of every public entry point rather than once in the
     * constructor. Production has one service and never notices; two in one
     * process silently share whichever was built last, which is how three
     * separate suite runs produced three different sets of failures from
     * the same code.
     */
    private useOwnDb(): void {
        if (ambientDb === this.db) return;
        setDb(this.db);
        // The world layer holds process-global caches - which world is the
        // active one, which world a run belongs to, the catalog - and none of
        // them are keyed by database. Swapping the handle underneath them
        // without saying so means the next run joins whichever world was
        // created first in this process, from whichever database that was.
        // `resetCultivationWorlds` exists for exactly this and says so; the
        // worlds are in SQLite and come back on the next touch.
        resetCultivationWorlds();
        ambientDb = this.db;
    }

    async newRun(name: string): Promise<{ run: RunView; cultivator: Cultivator }> {
        this.useOwnDb();
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

        // The next life begins in the world the last one left behind, not in a
        // fresh one. `planNextRun` decides the seed, so a run is a life lived
        // inside this world rather than a world of its own - which is what
        // makes the ruins the new cultivator digs through the previous
        // cultivator's. When there is no world, the seed factory stands in.
        const previousRun = this.repos.runs.deathLedger(1)[0] ?? null;
        const world = this.worldEnabled && previousRun ? await worldForRun(previousRun) : null;
        const plan = world
            ? planNextRun(world, {
                index: world.runs.length,
                onDay: world.currentDay,
                previous: lastFinishedRun(world)
            })
            : null;
        const seed = plan ? plan.seed : this.seedFactory();

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
        const facts = factsForLook(created.cultivator, ambient, this.company(created.cultivator));
        const opening = await this.narrator.narrate(facts, {
            place: placeName(created.cultivator),
            ambient,
            awareness
        });

        // What the world contributes to this life, in the world's own words.
        // A stranger is told they are a stranger; a descendant is told whose.
        if (plan && world) {
            recordRun(world, {
                id: created.run.id,
                seed,
                index: plan.index,
                cultivatorId: created.cultivator.id,
                cultivatorName: created.cultivator.name,
                startedOnDay: world.currentDay,
                endedOnDay: null,
                outcome: 'active',
                peakOrdinal: 0,
                graveLocationId: null,
                successorRelation: null
            });
        }

        this.log.append(created.run.id, [
            ...(plan ? [{ role: 'narrator' as const, turn: 0, text: plan.note }] : []),
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
        this.useOwnDb();
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
        this.useOwnDb();
        const trimmed = input.trim();
        if (trimmed.length === 0) throw new GameError('Say something.');
        if (trimmed.length > 2000) throw new GameError('That is too long. Two thousand characters at most.');

        const { run, cultivator } = this.requireLiveRun();

        // ADMIN is an operator surface, not a game action, so it is answered
        // before the narrator ever sees the input. context.md: it lifts content
        // gates and never the authority rule - every action below performs a
        // real audited mutation and returns what the engine actually did.
        const admin = ADMIN_PREFIX.exec(trimmed);
        if (admin) return await this.adminAct(trimmed.slice(admin[0].length), run, cultivator);

        const ambient = this.ambientFor(cultivator, run);
        this.atHand = await this.loadWorld();

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
        const execution = await this.execute(plan.action, run, cultivator, ambient, trimmed);

        const after = this.currentRun();
        const scene = {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator),
            hearing: execution.hearing ?? null,
            // Asking turns on what was said, so the words reach phase 3. They
            // are shown to the narrator and never read back: no key matching,
            // no phrase table, no engine surface. The judgement is narration.
            playerSaid: trimmed
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
        this.useOwnDb();
        const requested = Math.floor(Number(days));
        if (!Number.isFinite(requested) || requested < 1) {
            throw new GameError('Cultivation needs a whole number of days, at least one.');
        }
        if (requested > MAX_CULTIVATION_DAYS) {
            throw new GameError(`The longest seclusion this engine will resolve in one pass is ${MAX_CULTIVATION_DAYS} days.`);
        }

        const { run, cultivator } = this.requireLiveRun();
        const ambient = this.ambientFor(cultivator, run);
        const execution = await this.runSeclusion(run, cultivator, ambient, requested);
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

        return {
            timeSkip: execution.timeSkip,
            state: this.stateView(after.run, after.cultivator),
            narration: narration.text
        };
    }

    /** Strike the barrier now. Refuses loudly when the engine says it is not legal. */
    async breakthrough(): Promise<BreakthroughApiResult> {
        this.useOwnDb();
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

        return {
            result: execution.breakthrough,
            state: this.stateView(after.run, after.cultivator),
            narration: narration.text
        };
    }

    // ── read-only surfaces ───────────────────────────────────────────────

    /**
     * Refuse an operator surface when admin mode is off.
     *
     * Shared so every admin endpoint refuses in the same words and with the
     * same status. It does not guard state - nothing behind it writes - it
     * guards *disclosure*: these surfaces state plainly what the world spends
     * a great deal of effort keeping unstated.
     */
    assertAdmin(what: string): void {
        if (!this.adminMode) {
            throw new GameError(`Admin mode is off. Set ADMIN_MODE=true to enable ${what}.`, 403);
        }
    }

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
    async roster(): Promise<{ roster: RosterRowView[] }> {
        this.useOwnDb();
        if (!this.adminMode) {
            throw new GameError('Admin mode is off. Set ADMIN_MODE=true to enable the roster.', 403);
        }
        const player = this.repos.runs.getActiveRun()?.cultivatorId
            ?? this.repos.runs.deathLedger(1)[0]?.cultivatorId
            ?? null;
        // Both populations. The database holds the player and whoever a run
        // wrote down; the world holds the several hundred people who were
        // already here. An operator asking who is in this world wants the
        // world, not the subset that happens to have a row.
        const stored = this.repos.cultivators.roster().map(entry => rosterRowView(entry, player));
        const world = await this.loadWorld();
        const inWorld = world
            ? world.npcs.map(npc => worldRosterRow(npc, world.currentDay))
            : [];

        return {
            roster: [...stored, ...inWorld].sort((a, b) =>
                Number(b.alive) - Number(a.alive) ||
                b.realmOrdinal - a.realmOrdinal ||
                a.name.localeCompare(b.name))
        };
    }

    /**
     * How far anybody actually gets, three ways.
     *
     * Belief, model and measurement side by side, plus what this particular
     * world contains today. Admin only, and a balance instrument rather than a
     * play surface: it answers "is the ladder doing what we think it does" and
     * nothing a player would ever ask.
     */
    async ladderOdds(): Promise<LadderOddsReport> {
        this.useOwnDb();
        if (!this.adminMode) {
            throw new GameError('Admin mode is off. Set ADMIN_MODE=true to read the ladder odds.', 403);
        }
        const world = await this.loadWorld();
        return ladderOddsReport(world?.seed ?? 'no-world', {}, world ?? undefined);
    }

    /**
     * The world the current run is standing in.
     *
     * Rebuilt from the run's seed and caught up to the run's clock by the
     * owning module, so this is cheap on a warm process and correct on a cold
     * one. Null when there is no run yet, or when the world is switched off.
     */
    async loadWorld(): Promise<WorldState | null> {
        this.useOwnDb();
        if (!this.worldEnabled) return null;
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.deathLedger(1)[0] ?? null;
        return run ? worldForRun(run) : null;
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
        ambient: AmbientQi,
        rawInput = ''
    ): Promise<Execution> {
        // A True Immortal is not standing in the province any more.
        //
        // `existence.ts` has modelled this the whole time - `canExistBeyondTheLid`
        // and `evaluateLidTransit`, which prices a descent at nine tribulation
        // strikes - but nothing in this layer consulted it, so a True Immortal
        // could look over a market stall and hire themselves out as a porter for
        // twenty-nine spirit stones. The mortal world is not somewhere they are.
        // Coming down is possible and it is the most expensive thing they can
        // do; it is not the default state of the run.
        if (canExistBeyondTheLid(cultivator) && MORTAL_WORLD_ACTIONS.includes(action.action)) {
            return this.freeAction(run, action.action, factsForRefusal(
                'Not from here.',
                'That is a thing done among people, and there are no people here. What is around ' +
                `${cultivator.name} now is the far side of the Lid, and the province they came ` +
                'from is on the other side of a hole they had to punch to leave through. Reaching ' +
                'back down is possible. It costs nine strikes of the heaviest tribulation there is, ' +
                'and it buys ten or fifteen breaths.',
                `existence.canExistBeyondTheLid = true; '${action.action}' is a mortal-world action ` +
                'and is not offered above the Lid. See evaluateLidTransit(down).'
            ));
        }

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

            case 'attack':
                return this.attack(run, cultivator, action.target, action.intent ?? 'drive_off');

            case 'interact':
                return this.interact(
                    run, cultivator, action.target, action.intent ?? 'talk', action.topic
                );

            case 'train_technique':
                return this.train(cultivator, action.target);

            case 'refine':
                return this.refine(cultivator, action.target);

            case 'gather':
                return this.gather(run, cultivator, ambient, action.target);

            case 'wait': {
                const waiting = await this.shortSkip(run, cultivator, ambient, WAITING_FOCUS, 'Waiting');
                const noticedWaiting = this.notice(cultivator, run, 'wait');
                if (noticedWaiting) {
                    waiting.facts.lines.push(noticedWaiting);
                    waiting.facts.prose = `${waiting.facts.prose}

${noticedWaiting}`;
                }
                const heard = this.hear(cultivator, run, 'wait', null, { intent: 'listening' });
                if (heard) {
                    waiting.hearing = heard;
                    addHearing(waiting.facts, heard);
                    waiting.calls.push({
                        name: 'knowledge.learn',
                        action: 'name_overheard',
                        summary:
                            `"${heard.names[0].name}" was overheard while loitering. Recorded at the ` +
                            'lowest stance, source overheard.',
                        ok: true
                    });
                }
                return waiting;
            }

            case 'eat':
                return this.eat(run, cultivator);

            case 'provision':
                return this.provision(run, cultivator, action.days);

            case 'status': {
                const eligibility = canAttemptBreakthrough(cultivator);
                return this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible
                ));
            }

            case 'work':
                return this.work(cultivator, action.days ?? DEFAULT_WORK_DAYS, action.target);

            case 'market':
                return this.market(cultivator, action.target);

            case 'sect':
                return this.sect(cultivator, action.target, action.intent, action.topic, action.days);

            case 'recall':
                return this.recall(run, cultivator, action.target, action.intent);

            case 'treat':
                return this.treat(run, cultivator, ambient);

            case 'buy':
                return this.buy(run, cultivator, ambient, action.target);

            case 'site':
                return this.site(run, cultivator, ambient, action.target, action.intent);

            case 'assess':
                return this.assess(cultivator, action.target);

            case 'unclear': {
                // The cheapest action available, and the whole reason it is in
                // the closed set: no time, no food, no roll, no death. A player
                // may type something ambiguous a hundred times and lose nothing
                // but a moment.
                const unread = this.freeAction(run, 'unclear', factsForRefusal(
                    'The thought does not resolve.',
                    'You turn the thought over and it does not resolve into anything you could ' +
                    'actually do standing here.'
                ));
                // The sentence itself goes to the inspector, where somebody
                // tuning the parser can read exactly what it failed on.
                unread.calls = [{
                    name: 'engine.parseIntent',
                    action: 'unclear',
                    summary: `Intent not recognised; no action taken. Raw input: "${rawInput.slice(0, 160)}"`,
                    ok: false
                }];
                return unread;
            }

            case 'look': {
                // Why the ground is like this, which is a different read from
                // what is standing on it. Answered out of the location's own
                // change log, and gated: what the place is and when it changed
                // are physical, and the cause is knowledge.
                if (action.intent === 'history') {
                    return this.placeHistory(run, cultivator, action.target);
                }

                const company = this.company(cultivator);
                const standing = this.standingHere(cultivator);
                const looking = this.freeAction(
                    run, 'look',
                    action.intent === 'company'
                        ? factsForCompany(cultivator, company, standing)
                        : factsForLook(cultivator, ambient, company, standing)
                );
                // Two people talking on the far side of a wall, who were having
                // the conversation anyway. Nothing here is staged for the
                // player, which is exactly why it is worth anything.
                const noticed = this.notice(cultivator, run, 'look');
                if (noticed) {
                    looking.facts.lines.push(noticed);
                    looking.facts.prose = `${looking.facts.prose}

${noticed}`;
                }
                const heard = this.hear(cultivator, run, 'look', null);
                if (heard) {
                    looking.hearing = heard;
                    addHearing(looking.facts, heard);
                    looking.calls.push({
                        name: 'knowledge.learn',
                        action: 'name_overheard',
                        summary:
                            `"${heard.names[0].name}" was overheard from people who did not know they ` +
                            'were heard. Recorded at the lowest stance, source overheard: acting on it ' +
                            'would reveal where this cultivator was standing.',
                        ok: true
                    });
                }
                return looking;
            }
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
    private async move(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        const place = resolvePlace(target);
        if (!place) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you ` +
                'that you have not decided where you are going, and there is nothing out there ' +
                'obliging enough to decide it for you.',
                'No destination named; location unchanged and no time passed.'
            ));
        }

        // A destination has to be somewhere.
        //
        // `resolvePlace` accepts any string, because a place in this engine
        // is free text and always has been. That is fine for describing one
        // and catastrophic for travelling to one: "I follow the cultivator"
        // parsed the trailing noun as a destination and the engine dutifully
        // moved the player to a location called `cultivator`, spent the
        // travel days, and then described its ambient qi. A name the world
        // has never heard of is not a place; it is a misparse with a
        // location row behind it.
        //
        // Checked against three registers, any of which is enough: the
        // world's own locations, anywhere a person is standing, and
        // anywhere this cultivator has heard of. The third is what keeps
        // this from being a discovery leak in reverse - the player may go
        // where they have been told about, and the refusal below never says
        // where that is.
        // Only where there is a register to check against. With the world
        // driver off, places in this engine are documented free text and
        // there is nothing that could say a name is wrong; refusing then
        // would make travel impossible rather than safe.
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a ` +
                'place. Nobody sets you right, because nobody is sure what you meant.',
                `Unresolved destination "${place.name}": matches no world location, no ` +
                'occupied place and nothing this cultivator has heard of. Location unchanged, ' +
                'no time passed.'
            ));
        }

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, SHORT_ACTION_DAYS, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: TRAVEL_FOCUS },
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, SHORT_ACTION_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: place.name
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

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
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
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
            return this.freeAction(
                run, 'investigate',
                factsForLook(cultivator, ambient, this.company(cultivator))
            );
        }

        const scope = this.scopeFor(cultivator);
        // Ruins are load-bearing: origin.md closes on them being the one door
        // in this world that opens on nerve rather than standing, and the only
        // route a poor cultivator has. "The ruins" is how a player refers to
        // the one they are standing near, and it is not a proper name, so it
        // resolved to nothing and the most obvious sentence about the most
        // important feature in the game did nothing at all.
        const subject = this.ruinAtHand(query, cultivator)
            ?? resolveAnything(this.repos, query, cultivator, scope);
        if (!subject) {
            // Worded so that it does not confirm existence either. "You have
            // never heard of it" and "it is not there" have to look the same
            // from inside, or the refusal itself becomes the answer key. And it
            // is written as a scene, because an error message reaching the
            // player is a scene that failed to get written.
            return refused('engine.resolveEntity', 'investigate', factsForRefusal(
                'Nothing here answers to it.',
                // Searching a place fails differently from addressing a person.
                // This used to hand back the conversational brush-off, so "I
                // explore the ruins" was answered with somebody looking up from
                // their work - which named a stranger the player had not met and
                // described a social act nobody had attempted.
                `You go over ${placeName(cultivator)} looking for it and it is not the kind of ` +
                'place that has one. Either it is somewhere else, or it is nowhere, and standing ' +
                'here turning it over is not going to settle which.',
                `Unresolved subject "${query}": no knowledge record and nothing co-located. ` +
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
     * Hitting somebody.
     *
     * Routed to `combat_manage.resolve`, which owns power assessment, edges,
     * the exchange, the wounds and the obligations that come out the far side.
     * Nothing about the outcome is decided here, and nothing about it may be:
     * this is the single most consequential thing a player can do in one turn
     * and a second opinion about who wins would be the drift the whole design
     * is built to prevent.
     *
     * The target must resolve to a real person who is actually present. A
     * confrontation with somebody the player cannot see is not a scene, and
     * fuzzy-matching a description into a name would pick the fight for them.
     */
    private async attack(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        goal: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        if (query.length < 2) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named for a confrontation. Nothing was resolved and ' +
                'no exchange was run.'
            ));
        }

        // A gesture at somebody in the square resolves to somebody in the
        // square. A name resolves to that name or to nothing.
        const pointed = this.somebodyAtHand(query, cultivator);
        const party = pointed
            ? { kind: 'cultivator' as const, id: pointed.id, name: pointed.name }
            : resolveCultivator(this.repos, query, cultivator.id, scope, cultivator.realmOrdinal);
        const present = party ? this.present(cultivator).some(row => row.id === party.id) : false;
        if (!party || !present) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nothing to swing at.',
                // Not the conversational brush-off. A fight that does not
                // happen fails differently from a question nobody answers.
                'You look for them and the moment goes past you. There is nobody in front of ' +
                'you that the thought fits, and standing here deciding is its own answer.',
                `Unresolved party "${query}" for a confrontation` +
                `${party ? ', resolved but not co-located' : ''}. No exchange was run.`
            ));
        }

        // `goal` decides which endings the engine will reach for. It is passed
        // straight through; nothing in this layer reads it to pick a winner.
        const intent = goal === 'kill' || goal === 'subdue' || goal === 'humiliate'
            ? goal
            : 'drive_off';

        // Half the people in a square exist only in the world state, not in the
        // cultivators table, and `combat_manage` looks its opponent up by id.
        // Passing an id it cannot find produced "No cultivator with id npc-95."
        // as the answer to a player swinging at somebody standing in front of
        // them. Where there is no row, the opponent is described instead -
        // which is what `OpponentSchema` has the name and ordinal fields for.
        const onRecord = this.repos.cultivators.getById(party.id) !== undefined
            && this.repos.cultivators.getById(party.id) !== null;
        const standing = this.present(cultivator).find(row => row.id === party.id);

        const result = await handleResolve({
            action: 'resolve',
            cultivatorId: cultivator.id,
            opponent: onRecord
                ? { cultivatorId: party.id }
                : {
                    name: party.name,
                    ...(standing ? { realmOrdinal: standing.realmOrdinal } : {})
                },
            goal: intent,
            vector: 'body',
            edges: [],
            opponentEdges: [],
            fightToTheEnd: false
        });

        // Seeing somebody well enough to fight them is seeing them.
        this.noteEncounter(
            cultivator, run, party, 'witnessed',
            `Fought at ${placeName(cultivator)}.`
        );

        return this.fromToolResult('combat_manage.resolve', 'attack', result, party.name);
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
        intent: string,
        topic?: string
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        // A question put to nobody in particular is still put to somebody:
        // asking around a village means asking whoever is at hand. Only
        // when a question was actually asked, though - an approach with no
        // subject and no topic is the player not having said who.
        if (query.length < 2 && topic && topic.length >= 2) {
            const atHand = this.present(cultivator);
            if (atHand.length > 0) {
                return this.askAround(run, cultivator, atHand[atHand.length - 1], topic, scope);
            }
        }

        if (query.length < 2) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named, and nobody is co-located to have meant. ' +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        // Pointed at rather than named: whoever is at hand is who they meant.
        const pointedAt = this.somebodyAtHand(query, cultivator);
        if (pointedAt && topic && topic.length >= 2) {
            return this.askAround(run, cultivator, pointedAt, topic, scope);
        }

        const party = pointedAt
            ? resolveCultivator(this.repos, pointedAt.name, cultivator.id, scope, cultivator.realmOrdinal)
            : resolveParty(this.repos, query, cultivator, scope);
        if (!party && topic && topic.length >= 2) {
            // A description is not a name. "The old woman" resolves to
            // nobody in the roster and should not be fuzzy-matched into
            // one; what it does mean is that there is a person in front of
            // the player, and a person can be asked something.
            const atHand = this.present(cultivator);
            if (atHand.length > 0) {
                return this.askAround(run, cultivator, atHand[atHand.length - 1], topic, scope);
            }
        }
        if (!party) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                'Nobody by that name.',
                this.blankLook(cultivator),
                `Unresolved party "${query}": no knowledge record and nobody co-located. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        this.noteEncounter(
            cultivator, run, party, 'witnessed', `Approached at ${placeName(cultivator)}.`
        );

        // A question was asked of a person, so a person answers it. This
        // used to reach the sect register instead, which replied with a
        // list and a policy note and called the player "this cultivator".
        if (topic && topic.length >= 2 && party.kind === 'cultivator') {
            const who = this.present(cultivator).find(row => row.id === party.id);
            if (who) return this.askAround(run, cultivator, who, topic, scope);
        }

        // They may say something they assume the player already knows. The
        // engine picks it and writes it down; the narrator only gets a licence
        // to have them say it.
        const spoken = party.kind === 'cultivator'
            ? this.hear(cultivator, run, `interact:${party.id}`, party.id)
            : null;

        // The player gets the honest in-fiction shape of it - an approach made,
        // nothing settled. Why it is not settled is a fact about this codebase,
        // not about the world, and it belongs on the mechanical channel.
        const unresolved =
            'Nothing is settled by it. Nobody agreed to anything, nothing changed hands, and ' +
            'no standing shifted one way or the other.';

        const facts = factsForInteraction(cultivator, party.name, intent, party.facts, unresolved);
        if (spoken) addHearing(facts, spoken);

        const execution = this.freeAction(run, 'interact', facts);
        execution.hearing = spoken;
        execution.outcome = 'refused';
        execution.calls = [
            {
                name: 'engine.resolveParty',
                action: 'interact',
                summary: `Resolved "${query}" to ${party.kind} ${party.id}. ${party.facts[0]}`,
                ok: true
            },
            ...structureCalls(party.structure),
            ...(spoken ? [{
                name: 'knowledge.learn',
                action: 'name_spoken',
                summary:
                    `${spoken.speaker ?? 'Somebody'} said "${spoken.names[0].name}" in passing. ` +
                    'Recorded at the lowest stance, source told. The player has the word and nothing else.',
                ok: true
            }] : []),
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
     * Taking work, through the tool layer that owns the mortal economy.
     *
     * Half the deaths in this world are logistical, and this is the verb that
     * answers that: it is how a cultivator with an empty purse buys the food
     * that stops the starvation clock. It advances the run's own time, which is
     * why `handleWork` owns the whole thing rather than this layer approximating
     * it - the days, the wage, the rations bought and the qi not gathered while
     * bent over somebody else's field are one calculation.
     */
    private async work(
        cultivator: Cultivator,
        days: number,
        target: string | undefined
    ): Promise<Execution> {
        // A named trade has to become a catalog id, or the tool reads it as
        // "no occupation named" and lists the board instead of doing the work.
        // Matched against what is going HERE, at this realm: naming a trade the
        // village does not offer should reach the tool's own refusal, which
        // knows why, rather than being silently dropped here.
        const wanted = (target ?? '').trim();
        const occupation = wanted.length >= 3
            ? findWorkForOrdinal(cultivator.realmOrdinal)
                .find(o => wanted.toLowerCase().includes(o.name.toLowerCase())
                    || o.name.toLowerCase().includes(wanted.toLowerCase()))
            : undefined;

        // Eat before the shift. `handleWork`'s own `rations` argument means BUY
        // that many, so the pack cannot be handed to it - but a player who
        // stocked up and then took work should not go to it hungry, and before
        // this they finished the season at zero and died on the next action.
        cultivator = this.feedFromPack(cultivator);

        const result = await handleWork(
            {
                action: 'work',
                cultivatorId: cultivator.id,
                days,
                ...(occupation ? { occupationId: occupation.id } : {})
            },
            // The same span `cultivate` runs, injected the same way the tool
            // layer injects it: there is one time skip in the cultivation
            // surface and `handleCultivate` owns it. Wiring a second one here
            // would be a second answer to how a day costs a cultivator.
            async args => await handleCultivate(args as never) as Record<string, unknown>
        );
        return this.fromToolResult('cultivation_mortal.work', 'work', result, 'The work');
    }


    /**
     * Somebody was asked something, and answers.
     *
     * The engine's part is small and strictly bounded: work out what this
     * person could know, what they are placed to say, and what saying it would
     * cost - three separate limits, all read off rows - and then hand the
     * narrator observable behaviour. `asked.ts` holds that reasoning; this
     * method is the wiring, plus the one consequential bit: when something is
     * actually said, the knowledge record is written HERE, before the prose
     * exists. A name the player was told is a name they have, whether or not
     * the sentence describing it ever gets written.
     */
    private askAround(
        run: Run,
        cultivator: Cultivator,
        asked: RosterEntry,
        topic: string,
        scope: KnowledgeScope
    ): Execution {
        // What the question was about, resolved against the same catalogs
        // everything else uses. Unresolvable is a real outcome, not an error:
        // people are asked about things that do not exist all the time.
        const subject = resolveAnything(this.repos, topic, cultivator, scope);

        // Whether the player can put a name to the person they are talking
        // to, decided BEFORE the answer, so a stranger stays a stranger
        // through the part where they decline to help.
        const knownAlready = this.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);

        const answer = askedAbout({
            asker: cultivator,
            asked,
            speakerName: knownAlready ? asked.name : null,
            subject,
            rawTopic: topic,
            holdsIt: subject !== null
                && (subject.kind === 'cultivator' || subject.kind === 'sect' || subject.kind === 'place')
                && this.knowledge.isAwareOf(asked.id, subject.kind, subject.id),
            priorDealings: this.dealingsWith(cultivator, asked.id)
        });

        // Written before narration, deliberately. The alternative is a name
        // that exists only inside a paragraph, which is the failure mode the
        // whole knowledge layer is here to prevent.
        // Somebody who answers you has told you who they are. Somebody who
        // hears you out and goes back to work has not, and that asymmetry is
        // the cheapest introduction in the game: it costs a question.
        const met = answer.introduces && !knownAlready
            ? this.noteEncounter(
                cultivator, run,
                { kind: 'cultivator', id: asked.id, name: asked.name },
                'told',
                `Answered a question at ${placeName(cultivator)}, and gave a name doing it.`)
            : false;

        const learned = answer.teaches && subject
            ? this.noteEncounter(
                cultivator, run, subject, 'told',
                `${asked.name} said it at ${placeName(cultivator)}.`)
            : false;

        // The last mile. `asked.ts` decides how far the answer got; what falls
        // out of it is a name said flatly, which discovery.md calls the primary
        // way names enter a player's world. Written before the prose exists.
        const dropped = this.hear(
            cultivator, run, `ask:${asked.id}:${topic}`, asked.id,
            { intent: 'asked', reach: answer.reach });

        const facts = factsForToolResult(
            `${knownAlready || met ? asked.name : 'Somebody'}, asked about ${subject?.name ?? topic}.`,
            answer.lines
        );
        facts.structure.push(...answer.structure);
        if (dropped) addHearing(facts, dropped);

        const execution = this.freeAction(run, 'interact', facts);
        execution.hearing = dropped;
        execution.calls = [
            {
                name: 'engine.askedAbout',
                action: 'talk',
                summary:
                    `Asked ${asked.name} about "${topic}"` +
                    `${subject ? ` (resolved to ${subject.kind} ${subject.id})` : ' (unresolved)'}. ` +
                    `Reach: ${answer.reach}.`,
                ok: answer.reach === 'answers' || answer.reach === 'partial'
            }
        ];
        if (met) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_given',
                summary:
                    `${asked.name} recorded as believed, source told: they answered, and answering ` +
                    'is how a stranger stops being one. A shrug would not have written this row.',
                ok: true
            });
        }
        if (dropped) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_dropped',
                summary:
                    `"${dropped.names[0].name}" fell out of the answer and was recorded at the ` +
                    `lowest stance, source ${dropped.sourceKind}. The player has the word and ` +
                    'nothing else.',
                ok: true
            });
        }
        if (learned && subject) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_told',
                summary:
                    `${subject.name} recorded as believed, source told, from ${asked.name}. ` +
                    'The player earned this one by asking somebody who would say it.',
                ok: true
            });
        }
        return execution;
    }

    /**
     * How many times this cultivator has dealt with somebody before.
     *
     * Counted off the knowledge table rather than a relationship stat, because
     * there is no relationship stat and inventing one here would put a number
     * on something the design is explicit should stay a judgement. Turning up
     * twice leaves two rows; that is the whole of it.
     */
    private dealingsWith(cultivator: Cultivator, otherId: string): number {
        return this.knowledge
            .awareness(cultivator.id, 'cultivator')
            .filter(row => row.id === otherId)
            .length;
    }

    /**
     * Sects: which ones would take them, and joining one.
     *
     * Two halves, decided by whether a sect was actually named. Listing is a
     * read and costs nothing; joining is one of the most consequential things
     * a low cultivator can do, and both belong to `sect_manage` rather than to
     * anything reimplemented here.
     *
     * The listing is discovery-gated on the way out. `sect_manage.list` returns
     * every sect in the campaign, which is the correct answer for a tool whose
     * caller is an operator and exactly the wrong one for a villager: a
     * starting cultivator has heard of one, and handing them the register would
     * spend a hundred turns of revelation on a single query.
     */
    private async sect(
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined,
        topic?: string,
        days?: number
    ): Promise<Execution> {
        // The four member verbs. `sect_manage` has had all of them the whole
        // time and none of them was reachable: "I ask for a promotion", "I draw
        // my stipend", "where do I stand in the sect" and "I leave the sect" all
        // parsed to `unclear`, so a player could join a house and then do
        // nothing whatever about it for the rest of the run.
        switch (intent) {
            case 'siphon': {
                // The pace rides in on the plan's topic and the span on its
                // days, both optional: naming neither is a request to see the
                // position without taking anything, which is what a player
                // should be able to do before committing to a crime that runs
                // on a clock.
                const pace = topic === 'careful' || topic === 'steady' || topic === 'greedy'
                    ? topic
                    : undefined;
                return this.fromToolResult(
                    'sect_manage.siphon', 'sect',
                    await handleSiphon({
                        action: 'siphon',
                        cultivatorId: cultivator.id,
                        ...(pace ? { pace } : {}),
                        months: Math.max(1, Math.min(240, Math.round((days ?? 30) / 30)))
                    }),
                    'The reserves'
                );
            }
            case 'order': {
                // The errand rides in on the plan's topic and how long they are
                // out on its days. Both are the ORDERED rung's, not the
                // caller's: `handleOrder` advances the turn and nothing else,
                // which is the whole difference between having a rank and
                // doing the work yourself.
                const errand = topic === 'gather' || topic === 'carry' || topic === 'labour'
                    ? topic
                    : DEFAULT_ERRAND;
                return this.fromToolResult(
                    'sect_manage.order', 'sect',
                    await handleOrder({
                        action: 'order',
                        cultivatorId: cultivator.id,
                        errand,
                        days: Math.max(1, Math.min(365, Math.round(days ?? 7)))
                    }),
                    'The order'
                );
            }
            // ── the four powers a rank buys above `order` ──
            //
            // Each takes an argument out of free text, and each has a LISTING
            // mode reached by omitting it. That is not a fallback: a player who
            // has not been told which elders there are, or what the bar costs
            // to move, cannot sensibly name one, and being shown the price is
            // the sentence before the one that spends it. So an argument that
            // does not resolve prices the act rather than guessing at it.
            case 'recruit': {
                const kind = topic === 'elder' ? 'elder' : 'disciple';
                // "three disciples" is three people. Read off the same phrase
                // the parser handed over, bounded by the tool's own schema.
                const count = Math.max(1, Math.min(50, parseCount(target ?? '') ?? 1));
                return this.fromToolResult(
                    'sect_manage.recruit', 'sect',
                    await handleRecruit({
                        action: 'recruit', cultivatorId: cultivator.id, kind, count
                    }),
                    kind === 'elder' ? 'The seating' : 'The intake'
                );
            }
            case 'admission': {
                // A rank the sentence actually names, or nothing. There is no
                // reading of "raise the bar" that tells the engine HOW FAR, and
                // inventing one here would be a balance decision made in the
                // narration tier. With no ordinal the tool prices the move and
                // changes nothing, which is the honest answer to a sentence
                // that did not say where to put it.
                const ordinal = this.ordinalNamed(target);
                return this.fromToolResult(
                    'sect_manage.admission', 'sect',
                    await handleAdmission({
                        action: 'admission',
                        cultivatorId: cultivator.id,
                        ...(ordinal !== null ? { ordinal } : {})
                    }),
                    'The standard'
                );
            }
            case 'curriculum': {
                const art = this.artNamed(target, cultivator);
                const retiring = topic === 'retire';
                return this.fromToolResult(
                    'sect_manage.curriculum', 'sect',
                    await handleCurriculum({
                        action: 'curriculum',
                        cultivatorId: cultivator.id,
                        ...(art && retiring ? { retire: [art] } : {}),
                        ...(art && !retiring ? { teach: [art] } : {})
                    }),
                    'The library'
                );
            }
            case 'expel': {
                // Two calls, and the first one is free. `expel` with no elderId
                // reads the house and prices every elder in it without
                // dismissing anybody, which is both how the argument gets
                // resolved and the right thing to show a player who named
                // nobody the house recognises.
                const roll = await handleExpel({ action: 'expel', cultivatorId: cultivator.id });
                const elderId = isGuidingErrorBody(roll) ? null : elderNamed(roll, target);
                if (elderId === null) {
                    return this.fromToolResult('sect_manage.expel', 'sect', roll, 'The elders');
                }
                return this.fromToolResult(
                    'sect_manage.expel', 'sect',
                    await handleExpel({ action: 'expel', cultivatorId: cultivator.id, elderId }),
                    'The dismissal'
                );
            }
            case 'promote':
                return this.fromToolResult(
                    'sect_manage.promote', 'sect',
                    await handlePromote({ action: 'promote', cultivatorId: cultivator.id }),
                    'The promotion'
                );
            case 'stipend':
                return this.fromToolResult(
                    'sect_manage.stipend', 'sect',
                    await handleStipend({ action: 'stipend', cultivatorId: cultivator.id }),
                    'The stipend'
                );
            case 'standing':
                return this.fromToolResult(
                    'sect_manage.standing', 'sect',
                    await handleStanding({ action: 'standing', cultivatorId: cultivator.id }),
                    'The standing'
                );
            case 'leave':
                return this.fromToolResult(
                    'sect_manage.leave', 'sect',
                    await handleLeave({ action: 'leave', cultivatorId: cultivator.id }),
                    'The departure'
                );
            default:
                break;
        }

        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        const named = query.length >= 3 ? resolveSect(this.repos, query, scope, cultivator.sectId) : null;

        if (named) {
            const result = await handleJoin({
                action: 'join',
                sectId: named.id,
                cultivatorId: cultivator.id
            });
            return this.fromToolResult('sect_manage.join', 'sect', result, named.name);
        }

        const listing = await handleList({
            action: 'list',
            cultivatorId: cultivator.id,
            admissibleOnly: true
        });
        if (isGuidingErrorBody(listing)) {
            return this.fromToolResult('sect_manage.list', 'sect', listing, 'The sects');
        }

        const all = (listing as { sects?: Array<{ id: string; name: string; admissible?: boolean | null }> }).sects ?? [];
        const heard = all.filter(s => this.knowledge.isAwareOf(cultivator.id, 'sect', s.id));

        const facts = heard.length === 0
            ? factsForRefusal(
                'No door you know of.',
                'You do not know the name of a single order that takes people on. Somebody would ' +
                'have to say one in front of you first, and nobody has.',
                `sect_manage.list returned ${all.length} admissible sect(s); none are known to this cultivator.`)
            : factsForToolResult(
                `${heard.length} order${heard.length === 1 ? '' : 's'} you could put yourself in front of.`,
                [
                    // This used to be a register with a policy note attached,
                    // addressed to an operator and calling the player "this
                    // cultivator" in the third person. Nobody in the world
                    // speaks like that, and nothing in the world is a list.
                    heard.length === 1
                        ? `There is one name you have for this: ${heard[0].name}.`
                        : `The names you have for this are ${heard.slice(0, -1).map(x => x.name).join(', ')} ` +
                          `and ${heard[heard.length - 1].name}.`,
                    ...heard
                        .filter(x => x.admissible === false)
                        .map(x => `${x.name} would not take you as you stand.`),
                    'Knowing a name is not an introduction. Somebody would have to put you in front of them, ' +
                    'or you would have to walk up on your own.'
                ]);

        facts.structure.push(
            `sect_manage.list: ${all.length} admissible, ${heard.length} known to this cultivator.`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: heard.length === 0 ? 'refused' : 'executed',
            calls: [{
                name: 'sect_manage.list',
                action: 'sect',
                summary: `${all.length} admissible sect(s); ${heard.length} within this cultivator's knowledge.`,
                ok: heard.length > 0
            }]
        };
    }

    // ── what this cultivator is carrying ─────────────────────────────────
    //
    // Found by a rank-band sweep, and the dead sentences were at the CEILING:
    // "what do I know of Lu Sheng", "what do I know of the Hollow Court" and
    // "what is my dao" all parsed to nothing at ordinals 37-46, where the
    // ladder is finished and comprehension is the only thing still moving.
    //
    // The gate this must not weaken is the one the whole knowledge layer
    // rests on, so the defence is structural rather than careful: the query is
    // matched against THE HOLDER'S OWN ROWS and the catalogs are never
    // searched. There is no code path from a name the player typed to a name
    // they have not been told, which means no phrasing of this can teach
    // anybody anything - and it also means an unheard name and an invented one
    // come back identical, which is required. The shape of the answer must not
    // be the answer.

    /**
     * What this cultivator holds about a name, or about everything.
     *
     * `intent` selects which of the two tables is read - what they have HEARD,
     * or what they have UNDERSTOOD - on the same terms as `sect`, `look` and
     * `site`. Both are free, so unlike `site` there is no expensive default to
     * steer away from; an unrecognised label falls through to the wider read.
     */
    private recall(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Execution {
        const which: RecallIntent = RECALL_INTENTS.includes(intent as RecallIntent)
            ? intent as RecallIntent
            : DEFAULT_RECALL_INTENT;

        if (which === 'dao') return this.recallDao(run, cultivator);

        const held = this.knowledge.awareness(cultivator.id);
        const query = (target ?? '').trim();

        if (query.length < 2) {
            const facts = factsForHolding(
                cultivator,
                held.map(row => ({ kind: row.kind, name: row.name }))
            );
            const listing = this.freeAction(run, 'recall', facts);
            listing.outcome = held.length === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'knowledge.awareness',
                action: 'recall',
                summary:
                    `${held.length} knowledge record(s) held by this cultivator. Read only, and read `
                    + 'from their own rows: no catalog was consulted, so nothing here could be new.',
                ok: held.length > 0
            }];
            return listing;
        }

        // The gate, in one line. Scored against what they hold, never against
        // what exists. Every row that matches comes back - a cultivator
        // carrying four incompatible stories is carrying four, and collapsing
        // them into one would hand over the resolution that is the prize.
        const matches = held.filter(row => matchScore(query, row.name) >= MATCH_THRESHOLD);
        const scope = this.scopeFor(cultivator);

        const facts = factsForRecall(cultivator, query, matches.map(row => ({
            name: row.name,
            statement: row.statement,
            stance: row.stance,
            sourceKind: row.sourceKind,
            sourceNote: row.sourceNote,
            acquiredOnDay: row.acquiredOnDay,
            earned: this.earnedAbout(cultivator, scope, row)
        })));

        const execution = this.freeAction(run, 'recall', facts);
        execution.outcome = matches.length === 0 ? 'refused' : 'executed';
        execution.calls = [{
            name: 'knowledge.awareness',
            action: 'recall',
            summary:
                `"${query}" scored against ${held.length} held record(s); ${matches.length} matched at or `
                + `above ${MATCH_THRESHOLD}. The catalogs were not searched, which is what makes this `
                + 'read incapable of teaching anybody anything.',
            ok: matches.length > 0
        }];
        return execution;
    }

    /**
     * Anything further they have actually earned about it.
     *
     * Only for a record held at `knows` - having overheard a word in a market
     * buys the word and nothing else - and only through the same scoped
     * resolvers `investigate` uses, which are already awareness-gated. So this
     * discloses nothing a second sentence could not already have got, and a
     * record at any lower stance discloses nothing at all.
     */
    private earnedAbout(
        cultivator: Cultivator,
        scope: KnowledgeScope,
        row: AwarenessRow
    ): string[] {
        if (row.stance !== 'knows') return [];
        if (row.kind === 'sect') {
            return resolveSect(this.repos, row.name, scope, cultivator.sectId)?.facts ?? [];
        }
        if (row.kind === 'cultivator') {
            return resolveCultivator(
                this.repos, row.name, cultivator.id, scope, cultivator.realmOrdinal
            )?.facts ?? [];
        }
        // Places are free text in this engine and events have no resolver.
        // Nothing to add, and inventing something would be the leak.
        return [];
    }

    /**
     * What this cultivator has understood, which is the other axis entirely.
     *
     * Composed from `daoOf` and from the SAME `daoView` the sheet's panel is
     * built from, so the sentence and the panel cannot drift. That matters
     * more here than anywhere: at the last two rungs the ladder is shut and
     * this is the only thing still moving, so a player reading two different
     * accounts of it is reading two different accounts of their whole
     * remaining life.
     */
    private recallDao(run: Run, cultivator: Cultivator): Execution {
        const insights = cultivator.insights ?? [];
        const dao = daoOf(insights);
        const panel = daoView(cultivator);

        const facts = factsForDao(cultivator, {
            standing: dao.standing,
            name: dao.name,
            subject: dao.subject,
            depth: dao.depth,
            breadth: dao.breadth
        }, panel);

        const execution = this.freeAction(run, 'recall', facts);
        execution.calls = [{
            name: 'engine.daoOf',
            action: 'recall',
            summary:
                `standing=${dao.standing}, subject=${dao.subject ?? 'none'}, depth=${dao.depth}, `
                + `insights=${panel.insights.length}, totalDegrees=${panel.totalDegrees}. `
                + 'Read only: understanding is formed by exposure, never by asking about it.',
            ok: true
        }];
        return execution;
    }

    // ── inheritance grounds ──────────────────────────────────────────────
    //
    // `data/cultivation/inheritance-trials.ts` is roughly nineteen hundred
    // lines of finished, tested content - twenty-odd sites, three unrelated
    // kinds of gate, an interior the type system keeps out of the pre-entry
    // view - and until these methods existed nothing a typed English sentence
    // could do reached one line of it. The systems playtest reported it in its
    // own friction block as the largest unplayable system in the game.
    //
    // Four steps, and the split between the first two and the last two is the
    // one guarantee this whole surface exists to keep: a cultivator who has
    // not gone in cannot learn what is inside, THROUGH ANY PHRASING. That is
    // enforced three times over - `outsideViewOf` returns a type with no
    // `interior` key, `SiteFace` in `facts.ts` has no field that could hold
    // one, and the single call to `enterSite` in this package sits below a
    // recorded entry in a method that has already spent the days.

    /** Sites this cultivator could put a name to. The gate under everything. */
    private nameableFor(cultivator: Cultivator): Site[] {
        return nameableSites(siteId => this.knowledge.isAwareOf(cultivator.id, 'place', siteId));
    }

    /**
     * The world state a fate gate is allowed to turn on.
     *
     * Counted off the obligations ledger, which is real rows written by things
     * that happened. `generation > 0` is business inherited rather than
     * incurred, which is exactly what "carrying an obligation you did not take
     * on" means, and it is not a number that rises because somebody repeated an
     * activity - which is the test `FATE_IS_NOT_A_STAT` sets.
     */
    private fateEvidence(cultivator: Cultivator): FateEvidence {
        const row = this.db
            .prepare(
                "SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND status = 'open' AND generation > 0"
            )
            .get(cultivator.id) as { n: number } | undefined;
        return { obligationsNotTakenOn: row?.n ?? 0 };
    }

    /**
     * Which site a sentence meant.
     *
     * A name resolves against the ones this cultivator may name and nothing
     * else, so a player cannot type their way into a grave they have never
     * heard of. A generic phrase - "the door", "the grave", "what is behind the
     * plate" - names nothing and falls through to the site they went to most
     * recently, which is a row rather than a guess, exactly the way "what
     * happened here" falls through to the ground underfoot.
     */
    private siteMeant(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): { site: Site | null; namedSomethingUnknown: boolean } {
        const permitted = this.nameableFor(cultivator);
        const query = (target ?? '').trim();

        if (query.length >= 3 && !GENERIC_SITE_PHRASE.test(query)) {
            const named = resolveSite(query, permitted);
            // A specific name that resolved to nothing does NOT fall through to
            // the site at hand. Naming a grave the player has only heard
            // rumoured must not quietly open the one they were standing at an
            // hour ago - that is the same class of mistake as fuzzy-matching an
            // elder and dismissing the wrong person.
            return { site: named, namedSomethingUnknown: named === null };
        }

        const record = this.sites.atHand(run.id);
        const site = record ? permitted.find(entry => entry.id === record.catalogId) ?? null : null;
        return { site, namedSomethingUnknown: false };
    }

    /** The pre-entry face, at whatever awareness this cultivator holds. */
    private faceFor(site: Site, cultivator: Cultivator): SiteFace | null {
        const awareness = awarenessOfSite(site, this.knowledge.isAwareOf(cultivator.id, 'place', site.id));
        const view = faceOf(site, awareness);
        if (!view) return null;
        return {
            name: view.name,
            kind: view.kind,
            marker: view.outside.marker,
            rumour: view.outside.rumour,
            attributedTo: view.outside.attributedTo,
            lastPartySaid: view.outside.lastPartySaid,
            whatAKnowledgeablePartyReads: view.outside.whatAKnowledgeablePartyReads,
            whatAnIgnorantPartyConcludes: view.outside.whatAnIgnorantPartyConcludes,
            advertisedOrdinal: view.outside.advertisedOrdinal,
            grave: view.kind === 'grave'
                ? {
                    mannerOfDeath: view.mannerOfDeath,
                    burial: view.burial,
                    occupantOrdinal: view.occupantOrdinal,
                    yearsDead: view.yearsDead
                }
                : null
        };
    }

    /** The refusal every step gives when no site resolved. Costs nothing. */
    private noSiteAtHand(action: ActionName, query: string | undefined): Execution {
        return refused('engine.resolveSite', action, factsForRefusal(
            'Nothing here to go into.',
            'You turn to the thing you meant and there is no thing you meant. Ground worth opening '
            + 'is ground somebody told you about, and you are not standing at any of it.',
            `Unresolved site "${(query ?? '').trim() || '(none named)'}": no nameable site matched and `
            + 'no site has been approached in this run.'
        ));
    }

    /**
     * The trials and the graves: reaching one, reading it, going in, taking it.
     *
     * `intent` selects WHICH of the four runs and nothing else, on the same
     * terms as `sect` and `look`: the label is matched against a closed set of
     * literals, an unrecognised one falls through to the default, and every
     * outcome on the far side is computed from the catalog and from this
     * cultivator's own rows. What is different here is that one of the four
     * spends days and can kill, so the default is deliberately the CHEAPEST of
     * them. A model that answers `{"action":"site","intent":"go in and get it"}`
     * gets the listing.
     */
    private async site(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string | undefined
    ): Promise<Execution> {
        const step: SiteIntent = SITE_INTENTS.includes(intent as SiteIntent)
            ? intent as SiteIntent
            : DEFAULT_SITE_INTENT;

        const meant = this.siteMeant(run, cultivator, target);
        const site = meant.site;

        // A named site that resolved to nothing is refused on every step that
        // does something, and answered with the listing on the step that is a
        // question. "I go to the eighth stone" from somebody who has only ever
        // heard it rumoured is a real sentence with an honest answer, and the
        // honest answer is what they DO have names for.
        if (!site && meant.namedSomethingUnknown && step !== 'approach') {
            return this.noSiteAtHand('site', target);
        }

        if (step === 'approach' && !site) {
            // Naming none is a question rather than a failure: it asks what
            // there is, and the honest answer is what has reached this person.
            const known = this.nameableFor(cultivator);
            const facts = factsForSiteListing(
                cultivator,
                known.map(entry => ({ name: entry.name, kind: entry.kind }))
            );
            const listing = this.freeAction(run, 'site', facts);
            listing.outcome = known.length === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'engine.nameableSites',
                action: 'site',
                summary:
                    `${known.length} of ${SITES.length} catalogued site(s) are nameable by this `
                    + 'cultivator. Filtered by awareness; the catalog holds no locations, so nothing '
                    + 'here was filtered by distance.',
                ok: known.length > 0
            }];
            return listing;
        }

        if (!site) return this.noSiteAtHand('site', target);

        const face = this.faceFor(site, cultivator);
        if (!face) return this.noSiteAtHand('site', target);

        switch (step) {
            case 'approach':
            case 'outside':
                return this.readSiteFromOutside(run, cultivator, site, face, step === 'approach');
            case 'enter':
                return this.enterTheSite(run, cultivator, ambient, site);
            case 'take':
                return this.takeFromSite(run, cultivator, site);
        }
    }

    /**
     * Reaching one, and reading it without going in.
     *
     * Both steps return the same disclosure because the gate between outside
     * and inside is a door rather than a distance, and both are reads: no time
     * passes, nothing is spent, and being refused costs what being answered
     * costs. What the approach additionally does is write down that this
     * cultivator has been here, which is what makes "I go inside" a sentence
     * that resolves to something afterwards.
     */
    private readSiteFromOutside(
        run: Run,
        cultivator: Cultivator,
        site: Site,
        face: SiteFace,
        arriving: boolean
    ): Execution {
        this.sites.write(run.id, site, run.elapsedDays, { soughtOnDay: Math.floor(run.elapsedDays) });

        // Standing at a thing is knowing it is there. Written by the engine,
        // in phase 2, so the narrator is never the reason a name is available.
        const learned = face.name !== null && this.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: site.id,
            name: site.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: 'witnessed',
            sourceNote: 'Stood at it.',
            stance: 'knows',
            confidence: 1
        });

        const facts = factsForSiteFace(cultivator, face, arriving);
        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            {
                name: 'engine.outsideViewOf',
                action: arriving ? 'approach' : 'assess_from_outside',
                summary:
                    `${site.id}: pre-entry view returned at awareness `
                    + `${awarenessOfSite(site, true) === 'named' ? 'named' : site.outside.startingAwareness}. `
                    + 'The returned type has no interior key, so the inside could not have been read '
                    + 'here even by mistake. Read only: no time passed, nothing changed.',
                ok: true
            },
            ...(learned ? [{
                name: 'knowledge.learn',
                action: 'place_witnessed',
                summary: `"${site.name}" recorded as witnessed: this cultivator has now stood at it.`,
                ok: true
            }] : [])
        ];
        return execution;
    }

    /**
     * Going in.
     *
     * Three things happen, in this order, and the order is the design.
     *
     * FIRST the days are spent, through `simulateTimeSkip` and `applyTimeSkip`
     * like every other stretch of time in this package. That is what makes
     * entering cost something even at a site that turns out to be empty, and it
     * is why a cultivator on their last ration can die of the walk in - through
     * the survival layer, on the same code path as starving anywhere else.
     * Nothing about that death is asserted here.
     *
     * SECOND the gates are read, in the order the catalog puts them in, and the
     * first one that does not open stops it. Which kind refused decides what
     * the player is told, because the three are not three settings of one dial:
     * strength names a shortfall, talent names what was wanted and says power
     * does not substitute, and fate names nothing at all.
     *
     * THIRD, and only for a strength gate, the thing does what it was built to
     * do. A strength gate is the one kind that states an ordinal of force, so
     * it is the one kind that puts force into a body, and it is resolved by
     * `resolveExchange` - the engine's own combat model, priced at the gate's
     * ordinal - rather than by a damage formula invented in this layer. Death
     * from it goes through `evaluateDeathConditions` and `markDead`, which is
     * the same pair `technique_manage.learn` uses when a deviation kills
     * somebody. A talent gate is indifferent to how hard the claimant can be
     * hit and a fate gate is not about the claimant at all, so neither of them
     * is turned into damage: the bench's own `howItKills` opens "It does not,
     * and that is the trap", and the engine agrees with it.
     */
    private async enterTheSite(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, ENTERING_DAYS, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: ENTERING_FOCUS },
            rations: this.drawFromPack(cultivator, ENTERING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const spentLine =
            `${humanDays(skip.simulatedDays)} went on getting in and being in there, and they came `
            + 'off the same clock everything else comes off.';

        const baseCalls: ToolCallRecord[] = [
            ...skipCalls('site', skip, null),
            ...tollCalls(applied.tollLines),
            ...worldCalls(world)
        ];

        // Killed by the trip rather than by the door. The survival layer has
        // already written it; this only reports what it found.
        if (!applied.cultivator.alive) {
            const facts = factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, 'Going in');
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: baseCalls
            };
        }

        const claimant = claimantOf(applied.cultivator, {
            // Years actually spent at it. `STARTING_AGE` is the age this
            // deployment starts a cultivator at, so the difference is the time
            // the run has put in - which is the thing a talent gate asks about
            // and the thing that cannot be borrowed on the day.
            yearsCultivated: applied.cultivator.age - STARTING_AGE,
            fate: this.fateEvidence(applied.cultivator)
        });
        const reading = readGates(site, claimant);
        const gateCalls: ToolCallRecord[] = reading.verdicts.map(verdict => ({
            name: 'engine.evaluateGate',
            action: `gate_${verdict.kind}`,
            summary: verdict.structure,
            ok: verdict.met
        }));

        if (reading.blockedBy) {
            const blocked = reading.blockedBy;
            const hurt = await this.gateForce(run, applied.cultivator, ambient, site, blocked);
            const facts = factsForGateRefused(
                applied.cultivator,
                site.name,
                { kind: blocked.kind, account: blocked.account, shortfall: blocked.shortfall },
                spentLine
            );
            facts.lines.push(...hurt.lines);
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            if (hurt.lines.length > 0) facts.prose = `${facts.prose}\n\n${hurt.lines.join('\n\n')}`;

            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                // The days were spent and, at a strength gate, a body was hurt.
                // Marking this refused would say nothing happened, and something
                // did. The gate's own call carries the ok: false.
                outcome: 'executed',
                calls: [...baseCalls, ...gateCalls, ...hurt.calls]
            };
        }

        // Every gate opened. This is the one place in the package that calls
        // `enterSite`, and it is below a recorded entry by construction.
        const record = this.sites.write(run.id, site, run.elapsedDays, {
            soughtOnDay: this.sites.get(run.id, site.id)?.soughtOnDay ?? startDay,
            enteredOnDay: startDay
        });
        // A trial and a grave hold different records on purpose - one was
        // calibrated for a claimant who was expected to arrive, the other was
        // arranged for nobody - so the three lines are taken from whichever
        // shape this entry actually has rather than flattened into one.
        const whole = enterSite(site.id)!;
        const interior = whole.kind === 'trial'
            ? {
                scene: whole.interior.chamber,
                arrangement: whole.interior.setBy,
                whatItDoesToPeople: whole.interior.howItKills
            }
            : {
                scene: whole.interior.scene,
                arrangement: whole.interior.arrangedForAFinder
                    ? 'Somebody arranged this for whoever found it. That is the exception rather than the rule.'
                    : 'Nobody arranged this for anybody. Nothing in it was the right size for whoever turned up.',
                whatItDoesToPeople: whole.interior.whatTheDeathDidToTheContents
            };
        const facts = factsForSiteInterior(applied.cultivator, site.name, {
            ...interior,
            onOffer: [...prizeOther(whole), ...this.prizeNames(whole)],
            afterwards: record.takenOnDay !== null ? whole.interior.afterwards : null
        });
        facts.lines.unshift(spentLine);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...baseCalls,
                ...gateCalls,
                {
                    name: 'engine.enterSite',
                    action: 'site',
                    summary:
                        `${site.id}: every gate opened, entry recorded on day ${startDay}. The interior `
                        + 'was read only after the row existed.',
                    ok: true
                }
            ]
        };
    }

    /**
     * What a strength gate does to somebody who is under it.
     *
     * Priced by `assessPower` and resolved by `resolveExchange`, which are the
     * engine's own, so a gate hits exactly as hard as a person at that ordinal
     * would and no harder. Nothing about the arithmetic lives here; what lives
     * here is the decision that a strength gate is the only kind that applies
     * force at all, which is the catalog's own distinction and not a new one.
     */
    private async gateForce(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        blocked: GateVerdict
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const ordinal = forceOrdinalOf(site, blocked);
        if (ordinal === null) return { lines: [], calls: [] };

        const rng = forStream(run.seed, 'site_gate', Math.floor(run.elapsedDays), site.id);
        const context = { ambient };
        const gate = assessPower(forceAt(site, ordinal), context);
        const body = assessPower(
            {
                id: cultivator.id,
                name: cultivator.name,
                realmOrdinal: cultivator.realmOrdinal,
                immortalStatus: cultivator.immortalStatus,
                traditionId: cultivator.traditionId,
                spiritRoot: cultivator.spiritRoot,
                attributes: cultivator.attributes,
                injuries: cultivator.injuries,
                insights: cultivator.insights,
                foundationQuality: cultivator.foundationQuality,
                soulState: cultivator.soulState,
                hp: cultivator.hp,
                maxHp: cultivator.maxHp,
                qi: cultivator.qi,
                maxQi: cultivator.maxQi,
                battlesSurvived: cultivator.battlesSurvived
            },
            context
        );
        const exchange = resolveExchange(gate, body, cultivator.maxHp, {
            rng,
            ambient,
            turn: run.turn,
            vector: 'body'
        });

        let death: { cause: string; description: string } | null = null;
        const persist = this.db.transaction(() => {
            if (exchange.injury) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: exchange.injury.id,
                    severity: exchange.injury.severity,
                    source: exchange.injury.source,
                    description: exchange.injury.description,
                    sustainedOnTurn: exchange.injury.sustainedOnTurn
                });
            }
            this.repos.cultivators.applyDeltas(cultivator.id, { hp: -exchange.damage });

            const after = this.repos.cultivators.getById(cultivator.id)!;
            const cause = evaluateDeathConditions(after);
            if (cause) {
                death = { cause, description: describeDeath(cause, after) };
                this.repos.cultivators.markDead(cultivator.id, cause, run.turn + 1, death.description);
            }
        });
        persist();

        const lines = [
            `It cost ${exchange.damage} of what ${cultivator.name} had to give.`
            + (exchange.injury
                ? ` It left a ${exchange.injury.severity} injury that will not close on its own.`
                : '')
        ];
        if (death) lines.push((death as { description: string }).description);

        return {
            lines,
            calls: [
                {
                    name: 'engine.resolveExchange',
                    action: 'gate_strength',
                    summary:
                        `The gate at ordinal ${ordinal} applied force to a body at `
                        + `${cultivator.realmOrdinal}. ${exchange.narrationHint} Roll `
                        + `${exchange.roll.toFixed(4)}, advantage ${exchange.advantage.toFixed(2)}.`,
                    ok: true
                },
                ...(death ? [{
                    name: 'engine.evaluateDeathConditions',
                    action: 'death',
                    summary:
                        `${(death as { cause: string }).cause}. Written by the survival layer after the `
                        + 'damage landed, on the same path every other death in this package takes.',
                    ok: true
                }] : [])
            ]
        };
    }

    /** Catalogued arts a site is holding, by name rather than by id. */
    private prizeNames(site: Site): string[] {
        const arts = prizeTechniqueIds(site)
            .map(id => getTechnique(id)?.name ?? id);
        const items = prizeImmortalItemIds(site);
        const lines: string[] = [];
        if (arts.length > 0) {
            lines.push(`Written down here, in full: ${arts.join(', ')}.`);
        }
        if (items.length > 0) {
            lines.push('There is also a thing here that did not come from any forge in this world.');
        }
        return lines;
    }

    /**
     * Taking it, which is the act that empties the place.
     *
     * Entry has to be on record first. That is not ceremony: the whole surface
     * is built so a player cannot learn what is inside without going in, and a
     * take that worked from the threshold would be a route around that.
     *
     * The grant itself goes through `technique_manage.learn` rather than
     * through anything reimplemented here, so a manual the claimant cannot read
     * comes back as the engine's own refusal - which is not a bug and is the
     * world's stated design: the top grades are written for somebody who has
     * walked a road, which is why they sit in ruins unread.
     */
    private async takeFromSite(run: Run, cultivator: Cultivator, site: Site): Promise<Execution> {
        const record = this.sites.get(run.id, site.id);

        if (!record || record.enteredOnDay === null) {
            return refused('engine.siteLedger', 'site', factsForRefusal(
                'You are not in there.',
                'You reach for it from where you are standing, which is outside, and the reaching '
                + 'stops at the door. Whatever is behind it is behind it.',
                `No entry on record for ${site.id} in this run. The interior was not read and the `
                + 'prize was not resolved.'
            ));
        }

        if (record.takenOnDay !== null) {
            const whole = enterSite(site.id)!;
            return refused('engine.siteLedger', 'site', factsForRefusal(
                `${site.name}: already emptied.`,
                whole.interior.afterwards,
                `${site.id} was taken on day ${record.takenOnDay}${record.takenBy ? ` by ${record.takenBy}` : ''}. `
                + `${record.granted.length} thing(s) left the site then and are not here now.`
            ));
        }

        const whole = enterSite(site.id)!;
        const granted: string[] = [];
        const withheld: string[] = [];
        const calls: ToolCallRecord[] = [];

        for (const techniqueId of prizeTechniqueIds(whole)) {
            const result = await handleLearn({
                action: 'learn',
                techniqueId,
                cultivatorId: cultivator.id
            });
            const name = getTechnique(techniqueId)?.name ?? techniqueId;
            if (isGuidingErrorBody(result)) {
                withheld.push(result.message);
                calls.push({
                    name: 'technique_manage.learn',
                    action: 'site_prize',
                    summary: `${techniqueId}: ${result.error}. ${result.message}`,
                    ok: false
                });
                continue;
            }
            granted.push(name);
            calls.push({
                name: 'technique_manage.learn',
                action: 'site_prize',
                summary: `${techniqueId} learned off the site. Written by the same handler the tool surface uses.`,
                ok: true
            });
        }

        // The one immortal item in the whole catalog that is a grave good. It
        // leaves the site - the row below says so - and there is nowhere on a
        // cultivator to put it, because nothing in the storage layer models a
        // person holding one. Reported rather than faked: an item the player is
        // told they are carrying and that no query can find is worse than a
        // hole that says it is a hole.
        const items = prizeImmortalItemIds(whole);
        for (const itemId of items) {
            withheld.push(
                'There is a thing here that did not come from any forge in this world. It comes away '
                + 'with you, and there is nothing in your life that is the right shape to keep it in.'
            );
            calls.push({
                name: 'engine.possessions',
                action: 'site_prize',
                summary:
                    `${itemId} left ${site.id} and is recorded against the site. There is no `
                    + 'cultivator-side possession row for an immortal item in the storage layer, so '
                    + 'nothing was written on the cultivator. This is a gap, reported rather than faked.',
                ok: false
            });
        }

        const other = prizeOther(whole);
        this.sites.write(run.id, site, run.elapsedDays, {
            takenOnDay: Math.floor(run.elapsedDays),
            takenBy: cultivator.id,
            granted: [...prizeTechniqueIds(whole), ...items]
        });

        const facts = factsForSiteTaken(cultivator, site.name, {
            granted,
            withheld,
            other,
            afterwards: whole.interior.afterwards
        });

        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            ...calls,
            {
                name: 'engine.siteLedger',
                action: 'site',
                summary:
                    `${site.id} marked taken on day ${Math.floor(run.elapsedDays)}. The next party to `
                    + 'reach it finds what `afterwards` says they find.',
                ok: true
            }
        ];
        return execution;
    }

    /**
     * What was done to this ground, and who says why.
     *
     * `engine/world/locations.ts` has carried the whole of this from the
     * start - origin, an append-only change log, and a current state that is
     * the two folded together, patched in place so the map scars rather than
     * growing - and nothing in this layer reached any of it. A player could
     * stand in a scar for a hundred turns and never be able to ask about it.
     *
     * Three things are read out and one is withheld:
     *
     *  - what the place IS, which anybody with eyes has;
     *  - that it CHANGED, and when, which is legible in the ground itself;
     *  - what the people here BELIEVE, which is `attributedCauses` and is
     *    stored as belief because that is what it is;
     *  - and the CAUSE, only when `causeKnown` says the world has surrendered
     *    it. `causeFactId` is deliberately not consulted when it has not: the
     *    seeded ruins all carry a cause fact that nobody has recovered, and an
     *    answer that read differently in that case would be an answer.
     *
     * A read. No time passes, nothing is spent, and being refused costs the
     * same as being answered.
     */
    private placeHistory(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const asked = (target ?? '').trim();
        // "what happened to this place" names nowhere. It means underfoot.
        const wanted = asked.length >= 2 && !HERE_ITSELF.test(asked)
            ? asked
            : (cultivator.location ?? '');
        const place = this.atHand ? worldLocationFor(this.atHand, wanted) : null;

        if (!place) {
            // Worded so that it does not confirm anything either way. A place
            // the world does not model and a place with nothing on record have
            // to look the same from inside, for the same reason the cause gate
            // does: the shape of the refusal must not be the answer.
            return refused('engine.locationHistory', 'look', factsForRefusal(
                'The ground keeps nothing.',
                `You look over ${placeName(cultivator)} for the mark of whatever made it this way, ` +
                'and there is no mark and nobody to ask. Ground that has had something done to it ' +
                'usually shows it, and this does not.',
                `No world location record for "${wanted || placeName(cultivator)}"` +
                `${this.atHand ? '' : ' (world simulation is off for this run)'}.`
            ));
        }

        const rows = locationHistory(place);
        const origin = rows.find(row => row.changeId === null) ?? null;
        const facts = this.repos && this.atHand ? this.atHand.history.facts : [];

        // Newest first: the thing that made this place what it is now is the
        // last thing that happened to it, not the first.
        const changes = rows
            .filter(row => row.changeId !== null)
            .slice()
            .reverse()
            .slice(0, PLACE_CHANGES_SHOWN)
            .map(row => ({
                year: row.year,
                summary: row.summary,
                causeKnown: row.causeKnown,
                cause: row.causeKnown && row.causeFactId
                    ? facts.find(fact => fact.id === row.causeFactId)?.summary ?? null
                    : null,
                attributed: row.attributedCauses
            }));

        const rendered = factsForPlaceHistory(
            { name: place.name, kind: place.kind, description: place.description },
            origin && origin.onDay > Number.NEGATIVE_INFINITY
                ? { kind: place.origin.kind, year: origin.year }
                : { kind: place.origin.kind, year: null },
            changes
        );
        rendered.structure.push(`world location ${place.id}; ${place.changes.length} change(s) on record.`);

        const execution = this.freeAction(run, 'look', rendered);
        execution.calls = [{
            name: 'world.locationHistory',
            action: 'look',
            summary:
                `${place.id}: ${place.changes.length} change(s); ` +
                `${changes.filter(c => c.causeKnown).length} with a cause on record, ` +
                `${changes.reduce((n, c) => n + c.attributed.length, 0)} explanation(s) held locally. ` +
                'Read only: no time passed, nothing changed.',
            ok: true
        }];
        return execution;
    }

    /**
     * The realm rank a sentence names, or null when it names none.
     *
     * Read by containment against the ladder's own names rather than parsed,
     * so `realms.ts` stays the authority for what a rank is called and this
     * cannot go stale when the ladder changes. Scanned from the top down so a
     * longer name wins over a shorter one it contains.
     */
    private ordinalNamed(text: string | undefined): number | null {
        const query = (text ?? '').toLowerCase().trim();
        if (query.length < 3) return null;
        for (let ordinal = MAX_ORDINAL; ordinal >= 0; ordinal--) {
            if (query.includes(rankName(ordinal).toLowerCase())) return ordinal;
        }
        return null;
    }

    /**
     * The art a curriculum sentence named, or null when it named none.
     *
     * The generic phrase is refused rather than matched. "What the sect
     * teaches" is the question, not an answer to it, and handing it to a fuzzy
     * matcher is how a sentence about the shelf ends up decreeing whichever
     * art happened to share a word with it - for a generation, at the price of
     * every elder's standing.
     */
    private artNamed(text: string | undefined, cultivator: Cultivator): string | null {
        const query = (text ?? '').trim();
        if (query.length < 3 || GENERIC_LIBRARY_PHRASE.test(query)) return null;
        return resolveTechnique(this.repos, query, cultivator.id)?.id ?? null;
    }

    /**
     * What is for sale where they are standing.
     *
     * A read. Nothing is bought by looking at a board, no time passes, and a
     * place with no market says so - which is most places, and is the reason
     * getting out of a poor region is the first real goal anybody has.
     */
    private async market(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const category = MARKET_CATEGORIES.find(c => (target ?? '').toLowerCase().includes(c));
        const result = await handleMarket({
            action: 'market',
            cultivatorId: cultivator.id,
            ...(category ? { category } : {})
        });
        return this.fromToolResult('cultivation_mortal.market', 'market', result, 'The market');
    }

    /**
     * What happens if they try.
     *
     * The capability predicates, asked rather than discovered by dying. It
     * reports odds and never resolves anything: an attempt is always permitted,
     * and this is the difference between a player who chose badly and one who
     * was not told the ground was lethal.
     */
    private async assess(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const result = await handleAssess({
            action: 'assess',
            cultivatorId: cultivator.id,
            against: 'place',
            ...(target ? { place: target } : {})
        });
        return this.fromToolResult('cultivation_perception.assess', 'assess', result, 'The reckoning');
    }

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
                held.length > 0
                    ? 'You turn out the pouch and look at what is in it for a while. Nothing in ' +
                      'there adds up to the thing you had in mind, and there is no method for it ' +
                      'that you were ever taught.'
                    : 'The pouch is empty and the cauldron is cold, and wanting a pill is not a ' +
                      'method for making one.',
                `Unresolved recipe "${query}". Pouch: ${held.join(', ') || 'empty'}.`
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
                    ? `You know the name and that is the whole of what you have of it. Nobody ever ` +
                      `taught you ${technique.name}, and going through the motions of something you ` +
                      'have not been shown is just moving.'
                    : knows.length > 0
                        ? 'You settle to practise, and then cannot decide which of the things you ' +
                          'know you meant to practise.'
                        : 'You settle to practise, and it comes to you that you have never actually ' +
                          'been taught anything.',
                `Unresolved or unlearned technique. Known: ${knows.join(', ') || 'none'}.`
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
    private async gather(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, GATHERING_DAYS, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: GATHERING_FOCUS },
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, GATHERING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

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
            ...worldCalls(world),
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
    /**
     * ADMIN, the exploratory testing surface.
     *
     * Deliberately NOT narrated. The operator is asking the engine what it did,
     * and wrapping that in prose would put a model between them and the answer,
     * which is the one thing this surface exists to avoid. Output is whatever
     * `admin_manage` returned, verbatim.
     *
     * Arguments are explicit `key=value` pairs rather than parsed from prose.
     * That is the whole safety property: there is no inference here to be wrong,
     * and an unrecognised action is answered with the list rather than a guess.
     */
    private async adminAct(request: string, run: Run, cultivator: Cultivator): Promise<ActResult> {
        if (!isAdminModeEnabled()) {
            throw new GameError(
                'ADMIN is off for this process. Start the server with ADMIN_MODE=true to enable it.',
                403
            );
        }

        const words = request.trim().split(/\s+/).filter(Boolean);
        const action = words.shift() ?? '';
        if (!action) {
            throw new GameError(
                `ADMIN needs an action: ${ADMIN_ACTIONS.join(', ')}. ` +
                'Arguments are key=value, for example: ADMIN spawn_site kind=grave ordinal=41'
            );
        }

        const args: Record<string, unknown> = {
            action,
            cultivatorId: cultivator.id,
            runId: run.id
        };
        for (const word of words) {
            const at = word.indexOf('=');
            if (at <= 0) continue;
            const key = word.slice(0, at);
            const raw = word.slice(at + 1);
            const asNumber = Number(raw);
            args[key] = raw !== '' && Number.isFinite(asNumber) ? asNumber : raw;
        }

        const response = await handleAdminManage(args);
        const text = response.content?.[0]?.text ?? 'The admin surface returned nothing.';
        const after = this.currentRun();

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `ADMIN ${request.trim()}` },
            { role: 'narrator', turn: after.run.turn, text }
        ]);

        return {
            narration: text,
            events: [],
            toolCalls: [],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    private fromToolResult(
        name: string,
        action: ActionName,
        result: object,
        subject: string
    ): Execution {
        if (isGuidingErrorBody(result)) {
            // `message` is written in the world's voice by the tool layer.
            // `hint` is a tool invocation for a developer, and never goes to a
            // player: it names the API rather than anything in the fiction.
            const hint = typeof result.hint === 'string' ? result.hint : null;
            return refused(name, action, factsForRefusal(
                `${subject}: refused.`,
                result.message,
                `${result.error}${hint ? `. ${hint}` : ''}`
            ));
        }

        const body = result as Record<string, unknown>;
        const hint = typeof body.narrationHint === 'string' ? body.narrationHint : null;

        // The handler's own `narrationHint` is written in the world's voice and
        // is the whole account. What used to lead this list was
        // "${subject}: the engine resolved it." - a sentence about the software,
        // shipped to a player, which is the exact defect the refusal sweep was
        // for and which no test caught because these verbs did not exist yet.
        const detail = summariseToolBody(body);
        const lines = hint
            ? [hint, ...detail]
            : detail.length > 0 ? detail : ['It is done. Nothing about it drew attention.'];

        return {
            facts: factsForToolResult(hint ?? lines[0], lines),
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
    private async runSeclusion(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        days: number,
        options: { sealed?: boolean } = {}
    ): Promise<Execution> {
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
            // Nothing wanders into a True Immortal's seclusion. The encounter
            // tables are the mortal world's, and they are not up there.
            randomEvents: !sealed && !canExistBeyondTheLid(cultivator),
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
        // The world spends exactly the days the cultivator spent. Not the days
        // that were asked for: a skip cut short by a wound stops the world at
        // the same hour it stopped the cultivator.
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
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
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(verb, skip, provisioning.line),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }

    private async shortSkip(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        focus: number,
        label: string,
        days = SHORT_ACTION_DAYS
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, days, {
            seed: run.seed,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: focus },
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, days),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        const facts = factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, label);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(label.toLowerCase().startsWith('practice') ? 'train_technique' : 'wait', skip, null),
                ...worldCalls(world)
            ]
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
                'You are not hungry, and eating for the sake of it is a habit for people with more ' +
                'stones than you have.',
                `Satiety already ${cultivator.satiety}/${SATIETY_MAX}; no purchase made.`
            ));
        }
        if (cultivator.spiritStones < MEAL_COST_STONES) {
            return refused('cultivator.applyDeltas', 'eat', factsForRefusal(
                'Nothing to buy it with.',
                'You count what you are carrying twice, which does not change it. A bowl costs ' +
                'more than that, and nobody here is in the business of charity.',
                `Meal costs ${MEAL_COST_STONES}; purse holds ${cultivator.spiritStones}.`
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

    // ── being hurt, and the shop that was always there ───────────────────
    //
    // The softlock, found by playing cold in a browser and reproduced in full:
    //
    //   turn 11  3 untreated meridian injuries. Any further combat is fatal.
    //   turn 12  "I cultivate for twenty years"
    //            Day 30 - Qi deviation: a minor meridian injury.
    //            Day 30 - 4 untreated meridian injuries.
    //            You came out early. 30 days of the 20 years were spent.
    //
    // Untreated injuries raise deviation risk, deviation adds another injury
    // and ejects the cultivator from seclusion after about a month, and the
    // next attempt goes wrong slightly sooner. He could not advance, could not
    // heal, and could not die - the only exit the engine named was combat and
    // the engine had already said combat was fatal. All of it with three
    // hundred and forty-five spirit stones in the purse, standing in a market
    // whose board advertised a physician at forty cash.
    //
    // Both halves of that are fixed here and both were the same defect: a
    // price the player has been shown that no sentence can spend money on.

    /**
     * The two lines on the board that answer "I am hurt".
     *
     * Ids rather than a rule. Everything about what they cost, what they are
     * worth against a pill and what a mortal physician can and cannot do is
     * read off the catalog rows themselves - including the one fact that
     * decides which of them is any use, which is the physician's own note
     * saying he cannot touch a meridian.
     */
    private static readonly PRICE_PHYSICIAN_VISIT = 'price-doctor-visit';
    private static readonly PRICE_COURSE_OF_CARE = 'price-splint-and-month';

    /**
     * Getting a wound seen to.
     *
     * Priced off the same rows `market` prints, through the same
     * `localPrice`, so the number the player was quoted is the number they
     * pay. Nothing about the price or the effect is authored here.
     *
     * The physician is refused for the commonest case and it is the catalog
     * that refuses him: every injury this engine produces is a meridian
     * injury, and `price-doctor-visit` says in its own note that a mortal
     * physician "sets a bone, stitches a cut, cannot touch a meridian". What
     * the mortal world does sell for a meridian is the course of care, which
     * calls itself the alternative to a healing pill - slower, cheaper, and it
     * leaves you out of the fight for a season. So the answer to "I am hurt"
     * is a real choice with a real price on both sides, and it came out of the
     * price list rather than out of this method.
     */
    private async treat(run: Run, cultivator: Cultivator, ambient: AmbientQi): Promise<Execution> {
        const hurt = untreatedInjuries(cultivator.injuries);
        const visit = getPrice(GameService.PRICE_PHYSICIAN_VISIT)!;
        const course = getPrice(GameService.PRICE_COURSE_OF_CARE)!;
        const regionId = standingOf(cultivator).regionId;
        const courseCash = localPrice(regionId, course.cash);
        // Rounded UP to whole stones. The purse holds whole stones and a
        // player must never be charged less than the board quoted.
        const perWound = Math.max(1, Math.ceil(cashToStones(courseCash)));

        if (hurt.length === 0) {
            return refused('engine.untreatedInjuries', 'treat', factsForRefusal(
                'Nothing to see to.',
                'You take stock of yourself and find nothing anybody could charge you for. '
                + 'Whatever is wrong with your life today, it is not a wound.',
                `No untreated injuries on record. ${course.name} would have cost ${perWound} `
                + 'spirit stone(s) a wound. Nothing bought, nothing spent, no time passed.'
            ));
        }

        if (cultivator.spiritStones < perWound) {
            // Named price, named shortfall - the shape the sect admission
            // refusal uses, which is the one refusal in this game that has
            // never had to be explained to anybody.
            return refused('engine.localPrice', 'treat', factsForRefusal(
                'Not for what you are carrying.',
                `${course.name} is ${courseCash} cash the ${course.unit}, which is ${perWound} spirit `
                + `stone${perWound === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}, which is `
                + `${perWound - cultivator.spiritStones} short. ${visit.note} That is the whole of what the `
                + 'mortal world sells for this, and none of it is sold on credit.',
                `${course.id} at ${courseCash} cash = ${perWound} stone(s) per wound; purse holds `
                + `${cultivator.spiritStones}. ${hurt.length} untreated injury(ies) left untreated.`
            ));
        }

        const courses = Math.min(hurt.length, Math.floor(cultivator.spiritStones / perWound));
        const cost = courses * perWound;

        // A month under somebody's roof, fed out of the purse the same way a
        // seclusion is. The clock runs through it: the world moves, the food
        // is bought or it is not, and a cultivator who cannot pay for both can
        // still starve during the stay - through the survival layer, exactly
        // as they would anywhere else.
        const provisioning = this.buyProvisions(cultivator, TREATMENT_DAYS);
        const paid = this.repos.cultivators.applyDeltas(provisioning.cultivator.id, { spiritStones: -cost });
        if (!paid) throw new GameError('Cultivator vanished on the physician\'s table.', 500);

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(paid, TREATMENT_DAYS, {
            seed: run.seed,
            locationId: placeName(paid),
            turn: run.turn,
            startDay,
            options: { focusMultiplier: TREATMENT_FOCUS },
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: false,
            // Lying still under a roof. Nothing wanders in, and no opportunity
            // finds somebody who cannot stand up, which is the same bargain
            // closed-door seclusion makes.
            randomEvents: false,
            toll: tollConditionsFor(this.repos, paid)
        });

        const applied = applyTimeSkip(this.repos, { before: paid, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // The month can kill: the bleed clock runs through it, and so does the
        // food clock. The survival layer has already written it and nothing
        // here may treat a corpse's wounds or report a recovery over the top
        // of a death.
        if (!applied.cultivator.alive) {
            const dead = factsForTimeSkip(paid, applied.cultivator, skip, ambient, 'Under a physician');
            dead.lines.unshift(provisioning.line);
            dead.lines.push(
                `The ${cost} spirit stone${cost === 1 ? '' : 's'} for the care was paid up front and `
                + 'nobody is going to refund it.'
            );
            return {
                facts: dead,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...skipCalls('treat', skip, provisioning.line), ...worldCalls(world)]
            };
        }

        // The engine's own triage decides which wounds, worst first. This
        // layer decides only how many were paid for.
        const triage = treatWorstInjuries(applied.cultivator.injuries, courses);
        const treated = applied.cultivator.injuries.filter(
            (before: Injury) => !before.treated
                && triage.injuries.some((closed: Injury) => closed.id === before.id && closed.treated)
        );
        const persist = this.db.transaction(() => {
            for (const injury of treated) {
                this.repos.cultivators.treatInjury(injury.id, run.turn + 1);
            }
        });
        persist();

        const after = this.repos.cultivators.getById(cultivator.id)!;
        const stillHurt = untreatedInjuryCount(after.injuries);
        const facts = factsForTreatment(cultivator, after, {
            what: course.name,
            note: course.note,
            cashEach: courseCash,
            stonesEach: perWound,
            stonesSpent: cost,
            days: skip.simulatedDays,
            treated: treated.map(injury => injury.description),
            stillUntreated: stillHurt
        });
        facts.lines.unshift(provisioning.line);
        facts.lines.push(...applied.tollLines);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.applyDeltas',
                    action: 'treat',
                    summary:
                        `${courses} course(s) of ${course.name} at ${courseCash} cash (${perWound} stone(s)) `
                        + `each = ${cost} stones. Priced through localPrice(${regionId}), the same call `
                        + 'the market board prices with.',
                    ok: true
                },
                ...skipCalls('treat', skip, provisioning.line),
                {
                    name: 'engine.treatWorstInjuries',
                    action: 'treat',
                    summary:
                        `${treated.length} injury(ies) treated worst-first by the engine's own triage; `
                        + `${stillHurt} still untreated. Treated wounds stay on the record as scar `
                        + 'tissue and contribute no penalty.',
                    ok: treated.length > 0
                },
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * Buying a line off the price board.
     *
     * The board is the only list in this game the player has actually been
     * shown, so a name off it is the one free-text subject they can be certain
     * they typed correctly - and until this existed, twenty-two advertised
     * lines had four verbs between them covering three of them. The rest went
     * to the party resolver, which answered "nobody by that name" to somebody
     * trying to pay a physician.
     *
     * Three outcomes, and the third is the honest one rather than the lazy
     * one: what the engine models, it does; what it does not model, it says so
     * and charges nothing. A player who is billed for a night at an inn that
     * changes no row has been robbed by the software.
     */
    private async buy(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const query = (target ?? '').trim();
        const resolved = query.length >= 3 ? resolvePrice(query) : null;
        const price = resolved ? getPrice(resolved.id) : undefined;

        if (!price) {
            const board = PRICES.slice(0, MARKET_LINES).map(row => row.name).join(', ');
            return refused('engine.resolvePrice', 'buy', factsForRefusal(
                'Not something anybody here sells.',
                'You ask for it and get the look people give somebody asking for a thing that is '
                + `not sold. What is: ${board}, and a dozen more besides.`,
                `Unresolved price "${query || '(nothing named)'}" against ${PRICES.length} board `
                + 'line(s). Nothing bought, nothing spent, no time passed.'
            ));
        }

        // Medicine that is a course of care rather than an object routes to the
        // treatment path, so the physician on the board and the sentence "I get
        // my injuries treated" reach the same code and cannot disagree about
        // what a wound costs.
        if (price.id === GameService.PRICE_COURSE_OF_CARE || price.id === GameService.PRICE_PHYSICIAN_VISIT) {
            return this.treat(run, cultivator, ambient);
        }

        const regionId = standingOf(cultivator).regionId;
        const cash = localPrice(regionId, price.cash);
        const stones = Math.max(1, Math.ceil(cashToStones(cash)));

        // What the engine actually holds a row for. A pill goes in the pouch;
        // a ferry crossing and a night at an inn do not, and saying so beats
        // taking the money for a state change that never happens.
        const pill = price.category === 'medicine' ? resolvePill(price.name.replace(/,.*$/, '')) : null;

        if (!pill) {
            const facts = factsForUnsupported(
                `buying ${price.name}`,
                `${price.name} is priced and quoted and there is no row in this engine for holding `
                + 'one, so nothing was charged.'
            );
            facts.lines.push(
                `${price.name} is ${cash} cash the ${price.unit} here, which is about ${stones} `
                + `spirit stone${stones === 1 ? '' : 's'}. ${price.note}`,
                'You could pay it. Nothing in your life would be different afterwards, so you keep '
                + 'the money.'
            );
            facts.prose = facts.lines.join('\n\n');
            return refused('engine.possessions', 'buy', facts);
        }

        if (cultivator.spiritStones < stones) {
            return refused('engine.localPrice', 'buy', factsForRefusal(
                'Not for what you are carrying.',
                `${price.name} is ${cash} cash the ${price.unit} here, which is ${stones} spirit `
                + `stone${stones === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}. `
                + `You are ${stones - cultivator.spiritStones} short and nobody is offering terms.`,
                `${price.id} at ${cash} cash = ${stones} stone(s); purse holds `
                + `${cultivator.spiritStones}. Short by ${stones - cultivator.spiritStones}.`
            ));
        }

        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
            if (!updated) throw new GameError('Cultivator vanished mid-purchase.', 500);
            addToPouch(this.db, cultivator.id, pill.id, 'pill', 1);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        const facts = factsForToolResult(`${pill.name}, bought.`, [
            `One ${pill.name}, ${cash} cash the ${price.unit}, which is ${stones} spirit `
            + `stone${stones === 1 ? '' : 's'} of the ${cultivator.spiritStones} you had.`,
            price.note,
            `${after.spiritStones} left in the purse, and the pill is in the pouch.`
        ]);
        facts.structure.push(
            `${price.id} -> ${pill.id}: ${cash} cash at the ${regionId} multiplier, charged as `
            + `${stones} stone(s). One added to cultivator_pouch.`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'storage.addToPouch',
                action: 'buy',
                summary:
                    `One ${pill.name} for ${stones} spirit stone(s), priced through `
                    + `localPrice(${regionId}) - the same call the market board prices with.`,
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


    /**
     * Buying food before it is needed, and carrying it.
     *
     * The stock is held on the cultivator rather than reconstructed at the
     * moment of seclusion, which is the whole difference. Rations bought here
     * survive travel, survive a change of mind about how long to sit, and are
     * spent by the time skip - so `provisions_exhausted` becomes a fact about
     * a decision the player made rather than a warning about a resource they
     * were never allowed to hold.
     *
     * Priced off the same catalog entry the market board quotes, so the number
     * on the board and the number charged here cannot drift.
     */
    private provision(run: Run, cultivator: Cultivator, days?: number): Execution {
        // No span named means "as much as I can carry sensibly": enough for the
        // default seclusion, which is the thing they are about to do.
        const wanted = Math.max(
            1,
            Math.ceil((days ?? DEFAULT_CULTIVATION_DAYS) / ACTIONS_PER_FULL_SATIETY)
        );
        const affordable = Math.floor(cultivator.spiritStones / PROVISION_COST_STONES);
        const bought = Math.min(wanted, affordable);

        if (bought === 0) {
            return refused('cultivator.applyDeltas', 'provision', factsForRefusal(
                'Not for what you have.',
                'You price a month of dry rations and put it back. The seller does not comment, ' +
                'which is its own kind of comment.',
                `Provisions: ${PROVISION_COST_STONES} spirit stones per ration; purse holds ` +
                `${cultivator.spiritStones}. Nothing bought, nothing spent.`
            ));
        }

        const cost = bought * PROVISION_COST_STONES;
        const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost });
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const held = this.rationsHeld(cultivator) + bought;
        this.setRationsHeld(cultivator, held);
        this.repos.runs.incrementTurn(run.id, 1);

        const covers = held * ACTIONS_PER_FULL_SATIETY;
        const facts = factsForToolResult(
            `${bought} ration${bought === 1 ? '' : 's'} bought.`,
            [
                `${bought} ration${bought === 1 ? '' : 's'} of dry food, ${cost} spirit stones, ` +
                `and ${updated.spiritStones} left in the purse.`,
                `That is ${humanDays(covers)} of eating in the pack` +
                `${bought < wanted ? ', which is less than you went in for' : ''}.`,
                // Said plainly once, because it is the thing the whole early
                // game turns on and no interrupt can teach it in time.
                'Food does not come to a cave. Whatever is in the pack when the door shuts is ' +
                'the whole of what there is.'
            ]
        );
        facts.structure.push(
            `provision: bought ${bought} of ${wanted} wanted at ${PROVISION_COST_STONES} stones each; ` +
            `held now ${held} (${covers} days).`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'cultivator.applyDeltas',
                action: 'provision',
                summary:
                    `${bought} ration(s) for ${cost} spirit stones. Held: ${held}. ` +
                    'Carried on the cultivator and spent by the time skip.',
                ok: true
            }]
        };
    }

    /** Rations in the pack. Carried across turns, travel and changes of mind. */
    private rationsHeld(cultivator: Pick<Cultivator, 'id'>): number {
        const raw = readFlag(this.db, cultivator.id, FLAG_RATIONS_HELD);
        const held = raw === null ? 0 : Number(raw);
        return Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
    }

    /**
     * Hand a stretch of days what it needs out of the pack, and deduct it.
     *
     * Seclusion has `buyProvisions`, which also tops the pack up at the door.
     * The ordinary actions - working, gathering, travelling - do not buy
     * anything on the player's behalf; they eat what is already carried.
     * Before this existed they ate nothing at all, and a player could starve to
     * death holding fifteen rations because they had spent the week earning the
     * stones rather than sitting in a cave.
     */
    /**
     * Open a ration if the belly is low and the pack has one.
     *
     * Nobody carrying food starts a season of hauling hungry. Found by
     * playtesting: a player who did the sensible thing - buy two years of
     * rations, then take work to afford more - finished the shift at exactly
     * zero satiety and died of starvation on their next action, with a
     * fortnight of food still on their back.
     */
    private feedFromPack(cultivator: Cultivator): Cultivator {
        if (!stillNeedsToEat(cultivator.realmOrdinal)) return cultivator;
        if (cultivator.satiety >= SATIETY_MAX / 2) return cultivator;
        const held = this.rationsHeld(cultivator);
        if (held <= 0) return cultivator;

        this.setRationsHeld(cultivator, held - 1);
        const updated = this.repos.cultivators.applyDeltas(cultivator.id, {
            satiety: SATIETY_MAX - cultivator.satiety,
            starvationTurns: -cultivator.starvationTurns
        });
        return updated ?? cultivator;
    }

    private drawFromPack(
        cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'satiety'>,
        days: number
    ): number {
        const multiplier = satietyBurnMultiplier(cultivator.realmOrdinal);
        if (multiplier <= 0) return 0;
        const perRation = Math.max(1, Math.floor(ACTIONS_PER_FULL_SATIETY / multiplier));
        // Only the shortfall. The belly covers the first stretch on its own,
        // and opening a ration to cover days already paid for wastes food the
        // player bought deliberately.
        const bellyCovers = Math.floor(cultivator.satiety / (SATIETY_COST_PER_ACTION * multiplier));
        const wanted = Math.ceil(Math.max(0, days - bellyCovers) / perRation);
        const held = this.rationsHeld(cultivator);
        const taken = Math.max(0, Math.min(wanted, held));
        if (taken > 0) this.setRationsHeld(cultivator, held - taken);
        return taken;
    }

    private setRationsHeld(cultivator: Pick<Cultivator, 'id'>, held: number): void {
        writeFlag(this.db, cultivator.id, FLAG_RATIONS_HELD, String(Math.max(0, Math.floor(held))));
    }

    private buyProvisions(
        cultivator: Cultivator,
        days: number
    ): { cultivator: Cultivator; rations: number; covered: number; line: string } {
        const wanted = Math.ceil(days / ACTIONS_PER_FULL_SATIETY);

        // What is already in the pack comes first. A player who stocked up
        // deliberately must not be charged again at the cave mouth for food
        // they are carrying, and the ones they carried in are the ones the
        // time skip eats.
        const carried = Math.min(wanted, this.rationsHeld(cultivator));
        const short = wanted - carried;
        const affordable = Math.floor(cultivator.spiritStones / PROVISION_COST_STONES);
        const topUp = Math.max(0, Math.min(short, affordable));
        const rations = carried + topUp;
        const cost = topUp * PROVISION_COST_STONES;
        if (carried > 0) this.setRationsHeld(cultivator, this.rationsHeld(cultivator) - carried);

        if (rations === 0) {
            return {
                cultivator,
                rations: 0,
                covered: Math.floor(cultivator.satiety / 2),
                line:
                    'Nothing in the pack and nothing the purse will buy: ' +
                    `${cultivator.spiritStones} spirit stones against ${PROVISION_COST_STONES} ` +
                    `per ration. The belly covers ${Math.floor(cultivator.satiety / 2)} days ` +
                    'and then starvation begins.'
            };
        }

        const updated = cost > 0
            ? this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost })
            : cultivator;
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const covered = rations * ACTIONS_PER_FULL_SATIETY + Math.floor(cultivator.satiety / 2);
        return {
            cultivator: updated,
            rations,
            covered,
            line: (carried > 0
                ? `${carried} ration${carried === 1 ? '' : 's'} came out of the pack` +
                  `${topUp > 0 ? `, and ${topUp} more was bought for ${cost} spirit stones` : ' and nothing had to be bought'}. `
                : `${rations} ration${rations === 1 ? '' : 's'} bought for ${cost} spirit stones. `)
                + (covered >= days
                    ? `That covers the whole stretch. ${updated.spiritStones} stones left.`
                    : `That is food for about ${humanDays(covered)} of the ${humanDays(days)} asked for. ` +
                      'After that the belly is empty and five turns later it is fatal.')
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
            here: cultivator.location,
            present: this.present(cultivator)
        };
    }

    /**
     * Everybody standing where the player is standing.
     *
     * Both populations, joined on the place name. This is the call that was
     * missing: nineteen people were at Sweptground and every social path
     * dead-ended, because the only population anybody asked about was the
     * `cultivators` table and the world's people were not in it.
     */

    /**
     * What the player's membership looks like from where they are standing.
     *
     * Joining an order is the most consequential thing a low cultivator can
     * do, and until this existed the world never mentioned it again: the seat
     * of your own sect read exactly like a strange town. Two facts, both off
     * rows - whether they belong to anything, and whether this is its ground.
     */
    private standingHere(cultivator: Cultivator): string | null {
        if (!cultivator.sectId) return null;
        const sect = this.repos.sects.getById(cultivator.sectId);
        if (!sect) return null;

        const membership = this.repos.sects.getMembership(cultivator.id);
        const rank = membership?.rankTitle ?? 'a member';

        // Deliberately NOT "you are at your sect's headquarters". The catalog
        // records a territory in prose - "no fixed seat", "cutting houses at
        // the edge of six cities, all of them rented" - and matching a free
        // text location against that would be inventing a fact the content
        // does not state. What is certain is the membership and what it is
        // worth, and what it is worth is local.
        const territory = getSect(sect.id)?.territory ?? null;

        return `${sect.name} has you down as ${rank}. ` +
            (territory
                ? `${territory} Whether that means anything where you are standing depends on who is ` +
                  'standing in front of you.'
                : 'Whether that means anything where you are standing depends on who is standing in ' +
                  'front of you.');
    }


    /**
     * Whether a name is anywhere the world would recognise.
     *
     * Three registers, and any one of them is enough. The world's own location
     * table is authoritative where it is populated; the roster covers places
     * that have people in them but no record yet; and the cultivator's own
     * knowledge covers everywhere they have been told about, which is how a
     * player reaches somewhere they have only heard named.
     *
     * Where they are already standing counts too - "I go back to Sweptground"
     * from Sweptground is a no-op, not a refusal.
     */
    private somewhereReal(name: string, cultivator: Cultivator): boolean {
        const wanted = placeKey(name);
        if (wanted.length === 0) return false;
        if (placeKey(cultivator.location ?? '') === wanted) return true;

        if (this.atHand && worldLocationFor(this.atHand, name)) return true;

        const occupied = this.repos.cultivators.roster()
            .some(row => row.location && placeKey(row.location) === wanted);
        if (occupied) return true;

        return this.knowledge
            .awareness(cultivator.id, 'place')
            .some(row => placeKey(row.name) === wanted || placeKey(row.id) === wanted);
    }


    /**
     * Somebody standing here, when the player pointed rather than named.
     *
     * "The nearest cultivator", "the old woman", "him" - these are not names
     * and must never be fuzzy-matched into one, because that hands the player
     * an identity they have not earned and, in a fight, picks the opponent for
     * them. What they ARE is a gesture at a person in the square, which is a
     * legitimate way to indicate somebody standing in front of you.
     *
     * Returns null when the phrase looks like an actual name, so a typo in a
     * real name still fails honestly rather than hitting whoever is closest.
     */
    /**
     * The ruin the player means when they say "the ruins".
     *
     * Looked up in the world's own locations rather than invented: a place
     * whose name or kind says ruin, at or adjacent to where they are standing.
     * Returns null when the world is off or there is nothing of the sort here,
     * and the refusal above then says so as a search that came up empty.
     */
    private ruinAtHand(query: string, cultivator: Cultivator): ResolvedEntity | null {
        if (!/^(?:the |that |these |those |a )?(?:old |broken |sealed |dead )*(?:ruins?|wreck|remains|rubble|old place)$/i
            .test(query.trim())) {
            return null;
        }
        if (!this.atHand) return null;

        const here = placeKey(cultivator.location ?? '');
        const ruin = this.atHand.locations.find(loc =>
            /ruin|wreck|remnant|broken|derelict/i.test(loc.name)
            && (placeKey(loc.name).includes(here) || here.length === 0 || placeKey(loc.name) === here));

        // Failing that, any ruin the cultivator has heard named. A player who
        // was told about one and walks off to search it is doing the right
        // thing and should not be told it does not exist.
        const known = ruin ?? this.atHand.locations.find(loc =>
            /ruin|wreck|remnant|derelict/i.test(loc.name)
            && this.knowledge.isAwareOf(cultivator.id, 'place', loc.id));
        if (!known) return null;

        return {
            kind: 'place',
            id: known.id,
            name: known.name,
            facts: [
                `${known.name} is there, and has been longer than anyone standing near it.`,
                'Nothing about it is arranged for a visitor. What is still in it is still in it ' +
                'because getting it out was harder than it was worth to whoever tried last.'
            ],
            structure: [`world location ${known.id}; matched on "${query}".`]
        };
    }

    private somebodyAtHand(query: string, cultivator: Cultivator): RosterEntry | null {
        if (!POINTING.test(query.trim())) return null;
        const here = this.present(cultivator);
        return here.length > 0 ? here[here.length - 1] : null;
    }

    private present(cultivator: Cultivator): RosterEntry[] {
        return othersPresent(this.repos, cultivator, this.atHand);
    }

    /**
     * Who is here, split by whether the player can name them.
     *
     * The discovery rule, applied to people. Being in the room is permission to
     * see somebody; it is not permission to know who they are. So a face the
     * player has a record for gets a name and everybody else gets a reading of
     * how they carry themselves, and the count of the rest is a crowd rather
     * than a cast list.
     */
    private company(cultivator: Cultivator): Company {
        const here = this.present(cultivator);
        const named: Company['named'] = [];
        const strangers: Company['strangers'] = [];

        for (const person of here) {
            if (this.knowledge.isAwareOf(cultivator.id, 'cultivator', person.id)) {
                named.push({ name: person.name, ordinal: person.realmOrdinal });
            } else {
                strangers.push({ ordinal: person.realmOrdinal });
            }
        }

        // Deepest first: in a square, the person you notice is the one the
        // others are being careful around.
        named.sort((a, b) => b.ordinal - a.ordinal);
        strangers.sort((a, b) => b.ordinal - a.ordinal);

        return { named, strangers, total: here.length };
    }

    /**
     * Move the world the same span the cultivator just spent.
     *
     * Called from every path that consumes days, so that forty years in a cave
     * come out into a world that had forty years. The digest is built against
     * this cultivator's own knowledge, which means the same span reaching two
     * different people would tell them different things - and tell most people
     * nothing at all, which is the intended ratio and not a bug to fix.
     *
     * The count of what never reached them goes to the inspector and never to
     * the narrator. Surfacing it would turn "the world is mostly none of your
     * business" into a status line.
     */
    private async advanceWorld(days: number, cultivator: Cultivator, run: Run): Promise<WorldReport> {
        if (!this.worldEnabled || days <= 0) return { lines: [], structure: [] };

        const advance = await advanceWorldForCultivator(run, cultivator, days);
        return reportFromDigest(advance?.result.digest ?? null);
    }

    /**
     * Whether a name gets said in this scene, and the record for it if so.
     *
     * The write happens here, in phase 2. Phase 3 receives only a licence to
     * mention something the database already holds, which keeps the dependency
     * pointing the right way: prose can fail to use a name without the name
     * failing to exist.
     */
    private hear(
        cultivator: Cultivator,
        run: Run,
        occasion: string,
        addressingId: string | null,
        listening?: { intent: HearingIntent; reach?: AnswerReach }
    ): Hearing | null {
        const addressing = addressingId
            ? this.present(cultivator).find(row => row.id === addressingId) ?? null
            : null;

        const offered = offerHearing({
            repos: this.repos,
            gate: this.knowledge,
            cultivator,
            run,
            addressing,
            occasion,
            world: this.atHand,
            ...(listening ?? {})
        });
        if (!offered) return null;

        const learned = recordHearing(this.knowledge, cultivator, run, offered);
        return learned.length > 0 ? { ...offered, names: learned } : null;
    }

    /**
     * One thing worth noticing about the people here.
     *
     * A practice names nothing, so unlike a name it is safe in the narrator's
     * own voice - it is the "show the world, never explain it" half of the
     * doctrine rather than the discovery half. `practices.ts` holds the one
     * narrow gate that does apply.
     */
    private notice(cultivator: Cultivator, run: Run, occasion: string): string | null {
        const seen = observableHere({
            present: this.present(cultivator),
            gate: this.knowledge,
            holderId: cultivator.id,
            rng: forStream(run.seed, 'web_practice', Math.floor(run.elapsedDays), occasion, cultivator.id)
        });
        return seen ? observedLine(seen) : null;
    }

    /** Everything this cultivator has heard of. The narrator's whitelist. */
    private awarenessOf(cultivator: Cultivator): AwarenessRow[] {
        return this.knowledge.awareness(cultivator.id);
    }

    /**
     * The blank look, which is the answer.
     *
     * Somebody in the same place has never heard the words, or there is nobody
     * to have not heard them. Either way the player learns the same thing - the
     * name gets them nothing here - without being told that a rule was applied.
     * Never confirms whether the thing exists, and never lists what would have
     * worked.
     */
    private blankLook(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `You say it aloud in ${where} and ${where} carries on as it was. ` +
                'Whatever you meant by it, there is nothing here that answers to it.';
        }
        const witness = here[0].name;
        return `You put the words to ${witness}. They look at you the way people look at a ` +
            'sentence with a hole in it, and then go back to what they were doing.';
    }

    /**
     * What is actually about, briefly, when the player named nobody.
     *
     * Says what is there and stops. A list of who could be approached is a
     * developer affordance wearing a sentence.
     */
    private whoIsAbout(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `There is nobody about in ${where} at all, and you had not settled on who you ` +
                'were looking for before you noticed that.';
        }
        if (here.length === 1) {
            return `${here[0].name} is the only person in ${where}, and you have not decided ` +
                'whether it was them you wanted.';
        }
        return `There are people about in ${where}, and you get as far as opening your mouth ` +
            'before realising you had not picked one.';
    }

    /**
     * What the player could have meant, drawn only from what they know.
     *
     * A refusal that listed every recruiting sect in the catalog would leak the
     * world through the error path, which is exactly the door discovery.md is
     * shutting. This lists people in the room and names already held.
     *
     * INSPECTOR ONLY. It used to be appended to the refusal the player reads,
     * which made every dead end end in a list of valid targets - a developer
     * affordance, and an invitation to play the parser instead of the game.
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

    // ── the mortal economy ──
    //
    // `work` and `market` return figures rather than a narration hint, because
    // the tool surface's caller is a model that will phrase them. Here they
    // have to become sentences or a player gets "The work is done." and nothing
    // else, which is how the first live check of this path read.
    if (body.worked === true) {
        const occupation = body.occupation as { name?: string } | undefined;
        const days = typeof body.daysWorked === 'number' ? body.daysWorked : 0;
        const paid = typeof body.spiritStonesEarned === 'number' ? body.spiritStonesEarned : 0;
        const now = typeof body.spiritStonesNow === 'number' ? body.spiritStonesNow : null;

        lines.push(
            `${humanDays(days)} of ${occupation?.name ?? 'whatever was going'}, ` +
            `and ${paid > 0 ? `${paid} spirit stones for it` : 'nothing to show for it'}` +
            `${now === null ? '.' : `, which leaves ${now}.`}`
        );
        lines.push(
            'Nothing was gathered in that time. That is what the money costs, and it is why a ' +
            'sect stipend is worth more than the stipend.'
        );
        if (typeof body.unpaid === 'string') lines.push(body.unpaid);
    }

    // -- the sects --
    //
    // `sect_manage.join` and `.leave` return a membership record rather than a
    // narration hint. Without this the last-resort line reached a player as
    // "The Gleaners' Company is done." - which reads as the sect being
    // finished, not as the joining having happened. Same defect class as the
    // work and market boards: a tool surface written for a model that will
    // phrase the figures, called here by something that has to phrase them
    // itself.
    if (body.joined === true) {
        const joinedSect = body.sect as { name?: string } | undefined;
        const membership = body.membership as { rankTitle?: string } | undefined;
        lines.push(
            // "at ${rankTitle}" read as a place. Barrow Hand is the lowest
            // rank in the Gleaners' Company and it is also a town, so the line
            // told a player standing in Sweptground that they were somewhere
            // else. A rank has to be named as a rank.
            `Taken on by ${joinedSect?.name ?? 'the sect'}` +
            `${membership?.rankTitle ? `, ranked ${membership.rankTitle}` : ''}. ` +
            'No journey was involved and none is implied: being on their roll and being on their ' +
            'ground are two different things.'
        );
        if (typeof body.defectedFrom === 'string' && body.defectedFrom.length > 0) {
            lines.push(
                'Whatever standing was built at the last door stayed there. ' +
                'Contribution does not travel.'
            );
        }
    }

    if (body.left === true) {
        const formerSect = body.sect as { name?: string } | undefined;
        const formerRank = typeof body.formerRank === 'string' ? body.formerRank : null;
        lines.push(
            `No longer of ${formerSect?.name ?? 'the sect'}` +
            `${formerRank ? `, where the rank was ${formerRank}` : ''}.`
        );
        if (typeof body.note === 'string') lines.push(body.note);
    }

    const offered = body.work as Array<{ name?: string; cashPerMonth?: number; monthsLodgingItCovers?: number; risk?: string }> | undefined;
    if (Array.isArray(offered)) {
        if (offered.length === 0) {
            lines.push(
                'Nobody here is hiring anyone, for anything. Somewhere with more people in it ' +
                'will have something.'
            );
        } else {
            lines.push('What is going, for somebody standing where they are standing:');
            for (const job of offered.slice(0, 6)) {
                const keep = typeof job.monthsLodgingItCovers === 'number'
                    ? `, and a month of it keeps them about ${job.monthsLodgingItCovers} months`
                    : '';
                lines.push(`  ${job.name ?? 'unnamed work'}${keep}${job.risk ? ` (${job.risk})` : ''}.`);
            }
            lines.push(
                'A month spent earning is a month not spent cultivating. That is the whole of the choice.'
            );
        }
    }

    const prices = body.prices as MarketPrice[] | undefined;
    if (Array.isArray(prices)) {
        if (prices.length === 0) {
            lines.push(
                'Nobody here is selling anything. It is a road, or a hillside, and the nearest ' +
                'person with a stall is a long way off.'
            );
        } else {
            // The board is read out in full or it is not read out at all.
            //
            // It used to list eight and then count against twenty-five, so the
            // sentence underneath compared the purse to seventeen things the
            // player could not see. Either number can be right; having both on
            // screen cannot be.
            const shown = prices.slice(0, MARKET_LINES);
            lines.push(
                shown.length === prices.length
                    ? 'What is on offer, and what it costs here:'
                    : `What is nearest to hand, of ${prices.length} things on offer:`
            );
            for (const item of shown) {
                lines.push(`  ${item.name ?? 'unnamed'}, ${priceOf(item)}.`);
            }

            // Said once, about the purse, rather than eleven times about the
            // goods. Whether a bowl of millet is out of reach is a fact about
            // the player, and repeating it on every line turns a market board
            // into a wall of the same sentence.
            const purse = body.purse as { cash?: number; spiritStones?: number } | undefined;
            const afford = shown.filter(item => item.affordable !== false).length;
            if (purse) {
                lines.push(
                    afford === 0
                        ? `The purse holds ${describePurseCash(purse)}, which is not enough for anything here.`
                        : afford === shown.length
                            ? `The purse holds ${describePurseCash(purse)}, which covers all of that.`
                            : `The purse holds ${describePurseCash(purse)}: ${afford} of those ${shown.length} are within it.`
                );
            }
        }
        // Whether this ground can still take them anywhere is the one thing a
        // price board actually decides, and it is why leaving is a goal.
        if (body.groundHereStillGives === false) {
            lines.push(
                'Whatever else is true of this place, the ground here has nothing further to give ' +
                'somebody at this rank.'
            );
        }
    }

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
 * Put a hearing into both channels a player can reach it through.
 *
 * `lines` is the narrator's licence to have somebody say it. `prose` is the
 * zero-provider rendering, and a name that only existed in the prompt would
 * simply not happen for an operator running without a model - which would make
 * the whole mechanism a paid feature.
 */
function addHearing(facts: EngineFacts, hearing: Hearing): void {
    const fact = hearingFact(hearing);
    facts.lines.push(fact);
    facts.prose = `${facts.prose}

${fact}`;
}

/**
 * The fact of having heard a name, for the narrator's fact list.
 *
 * Says that a word was said and withholds everything else, because that is
 * genuinely all the player has. What the thing is does not travel with the
 * name, and stating it here would put the meaning in the narrator's hands one
 * sentence after the design took it out.
 */
function hearingFact(hearing: Hearing): string {
    return hearingProse(hearing);
}

export interface WorldReport {
    /** Narratable. Every line is already safe to name what it names. */
    lines: string[];
    /** Inspector only: the shape of what was withheld. */
    structure: string[];
}

/**
 * Turn a digest into the two channels the rest of this layer uses.
 *
 * The lines go to the narrator verbatim, because the world layer has already
 * done the redaction on its own side and doing it twice would only risk
 * disagreeing with it. The counts go to the inspector: how much of a span the
 * player never heard about is a fact about the simulation, and a curious player
 * can go and look, but it must not become a sentence in the prose. The moment
 * it does, "the world is mostly none of your business" becomes a status line.
 */
export function reportFromDigest(digest: PlayerDigest | null): WorldReport {
    if (!digest || digest.lines.length === 0) {
        return {
            lines: [],
            structure: digest
                ? [`World digest: nothing reached this cultivator. ${digest.unheard} event(s) passed unheard.`]
                : []
        };
    }

    return {
        lines: digest.lines.map(line => {
            const many = line.occurrences > 1 ? ` (${line.occurrences} times over the span)` : '';
            return `Year ${line.year}: ${line.text}${many}`;
        }),
        structure: [
            `World digest: ${digest.lines.length} line(s) reached this cultivator; ` +
            `${digest.unheard} event(s) reached them by no channel at all.`,
            ...digest.lines.map(line =>
                `  ${line.kind} via ${line.channel}, form=${line.form}, ` +
                `magnitude=${line.magnitude}, occurrences=${line.occurrences}.`)
        ]
    };
}

/**
 * What the world did while the player was busy, as inspectable rows.
 *
 * Only the structural half. The digest lines themselves are already in the
 * narration facts, and repeating them here would double every world event in
 * the play log.
 */
function worldCalls(world: WorldReport): ToolCallRecord[] {
    return world.structure.map(line => ({
        name: 'world.advanceWorldForPlay',
        action: 'world_time',
        summary: line,
        ok: true
    }));
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
        // The inspector gets the mechanical account, not the scene. A developer
        // reading this row wants to know exactly what failed to resolve; the
        // player already got the version where somebody looked at them blankly.
        calls: [{
            name,
            action,
            summary: facts.structure[0] ?? facts.headline,
            ok: false
        }]
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

