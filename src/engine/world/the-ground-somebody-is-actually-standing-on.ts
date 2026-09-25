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
 * ground, and its lesser ground is still good (`houseFallbackRate`), so being
 * in an apex is already very good at the floor and not only at the top.
 *
 * YOUR STANDING DECIDES WHETHER YOU GET A SEAT. Rank, and favour ahead of rank,
 * exactly as `shelfReach` and `chooseTheChosen` already allocate the shelf.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A ROOM SEATS ONE, TWO AT MOST, AND A SECOND HALVES IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The owner's rule for a cultivation room: one person, two at most (dual
 * cultivation, or a half sold for cash), and a second person halves what each
 * of them draws. So a room is one person's year of qi, whoever it is split
 * between, and a house seats at most two per room on its best ground. Members
 * are seated by standing; while there are rooms to spare each seat is a room
 * alone, past that the lowest seated double up, and past two a room the rest
 * have no time on it at all. This replaced a budget counted at each room's
 * carrying capacity in mortal draws, which seated far more than two.
 *
 * A pair's half is taken as half the year (share 0.5), not half the rate all
 * year: two keyholders who take turns get the same qi from the room as two who
 * sit together, and spend their other half on the house's lesser ground.
 *
 * It still cannot run away without a cap anybody chose: seats are rooms, so a
 * house that admits past its seats admits people who will not sit on its vein.
 * That is why the Hollow Court can afford nobody it does not choose.
 */

import { AMBIENT_QI_RATE_MULTIPLIER } from '../../schema/cultivation.js';
import { ordinaryBandFor } from './qi-scale.js';
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

/** People a cultivation room seats at once. The owner's rule; see the header. */
export const A_ROOM_SEATS = 2;

/** What each of two in one room gets of it: one room's qi split two ways. */
export const A_SHARED_ROOM_GIVES = 0.5;

/**
 * The rooms on a house's BEST GROUND - the top band only.
 *
 * A house has one or two chambers on its vein and a great many ordinary halls,
 * and it is the vein people compete for. The Hollow Court holds every one of
 * its rooms at spirit tide, so it seats far more than anybody else, and that
 * falls out of counting rooms rather than naming the Court.
 */
function roomsOnTheBestGround(rooms: readonly LocationRecord[]): number {
    if (rooms.length === 0) return 0;
    const bestBand = ordinaryBandFor(rooms[0].qiDensity ?? 0);
    return rooms.filter(r => ordinaryBandFor(r.qiDensity ?? 0) === bestBand).length;
}

/** Seats on a house's best ground: two a room. */
export function groundBudgetOf(rooms: readonly LocationRecord[]): number {
    return A_ROOM_SEATS * roomsOnTheBestGround(rooms);
}

/** Standing first, then realm, then id, so the order never depends on the caller's. */
function byStanding(a: GroundClaimant, b: GroundClaimant): number {
    return standingWeight(b) - standingWeight(a)
        || b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The share of the year each member spends on the house's best ground.
 *
 * Seated by standing: a room alone is the whole year, a shared room half of
 * it, and nobody past the seats gets any. A house with no priced rooms
 * allocates nothing and everybody stays on ordinary ground.
 */
export function groundTimeShares(
    members: readonly GroundClaimant[],
    rooms: readonly LocationRecord[]
): ReadonlyMap<string, number> {
    const out = new Map<string, number>();
    const roomCount = roomsOnTheBestGround(rooms);
    if (roomCount === 0 || members.length === 0) return out;

    const queue = [...members].sort(byStanding);
    const seated = Math.min(queue.length, groundBudgetOf(rooms));
    // The seats past one a room are second people in a room somebody holds.
    const alone = roomCount - Math.max(0, seated - roomCount);
    queue.forEach((m, i) => {
        out.set(m.id, i < alone ? 1 : i < seated ? A_SHARED_ROOM_GIVES : 0);
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A MEMBER IS ENTITLED TO, FOR ANYBODY WHO HAS TO SAY IT OUT LOUD
//
// Everything above computes ground time for the world's own people and hands
// the answer straight to the advancement pass, which is exactly the shape of
// defect AGENTS.md records under "the world's rules must bind the player too" -
// running in the direction nobody watches for. The recorded case is a system
// that bound every NPC and never reached the player. This is the mirror image:
// a BENEFIT the world computes for its own people and never offers to the
// player, who is then quietly slower than every NPC alive for a reason they
// cannot see, on the largest multiplier in the model.
//
// Found by playing rather than by reading, which is the only thing that ever
// finds these. In the live UI, as a sect member:
//
//     "I go to the sect cultivation chamber"  -> a name that is not a place
//     "I ask for time on the vein"            -> the interact dead end
//     "where can I cultivate in the sect"     -> answers about manuals
//
// THE SEAM. This function is the ENTITLEMENT and it belongs here, because it
// has to be the same arithmetic the world runs or the player is being told a
// story about a different world. The VERB is not here: phrasing, refusals and
// what goes on the sheet belong to `src/web/game.ts` and `actions.ts`. Nothing
// below decides what anybody is allowed to ask for or writes any prose.
//
// TWO THINGS THE CALLER NEEDS THAT THE WORLD ITSELF NEVER ASKS FOR, and they
// are why this is a separate function rather than an export of the internals:
//
//   DAYS, NOT A FRACTION. "Your rank gets you 46 days a year in the vein
//   chamber" is an entitlement somebody can act on. 0.126 is a number.
//
//   WHAT THE NEXT RUNG WOULD GET. A refusal that teaches needs the delta, so
//   an outer disciple told no can be told what rank reaches it. That is the
//   difference between a wall and a goal, and it is the concrete answer to the
//   two hundred and forty-four people measured sitting qualified-and-blocked -
//   it is the first thing rank has ever visibly bought.
// ─────────────────────────────────────────────────────────────────────────

/** Days in a year, for turning a share into something a person can act on. */
export const DAYS_IN_A_YEAR = 365;

export interface GroundEntitlement {
    factionId: string;
    /** The room the share is measured against, or null where the house has none. */
    room: { id: string; name: string; density: number; band: string } | null;
    /** Share of the year on that ground, 0..1. */
    share: number;
    /** The same figure as days, which is the form worth saying out loud. */
    daysPerYear: number;
    /** Rate in the room, null where the house holds no priced ground. */
    chamberRate: number | null;
    /** Rate on the days they are not in it - the house's own lesser ground. */
    fallbackRate: number;
    /** The year averaged over both, which is what their climb actually runs at. */
    effectiveRate: number;
    /**
     * What the rung above would be worth, or null at the top of the house.
     *
     * For refusals that teach. The share is recomputed with this member moved
     * up one rank and everybody else held still, so it answers "what would a
     * promotion get me" rather than "what does the person above me have",
     * which are different numbers whenever the house is lopsided.
     */
    atNextRank: { rankIndex: number; daysPerYear: number; effectiveRate: number } | null;
}

/**
 * What this member's standing entitles them to on their house's ground.
 *
 * Pure, and takes the same shapes the allocation already uses, so a caller
 * reading it for the player gets the identical arithmetic the world ran for
 * every NPC in the same house on the same day.
 */
export function groundEntitlementFor(
    member: GroundClaimant,
    factionId: string,
    members: readonly GroundClaimant[],
    rooms: readonly LocationRecord[],
    provinceRate: number,
    rankCount: number
): GroundEntitlement {
    const shares = groundTimeShares(members, rooms);
    const share = shares.get(member.id) ?? 0;
    const chamberRate = groundRateAt(rooms[0]);
    const fallbackRate = houseFallbackRate(rooms, provinceRate);
    const best = rooms[0];

    const atTop = member.factionRankIndex >= rankCount - 1;
    let atNextRank: GroundEntitlement['atNextRank'] = null;
    if (!atTop) {
        const promoted = { ...member, factionRankIndex: member.factionRankIndex + 1 };
        const after = groundTimeShares(
            members.map(m => (m.id === member.id ? promoted : m)), rooms
        ).get(member.id) ?? 0;
        atNextRank = {
            rankIndex: promoted.factionRankIndex,
            daysPerYear: Math.round(after * DAYS_IN_A_YEAR),
            effectiveRate: rateOverTheYear(after, chamberRate, fallbackRate)
        };
    }

    return {
        factionId,
        room: best && typeof best.qiDensity === 'number'
            ? {
                id: best.id,
                name: best.name,
                density: best.qiDensity,
                band: ordinaryBandFor(best.qiDensity)
            }
            : null,
        share,
        daysPerYear: Math.round(share * DAYS_IN_A_YEAR),
        chamberRate,
        fallbackRate,
        effectiveRate: rateOverTheYear(share, chamberRate, fallbackRate),
        atNextRank
    };
}
