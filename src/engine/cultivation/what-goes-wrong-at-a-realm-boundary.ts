/**
 * What a crossing does to somebody when it goes wrong.
 *
 * `breakthrough.ts` decides WHETHER a crossing succeeds. This decides what kind
 * of ruin a failure is, and it exists because "failed the boundary, took a
 * meridian injury" was the same sentence at all nine walls of the ladder. A
 * cultivator who cannot form a golden core and one whose infant soul comes out
 * of the birthing wrong are not having the same accident, and the world is
 * supposed to be full of the difference.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THIS FILE IS BUILT AROUND: FAILURE IS NOT BINARY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every outcome here is survivable and ruinous. That combination is the entire
 * design: a wall that only kills produces corpses, and corpses are not people a
 * player can meet. What the setting needs and could not previously produce is a
 * POPULATION - the maimed, the halted, the half mad, the ones who burnt their
 * span to get through and can never afford to do it again. Each of those is
 * somebody standing at a rung with a reason, and the reason is a row in
 * `data/cultivation/wounds.ts` that a narrator reads instead of inventing.
 *
 * The most important of them is the one that has no name in most fiction: a
 * cultivator who crossed and can never cross again. Alive, at the new rung,
 * finished. Nothing in this engine could produce that person before.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHICH TRIAL YOU FACE IS DECIDED BY WHERE YOU STAND
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `trialForOrdinal` takes an ordinal and nothing else, which is deliberately
 * the same contract `triggersHeavenlyTribulation` already has, for the reason
 * `docs/world/manuals.md` gives: a manual cannot teach you the crossing. Two
 * cultivators at the same wall meet the same thing whatever they practise, and
 * what a better book contributes is the foundation it spent the whole realm
 * building, arriving there with them. Do not add a parameter to this function.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING BESPOKE: ONE TABLE, NOT NINE SPECIAL CASES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is exactly one mechanism here, parameterised per boundary:
 *
 *   1. `trialForOrdinal(ordinal)` names the trial.
 *   2. `CROSSING_OUTCOMES` is a flat registry of ways a crossing can ruin
 *      somebody. Each row carries its OWN weight per trial.
 *   3. `resolveCrossingFailure` draws one row against those weights and
 *      returns deltas. It does not branch on the boundary anywhere.
 *
 * THE WEIGHTS LIVE ON THE OUTCOME, NOT ON THE TRIAL, and that is the whole
 * reason for the shape. The named set - foundation destroyed, mad, half mad,
 * maimed, halted, span burnt - is explicitly illustrative rather than
 * exhaustive, so a per-boundary table of hard-coded outcomes would mean a tenth
 * outcome touched nine boundaries. Written this way, a tenth outcome is one
 * object appended to the registry with weights wherever it applies, and every
 * boundary it does not apply to is not edited at all. `outcomesForTrial` gives
 * back the per-boundary view for anybody reading.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY OUTCOME IS REPRESENTED IN STATE THE REST OF THE ENGINE ALREADY READS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No outcome invents a field. This is the constraint that decides whether the
 * design is real, because a half-mad cultivator expressed in a state nothing
 * downstream reads is a half-mad cultivator nobody will ever notice.
 *
 *   foundation destroyed   `foundationQuality` -> 'rebuilt', through the
 *                          existing `rebuildFoundation`. Already a permanent
 *                          multiplier on rate, odds and the toll.
 *   maimed                 an `Injury` of a permanent wound type. Priced by
 *                          `aggregateInjuryPenalties` forever, excluded from
 *                          the bleed clock by `bleedingInjuryCount`.
 *   half mad               the same, `nature: 'mental'`. One list, two natures.
 *   fully mad              the same, plus `soulState` and
 *                          `identityContinuity` - the field whose own comment
 *                          says it is what stops a remnant being mistaken for
 *                          the person who left it.
 *   span burnt             `age`. Read by `lifespanPressure`, by the lifespan
 *                          death check, and by `stagnationYearsForOrdinal`.
 *   halted                 `foundationQuality` -> 'incomplete', which
 *                          `assessFoundation` already produces and the whole
 *                          engine already prices at -0.08 on every subsequent
 *                          crossing.
 *
 * So the deltas returned here are all writes to fields that existed before this
 * file did, and the caller applies them the way it applies any other result.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES NOT TOUCH
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The last crossing. Ordinals 40 through 44 summon heavenly lightning and that
 * is authored, tested and decided - `triggersHeavenlyTribulation` owns them,
 * `resolveTribulation` and `resolveLastCrossing` resolve them, and
 * `trialForOrdinal` returns 'heavenly_lightning' there so this module's table
 * is never consulted. The escalation belongs below it.
 *
 * Pure. State in, deltas out, no mutation of inputs, one seeded stream.
 */

import type {
    Cultivator,
    FoundationQuality,
    Injury,
    InjurySeverity,
    SoulState
} from '../../schema/cultivation.js';
import { isRealmBoundary, realmForOrdinal, triggersHeavenlyTribulation } from './realms.js';
import { createInjury } from './injuries.js';
import { foundationOf, rebuildFoundation } from './foundation.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TRIALS
//
// One per realm boundary below Tribulation Transcendence, named for what the
// crossing is actually DOING rather than for the realm it arrives at. The realm
// descriptions in `realms.ts` already say what each one does; these names are
// those sentences with the verb pulled to the front, so that a reader can tell
// from the trial name alone why the failure table looks the way it does.
// ─────────────────────────────────────────────────────────────────────────

export type TrialKind =
    /** 12 -> 13. Accumulated qi is converted into a permanent structure. */
    | 'the_setting_of_the_foundation'
    /** 16 -> 17. The foundation is condensed into a golden core. */
    | 'the_condensation'
    /** 20 -> 21. The core births an infant soul that is not the cultivator. */
    | 'the_birthing'
    /** 24 -> 25. Body and soul are taken apart and merged. */
    | 'the_merging'
    /** 28 -> 29. The self is refined against emptiness and comes back smaller. */
    | 'the_emptiness'
    /** 32 -> 33. Soul and body are made indivisible, seam by seam. */
    | 'the_joining'
    /** 36 -> 37. Everything is raised at once, and it points at the sky. */
    | 'the_ascent'
    /** 40 -> 44. Authored elsewhere and not this module's business. */
    | 'heavenly_lightning'
    /** Not a boundary at all. A sub-rank step is a wasted stretch of time. */
    | 'none';

/**
 * Which trial an attempt FROM this ordinal faces.
 *
 * Ordinal in, trial out, and nothing else in the signature. See the banner:
 * this is the same contract `triggersHeavenlyTribulation` has and it is right
 * for the same reason. Do not add a parameter.
 *
 * Lightning is checked first so the four ordinals the final realm owns can
 * never fall through into the table below, including the last crossing.
 */
export function trialForOrdinal(ordinal: number): TrialKind {
    if (triggersHeavenlyTribulation(ordinal)) return 'heavenly_lightning';
    if (!isRealmBoundary(ordinal)) return 'none';
    // Keyed off the realm being crossed INTO, which is the thing being attempted.
    switch (realmForOrdinal(ordinal + 1).key) {
        case 'foundation_establishment': return 'the_setting_of_the_foundation';
        case 'core_formation': return 'the_condensation';
        case 'nascent_soul': return 'the_birthing';
        case 'deity_transformation': return 'the_merging';
        case 'void_refinement': return 'the_emptiness';
        case 'body_integration': return 'the_joining';
        case 'grand_ascension': return 'the_ascent';
        default: return 'none';
    }
}

/** Human-readable account of what the trial is, for the narrator and the UI. */
export const TRIAL_DESCRIPTIONS: Record<TrialKind, string> = {
    the_setting_of_the_foundation:
        'Everything gathered so far is spent at once and set as a permanent structure. It either takes the shape it is supposed to take or it sets in the shape it happens to be in, and it cannot be re-poured.',
    the_condensation:
        'The foundation is squeezed inward until it becomes a core. What is being compressed is the only thing the cultivator has ever built, and compression is the one operation that can destroy it outright.',
    the_birthing:
        'The core produces an infant soul which is, briefly, a second thing inside the body with its own continuity. Everything the cultivator has never settled is present at that meeting and has a say in what comes out of it.',
    the_merging:
        'Body and soul are taken apart and put back together as one thing. The reassembly is done from what is there, and anything missing at the moment of it is missing afterward.',
    the_emptiness:
        'The self is put into emptiness and drawn out smaller and harder. Nothing is added here. What the emptiness keeps, it keeps.',
    the_joining:
        'Soul and body are welded along every seam, outermost inward. A seam that does not take is a seam that stays open, and it stays open at a rung where everything moving through it is enormous.',
    the_ascent:
        'Body, soul, name and dao are raised in that order, and the raising is paid for out of the cultivator rather than out of the world. Whatever is short at the end is made up from the span.',
    heavenly_lightning:
        'The Lid discharges while it decides whether the hole about to be punched is worth the qi it will cost to seal. Authored in breakthrough.ts; this table is not consulted.',
    none: 'A step between sub-ranks. Expensive, and not a wall.'
};

// ─────────────────────────────────────────────────────────────────────────
// THE OUTCOME REGISTRY
//
// A flat list of ways a crossing ruins somebody. Weights live on the outcome,
// keyed by trial, so a new outcome is one object and no boundary is edited.
// An absent weight is zero: an outcome simply does not happen at a trial it
// says nothing about.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deltas a failed crossing produces. Every field is optional and absent means
 * "unchanged", so a caller applies only what actually happened.
 *
 * Nothing here is applied by this module. It returns what to write.
 */
export interface CrossingConsequence {
    /** Wounds to append to the person's list. Physical or mental. */
    injuries: Injury[];
    /** New foundation quality, when the crossing reached into the structure. */
    foundationQuality?: FoundationQuality;
    /** Years to ADD to `age`. The span that was spent rather than lived. */
    yearsBurned?: number;
    /** New soul state, when what came back is not what went in. */
    soulState?: SoulState;
    /** New `identityContinuity`, 0..1. How much of the original person this is. */
    identityContinuity?: number;
    /**
     * True when this cultivator can never cross a realm boundary again.
     *
     * The important one. Represented by an 'incomplete' foundation plus this
     * flag, so a caller that persists nothing new still gets a cultivator whose
     * odds are permanently worse, and a caller that reads it gets the hard
     * answer. See `isHalted`.
     */
    halted?: boolean;
}

export interface CrossingOutcome {
    key: string;
    /** What this reads as in a digest. Factual; the narrator renders it. */
    summary: string;
    /**
     * Relative likelihood at each trial. Absent means it cannot happen there.
     *
     * THIS IS WHERE THE ESCALATION LIVES. The ladder gets worse upward not
     * because any constant was made crueller but because the ruinous rows carry
     * weight at the high walls and none at the low ones. Qi Condensation to
     * Foundation Establishment is where every run starts and is deliberately
     * the mildest column in the table.
     */
    weights: Partial<Record<TrialKind, number>>;
    /** Deltas. Pure, seeded, and never touching the subject it is handed. */
    apply(subject: CrossingSubject, rng: CultivationRNG, ctx: CrossingContext): CrossingConsequence;
}

export type CrossingSubject = Pick<Cultivator, 'realmOrdinal' | 'injuries'> &
    Partial<Pick<Cultivator, 'foundationQuality' | 'age' | 'identityContinuity'>>;

export interface CrossingContext {
    /** Turn stamped onto any wound sustained. */
    turn: number;
}

/** Mint a wound of an authored type at a given severity. */
function wound(
    ctx: CrossingContext,
    rng: CultivationRNG,
    woundType: string,
    severity: InjurySeverity,
    source: Injury['source'] = 'failed_breakthrough'
): Injury {
    return createInjury({ severity, source, turn: ctx.turn, woundType }, rng);
}

/**
 * Years burned, as a fraction of the span the CURRENT rung grants.
 *
 * Proportional rather than flat, for the same reason deviation's progress loss
 * is proportional: the spans on this ladder run from 100 years to 100,000 and a
 * flat figure would be an execution at the bottom and a rounding error at the
 * top.
 *
 * The trap this creates is arithmetic rather than asserted, and it is worth
 * stating because it is the whole point of the outcome. Rank buys years - that
 * is the ordinary way anybody in this world gets more time - so burning years
 * to go up leaves the cultivator holding a shorter clock at a rung whose next
 * wall costs more to reach than the last one did. `progressRequiredForOrdinal`
 * grows at 1.35 per rung and a realm's span does not grow anywhere near that
 * fast, so the fraction of a life one crossing costs rises the whole way up.
 * Burn a fifth of a span at the Deity Transformation wall and the arithmetic
 * for the next wall has already stopped working. And `stagnationYearsForOrdinal`
 * is waiting underneath: settling kills anybody who plateaus longer than their
 * rank allows, and this person arrived with less room than anybody else at it.
 */
export const SPAN_BURNED_FRACTION = { min: 0.08, max: 0.22 } as const;

export const CROSSING_OUTCOMES: readonly CrossingOutcome[] = [
    // ── The ordinary end. What most wounding failures at most walls are.
    //
    // This row is the one the old code produced unconditionally at every wall,
    // and it still carries the bulk of the weight everywhere. The table did not
    // make boundaries nastier; it made them DIFFERENT from each other, and the
    // commonest thing that happens at all of them is still torn meridians.
    {
        key: 'torn',
        summary: 'Meridians tore under the attempt.',
        weights: {
            the_setting_of_the_foundation: 88,
            the_condensation: 66,
            the_birthing: 54,
            the_merging: 46,
            the_emptiness: 40,
            the_joining: 38,
            the_ascent: 32
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'torn-meridians', rng.next() < 0.6 ? 'serious' : 'minor')]
        })
    },
    {
        key: 'scorched',
        summary: 'Qi was forced through faster than the channels could pass it.',
        weights: {
            the_setting_of_the_foundation: 12,
            the_condensation: 10,
            the_birthing: 8,
            the_merging: 8,
            the_emptiness: 8,
            the_joining: 8,
            the_ascent: 8
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'scorched-channels', rng.next() < 0.5 ? 'minor' : 'serious')]
        })
    },

    // ── The foundation blows up. The condensation is where it belongs. ──
    {
        key: 'foundation_shattered',
        summary: 'The foundation came apart under the compression. What was built is gone.',
        weights: {
            // Nothing to shatter at the first wall - the foundation is being
            // laid there, not compressed - so this row is simply absent from it.
            the_condensation: 14,
            the_birthing: 5,
            the_merging: 4,
            the_emptiness: 3,
            the_joining: 3,
            the_ascent: 3
        },
        apply: (subject, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'foundation-shattered', 'crippling')],
            // Laid again out of the wreckage. 'rebuilt' is strictly worse than
            // 'stable' and strictly better than 'damaged', which is exactly the
            // charter's "loss branches rather than subtracts".
            foundationQuality: rebuildFoundation(foundationOf(subject))
        })
    },

    // ── An incomplete foundation, and unable to continue. ──
    {
        key: 'reservoir_ruined',
        summary:
            'The reservoir cracked rather than the channels. The cultivator is alive, at the rung they were on, and will not cross another boundary.',
        weights: {
            // NOT AT THE FIRST WALL, and this is a deliberate exclusion rather
            // than an oversight. Qi Condensation to Foundation Establishment is
            // where every run starts, and a permanent bar there ends a life
            // before it has begun - measured, it halted cultivators at ordinal
            // 12 holding the full price, which is the exact brutality the low
            // ladder is supposed to be free of. Failing to SET a foundation is
            // already modelled, on the success path, by `assessFoundation`
            // handing back 'incomplete' or 'damaged'.
            //
            // So the halt starts at the second wall, where it also happens to
            // describe the commonest figure in the setting: the Foundation
            // Establishment elder who never made Core Formation, is perfectly
            // respectable, and stopped.
            //
            // Rises with altitude from there: the higher the wall, the more of
            // the person is load-bearing when it fails to set.
            the_condensation: 4,
            the_birthing: 5,
            the_merging: 6,
            the_emptiness: 7,
            the_joining: 8,
            the_ascent: 9
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'ruined-dantian', 'crippling')],
            // 'incomplete' is a quality `assessFoundation` already produces and
            // the whole engine already prices. Nothing new is being invented to
            // carry this; what is new is that it can now happen after ordinal 12.
            foundationQuality: 'incomplete',
            halted: true
        })
    },

    // ── Maiming. The merging is where the body comes back wrong. ──
    {
        key: 'maimed',
        summary: 'A channel was parted rather than torn, and healed closed. The route is gone.',
        weights: {
            the_condensation: 4,
            the_birthing: 5,
            the_merging: 12,
            the_emptiness: 8,
            the_joining: 11,
            the_ascent: 8
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'severed-meridian', rng.next() < 0.5 ? 'serious' : 'crippling')]
        })
    },

    // ── The mind. The birthing and the emptiness are where it goes. ──
    {
        key: 'heart_demon',
        summary: 'Something unsettled surfaced during the crossing and did not go back down.',
        weights: {
            the_setting_of_the_foundation: 3,
            the_condensation: 5,
            the_birthing: 14,
            the_merging: 8,
            the_emptiness: 12,
            the_joining: 7,
            the_ascent: 8
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'heart-demon', rng.next() < 0.5 ? 'minor' : 'serious', 'qi_deviation')]
        })
    },
    {
        key: 'half_mad',
        summary:
            'A heart demon was carried through instead of settled, and is now part of how this person cultivates.',
        weights: {
            the_birthing: 8,
            the_merging: 5,
            the_emptiness: 10,
            the_joining: 6,
            the_ascent: 7
        },
        apply: (_s, rng, ctx) => ({
            injuries: [
                wound(ctx, rng, 'heart-demon-rooted', rng.next() < 0.6 ? 'serious' : 'crippling', 'qi_deviation')
            ],
            soulState: 'damaged',
            // Functional and not right. Still overwhelmingly themselves, which
            // is what makes them employable, meetable and unreliable.
            identityContinuity: 0.75
        })
    },
    {
        key: 'mad',
        summary:
            'The demon is what is steering. The cultivation is intact and the person using it is not the one who went in.',
        weights: {
            // The rarest row in the table and the worst thing in it. Weighted
            // only where there is enough of a person to lose: a Qi Condensation
            // cultivator going mad is a tragedy, and a Grand Ascension one going
            // mad is a world event with legs.
            the_birthing: 3,
            the_merging: 2,
            the_emptiness: 4,
            the_joining: 4,
            the_ascent: 6
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'heart-demon-ascendant', 'crippling', 'qi_deviation')],
            soulState: 'fragmented',
            // Low, and deliberately not zero. `identityContinuity` is the field
            // that stops a remnant being mistaken for the person who left it,
            // and this is the same question asked of somebody still walking
            // around: how much of them is this. Enough is left to remember the
            // grudges, hold the techniques and know the way home, which is
            // precisely what makes it dangerous rather than merely sad.
            identityContinuity: 0.2
        })
    },
    {
        key: 'memory_taken',
        summary: 'The crossing took a stretch of the life with it.',
        weights: {
            the_birthing: 4,
            the_merging: 5,
            the_emptiness: 8,
            the_joining: 5,
            the_ascent: 5
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'sundered-recall', rng.next() < 0.6 ? 'minor' : 'serious', 'qi_deviation')],
            identityContinuity: 0.85
        })
    },
    {
        key: 'fixed_premise',
        summary: 'Something concluded under the pressure of the crossing was set beyond revision.',
        weights: {
            the_birthing: 4,
            the_merging: 4,
            the_emptiness: 6,
            the_joining: 5,
            the_ascent: 6
        },
        apply: (_s, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'the-fixed-premise', rng.next() < 0.7 ? 'minor' : 'serious', 'qi_deviation')]
        })
    },

    // ── The span. The ascent is where the raising is paid for out of the life. ──
    {
        key: 'span_burnt',
        summary: 'The shortfall was made up out of the span. The crossing was bought with years.',
        weights: {
            the_merging: 4,
            the_emptiness: 6,
            the_joining: 8,
            the_ascent: 14
        },
        apply: (subject, rng, ctx) => {
            const span = realmSpan(subject.realmOrdinal);
            const fraction =
                SPAN_BURNED_FRACTION.min +
                rng.next() * (SPAN_BURNED_FRACTION.max - SPAN_BURNED_FRACTION.min);
            return {
                injuries: [wound(ctx, rng, 'span-burnt', fraction > 0.15 ? 'crippling' : 'serious')],
                yearsBurned: span * fraction
            };
        }
    }
];

/** The span the cultivator's CURRENT rung grants, which is what gets burned. */
function realmSpan(ordinal: number): number {
    return realmForOrdinal(ordinal).lifespanYears;
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE TABLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The outcomes that can actually happen at a trial, with their weights.
 *
 * The per-boundary view, derived rather than authored, so that adding an
 * outcome never requires editing a boundary. Sorted heaviest first, which is
 * the order a designer wants to read them in.
 */
export function outcomesForTrial(trial: TrialKind): { outcome: CrossingOutcome; weight: number }[] {
    return CROSSING_OUTCOMES
        .map(outcome => ({ outcome, weight: outcome.weights[trial] ?? 0 }))
        .filter(row => row.weight > 0)
        .sort((a, b) => b.weight - a.weight);
}

/**
 * Draw one outcome for a trial from a seeded stream.
 *
 * Consumes exactly one sample, always, so a caller rolling afterwards on the
 * same stream stays aligned. Returns null only where the trial has no table -
 * lightning and sub-rank steps - which is a legitimate answer meaning "this is
 * not this module's business".
 */
export function drawCrossingOutcome(trial: TrialKind, rng: CultivationRNG): CrossingOutcome | null {
    const rows = outcomesForTrial(trial);
    const sample = rng.next();
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    let cursor = sample * total;
    for (const row of rows) {
        cursor -= row.weight;
        if (cursor < 0) return row.outcome;
    }
    return rows[rows.length - 1].outcome;
}

export interface CrossingFailure {
    trial: TrialKind;
    outcome: CrossingOutcome | null;
    consequence: CrossingConsequence;
    narrationHint: string;
}

/**
 * Resolve what a failed crossing FROM `ordinal` did to this cultivator.
 *
 * Two samples, always: one to pick the outcome and however many the outcome's
 * own `apply` draws. Callers must not assume a fixed count beyond the first.
 *
 * Returns deltas. Applies nothing, mutates nothing.
 */
export function resolveCrossingFailure(
    subject: CrossingSubject,
    rng: CultivationRNG,
    ctx: CrossingContext
): CrossingFailure {
    const trial = trialForOrdinal(subject.realmOrdinal);
    const outcome = drawCrossingOutcome(trial, rng);
    if (outcome === null) {
        return {
            trial,
            outcome: null,
            consequence: { injuries: [] },
            narrationHint: TRIAL_DESCRIPTIONS[trial]
        };
    }
    const consequence = outcome.apply(subject, rng, ctx);
    return {
        trial,
        outcome,
        consequence,
        narrationHint: outcome.summary
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BEING HALTED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this cultivator has been stopped for good.
 *
 * Read off the wound list rather than off a flag, because the wound list is
 * what persists and what the narrator reads. A ruined dantian is the wound that
 * means "the reservoir will not hold a crossing again", and carrying one is
 * what being halted IS - there is no second field that could disagree with it.
 *
 * This is the population the setting most needed and could not previously
 * produce: somebody who crossed once, arrived, and will not arrive anywhere
 * else. They keep their rung, their span, their standing and their students.
 */
export const HALTING_WOUND = 'ruined-dantian';

/**
 * The broken status each crossing leaves when it lands badly, by trial.
 *
 * A STATUS ON TOP OF A RUNG, NEVER A RUNG OF ITS OWN. Somebody who cracks
 * going into Tribulation Transcendence is at ordinal 41 carrying a broken
 * step - not at "half-step 41", not at a fractional ordinal, not at a rank
 * inserted between 40 and 41. The ladder keeps its rungs; what varies is what
 * the person is carrying. That is what lets the world tell a 41 who is
 * climbing from a 41 who is finished without a special case anywhere in the
 * ladder itself.
 *
 * Each names the structure its own crossing was for, so the status reads as a
 * diagnosis. Adding a realm is adding a row here and a row in `WOUND_TYPES`.
 */
export const BROKEN_STATUS_FOR_TRIAL: Partial<Record<TrialKind, string>> = {
    the_setting_of_the_foundation: 'broken-foundation',
    the_condensation: 'cracked-core',
    the_birthing: 'stillborn-soul',
    the_merging: 'unmerged-self',
    the_emptiness: 'spoiled-temper',
    the_joining: 'open-seam',
    the_ascent: 'stalled-rising',
    // The crossing INTO Tribulation Transcendence. Lightning resolves whether
    // they survive it; this is what a survival that did not land clean leaves.
    heavenly_lightning: 'broken-step'
};

/** Every broken status, for the callers that need to recognise one. */
export const BROKEN_STATUSES: readonly string[] = Object.values(BROKEN_STATUS_FOR_TRIAL);

/**
 * The broken status a crossing FROM this ordinal would leave.
 *
 * Only meaningful at the crossing INTO Tribulation Transcendence among the
 * lightning ordinals: 41, 42 and 43 are steps within the realm and 44 is the
 * last crossing, which lands on its own two rungs and has its own answer. So
 * lightning maps to 'broken-step' only from ordinal 40.
 */
export function brokenStatusFor(ordinal: number): string | null {
    const trial = trialForOrdinal(ordinal);
    if (trial === 'heavenly_lightning') {
        return realmForOrdinal(ordinal).key === 'grand_ascension'
            ? BROKEN_STATUS_FOR_TRIAL.heavenly_lightning ?? null
            : null;
    }
    return BROKEN_STATUS_FOR_TRIAL[trial] ?? null;
}

/** The broken status this cultivator carries, if any. */
export function brokenStatusOf(injuries: readonly Injury[]): string | null {
    for (const injury of injuries) {
        if (injury.treated) continue;
        if (injury.woundType && BROKEN_STATUSES.includes(injury.woundType)) return injury.woundType;
    }
    return null;
}

/**
 * Whether this cultivator has been stopped for good.
 *
 * Read off the wound list rather than off a flag, because the wound list is
 * what persists and what the narrator reads. There is no second field that
 * could disagree with it.
 *
 * Two ways to be here, and they are different stories. A broken status means
 * they CROSSED and arrived and the structure did not take - they are at the new
 * rung, permanently. A ruined dantian means the reservoir itself went, which
 * can happen without arriving anywhere. Both end the climb.
 *
 * This is the population the setting most needed and could not previously
 * produce. They keep their rung, their span, their standing and their students.
 */
export function isHalted(subject: Pick<Cultivator, 'injuries'>): boolean {
    return subject.injuries.some(
        i => !i.treated && (i.woundType === HALTING_WOUND || (i.woundType !== null && BROKEN_STATUSES.includes(i.woundType)))
    );
}

// ─────────────────────────────────────────────────────────────────────────
// ARRIVING BROKEN
//
// The success side of the same design, and the half the original ruling
// actually asked for: "you are alive, you are at the new rung, and you can
// never go further". A failure leaves somebody where they were; only a
// SUCCESS can leave them one rung higher and finished.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance that a successful crossing lands badly, by trial.
 *
 * Deliberately small and rising with altitude, and deliberately ZERO at the
 * first wall: Qi Condensation to Foundation Establishment is where every run
 * starts, and a permanent bar there would end lives before they began. The
 * quality of a foundation laid at that crossing is already `assessFoundation`'s
 * business and it already has an 'incomplete' outcome.
 *
 * These are the rates that produce the standing population of the finished -
 * the Foundation elder who never made Core, the awake Transcender who will
 * never summon a tribulation - so they are the numbers to move if that
 * population comes out the wrong size.
 */
/**
 * ── WHY THESE ARE SO SMALL, WHICH IS MEASURED RATHER THAN CAUTIOUS ───────
 *
 * There is almost no room on this ladder for additional attrition, and the
 * figure that says so is `crossing.test.ts`: a best-case life must still end
 * above the Lid more than 30% of the time, and it does so at 32.7%. That is
 * 2.7 points of headroom to spend across EIGHT boundaries, for the
 * best-prepared cultivator the world can assemble.
 *
 * The first cut of this table - 3% to 10% per wall - spent all of it and more,
 * taking best-case lives above the Lid from 32.7% to 20.6% and failing that
 * test. So these rates are not a judgement about how dangerous a crossing ought
 * to feel; they are what fits in the space the ladder has left, and the ladder
 * had almost none. That is itself the strongest evidence against the rebalance
 * this work was originally scoped as.
 */
export const ARRIVES_BROKEN_CHANCE: Partial<Record<TrialKind, number>> = {
    // Zero at the first wall. Every run starts here and `assessFoundation`
    // already owns what a badly-laid foundation is worth.
    the_setting_of_the_foundation: 0,
    the_condensation: 0.012,
    the_birthing: 0.014,
    the_merging: 0.016,
    the_emptiness: 0.018,
    the_joining: 0.02,
    the_ascent: 0.024,
    // The crossing into the last realm, and the highest rate in the table. The
    // rule at this wall is that getting to it is your own effort - helpers are
    // allowed and medicine is not - so the pill that would answer a broken step
    // is barred at exactly the rung that needs it. It is the one broken status
    // with no treatment behind it at all.
    heavenly_lightning: 0.03
};

/**
 * How much the foundation changes the odds of landing badly.
 *
 * PREPARATION BUYS THE LANDING. This is the same statement the whole
 * cultivation layer already makes - a foundation laid unhurried in dense qi
 * puts a cultivator on a different curve for the rest of the run - applied to
 * the one moment that curve is cashed in. It is also what keeps the corridor
 * open: a best-case life crosses eight walls, and if each one broke them at the
 * unprepared rate the top of the ladder would close.
 *
 * Note this does NOT change which trial anybody faces. `trialForOrdinal` still
 * takes an ordinal and nothing else, and two cultivators at the same wall meet
 * the same thing. What differs is what they brought to it.
 */
export const BROKEN_FOUNDATION_FACTOR: Record<FoundationQuality, number> = {
    exceptional: 0.3,
    transformed: 0.5,
    stable: 1,
    none: 1,
    rebuilt: 1.4,
    unstable: 1.8,
    incomplete: 2.4,
    damaged: 2.8,
    sacrificed: 3.2
};

// ─────────────────────────────────────────────────────────────────────────
// THE CRUCIBLE
//
// What makes a broken status a situation rather than a dead end, and the part
// that is genuinely surprising: THE TRIBULATION ITSELF IS THE CURE. Clear the
// next crossing while carrying the status and the status is gone - the same
// pressure that broke the structure is the only thing that reseats it.
//
// So a broken cultivator has three real futures, and choosing between them is
// the mechanic:
//
//   settle    live out a long life at the rung. THE CORRECT PLAY, and it
//             should read as one off the numbers. A broken elder who stops is
//             not a failed character; the setting is full of them.
//   strike    and die, which is what almost always happens.
//   strike    and be the story. A repaired break is legend-rare - the kind of
//             thing a prefecture still talks about a century later.
//
// The odds are appalling on purpose (see `BROKEN_STATUS_STRAIN`) and the
// attempt is never refused. Nobody sensible tries it. People with nothing left
// to lose try it, and once in a very long while one of them arrives.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much carrying a broken status costs a breakthrough attempt.
 *
 * Enormous, and sized so that it dominates everything a cultivator can bring:
 * the whole legal attribute range is worth about 0.12 here, a perfect
 * foundation 0.06, and the best pill in the world multiplies rather than adds.
 * Against -0.55 all of that is noise, and a broken cultivator sits at or near
 * `MIN_BREAKTHROUGH_CHANCE` whatever they do.
 *
 * That is the intended reading. The floor is 2% and never zero - the heavens
 * are never certain and never merciful - so the attempt remains possible,
 * remains visible in the ledger, and remains something no sane person takes.
 */
export const BROKEN_STATUS_STRAIN = -0.55;

/**
 * Whether clearing a crossing repairs this status.
 *
 * True for every break below the last realm. FALSE for a broken step, and the
 * reason is a rule rather than a shortage: getting to Tribulation
 * Transcendence is your own effort, helpers are allowed at that crossing and
 * medicine is not, so the one thing that would answer a broken step is barred
 * at exactly the rung that needs it. The only exit named for it is an Immortal
 * coming down and using Law on the problem, which has happened once on the
 * record and is not something anybody should plan around.
 *
 * Read off the status rather than off the ordinal, so a new break added to the
 * table declares its own answer instead of being special-cased here.
 */
export const REPAIRED_IN_THE_CRUCIBLE: Record<string, boolean> = {
    'broken-foundation': true,
    'cracked-core': true,
    'stillborn-soul': true,
    'unmerged-self': true,
    'spoiled-temper': true,
    'open-seam': true,
    'stalled-rising': true,
    'broken-step': false
};

/** Whether a successful crossing would clear this status. */
export function isRepairableInTheCrucible(status: string | null): boolean {
    return status !== null && (REPAIRED_IN_THE_CRUCIBLE[status] ?? false);
}

/**
 * The status a successful crossing from `ordinal` would repair, if any.
 *
 * Null when they carry nothing, or when what they carry is a broken step -
 * which no crossing repairs.
 */
export function brokenStatusRepairedBy(
    injuries: readonly Injury[]
): string | null {
    const status = brokenStatusOf(injuries);
    return isRepairableInTheCrucible(status) ? status : null;
}

/**
 * Remove a repaired status from a wound list. Pure; returns a new array.
 *
 * The wound is DROPPED rather than marked treated, because it was not treated -
 * nothing closed it, the structure was reseated and the injury is no longer a
 * fact about this person. Marking it treated would leave it counting as scar
 * tissue against `SCAR_PLATEAU`, which would charge somebody attrition for a
 * wound they no longer have.
 */
export function clearBrokenStatus(injuries: readonly Injury[], status: string): Injury[] {
    return injuries.filter(i => i.woundType !== status);
}

/**
 * Whether a SUCCESSFUL crossing from `ordinal` arrives broken, and as what.
 *
 * Consumes exactly one sample, always, so the stream stays aligned whatever it
 * decides. Returns null when the crossing landed clean, which is the
 * overwhelmingly ordinary case.
 */
export function rollArrivesBroken(
    ordinal: number,
    rng: CultivationRNG,
    foundation: FoundationQuality = 'none'
): string | null {
    const trial = trialForOrdinal(ordinal);
    const chance = (ARRIVES_BROKEN_CHANCE[trial] ?? 0) * BROKEN_FOUNDATION_FACTOR[foundation];
    const sample = rng.next();
    if (sample >= chance) return null;
    return brokenStatusFor(ordinal);
}
