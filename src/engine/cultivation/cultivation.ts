/**
 * Cultivation progress accrual.
 *
 * Progress is the XP replacement, and unlike XP it is earned by *time*, not by
 * events. A cultivator sitting in a cave accrues a rate per day; that rate is
 * the product of a handful of multipliers, and the ladder's cost curve
 * (`progressRequiredForOrdinal`) grows at 1.35^ordinal. Multiplying a rate
 * against an exponential cost is what produces the genre's core shape: talent
 * does not add a bonus, it decides which realms are reachable inside a lifespan
 * at all.
 *
 * Worked example, at BASE_PROGRESS_PER_DAY = 1 and normal ambient qi:
 *   - single root (1.5x): clearing all of Qi Condensation costs ~40 years.
 *   - muddled root (0.55x): the same climb costs ~110 years, which exceeds
 *     STAGNATION_YEARS and a 100-year mortal lifespan. A muddled root does not
 *     get a penalty; a muddled root loses.
 * That asymmetry is the design, not a tuning accident.
 *
 * Everything here is pure. Take state in, return deltas out. Nothing in this
 * file mutates a cultivator, touches the database, or knows what a turn is.
 */

import {
    type AmbientQi,
    type Cultivator,
    type Element,
    type ManualQuality
} from '../../schema/cultivation.js';
import { getSpiritRoot } from './spirit-roots.js';
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

// ─────────────────────────────────────────────────────────────────────────
// BASE RATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Qi-units a cultivator with no modifiers at all gains per day of dedicated
 * cultivation. The unit that `progressRequiredForOrdinal` is denominated in.
 *
 * Fixed at 1 on purpose: it makes progress requirements readable directly as
 * "unmodified days", which is the number a balance discussion actually wants.
 */
export const BASE_PROGRESS_PER_DAY = 1;

/** Days per in-world year. No calendars, no leap years, no argument. */
export const DAYS_PER_YEAR = 365;

// ─────────────────────────────────────────────────────────────────────────
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
// ── Why the square root of the power multiplier ──────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of a realm's power multiplier becomes intake.
 *
 * See the banner above for the measurement that selected it. Changing this
 * changes whether the ladder can be climbed at all, so it is guarded by
 * `tests/engine/cultivation/realm-intake.test.ts` against the criterion rather
 * than against its current value.
 */
export const REALM_INTAKE_EXPONENT = 0.5;

/**
 * Qi intake multiplier for standing at this rung.
 *
 * Exactly 1 through the whole of Qi Condensation, by construction rather than
 * by a special case: that realm's power multiplier is 1, and anything to the
 * power of a half is still 1.
 */
export function realmIntakeMultiplier(realmOrdinal: number): number {
    return Math.pow(powerMultiplierForOrdinal(realmOrdinal), REALM_INTAKE_EXPONENT);
}

// ─────────────────────────────────────────────────────────────────────────
// THE TECHNIQUE CEILING, AND THE MASTER
//
// Two progression gates with DELIBERATELY DIFFERENT SHAPES, and the asymmetry
// is the design rather than an accident of implementation:
//
//   no proper cultivation technique  ->  progress is IMPOSSIBLE. A hard
//                                        ceiling. No amount of time passes it.
//   no suitable master               ->  progress SLOWS. A soft brake:
//                                        survivable, and expensive in years.
//
// One axis can be ground through at a cost; the other cannot be ground through
// at all. Collapsing them into one term - two penalties of different sizes -
// would lose exactly the thing that makes them worth having.
//
// ── The ceiling ──────────────────────────────────────────────────────────
//
// A cultivation manual carries a rung past which it cannot take anybody,
// however long they practise. That is what makes the faction catalog's
// `reliableOrdinal` and `peakOrdinal` TRUE BY CONSTRUCTION rather than by
// assertion: a low-tier sect teaches a low-tier manual, so a low-tier sect
// structurally cannot produce a high-realm cultivator. Nothing branches on the
// sect. The manual is simply the manual.
//
// Three ways out when you cap, and the engine takes no view on which:
//   - find the later volumes. They are somewhere, and possibly nowhere you
//     can reach. This composes with suitability: the volumes may not suit you
//     either.
//   - write one yourself, which is a question about dao standing rather than
//     about resources.
//   - switch to another art, abandoning what a century of practice built.
//
// Deliberately NOT modelled as a slow taper toward the cap. A ceiling that
// gets gradually stickier reads as bad luck; a ceiling that stops dead reads
// as a fact about the book in your hands, which is what it is, and it is the
// one that sends a player looking.
//
// ── The master ───────────────────────────────────────────────────────────
//
// Guidance is priced on the gap between the guide and the guided, so a master
// who was a great help at Qi Condensation is worth nothing by Core Formation.
// You cannot reach ordinal 44 guided by an ordinal 10 for the whole game,
// which was previously not merely possible but free.
//
// Absence of a master is the BASELINE (multiplier 1), not a penalty, so no
// existing cultivator gets slower than they were - "progress slows without a
// suitable master" is true comparatively, which is the sense that matters, and
// it avoids a silent across-the-board nerf to every caller that does not yet
// supply a guide. A suitable master is a real bonus on top.
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// THE GROUND: CONTESTED QI, AND GROUND THAT STOPS YOU
//
// Two rules from `docs/world/qi.md`, both of which the engine promised and
// neither of which it had. Both read the same input - what the ground holds and
// who is standing on it - so they take one option rather than two.
//
// ── Qi is contested ──────────────────────────────────────────────────────
//
//   "a region supports only so many cultivators. Qi drawn by one person is not
//    available to another. A valley that comfortably carries thirty cultivators
//    carries three hundred badly, and everyone in it progresses more slowly for
//    every additional person."
//
// That is the stated motive for every territorial conflict in the setting - a
// sect limiting its intake is prudent, a sect culling a rival's outer disciples
// is efficient, a massacre is an investment that genuinely works - and nothing
// modelled it. Rate at ordinal 10 was 1.500/day whether the valley held one
// person or three hundred.
//
// The doc's own example is the calibration point: an ordinary valley - density
// at `BAND_DENSITY_CENTRE.normal`, 0.42 - carries thirty. That fixes
// QI_CARRYING_CAPACITY at 72, and everything else falls out of it: thin ground
// carries seven, a rich vein carries fifty-six.
//
// Crowding is a SHARE, so it is smooth and has no cliff: at or under capacity
// nothing happens, and over it everyone divides what there is. Thirty in a
// thirty-valley is 1.0; three hundred is 0.1, which is the doc's "badly".
//
// ── Occupancy is measured in DRAW, not in heads ──────────────────────────
//
// "Qi drawn by one person is not available to another" - and a Nascent Soul
// cultivator does not draw what an outer disciple draws. So occupancy is summed
// as `realmIntakeMultiplier`, the same number that decides how fast each of
// them gathers. One Deity Transformation elder crowds out sixteen mortals,
// which is why placing an ancient on your own vein is a real decision and why a
// sect's elders live apart from its disciples.
//
// ── Thin regions have a ceiling ──────────────────────────────────────────
//
//   "In a genuinely qi-poor region, a cultivator does not merely progress
//    slowly. They stop. There is not enough ambient qi to condense, and no
//    amount of talent, discipline or years will manufacture it. Whole provinces
//    exist where nobody has passed Qi Condensation in living memory."
//
// The heading on that passage is "Thin regions have a CEILING", and a ceiling
// is what it is - not a slower multiplier. A multiplier scales and never stops,
// so with `thin` at x0.5 everybody passed Qi Condensation eventually and the
// province where the higher realms are stories could not exist.
//
// So: ground poorer than the centre of the thin band cannot carry anybody past
// Qi Condensation, ever. Exactly the same shape as the technique ceiling - a
// hard zero with its own line in the breakdown - because it is the same kind of
// fact.
//
// ── Exactly where it bites, because one rung matters to a reader ─────────
//
// The ceiling is ordinal 12, and the comparison is `>=`, so a cultivator on
// dead ground GATHERS on ordinals 0 to 11 and gathers nothing at all on 12.
//
// They can still stand on 12 - reaching it only requires gathering on 11 - so
// all thirteen rungs of Qi Condensation remain REACHABLE. What they cannot do
// is accumulate on the last one, and accumulating on the last one is the only
// way out of the realm. That is the lore sentence exactly: nobody has passed
// Qi Condensation, and people plainly still live and cultivate there.
//
// An earlier version of this comment said "all thirteen rungs stay climbable",
// which is true of reaching them and false of gathering on the thirteenth, and
// the ambiguity cost a reviewer two passes to resolve. It is written out
// longhand here for that reason.
//
// The runway is the point: twelve rungs of ordinary progress before the ground
// is the thing in the way, so the answer is to move rather than to try harder.
// "Getting out of a poor region is the first real goal of most cultivators who
// ever amount to anything."
//
// ── The threshold is STRICT, deliberately ────────────────────────────────
//
// `density < QI_BARREN_DENSITY`, so ground sitting exactly on the constant is
// ordinary ground and not barren. "Poorer than the centre of the thin band"
// reads as strict and is meant as strict. It does leave a sharp edge for any
// catalog entry authored at exactly 0.1, which is why it is said here and
// pinned in `contested-qi.test.ts` rather than left to be rediscovered.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Mortal-equivalent draws an entirely saturated location would support.
 *
 * Calibrated on the doc's own worked example rather than picked: an ordinary
 * valley sits at `BAND_DENSITY_CENTRE.normal` = 0.42 and "comfortably carries
 * thirty cultivators", so 30 / 0.42 = 72.
 */
export const QI_CARRYING_CAPACITY = 72;

/**
 * Usable density below which the ground cannot carry anyone out of Qi
 * Condensation.
 *
 * `BAND_DENSITY_CENTRE.thin` - ground poorer than the middle of the thin band
 * itself. Derived rather than invented, so it moves if the bands move.
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
 *
 * Eight - about two realms. Nearer than that and they are still ahead of you
 * but no longer seeing much you cannot; further and there is nothing left to
 * add, because the limit is what you can receive rather than what they hold.
 */
export const GUIDANCE_FULL_GAP = 8;

/**
 * What being guided by somebody at `guideOrdinal` is worth at `realmOrdinal`.
 *
 * 1 with no guide, and 1 with a guide at or below the cultivator: somebody who
 * has not stood where you are standing cannot tell you anything about it. This
 * is why a master's send-off is a real beat - they can perceive the moment
 * they stop being able to help.
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
 *
 * Zero, and it is a real number rather than an absence. `techniqueExhausted`
 * reads null as "no ceiling declared", so handing it null for somebody
 * practising nothing gives them an unlimited climb and makes learning a first
 * book strictly harmful.
 *
 * It lives here rather than in a caller because it is the engine's number: the
 * rule it encodes - "no proper cultivation technique, progress is impossible" -
 * is the hard half of the asymmetry in the banner above, and a caller that
 * picked its own floor would be deciding a mechanic. `src/web/game.ts` should
 * import this rather than define its own copy; reported rather than reached
 * across for.
 */
export const NO_MANUAL_CEILING = 0;

/**
 * Why the manual is or is not carrying this cultivator any further.
 *
 * ── THE SENTENCE THAT WAS MISSING ────────────────────────────────────────
 *
 * A cap of zero and a cap of thirteen are different facts and used to read the
 * same. `techniqueExhausted` returned true for both, so the breakdown said
 * "The manual ends at Qi Condensation Layer 1" to somebody holding no manual
 * at all - naming a book that does not exist, at the one moment the player most
 * needed to be told there wasn't one.
 *
 * Measured on the build before this: twelve honest lives, playing correctly -
 * stipend, work, food, treat wounds, sit, strike when the gate opens - ended
 * eleven times in stagnation at ordinal 0, age 66, after fifty years of
 * two-year seclusions at 0/100 progress. Nothing anywhere said why. The only
 * tell was inverted and buried: a deviation reporting "0 qi-units of
 * cultivation destroyed", because there was nothing to destroy.
 *
 * The rule is right and is not weakened here. What was missing was the
 * sentence, and the two ends of this axis want OPPOSITE advice:
 *
 *   no_method   there is no book. Go and learn one. Sitting is not the answer
 *               and more years are not the answer.
 *   exhausted   there is a book and it has ended. Go and find the next volume.
 *
 * This is the fourth of the four reasons a manual can fail somebody - no
 * method, wrong root, insufficient dao, ends here - and the only one that is an
 * ABSENCE rather than a refusal, which is exactly why nobody wrote a sentence
 * for it.
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
     *
     * Engine-authored and factual, in the idiom `Suitability.line` established:
     * it says what is true and what would change it, and it never softens the
     * answer into a maybe. The rate factors are visible in an inspector; the
     * person sitting in a cave for fifty years is reading prose, so this exists
     * to be carried into narration rather than to be looked up.
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
    techniqueCap?: number | null
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
    if (techniqueCap === NO_MANUAL_CEILING) {
        return {
            state: 'no_method',
            multiplier: 0,
            label: 'No cultivation method: there is no book',
            line:
                'This cultivator is practising no cultivation method at all. Sitting in a ' +
                'quiet room and breathing is not cultivation: without a manual there is no ' +
                'road for the qi to take, so nothing accumulates and nothing ever will. ' +
                `They will stand at ${rankName(realmOrdinal)} for as long as they live. ` +
                'What is missing is not years and not discipline. It is a book, or somebody ' +
                'willing to teach them one.'
        };
    }

    return {
        state: 'exhausted',
        multiplier: 0,
        label: `The manual ends at ${rankName(techniqueCap ?? 0)}`,
        line:
            `The manual in their hands ends at ${rankName(techniqueCap ?? 0)}, and that is ` +
            'where they are standing. It is not slower here; it is stopped, and no amount ' +
            'of sitting with it changes that. What is missing is the next volume.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────

/** What an ordinary manual spans. Every book in the catalog today. */
export const ORDINARY_REALM_SPAN = 1;

/**
 * The cap an ORDINARY manual beginning at this rung would carry.
 *
 * `capOf` in `src/data/cultivation/techniques.ts` is this same rule and should
 * delegate here rather than restate it: the data layer owns which books exist,
 * and realm geometry is the engine's. Null when the band runs off the top of
 * the ladder, matching `capOf`.
 */
export function ordinaryCapFor(requiredOrdinal: number): number | null {
    const band = realmForOrdinal(clampToLadder(requiredOrdinal));
    const cap = band.ordinalEnd + 1;
    return cap > MAX_ORDINAL ? null : cap;
}

/**
 * How many realms this manual carries a reader across.
 *
 * One for every book in the world today. Two or more is what "an exceptional
 * manual that skips a stretch of the corridor" means. An uncapped manual is
 * measured to the top of the ladder, because that is what uncapped means.
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
 *
 * A legendary method does not simply work when you sit down with it. 0.75 per
 * realm beyond the first, as a divisor: a two-realm manual opens at 1/1.75 =
 * 0.57 of the ordinary rate and a three-realm one at 0.4. Sized against the
 * terms that already exist - the whole legal attribute range is worth about
 * x1.5 and one realm is x4 - so this is roughly a doubling of the years to the
 * first boundary, and nowhere near a wall.
 *
 * The point of it is that the ordinary book a house teaches is GENUINELY
 * BETTER for the next realm, and the treasure only wins over the long run.
 * That is a real decision rather than a strict upgrade, and it is what stops
 * "find the best book" from being the whole game.
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
 *
 * Worst at the rung the manual can first be taken up at, and gone by the far
 * end of the hard stretch - which is precisely "harder to start". Keyed on
 * where the reader stands, so there is no new state, no mastery column and
 * nothing to persist.
 *
 * AUTHORED FIRST, DERIVED OTHERWISE. When the catalog states an `opening` on
 * the row, that is the answer: an author who has decided a particular treasure
 * is brutal for six rungs gets exactly that. When it does not, realm geometry
 * supplies a default, so a wide manual authored WITHOUT an opening is not
 * quietly a free treasure. There is one penalty and two ways of sourcing its
 * numbers, rather than two penalties that will drift apart.
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

// ─────────────────────────────────────────────────────────────────────────
// RATE BREAKDOWN
// Every factor is itemised. The UI must be able to answer "why am I so slow?"
// without the player guessing, and a balance pass must be able to read the
// contribution of each system without instrumenting the engine.
// ─────────────────────────────────────────────────────────────────────────

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
     * The highest ordinal the CULTIVATION MANUAL being practised can carry
     * this cultivator to. A hard ceiling, not a penalty - see the TECHNIQUE
     * CEILING banner.
     *
     * Omitted means "no manual declared", which is the old behaviour and
     * imposes no ceiling. The data layer must supply a `cap` per cultivation
     * manual for this to bite.
     */
    techniqueCap?: number | null;
    /**
     * The band the manual being practised was written for, as catalog facts
     * rather than as a computed number.
     *
     * Drives the opening penalty - see the MANUAL REACH banner. The caller
     * supplies `requiredOrdinal` and `cap` off the catalog row and the engine
     * decides what they are worth; a caller that could hand in the multiplier
     * directly would be a caller that could invent it.
     *
     * Omitted means "no span declared", which imposes no penalty and is the old
     * behaviour. Note this is the manual's OWN cap, which is not necessarily
     * `techniqueCap` - a partial volume set lowers the ceiling via
     * `effectiveCapOf` without making the book's opening any easier.
     */
    techniqueSpan?: ManualBand | null;
    /**
     * HOW WELL THE MANUAL IS WRITTEN, as the catalog fact rather than as a
     * computed number - the same contract `techniqueSpan` uses, and for the
     * same reason: a caller that could hand in the multiplier directly would be
     * a caller that could invent it.
     *
     * The engine prices it against what the reader can take out of it, which is
     * why this is a tier name and not a bonus. See `manual-quality.ts`.
     *
     * Omitted reads as `sound`, the identity element, so every existing caller
     * keeps exactly the behaviour it had.
     */
    techniqueQuality?: ManualQuality | null;
    /**
     * The ordinal of whoever is guiding this cultivator, if anyone is. A soft
     * rate term: somebody well above you teaches you a great deal, somebody at
     * or below you teaches you nothing about where you are standing.
     */
    guideOrdinal?: number | null;
    /**
     * The ground under them and who else is drawing on it. Drives crowding and
     * the barren-ground ceiling - see the THE GROUND banner.
     *
     * Omitted means "nobody is competing and the ground is not known to be
     * poor", which is the old behaviour and imposes neither. The world layer
     * must supply it for either rule to bite.
     */
    ground?: GroundConditions | null;
}

const DEFAULT_OPTIONS: Required<
    Omit<
        CultivationOptions,
        'techniqueElement' | 'techniqueSubject' | 'techniqueCap' | 'techniqueSpan'
        | 'techniqueQuality' | 'guideOrdinal' | 'ground'
    >
> = {
    techniqueBonus: 1,
    sectBonus: 1,
    locationBonus: 1,
    focusMultiplier: 1
};

/**
 * The itemised per-day cultivation rate.
 *
 * Order of factors is fixed (root, realm, foundation, understanding, ambient,
 * injuries, scars, technique, sect, location, focus) so that two breakdowns
 * from the same state compare equal element-by-element - a property the
 * determinism tests lean on.
 *
 * `foundationQuality` is optional on the input because most callers - the
 * time-skip's internal snapshot, NPC stubs, rows written before foundations
 * existed - legitimately do not carry it. Missing reads as 'none', whose
 * multiplier is 1.
 */
export function computeCultivationRate(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries'> &
        Partial<Pick<Cultivator, 'foundationQuality' | 'insights' | 'realmOrdinal' | 'attributes'>>,
    ambient: AmbientQi,
    opts: CultivationOptions = {}
): CultivationRateBreakdown {
    const options = { ...DEFAULT_OPTIONS, ...opts };
    const root = getSpiritRoot(cultivator.spiritRoot);
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

// ─────────────────────────────────────────────────────────────────────────
// ACCRUAL
// ─────────────────────────────────────────────────────────────────────────

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
 * Accrue `days` of cultivation. Returns the delta and the breakdown that
 * produced it; the caller applies the delta to state.
 *
 * Linear in `days` by construction - there is no per-day loop, because there is
 * nothing in the rate that varies within a constant-ambient stretch. That is
 * exactly what lets `simulateTimeSkip` resolve a decade in a hundred steps.
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
 *
 * Reads EFFECTIVE progress - what was accumulated plus what understanding
 * stands in for - which is where "a cultivator with less raw power and a deeper
 * grasp crosses where a better-supplied rival cannot" actually happens. Every
 * eligibility question routes through here for exactly that reason.
 *
 * "Eligible" is not "advisable". The engine will happily let a cultivator with
 * three torn meridians attempt a realm boundary in thin qi.
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
 * Whole days at `perDay` before the next breakthrough becomes legal.
 *
 * `Infinity` when the rate is zero - a cultivator whose meridians are shut and
 * whose qi is thin is not slow, they are stopped, and the simulation must not
 * pretend a finite number of days will fix it.
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
