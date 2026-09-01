/**
 * Ground time: what share of the year a cultivator spends in their house's best
 * chamber, and what that makes their rate.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Ground is the largest term in the whole model - x8 from thin to spirit tide,
 * against x4 for a realm and x1.5 for the entire legal attribute range - and
 * measured, not one person in the world was drawing on any of the good ground:
 *
 *     band          locations   occupied   people standing there
 *     thin                 64         16                     156
 *     normal              444         17                     422
 *     dense               388          0                       0
 *     spirit_tide          46          0                       0
 *
 * Four hundred and thirty-four locations of excellent ground stood entirely
 * empty while the whole population sat on thirty-three locations of normal and
 * thin. Against a sweep putting ordinal 29 at 317 years on ordinary ground and
 * 79 on a sealed vein, everybody in the world was climbing at the 317-year rate
 * permanently. That is the missing tail, and it was a placement fault rather
 * than a balance one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CHAMBERS ALREADY EXIST AND ARE ALREADY OWNED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nothing here invents a representation for a cultivation room. The world
 * already seeds 261 chambers, every one of them carrying a
 * `controllingFactionId` and its own `qiDensity`, and the empty good ground IS
 * those rooms. The Azure Cloud Pavilion holds a vein chamber at spirit tide 100
 * and a meditation cell at 97; its ground nodes sit at dense 89. So an apex
 * cultivation room is already the best ground below the Hollow Court, exactly
 * as the setting says, and the only thing missing was anybody using it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TIME, NOT POSITION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A house does not relocate a disciple onto its vein. It grants them TIME on it
 * - so many days in the chamber a year, by rank, by contribution, by favour -
 * and the rest of the year they are back on ordinary ground with everybody
 * else. That is better than moving anybody in three ways: it is a FRACTION
 * rather than a position, so no NPC moves and every other system that reads
 * `locationId` is untouched; it is FINITE AND DIVISIBLE, so it is a budget a
 * house allocates rather than a seat somebody occupies; and it makes standing
 * material, because the answer to why anybody grinds contribution stops being a
 * rank and becomes days on the vein.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO DIMENSIONS, AND BOTH HAVE TO BITE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * WHICH HOUSE YOU ARE IN SETS YOUR FLOOR. An apex holds more ground and better
 * ground and has more of it to spare, so its outer disciples are meaningfully
 * better placed than a village sect's - being in an apex is already very good,
 * at the floor and not only at the top. That is `budget / demand`: what the
 * house's rooms carry, divided by the draw of everybody in it.
 *
 * YOUR STANDING SETS HOW FAR ABOVE THAT FLOOR YOU SIT. Rank, and favour ahead
 * of rank, exactly as `shelfReach` and `chooseTheChosen` already allocate the
 * shelf.
 *
 * So a senior figure in a minor sect and a junior in an apex come out roughly
 * comparable, which is the outcome that makes joining, leaving and rising all
 * worth reasoning about.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT CANNOT RUN AWAY, WITHOUT A CAP ANYBODY CHOSE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The floor is a quotient with the house's own membership underneath it, so a
 * house cannot solve its problem by being generous: every extra member lowers
 * everybody's share. That is also, exactly, why the Hollow Court rations its
 * intake - its ground is finite and every additional member lowers the odds of
 * every existing one ascending, so admitting somebody spends the thing the
 * Court is made of. Its selectivity needs no special rule; it is a house with
 * the best ground in the world doing the arithmetic that ground forces on it.
 */

import { AMBIENT_QI_RATE_MULTIPLIER } from '../../schema/cultivation.js';
import { carryingCapacityFor, realmIntakeMultiplier } from '../cultivation/cultivation.js';
import { ordinaryBandFor, qiFraction } from './qi-scale.js';
import type { LocationRecord } from './locations.js';

/** The standing of one member, as the allocation reads it. */
export interface GroundClaimant {
    id: string;
    tags: readonly string[];
    factionRankIndex: number;
    cultivation: { realmOrdinal: number };
}

/**
 * How much more ground-time favour is worth than the rank it sits on.
 *
 * Two, because favour here is the same thing `chooseTheChosen` describes on the
 * shelf - the house hands somebody the good thing years before their rank would
 * reach it - and doubling one rung of standing is the smallest statement of
 * that which is still visible in a measurement.
 */
export const FAVOUR_IS_WORTH = 2;

/** Standing, as a weight. Rank plus one so the bottom rung is not zero. */
function standingWeight(m: GroundClaimant): number {
    return (m.factionRankIndex + 1) * (m.tags.includes('chosen') ? FAVOUR_IS_WORTH : 1);
}

/** The rate the ground at a location supplies, or null where it is unpriced. */
export function groundRateAt(location: LocationRecord | undefined): number | null {
    if (!location) return null;
    const density = location.qiDensity;
    if (typeof density !== 'number' || !Number.isFinite(density)) return null;
    return AMBIENT_QI_RATE_MULTIPLIER[ordinaryBandFor(density)];
}

/**
 * Every room a house holds, best ground first.
 *
 * Read off `controllingFactionId`, which the world already stamps on all 261
 * chambers, so a house's cultivation rooms are whatever it actually controls
 * rather than a list anybody maintains.
 */
export function roomsHeldBy(
    locations: readonly LocationRecord[],
    factionId: string
): LocationRecord[] {
    return locations
        .filter(l => l.controllingFactionId === factionId
            && typeof l.qiDensity === 'number' && Number.isFinite(l.qiDensity))
        .sort((a, b) => (b.qiDensity ?? 0) - (a.qiDensity ?? 0));
}

/**
 * What a house's BEST GROUND carries, in mortal-equivalent draws.
 *
 * The rooms in the top band only, not every room the house controls. A house
 * has one or two chambers on its vein and a great many ordinary halls, and it
 * is the vein people compete for - summing everything gave every house a budget
 * so large that the whole world sat on spirit tide all year, which is the
 * flattening this allocation exists to prevent.
 *
 * AND THE HOLLOW COURT EXEMPTION FALLS OUT OF THIS RATHER THAN BEING WRITTEN.
 * Counted off the seeded world: almost every house holds one to four rooms in
 * its best band, and the Court holds TWENTY-THREE OF TWENTY-THREE at spirit
 * tide. It sits on the best vein on the planet and has built against it, so its
 * budget is enormous and it rations nobody - which is the ruling, arrived at by
 * counting rooms rather than by naming the Court anywhere in this file. Take
 * the chambers away and the privilege goes with them.
 */
export function groundBudgetOf(rooms: readonly LocationRecord[]): number {
    if (rooms.length === 0) return 0;
    const bestBand = ordinaryBandFor(rooms[0].qiDensity ?? 0);
    return rooms.reduce((sum, r) => {
        if (ordinaryBandFor(r.qiDensity ?? 0) !== bestBand) return sum;
        const usable = r.environment?.spiritualDensity ?? qiFraction(r.qiDensity ?? 0);
        return sum + carryingCapacityFor(usable);
    }, 0);
}

/**
 * The share of the year each member spends on the house's best ground.
 *
 * `budget / demand` is the house floor and `weight / meanWeight` is the
 * standing gradient; the product is clamped into a fraction. A house with no
 * priced rooms allocates nothing and everybody stays on ordinary ground, which
 * is the honest answer rather than an error.
 */
export function groundTimeShares(
    members: readonly GroundClaimant[],
    rooms: readonly LocationRecord[]
): ReadonlyMap<string, number> {
    const out = new Map<string, number>();
    if (rooms.length === 0 || members.length === 0) return out;

    const budget = groundBudgetOf(rooms);
    // What the house asks of it. A Void Refinement elder draws what a great
    // many mortals do, which is the intake curve doing exactly what it is for.
    const demand = members.reduce(
        (sum, m) => sum + realmIntakeMultiplier(m.cultivation.realmOrdinal), 0);
    if (budget <= 0 || demand <= 0) return out;

    const floor = budget / demand;
    const weights = members.map(standingWeight);
    const meanWeight = weights.reduce((a, b) => a + b, 0) / members.length;
    if (meanWeight <= 0) return out;

    members.forEach((m, i) => {
        out.set(m.id, Math.max(0, Math.min(1, floor * (weights[i] / meanWeight))));
    });
    return out;
}

/**
 * A year averaged over the two grounds somebody actually stands on.
 *
 * The granted days in the chamber and the rest of the year wherever they
 * ordinarily are. A share of zero returns the ordinary rate exactly, so
 * everybody outside a house is untouched by all of this.
 */
export function rateOverTheYear(
    share: number,
    goodRate: number | null,
    ordinaryRate: number
): number {
    if (goodRate === null || !(share > 0)) return ordinaryRate;
    const f = Math.max(0, Math.min(1, share));
    return f * goodRate + (1 - f) * ordinaryRate;
}

/**
 * The ground a member falls back to on the days they are not in the vein
 * chamber - the house's own ordinary rooms, not the province.
 *
 * THIS IS WHAT MAKES BEING IN AN APEX GOOD AT THE FLOOR. Without it the
 * allocation produced the wrong between-house gradient: the Pavilion rations
 * its two spirit-tide chambers hard because one Tribulation Transcendence elder
 * draws what two hundred and fifty-six mortals do, so its outer disciples got a
 * small share of excellent ground and then fell back to the PROVINCE - landing
 * at 1.30 against 1.89 for an outer disciple of a small dense-ground hall.
 * Measured, and exactly backwards.
 *
 * An apex disciple who is not in the vein chamber is not standing in a field.
 * They are on the Pavilion's terraces, which are dense ground the house also
 * owns. So the fallback is the best band the house holds BELOW its top one, and
 * a house with nothing below its top one falls back to the province like
 * anybody else.
 */
export function houseFallbackRate(
    rooms: readonly LocationRecord[],
    provinceRate: number
): number {
    if (rooms.length === 0) return provinceRate;
    const bestBand = ordinaryBandFor(rooms[0].qiDensity ?? 0);
    const lesser = rooms.find(r => ordinaryBandFor(r.qiDensity ?? 0) !== bestBand);
    const rate = groundRateAt(lesser);
    // Never worse than the province: a house does not make the ground under its
    // own compound poorer than the fields outside it.
    return rate === null ? provinceRate : Math.max(rate, provinceRate);
}
