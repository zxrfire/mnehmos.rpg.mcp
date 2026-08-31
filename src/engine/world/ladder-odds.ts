/**
 * How many people ever get this far.
 *
 * The realm ladder is a fact about the world before it is a progression bar,
 * and the number that makes it one is the share of cultivators who ever reach
 * each rung. "Foundation Establishment" means nothing on its own; "perhaps one
 * in forty of the people who ever gather qi" means everything, and it is what
 * makes a player understand what they are looking at when an elder walks past.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE NUMBERS, AND THEY ARE ALLOWED TO DISAGREE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   BELIEVED    what people in the world say. Vague, round, phrased the way a
 *               sect elder would phrase it, and NOT NECESSARILY TRUE. This is
 *               the only one the player ever sees, and it is a knowledge claim
 *               like any other - it can be out of date, regionally wrong, or
 *               something a Dao house will sell you a correction to.
 *
 *   THEORETICAL what the engine's own constants imply: `baseBreakthroughChance`
 *               compounded up the ladder. Cheap, closed-form, and wrong in the
 *               interesting way - it assumes everyone attempts every rank, has
 *               unlimited time, and never dies of anything else.
 *
 *   MEASURED    what the engine ACTUALLY does, from a seeded sweep that runs
 *               cultivators through the real `attemptBreakthrough` against the
 *               real rate and the real lifespan, and counts where they stopped.
 *
 * The admin panel gets all three. The gap between theoretical and measured is
 * the honest measure of how much the survival layer - lifespan, settling, the
 * cost curve, a bad root - takes out of the ladder over and above the
 * breakthrough roll, and it is reported rather than hidden because a designer
 * who cannot see it will tune the wrong number.
 *
 * Nothing in this module feeds back into the simulation. It measures and it
 * reports.
 */

import { forStream } from '../cultivation/rng.js';
import {
    DAYS_PER_YEAR,
    computeCultivationRate
} from '../cultivation/cultivation.js';
import {
    MAX_ORDINAL,
    REALM_TIERS,
    baseBreakthroughChance,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    type RealmKey
} from '../cultivation/realms.js';
import { attemptBreakthrough, canAttemptBreakthrough } from '../cultivation/breakthrough.js';
import { rollAttributes, rollSpiritRoot } from '../cultivation/spirit-roots.js';
import { stagnationYearsForOrdinal, type AmbientQi, type Injury } from '../../schema/cultivation.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT PEOPLE SAY
// ─────────────────────────────────────────────────────────────────────────

export interface BelievedReach {
    realm: RealmKey;
    name: string;
    /** Approximate share, as people round it. Not the truth. */
    approximateShare: number;
    /**
     * How somebody would actually say it. Vague on purpose: nobody in this
     * world has a census, and the ones who quote a figure are quoting a
     * tradition.
     */
    statement: string;
    /** A coarser breakdown inside the tier, for the sub-ranks. */
    withinTier: string;
}

/**
 * The believed figures, keyed by realm.
 *
 * These are what a reasonably informed cultivator would tell you, and they are
 * deliberately not the measured numbers. Where they are wrong, they are wrong
 * in the direction people are wrong: optimistic near the bottom, where everyone
 * knows somebody who made it, and vague to the point of myth at the top, where
 * nobody has met anyone.
 *
 * Keyed rather than positional, and {@link BELIEVED_REACH} is built from
 * `REALM_TIERS` rather than written out beside it. The ladder has already grown
 * a rung once while this file existed; a positional array would have silently
 * mismatched every row above the insertion point instead of failing.
 */
const BELIEVED_BY_REALM: Partial<Record<RealmKey, Omit<BelievedReach, 'realm' | 'name'>>> = Object.fromEntries(([
    {
        realm: 'qi_condensation',
        approximateShare: 1,
        statement: 'Everyone who ever sits down to it gets this far, or they were never doing it.',
        withinTier: 'Most who stay with it see the sixth or seventh layer. Past the ninth is already unusual.'
    },
    {
        realm: 'foundation_establishment',
        approximateShare: 0.025,
        statement: 'Perhaps one in forty of the people who ever gather qi see Foundation.',
        withinTier: 'Of those, most stop at Early or Mid. Perfection is a thing elders have.'
    },
    {
        realm: 'core_formation',
        approximateShare: 0.002,
        statement: 'One in five hundred, they say, though the people who say it are counting their own.',
        withinTier: 'A sect with two at Core Formation considers itself well off.'
    },
    {
        realm: 'nascent_soul',
        approximateShare: 0.0002,
        statement: 'One in several thousand. Most provinces have none, and know it.',
        withinTier: 'The difference between Early and Perfection here is a century of somebody\'s life.'
    },
    {
        realm: 'deity_transformation',
        approximateShare: 0.00002,
        statement: 'A handful in a generation, across everywhere anyone has heard of.',
        withinTier: 'Nobody outside one is in a position to tell the sub-ranks apart.'
    },
    {
        realm: 'void_refinement',
        approximateShare: 0.000002,
        statement: 'People argue about whether there are any. There are.',
        withinTier: 'Not distinguishable from outside, and asking is considered rude.'
    },
    {
        realm: 'body_integration',
        approximateShare: 0.0000002,
        statement: 'A name in a record, usually a name nobody can date.',
        withinTier: 'The records do not agree with each other.'
    },
    {
        realm: 'grand_ascension',
        approximateShare: 0.00000002,
        statement: 'The mountains have opinions about who is up there. The mountains are guessing.',
        withinTier: 'No.'
    },
    {
        realm: 'tribulation_transcendence',
        approximateShare: 0.000000002,
        statement: 'Nobody in living memory. The last confirmed crossing is centuries back.',
        withinTier: 'No.'
    },
    {
        realm: 'true_immortal',
        approximateShare: 0,
        statement: 'Through. Whether there is anything on the other side is not a question anyone here can answer.',
        withinTier: 'No.'
    }
] as { realm: RealmKey; approximateShare: number; statement: string; withinTier: string }[])
    .map(({ realm, ...rest }) => [realm, rest])) as Partial<Record<RealmKey, Omit<BelievedReach, 'realm' | 'name'>>>;

/**
 * What people say, one row per rung of the actual ladder.
 *
 * A tier the believed table has nothing for gets an honest placeholder rather
 * than being dropped, so adding a realm cannot quietly shorten this report.
 */
export const BELIEVED_REACH: readonly BelievedReach[] = REALM_TIERS.map(tier => {
    const held = BELIEVED_BY_REALM[tier.key];
    return {
        realm: tier.key,
        name: tier.name,
        approximateShare: held?.approximateShare ?? 0,
        statement: held?.statement ?? 'Nobody says, and nobody who would know is talking.',
        withinTier: held?.withinTier ?? 'No.'
    };
});

export function believedReachFor(realm: RealmKey): BelievedReach | null {
    return BELIEVED_REACH.find(b => b.realm === realm) ?? null;
}

/**
 * What the player is shown.
 *
 * The vague in-world sentence, never a figure to three decimal places. If a
 * player wants better than this they should have to buy it from somebody whose
 * business is knowing, and that transaction is a knowledge record.
 */
export function believedStatement(realm: RealmKey): string {
    return believedReachFor(realm)?.statement ?? 'Nobody says.';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CONSTANTS IMPLY
// ─────────────────────────────────────────────────────────────────────────

export interface TierReach {
    realm: RealmKey;
    name: string;
    /** First ordinal of the tier. */
    ordinal: number;
    /** Share of starters who ever reach it, 0..1. */
    share: number;
}

/**
 * The ladder as its own constants describe it.
 *
 * The product of `baseBreakthroughChance` from ordinal zero up. Deliberately
 * naive: it assumes everybody attempts every rank, that a failure costs
 * nothing but a retry, and that nobody runs out of life. It is the number a
 * spreadsheet would give, and the point of computing it is to have something
 * for the measured sweep to disagree with.
 */
export function computeTheoreticalReach(): TierReach[] {
    const out: TierReach[] = [];
    let carried = 1;
    let cursor = 0;

    for (const tier of REALM_TIERS) {
        while (cursor < tier.ordinalStart) {
            carried *= baseBreakthroughChance(cursor);
            cursor++;
        }
        out.push({
            realm: tier.key,
            name: tier.name,
            ordinal: tier.ordinalStart,
            share: carried
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ENGINE ACTUALLY DOES
// ─────────────────────────────────────────────────────────────────────────

export interface SweepOptions {
    /** Cultivators to run. A few thousand is enough to see the shape. */
    sampleSize?: number;
    /** Ambient band they cultivate in. Most of the world is thin. */
    ambient?: AmbientQi;
    /** Fraction of the day that actually goes into it. */
    focus?: number;
    /** Multiplier on rate from where they are. */
    locationBonus?: number;
    /** Hard stop, so a sweep cannot run away. */
    maxYears?: number;
}

export interface SweepResult {
    sampleSize: number;
    ambient: AmbientQi;
    /** Share reaching each tier, measured. */
    tiers: TierReach[];
    /** Peak ordinal distribution, index = ordinal. */
    peakByOrdinal: number[];
    /** How they stopped. */
    outcomes: {
        died_in_breakthrough: number;
        lifespan: number;
        settling: number;
        still_going: number;
    };
    /** Mean peak ordinal across the sample. */
    meanPeakOrdinal: number;
}

/**
 * Run cultivators through the real engine and count where they stopped.
 *
 * This is the honest measurement: it calls `attemptBreakthrough`, accrues at
 * `computeCultivationRate`, and dies of lifespan and settling exactly the way
 * the survival layer does. It is not a model of the ladder; it is the ladder,
 * run a few thousand times.
 *
 * Deterministic from the seed, so a balance change can be compared against a
 * previous sweep rather than argued about.
 */
export function measureLadderReach(seed: string, opts: SweepOptions = {}): SweepResult {
    const sampleSize = Math.max(1, opts.sampleSize ?? 2000);
    const ambient: AmbientQi = opts.ambient ?? 'thin';
    const focus = opts.focus ?? 0.6;
    const locationBonus = opts.locationBonus ?? 1;
    const maxYears = opts.maxYears ?? 3000;

    const peakByOrdinal = new Array(MAX_ORDINAL + 1).fill(0);
    const outcomes = { died_in_breakthrough: 0, lifespan: 0, settling: 0, still_going: 0 };
    let peakSum = 0;

    for (let i = 0; i < sampleSize; i++) {
        const rootRng = forStream(seed, 'sweep-root', i);
        const attrRng = forStream(seed, 'sweep-attrs', i);
        const root = rollSpiritRoot(rootRng.next());
        const attributes = rollAttributes([
            attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
        ]);

        let ordinal = 0;
        let peak = 0;
        let progress = 0;
        let age = 16;
        let yearsAtRealm = 0;
        const injuries: Injury[] = [];
        let attempt = 0;
        let outcome: keyof typeof outcomes = 'still_going';

        while (age < maxYears) {
            const rate = computeCultivationRate({ spiritRoot: root.key, injuries }, ambient, {
                focusMultiplier: focus,
                locationBonus,
                techniqueBonus: 1 + attributes.insight * 0.06
            }).perDay;

            const required = progressRequiredForOrdinal(ordinal);
            if (rate <= 0) {
                outcome = 'settling';
                break;
            }
            const yearsNeeded = Math.max(
                1 / DAYS_PER_YEAR,
                (required - progress) / (rate * DAYS_PER_YEAR)
            );

            // Settling and lifespan are the two clocks that end most lives, and
            // they end them before the ladder does.
            if (yearsAtRealm + yearsNeeded >= stagnationYearsForOrdinal(ordinal)) {
                outcome = 'settling';
                break;
            }
            if (age + yearsNeeded >= lifespanForOrdinal(ordinal)) {
                outcome = 'lifespan';
                break;
            }

            age += yearsNeeded;
            yearsAtRealm += yearsNeeded;
            progress = required;

            const eligible = canAttemptBreakthrough({
                realmOrdinal: ordinal,
                cultivationProgress: progress,
                alive: true
            });
            if (!eligible.eligible) break;

            const result = attemptBreakthrough(
                {
                    realmOrdinal: ordinal,
                    cultivationProgress: progress,
                    spiritRoot: root.key,
                    attributes,
                    injuries,
                    alive: true
                },
                { rng: forStream(seed, 'sweep-bt', i, attempt++), ambient, turn: Math.floor(age) }
            );
            progress = Math.max(0, progress - result.progressConsumed);
            for (const injury of result.injuriesSustained) injuries.push(injury);

            if (result.outcome === 'death') {
                outcome = 'died_in_breakthrough';
                break;
            }
            if (result.outcome === 'success') {
                ordinal = result.toOrdinal;
                peak = Math.max(peak, ordinal);
                yearsAtRealm = 0;
                if (ordinal >= MAX_ORDINAL) break;
            }
        }

        peakByOrdinal[peak]++;
        peakSum += peak;
        outcomes[outcome]++;
    }

    const tiers: TierReach[] = REALM_TIERS.map(tier => {
        let reached = 0;
        for (let o = tier.ordinalStart; o <= MAX_ORDINAL; o++) reached += peakByOrdinal[o];
        return {
            realm: tier.key,
            name: tier.name,
            ordinal: tier.ordinalStart,
            share: reached / sampleSize
        };
    });

    return {
        sampleSize,
        ambient,
        tiers,
        peakByOrdinal,
        outcomes,
        meanPeakOrdinal: Number((peakSum / sampleSize).toFixed(4))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ADMIN VIEW
// ─────────────────────────────────────────────────────────────────────────

export interface LadderOddsRow {
    realm: RealmKey;
    name: string;
    ordinal: number;
    believedShare: number;
    believedStatement: string;
    theoreticalShare: number;
    measuredShare: number;
    /**
     * Measured over believed. Above one means the world is more generous than
     * people think; below one means it is crueller, which is the usual case and
     * is exactly the sort of correction somebody would pay for.
     */
    beliefError: number;
    /**
     * Measured over theoretical. How much the survival layer takes out over and
     * above the breakthrough roll. Near zero means the ladder is not what stops
     * people - the clock is.
     */
    modelGap: number;
    /** Living NPCs currently at or above this tier, when a world is supplied. */
    observed: number | null;
}

export interface LadderOddsReport {
    rows: LadderOddsRow[];
    sweep: SweepResult;
    /**
     * Tiers where belief and measurement disagree by more than an order of
     * magnitude. Worth reporting, and worth an in-world explanation.
     */
    notableDisagreements: { realm: RealmKey; believed: number; measured: number }[];
}

/**
 * All three numbers, side by side. Admin only.
 *
 * Pass a world and the observed column is filled from the living population,
 * which is the fourth number and the only one that is neither a belief nor a
 * model: it is what this particular world actually contains today.
 */
export function ladderOddsReport(
    seed: string,
    opts: SweepOptions = {},
    world?: WorldState
): LadderOddsReport {
    const sweep = measureLadderReach(seed, opts);
    const theoretical = computeTheoreticalReach();

    let livingTotal = 0;
    const livingByOrdinal = new Array(MAX_ORDINAL + 1).fill(0);
    if (world) {
        for (const npc of world.npcs) {
            if (npc.status !== 'alive') continue;
            livingTotal++;
            livingByOrdinal[npc.cultivation.realmOrdinal]++;
        }
    }

    const rows: LadderOddsRow[] = REALM_TIERS.map((tier, i) => {
        const believed = BELIEVED_REACH[i];
        const measured = sweep.tiers[i].share;
        let observed: number | null = null;
        if (world && livingTotal > 0) {
            let n = 0;
            for (let o = tier.ordinalStart; o <= MAX_ORDINAL; o++) n += livingByOrdinal[o];
            observed = n / livingTotal;
        }
        return {
            realm: tier.key,
            name: tier.name,
            ordinal: tier.ordinalStart,
            believedShare: believed.approximateShare,
            believedStatement: believed.statement,
            theoreticalShare: theoretical[i].share,
            measuredShare: measured,
            beliefError: believed.approximateShare > 0
                ? Number((measured / believed.approximateShare).toFixed(4)) : 0,
            modelGap: theoretical[i].share > 0
                ? Number((measured / theoretical[i].share).toFixed(6)) : 0,
            observed
        };
    });

    const notableDisagreements = rows
        .filter(r => r.believedShare > 0 && (r.beliefError > 10 || r.beliefError < 0.1))
        .map(r => ({ realm: r.realm, believed: r.believedShare, measured: r.measuredShare }));

    return { rows, sweep, notableDisagreements };
}
