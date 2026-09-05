/**
 * What a crossing does to somebody when it goes wrong.
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
import { currentWoundKey } from '../../data/cultivation/wounds.js';
import type { CultivationRNG } from './rng.js';

// THE FIVE WAYS A CROSSING ENDS
//
// Five KINDS of thing, not five points on a scale of badness. The second and
// fourth are the ones that get confused with each other.
//
//   1  CLEAN SUCCESS. Across, and possibly hurt on the way - but hurt in ways
//      ORDINARY MEDICINE MENDS. Not that nothing happened: that what happened
//      has an answer somebody can afford.
//
//   2  BROKEN SUCCESS. Across, and the structure the crossing was FOR did not
//      set. THIS IS THE ONLY SOURCE OF A STRUCTURAL BREAK, and the only source
//      of a closed road, which makes broken and halted the same set. Every
//      broken cultivator in the world is somebody who SUCCEEDED and paid for it,
//      which is why they price above the realm below them.
//
//   3  CLEAN FAILURE. It did not take and nothing is carried away but the loss,
//      which is PARTIAL and which preparation buys down - `FAILURE_PROGRESS_LOSS`
//      in `breakthrough.ts` owns the figures. Against a finite span, the
//      repetition is what actually ends most careers.
//
//   4  FAILURE WITH SEQUELAE. The same failure, and something is carried away.
//      IT DOES NOT CRACK THE RUNG ABOVE - there is nothing there to have broken,
//      because the structure was never built - and nothing in `CROSSING_OUTCOMES`
//      may mint a row from `BROKEN_STATUSES`. AND IT NEVER CLOSES THE ROAD,
//      however grave.
//
//   5  DEATH.
//
// BEING HALTED IS A STATE, NOT A SIXTH OUTCOME, and there is ONE route to it:
//
//   The only way to have your road closed is to cross badly at a realm wall and
//   come away with THAT REALM'S break. Everything else is damage.
//
// WHY THE REALM KEYWORDS ARE DIFFERENT, SO NOBODY RE-ADDS A BLOCKER. The reason
// is mechanical and is the only argument that should ever be accepted:
//
//   THE LADDER IS A SEQUENCE OF CONSTRUCTIONS, EACH RESTING ON THE LAST. A
//   cracked core is a fault in the APPARATUS the next crossing builds on. Only
//   damage to the construction interrupts the sequence. Everything else is
//   damage to the BUILDER, and builders work hurt.
//
// So a heart demon, a severed meridian, a lost arm and an unfinished cultivation
// base do NOT halt anybody - and the last is worth naming because this file used
// to claim it did. `blocksAdvancement` returns false for every wound that is not
// a realm break, and it is the only thing `canAttemptBreakthrough` consults.
//
// THE ONE THING OUTSIDE THE WOUND LIST THAT CLOSES A ROAD is a False Immortal,
// refused by `barred:the_lid_opened_once` and carrying no wound at all. It fits
// the rule rather than excepting it: the last crossing is not a construction, so
// there is nothing in the body to mark and the fact lives in `immortalStatus`.
//
// WHERE EACH ONE IS PRODUCED. This file owns 4 and the wound rows behind 2.
// `breakthrough.ts` owns which of the five happened: `rollArrivesBroken` on the
// SUCCESS path separates 1 from 2, and its failure table separates 3 from 4 from
// 5. Nothing here decides; this module is asked what a failure was made of.

/**
 * The five, as data, so a narrator reads them out of a row rather than inventing
 * the distinction between a broken success and a bad failure - which is exactly the
 * distinction a narrator is most likely to blur.
 */
export type CrossingResultKind =
    | 'clean_success'
    | 'broken_success'
    | 'clean_failure'
    | 'failure_with_sequelae'
    | 'death';

export const CROSSING_RESULTS: readonly {
    kind: CrossingResultKind;
    name: string;
    /** Factual. Engine-authored, narrator-rendered, like every description here. */
    description: string;
}[] = [
    {
        kind: 'clean_success',
        name: 'Across',
        description:
            'The crossing took. Anything sustained on the way is an ordinary wound with an ordinary answer, and the road onward is open.'
    },
    {
        kind: 'broken_success',
        name: 'Across, and finished',
        description:
            'The crossing took and the structure it was for did not set. They hold the new rung permanently, and nothing below the rarest medicine in the world opens the road onward again.'
    },
    {
        kind: 'clean_failure',
        name: 'It did not take',
        description:
            'Part of the accumulation was spent reconciling the failure and the wall did not open. Nothing is carried away but that loss, and the loss is the years it will take to gather the difference again.'
    },
    {
        kind: 'failure_with_sequelae',
        name: 'It did not take, and it left something',
        description:
            'The same failure, at the same rung, carrying whatever the wall did on the way past. Nothing at the rung above was broken, because nothing was built there - but what the wall did can still be the thing that ends the climb, and whether it did is a question about the wound rather than about the failure.'
    },
    {
        kind: 'death',
        name: 'The wall was the end of it',
        description: 'The attempt was not survived.'
    }
] as const;

/**
 * Name which of the five a crossing was, from what the crossing produced.
 */
export function classifyCrossingResult(result: {
    succeeded: boolean;
    survived: boolean;
    /** The break this crossing left, from `rollArrivesBroken`. Only ever on a success. */
    brokenStatus?: string | null;
    /** Wounds this crossing produced. Only their presence is read. */
    injuriesSustained?: readonly Injury[];
}): CrossingResultKind {
    if (!result.survived) return 'death';
    if (result.succeeded) {
        return result.brokenStatus ? 'broken_success' : 'clean_success';
    }
    return (result.injuriesSustained?.length ?? 0) > 0 ? 'failure_with_sequelae' : 'clean_failure';
}

/** The authored row for a result kind. Total - every kind has one. */
export function getCrossingResult(kind: CrossingResultKind) {
    return CROSSING_RESULTS.find(r => r.kind === kind)!;
}

// THE TRIALS
//
// One per realm boundary below Tribulation Transcendence, named for what the
// crossing is actually DOING rather than for the realm it arrives at. The realm
// descriptions in `realms.ts` already say what each one does; these names are
// those sentences with the verb pulled to the front, so that a reader can tell
// from the trial name alone why the failure table looks the way it does.

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

// THE OUTCOME REGISTRY
//
// A flat list of ways a crossing ruins somebody. Weights live on the outcome,
// keyed by trial, so a new outcome is one object and no boundary is edited.
// An absent weight is zero: an outcome simply does not happen at a trial it
// says nothing about.

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
    /**
     * The soul state this outcome drags the cultivator DOWN TO, never up to.
     *
     * A floor, not an assignment. See `applyCrossingConsequence`.
     */
    soulStateFloor?: SoulState;
/**
 * What this outcome MULTIPLIES `identityContinuity` by, in (0, 1]. The soul takes
 * the WORSE of what it is and what happened, and continuity MULTIPLIES: two
 * Severings at 0.75 leave 56% rather than 75%, and the third leaves 42%, which is
 * what repeated ruin is supposed to mean.
 */
    identityContinuityFactor?: number;
    /**
     * DEAD, AND KEPT ONLY UNTIL ITS READERS ARE CLEANED UP. Never set this.
     */
    halted?: boolean;
}

// APPLYING A CONSEQUENCE
//
// One place, so every path that can ruin somebody ruins them the same way.

/** Worst first. A soul only ever moves down this list. */
const SOUL_STATE_ORDER: readonly SoulState[] = ['intact', 'damaged', 'fragmented', 'fading'];

/** The worse of two soul states. Never the better. */
export function worseSoulState(a: SoulState, b: SoulState): SoulState {
    return SOUL_STATE_ORDER.indexOf(b) > SOUL_STATE_ORDER.indexOf(a) ? b : a;
}

export interface RuinableSelf {
    soulState: SoulState;
    identityContinuity: number;
    age: number;
}

/**
 * Fold a consequence into what somebody already is.
 */
export function applyCrossingConsequence(
    self: RuinableSelf,
    consequence: CrossingConsequence
): RuinableSelf {
    return {
        soulState: consequence.soulStateFloor
            ? worseSoulState(self.soulState, consequence.soulStateFloor)
            : self.soulState,
        identityContinuity: consequence.identityContinuityFactor
            ? Math.max(0, Math.min(1, self.identityContinuity * consequence.identityContinuityFactor))
            : self.identityContinuity,
        // Years are spent, not set. Additive for the same reason the other two
        // compound: burning a span twice costs twice.
        age: self.age + (consequence.yearsBurned ?? 0)
    };
}

export interface CrossingOutcome {
    key: string;
    /** What this reads as in a digest. Factual; the narrator renders it. */
    summary: string;
    /**
     * Relative likelihood at each trial. Absent means it cannot happen there.
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
 * Years burned, as a fraction of the span the CURRENT rung grants. Proportional
 * rather than flat, for the same reason deviation's progress loss is: the spans on
 * this ladder run from 100 years to 100,000, and a flat figure would be an
 * execution at the bottom and a rounding error at the top.
 */
export const SPAN_BURNED_FRACTION = { min: 0.08, max: 0.22 } as const;

export const CROSSING_OUTCOMES: readonly CrossingOutcome[] = [
    // The ordinary end. What most wounding failures at most walls are.
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

    // The structure under them comes apart.
    //
    // NOT NAMED FOR A FOUNDATION, and that is the point. This row is minted at
    // six walls and only one of them builds a foundation, so calling it 'a
    // shattered foundation' handed a Body Integration cultivator a Foundation
    // Establishment word for something that realm was not constructing. What
    // actually comes apart is the cultivation base, which every rung has - so
    // the wound borrows nobody's term. See the naming rule in `wounds.ts`.
    {
        key: 'cultivation_scattered',
        summary: 'The structure the life was built on came apart under the crossing. What was built is gone.',
        weights: {
            // Nothing to scatter at the first wall - there is no accumulated
            // base yet, it is being laid there - so this row is simply absent
            // from it.
            the_condensation: 14,
            the_birthing: 5,
            the_merging: 4,
            the_emptiness: 3,
            the_joining: 3,
            the_ascent: 3
        },
        apply: (subject, rng, ctx) => ({
            injuries: [wound(ctx, rng, 'scattered-cultivation', 'crippling')],
            // Laid again out of the wreckage. 'rebuilt' is strictly worse than
            // 'stable' and strictly better than 'damaged', which is exactly the
            // charter's "loss branches rather than subtracts".
            foundationQuality: rebuildFoundation(foundationOf(subject))
        })
    },

    // Part of the base never forms. Ruinous, and NOT a bar.
    //
    // This row used to set `halted: true`, and that was the single largest
    // violation of the rule stated at the top of this file: what fails here is
    // not a realm's construction, so it may not close the road. It is one of
    // the worst things a cultivator can carry and it is still only damage.
    //
    // Note it never actually barred anybody. `canAttemptBreakthrough` gates on
    // `structuralBlockOn`, which reads `BROKEN_STATUSES` and has never included
    // this wound, so the flag fed a narration line and a disagreeing predicate
    // and nothing else. Removing it makes the prose agree with the ladder.
    //
    // AND IT IS NOT NAMED FOR THE CORE, which is the second thing this row had
    // wrong and the reason it reads differently now. It used to say a reservoir
    // cracked and mint 'a ruined dantian'. This setting says CORE, and once the
    // borrowed word goes there is exactly one core wound - 'cracked-core', which
    // is `the_condensation`'s BROKEN STATUS and closes the road. This row is
    // minted on the failure side at six walls, five of which form no core at
    // all, so it could neither keep the borrowed word nor take the core's. It
    // names the cultivation base instead, which every rung on the ladder has.
    // Exactly the rename `cultivation_scattered` above went through, for
    // exactly the same reason. See the naming rule in `wounds.ts`.
    {
        key: 'cultivation_left_incomplete',
        summary:
            'Part of the base never formed. The cultivator is alive, at the rung they were on, and everything they do from here is done through a structure that leaks.',
        weights: {
            // NOT AT THE FIRST WALL, and this is a deliberate exclusion rather
            // than an oversight. Qi Condensation to Foundation Establishment is
            // where every run starts, and this is the gravest wound in the
            // table - measured, it landed on cultivators at ordinal 12 holding
            // the full price, which is the exact brutality the low ladder is
            // supposed to be free of. Failing to SET a foundation is already
            // modelled, on the success path, by `assessFoundation` handing back
            // 'incomplete' or 'damaged'.
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
            injuries: [wound(ctx, rng, 'incomplete-cultivation', 'crippling')],
            // 'incomplete' is a quality `assessFoundation` already produces and
            // the whole engine already prices, on every subsequent crossing,
            // forever. That is what this costs: the next wall is much worse,
            // and it is still a wall they are allowed to walk up to.
            foundationQuality: 'incomplete'
        })
    },

    // Maiming. The merging is where the body comes back wrong.
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

    // The mind. The birthing and the emptiness are where it goes.
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
                wound(ctx, rng, 'rooted-heart-demon', rng.next() < 0.6 ? 'serious' : 'crippling', 'qi_deviation')
            ],
            soulStateFloor: 'damaged',
            // Functional and not right. Still overwhelmingly themselves, which
            // is what makes them employable, meetable and unreliable.
            identityContinuityFactor: 0.75
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
            injuries: [wound(ctx, rng, 'ascendant-heart-demon', 'crippling', 'qi_deviation')],
            soulStateFloor: 'fragmented',
            // Low, and deliberately not zero. `identityContinuity` is the field
            // that stops a remnant being mistaken for the person who left it,
            // and this is the same question asked of somebody still walking
            // around: how much of them is this. Enough is left to remember the
            // grudges, hold the techniques and know the way home, which is
            // precisely what makes it dangerous rather than merely sad.
            identityContinuityFactor: 0.35
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
            identityContinuityFactor: 0.85
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
            injuries: [wound(ctx, rng, 'fixed-premise', rng.next() < 0.7 ? 'minor' : 'serious', 'qi_deviation')]
        })
    },

    // The span. The ascent is where the raising is paid for out of the life.
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
                injuries: [wound(ctx, rng, 'burnt-span', fraction > 0.15 ? 'crippling' : 'serious')],
                yearsBurned: span * fraction
            };
        }
    }
];

/** The span the cultivator's CURRENT rung grants, which is what gets burned. */
function realmSpan(ordinal: number): number {
    return realmForOrdinal(ordinal).lifespanYears;
}

// READING THE TABLE

/**
 * The outcomes that can actually happen at a trial, with their weights.
 */
export function outcomesForTrial(trial: TrialKind): { outcome: CrossingOutcome; weight: number }[] {
    return CROSSING_OUTCOMES
        .map(outcome => ({ outcome, weight: outcome.weights[trial] ?? 0 }))
        .filter(row => row.weight > 0)
        .sort((a, b) => b.weight - a.weight);
}

/**
 * Draw one outcome for a trial from a seeded stream. Two samples, always: one to
 * pick the outcome and however many the outcome's own `apply` draws. Callers must
 * not assume a fixed count beyond the first.
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

// BEING HALTED

/**
 * The broken status each crossing leaves when it lands badly, by trial.
 *
 * A STATUS ON TOP OF A RUNG, NEVER A RUNG OF ITS OWN. Somebody who cracks going
 * into Tribulation Transcendence is at ordinal 41 carrying a broken step - not at
 * a fractional ordinal and not at a rank inserted between 40 and 41. Adding a
 * realm is adding a row here and a row in `WOUND_TYPES`.
 */
export const BROKEN_STATUS_FOR_TRIAL: Partial<Record<TrialKind, string>> = {
    the_setting_of_the_foundation: 'broken-foundation',
    the_condensation: 'cracked-core',
    the_birthing: 'crippled-nascent-soul',
    the_merging: 'failed-transformation',
    the_emptiness: 'partial-refinement',
    the_joining: 'failed-integration',
    the_ascent: 'unfulfilled-ascension',
    // The crossing INTO Tribulation Transcendence. Lightning resolves whether
    // they survive it; this is what a survival that did not land clean leaves.
    heavenly_lightning: 'imperfect-tribulation-body'
};

/** Every broken status, for the callers that need to recognise one. */
export const BROKEN_STATUSES: readonly string[] = Object.values(BROKEN_STATUS_FOR_TRIAL);

/**
 * The broken status a crossing FROM this ordinal would leave.
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

/**
 * The broken status a stored wound key names, under its CURRENT name, or null.
 */
export function brokenStatusKeyOf(woundType: string | null | undefined): string | null {
    const key = currentWoundKey(woundType);
    return key !== null && BROKEN_STATUSES.includes(key) ? key : null;
}

/**
 * EVERY broken status this cultivator carries, under current names.
 */
export function brokenStatusesOn(injuries: readonly Injury[]): string[] {
    const out: string[] = [];
    for (const injury of injuries) {
        if (injury.treated) continue;
        const status = brokenStatusKeyOf(injury.woundType);
        if (status !== null && !out.includes(status)) out.push(status);
    }
    return out;
}

/** The broken status this cultivator carries, if any. */
export function brokenStatusOf(injuries: readonly Injury[]): string | null {
    for (const injury of injuries) {
        if (injury.treated) continue;
        const status = brokenStatusKeyOf(injury.woundType);
        if (status) return status;
    }
    return null;
}

/**
 * Whether this cultivator has been stopped for good. Read off the wound list
 * rather than off a flag, because the wound list is what persists and what the
 * narrator reads, and it is the same predicate `blocksAdvancement` applies - asked
 * of a whole person instead of one wound - so a reading and a bar cannot disagree.
 * They keep their rung, their span, their standing and their students.
 */
export function isHalted(subject: Pick<Cultivator, 'injuries'>): boolean {
    return subject.injuries.some(blocksAdvancement);
}

// ARRIVING BROKEN
//
// The success side of the same design, and the half the original ruling asked
// for: "you are alive, you are at the new rung, and you can never go further".
// A failure leaves somebody where they were; only a SUCCESS can leave them one
// rung higher and finished.

/**
 * Chance that a successful crossing lands badly, by trial. Deliberately small,
 * rising with altitude, and deliberately ZERO at the first wall: Qi Condensation
 * to Foundation Establishment is where every run starts, and a permanent bar
 * there would end lives before they began.
 *
 * WHY THESE ARE SO SMALL, WHICH IS MEASURED RATHER THAN CAUTIOUS.
 *
 * There is almost no room on this ladder for additional attrition, and the figure
 * that says so is `crossing.test.ts`: a best-case life must still end above the
 * Lid more than 30% of the time, and it does so at 32.7%. That is 2.7 points of
 * headroom to spend across EIGHT boundaries, for the best-prepared cultivator the
 * world can assemble. The first cut of this table - 3% to 10% per wall - spent all
 * of it and more, taking best-case lives from 32.7% to 20.6% and failing the test.
 * These rates are not a judgement about how dangerous a crossing ought to feel;
 * they are what fits in the space the ladder has left.
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

/**
 * How much carrying a broken status costs a breakthrough attempt.
 */
export const BROKEN_STATUS_STRAIN = -0.55;

/**
 * Whether clearing a crossing repairs this status.
 */
export const REPAIRED_IN_THE_CRUCIBLE: Record<string, boolean> = {
    'broken-foundation': true,
    'cracked-core': true,
    'crippled-nascent-soul': true,
    'failed-transformation': true,
    'partial-refinement': true,
    'failed-integration': true,
    'unfulfilled-ascension': true,
    'imperfect-tribulation-body': false
};

/** Whether a successful crossing would clear this status. Accepts a retired key. */
export function isRepairableInTheCrucible(status: string | null): boolean {
    const key = currentWoundKey(status);
    return key !== null && (REPAIRED_IN_THE_CRUCIBLE[key] ?? false);
}

/**
 * Whether this wound stops the NEXT realm crossing.
 */
export function blocksAdvancement(injury: Injury): boolean {
    if (injury.treated) return false;
    return brokenStatusKeyOf(injury.woundType) !== null;
}

/** The structural break stopping this cultivator's next crossing, if any. */
export function structuralBlockOn(injuries: readonly Injury[]): string | null {
    for (const injury of injuries) {
        // The CURRENT key, so a saved row does not report a name the tables no
        // longer carry - the bar and the reading have to name the same thing.
        const status = blocksAdvancement(injury) ? brokenStatusKeyOf(injury.woundType) : null;
        if (status) return status;
    }
    return null;
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
 */
export function clearBrokenStatus(injuries: readonly Injury[], status: string): Injury[] {
    // Compared under current names on BOTH sides, so a crossing repairs a saved
    // row carrying a retired key. Matching on the raw string would leave the
    // wound in place and the cultivator halted after the thing that was supposed
    // to free them.
    const wanted = currentWoundKey(status);
    return injuries.filter(i => currentWoundKey(i.woundType) !== wanted);
}

/**
 * Whether a SUCCESSFUL crossing from `ordinal` arrives broken, and as what.
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
