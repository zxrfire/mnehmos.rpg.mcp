/**
 * The world rolling a REAL breakthrough for somebody who is not the player.
 */

import {
    attemptBreakthrough,
    canAttemptBreakthrough,
    whatACrossingTakesFrom
} from '../cultivation/breakthrough.js';
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
    type Injury,
    type Insight
} from '../../schema/cultivation.js';
import {
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    progressRequiredForOrdinal
} from '../cultivation/realms.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import {
    roadsTaughtByPractice,
    type RoadWithinReach
} from '../cultivation/what-a-road-in-reach-costs-to-walk.js';
import { clearBrokenStatus } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import {
    bodyStandingOn,
    bodyTaken,
    carryingWounds,
    maxBodyOf,
    setRealm,
    woundsCarriedBy,
    type NpcRecord
} from './npc-state.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO IS SHOWING THEM THE WAY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everybody the world has named as this person's master, by id.
 */
export function masterIdsOf(npc: NpcRecord): string[] {
    const ids: string[] = [];
    for (const tie of npc.relationships) {
        if (tie.kind === 'master') ids.push(tie.targetId);
    }
    return ids;
}

/**
 * The highest LIVING master standing above them, or null for nobody.
 */
export function guideOrdinalFor(
    npc: NpcRecord,
    livingById: ReadonlyMap<string, NpcRecord>
): number | null {
    let best: number | null = null;
    for (const masterId of masterIdsOf(npc)) {
        const master = livingById.get(masterId);
        if (!master || master.status !== 'alive') continue;
        const ord = master.cultivation.realmOrdinal;
        if (best === null || ord > best) best = ord;
    }
    return best;
}

// THE ROADS BESIDES THEIR OWN

/**
 * The roads an NPC's practice puts within reach. Not roads they have walked.
 */
export function roadsWithinReachFromPractice(npc: NpcRecord): RoadWithinReach[] {
    return roadsTaughtByPractice(npc.cultivation.techniqueIds);
}

/** How old this person is, in years, on a given day. What exposure is charged against. */
export function ageOf(npc: NpcRecord, day: number): number {
    return Math.max(0, (day - npc.identity.bornOnDay) / DAYS_PER_YEAR);
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
     * True when the rung will not be reached from here, ever. Three ways: one
     * attempt costs more than the realm's settling allowance, or more than the span
     * they have left, or they have already stood here past the allowance and the
     * plateau has closed.
     */
    settled: boolean;
}

/**
 * How long this rung takes them, and whether the clock has run.
 */
export function readyToStrike(
    npc: NpcRecord,
    day: number,
    conditions: WallConditions
): Readiness {
    const ordinal = npc.cultivation.realmOrdinal;
    // THE LAST CROSSING IS NOT THIS MODULE'S. `applyLastCrossing` owns it and runs
    // it on the clock the crossing actually takes - twenty to fifty thousand years
    // for ONE attempt, out of a hundred-thousand-year span - so that when the top
    // of the world changes there is a named cause rather than attrition. Left
    // unguarded this pass strikes at it every eight hundred years or so, which is
    // forty times too often, and it emptied the apex: measured over five thousand
    // years with the guard missing, both seeded Tribulation Transcendence figures
    // were gone and the world's ceiling stood at 38.
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
 */
export function strikeAtTheWall(
    npc: NpcRecord,
    day: number,
    readiness: Readiness,
    rng: CultivationRNG,
    ambient: AmbientQi,
    /**
     * Every road WITHIN REACH of this person, when the caller can see the world.
     */
    roads: readonly RoadWithinReach[] = [],
    /**
     * Who is standing over this crossing, when anybody is.
     */
    watch?: { share: number; by: readonly string[] }
): Strike | null {
    const ordinal = npc.cultivation.realmOrdinal;
    const required = progressRequiredForOrdinal(ordinal);
    if (required === null || ordinal >= Math.min(LAST_CROSSING_ORDINAL, MAX_ORDINAL)) return null;

    const injuries = woundsCarriedBy(npc);
    const subject = {
        realmOrdinal: ordinal,
        // NOTHING HAS HAPPENED TO THEM YET. The world writes no insight on an
        // NPC, so this is empty and stays empty; the roads below are what is in
        // REACH, and the gate charges them against the age two lines down. The
        // day this field starts carrying real comprehension - a tribulation an
        // NPC survived, written down - it will add to the same total without
        // anything here changing, which is what having one rule buys.
        insights: [] as Insight[],
        // The arts in their hands, under the name a player's row uses for the
        // same fact - so the practice channel goes through the shared rule with
        // no adapter between the two sides at all.
        knownTechniques: npc.cultivation.techniqueIds,
        roadsWithinReach: roads,
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
        turn: Math.floor(day),
        // The watch, or nothing. `protection` is a share of a full watch and
        // `protectionBy` is the label the ledger line carries, both of them
        // `BreakthroughContext`'s own fields - so there is one protection term
        // in the odds and this supplies it rather than adding a second.
        ...(watch && watch.share > 0
            ? { protection: watch.share, protectionBy: watch.by }
            : {})
    });

    if (result.outcome === 'death') {
        return { npc, result, died: true };
    }

    let after = npc;

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
        // AND WHAT ARRIVING COST THE BODY
        const taken = whatACrossingTakesFrom(
            bodyStandingOn(after, day),
            maxBodyOf(after),
            result.bodyCost
        );
        if (taken > 0) after = bodyTaken(after, taken, day);
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

    // A failure, and the time it cost.
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
