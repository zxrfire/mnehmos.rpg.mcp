/**
 * Cultivation progress accrual.
 *
 * Measured on the build before this: twelve honest lives, played correctly,
 * ended eleven times in stagnation at ordinal 0, age 66, after fifty years of
 * two-year seclusions at 0/100 progress. Nothing anywhere said why - the only
 * tell was a deviation reporting "0 qi-units of cultivation destroyed", because
 * there was nothing to destroy.
 */

import {
    type AmbientQi,
    type Cultivator,
    type Element,
    type ManualQuality
} from '../../schema/cultivation.js';
import { getSpiritRoot } from './spirit-roots.js';
import { physiqueOrNull } from './physiques.js';
import { readManual } from './manual-quality.js';
import {
    FOUNDATION_ORDINAL,
    MAX_ORDINAL,
    powerMultiplierForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal
} from './realms.js';
import { BAND_DENSITY_CENTRE, ambientRateMultiplier } from './ambient.js';
import { aggregateInjuryPenalties, scarTempering } from './injuries.js';
import { foundationEffect, foundationOf } from './foundation.js';
import {
    effectiveProgress,
    understandingEffects,
    type RelevanceContext
} from './understanding.js';

// BASE RATE

/**
 * Qi-units a cultivator with no modifiers at all gains per day of dedicated
 * cultivation. The unit that `progressRequiredForOrdinal` is denominated in.
 */
export const BASE_PROGRESS_PER_DAY = 1;

/** Days per in-world year. No calendars, no leap years, no argument. */
export const DAYS_PER_YEAR = 365;

// REALM INTAKE
//
// A bigger body is a bigger aperture. This is the term that says so, and until
// it existed the rate was realm-blind: measured across ordinals 0 to 46 on one
// seed with everything else held identical, `computeCultivationRate` returned
// 1.500 qi-units per day at EVERY rung, including ordinal 46. Realm changed
// power by x65,536 and lifespan by x1,000 and contributed exactly nothing to
// how fast qi came in.
//
// That is not a tuning complaint, it is an arithmetic impossibility. Cost grows
// at PROGRESS_GROWTH^ordinal; against a flat intake, 23 of the 45 climbable
// rungs cost more years than `stagnationYearsForOrdinal` allows the cultivator
// to stand on them, and the last rung ran 14.9x over. The upper two thirds of
// the ladder could not be climbed by cultivating - which is precisely the
// defect the `stagnationYearsForOrdinal` note in schema/cultivation.ts
// describes finding and fixing. It fixed one side. Raising the allowance
// without raising the intake left ordinal 20 needing 185 years against a
// 100-year clock, so the fix did not reach.
//
// Why the square root of the power multiplier
//
// Not a new curve, and deliberately not a new table: the ladder already
// publishes what a realm is worth, and this reads it. One realm is x4 power;
// the square root of that is x2 intake. Stated as a sentence a player could be
// told: A REALM DOUBLES WHAT YOU CAN DRAW AND QUADRUPLES WHAT YOU CAN DO WITH
// IT. The other factor of two per realm stays on the cost curve, which is where
// the crossing walls live and where they should stay.
//
// The exponent was chosen against a stated criterion rather than by taste:
// every rung must be affordable inside its own settling allowance with real
// margin, and the profile must not invert - the upper realms must not become
// easier, in allowance-relative terms, than the early game. Measured over the
// whole ladder for a single root in ordinary qi:
//
//   exponent   worst ratio to allowance   rungs unaffordable   years 13 -> 44
//   0.0        14.87 at ordinal 44        23 of 45             impossible
//   0.3         0.96 at ordinal 28         0                   -
//   0.5         0.56 at ordinal 16         0                   4,839
//   0.6         0.49 at ordinal 16         0                   1,973
//
// 0.3 clears the bar and nothing else: at 0.96 a single qi deviation high on
// the ladder strands a cultivator who cannot then afford another attempt, which
// is the exact failure the CROSSING_TAX note in realms.ts records having
// removed. 0.6 and above put the whole climb from Foundation to the last
// crossing inside two thousand years, which makes nonsense of ancients
// described in ages.
//
// 0.5 leaves the hardest rung on the ladder at ordinal 16 - the Foundation
// Perfection wall - and leaves the early game exactly as it was, because the
// power multiplier is 1 across all thirteen rungs of Qi Condensation. Nothing
// below Foundation Establishment moves by a single qi-unit, which is where 84%
// of runs end and where the cruelty is load-bearing.

/**
 * How much of a realm's power multiplier becomes intake.
 */
export const REALM_INTAKE_EXPONENT = 0.5;

/**
 * Qi intake multiplier for standing at this rung.
 */
export function realmIntakeMultiplier(realmOrdinal: number): number {
    return Math.pow(powerMultiplierForOrdinal(realmOrdinal), REALM_INTAKE_EXPONENT);
}

// THE TECHNIQUE CEILING, AND THE MASTER
//
// Two progression gates with DELIBERATELY DIFFERENT SHAPES:
//
//   no proper cultivation technique  ->  progress is IMPOSSIBLE. A hard ceiling.
//   no suitable master               ->  progress SLOWS. A soft brake.
//
// One axis can be ground through at a cost; the other cannot be ground through
// at all. Collapsing them into two penalties of different sizes would lose the
// thing that makes them worth having.
//
// THE CEILING is what makes the faction catalog's `reliableOrdinal` and
// `peakOrdinal` TRUE BY CONSTRUCTION rather than by assertion: a low-tier sect
// teaches a low-tier manual, so it structurally cannot produce a high-realm
// cultivator, and nothing branches on the sect. Deliberately NOT a slow taper
// toward the cap - a ceiling that gets gradually stickier reads as bad luck,
// where one that stops dead reads as a fact about the book in your hands and is
// the one that sends a player looking.
//
// THE MASTER is priced on the gap between guide and guided, so a master who was
// a great help at Qi Condensation is worth nothing by Core Formation. Absence of
// a master is the BASELINE (multiplier 1) and not a penalty, so no existing
// cultivator gets slower than they were and no caller without a guide is
// silently nerfed.

// THE GROUND: CONTESTED QI, AND GROUND THAT STOPS YOU
//
// Two rules from `docs/world/climbing/qi.md`. Both read the same input - what
// the ground holds and who is standing on it - so they take one option.
//
// QI IS CONTESTED. *"A valley that comfortably carries thirty cultivators
// carries three hundred badly."* That is the stated motive for every
// territorial conflict in the setting and nothing modelled it: rate at ordinal
// 10 was 1.500/day whether the valley held one person or three hundred.
//
// The doc's own example is the calibration point - an ordinary valley, density
// `BAND_DENSITY_CENTRE.normal` of 0.42, carries thirty - which fixes
// QI_CARRYING_CAPACITY at 72, so thin ground carries seven and a rich vein
// fifty-six. Crowding is a SHARE, so it is smooth and has no cliff: thirty in a
// thirty-valley is 1.0 and three hundred is 0.1.
//
// OCCUPANCY IS MEASURED IN DRAW, NOT IN HEADS, summed as `realmIntakeMultiplier`.
// One Deity Transformation elder crowds out sixteen mortals, which is why a
// sect's elders live apart from its disciples.
//
// THIN REGIONS HAVE A CEILING, not a slower multiplier. A multiplier scales and
// never stops, so with `thin` at x0.5 everybody passed Qi Condensation
// eventually and the province where the higher realms are stories could not
// exist. So ground poorer than the centre of the thin band cannot carry anybody
// past Qi Condensation, ever - a hard zero with its own line in the breakdown.
//
// The ceiling is ordinal 12 and the comparison is `>=`, so a cultivator on dead
// ground GATHERS on 0 to 11 and gathers nothing at all on 12. All thirteen rungs
// stay REACHABLE; what they cannot do is accumulate on the last one, which is
// the only way out of the realm. Twelve rungs of runway, so the answer is to
// move rather than to try harder.
//
// The threshold is STRICT (`density < QI_BARREN_DENSITY`), so ground sitting
// exactly on the constant is ordinary. That leaves a sharp edge for any catalog
// entry authored at exactly 0.1, which is pinned in `contested-qi.test.ts`.

/**
 * Mortal-equivalent draws an entirely saturated location would support.
 */
export const QI_CARRYING_CAPACITY = 72;

/**
 * Usable density below which the ground cannot carry anyone out of Qi Condensation.
 */
export const QI_BARREN_DENSITY = BAND_DENSITY_CENTRE.thin;

/** The rung barren ground cannot carry anybody past. */
export const BARREN_GROUND_CEILING = FOUNDATION_ORDINAL - 1;

/** What the ground the cultivator is standing on holds, and who is on it. */
export interface GroundConditions {
    /** USABLE qi here, 0..1 - the world layer's `spiritualDensity`. */
    density: number;
    /**
     * Realm ordinals of everyone drawing on this ground, INCLUDING the
     * cultivator themselves. Omitted or empty means "nobody is competing",
     * which is the uncrowded answer rather than an error.
     */
    occupantOrdinals?: readonly number[];
}

/** Mortal-equivalent draws this ground supports comfortably. */
export function carryingCapacityFor(density: number): number {
    const d = Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0;
    return Math.max(1, Math.round(d * QI_CARRYING_CAPACITY));
}

/** Total draw a set of cultivators puts on the ground they share. */
export function qiDrawOf(occupantOrdinals: readonly number[] = []): number {
    return occupantOrdinals.reduce(
        (total, ordinal) => total + realmIntakeMultiplier(ordinal), 0
    );
}

/**
 * The share of the ground's qi actually available, given who else is on it.
 *
 * 1 at or under capacity. Falls as the reciprocal of the overdraw above it, so
 * every additional person slows everybody including themselves.
 */
export function crowdingMultiplier(ground?: GroundConditions | null): number {
    if (!ground) return 1;
    const draw = qiDrawOf(ground.occupantOrdinals);
    if (draw <= 0) return 1;
    const capacity = carryingCapacityFor(ground.density);
    return draw <= capacity ? 1 : capacity / draw;
}

/** Whether this ground is too poor to carry anybody past Qi Condensation. */
export function groundIsBarren(ground?: GroundConditions | null): boolean {
    if (!ground) return false;
    return Number.isFinite(ground.density) && ground.density < QI_BARREN_DENSITY;
}

/** Whether the ground itself is what is stopping this cultivator. */
export function groundExhausted(realmOrdinal: number, ground?: GroundConditions | null): boolean {
    return groundIsBarren(ground) && realmOrdinal >= BARREN_GROUND_CEILING;
}

/** Most a master far above the cultivator can add to the rate. */
export const GUIDANCE_MAX_BONUS = 0.5;

/**
 * Rungs of seniority at which a guide is worth everything they can be worth.
 */
export const GUIDANCE_FULL_GAP = 8;

/**
 * What being guided by somebody at `guideOrdinal` is worth at `realmOrdinal`.
 */
export function guidanceMultiplier(
    realmOrdinal: number,
    guideOrdinal?: number | null
): number {
    if (guideOrdinal === null || guideOrdinal === undefined) return 1;
    if (!Number.isFinite(guideOrdinal)) return 1;
    const gap = guideOrdinal - realmOrdinal;
    if (gap <= 0) return 1;
    return 1 + GUIDANCE_MAX_BONUS * Math.min(1, gap / GUIDANCE_FULL_GAP);
}

/**
 * Whether the manual in hand can carry this cultivator any further.
 *
 * The cap is the last rung the manual still teaches, so a cultivator standing
 * ON the cap has run out of book.
 */
export function techniqueExhausted(
    realmOrdinal: number,
    techniqueCap?: number | null
): boolean {
    if (techniqueCap === null || techniqueCap === undefined) return false;
    if (!Number.isFinite(techniqueCap)) return false;
    return realmOrdinal >= techniqueCap;
}

/**
 * The rung a cultivator practising NO METHOD AT ALL is carried to.
 */
export const NO_MANUAL_CEILING = 0;

/**
 * Why the manual is or is not carrying this cultivator any further.
 */
export type TechniqueCeilingState = 'no_method' | 'exhausted' | 'teaching';

export interface TechniqueCeiling {
    state: TechniqueCeilingState;
    /** 0 stops dead; 1 is out of the way. Never a taper. */
    multiplier: 0 | 1;
    /** Short, for the rate breakdown line. */
    label: string;
    /**
     * A complete sentence for the PLAYER, or null when nothing is wrong.
     */
    line: string | null;
}

/**
 * Read the ceiling, with its reason attached.
 *
 * `techniqueExhausted` remains the boolean everything else reads; this is the
 * legible form, and the two cannot disagree because this calls it.
 */
export function techniqueCeiling(
    realmOrdinal: number,
    techniqueCap?: number | null,
    holdsAnUnlearnedCopy: boolean = false
): TechniqueCeiling {
    if (!techniqueExhausted(realmOrdinal, techniqueCap)) {
        return {
            state: 'teaching',
            multiplier: 1,
            label: 'Manual has further to teach',
            line: null
        };
    }

    // A real manual's cap is `realmForOrdinal(requiredOrdinal).ordinalEnd + 1`,
    // which is one or more at every rung on the ladder. Zero is therefore not a
    // book that teaches nothing; it is the absence of a book, and it is
    // reserved for exactly that.
    // ABOVE THE LID, A BOOK IS NOT THE ANSWER AND SAYING SO IS A LIE
    //
    // Both sentences below name a route - find a book, find the next volume -
    // and above the Lid neither route leads anywhere, because
    // `progressRequiredForOrdinal` is null there: what is above is not bought
    // with qi and no amount of it would do. The multiplier is still 0 and that
    // is still correct; what was wrong was the reason given for it.
    //
    // Found by playing at ordinal 46. One status read said both "there is
    // nothing above this rung that qi buys, so there is no figure to report"
    // AND "what is missing is not years and not discipline, it is a book" -
    // the sheet contradicting itself inside four lines, and pointing a True
    // Immortal at a search that cannot pay. `DaoView.theOnlyAxisLeft` is the
    // same predicate reading the same fact and already says the right thing.
    //
    // The STATE is deliberately unchanged. A fourth member of
    // `TechniqueCeilingState` would be the honest model and it is not free: the
    // value is passed into a separately-declared `manualState` union in
    // `who-would-teach-this-cultivator.ts`, so widening it here breaks a caller
    // rather than teaching it something. Only the advice was wrong.
    //
    // AND A COPY IN THE BAG IS NOT A ROAD, BUT IT IS NOT AN ABSENCE
    //
    // This branch used to end "It is a book, or somebody willing to teach them
    // one" unconditionally, on the reasoning that `NO_MANUAL_CEILING` means
    // they hold no book. It does not. It means nothing has been LEARNED, and
    // this game sells manuals at a stall: `buy` says so in its own ruling -
    // "the copy is now held and the art is not: owning it and having sat down
    // with it are separate facts."
    //
    // Found by playing. Two copies bought at the same stall, twelve spirit
    // stones spent, and the sheet then told the player what was missing was a
    // book - pointing them at a purchase they had already made twice. The
    // remedy for a copy you are carrying is `learn`, and it is free.
    //
    // Inside this branch nothing at all is learned, so any copy held is
    // necessarily an unlearned one and the caller does not have to diff two
    // lists to know it. The parameter defaults false, which keeps every caller
    // that cannot see the pouch saying exactly what it said before.
    //
    // AND THE PHRASE IS SHARED, SO IT IS NOT FREE TO REWORD
    //
    // The false half was "without a manual", which claims something about the
    // bag. "no road for the qi to take" is the true half and it is SHARED:
    // `seclusion-verbs.ts` renders the same fact with the same words, and
    // three assertions in `narrator-output-authority.test.ts` match on it
    // because the required-line channel exists to guarantee this exact
    // sentence reaches a player who is about to spend fifty years for nothing.
    //
    // Rewording it split the two renderings apart and reddened those three -
    // the feature was fine and the words had drifted, which is precisely what
    // NARRATOR-CORE's do-not-paraphrase rule is for. So: drop the claim about
    // the bag, keep the phrase. If this sentence ever changes again, change
    // `seclusion-verbs.ts` in the same commit or they will disagree.
    const nothingLeftToAccumulateFor = progressRequiredForOrdinal(realmOrdinal) === null;

    if (techniqueCap === NO_MANUAL_CEILING) {
        return {
            state: 'no_method',
            multiplier: 0,
            label: nothingLeftToAccumulateFor
                ? 'No cultivation method, and nothing left for one to carry them to'
                : 'No cultivation method: there is no book',
            line: nothingLeftToAccumulateFor
                ? 'This cultivator is practising no cultivation method, and at ' +
                  `${rankName(realmOrdinal)} it would not matter if they were. There is no ` +
                  'rung above this one that qi buys, so there is nothing for a manual to ' +
                  'carry them to and nothing for the sitting to accumulate. What is left is ' +
                  'not a book. It is what they understand.'
                : 'This cultivator is practising no cultivation method at all. Sitting in a ' +
                  'quiet room and breathing is not cultivation: there is no road for the ' +
                  'qi to take, so nothing accumulates and nothing ever will. ' +
                  `They will stand at ${rankName(realmOrdinal)} for as long as they live. ` +
                  'What is missing is not years and not discipline. ' +
                  (holdsAnUnlearnedCopy
                      ? 'They are carrying a copy they have never opened. Owning it and ' +
                        'having sat down with it are separate facts, and only the second ' +
                        'one teaches anybody anything.'
                      : 'It is a book, or somebody willing to teach them one.')
        };
    }

    return {
        state: 'exhausted',
        multiplier: 0,
        label: nothingLeftToAccumulateFor
            ? `The manual ends at ${rankName(techniqueCap ?? 0)}, and so does the ladder`
            : `The manual ends at ${rankName(techniqueCap ?? 0)}`,
        line: nothingLeftToAccumulateFor
            ? `The manual in their hands ends at ${rankName(techniqueCap ?? 0)}, and so does ` +
              'everything else: there is no rung above this one that qi buys, so there is no ' +
              'next volume to want. What is left is not a book. It is what they understand.'
            : `The manual in their hands ends at ${rankName(techniqueCap ?? 0)}, and that is ` +
              'where they are standing. It is not slower here; it is stopped, and no amount ' +
              'of sitting with it changes that. What is missing is the next volume.'
    };
}

// HOW FAR A MANUAL REACHES, AND WHAT REACHING FURTHER COSTS
//
// The corridor above the middle of the ladder is single-file: at several rungs
// exactly one continuation exists in the world. It is meant to be leapfroggable
// by finding an exceptional book, and the cost of that is deliberately NOT a
// rank requirement - gating a wide manual behind a high `requiredOrdinal` is
// exactly what makes it unable to skip anything. The costs are instead a dao
// standing (`manualGate` in `escapes.ts`) and the opening penalty below.
//
// THE MEASURE IS REALMS, NOT RUNGS, and that was measured rather than assumed.
// Above `requiredOrdinal` 13 the widest `cap - requiredOrdinal` in the live
// catalog is 4; the two wider than that (13 rungs and 8) both sit inside Qi
// Condensation, which is one realm thirteen rungs deep. In realms, every manual
// in the world spans exactly one - which is not a tuning choice but a
// consequence of `capOf` being `realmForOrdinal(requiredOrdinal).ordinalEnd + 1`.
//
// So both gates read 1 for the entire current catalog and are INERT today, in
// exactly the way `DAO_GATE_FROM_ORDINAL` is inert. The day the data layer
// authors a two-realm manual they fire on their own.
//
// These live here rather than in `escapes.ts` because `escapes.ts` reaches
// `shardPower` in the world layer, which imports this file - putting them there
// and importing them back would close a runtime cycle. `escapes.ts` re-exports
// them so callers still have one import site.

/** What an ordinary manual spans. Every book in the catalog today. */
export const ORDINARY_REALM_SPAN = 1;

/**
 * The cap an ORDINARY manual beginning at this rung would carry.
 */
export function ordinaryCapFor(requiredOrdinal: number): number | null {
    const band = realmForOrdinal(clampToLadder(requiredOrdinal));
    const cap = band.ordinalEnd + 1;
    return cap > MAX_ORDINAL ? null : cap;
}

/**
 * How many realms this manual carries a reader across.
 */
export function realmsSpannedBy(
    manual: { requiredOrdinal: number; cap: number | null }
): number {
    const from = clampToLadder(manual.requiredOrdinal);
    const to = manual.cap === null ? MAX_ORDINAL : clampToLadder(manual.cap);
    if (to <= from) return 0;
    // The cap sits one rung OVER the boundary, so the last rung actually taught
    // is `cap - 1`. Counting realms out to the cap itself would report two for
    // every ordinary manual in the catalog.
    if (realmForOrdinal(from).key === realmForOrdinal(to - 1).key) return 1;
    let realms = 0;
    let cursor = from;
    for (let guard = 0; cursor < to && guard <= MAX_ORDINAL; guard++) {
        realms++;
        cursor = realmForOrdinal(cursor).ordinalEnd + 1;
    }
    return Math.max(1, realms);
}

/**
 * How much of the rate an extra realm of reach costs at the very start.
 */
export const OPENING_COST_PER_EXCESS_REALM = 0.75;

/**
 * A manual's own statement of how hard its opening is, when the catalog
 * authors one. `TechniqueSchema.opening`, restated structurally so this file
 * keeps its independence from `src/data/**`.
 */
export interface AuthoredOpening {
    /** How far up from `requiredOrdinal` the difficult stretch runs. */
    rungs: number;
    /** What progress is worth inside it. Below 1. */
    rateMultiplier: number;
}

/** What the opening penalty reads. `opening` overrides the derived default. */
export interface ManualBand {
    requiredOrdinal: number;
    cap: number | null;
    opening?: AuthoredOpening | null;
}

export interface OpeningPenalty {
    /** Multiplier against 1. Always 1 for an ordinary manual, at any rung. */
    multiplier: number;
    /** Realms of reach beyond the ordinary one. Zero for every book today. */
    excessRealms: number;
    /** 0..1, how far through the uphill stretch the reader has got. */
    settledIn: number;
    /** Whether the number came off the catalog row or off realm geometry. */
    source: 'none' | 'authored' | 'derived';
    /** Human-facing, for the rate breakdown. */
    label: string;
}

/**
 * What the opening stretch of this manual is costing at this rung.
 */
export function openingPenalty(manual: ManualBand, realmOrdinal: number): OpeningPenalty {
    const from = clampToLadder(manual.requiredOrdinal);
    const standing = clampToLadder(realmOrdinal);

    const authored = manual.opening ?? null;
    if (authored) {
        const width = Math.max(1, Math.floor(authored.rungs));
        const worst = clamp01(authored.rateMultiplier);
        const settledIn = clamp01((standing - from) / width);
        return {
            multiplier: worst + (1 - worst) * settledIn,
            excessRealms: Math.max(0, realmsSpannedBy(manual) - ORDINARY_REALM_SPAN),
            settledIn,
            source: 'authored',
            label: settledIn >= 1
                ? 'Past the opening; the method has stopped being strange'
                : `Crawling through the opening of a method written far above; ` +
                  `${Math.round(settledIn * 100)}% through the hard stretch`
        };
    }

    const excessRealms = Math.max(0, realmsSpannedBy(manual) - ORDINARY_REALM_SPAN);
    if (excessRealms === 0) {
        return {
            multiplier: 1,
            excessRealms: 0,
            settledIn: 1,
            source: 'none',
            label: 'Manual opens ordinarily'
        };
    }

    // Past the rung an ordinary book beginning here would have ended at, the
    // reader is somewhere no ordinary book would have taken them, and the
    // method has stopped being strange.
    const settledAt = ordinaryCapFor(from) ?? MAX_ORDINAL;
    const width = Math.max(1, settledAt - from);
    const settledIn = clamp01((standing - from) / width);
    const worst = 1 / (1 + excessRealms * OPENING_COST_PER_EXCESS_REALM);

    return {
        multiplier: worst + (1 - worst) * settledIn,
        excessRealms,
        settledIn,
        source: 'derived',
        label: settledIn >= 1
            ? 'Past the opening; the method has stopped being strange'
            : `Opening a method that reaches ${excessRealms + ORDINARY_REALM_SPAN} realms; ` +
              `${Math.round(settledIn * 100)}% through the hard stretch`
    };
}

/** The multiplier alone. 1 when no band was declared, which is the old behaviour. */
export function openingMultiplier(
    manual: ManualBand | null | undefined,
    realmOrdinal: number
): number {
    if (!manual) return 1;
    return openingPenalty(manual, realmOrdinal).multiplier;
}

function clampToLadder(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

// RATE BREAKDOWN
// Every factor is itemised. The UI must be able to answer "why am I so slow?"
// without the player guessing, and a balance pass must be able to read the
// contribution of each system without instrumenting the engine.

export interface RateFactor {
    /** Stable machine-readable key, e.g. `spirit_root`. */
    source: string;
    /** Human-facing label the UI can print verbatim. */
    label: string;
    /** Multiplier applied to the running rate. 1 means "no effect". */
    multiplier: number;
}

export interface CultivationRateBreakdown {
    /** BASE_PROGRESS_PER_DAY, before anything is applied. */
    base: number;
    /** Ordered multipliers; `perDay` is `base` times all of them. */
    factors: RateFactor[];
    /** Final qi-units per day. Never negative; may be zero. */
    perDay: number;
}

export interface CultivationOptions {
    /**
     * Multiplier from the cultivation manual being practised. A mortal-grade
     * qi-gathering manual is ~1.1; an immortal-grade one is several times that.
     * 1 means cultivating raw, with no manual at all.
     */
    techniqueBonus?: number;
    /**
     * Multiplier from sect membership - spirit-gathering arrays, elder
     * guidance, a stipend that means you are not foraging.
     */
    sectBonus?: number;
    /**
     * Multiplier from the specific site, on top of its ambient band: a spirit
     * vein, a heritage cave, a formation someone else paid for.
     */
    locationBonus?: number;
    /**
     * Multiplier for how the time is being spent. Sealed seclusion is the full
     * 1.0; cultivating while travelling, working sect duties, or fighting is a
     * fraction of that.
     */
    focusMultiplier?: number;
    /**
     * Element of the art being practised. Decides which insights bear on the
     * rate, alongside the root's own elements.
     */
    techniqueElement?: Element | null;
    /** Subject of the art being practised, e.g. 'sword'. Same purpose. */
    techniqueSubject?: string | null;
    /**
     * The highest ordinal the CULTIVATION MANUAL being practised can carry this
     * cultivator to. A hard ceiling, not a penalty - see the TECHNIQUE CEILING
     * banner.
     */
    techniqueCap?: number | null;
    /**
     * The band the manual being practised was written for, as catalog facts rather
     * than as a computed number.
     */
    techniqueSpan?: ManualBand | null;
    /**
     * HOW WELL THE MANUAL IS WRITTEN, as the catalog fact rather than as a computed
     * number - the same contract `techniqueSpan` uses, and for the same reason: a
     * caller that could hand in the multiplier directly would be a caller that
     * could invent it.
     */
    techniqueQuality?: ManualQuality | null;
    /**
     * The ordinal of whoever is guiding this cultivator, if anyone is. A soft
     * rate term: somebody well above you teaches you a great deal, somebody at
     * or below you teaches you nothing about where you are standing.
     */
    guideOrdinal?: number | null;
    /**
     * Multiplier from somebody practising the SAME art beside them.
     */
    sharedPracticeBonus?: number | null;
    /**
     * The ground under them and who else is drawing on it. Drives crowding and the
     * barren-ground ceiling - see the THE GROUND banner.
     */
    ground?: GroundConditions | null;
}

const DEFAULT_OPTIONS: Required<
    Omit<
        CultivationOptions,
        'techniqueElement' | 'techniqueSubject' | 'techniqueCap' | 'techniqueSpan'
        | 'techniqueQuality' | 'guideOrdinal' | 'ground' | 'sharedPracticeBonus'
    >
> = {
    techniqueBonus: 1,
    sectBonus: 1,
    locationBonus: 1,
    focusMultiplier: 1
};

/**
 * The itemised per-day cultivation rate.
 */
export function computeCultivationRate(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries'> &
        Partial<Pick<Cultivator,
            'foundationQuality' | 'insights' | 'realmOrdinal' | 'attributes' | 'physique'>>,
    ambient: AmbientQi,
    opts: CultivationOptions = {}
): CultivationRateBreakdown {
    const options = { ...DEFAULT_OPTIONS, ...opts };
    const root = getSpiritRoot(cultivator.spiritRoot);
    // Read off the PERSON and never off `opts`, which is the whole of what
    // makes a physique a property of a body rather than something a caller
    // hands in. Omitted, and for 98 people in a hundred, this is null and the
    // factor below is 1.
    const physique = physiqueOrNull(cultivator.physique);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    const scars = scarTempering(cultivator.injuries);
    const foundation = foundationOf(cultivator);
    const understanding = understandingEffects(cultivator.insights ?? [], {
        rootElements: root.elements,
        techniqueElement: opts.techniqueElement ?? null,
        techniqueSubject: opts.techniqueSubject ?? null
    });

    // Omitted reads as ordinal 0, which prices the caller as Qi Condensation
    // and is a multiplier of 1. That is the old behaviour exactly, so no
    // existing caller changes silently - but it is WRONG for anybody standing
    // higher, and the factor's own label says which realm it priced so a
    // caller that forgot can see it in the breakdown rather than discovering it
    // as a flat ladder six months later.
    const ordinal = cultivator.realmOrdinal ?? 0;

    // Priced once, here, so the rate line and anything else that asks about
    // this pairing get the same judgement rather than two copies of it.
    const manualReading = readManual(
        opts.techniqueQuality ? { quality: opts.techniqueQuality } : null,
        cultivator,
        { techniqueElement: opts.techniqueElement ?? null, techniqueSubject: opts.techniqueSubject ?? null }
    );

    const factors: RateFactor[] = [
        {
            source: 'spirit_root',
            label: root.name,
            multiplier: root.cultivationSpeed
        },
        {
            // The body itself, beside the root because it is the same kind of
            // fact: dealt once, never earned, and never chosen. A row is on
            // the breakdown even when it is 1, so a player reading the line
            // can see the term exists and is doing nothing to them.
            source: 'physique',
            label: physique ? physique.name : 'An ordinary body',
            multiplier: physique?.cultivationSpeed ?? 1
        },
        {
            // A bigger body is a bigger aperture. Without this the ladder is
            // realm-blind and the upper two thirds of it cannot be climbed at
            // all - see the REALM INTAKE banner for the measurement.
            source: 'realm',
            label: `${realmForOrdinal(ordinal).name} intake`,
            multiplier: realmIntakeMultiplier(ordinal)
        },
        {
            // Second only to the root, and unlike the root it was earned. This
            // is the charter's "two cultivators at the same ordinal may have
            // very different futures" expressed as a number.
            source: 'foundation',
            label: foundation === 'none' ? 'No foundation yet' : `${foundation} foundation`,
            multiplier: foundationEffect(foundation).cultivationMultiplier
        },
        {
            // The third quantity. Only insights that bear on what is actually
            // being practised count, so this is never a flat "understanding
            // stat" - see understanding.ts.
            source: 'understanding',
            label:
                understanding.contributing.length === 0
                    ? 'No relevant understanding'
                    : understanding.contributing.map(c => c.name).join(', '),
            multiplier: understanding.cultivationMultiplier
        },
        {
            source: 'ambient_qi',
            label: `Ambient qi (${ambient})`,
            multiplier: ambientRateMultiplier(ambient)
        },
        {
            source: 'untreated_injuries',
            label:
                injuries.untreatedCount === 0
                    ? 'No untreated injuries'
                    : `${injuries.untreatedCount} untreated meridian injur${injuries.untreatedCount === 1 ? 'y' : 'ies'}`,
            multiplier: injuries.cultivationMultiplier
        },
        {
            // CLOSED wounds, which are a different fact about the body from open
            // ones and are never nothing. A cultivator who bought every rank
            // with their meridians arrives at the top slower than one who did
            // not, and that difference is what decides who can still afford the
            // last crossing. See the attrition note in injuries.ts.
            source: 'scar_tissue',
            label:
                scars.wornScars === 0
                    ? 'Meridians sound'
                    : `${scars.scars} closed wound${scars.scars === 1 ? '' : 's'}, ${scars.wornScars} past what a body absorbs`,
            multiplier: 1 - scars.rateAttrition
        },
        {
            source: 'technique',
            label: 'Cultivation manual',
            multiplier: nonNegative(options.techniqueBonus)
        },
        {
            // HOW WELL THE BOOK IS WRITTEN, priced against what this reader can
            // take out of it. The second axis of a manual and the largest
            // non-realm term in the list: a damaged text and an author's own
            // copy of the SAME rungs are x0.45 and x1.8.
            //
            // Under 1 for a reader the book is over the head of, which is the
            // point - the years were spent and nothing was understood, so a
            // great canon in the wrong hands is worse than a plain one in the
            // right hands. 1 when no quality is declared. See manual-quality.ts.
            source: 'manual_quality',
            label: manualReading.label,
            multiplier: manualReading.rateMultiplier
        },
        {
            source: 'sect',
            label: 'Sect support',
            multiplier: nonNegative(options.sectBonus)
        },
        {
            source: 'location',
            label: 'Site bonus',
            multiplier: nonNegative(options.locationBonus)
        },
        {
            source: 'focus',
            label: 'Focus',
            multiplier: nonNegative(options.focusMultiplier)
        },
        {
            // The other half of a two-person art, and NOT a second guidance
            // term - see `sharedPracticeBonus`. 1 for almost everybody in the
            // world, which is what practising alone means.
            source: 'shared_practice',
            label: opts.sharedPracticeBonus === null
                || opts.sharedPracticeBonus === undefined
                || opts.sharedPracticeBonus === 1
                ? 'Practising alone'
                : 'Practising the same art beside somebody',
            multiplier: nonNegative(opts.sharedPracticeBonus ?? 1)
        },
        {
            // Soft. Somebody above you is worth a great deal and somebody at or
            // below you is worth nothing, which is why a master eventually
            // sends you away.
            source: 'guidance',
            label: opts.guideOrdinal === null || opts.guideOrdinal === undefined
                ? 'No one guiding'
                : `Guided from ${rankName(opts.guideOrdinal)}`,
            multiplier: guidanceMultiplier(ordinal, opts.guideOrdinal)
        },
        {
            // Soft, and the reason territory is worth fighting over. Everyone
            // on crowded ground divides what there is, themselves included.
            source: 'crowding',
            label: (() => {
                const share = crowdingMultiplier(opts.ground);
                if (share >= 1) return 'Ground uncontested';
                const capacity = carryingCapacityFor(opts.ground!.density);
                return `Ground carries ${capacity}; ${round1(qiDrawOf(opts.ground!.occupantOrdinals))} drawing on it`;
            })(),
            multiplier: crowdingMultiplier(opts.ground)
        },
        {
            // HARD. Ground too poor to condense on does not slow a cultivator,
            // it stops them, and no amount of talent or years manufactures qi
            // that is not there. The answer is to move.
            source: 'ground_ceiling',
            label: groundExhausted(ordinal, opts.ground)
                ? 'This ground carries nobody past Qi Condensation'
                : 'Ground has further to give',
            multiplier: groundExhausted(ordinal, opts.ground) ? 0 : 1
        },
        {
            // Soft, and the price of an exceptional book. A method that reaches
            // further than one realm is genuinely worse to begin than the
            // ordinary book a house teaches, and only wins over the long run -
            // which is what stops "find the best book" being the whole game.
            // 1 for every manual in the catalog today.
            source: 'technique_opening',
            label: opts.techniqueSpan
                ? openingPenalty(opts.techniqueSpan, ordinal).label
                : 'Manual opens ordinarily',
            multiplier: openingMultiplier(opts.techniqueSpan, ordinal)
        },
        {
            // HARD, and last, so a zero here is visibly the thing that stopped
            // them rather than something buried mid-list. A capped manual does
            // not slow a cultivator down; it stops them, and the answer is
            // another book rather than another decade.
            // Read through `techniqueCeiling` so the breakdown line and the
            // sentence the narrator carries are the same judgement. "No book at
            // all" and "the book ends here" are different facts and used to
            // print the same one.
            source: 'technique_ceiling',
            label: techniqueCeiling(ordinal, opts.techniqueCap).label,
            multiplier: techniqueCeiling(ordinal, opts.techniqueCap).multiplier
        }
    ];

    const perDay = factors.reduce((rate, f) => rate * f.multiplier, BASE_PROGRESS_PER_DAY);

    return {
        base: BASE_PROGRESS_PER_DAY,
        factors,
        // Guard against a caller handing in NaN via a bonus; a NaN rate would
        // silently poison every downstream day-count and never throw.
        perDay: Number.isFinite(perDay) ? Math.max(0, perDay) : 0
    };
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

function nonNegative(n: number): number {
    return Number.isFinite(n) && n > 0 ? n : n === 0 ? 0 : 1;
}

// ACCRUAL

export interface AccrualContext {
    ambient: AmbientQi;
    options?: CultivationOptions;
}

export interface AccrualResult {
    /** Days actually accounted for (floored at 0). */
    days: number;
    /** Progress delta. Add this to `cultivationProgress`; never negative. */
    progressGained: number;
    /** Convenience: progress after the delta. The caller still owns the write. */
    newProgress: number;
    rate: CultivationRateBreakdown;
}

/**
 * Accrue `days` of cultivation. Returns the delta and the breakdown that produced
 * it; the caller applies the delta to state.
 */
export function accrueProgress(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries' | 'cultivationProgress'> &
        Partial<Pick<Cultivator, 'foundationQuality' | 'insights' | 'realmOrdinal'>>,
    days: number,
    ctx: AccrualContext
): AccrualResult {
    const rate = computeCultivationRate(cultivator, ctx.ambient, ctx.options);
    const safeDays = Number.isFinite(days) ? Math.max(0, days) : 0;
    const progressGained = rate.perDay * safeDays;
    return {
        days: safeDays,
        progressGained,
        newProgress: cultivator.cultivationProgress + progressGained,
        rate
    };
}

/**
 * Whether the next rank can be attempted.
 */
export function isBreakthroughEligible(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'spiritRoot'> &
        Partial<Pick<Cultivator, 'insights'>>,
    ctx?: Partial<RelevanceContext>
): boolean {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    // Above the Lid there is no next rung to be ready for, at any amount.
    if (required === null) return false;
    return effectiveProgress(cultivator, ctx) >= required;
}

/** Progress still needed before the next attempt is legal. Zero when eligible. */
export function progressRemaining(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'spiritRoot'> &
        Partial<Pick<Cultivator, 'insights'>>,
    ctx?: Partial<RelevanceContext>
): number {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    // Not "a very large number of qi-units away" - there is no amount. Callers
    // that turn this into days get `Infinity`, which is the honest answer.
    if (required === null) return Infinity;
    return Math.max(0, required - effectiveProgress(cultivator, ctx));
}

/**
 * Whole days at `perDay` before the next breakthrough becomes legal. `Infinity`
 * when the rate is zero: a cultivator whose meridians are shut and whose qi is
 * thin is not slow, they are stopped, and the simulation must not pretend a
 * finite number of days will fix it.
 */
export function daysToNextBreakthrough(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'spiritRoot'> &
        Partial<Pick<Cultivator, 'insights'>>,
    perDay: number,
    ctx?: Partial<RelevanceContext>
): number {
    const remaining = progressRemaining(cultivator, ctx);
    if (remaining <= 0) return 0;
    if (!Number.isFinite(perDay) || perDay <= 0) return Infinity;
    return Math.ceil(remaining / perDay);
}

/** Fraction of the way to the next rank, in [0, 1]. For progress bars. */
export function progressFraction(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'spiritRoot'> &
        Partial<Pick<Cultivator, 'insights'>>,
    ctx?: Partial<RelevanceContext>
): number {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    // Nothing left to fill: above the Lid the bar does not measure anything.
    if (required === null || required <= 0) return 1;
    return Math.max(0, Math.min(1, effectiveProgress(cultivator, ctx) / required));
}
