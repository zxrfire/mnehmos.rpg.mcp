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

/**
 * How many people in the two regions ever gather qi at all.
 *
 * The denominator every "one in N" in this file is secretly quoting, written
 * down because leaving it implicit is how the table went wrong.
 *
 * Nobody in the world has counted, so it is triangulated from two things the
 * setting does commit to, which agree:
 *
 *   - Foundation Establishment is believed to be one in forty, and the two
 *     provinces between them hold on the order of twenty houses with something
 *     like twenty-five Foundation-and-above members each. Five hundred people
 *     at one in forty is twenty thousand.
 *   - Core Formation is believed to be one in five hundred, and "a sect with
 *     two at Core Formation considers itself well off". Forty such people at
 *     one in five hundred is twenty thousand.
 *
 * TWENTY THOUSAND, not billions. That number is the whole reason the top of
 * this table had to be rewritten: it used to descend by a factor of ten per
 * realm all the way to two per billion at Tribulation Transcendence, which is
 * a figure that requires three and a half billion cultivators before it
 * describes a single person. Two provinces do not contain three and a half
 * billion of anything.
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
     *
     * Below Nascent Soul they divide: they have met enough cultivators for a
     * proportion to mean something, and they say "one in forty". Above it they
     * COUNT, because a share stops carrying information the moment the true
     * figure is smaller than one person - "one in five million" and "one in
     * fifty million" are the same sentence to everybody who says either, and
     * neither of them is how a real person describes the four people at Void
     * Refinement they could name if pressed.
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
 *
 * These are what a reasonably informed cultivator would tell you, and they are
 * deliberately not the measured numbers. Where they are wrong, they are wrong
 * in the direction people are wrong: optimistic near the bottom, where everyone
 * knows somebody who made it, and LOW at the top, which is the correction this
 * table needed most.
 *
 * ── Why the top of this table was rebuilt ────────────────────────────────
 *
 * It used to fall by a clean factor of ten per realm from Nascent Soul upward,
 * ending at two per billion for Tribulation Transcendence. That is a tidy
 * curve and it describes a different world: it needs three and a half billion
 * cultivators before it produces one such person, and the setting is two
 * provinces holding perhaps twenty thousand people who ever gather qi at all
 * (see {@link CULTIVATOR_POPULATION}). Against that denominator the old top
 * rows were not pessimistic, they were unreadable - every one of them rounded
 * to nobody, including the realms whose members the Standing Register lists by
 * name.
 *
 * So above Core Formation the belief is now a TALLY, which is what people
 * actually trade in up there. Nobody says "one in five million" about the Void
 * Refinement cultivators in their province; they say "there are four, and three
 * of them are at the Pavilion". And the tally is deliberately LOW against what
 * the world actually holds, because most of the stratum is sealed, withdrawn or
 * pinned and has been for centuries. The mountains guess, and they guess low,
 * because the people up there are not visible on purpose.
 *
 * Keyed rather than positional, and {@link BELIEVED_REACH} is built from
 * `REALM_TIERS` rather than written out beside it. The ladder has already grown
 * a rung once while this file existed; a positional array would have silently
 * mismatched every row above the insertion point instead of failing.
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
        statement: 'Four, if you count the one under the Marches, and people argue about whether to.',
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
 *
 * The vague in-world sentence, never a figure to three decimal places. If a
 * player wants better than this they should have to buy it from somebody whose
 * business is knowing, and that transaction is a knowledge record.
 */
export function believedStatement(realm: RealmKey): string {
    return believedReachFor(realm)?.statement ?? 'Nobody says.';
}

// ─────────────────────────────────────────────────────────────────────────
// THE TOP OF THE TABLE IS A STOCK, NOT A SHARE
//
// Every row above is a share of a population. The two rungs above the Lid are
// not, and treating them as one is the mistake that made the last crossing look
// unbalanced.
//
// A True Immortal LEAVES. They are not in the world any more, so no count of
// people in the world constrains how many the crossing produces - only the
// ancestral records do, and those are kept by the houses that produced them.
//
// A False Immortal does not leave, and has three hundred thousand years. For a
// long time that was read as "they accumulate and never die off", which forces
// the production rate to be almost zero: any ordinary rate, integrated over the
// four and a half thousand years the records cover, gives a dozen of them
// standing about, and the setting has exactly one.
//
// THAT READING WAS WRONG, and the correction is the most interesting fact about
// the rank. A False Immortal has an unattemptable eternity: the one thing they
// were built to do is permanently shut against them, and no amount of the
// enormous time they have left changes it. So they do not sit still. They go
// looking - down old seams, out past the edge of anywhere with a name, at
// whatever they can find that might be an answer - and going looking is what
// kills them. Their span is not what ends them; the search is.
//
// So residence is production times how long they stay, and they do not stay
// long. Lu Sheng is not the only False Immortal the world has ever made. He is
// the one who STAYED, which is a much better fact about him and fits everything
// already written: barred from the only work that mattered, six hundred years
// of nothing to attempt, and a stated want of knowing what the far side
// declined. Everyone else with his problem went to find out.
//
// Nothing here feeds back into the simulation. It is the arithmetic that says
// what the world should contain, so a designer can check whether it does.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Years of record the two regions can actually date a crossing across.
 *
 * The oldest entry anybody can put a year on is the Hollow Court's first, and
 * everything before that is a tradition rather than a record.
 */
export const CROSSING_RECORD_YEARS = 4_400;

/**
 * Crossings ATTEMPTED per thousand years, in the present age.
 *
 * Read off the datable entries rather than modelled: a declined crossing 160
 * years ago, an attempt that killed the candidate 90 years ago, Lu Sheng 640
 * years ago, a completion 380 years ago. Four events a court could put a year
 * on inside seven centuries is roughly one every hundred and sixty years, and
 * the courts do not hear about all of them. Six per thousand years is the
 * conservative reading of that.
 */
export const CROSSINGS_ATTEMPTED_PER_MILLENNIUM = 6;

/**
 * How long a False Immortal stays in the world before going looking.
 *
 * Five hundred years against a span of three hundred thousand, which is the
 * number that makes the residence count come out at one to three. It is not a
 * lifespan and must never be read as one: they are not dying of age at five
 * hundred, they are LEAVING at five hundred, and most of them do not come back.
 * Lu Sheng at six hundred and forty years resident is already unusual, which is
 * exactly what the setting says about him.
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
 *
 * The caller supplies the landings - from a sweep, or from
 * `assessLastCrossing` - so this function never guesses at the engine's own
 * numbers and cannot drift away from them.
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
