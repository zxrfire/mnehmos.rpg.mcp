/**
 * The long-simulation primitive.
 *
 * "I cultivate for ten years" must resolve in ONE deterministic pass, with no
 * per-day LLM involvement, and hand back an account the narrator can render.
 * That requirement drives the entire design of this file:
 *
 * ── Why it is not a per-day loop ──────────────────────────────────────────
 * 3650 iterations is not slow, but 3650 iterations that each allocate a rate
 * breakdown, an ambient sample and a death check is 3650 x garbage for a
 * result that is piecewise constant. Instead the simulation steps in ADAPTIVE
 * CHUNKS: at every point it computes the next day on which anything can
 * possibly change - the next deviation check, the next ambient refresh, the day
 * breakthrough eligibility is reached, the day lifespan runs out - and jumps
 * straight there. A ten-year skip lands in roughly 120 steps.
 *
 * ── Why chunking cannot change the outcome ────────────────────────────────
 * Every stochastic event is keyed to an ABSOLUTE DAY INDEX on a fixed grid, and
 * draws from `forStream(seed, <system>, day)`. The deviation check on day 900
 * is the same roll whether the simulation arrived there in one jump or three
 * hundred. Chunk boundaries are themselves pure functions of state. So the
 * chunking is an optimisation that provably cannot alter results - which is
 * what makes "same seed + same input => byte-identical result" testable rather
 * than aspirational.
 *
 * ── Why it stops early ────────────────────────────────────────────────────
 * A decade of unattended simulation that quietly killed you, or quietly walked
 * you past the sect elder who wanted to recruit you, is not a feature. Death, a
 * breakthrough that leaves a wound, a major encounter, and crossing the lethal
 * untreated-injury threshold all return control to the player with the skip
 * truncated and the reason stated.
 *
 * ── What the caller applies ───────────────────────────────────────────────
 * Pure: the input cultivator is never mutated. Everything the skip produced
 * comes back as data for the caller to persist, and none of it should ever be
 * recovered by reading the engine's own prose:
 *
 *   injuriesSustained  the real Injury records, ids and all, chronological
 *   tolls              what each boundary crossing took
 *   foundationEstablished  the foundation laid, if 12 -> 13 was crossed
 *   deltas             net change for the values where a delta is meaningful
 *   endState           absolute values for the three counters that RESET
 *   events             the digest, for the narrator and only for the narrator
 *
 * The split between `deltas` and `endState` is not cosmetic. Starvation turns
 * clear the moment there is food, the bleed clock clears the moment a wound is
 * closed, and years-at-realm returns to zero on any advance, so "before plus
 * delta" is not merely imprecise for those three, it is wrong. They are
 * reported absolute. Everything in `deltas` is a true net change that inverts
 * correctly.
 *
 * `events` are engine-authored summaries for a narrator to render. They are
 * NOT a data channel: a caller that parses a summary string to decide what to
 * write to the database has inverted the project's central rule, and will
 * silently break the next time someone rewords a sentence.
 */

import {
    BLEED_OUT_TURNS,
    LETHAL_UNTREATED_INJURIES,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    STARVATION_TURNS,
    HP_RECOVERY_FRACTION_PER_DAY,
    stagnationYearsForOrdinal,
    type AmbientQi,
    type Cultivator,
    type DeathCause,
    type Element,
    type FoundationQuality,
    type ImmortalStatus,
    type Achievement,
    type Insight,
    type Injury,
    type VisionSeed,
    type SimEvent,
    type SimEventKind,
    type TimeSkipResult,
    type TollResult
} from '../../schema/cultivation.js';
import { lifespanForOrdinal, rankName } from './realms.js';
import { getSpiritRoot } from './spirit-roots.js';
import { AMBIENT_REFRESH_DAYS, ambientForBlock, impliedDensityFor } from './ambient.js';
import {
    DAYS_PER_YEAR,
    computeCultivationRate,
    daysToNextBreakthrough,
    techniqueCeiling,
    type CultivationOptions
} from './cultivation.js';
import { attemptBreakthrough, canAttemptBreakthrough } from './breakthrough.js';
import type { RoadWithinReach } from './what-a-road-in-reach-costs-to-walk.js';
import type { FoundationConditions } from './foundation.js';
import type { TollConditions } from './toll.js';
import {
    INSIGHT_CHECK_DAYS,
    INSIGHT_FROM_CRIPPLING_DEVIATION,
    INSIGHT_FROM_TRIBULATION,
    VISION_CHECK_DAYS,
    VISION_KINDS,
    discoverableInsights,
    formInsight,
    formVision,
    integrateInsight,
    meditativeStateChance,
    recordAchievement,
    visionChance,
    type DiscoveryContext
} from './understanding.js';
import {
    AFFINITY_INITIAL_DEGREE,
    affinityFor,
    daoOf,
    isRecognition,
    pickNarrowed
} from './dao.js';
import { resolveDeviation, rollDeviation } from './deviation.js';
import { createInjury, untreatedInjuryCount } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
import {
    bleedOut,
    burnSatiety,
    eat,
    evaluateDeathConditions,
    satietyBurnMultiplier,
    stillNeedsToEat,
    turnsUntilBleedOut,
    turnsUntilStarvation
} from './survival.js';
import { forStream } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// EVENT CADENCE
// All three grids are multiples of the 30-day ambient block, which keeps the
// chunk boundaries sparse and the digest readable. Rates are per CHECK, not
// per day: a dual root's 0.08 innate deviation risk fires roughly once every
// three years of seclusion, which is a hazard. Fired daily it would be a
// death sentence inside a season.
// ─────────────────────────────────────────────────────────────────────────

/** Days between qi-deviation checks. */
export const DEVIATION_CHECK_DAYS = 30;
/** Days between "did something find you out here" checks. */
export const ENCOUNTER_CHECK_DAYS = 90;
/** Days between "did you stumble onto something" checks. */
export const OPPORTUNITY_CHECK_DAYS = 180;

/** Probability that an encounter check produces an encounter at all. */
export const ENCOUNTER_CHANCE = 0.2;
/** Of encounters, the fraction serious enough to interrupt seclusion. */
export const MAJOR_ENCOUNTER_FRACTION = 0.35;

// ─────────────────────────────────────────────────────────────────────────
// FORTUNE
//
// Luck generates opportunity, not success. Fortune appears in this file and
// almost nowhere else, because event generation is the only place it belongs.
//
// THE RULE, and it is narrow: Fortune may influence WHICH of the branches the
// world already permits occurs, and WHEN. It biases timing, presence,
// availability and coincidence. It must never manufacture a branch, never
// soften a resolution, and never reach into a probability that represents a
// real capability gap.
//
// Legitimate:   the patrol arrives twenty minutes later; the herb happens to
//               grow nearby; the elder takes the other road; the treasure has
//               not already been taken; the window is still open.
// Illegitimate: an encounter the world says is lethal resolves as survivable;
//               a weak cultivator's luck kills a strong one; an outcome that
//               contradicts an established fact or a capability threshold.
//
// Concretely, below: Fortune moves whether an opportunity is DRAWN, whether it
// is still AVAILABLE when reached, and whether a passing danger ARRIVES on top
// of the cultivator or goes past. Once something has arrived, Fortune has no
// further say - it does not touch the damage, the severity, the deviation
// roll, the breakthrough, or the tribulation.
// ─────────────────────────────────────────────────────────────────────────

/** Base probability of an opportunity being drawn, before Fortune. */
export const OPPORTUNITY_BASE_CHANCE = 0.1;
/**
 * Added opportunity probability per point of Fortune. Weighted heavily: this
 * is where Fortune earns its place on the character sheet, now that it has
 * been taken out of breakthrough odds and tribulation survival.
 */
export const OPPORTUNITY_PER_FORTUNE = 0.1;

/**
 * Chance a drawn opportunity has already been taken, or the window has already
 * closed, by the time the cultivator gets to it. Falls with Fortune: "arriving
 * four days late" is exactly what low Fortune means.
 */
export const OPPORTUNITY_MISSED_BASE = 0.4;
export const OPPORTUNITY_MISSED_PER_FORTUNE = -0.11;

/**
 * Chance that a minor disturbance passes by instead of landing on the
 * cultivator. This is presence and timing - whether the thing arrives at all -
 * and NOT a reduction in what it does once it has.
 */
export const DISTURBANCE_PASSES_BASE = 0.15;
export const DISTURBANCE_PASSES_PER_FORTUNE = 0.12;

/**
 * Chance that a major encounter arrives at a moment the cultivator can simply
 * withdraw from: the elder took the other road, the patrol is facing the wrong
 * way. It changes whether the confrontation happens, never who would win it.
 * The encounter still interrupts either way, and any fight that does happen is
 * resolved by the combat layer at full strength.
 */
export const CLEAN_WITHDRAWAL_BASE = 0.1;
export const CLEAN_WITHDRAWAL_PER_FORTUNE = 0.12;

/** Fortune clamped to its legal 0..3 range, defensively. */
function fortuneOf(attributes: { fortune: number }): number {
    const f = attributes.fortune;
    return Number.isFinite(f) ? Math.max(0, Math.min(3, f)) : 0;
}

/** Hard iteration ceiling. A safety net against a future edit that stalls the
 *  chunker; it should never be reached, and the simulation reports it if it is. */
const MAX_ITERATIONS = 100_000;

// ─────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────

export interface TimeSkipContext {
    /** The run seed. Every sub-stream in the skip derives from this. */
    seed: string;
    /** Where the cultivator is sitting. Drives location-stable ambient qi. */
    locationId: string;
    /**
     * USABLE qi at that location, 0..1 - the world layer's `spiritualDensity`.
     * The month's ambient varies AROUND this rather than being drawn from a
     * global distribution, which is what keeps a thin province thin and stops
     * a decade of seclusion quietly becoming a decade somewhere else.
     *
     * Omitted falls back to the old unanchored draw, which is the
     * unknown-location path and should not be taken by anyone who has a map.
     */
    locationDensity?: number;
    /** The location is a sealed pocket nothing has drawn on. */
    sealed?: boolean;
    /**
     * The identity this cultivator's PER-CULTIVATOR draws are keyed on.
     *
     * Four things in this file derive a stream from who the cultivator is
     * rather than only from the run: the latent affinity behind prodigy
     * recognition, the recognition gate itself, the narrowed pick among
     * candidates, and the 0.2 suitability draw that decides which
     * comprehensions are takeable at all. All four keyed on `cultivator.id`,
     * and a played run's row id is a `randomUUID()` - so the same seed
     * produced different prodigies, different roads and different
     * comprehension, which breaks the charter line that a seed is a life.
     *
     * It was LATENT rather than new: until `ctx.understanding` was populated
     * the candidate set was always empty, so nothing downstream of it ever
     * ran. It started mattering the moment that field was wired up.
     *
     * Mirrors `EncounterRequest.rollIdentity` in `src/web/encounters.ts`
     * deliberately, rather than inventing a second convention for the same
     * problem - the encounter layer hit this first and its answer is the
     * house answer. Same rule applies here: a caller with a genuinely stable
     * id (an NPC out of the catalog, a fixture) should leave this alone and
     * get the old behaviour, and a caller whose id is random must pass
     * something seed-stable.
     *
     * DEFAULTS TO `cultivator.id`, which is correct for every caller whose id
     * is already stable and preserves their results exactly.
     */
    rollIdentity?: string;
    /** Turn number the skip begins on, stamped onto injuries. */
    turn?: number;
    /** Absolute in-world day the skip begins on, so grids line up across skips. */
    startDay?: number;
    /** Rate multipliers - manual, sect, site, focus. */
    options?: CultivationOptions;
    /**
     * Element of the art being cultivated throughout. `null` for elementless
     * qi-gathering, which any root practises safely.
     */
    techniqueElement?: Element | null;
    /** Days of provisions carried. Each ration refills satiety to full. */
    rations?: number;
    /**
     * The cultivator is on grain abstinence (辟穀) and does not eat. Without
     * this, or a very large ration stock, a multi-year skip ends in starvation
     * around day 55 - which is correct, and is why the pill exists.
     */
    grainAbstinence?: boolean;
    /** Attempt breakthroughs automatically when eligible. Default true. */
    autoBreakthrough?: boolean;
    /** Roll encounters and opportunities. Default true. */
    randomEvents?: boolean;
    /**
     * Scales how often those rolls land, without switching them off. Default 1.
     *
     * A shut door is not a ward, and it is also not nothing - the two facts
     * only fit together on a dial. `randomEvents` alone could say "the world
     * reaches you" or "the world does not exist", and closed-door seclusion is
     * neither: it is the world reaching you at a small fraction of the usual
     * rate. Callers pass `sealedDoorFraction()` rather than a number of their
     * own.
     *
     * Note that this scales the THRESHOLD and never skips a draw. Every sample
     * below is taken unconditionally to keep the stream aligned across
     * cultivators; sealing must not shift what anybody else would have rolled.
     */
    randomEventScale?: number;
    /**
     * Conditions for the price of advancement at any realm boundary crossed during the
     * skip. The candidate list must come from real rows - the engine holds no
     * database - so a caller that omits it will see the crossing find nothing
     * worth taking, which is a visible result rather than a silent skip.
     */
    toll?: TollConditions;
    /**
     * Conditions for the foundation, if the skip crosses 12 -> 13. A decade of
     * unattended seclusion is by definition an unhurried crossing, but the
     * caller still owns whether a site was chosen and a pill was bought.
     */
    foundation?: Omit<FoundationConditions, 'ambient'>;
    /**
     * What the cultivator is doing and where, for understanding. Supplied by
     * the caller from real world state - the engine holds no map and no
     * technique table. Omitted means "sitting in a cave practising nothing in
     * particular", for which the insight chance is exactly zero.
     */
    understanding?: Omit<DiscoveryContext, 'survived'>;
    /**
     * Roads the WORLD has put within this cultivator's reach - ground they can
     * stand on, a carving they can read, a spent material, an object fit for
     * their path. Not the arts in their hands: the gate reads those off
     * `knownTechniques` itself, for a player and an NPC alike.
     *
     * The caller supplies it because the engine holds no map, exactly as
     * `understanding` and `thresholds` are supplied. `discoveryContextFor` in
     * `server/consolidated/cultivation-support.ts` builds it from the same rows
     * it builds `daoGrounds` from, so the thing a player can COMPREHEND at a
     * place and the thing that place lets them WALK cannot disagree.
     *
     * Omitted means the world put nothing in reach, which is the honest answer
     * for a caller with no world and the right one for a test harness.
     */
    roadsWithinReach?: readonly RoadWithinReach[];
    /**
     * What standing here does to a body that has no business being here.
     *
     * The four location thresholds - entry, survival, operational, mastery -
     * have existed and been calibrated across every place in the world for a
     * long time, and nothing read them at the point where somebody was
     * actually standing somewhere. Measured: an ordinal 0 cultivator was put
     * inside a compound whose survival bar is 19, cultivated for seven months,
     * gained a full rank, and was never touched. The bars said "below survival
     * you get in and die" and the simulation had no way to make that true.
     *
     * This is that way. The caller - which is the only layer with a map - reads
     * the location, prices the gap, and hands the result down as two numbers
     * and a reason. The engine holds no map and still does not.
     *
     * Death is NOT decided here. Damage lands on HP like any other damage and
     * `survival.ts` remains the only place a run ends.
     */
    hostility?: {
        /**
         * Fraction of max HP the place takes per day, 0..1. Zero for ground
         * they can survive; large for ground rungs above their survival bar.
         */
        dailyHpFraction: number;
        /**
         * The ground is above what they can work in: alive, and useless.
         * Progress does not accrue while this is true - which is the
         * `survival <= x < operational` band, stated as arithmetic.
         */
        inert: boolean;
        /** Engine-authored reason, stamped on the event the damage raises. */
        reason: string;
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE SIMULATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Simulate `days` of elapsed time for one cultivator.
 *
 * Returns a `TimeSkipResult`: how many days were actually simulated, whether
 * something interrupted, the chronological event digest, and the net deltas.
 */
export function simulateTimeSkip(
    cultivator: Cultivator,
    days: number,
    ctx: TimeSkipContext
): TimeSkipResult {
    const requestedDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    const turn = Math.max(0, Math.floor(ctx.turn ?? 0));
    /**
     * The turn this whole stretch resolves on.
     *
     * A seclusion is ONE turn however many years it covers, and `applyTimeSkip`
     * books the result as `run.turn + 1`. Every record minted inside the loop
     * used to be stamped `turn + Math.floor(elapsed)` instead - a turn number
     * plus a day count, two different units added together. Played live: a run
     * standing on turn 31 carried an injury stamped `sustainedOnTurn: 73`,
     * which is 31 plus the 42 days that had elapsed when the deviation landed,
     * and reads as a wound taken forty-two turns in the future.
     *
     * The day is not lost by this: achievements carry `onDay` and every event
     * carries its absolute day. It was only ever the turn that was wrong, and
     * a turn is the only thing these fields are.
     */
    const resolvesOnTurn = turn + 1;

    /**
     * Roads the world has put in reach, in the shape the dao gate reads.
     *
     * Taken from `ctx.roadsWithinReach` when a caller supplies it, and
     * otherwise DERIVED from the dao grounds already sitting in
     * `ctx.understanding`. The derivation is not a convenience: `src/web/game.ts`
     * builds its context with `discoveryContextFor(...).context` and passes only
     * that, so a new top-level field would have reached the MCP tool surface and
     * never the played game - which is precisely the world-binds-one-side split
     * this whole change exists to close, reintroduced one layer down.
     *
     * The two lists are the same facts. `daoGrounds` says what a place puts
     * within reach to COMPREHEND; this says what it puts within reach to WALK,
     * and they must never be able to disagree about which places those are.
     */
    const roadsWithinReach: readonly RoadWithinReach[] =
        ctx.roadsWithinReach
        ?? (ctx.understanding?.daoGrounds ?? []).map(ground => ({
            domain: ground.domain,
            subject: ground.subject,
            sourceId: ground.id ?? ground.label,
            sourceName: ground.label,
            how: ground.how ?? 'ground_open'
        }));
    const startDay = Math.max(0, Math.floor(ctx.startDay ?? 0));
    const autoBreakthrough = ctx.autoBreakthrough ?? true;
    // Every per-cultivator stream in this file keys on THIS, never on the row
    // id directly. See `TimeSkipContext.rollIdentity`.
    const identity = ctx.rollIdentity ?? cultivator.id;
    const randomEvents = ctx.randomEvents ?? true;
    const eventScale = Math.min(1, Math.max(0, ctx.randomEventScale ?? 1));
    const grainAbstinence = ctx.grainAbstinence ?? false;
    const hostility = ctx.hostility;

    // ── Working state. A shallow copy; the input is never touched. ──
    const startAge = cultivator.age;
    const startYearsAtRealm = cultivator.yearsAtCurrentRealm;

    let ordinal = cultivator.realmOrdinal;
    let progress = cultivator.cultivationProgress;
    let hp = cultivator.hp;
    const qi = cultivator.qi;
    let satiety = cultivator.satiety;
    let starvationTurns = cultivator.starvationTurns;
    let bleedingTurns = cultivator.bleedingTurns;
    let injuries: Injury[] = [...cultivator.injuries];
    let spiritStones = cultivator.spiritStones;
    let rations = Math.max(0, Math.floor(ctx.rations ?? 0));
    /** May be set during the skip, if it crosses Foundation Establishment. */
    let foundation: FoundationQuality = cultivator.foundationQuality ?? 'none';
    /** May be set during the skip, if it resolves the last crossing. */
    let immortalStatus: ImmortalStatus = cultivator.immortalStatus ?? 'none';
    /** Everything the crossings took during the skip, for the caller to apply. */
    const tolls: TollResult[] = [];
    /** Remarkable things that actually happened, and what was taken from them. */
    const achievements: Achievement[] = [];
    const insightsGained: Insight[] = [];
    /** Beliefs with no ground truth behind them, for the knowledge layer. */
    const visions: VisionSeed[] = [];
    let insights: Insight[] = [...(cultivator.insights ?? [])];

    /** Integer day counters. Ages are derived from these, never accumulated,
     *  so a thousand chunks introduce no float drift. */
    let elapsed = 0;
    let daysSinceAdvance = 0;
    /** Years-at-realm at the last advance; reset to 0 when a rank is gained. */
    let realmClockBase = startYearsAtRealm;

    /**
     * The ground under this place, resolved once.
     *
     * Geology does not change during a seclusion, and re-deriving it on every
     * chunk meant seeding a fresh PRNG a hundred-odd times per simulated
     * decade - which tripled the cost of a skip for a value that is constant.
     */
    const groundDensity = ctx.locationDensity ?? impliedDensityFor(ctx.seed, ctx.locationId);

    const events: SimEvent[] = [];
    let interrupted = false;
    let interruptReason: string | null = null;
    let died = false;
    let deathCause: DeathCause | null = null;
    /**
     * What took the last point of HP, when it was not violence.
     *
     * `survival.ts` reads an empty bar as `combat_defeat` unless somebody who
     * watched it empty says otherwise, and a seclusion is the one place where
     * nothing is hitting anybody. Played live: a cultivator sat down, took
     * three qi deviations over the stretch, died of them, and went into the
     * death ledger as "killed in combat" in a run containing no combat at all.
     *
     * Set only by the loss that actually reaches zero, so a deviation in year
     * one cannot put its name on a bandit in year nine.
     */
    let hpDepletedBy: DeathCause | null = null;
    /** Fractional HP mended but not yet whole. See the recovery block below. */
    let mending = 0;
    /**
     * Every wound the skip produced, in the order it happened. This is the
     * authoritative record the caller persists; `deltas.injuriesGained` is
     * derived from its length so the two can never disagree.
     */
    const sustained: Injury[] = [];
    /** Ranks gained on the current day, enforcing MAX_RANKS_PER_TURN. */
    let ranksOnDay = 0;
    let ranksOnDayFor = -1;
    let depletionAnnounced = false;
    /**
     * Seeded from the entry state, not from false.
     *
     * The interrupt is for ENTERING starvation. A cultivator who begins a skip
     * already starving has been told once and chose to continue, and stopping
     * them again every five days would mean they could never actually die of
     * it - which would turn a real consequence into a nag.
     */
    let starvationAnnounced =
        !stillNeedsToEat(cultivator.realmOrdinal) ||
        (cultivator.satiety <= 0 && (ctx.rations ?? 0) <= 0);
    /**
     * Seeded from the entry state, exactly as starvation is.
     *
     * The interrupt is for ENTERING the bleed. Somebody who began the skip
     * already at the lethal untreated count has been told, and chose to sit
     * down anyway; stopping them every chunk would mean they could never
     * actually bleed out, which is the trap this whole clock exists to open.
     */
    let bleedAnnounced = untreatedInjuryCount(cultivator.injuries) >= LETHAL_UNTREATED_INJURIES;

    const push = (
        kind: SimEventKind,
        summary: string,
        interrupts: boolean,
        data: Record<string, unknown> = {}
    ): void => {
        // Identical lines collapse. A forty-year seclusion that reports the
        // same warning six times has buried whatever else it said, and the one
        // thing a digest must not do is hide the line that mattered.
        const existing = events.find(e => e.kind === kind && e.summary === summary);
        if (existing) {
            existing.occurrences++;
            existing.data = { ...existing.data, lastDayOffset: elapsed };
            return;
        }
        events.push({ kind, dayOffset: elapsed, summary, interrupts, occurrences: 1, data });
    };

    // Two flavours of the same clock, deliberately.
    //
    // `raw*` is used to compute how many days remain before a threshold: it
    // must not be rounded, because rounding DOWN by half a microsecond makes
    // the remaining distance look a fraction of a day longer and the chunker
    // then steps one day past the threshold.
    //
    // `current*` is rounded and is what the death check and the returned deltas
    // see: `Math.ceil` on the day count can land a few nanoseconds short of the
    // threshold, and rounding to the nearest microsecond snaps that back onto
    // the documented number so death fires exactly ON it.
    const rawAge = (): number => startAge + elapsed / DAYS_PER_YEAR;
    const rawYearsAtRealm = (): number => realmClockBase + daysSinceAdvance / DAYS_PER_YEAR;
    const currentAge = (): number => roundYears(rawAge());
    const currentYearsAtRealm = (): number => roundYears(rawYearsAtRealm());

    const snapshot = () => ({
        realmOrdinal: ordinal,
        cultivationProgress: progress,
        spiritRoot: cultivator.spiritRoot,
        attributes: cultivator.attributes,
        foundationQuality: foundation,
        insights,
        // THE TWO FIELDS THE DAO GATE READS BESIDES `insights`, and they have
        // to travel with every subject built in this file or the player is
        // back on a rule of their own. Comprehension is no longer only what
        // survived something: an art practised for years and ground stood on
        // for years walk a road too, by the same function the world layer
        // asks - see `what-a-road-in-reach-costs-to-walk.ts`. Before this the
        // player's list held only event-formed insights, which measured
        // between 0.6% and 3.4% a year, and every completed playtest run
        // ended with `insights: []` while every NPC was handed one per art at
        // birth.
        knownTechniques: cultivator.knownTechniques,
        roadsWithinReach,
        immortalStatus,
        name: cultivator.name,
        injuries,
        hp,
        maxHp: cultivator.maxHp,
        satiety,
        starvationTurns,
        bleedingTurns,
        age: currentAge(),
        yearsAtCurrentRealm: currentYearsAtRealm(),
        alive: true as const
    });

    const checkDeath = (): boolean => {
        const cause = evaluateDeathConditions(
            snapshot(),
            hpDepletedBy ? { hpDepletedBy } : {}
        );
        if (cause === null) return false;
        died = true;
        deathCause = cause;
        interrupted = true;
        interruptReason = `death:${cause}`;
        push('death', deathSummary(cause, cultivator.name, ordinal, currentAge()), true, { cause });
        return true;
    };

    /**
     * Turn something that actually happened into an achievement, and possibly
     * into understanding.
     *
     * Every call site is a place where the simulation had ALREADY resolved
     * something out of the ordinary. Nothing here fires on a schedule, and
     * there is no path into this function that a cultivator can reach by
     * spending time or stones. If the cultivator's circumstances open no
     * candidate comprehension, the achievement is still recorded and no
     * insight comes of it - which is the ordinary case.
     */
    const comprehend = (
        kind: Parameters<typeof recordAchievement>[0]['kind'],
        summary: string,
        absDay: number,
        survived: DiscoveryContext['survived'],
        rng: ReturnType<typeof forStream>,
        detail: Record<string, string | number> = {}
    ): void => {
        const candidates = discoverableInsights({ ...cultivator, id: identity, insights }, {
            ...(ctx.understanding ?? {}),
            survived,
            // Suitability is live in play: what is in reach is filtered by what
            // this particular cultivator can take out of it.
            runSeed: ctx.seed,
            affinityOf: target => affinityFor(ctx.seed, identity, target)
        });
        const achievement = recordAchievement(
            { kind, onDay: absDay, turn: resolvesOnTurn, summary, detail },
            rng
        );
        achievements.push(achievement);
        push('achievement', summary, false, { kind, achievementId: achievement.id });

        if (candidates.length === 0) return;
        // A road already walked bends which of these arrives, and a latent
        // affinity bends it further - but only among candidates ACCESS has
        // already put in reach. Consumes exactly one sample, same as a uniform
        // pick, so nothing downstream shifts.
        const candidate = pickNarrowed(rng, candidates, daoOf(insights), {
            runSeed: ctx.seed,
            cultivatorId: identity
        });
        const integrated = integrateInsight(insights, candidate, achievement);
        insights = integrated.insights;
        insightsGained.push(integrated.insight);
        push(
            'insight_gained',
            `Understanding: ${integrated.insight.subject} ` +
            `${integrated.deepened ? 'deepened' : 'comprehended'} - ${candidate.opening}.`,
            false,
            {
                insightId: integrated.insight.id,
                domain: integrated.insight.domain,
                subject: integrated.insight.subject,
                degree: integrated.insight.degree,
                deepened: integrated.deepened,
                accessKind: candidate.access.kind,
                accessLabel: candidate.access.label
            }
        );
    };

    let iterations = 0;
    while (elapsed < requestedDays && !interrupted) {
        if (++iterations > MAX_ITERATIONS) {
            interrupted = true;
            interruptReason = 'iteration_limit';
            break;
        }

        const absDay = startDay + elapsed;

        // ── 1. Breakthrough, if the accumulated progress permits one. ──
        if (ranksOnDayFor !== absDay) {
            ranksOnDayFor = absDay;
            ranksOnDay = 0;
        }
        const ambient = ambientForBlock(ctx.seed, ctx.locationId, absDay, {
            density: groundDensity,
            sealed: ctx.sealed
        });

        if (autoBreakthrough) {
            const eligibility = canAttemptBreakthrough(
                {
                    realmOrdinal: ordinal,
                    cultivationProgress: progress,
                    alive: true,
                    spiritRoot: cultivator.spiritRoot,
                    insights,
                    // See `snapshot` - the gate reads all three of these.
                    knownTechniques: cultivator.knownTechniques,
                    roadsWithinReach,
                    age: currentAge(),
                    // A False Immortal is refused here for the rest of the
                    // skip, so the loop stops re-attempting the last crossing.
                    immortalStatus
                },
                { ranksGainedThisTurn: ranksOnDay }
            );
            if (eligibility.eligible) {
                const result = attemptBreakthrough(snapshot(), {
                    rng: forStream(ctx.seed, 'breakthrough', absDay, ordinal),
                    ambient,
                    turn: resolvesOnTurn,
                    ranksGainedThisTurn: ranksOnDay,
                    toll: ctx.toll,
                    foundation: ctx.foundation
                });

                progress = Math.max(0, progress - result.progressConsumed);
                // Every breakthrough outcome that wounds contributes here -
                // failure_injured, failure_deviation, a fatal rupture, and the
                // burns from a survived tribulation. This is the path callers
                // used to recover by scraping a severity word out of the
                // narration hint; they now get the records themselves.
                if (result.injuriesSustained.length > 0) {
                    injuries = [...injuries, ...result.injuriesSustained];
                    sustained.push(...result.injuriesSustained);
                }

                if (result.outcome === 'success') {
                    ordinal = result.toOrdinal;
                    ranksOnDay++;
                    daysSinceAdvance = 0;
                    realmClockBase = 0;
                    if (result.foundationEstablished !== null) {
                        foundation = result.foundationEstablished;
                    }
                    if (result.immortalStatusGained !== null) {
                        immortalStatus = result.immortalStatusGained;
                    }
                    // Standing under heavenly lightning and still being there
                    // afterwards is the definition of surviving something
                    // extraordinary. It is rolled, and it usually teaches
                    // nothing - but this is an event that genuinely occurred.
                    if (result.tribulation !== null && result.tribulation.survived) {
                        const rng = forStream(ctx.seed, 'understanding', absDay, 'tribulation');
                        if (rng.chance(INSIGHT_FROM_TRIBULATION)) {
                            comprehend(
                                'survived_extraordinary',
                                `Weathered ${result.tribulation.strikes} strikes of heavenly ` +
                                'tribulation and was still standing afterwards.',
                                absDay,
                                'tribulation',
                                rng,
                                { strikes: result.tribulation.strikes }
                            );
                        }
                    }
                    push('breakthrough_success', result.narrationHint, false, {
                        fromOrdinal: result.fromOrdinal,
                        toOrdinal: result.toOrdinal,
                        finalChance: result.finalChance,
                        tribulation: result.tribulation,
                        foundationEstablished: result.foundationEstablished,
                        immortalStatusGained: result.immortalStatusGained
                    });

                    // The price of the crossing gets its own line in the digest.
                    // A crossing that cost someone a brother must not be a
                    // footnote inside a success message.
                    if (result.toll !== null) {
                        tolls.push(result.toll);
                        const took = result.toll.outcome === 'taken';
                        push('toll_charged', result.toll.narrationHint, took, {
                            outcome: result.toll.outcome,
                            boundaryIndex: result.toll.boundaryIndex,
                            risk: result.toll.risk,
                            taken: result.toll.taken
                        });
                        if (took) {
                            // Losing a person, a memory or an art is not
                            // something a player should read about ten years
                            // later in a list. Hand control back.
                            interrupted = true;
                            interruptReason = 'toll_charged';
                            break;
                        }
                    }
                    continue;
                }

                if (result.outcome === 'death') {
                    died = true;
                    deathCause = result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough';
                    interrupted = true;
                    interruptReason = `death:${deathCause}`;
                    push('breakthrough_failure', result.narrationHint, true, {
                        fromOrdinal: result.fromOrdinal,
                        finalChance: result.finalChance
                    });
                    push('death', deathSummary(deathCause, cultivator.name, ordinal, currentAge()), true, {
                        cause: deathCause
                    });
                    break;
                }

                // A survivable failure. Only a wounding one interrupts - a
                // clean failure is just a lost season and the skip continues.
                const wounded = result.injuriesSustained.length > 0;
                push('breakthrough_failure', result.narrationHint, wounded, {
                    fromOrdinal: result.fromOrdinal,
                    finalChance: result.finalChance,
                    outcome: result.outcome
                });
                if (wounded) {
                    interrupted = true;
                    interruptReason = `breakthrough_${result.outcome}`;
                    break;
                }
                continue;
            }
        }

        // ── 2. How far can we safely jump? ──
        //
        // `ordinal` rather than `cultivator.realmOrdinal`: the LIVE rung, which
        // a skip that advances ranks changes underneath itself. Passing the
        // entry ordinal would price a forty-year seclusion at the realm the
        // cultivator walked in at, which is the whole thing this term is for.
        const rate = computeCultivationRate(
            {
                spiritRoot: cultivator.spiritRoot,
                injuries,
                foundationQuality: foundation,
                insights,
                realmOrdinal: ordinal
            },
            ambient,
            {
                ...ctx.options,
                techniqueElement: ctx.techniqueElement ?? null,
                techniqueSubject: ctx.understanding?.techniqueSubjects?.[0] ?? null
            }
        );

        // ── 2b. Say it, if there is no book. ──
        //
        // The one fact a stalled cultivator most needs and was never given.
        // Eleven of twelve measured lives sat through fifty years of correct
        // play, took injuries, aged, and died of stagnation at ordinal 0
        // without the digest once mentioning that they were practising no
        // method - because an absence generates no event of its own, so
        // nothing was there to hang the sentence off.
        //
        // Pushed rather than returned only, because the person sitting in the
        // cave is reading the digest and not an inspector. `push` collapses
        // identical lines, so a forty-year seclusion says it once.
        //
        // It does NOT interrupt. Being told is not a reason to stop the
        // seclusion out from under a player who may have chosen it knowingly,
        // and an interrupt every chunk would make a stalled cultivator unable
        // to pass time at all.
        const ceiling = techniqueCeiling(ordinal, ctx.options?.techniqueCap);
        if (ceiling.line !== null) {
            push(
                'method_ceiling',
                ceiling.line,
                false,
                { state: ceiling.state, techniqueCap: ctx.options?.techniqueCap ?? null }
            );
        }

        const chunk = nextChunk({
            elapsed,
            absDay,
            requestedDays,
            breakthroughDays: autoBreakthrough
                ? daysToNextBreakthrough(
                      {
                          realmOrdinal: ordinal,
                          cultivationProgress: progress,
                          spiritRoot: cultivator.spiritRoot,
                          insights
                      },
                      rate.perDay
                  )
                : Infinity,
            lifespanDays: daysUntilYear(lifespanForOrdinal(ordinal), rawAge()),
            stagnationDays: daysUntilYear(stagnationYearsForOrdinal(ordinal), rawYearsAtRealm()),
            starvationDays:
                grainAbstinence || rations > 0
                    ? Infinity
                    : turnsUntilStarvation({ satiety, starvationTurns }),
            emptyBellyDays:
                grainAbstinence || rations > 0
                    ? Infinity
                    : Math.floor(satiety / SATIETY_COST_PER_ACTION),
            bleedOutDays: turnsUntilBleedOut({
                untreatedInjuries: untreatedInjuryCount(injuries),
                bleedingTurns
            }),
            randomEvents
        });

        // ── 3. Apply the chunk. ──
        //
        // Ground they cannot work in gives up nothing, however long they sit in
        // it. That is the `survival <= x < operational` band from `locations.ts`
        // - alive, standing in the vault, unable to open anything - and it is
        // the reason better ground is a decision rather than a free upgrade.
        progress += (hostility?.inert ? 0 : rate.perDay) * chunk;
        elapsed += chunk;
        daysSinceAdvance += chunk;

        // What the place itself takes. Applied on the same days everything else
        // is, before the food and bleed clocks resolve, so a chunk that ends in
        // death ends in death from the first cause that reaches zero.
        if (hostility && hostility.dailyHpFraction > 0 && hp > 0) {
            const taken = Math.min(
                hp,
                Math.max(1, Math.round(cultivator.maxHp * hostility.dailyHpFraction * chunk))
            );
            hp -= taken;
            interrupted = true;
            interruptReason = 'hostile_ground';
            push(
                'injury_sustained',
                `${hostility.reason} ${taken} HP over ${chunk} day${chunk === 1 ? '' : 's'}, `
                + `and it does not stop while they stay. ${hp} HP left.`,
                true,
                { environmental: true, damage: taken, hpRemaining: hp }
            );
            if (hp <= 0) break;
        }

        // The bleed clock runs on the same days everything else does, and it
        // runs unconditionally - before the food block, which can break out of
        // the loop, and with no grain-abstinence escape, because a pill that
        // means you need not eat does not close a torn meridian.
        //
        // One call for the whole stretch is exact: the untreated count cannot
        // change inside a chunk, since injuries are only minted by the grid
        // checks below and those land on chunk boundaries.
        bleedingTurns = bleedOut(
            { untreatedInjuries: untreatedInjuryCount(injuries), bleedingTurns },
            chunk
        ).bleedingTurns;

        // ── THE BODY MENDS ──────────────────────────────────────────────
        //
        // HP only ever went down, and it killed people who were not in any
        // danger. Measured: ordinal 13, age 38 of 100, full belly, ZERO
        // injuries, killed by a 3 HP scratch the engine's own line says nothing
        // followed - because the running total from every prior seclusion had
        // never come back up. See HP_RECOVERY_FRACTION_PER_DAY for the ruling.
        //
        // Three gates, and each is a system that already existed:
        //
        //   at the lethal untreated count - the meridians are open and the
        //     bleed clock is running. "Unless you are so injured you are slowly
        //     dying" is the owner's own exception, and this is it. Nothing
        //     closes a torn channel on its own and nothing here pretends to.
        //   at zero satiety - a body with nothing to eat does not mend. It is
        //     already spending itself.
        //   at zero HP - the death gate below owns that, and a body cannot mend
        //     its way back across it inside the chunk that emptied it.
        //
        // The carry is a float so the arithmetic is exact across chunk
        // boundaries: half a point a day over a 30-day grid must be fifteen
        // points, not thirty roundings of zero. It is dropped whenever
        // recovery is blocked, because a body that stopped mending has not been
        // quietly banking it.
        const mendingBlocked =
            hp <= 0
            || untreatedInjuryCount(injuries) >= LETHAL_UNTREATED_INJURIES
            || (stillNeedsToEat(ordinal) && satiety <= 0);
        if (mendingBlocked) {
            mending = 0;
        } else if (hp < cultivator.maxHp) {
            mending += cultivator.maxHp * HP_RECOVERY_FRACTION_PER_DAY * chunk;
            const whole = Math.floor(mending);
            if (whole > 0) {
                mending -= whole;
                hp = Math.min(cultivator.maxHp, hp + whole);
            }
        }

        if (!grainAbstinence) {
            const fed = consumeFood(chunk, { satiety, starvationTurns, rations }, cultivator.realmOrdinal);
            satiety = fed.satiety;
            starvationTurns = fed.starvationTurns;
            rations = fed.rations;

            // ── A resource is about to run out and something can still be
            // done about it. ──
            //
            // This is its own category of interrupt, and it was missing. Every
            // other interrupt is a thing that HAPPENED to the cultivator -
            // death, a wound, someone arriving. This one is a thing that is
            // ABOUT to happen and is trivially preventable: the player has
            // stones, there is a settlement, and buying food is solved. They
            // were simply never asked.
            //
            // The skip must not be the one place a player dies without a
            // decision. Starving to death stays entirely possible - a player
            // told the food is gone who presses on anyway has earned it - but
            // it has to be a choice they declined rather than one they never
            // got.
            if (rations === 0 && !depletionAnnounced && fed.rationsUsed > 0) {
                depletionAnnounced = true;
                interrupted = true;
                interruptReason = 'provisions_exhausted';
                push(
                    'resource_depleted',
                    'The last of the provisions is gone. ' +
                    `There is food for about ${Math.floor(satiety / SATIETY_COST_PER_ACTION)} more days, ` +
                    `and ${STARVATION_TURNS} days beyond that before it kills.`,
                    true,
                    { rations: 0, satiety, daysOfFoodLeft: Math.floor(satiety / SATIETY_COST_PER_ACTION) }
                );
                break;
            }

            // Entering starvation proper: no belly and nothing to put in it.
            // Announced ONCE. Somebody on grain abstinence, or with rations in
            // hand, is fine and is not stopped - and the belly touching zero at
            // a chunk boundary with food still in the pack is not news at all,
            // which is what produced six identical warnings in one digest.
            if (satiety === 0 && rations === 0 && !starvationAnnounced) {
                starvationAnnounced = true;
                interrupted = true;
                interruptReason = 'starvation_begun';
                push(
                    'starvation_warning',
                    `Nothing left to eat. ${STARVATION_TURNS} days of this is fatal.`,
                    true,
                    { starvationTurns }
                );
                break;
            }
        }

        const newAbsDay = startDay + elapsed;

        // ── 4. Grid checks that land exactly on this day. ──
        if (onGrid(newAbsDay, DEVIATION_CHECK_DAYS)) {
            const check = rollDeviation(
                { spiritRoot: cultivator.spiritRoot, injuries },
                forStream(ctx.seed, 'deviation', newAbsDay),
                {
                    techniqueElement: ctx.techniqueElement ?? null,
                    overfullProgress: canAttemptBreakthrough({
                        realmOrdinal: ordinal,
                        cultivationProgress: progress,
                        spiritRoot: cultivator.spiritRoot,
                        insights,
                        knownTechniques: cultivator.knownTechniques,
                        roadsWithinReach,
                        age: currentAge(),
                        alive: true
                    }).eligible
                }
            );
            if (check.deviated) {
                const resolution = resolveDeviation(
                    { cultivationProgress: progress, hp, maxHp: cultivator.maxHp },
                    forStream(ctx.seed, 'deviation_resolve', newAbsDay),
                    { turn: resolvesOnTurn }
                );
                progress = Math.max(0, progress - resolution.progressLost);
                hp = Math.max(0, hp - resolution.hpLost);
                // The turning qi is what emptied the bar, and it is the only
                // caller in a position to say so. See `hpDepletedBy`.
                if (hp <= 0 && resolution.hpLost > 0) hpDepletedBy = 'qi_deviation';
                injuries = [...injuries, ...resolution.injuries];
                sustained.push(...resolution.injuries);
                push('qi_deviation', resolution.summary, false, {
                    severity: resolution.severity,
                    risk: check.risk
                });

                // Feeling the qi turn and coming back from it teaches
                // something about the meridians that no manual does. Only the
                // worst grade qualifies, and only sometimes.
                if (resolution.severity === 'crippling') {
                    const rng = forStream(ctx.seed, 'understanding', newAbsDay, 'deviation');
                    if (rng.chance(INSIGHT_FROM_CRIPPLING_DEVIATION)) {
                        comprehend(
                            'profound_principle',
                            'Came back from a crippling qi deviation, having felt exactly ' +
                            'how the circulation turns.',
                            newAbsDay,
                            'deviation',
                            rng,
                            { severity: resolution.severity }
                        );
                    }
                }

                // Reaching the lethal untreated-injury threshold is not itself
                // death, but it starts the clock that is, and it is the last
                // moment at which the player can still do something about it.
                // Hand control back - once. A cultivator who was already at
                // the threshold when the skip began has been told, and being
                // stopped every chunk would mean they could never bleed out.
                if (untreatedInjuryCount(injuries) >= LETHAL_UNTREATED_INJURIES && !bleedAnnounced) {
                    bleedAnnounced = true;
                    interrupted = true;
                    interruptReason = 'lethal_injury_threshold';
                    push(
                        'bleeding_warning',
                        `${untreatedInjuryCount(injuries)} untreated meridian injuries. Any further combat is fatal, ` +
                        `and nothing heals them on their own: ${BLEED_OUT_TURNS - bleedingTurns} days of this ` +
                        'and the meridians give out on their own.',
                        true,
                        {
                            untreated: untreatedInjuryCount(injuries),
                            bleedingTurns,
                            daysUntilBleedOut: BLEED_OUT_TURNS - bleedingTurns
                        }
                    );
                }
            }
        }

        if (randomEvents && onGrid(newAbsDay, ENCOUNTER_CHECK_DAYS)) {
            // Four samples drawn unconditionally, so the stream stays aligned
            // whatever the cultivator's Fortune: whether something comes, how
            // serious it is, whether it lands, and whether it can be left.
            const rng = forStream(ctx.seed, 'encounter', newAbsDay);
            const came = rng.chance(ENCOUNTER_CHANCE * eventScale);
            const major = rng.chance(MAJOR_ENCOUNTER_FRACTION);
            const landed = rng.next();
            const withdrawal = rng.next();
            const fortune = fortuneOf(cultivator.attributes);

            if (came && major) {
                // Fortune decides whether the confrontation happens at all -
                // the elder took the other road - and nothing whatever about
                // who would win it if it does. Either way the player gets
                // control back, because either way this is a decision point.
                const canWithdraw =
                    withdrawal < CLEAN_WITHDRAWAL_BASE + fortune * CLEAN_WITHDRAWAL_PER_FORTUNE;
                interrupted = true;
                interruptReason = 'major_encounter';
                push(
                    'encounter',
                    canWithdraw
                        ? 'Seclusion broken: another cultivator is nearby and has not seen this place yet. ' +
                          `There is a way out that does not cross them. ${rankName(ordinal)} standing, ` +
                          `${untreatedInjuryCount(injuries)} untreated injuries.`
                        : 'Seclusion broken: another cultivator has found this place and is approaching. ' +
                          `${rankName(ordinal)} standing, ${untreatedInjuryCount(injuries)} untreated injuries.`,
                    true,
                    { severity: 'major', canWithdraw }
                );
            } else if (came) {
                // Presence, not severity. Fortune can mean the thing passed by;
                // it cannot mean the thing arrived and hurt less.
                const passedBy =
                    landed < DISTURBANCE_PASSES_BASE + fortune * DISTURBANCE_PASSES_PER_FORTUNE;
                if (passedBy) {
                    push(
                        'encounter',
                        'Something passed close by the cave and went on without stopping.',
                        false,
                        { severity: 'minor', passedBy: true, damage: 0 }
                    );
                } else {
                    const damage = Math.min(hp, Math.max(1, Math.round(cultivator.maxHp * 0.1)));
                    hp -= damage;
                    push(
                        'encounter',
                        `A minor disturbance interrupted cultivation and cost ${damage} HP. Nothing followed it.`,
                        false,
                        { severity: 'minor', passedBy: false, damage }
                    );
                }
            }
        }

        if (randomEvents && !interrupted && onGrid(newAbsDay, OPPORTUNITY_CHECK_DAYS)) {
            // Three samples drawn unconditionally, keeping the stream aligned
            // across cultivators of different Fortune: was there something,
            // was it still there, and how much was it worth.
            const rng = forStream(ctx.seed, 'opportunity', newAbsDay);
            const drawn = rng.next();
            const availability = rng.next();
            const size = rng.int(10, 60);
            const fortune = fortuneOf(cultivator.attributes);

            const chance = (OPPORTUNITY_BASE_CHANCE + fortune * OPPORTUNITY_PER_FORTUNE) * eventScale;
            if (drawn < chance) {
                // The window is the second half of luck, and the half the genre
                // actually turns on: the cache is there either way, and low
                // Fortune means arriving after someone else did.
                const missedChance =
                    OPPORTUNITY_MISSED_BASE + fortune * OPPORTUNITY_MISSED_PER_FORTUNE;
                if (availability < missedChance) {
                    push(
                        'opportunity_missed',
                        'There had been a spirit-stone cache in the rock nearby. ' +
                        'Someone reached it first, and not recently.',
                        false,
                        { missedBy: 'already_taken' }
                    );
                } else {
                    const stones = size * (1 + ordinal);
                    spiritStones += stones;
                    push(
                        'opportunity',
                        `Found while in seclusion: a spirit-stone cache worth ${stones} stones.`,
                        false,
                        { spiritStones: stones }
                    );
                }
            }
        }

        // ── 5. A rare meditative state, if the circumstances are exceptional. ──
        //
        // Zero chance for a cultivator in ordinary qi practising nothing in
        // particular, which is most of them. This grid can never award
        // anything for time served: every term in the chance is a fact about
        // where they are, what they are practising, or how well they read.
        // ── Recognition. Not a roll: a fact arriving. ──
        //
        // The first time something a cultivator was ALWAYS going to be
        // extraordinary at comes within reach, it is simply obvious to them.
        // Nothing warned them, because nothing knew - the affinity was rolled
        // at creation and has never been readable by anything. Access was the
        // only missing piece, and most cultivators die never having stood in a
        // room where their own Dao was being practised.
        if (!interrupted && onGrid(newAbsDay, INSIGHT_CHECK_DAYS)) {
            const reachable = discoverableInsights({ ...cultivator, id: identity, insights }, {
                ...(ctx.understanding ?? {}),
                survived: null,
                runSeed: ctx.seed,
                affinityOf: target => affinityFor(ctx.seed, identity, target)
            });
            for (const candidate of reachable) {
                const held = insights.some(
                    i => i.domain === candidate.domain && i.subject === candidate.subject
                );
                if (held) continue;
                if (!isRecognition(affinityFor(ctx.seed, identity, candidate))) continue;

                const rng = forStream(
                    ctx.seed, 'understanding', newAbsDay, `recognition:${candidate.subject}`
                );
                const achievement = recordAchievement(
                    {
                        kind: 'recognition',
                        onDay: newAbsDay,
                        turn: resolvesOnTurn,
                        summary:
                            `Saw ${candidate.subject} at close range for the first time, and it was ` +
                            'obvious. Comprehension arrived at a speed nothing in their experience ' +
                            'prepared them for. To anyone watching, they simply went quiet.',
                        detail: { subject: candidate.subject, access: candidate.access.kind }
                    },
                    rng
                );
                achievements.push(achievement);
                push('achievement', achievement.summary, false, {
                    kind: 'recognition',
                    achievementId: achievement.id
                });

                const insight = formInsight(
                    candidate,
                    AFFINITY_INITIAL_DEGREE.extraordinary,
                    achievement
                );
                insights = [...insights, insight];
                insightsGained.push(insight);
                push(
                    'insight_gained',
                    `Understanding: ${insight.subject} comprehended - ${candidate.opening}.`,
                    false,
                    {
                        insightId: insight.id,
                        domain: insight.domain,
                        subject: insight.subject,
                        degree: insight.degree,
                        deepened: false,
                        recognition: true,
                        accessKind: candidate.access.kind,
                        accessLabel: candidate.access.label
                    }
                );
            }
        }

        if (!interrupted && onGrid(newAbsDay, INSIGHT_CHECK_DAYS)) {
            const rng = forStream(ctx.seed, 'understanding', newAbsDay, 'meditation');
            const rootElements = getSpiritRoot(cultivator.spiritRoot).elements;
            const practised = ctx.understanding?.techniqueElement ?? ctx.techniqueElement ?? null;
            const { chance } = meditativeStateChance({
                ambient,
                matchedTechnique: practised !== null && rootElements.includes(practised),
                atSiteOfUnderstanding: (ctx.understanding?.locationTags ?? []).length > 0,
                insight: cultivator.attributes.insight
            });
            if (chance > 0 && rng.chance(chance)) {
                comprehend(
                    'meditative_state',
                    'Entered a rare meditative state and did not come out of it the same.',
                    newAbsDay,
                    null,
                    rng
                );
            }
        }

        // ── 6. A temporal phenomenon. Information, never capability. ──
        //
        // These do not touch a single number on the cultivator. What comes out
        // is a belief with no fact behind it, handed to the knowledge layer,
        // where it can be acted on, doubted, traded, and turn out to have been
        // wrong all along.
        if (!interrupted && onGrid(newAbsDay, VISION_CHECK_DAYS)) {
            const rng = forStream(ctx.seed, 'understanding', newAbsDay, 'vision');
            const atSite = (ctx.understanding?.locationTags ?? []).length > 0;
            if (rng.chance(visionChance(atSite))) {
                const kind = rng.pick(VISION_KINDS);
                // `cultivator.id` and NOT `identity`, deliberately. This is the
                // one use of the row id in this file that is correct: a vision
                // is OWNED by a row, and `holderId` plus the `claimKey` derived
                // from it are what the knowledge layer stores it against.
                // Substituting the roll identity would file every player run's
                // visions under one shared owner.
                //
                // Nothing here is drawn from it - the vision's occurrence, kind
                // and confidence all come off the day-keyed stream above, so
                // this was already reproducible and stays so.
                visions.push(
                    formVision(cultivator.id, kind, newAbsDay, rng.float(0.2, 0.6))
                );
                push(
                    'vision',
                    'Something arrived that does not sit cleanly in time. It offers a ' +
                    'direction and no proof, and it may be true of nothing at all.',
                    false,
                    { kind }
                );
            }
        }

        // ── 7. Did any of that kill us? ──
        if (checkDeath()) break;
    }

    // A minor encounter or deviation can take HP to zero without any later
    // check running, so make one final pass. `checkDeath` is idempotent.
    if (!died) checkDeath();

    const finalAge = currentAge();

    return {
        requestedDays,
        simulatedDays: elapsed,
        interrupted,
        interruptReason,
        events,
        deltas: {
            cultivationProgress: progress - cultivator.cultivationProgress,
            realmOrdinal: ordinal - cultivator.realmOrdinal,
            hp: hp - cultivator.hp,
            qi: qi - cultivator.qi,
            satiety: satiety - cultivator.satiety,
            spiritStones: spiritStones - cultivator.spiritStones,
            age: roundYears(finalAge - startAge),
            // Derived, never tracked separately, so the count and the records
            // cannot drift apart.
            injuriesGained: sustained.length
        },
        died,
        deathCause,
        injuriesSustained: sustained,
        tolls,
        endState: {
            starvationTurns,
            bleedingTurns,
            yearsAtCurrentRealm: currentYearsAtRealm()
        },
        foundationEstablished:
            foundation === (cultivator.foundationQuality ?? 'none') ? null : foundation,
        immortalStatusGained:
            immortalStatus === (cultivator.immortalStatus ?? 'none') ? null : immortalStatus,
        achievements,
        insightsGained,
        visions
    };
}

// ─────────────────────────────────────────────────────────────────────────
// CHUNKING
// The whole optimisation, and the whole determinism argument, lives here.
// ─────────────────────────────────────────────────────────────────────────

interface ChunkInputs {
    elapsed: number;
    absDay: number;
    requestedDays: number;
    breakthroughDays: number;
    lifespanDays: number;
    stagnationDays: number;
    starvationDays: number;
    emptyBellyDays: number;
    bleedOutDays: number;
    randomEvents: boolean;
}

/**
 * Days to advance before anything can possibly change.
 *
 * Every candidate is a pure function of current state, so the sequence of chunk
 * boundaries for a given (seed, input) is fixed - which is exactly why the
 * adaptive stepping cannot perturb any roll. Always at least 1, so the loop
 * cannot stall.
 */
function nextChunk(input: ChunkInputs): number {
    const candidates: number[] = [
        input.requestedDays - input.elapsed,
        daysToNextGridPoint(input.absDay, AMBIENT_REFRESH_DAYS),
        daysToNextGridPoint(input.absDay, DEVIATION_CHECK_DAYS)
    ];

    if (input.randomEvents) {
        candidates.push(daysToNextGridPoint(input.absDay, ENCOUNTER_CHECK_DAYS));
        candidates.push(daysToNextGridPoint(input.absDay, OPPORTUNITY_CHECK_DAYS));
    }

    // Positive-only: a candidate of 0 would stall, and eligibility at 0 is
    // handled before the chunk is ever computed.
    for (const candidate of [
        input.breakthroughDays,
        input.lifespanDays,
        input.stagnationDays,
        input.starvationDays,
        input.emptyBellyDays,
        input.bleedOutDays
    ]) {
        if (Number.isFinite(candidate) && candidate > 0) candidates.push(candidate);
    }

    const chunk = Math.min(...candidates);
    return Math.max(1, Math.min(chunk, input.requestedDays - input.elapsed));
}

/**
 * Days from `day` to the NEXT multiple of `interval`. Always in [1, interval] -
 * standing exactly on a grid point returns a full interval rather than 0, so a
 * check that has just fired cannot fire again on the same day.
 */
function daysToNextGridPoint(day: number, interval: number): number {
    return interval - (((day % interval) + interval) % interval);
}

function onGrid(day: number, interval: number): boolean {
    return day > 0 && day % interval === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// FOOD
// ─────────────────────────────────────────────────────────────────────────

interface FoodState {
    satiety: number;
    starvationTurns: number;
    rations: number;
}

/**
 * Burn `days` days of food, eating a ration whenever the belly empties.
 *
 * The loop is bounded, not O(days): a chunk is at most AMBIENT_REFRESH_DAYS
 * (30) days and one ration covers 50, so it runs at most twice.
 */
function consumeFood(
    days: number,
    state: FoodState,
    realmOrdinal = 0
): FoodState & { rationsUsed: number } {
    let { satiety, starvationTurns, rations } = state;
    let remaining = days;
    let rationsUsed = 0;

    // Above the point where hunger stops, a seclusion of any length costs
    // nothing to eat through and no rations are opened.
    const perDay = SATIETY_COST_PER_ACTION * satietyBurnMultiplier(realmOrdinal);
    if (perDay <= 0) return { satiety, starvationTurns: 0, rations, rationsUsed: 0 };

    while (remaining > 0) {
        const fedActions = Math.floor(satiety / perDay);
        const step = Math.min(remaining, fedActions);
        if (step > 0) {
            const burned = burnSatiety({ satiety, starvationTurns }, step, realmOrdinal);
            satiety = burned.satiety;
            starvationTurns = burned.starvationTurns;
            remaining -= step;
        }
        if (remaining === 0) break;

        if (rations > 0) {
            rations--;
            rationsUsed++;
            const fed = eat({ satiety, starvationTurns }, SATIETY_MAX);
            satiety = fed.satiety;
            starvationTurns = fed.starvationTurns;
            continue;
        }

        // No food left: the rest of the stretch is spent starving.
        const starved = burnSatiety({ satiety, starvationTurns }, remaining, realmOrdinal);
        satiety = starved.satiety;
        starvationTurns = starved.starvationTurns;
        remaining = 0;
    }

    // Finish on a meal if there is one to eat.
    //
    // The loop only opens a ration when there are days left to cover, so a
    // stretch that ends exactly as the belly empties - fifty days of work on a
    // full stomach, which is the commonest thing a new player does - used to
    // end at zero with food still in the pack. The next action then started
    // already starving. Nobody finishes a season of hauling, sits down next to
    // their own rations, and does not eat.
    if (satiety <= 0 && rations > 0) {
        rations--;
        rationsUsed++;
        const fed = eat({ satiety, starvationTurns }, SATIETY_MAX);
        satiety = fed.satiety;
        starvationTurns = fed.starvationTurns;
    }

    return { satiety, starvationTurns, rations, rationsUsed };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ages are derived from integer day counters and then rounded, so that a skip
 * taken in one chunk and the same skip taken in three hundred produce bit-equal
 * numbers rather than numbers that differ in the fifteenth decimal place.
 */
function roundYears(years: number): number {
    return Math.round(years * 1e6) / 1e6;
}

/**
 * Whole days from `current` years to `limit` years.
 *
 * The epsilon absorbs the float residue in `(limit - current) * 365`: without
 * it a distance that is truly 20 days computes as 20.0000000001 and ceils to
 * 21, stepping the simulation one day past a death threshold that the tests -
 * and the player - expect to land exactly on the documented number.
 */
function daysUntilYear(limit: number, current: number): number {
    return Math.ceil((limit - current) * DAYS_PER_YEAR - 1e-6);
}

function deathSummary(cause: DeathCause, name: string, ordinal: number, age: number): string {
    return `${name} died at ${rankName(ordinal)}, age ${Math.floor(age)}: ${cause.replace(/_/g, ' ')}.`;
}

/**
 * Create the injury record for an out-of-band event during a skip. Exported
 * because the encounter and sect layers above this module need to mint
 * injuries on the same seeded, replayable basis.
 */
export function skipInjury(
    seed: string,
    absDay: number,
    turn: number,
    severity: Injury['severity'],
    source: Injury['source']
): Injury {
    return createInjury(
        { severity, source, turn, woundType: ordinaryWoundFor(source, severity) },
        forStream(seed, 'skip_injury', absDay)
    );
}

/** Ambient band governing a given absolute day of a skip. For UI preview. */
export function ambientDuringSkip(ctx: TimeSkipContext, absDay: number): AmbientQi {
    return ambientForBlock(ctx.seed, ctx.locationId, absDay, {
        density: ctx.locationDensity,
        sealed: ctx.sealed
    });
}
