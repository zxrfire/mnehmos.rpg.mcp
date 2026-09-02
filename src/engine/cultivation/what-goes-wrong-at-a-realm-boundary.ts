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
 * And that person is a SUCCESS, which is the thing most easily got wrong about
 * this file. A crossing ends in one of five ways and only one of them cracks
 * anybody; the failure table below is a different pair of outcomes entirely,
 * and it leaves people at the rung they set out from with nothing broken above
 * them. It never ends their climb either: only a realm's own break closes a
 * road, so being HALTED and being BROKEN are the same set. See THE FIVE WAYS A
 * CROSSING ENDS, immediately below the imports, before adding anything to
 * `CROSSING_OUTCOMES`.
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
 * maimed, base left incomplete, span burnt - is explicitly illustrative rather than
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
 *   base left incomplete   `foundationQuality` -> 'incomplete', which
 *                          `assessFoundation` already produces and the whole
 *                          engine already prices at -0.08 on every subsequent
 *                          crossing. It does NOT halt - see the rule in THE
 *                          FIVE WAYS A CROSSING ENDS.
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

// ═════════════════════════════════════════════════════════════════════════
// THE FIVE WAYS A CROSSING ENDS
//
// The taxonomy this whole file sits inside, written down here because this is
// where the two interesting ones are produced and because it was previously
// only implicit in the shape of `BreakthroughResult`. Read it before adding an
// outcome to the registry below: knowing which of the five a new row belongs to
// is most of knowing whether it is a legitimate row at all.
//
// They are five KINDS of thing, not five points on a scale of badness. The
// ordering below is roughly by how much of the life is spent, and the second
// and fourth are the ones that get confused with each other.
//
//   1  CLEAN SUCCESS. Across, and possibly hurt on the way. Torn meridians, a
//      scorched channel, a heart demon that surfaced and can still be settled -
//      all real, all costly, and all things ORDINARY MEDICINE MENDS. That is
//      what makes this the clean outcome: not that nothing happened, but that
//      what happened has an answer somebody can afford.
//
//   2  BROKEN SUCCESS. Across, and the structure the crossing was FOR did not
//      set. A core that formed with a fault, an infant soul that was born and
//      did not take. They hold the new rung and they hold it permanently,
//      because the road onward is closed behind the rarest medicine in the
//      world - `REPAIRED_IN_THE_CRUCIBLE` and the treatment fields in
//      `data/cultivation/wounds.ts` say for each break what would answer it and
//      how nearly nothing that is.
//
//      THIS IS THE ONLY SOURCE OF A STRUCTURAL BREAK, and it is the single most
//      important sentence here. Every broken cultivator in the world is
//      somebody who SUCCEEDED and paid for it. That is why they price above the
//      realm below them - they genuinely made it, and `assessPower` gives them
//      their rung's own spine - and why they will not go further.
//
//      It is also the ONLY source of a closed road, which makes broken and
//      halted the same set. See the rule below the fifth outcome for why the
//      realm keywords are the only things that may ever be in it.
//
//   3  CLEAN FAILURE. It did not take, and nothing is carried away from it but
//      the loss. That loss is real and it is PARTIAL: a share of the price is
//      spent reconciling the failure rather than all of it, the share rises
//      with how badly it went, and preparation buys it down - more prepared,
//      less loss. `FAILURE_PROGRESS_LOSS` in `breakthrough.ts` owns the
//      figures. They stay at the rung they set out from and gather the
//      difference again. Against `stagnationYearsForOrdinal` and a finite span,
//      this is what actually ends most careers - not the dramatic outcomes, the
//      repetition.
//
//   4  FAILURE WITH SEQUELAE. The same failure, and something is carried away
//      from it: a heart demon, a parted meridian, a stretch of the life the
//      crossing took with it, years burned to survive the attempt, a part of the
//      base that never formed. The registry below is the table
//      of these.
//
//      IT DOES NOT CRACK THE RUNG ABOVE, and this is the distinction that is
//      easiest to get wrong. Somebody who fails badly is at the previous
//      Perfection carrying what the wall did to them. They are NOT a broken
//      version of the rung above - there is nothing there to have broken,
//      because the structure the crossing would have built was never built.
//      Nothing in `CROSSING_OUTCOMES` mints a row from `BROKEN_STATUSES`, and
//      nothing should be added that does.
//
//      AND IT NEVER CLOSES THE ROAD, however grave it is. An unfinished base
//      is the worst thing in the failure table and the ladder still lets them
//      walk up to the next wall. See the rule below the fifth outcome.
//
//   5  DEATH. The wall was the end of it.
//
// ── AND BEING HALTED IS A STATE, NOT A SIXTH OUTCOME ─────────────────────
//
// ONE ROUTE, AND IT IS OUTCOME 2. The whole rule in a line:
//
//   The only way to have your road closed is to cross badly at a realm wall
//   and come away with THAT REALM'S break. Everything else is damage.
//
// Anything not named for a realm's construction does not block further
// cultivation. A heart demon does not. A severed meridian does not. A lost arm
// does not. An unfinished cultivation base does not - and that one is worth
// naming because this file used to claim it did, on the row now called
// `cultivation_left_incomplete`, which is the largest thing this section had
// wrong.
//
// ── WHY THE REALM KEYWORDS ARE DIFFERENT, SO NOBODY RE-ADDS A BLOCKER ────
//
// The reason is mechanical rather than a matter of degree, and it is the only
// argument that should ever be accepted for adding one:
//
//   THE LADDER IS A SEQUENCE OF CONSTRUCTIONS, EACH RESTING ON THE LAST.
//   A cracked core is a fault in the APPARATUS the next crossing has to build
//   on - the core will not carry a nascent soul because the core itself is
//   wrong. Only damage to the construction interrupts the sequence.
//   Everything else is damage to the BUILDER, and builders work hurt.
//
// A heart demon afflicts the person. So does a maiming, a fragmented soul, a
// burnt span. They are permanent, they are ruinous, they cost rate and odds
// and combat power, and they can make a crossing that is technically permitted
// a very bad idea. None of them is a fault in the thing being built on.
//
// It is also why the medicine works the way it does: structural repair mends
// the apparatus, and there is nothing for it to do about a heart demon or an
// arm. See `data/cultivation/structural-repair-medicine.ts`.
//
// So a cultivator may cross carrying a heart demon, and the crucible may even
// shed it on the way. That path is open in code, not merely undocumented as
// closed: `blocksAdvancement` returns false for every wound that is not a
// realm break, and it is the only thing `canAttemptBreakthrough` consults.
//
// `isHalted` asks whether the road is closed and reads exactly that set;
// `classifyCrossingResult` asks which of the five this was. Different
// questions, and neither answers the other.
//
// ── THE ONE THING OUTSIDE THE WOUND LIST THAT CLOSES A ROAD ──────────────
//
// A False Immortal, and it belongs to the same family rather than being an
// exception to it. `canAttemptBreakthrough` refuses them outright with
// `barred:the_lid_opened_once`, and they carry no wound at all.
//
// Read against the rule, it fits exactly. A broken status is somebody who
// crossed and did not complete the construction that crossing was for. A False
// Immortal is somebody who crossed the LAST wall and did not complete it - the
// Lid opened against their name, once, and will not open again. Both are half
// states: across, holding the rung, and finished. What differs is only where
// the incompleteness is recorded, and that follows from what the crossing was.
// Every crossing below builds a structure IN a person, so its failure is a
// wound on them. The last crossing is not a construction at all; it is the Lid
// deciding, so there is nothing in the body to mark and the fact lives in
// `immortalStatus` instead.
//
// So it is special rather than an exception, and it does not license a second
// route for anything below it. The test remains what it has been: a road is
// closed by a half-completed CROSSING and never by damage. Nothing that merely
// hurt somebody may be added here, whatever it cost them.
//
// ── THE SYMMETRY, WHICH IS HOW TO HOLD THE SET IN MIND ───────────────────
//
// 3 and 4 land the person in the same PLACE - the previous Perfection, the
// accumulation spent - and differ in what they are carrying away. 1 and 2 land
// the person in the same place too - the new rung - and differ in whether the
// road onward is still there. The failures differ in cargo; the successes
// differ in future - and only the successes can differ in it, because closing
// the road is something only outcome 2 does.
//
// WHERE EACH ONE IS PRODUCED. This file owns 4 and the wound rows behind 2.
// `breakthrough.ts` owns which of the five happened: `rollArrivesBroken` is
// consulted on the SUCCESS path and is what separates 1 from 2, and its
// failure table separates 3 from 4 from 5. Nothing here decides; this module is
// asked what a failure was made of, and hands back deltas.
// ═════════════════════════════════════════════════════════════════════════

/**
 * The five, as data, so a narrator reads them out of a row rather than
 * inventing the distinction between a broken success and a bad failure - which
 * is exactly the distinction a narrator is most likely to blur.
 *
 * Inert. Nothing here decides anything; `classifyCrossingResult` below is the
 * only consumer and it only names what already happened.
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
 *
 * Derived, never stored: everything it reads is already on the result and on
 * the person, so there is no second field anywhere that could disagree with the
 * wound list. Takes plain values rather than a `BreakthroughResult` so that
 * `breakthrough.ts` can keep importing this module and not the other way about.
 *
 * NOT A ROAD-CLOSURE CHECK, and callers must not use it as one. A
 * `failure_with_sequelae` may have closed the road for good and a
 * `clean_success` never has; the two questions are independent and `isHalted`
 * answers the other one.
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
    /**
     * The soul state this outcome drags the cultivator DOWN TO, never up to.
     *
     * A floor, not an assignment. See `applyCrossingConsequence`.
     */
    soulStateFloor?: SoulState;
    /**
     * What this outcome MULTIPLIES `identityContinuity` by, in (0, 1].
     *
     * A factor, not an assignment, and the distinction is the whole of the bug
     * this replaced. Written as an absolute, a second ruin restored whatever
     * the first had taken: somebody who went mad (0.2) and then went half mad
     * (0.75) came out three quarters intact, with their soul UPGRADED from
     * fragmented back to damaged. The more times the world broke them, the more
     * whole they got.
     *
     * Compounded, two Severings at 0.75 leave 56% and the third leaves 42%,
     * which is what repeated ruin is supposed to mean.
     */
    identityContinuityFactor?: number;
    /**
     * DEAD, AND KEPT ONLY UNTIL ITS READERS ARE CLEANED UP. Never set this.
     *
     * A FAILURE NEVER CLOSES THE ROAD. Only a realm's own break does, only a
     * broken SUCCESS produces one, and `structuralBlockOn` is the bar. This
     * flag was the one thing in the failure table that claimed otherwise, on
     * `cultivation_left_incomplete`, and it never even worked - the bar has
     * never read it.
     *
     * Left in place rather than deleted because `breakthrough.ts` and
     * `schema/cultivation.ts` still read it and neither is this module's to
     * edit. Nothing in `CROSSING_OUTCOMES` sets it, so it is always false, and
     * the narration line it feeds no longer fires. It should be removed from
     * all three files together.
     */
    halted?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// APPLYING A CONSEQUENCE
//
// One place, so every path that can ruin somebody ruins them the same way.
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * THE RULE: RUIN COMPOUNDS, IT NEVER RESTORES. Written as plain assignment this
 * did the opposite - a cultivator who went mad and then went half mad came out
 * three quarters intact with their soul upgraded from fragmented back to
 * damaged, so the more times the world broke them the more whole they got. The
 * second heart demon was an improvement on the first.
 *
 * So: the soul takes the WORSE of what it is and what happened, and continuity
 * MULTIPLIES. Two Severings at 0.75 leave 56% rather than 75%.
 *
 * Applied here rather than at each call site precisely so that a new path that
 * can inflict one cannot forget to compound. Pure - returns the new values.
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

    // ── The structure under them comes apart. ──
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

    // ── Part of the base never forms. Ruinous, and NOT a bar. ──
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
    the_birthing: 'unformed-nascent-soul',
    the_merging: 'incomplete-transformation',
    the_emptiness: 'damaged-spirit-sense',
    the_joining: 'unstable-joining',
    the_ascent: 'unset-ascension',
    // The crossing INTO Tribulation Transcendence. Lightning resolves whether
    // they survive it; this is what a survival that did not land clean leaves.
    heavenly_lightning: 'unformed-tribulation-body'
};

/** Every broken status, for the callers that need to recognise one. */
export const BROKEN_STATUSES: readonly string[] = Object.values(BROKEN_STATUS_FOR_TRIAL);

/**
 * The broken status a crossing FROM this ordinal would leave.
 *
 * Only meaningful at the crossing INTO Tribulation Transcendence among the
 * lightning ordinals: 41, 42 and 43 are steps within the realm and 44 is the
 * last crossing, which lands on its own two rungs and has its own answer. So
 * lightning maps to 'unformed-tribulation-body' only from ordinal 40.
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
 * ONE ROUTE, AND IT IS THE REALM KEYWORDS. A broken status means they CROSSED,
 * arrived, and the structure that crossing was for did not take. Nothing else
 * a cultivator can carry closes the road - not a heart demon, not a severed
 * meridian, not an unfinished cultivation base, not a fragmented soul, not a
 * burnt span, however grave any of them is.
 *
 * This used to read the failure table's gravest wound as a second halting
 * wound, and it was wrong twice over. It was wrong by the rule, because a
 * cultivation base is not a realm's construction - every rung already has one
 * and no crossing builds it, which is the same reason `scattered-cultivation`
 * does not halt either. And it was wrong against the ENGINE: the actual bar is
 * `structuralBlockOn` in `canAttemptBreakthrough`, which has only ever read
 * `BROKEN_STATUSES`, so this predicate was reporting a population the ladder
 * did not refuse. Exactly the second opinion the wound list exists to prevent.
 *
 * Read off the wound list rather than off a flag, because the wound list is
 * what persists and what the narrator reads. This is now the same predicate
 * `blocksAdvancement` applies, asked of a whole person instead of one wound,
 * so a reading and a bar cannot disagree.
 *
 * They keep their rung, their span, their standing and their students.
 */
export function isHalted(subject: Pick<Cultivator, 'injuries'>): boolean {
    return subject.injuries.some(blocksAdvancement);
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
    'unformed-nascent-soul': true,
    'incomplete-transformation': true,
    'damaged-spirit-sense': true,
    'unstable-joining': true,
    'unset-ascension': true,
    'unformed-tribulation-body': false
};

/** Whether a successful crossing would clear this status. */
export function isRepairableInTheCrucible(status: string | null): boolean {
    return status !== null && (REPAIRED_IN_THE_CRUCIBLE[status] ?? false);
}

/**
 * Whether this wound stops the NEXT realm crossing.
 *
 * THE GATE IS STRUCTURAL, NOT SEVERITY-BASED, and the reason is mechanical
 * rather than punitive: each realm builds the next thing on top of the last
 * thing, and the next thing will not build on a broken version of it. A core
 * does not form on a cracked foundation. That is not a penalty applied to
 * somebody who failed; it is the same rule that says a foundation has to exist
 * before a core can.
 *
 * So the broken statuses block, and NOTHING ELSE DOES. A heart demon crosses
 * with you - it is carried up the ladder, it makes everything harder through
 * the ordinary injury penalty, and it may even be shed on the way. A severed
 * meridian crosses with you. A burnt span crosses with you. Mental and physical
 * wounds travel; a cracked structure stops you.
 *
 * Below the last realm the medicine clears it, which is most of what being an
 * apex clan or a Dao house is worth. At 41 it does not, because medicine is
 * barred at that crossing by rule - see `REPAIRED_IN_THE_CRUCIBLE`.
 */
export function blocksAdvancement(injury: Injury): boolean {
    if (injury.treated) return false;
    return injury.woundType !== null && BROKEN_STATUSES.includes(injury.woundType);
}

/** The structural break stopping this cultivator's next crossing, if any. */
export function structuralBlockOn(injuries: readonly Injury[]): string | null {
    for (const injury of injuries) {
        if (blocksAdvancement(injury)) return injury.woundType;
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
