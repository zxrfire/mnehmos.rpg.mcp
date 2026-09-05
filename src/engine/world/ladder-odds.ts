/**
 * How many people ever get this far.
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

/**
 * How many people in the two regions ever gather qi at all.
 */
export const CULTIVATOR_POPULATION = 20_000;

/** Whether a believed figure is a proportion or a tally of named people. */
export type BeliefUnit = 'share' | 'headcount';

export interface BelievedReach {
    realm: RealmKey;
    name: string;
    /** Approximate share, as people round it. Not the truth. */
    approximateShare: number;
    /**
     * What people are actually doing when they quote this realm.
     */
    statedAs: BeliefUnit;
    /**
     * How many people the world believes are up there, for the realms it
     * counts rather than divides. Null where the belief is genuinely a
     * proportion. This is the figure to check against the Standing Register.
     */
    approximateCount: number | null;
    /**
     * How somebody would actually say it. Vague on purpose: nobody in this
     * world has a census, and the ones who quote a figure are quoting a
     * tradition.
     */
    statement: string;
    /** A coarser breakdown inside the tier, for the sub-ranks. */
    withinTier: string;
}

interface BeliefRow {
    realm: RealmKey;
    /** Exactly one of these two. A share is divided; a count is counted. */
    share?: number;
    count?: number;
    statement: string;
    withinTier: string;
}

/**
 * The believed figures, keyed by realm.
 */
const BELIEVED_BY_REALM: Partial<Record<RealmKey, BeliefRow>> = Object.fromEntries(([
    {
        realm: 'qi_condensation',
        share: 1,
        statement: 'Everyone who ever sits down to it gets this far, or they were never doing it.',
        withinTier: 'Most who stay with it see the sixth or seventh layer. Past the ninth is already unusual.'
    },
    {
        realm: 'foundation_establishment',
        share: 0.025,
        statement: 'Perhaps one in forty of the people who ever gather qi see Foundation.',
        withinTier: 'Of those, most stop at Early or Mid. Perfection is a thing elders have.'
    },
    {
        realm: 'core_formation',
        share: 0.002,
        statement: 'One in five hundred, they say, though the people who say it are counting their own.',
        withinTier: 'A sect with two at Core Formation considers itself well off.'
    },
    {
        realm: 'nascent_soul',
        count: 12,
        statement: 'A dozen in the two provinces, and a house that has one says so on its gate.',
        withinTier: 'The difference between Early and Perfection here is a century of somebody\'s life.'
    },
    {
        realm: 'deity_transformation',
        count: 6,
        statement: 'Six, most say, and no two lists of the six agree past the first three.',
        withinTier: 'Nobody outside one is in a position to tell the sub-ranks apart.'
    },
    {
        realm: 'void_refinement',
        count: 4,
        statement: 'Four, if you count the one under the Silent Cliffs, and people argue about whether to.',
        withinTier: 'Not distinguishable from outside, and asking is considered rude.'
    },
    {
        realm: 'body_integration',
        count: 3,
        statement: 'Three names, two of which are the same name in different centuries.',
        withinTier: 'The records do not agree with each other.'
    },
    {
        realm: 'grand_ascension',
        count: 2,
        statement: 'The mountains have opinions about who is up there. The mountains are guessing, and guessing low.',
        withinTier: 'No.'
    },
    {
        realm: 'tribulation_transcendence',
        count: 1,
        statement: 'One, and the answer changes depending on which court you ask and what they want from you.',
        withinTier: 'No.'
    },
    {
        realm: 'immortal',
        count: 1,
        statement: 'Over the Lid, on one side of it or the other. Which side, nobody down here can tell you.',
        withinTier: 'No.'
    }
] satisfies BeliefRow[]).map(row => [row.realm, row])) as Partial<Record<RealmKey, BeliefRow>>;

/**
 * What people say, one row per rung of the actual ladder.
 *
 * A tier the believed table has nothing for gets an honest placeholder rather
 * than being dropped, so adding a realm cannot quietly shorten this report.
 */
export const BELIEVED_REACH: readonly BelievedReach[] = REALM_TIERS.map(tier => {
    const held = BELIEVED_BY_REALM[tier.key];
    const statedAs: BeliefUnit = held?.count === undefined ? 'share' : 'headcount';
    return {
        realm: tier.key,
        name: tier.name,
        // A tallied belief still reports a share, so the admin table has one
        // comparable column all the way up - but it is DERIVED from the tally
        // and the population rather than being a number somebody made up with
        // eight zeros in it.
        approximateShare:
            held?.count !== undefined
                ? held.count / CULTIVATOR_POPULATION
                : held?.share ?? 0,
        statedAs,
        approximateCount: held?.count ?? null,
        statement: held?.statement ?? 'Nobody says, and nobody who would know is talking.',
        withinTier: held?.withinTier ?? 'No.'
    };
});

export function believedReachFor(realm: RealmKey): BelievedReach | null {
    return BELIEVED_REACH.find(b => b.realm === realm) ?? null;
}

/**
 * What the player is shown.
 */
export function believedStatement(realm: RealmKey): string {
    return believedReachFor(realm)?.statement ?? 'Nobody says.';
}

// THE TOP OF THE TABLE IS A STOCK, NOT A SHARE

/**
 * Years of record the two regions can actually date a crossing across.
 *
 * The oldest entry anybody can put a year on is the Hollow Court's first, and
 * everything before that is a tradition rather than a record.
 */
export const CROSSING_RECORD_YEARS = 4_400;

/**
 * Crossings ATTEMPTED per thousand years, in the present age.
 */
export const CROSSINGS_ATTEMPTED_PER_MILLENNIUM = 6;

/**
 * How long a False Immortal stays in the world before going looking.
 */
export const FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS = 500;

export interface ImmortalStock {
    /** Attempts per millennium the record supports. */
    attemptsPerMillennium: number;
    /** Of those attempts, how many land where. Measured from the engine. */
    landings: { trueImmortal: number; falseImmortal: number; dead: number; stranded: number };
    /** False Immortals produced per millennium. */
    falseImmortalsPerMillennium: number;
    /**
     * Expected number standing in the world at any moment: production times
     * mean residence. THIS is the number the setting constrains to one to three,
     * and it is a residence count rather than a production count.
     */
    expectedResident: number;
    /** True Immortals produced per millennium. They are not resident at all. */
    trueImmortalsPerMillennium: number;
}

/**
 * What the world should be holding, given a measured per-attempt outcome split.
 */
export function immortalStock(
    landings: ImmortalStock['landings'],
    opts: { attemptsPerMillennium?: number; meanResidenceYears?: number } = {}
): ImmortalStock {
    const attempts = opts.attemptsPerMillennium ?? CROSSINGS_ATTEMPTED_PER_MILLENNIUM;
    const residence = opts.meanResidenceYears ?? FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS;
    const total =
        landings.trueImmortal + landings.falseImmortal + landings.dead + landings.stranded;
    const share = (n: number) => (total > 0 ? n / total : 0);

    const falsePerMillennium = attempts * share(landings.falseImmortal);
    return {
        attemptsPerMillennium: attempts,
        landings,
        falseImmortalsPerMillennium: falsePerMillennium,
        // Little's law, and it is the whole argument: a queue whose arrivals are
        // rare and whose residents leave quickly is nearly always empty, however
        // long the residents could in principle have stayed.
        expectedResident: (falsePerMillennium / 1000) * residence,
        trueImmortalsPerMillennium: attempts * share(landings.trueImmortal)
    };
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
            // THE RUNG THEY ARE STANDING ON, which this omitted.
            const rate = computeCultivationRate({
                spiritRoot: root.key, injuries, realmOrdinal: ordinal
            }, ambient, {
                focusMultiplier: focus,
                locationBonus,
                techniqueBonus: 1 + attributes.insight * 0.06
            }).perDay;

            const required = progressRequiredForOrdinal(ordinal);
            // Through the Lid, and out of this simulation's units. Nothing
            // above it is priced in qi, so the walk stops here.
            if (required === null) break;
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
                // The wounds have to be here. `attemptBreakthrough` runs this same
                // gate against the full cultivator, so a check made against a
                // subject missing a field the gate reads says "eligible" and is
                // then refused a line later - which is a throw rather than an
                // outcome. That went unnoticed while every refusal was about
                // progress; a cultivator halted at a wall carries the reason in
                // their wound list.
                injuries,
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
