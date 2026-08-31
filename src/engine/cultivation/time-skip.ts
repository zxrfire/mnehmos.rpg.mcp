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
 * Pure: the input cultivator is never mutated. Everything is returned as
 * deltas and events for the caller to apply.
 */

import {
    LETHAL_UNTREATED_INJURIES,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    STAGNATION_YEARS,
    type AmbientQi,
    type Cultivator,
    type DeathCause,
    type Element,
    type FoundationQuality,
    type Injury,
    type SimEvent,
    type SimEventKind,
    type TimeSkipResult,
    type TollResult
} from '../../schema/cultivation.js';
import { lifespanForOrdinal, rankName } from './realms.js';
import { AMBIENT_REFRESH_DAYS, ambientForBlock } from './ambient.js';
import {
    DAYS_PER_YEAR,
    computeCultivationRate,
    daysToNextBreakthrough,
    type CultivationOptions
} from './cultivation.js';
import { attemptBreakthrough, canAttemptBreakthrough } from './breakthrough.js';
import type { FoundationConditions } from './foundation.js';
import type { TollConditions } from './toll.js';
import { resolveDeviation, rollDeviation } from './deviation.js';
import { createInjury, untreatedInjuryCount } from './injuries.js';
import { burnSatiety, eat, evaluateDeathConditions, turnsUntilStarvation } from './survival.js';
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

/** Base probability of an opportunity, before Fortune. */
export const OPPORTUNITY_BASE_CHANCE = 0.15;
/** Added opportunity probability per point of Fortune. Zero Fortune gets none. */
export const OPPORTUNITY_PER_FORTUNE = 0.05;

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
     * Conditions for the Vault's toll at any realm boundary crossed during the
     * skip. The candidate list must come from real rows - the engine holds no
     * database - so a caller that omits it will see the Vault find nothing
     * worth taking, which is a visible result rather than a silent skip.
     */
    toll?: TollConditions;
    /**
     * Conditions for the foundation, if the skip crosses 12 -> 13. A decade of
     * unattended seclusion is by definition an unhurried crossing, but the
     * caller still owns whether a site was chosen and a pill was bought.
     */
    foundation?: Omit<FoundationConditions, 'ambient'>;
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
    const startDay = Math.max(0, Math.floor(ctx.startDay ?? 0));
    const autoBreakthrough = ctx.autoBreakthrough ?? true;
    const randomEvents = ctx.randomEvents ?? true;
    const grainAbstinence = ctx.grainAbstinence ?? false;

    // ── Working state. A shallow copy; the input is never touched. ──
    const startAge = cultivator.age;
    const startYearsAtRealm = cultivator.yearsAtCurrentRealm;

    let ordinal = cultivator.realmOrdinal;
    let progress = cultivator.cultivationProgress;
    let hp = cultivator.hp;
    const qi = cultivator.qi;
    let satiety = cultivator.satiety;
    let starvationTurns = cultivator.starvationTurns;
    let injuries: Injury[] = [...cultivator.injuries];
    let spiritStones = cultivator.spiritStones;
    let rations = Math.max(0, Math.floor(ctx.rations ?? 0));
    /** May be set during the skip, if it crosses Foundation Establishment. */
    let foundation: FoundationQuality = cultivator.foundationQuality ?? 'none';
    /** Everything the Vault took during the skip, for the caller to apply. */
    const tolls: TollResult[] = [];

    /** Integer day counters. Ages are derived from these, never accumulated,
     *  so a thousand chunks introduce no float drift. */
    let elapsed = 0;
    let daysSinceAdvance = 0;
    /** Years-at-realm at the last advance; reset to 0 when a rank is gained. */
    let realmClockBase = startYearsAtRealm;

    const events: SimEvent[] = [];
    let interrupted = false;
    let interruptReason: string | null = null;
    let died = false;
    let deathCause: DeathCause | null = null;
    let injuriesGained = 0;
    /** Ranks gained on the current day, enforcing MAX_RANKS_PER_TURN. */
    let ranksOnDay = 0;
    let ranksOnDayFor = -1;
    let depletionAnnounced = false;

    const push = (
        kind: SimEventKind,
        summary: string,
        interrupts: boolean,
        data: Record<string, unknown> = {}
    ): void => {
        events.push({ kind, dayOffset: elapsed, summary, interrupts, data });
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
        name: cultivator.name,
        injuries,
        hp,
        maxHp: cultivator.maxHp,
        satiety,
        starvationTurns,
        age: currentAge(),
        yearsAtCurrentRealm: currentYearsAtRealm(),
        alive: true as const
    });

    const checkDeath = (): boolean => {
        const cause = evaluateDeathConditions(snapshot());
        if (cause === null) return false;
        died = true;
        deathCause = cause;
        interrupted = true;
        interruptReason = `death:${cause}`;
        push('death', deathSummary(cause, cultivator.name, ordinal, currentAge()), true, { cause });
        return true;
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
        const ambient = ambientForBlock(ctx.seed, ctx.locationId, absDay);

        if (autoBreakthrough) {
            const eligibility = canAttemptBreakthrough(
                { realmOrdinal: ordinal, cultivationProgress: progress, alive: true },
                { ranksGainedThisTurn: ranksOnDay }
            );
            if (eligibility.eligible) {
                const result = attemptBreakthrough(snapshot(), {
                    rng: forStream(ctx.seed, 'breakthrough', absDay, ordinal),
                    ambient,
                    turn: turn + Math.floor(elapsed),
                    ranksGainedThisTurn: ranksOnDay,
                    toll: ctx.toll,
                    foundation: ctx.foundation
                });

                progress = Math.max(0, progress - result.progressConsumed);
                if (result.injuriesSustained.length > 0) {
                    injuries = [...injuries, ...result.injuriesSustained];
                    injuriesGained += result.injuriesSustained.length;
                }

                if (result.outcome === 'success') {
                    ordinal = result.toOrdinal;
                    ranksOnDay++;
                    daysSinceAdvance = 0;
                    realmClockBase = 0;
                    if (result.foundationEstablished !== null) {
                        foundation = result.foundationEstablished;
                    }
                    push('breakthrough_success', result.narrationHint, false, {
                        fromOrdinal: result.fromOrdinal,
                        toOrdinal: result.toOrdinal,
                        finalChance: result.finalChance,
                        tribulation: result.tribulation,
                        foundationEstablished: result.foundationEstablished
                    });

                    // The Vault's instalment gets its own line in the digest.
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
        const rate = computeCultivationRate(
            { spiritRoot: cultivator.spiritRoot, injuries },
            ambient,
            ctx.options
        );

        const chunk = nextChunk({
            elapsed,
            absDay,
            requestedDays,
            breakthroughDays: autoBreakthrough
                ? daysToNextBreakthrough({ realmOrdinal: ordinal, cultivationProgress: progress }, rate.perDay)
                : Infinity,
            lifespanDays: daysUntilYear(lifespanForOrdinal(ordinal), rawAge()),
            stagnationDays: daysUntilYear(STAGNATION_YEARS, rawYearsAtRealm()),
            starvationDays:
                grainAbstinence || rations > 0
                    ? Infinity
                    : turnsUntilStarvation({ satiety, starvationTurns }),
            emptyBellyDays:
                grainAbstinence || rations > 0
                    ? Infinity
                    : Math.floor(satiety / SATIETY_COST_PER_ACTION),
            randomEvents
        });

        // ── 3. Apply the chunk. ──
        progress += rate.perDay * chunk;
        elapsed += chunk;
        daysSinceAdvance += chunk;

        if (!grainAbstinence) {
            const before = satiety;
            const fed = consumeFood(chunk, { satiety, starvationTurns, rations });
            satiety = fed.satiety;
            starvationTurns = fed.starvationTurns;
            rations = fed.rations;
            if (rations === 0 && !depletionAnnounced && fed.rationsUsed > 0) {
                depletionAnnounced = true;
                push('resource_depleted', 'The last of the provisions is gone.', false, {});
            }
            if (satiety === 0 && before > 0) {
                push(
                    'starvation_warning',
                    'Satiety has reached zero. Five turns without food is fatal.',
                    false,
                    { starvationTurns }
                );
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
                        alive: true
                    }).eligible
                }
            );
            if (check.deviated) {
                const resolution = resolveDeviation(
                    { cultivationProgress: progress, hp, maxHp: cultivator.maxHp },
                    forStream(ctx.seed, 'deviation_resolve', newAbsDay),
                    { turn: turn + Math.floor(elapsed) }
                );
                progress = Math.max(0, progress - resolution.progressLost);
                hp = Math.max(0, hp - resolution.hpLost);
                injuries = [...injuries, ...resolution.injuries];
                injuriesGained += resolution.injuries.length;
                push('qi_deviation', resolution.summary, false, {
                    severity: resolution.severity,
                    risk: check.risk
                });

                // Reaching the lethal untreated-injury threshold is not itself
                // death, but it is the last moment at which the player can
                // still do something about it. Hand control back.
                if (untreatedInjuryCount(injuries) >= LETHAL_UNTREATED_INJURIES) {
                    interrupted = true;
                    interruptReason = 'lethal_injury_threshold';
                    push(
                        'injury_sustained',
                        `${untreatedInjuryCount(injuries)} untreated meridian injuries. Any further combat is fatal.`,
                        true,
                        { untreated: untreatedInjuryCount(injuries) }
                    );
                }
            }
        }

        if (randomEvents && onGrid(newAbsDay, ENCOUNTER_CHECK_DAYS)) {
            const rng = forStream(ctx.seed, 'encounter', newAbsDay);
            if (rng.chance(ENCOUNTER_CHANCE)) {
                const major = rng.chance(MAJOR_ENCOUNTER_FRACTION);
                if (major) {
                    interrupted = true;
                    interruptReason = 'major_encounter';
                    push(
                        'encounter',
                        `Seclusion broken: another cultivator has found this place and is approaching. ` +
                        `${rankName(ordinal)} standing, ${untreatedInjuryCount(injuries)} untreated injuries.`,
                        true,
                        { severity: 'major' }
                    );
                } else {
                    const damage = Math.min(hp, Math.max(1, Math.round(cultivator.maxHp * 0.1)));
                    hp -= damage;
                    push(
                        'encounter',
                        `A minor disturbance interrupted cultivation and cost ${damage} HP. Nothing followed it.`,
                        false,
                        { severity: 'minor', damage }
                    );
                }
            }
        }

        if (randomEvents && !interrupted && onGrid(newAbsDay, OPPORTUNITY_CHECK_DAYS)) {
            const rng = forStream(ctx.seed, 'opportunity', newAbsDay);
            const chance =
                OPPORTUNITY_BASE_CHANCE + cultivator.attributes.fortune * OPPORTUNITY_PER_FORTUNE;
            if (rng.chance(chance)) {
                const stones = rng.int(10, 60) * (1 + ordinal);
                spiritStones += stones;
                push(
                    'opportunity',
                    `Found while in seclusion: a spirit-stone cache worth ${stones} stones.`,
                    false,
                    { spiritStones: stones }
                );
            }
        }

        // ── 5. Did any of that kill us? ──
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
            injuriesGained
        },
        died,
        deathCause,
        tolls,
        foundationEstablished:
            foundation === (cultivator.foundationQuality ?? 'none') ? null : foundation
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
        input.emptyBellyDays
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
function consumeFood(days: number, state: FoodState): FoodState & { rationsUsed: number } {
    let { satiety, starvationTurns, rations } = state;
    let remaining = days;
    let rationsUsed = 0;

    while (remaining > 0) {
        const fedActions = Math.floor(satiety / SATIETY_COST_PER_ACTION);
        const step = Math.min(remaining, fedActions);
        if (step > 0) {
            const burned = burnSatiety({ satiety, starvationTurns }, step);
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
        const starved = burnSatiety({ satiety, starvationTurns }, remaining);
        satiety = starved.satiety;
        starvationTurns = starved.starvationTurns;
        remaining = 0;
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
    return createInjury({ severity, source, turn }, forStream(seed, 'skip_injury', absDay));
}

/** Ambient band governing a given absolute day of a skip. For UI preview. */
export function ambientDuringSkip(ctx: TimeSkipContext, absDay: number): AmbientQi {
    return ambientForBlock(ctx.seed, ctx.locationId, absDay);
}
