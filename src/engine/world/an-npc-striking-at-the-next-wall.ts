/**
 * The world rolling a REAL breakthrough for somebody who is not the player.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `attemptBreakthrough` is the engine's answer to "did they get past the wall".
 * It carries the odds, the failure table, the boundary trial, the wound the
 * wall leaves, the price of advancement and death. Until this module existed
 * the world simulation never called it once. `applyAdvancement` advanced NPCs
 * with `deriveOrdinal`, and its own comment said what that is:
 *
 *     Not a behaviour model - the same closed-form derivation seeding uses.
 *
 * A derivation answers "given this talent and this age, where would somebody
 * plausibly be". Used as a progression rule it has three properties that
 * between them decide the shape of the whole world:
 *
 *   IT ONLY RISES        the result is kept only if it beats what they have, so
 *                        nobody in the world had ever got worse at cultivating.
 *   IT NEVER HURTS       no failure, no wound, no death at a wall. The entire
 *                        tribulation-and-wounds layer was unreachable from the
 *                        world, and no NPC anywhere could carry a broken
 *                        foundation or a cracked core.
 *   IT SATURATES         it walks one life against one lifespan, so it stops
 *                        where that life stops and never moves again however
 *                        many centuries the person then lives.
 *
 * Measured across three seeds before this module: at 500, 1500 and 5000 years,
 * every single person standing at ordinal 41 or above was a survivor of the
 * seeding. Not most of them - all of them, at every horizon, on every seed. The
 * apex was inherited furniture with a hundred-thousand-year lifespan, and the
 * world's own answer to "where do the giants come from" was "they were here
 * when we arrived".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   THE DERIVATION DESCRIBES A LIFE. WHEN IT RUNS OUT, THE LADDER TAKES OVER.
 *
 * The derivation is kept, and kept first, because it is right about the thing
 * it is for: an ordinary life on an ordinary budget arriving at an ordinary
 * rung. What it cannot describe is the part of a long life that comes after -
 * an ordinal 33 with five thousand years of span whose life-walk saturated at
 * age three hundred has forty-seven centuries the derivation never priced.
 *
 * So when the derivation has nothing further to give and the person is still
 * below what their book and their province permit, this module strikes at the
 * wall for real: the same `attemptBreakthrough` the player gets, with the same
 * odds, the same failure table and the same consequences.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSMISSION IS THE AXIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The designer's bar for the top of the ladder: it should be obscenely hard to
 * reach 41 and above without somebody showing you the way, and roughly one in a
 * GENERATION unaided. Three inputs carry that, and all three were already in
 * the engine and simply never supplied by the world:
 *
 *   THE BOOK    `reachableCeilingFor` is a hard stop. Nobody strikes at a rung
 *               their manual does not teach, so reaching 41 needs a book that
 *               carries there, and those sit on four shelves in the world.
 *   THE MASTER  `guidanceMultiplier` is worth up to half again on the rate, and
 *               only from somebody standing above you - "somebody who has not
 *               stood where you are standing cannot tell you anything about
 *               it". The world already names that person: `applyTeachingLines`
 *               writes a `master` relationship, and this reads it.
 *   THE CLOCK   whether a rung is reachable at all is `yearsNeeded` against
 *               `stagnationYearsForOrdinal`. Half again on the rate is the
 *               difference between arriving at the wall and settling one rung
 *               short of it, which is why a master decides outcomes here rather
 *               than merely speeding them up.
 *
 * The unaided route is not closed, because "one in a generation" is a rate and
 * not an impossibility: somebody with no house still climbs on what they hold,
 * and `applyFoundRoads` is the rare event that hands them a further book.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT COSTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `advanceWorldYears` runs thousands of simulated years in probes and tests, so
 * a per-NPC breakthrough roll every year is not affordable. It does not happen:
 *
 *   - the caller already visits each person once every twelve years, on a
 *     stable rotation keyed off their id (`ADVANCEMENT_REVIEW_YEARS`);
 *   - `readyToStrike` is arithmetic on stored fields and refuses almost
 *     everybody, because the years a rung takes are longer than the review
 *     period at every rung worth reaching;
 *   - `attemptBreakthrough` itself is only reached by somebody who has actually
 *     stood at their rung long enough to have accumulated the requirement.
 *
 * Measured, the pass stays flat across horizons. The figures are in the
 * `world/README.md` section this module is documented from.
 */

import { attemptBreakthrough, canAttemptBreakthrough } from '../cultivation/breakthrough.js';
import {
    computeCultivationRate,
    DAYS_PER_YEAR
} from '../cultivation/cultivation.js';
import {
    FoundationQualitySchema,
    stagnationYearsForOrdinal,
    type AmbientQi,
    type BreakthroughResult,
    type FoundationQuality,
    type Injury
} from '../../schema/cultivation.js';
import {
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    progressRequiredForOrdinal
} from '../cultivation/realms.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import { clearBrokenStatus } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import { carryingWounds, setRealm, woundsCarriedBy, type NpcRecord } from './npc-state.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO IS SHOWING THEM THE WAY
// ─────────────────────────────────────────────────────────────────────────

/**
 * The person the world has already named as their master, by id.
 *
 * Read off the `master` relationship rather than off "the strongest person in
 * their house", which would be a second opinion about transmission beside the
 * one `the-ties-an-ordinary-life-produces.ts` already forms - and a wrong one,
 * because that module's whole ruling is that a student is taught by the LOWEST
 * ranked person who can carry them. An apex sect's intake is taught by an outer
 * disciple who is nevertheless a Core Formation cultivator; a poor sect's is
 * taught by its elder. Reading the tie preserves that and invents nothing.
 *
 * A tie is formed once and never replaced, so somebody whose master died is
 * unguided from that day, which is the intended outcome rather than an
 * oversight - see that module on being abandoned by the person teaching you.
 */
export function masterIdOf(npc: NpcRecord): string | null {
    for (const tie of npc.relationships) {
        if (tie.kind === 'master') return tie.targetId;
    }
    return null;
}

/**
 * How far above them their master is standing, or null for nobody.
 *
 * Null and "a master at or below them" are the same answer to
 * `guidanceMultiplier` - a multiplier of 1 - and it is deliberately the
 * BASELINE rather than a penalty, so an unguided cultivator is not slowed, they
 * are merely not helped.
 */
export function guideOrdinalFor(
    npc: NpcRecord,
    livingById: ReadonlyMap<string, NpcRecord>
): number | null {
    const masterId = masterIdOf(npc);
    if (masterId === null) return null;
    const master = livingById.get(masterId);
    if (!master || master.status !== 'alive') return null;
    return master.cultivation.realmOrdinal;
}

// ─────────────────────────────────────────────────────────────────────────
// WHETHER THEY HAVE GOT AS FAR AS THE WALL
// ─────────────────────────────────────────────────────────────────────────

export interface WallConditions {
    /** The band of the ground they are standing on. */
    ambient: AmbientQi;
    /** The province's own multiplier, as `applyAdvancement` already reads it. */
    rateMultiplier: number;
    /** The rung of whoever is teaching them, or null. */
    guideOrdinal: number | null;
    /** How far the book in their hands teaches. Their hard stop. */
    manualCeiling: number;
}

export interface Readiness {
    /** Years one attempt at this rung costs at their rate. */
    yearsNeeded: number;
    /** Years of requirement they are currently holding. The progress clock. */
    yearsAccumulated: number;
    /** Years they have been stuck at this rung at all. The settling clock. */
    yearsStood: number;
    /**
     * True when they have accumulated the requirement and can strike.
     */
    ready: boolean;
    /**
     * True when the rung will not be reached from here, ever. Three ways:
     * one attempt costs more than the realm's settling allowance, or more than
     * the span they have left, or they have already stood here past the
     * allowance and the plateau has closed.
     *
     * This is the population the setting most wanted and could not produce -
     * somebody stopped by arithmetic rather than by an event, at a rung they
     * will now hold for the rest of a very long life.
     */
    settled: boolean;
}

/**
 * How long this rung takes them, and whether the clock has run.
 *
 * The same arithmetic `measureLadderReach` performs, against the same
 * functions, so the world and the ladder sweep cannot disagree about what a
 * rung costs. Two clocks decide it, and they are the two that end most lives:
 * the settling allowance, and the span the realm granted.
 *
 * Pure. Reads stored fields and returns numbers.
 */
export function readyToStrike(
    npc: NpcRecord,
    day: number,
    conditions: WallConditions
): Readiness {
    const ordinal = npc.cultivation.realmOrdinal;
    // THE LAST CROSSING IS NOT THIS MODULE'S. `applyLastCrossing` owns it and
    // runs it on the clock the crossing actually takes - twenty to fifty
    // thousand years for ONE attempt, out of a hundred-thousand-year span - so
    // that when the top of the world changes there is a named cause rather than
    // attrition. Left unguarded this pass strikes at it every eight hundred
    // years or so, which is forty times too often, and it emptied the apex:
    // measured over five thousand years with the guard missing, both seeded
    // Tribulation Transcendence figures were gone and the world's ceiling stood
    // at 38.
    if (ordinal >= LAST_CROSSING_ORDINAL) {
        return {
            yearsNeeded: Infinity, yearsAccumulated: 0, yearsStood: 0,
            ready: false, settled: false
        };
    }
    const required = progressRequiredForOrdinal(ordinal);
    const notReady = {
        yearsNeeded: Infinity, yearsAccumulated: 0, yearsStood: 0,
        ready: false, settled: true
    };
    // Above the Lid nothing is priced in qi and there is no wall to strike at.
    if (required === null) return notReady;

    const rate = computeCultivationRate(
        {
            spiritRoot: npc.cultivation.spiritRoot,
            injuries: woundsCarriedBy(npc),
            realmOrdinal: ordinal,
            foundationQuality: foundationOf(npc),
            attributes: npc.cultivation.attributes
        },
        conditions.ambient,
        {
            locationBonus: Math.max(0.1, conditions.rateMultiplier),
            // The book, priced the way the player's is: a manual that does not
            // teach this rung teaches nothing here, which `techniqueExhausted`
            // enforces inside the rate.
            techniqueCap: conditions.manualCeiling,
            techniqueBonus: 1 + npc.cultivation.attributes.insight * 0.06,
            guideOrdinal: conditions.guideOrdinal
        }
    ).perDay;
    if (rate <= 0) return notReady;

    const yearsNeeded = required / (rate * DAYS_PER_YEAR);
    // Two clocks. See `accumulatingSinceDay` - a failure moves one and not the
    // other, which is the whole reason a failed crossing costs anything.
    const since = npc.cultivation.accumulatingSinceDay || npc.cultivation.lastAdvancedOnDay;
    const yearsAccumulated = Math.max(0, (day - since) / DAYS_PER_YEAR);
    const yearsStood = Math.max(0, (day - npc.cultivation.lastAdvancedOnDay) / DAYS_PER_YEAR);
    const yearsLeft = Math.max(
        0,
        (npc.cultivation.lifespanEndsOnDay - day) / DAYS_PER_YEAR
    );

    const allowance = stagnationYearsForOrdinal(ordinal);
    const settled =
        yearsNeeded >= allowance || yearsNeeded >= yearsLeft || yearsStood >= allowance;
    return {
        yearsNeeded,
        yearsAccumulated,
        yearsStood,
        ready: !settled && yearsAccumulated >= yearsNeeded,
        settled
    };
}

/**
 * Foundation quality off the record's free-text field, or 'none'.
 *
 * Validated against the schema rather than against a list written here.
 * `NpcCultivation.foundation` is a string - "a history, not a rank" - and every
 * value the world layer writes happens to be a `FoundationQuality`, but a
 * hand-written set of the ones it writes today goes stale silently and hands
 * `foundationEffect` a key it has no row for, which is a crash rather than a
 * default. There is one list of these and it is in the schema.
 */
function foundationOf(npc: NpcRecord): FoundationQuality {
    const parsed = FoundationQualitySchema.safeParse(npc.cultivation.foundation);
    return parsed.success ? parsed.data : 'none';
}

// ─────────────────────────────────────────────────────────────────────────
// THE ATTEMPT, AND WHAT IT LEAVES
// ─────────────────────────────────────────────────────────────────────────

export interface Strike {
    npc: NpcRecord;
    result: BreakthroughResult;
    /** True when the wall killed them. The caller marks the record dead. */
    died: boolean;
}

/**
 * Strike at the wall, and return the record the outcome leaves behind.
 *
 * Everything the crossing decides is applied here rather than by the caller,
 * because the pieces are not separable: a success that forgets `arrivedBroken`
 * produces somebody who crossed cleanly when the engine said they cracked, and
 * a failure that forgets to put the accumulated years back produces somebody
 * who strikes again next review.
 *
 * Returns null when the attempt is not legal - which is a real and common
 * answer rather than an error. A cultivator carrying a ruined dantian is
 * refused by `canAttemptBreakthrough` for the rest of their life, and that
 * refusal IS the halted population.
 */
export function strikeAtTheWall(
    npc: NpcRecord,
    day: number,
    readiness: Readiness,
    rng: CultivationRNG,
    ambient: AmbientQi
): Strike | null {
    const ordinal = npc.cultivation.realmOrdinal;
    const required = progressRequiredForOrdinal(ordinal);
    if (required === null || ordinal >= Math.min(LAST_CROSSING_ORDINAL, MAX_ORDINAL)) return null;

    const injuries = woundsCarriedBy(npc);
    const subject = {
        realmOrdinal: ordinal,
        // They stood here until they had it. That is what `readyToStrike`
        // measured, and handing the requirement over is the same accounting
        // `deriveLife` does when it charges the years and then rolls.
        cultivationProgress: required,
        spiritRoot: npc.cultivation.spiritRoot,
        attributes: npc.cultivation.attributes,
        injuries,
        alive: true,
        foundationQuality: foundationOf(npc),
        name: npc.name,
        age: Math.max(0, (day - npc.identity.bornOnDay) / DAYS_PER_YEAR)
    };

    if (!canAttemptBreakthrough(subject).eligible) return null;

    const result = attemptBreakthrough(subject, {
        rng,
        ambient,
        turn: Math.floor(day)
    });

    if (result.outcome === 'death') {
        return { npc, result, died: true };
    }

    let after = npc;

    // ── What the crossing did to the body, in rows. ──
    const sustained: Injury[] = result.injuriesSustained;
    if (sustained.length > 0) after = carryingWounds(after, sustained, day);

    // ── And what it repaired. The crucible: a boundary cleared while carrying
    // a repairable break reseats it, and the caller has to actually drop the
    // wound or the report is a lie about the record.
    if (result.brokenStatusCleared) {
        const kept = clearBrokenStatus(after.cultivation.injuries, result.brokenStatusCleared);
        after = {
            ...after,
            cultivation: {
                ...after.cultivation,
                injuries: kept,
                untreatedInjuries: untreatedInjuryCount(kept)
            }
        };
    }

    if (result.outcome === 'success') {
        after = setRealm(after, result.toOrdinal, day);
        if (result.foundationEstablished) {
            after = {
                ...after,
                cultivation: { ...after.cultivation, foundation: result.foundationEstablished }
            };
        }
        // The boundary trial can also damage a foundation on the way through.
        if (result.crossing?.foundationQuality) {
            after = {
                ...after,
                cultivation: { ...after.cultivation, foundation: result.crossing.foundationQuality }
            };
        }
        return { npc: after, result, died: false };
    }

    // ── A failure, and the time it cost. ──
    //
    // `progressConsumed` is what the wall burned. What survives it is
    // `required - progressConsumed`, which in this layer's units is the years
    // of accumulation they are still holding - so the progress clock is moved
    // to the day that much accumulation would have started, and the next
    // attempt is exactly the burned years away.
    //
    // The SETTLING clock is deliberately untouched. They have been stuck at
    // this rung since they arrived at it, and failing at the wall does not make
    // that shorter. Somebody who fails repeatedly runs out of plateau and
    // settles, which is how a person ends up standing at a rung they cracked at
    // for the rest of a very long life.
    const kept = Math.max(0, 1 - result.progressConsumed / Math.max(1, required));
    const accumulatingSince = Math.min(
        day,
        Math.round(day - readiness.yearsNeeded * kept * DAYS_PER_YEAR)
    );
    after = {
        ...after,
        cultivation: { ...after.cultivation, accumulatingSinceDay: accumulatingSince },
        updatedOnDay: day
    };
    // The years the trial itself burned off the span, where it burned any.
    if (result.crossing) {
        if (result.crossing.yearsBurned > 0) {
            after = {
                ...after,
                cultivation: {
                    ...after.cultivation,
                    lifespanEndsOnDay: Math.round(
                        after.cultivation.lifespanEndsOnDay
                        - result.crossing.yearsBurned * DAYS_PER_YEAR
                    )
                }
            };
        }
        if (result.crossing.foundationQuality) {
            after = {
                ...after,
                cultivation: {
                    ...after.cultivation,
                    foundation: result.crossing.foundationQuality
                }
            };
        }
    }

    return { npc: after, result, died: false };
}
