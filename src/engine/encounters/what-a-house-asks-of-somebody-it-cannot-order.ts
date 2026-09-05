/**
 * What a house puts to somebody it cannot order.
 *
 * A house that wants a different answer changes one of its own numbers. There is
 * no `if (factionId === ...)` anywhere below and there must not be one.
 *
 * It does not draw - no RNG and no window; whether an approach ARRIVES is a
 * window question and the draw site is `attemptSummons` in `window.ts`. It does
 * not write, and it never refuses an approach because the cultivator is too
 * strong: a house approaching somebody far above it is wasting its own time, and
 * the engine's job is to say what the offer is worth.
 */

import { SECTS, getSect, type SectEntry } from '../../data/cultivation/sects.js';
import { rankRealmBand } from '../../data/cultivation/members.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { clampOrdinal } from '../cultivation/realms.js';
import type { RefusalTerms } from './duties.js';

// WHERE SOMEBODY STANDS WITH A HOUSE

/**
 * How a house has to address this person, which is a function of the highest
 * rung on its own ladder their realm justifies and of nothing else.
 */
export type HouseStanding =
    /** Below the door. There is no rung for them at all. */
    | 'turned_away'
    /** A rung below the elder line. The house recruits, and gives orders. */
    | 'recruited'
    /** An elder's rung. Offering somebody leadership is a negotiation. */
    | 'courted'
    /** The top rung or past the whole ladder. Nothing it says is an order. */
    | 'deferred_to';

/**
 * The highest rung of this house's ladder the cultivator's realm justifies, or
 * null when they are beneath its door. Measured off `rankRealmBand` over the
 * whole catalog. `recruits: false` is honoured at the one place it means
 * something - a house that takes no applicants has no disciple's place to offer -
 * and is never a refusal to approach: a closed gate is not an empty compound.
 */
export function seatOfferedBy(factionId: string, ordinal: number): number | null {
    const house = getSect(factionId);
    if (!house) return null;
    const o = clampOrdinal(ordinal);
    let seat: number | null = null;
    for (let rank = 0; rank < house.ranks.length; rank += 1) {
        const band = rankRealmBand(factionId, rank);
        if (band && band.minOrdinal <= o) seat = rank;
    }
    return seat;
}

/**
 * How the house has to talk to them.
 */
export function houseStanding(factionId: string, ordinal: number): HouseStanding {
    const house = getSect(factionId);
    if (!house) return 'turned_away';
    const seat = seatOfferedBy(factionId, ordinal);
    if (seat === null) return 'turned_away';

    const top = Math.max(0, house.ranks.length - 1);
    if (seat >= top) return 'deferred_to';
    if (seat >= elderRungOf(house.ranks.length)) return 'courted';
    return house.recruits ? 'recruited' : 'courted';
}

/** True where the house cannot place this person under anybody. */
export function beyondRecruiting(standing: HouseStanding): boolean {
    return standing === 'courted' || standing === 'deferred_to';
}

// WHAT IS OFFERED

/**
 * The margin, in rungs, at which a house's protection at a crossing is worth
 * everything it can be worth.
 */
export const PROTECTION_REACH_RUNGS = 12;

/**
 * How much of `MAX_SECT_PROTECTION` this house can actually put behind a
 * crossing at this rung. 0..1, and 0 is common and correct.
 */
export function protectionOffered(housePowerOrdinal: number, ordinal: number): number {
    const margin = clampOrdinal(housePowerOrdinal) - clampOrdinal(ordinal);
    if (margin <= 0) return 0;
    return Math.min(1, margin / PROTECTION_REACH_RUNGS);
}

/**
 * What the house is actually putting on the table. Ordered by how much of itself
 * the house is spending, and each is available only where the house's own columns
 * support it - so a house with no rivals never offers a counterweight.
 */
export type OfferKind =
    /** A rung, and what that rung is paid. Requires a seat to exist. */
    | 'seat'
    /** They will stand between this person and their next realm boundary. */
    | 'protection'
    /** They are losing to somebody who reaches as high as they do. */
    | 'counterweight'
    /** Somebody else has a hand on what they want, and they want it pressed. */
    | 'recognition'
    /** Stones and supply. No rung, no oath, and the floor of the table. */
    | 'patronage';

export interface Approach {
    factionId: string;
    factionName: string;
    standing: HouseStanding;
    kind: OfferKind;

    /** The rung offered, or null where the offer carries no seat. */
    seatRankIndex: number | null;
    seatTitle: string | null;
    /** Monthly stipend of that rung, straight off `stipend[]`. Zero with no seat. */
    stipendPerMonth: number;

    /**
     * 0..1, fed straight to `computePriceOdds`'s `sectProtection`. Zero where
     * the house cannot reach past the crossing, which is most of them for
     * anybody high enough to be approached at all.
     */
    sectProtection: number;
    /** How far the house outreaches this cultivator, in rungs. May be negative. */
    reachMargin: number;

    /**
     * Ids whose standing this costs if the offer is taken: the house's rivals,
     * and everybody with a hand on what it is contesting. The reason an
     * approach is a decision rather than a gift.
     */
    costsStandingWith: readonly string[];

    /** Factual, engine-authored. Never narration. */
    wants: string;
    /** How the ledger records declining. Nothing was owed, so nothing is grave. */
    declining: RefusalTerms;
}

/**
 * What one house would put to this person, or null when it has nothing to put.
 */
export function approachFrom(
    house: SectEntry,
    ordinal: number,
    heldFactionIds: readonly string[] = []
): Approach | null {
    // A house does not approach somebody it already holds. That conversation
    // is `promotion-inside-a-house.ts` and it is a different one.
    if (heldFactionIds.includes(house.id)) return null;

    const standing = houseStanding(house.id, ordinal);
    if (!beyondRecruiting(standing)) return null;

    const seat = seatOfferedBy(house.id, ordinal);
    const top = Math.max(0, house.ranks.length - 1);
    // A seat in an approach is leadership or it is nothing, and both bounds are
    // load-bearing. Below the elder line it is ordinary recruitment, which is
    // the conversation this file is not - and it is reachable here, because a
    // house that takes no applicants negotiates at every rung including its
    // low ones. At the top it is somebody's chair, and a house does not hand
    // that to a stranger.
    const elder = elderRungOf(house.ranks.length);
    const seatRankIndex = seat !== null && seat >= elder && seat < top ? seat : null;

    const protection = protectionOffered(house.powerOrdinal, ordinal);
    const reachMargin = clampOrdinal(house.powerOrdinal) - clampOrdinal(ordinal);

    const contested = house.ambition?.contestedWith ?? [];
    const outreachedRivals = house.rivals.filter(id => {
        const rival = getSect(id);
        return rival != null && rival.powerOrdinal >= house.powerOrdinal;
    });

    // Ordered by how much of itself the house is spending. The first one its
    // own columns support is what it leads with.
    const kind: OfferKind =
        seatRankIndex !== null ? 'seat'
        : protection > 0 ? 'protection'
        : outreachedRivals.length > 0 ? 'counterweight'
        : contested.length > 0 ? 'recognition'
        : 'patronage';

    return {
        factionId: house.id,
        factionName: house.name,
        standing,
        kind,
        seatRankIndex,
        seatTitle: seatRankIndex === null ? null : house.ranks[seatRankIndex],
        stipendPerMonth: seatRankIndex === null ? 0 : house.stipend[seatRankIndex] ?? 0,
        sectProtection: protection,
        reachMargin,
        costsStandingWith: [...new Set([...house.rivals, ...contested])].sort(),
        wants: wantsOf(house, standing, outreachedRivals.length > 0, contested.length > 0),
        declining: {
            kind: 'grudge',
            cause: 'other',
            // Nothing was owed. An approach declined is a house that asked and
            // was told no, which is a slight and is remembered as one - the
            // ledger's `grave` and `unforgivable` belong to broken oaths.
            severity: 'slight',
            description:
                `${house.name} put terms to them and they were not taken. `
                + `Nothing was owed, and the offer was not made twice.`
        }
    };
}

/**
 * What the house is after, in one factual line.
 */
function wantsOf(
    house: SectEntry,
    standing: HouseStanding,
    losingToRival: boolean,
    contesting: boolean
): string {
    if (losingToRival) {
        return `Somebody standing on their side of a feud they are not winning.`;
    }
    if (contesting) {
        return `${house.ambition?.wants ?? 'What they are after'} - pressed by somebody `
            + `nobody in the house can be sent to press it.`;
    }
    return standing === 'deferred_to'
        ? `The association. Nothing they could ask for would be an instruction.`
        : `A name on the roll at a rung they cannot fill from inside.`;
}

// THE TABLE

/**
 * Every house in the world that would put terms to this person.
 */
export function approachesTo(
    ordinal: number,
    heldFactionIds: readonly string[] = []
): Approach[] {
    const out: Approach[] = [];
    for (const house of SECTS) {
        const approach = approachFrom(house, ordinal, heldFactionIds);
        if (approach) out.push(approach);
    }
    out.sort(
        (a, b) =>
            (b.seatRankIndex ?? -1) - (a.seatRankIndex ?? -1) ||
            b.reachMargin - a.reachMargin ||
            (a.factionId < b.factionId ? -1 : a.factionId > b.factionId ? 1 : 0)
    );
    return out;
}

/**
 * The shape of the world's answer at one rung, for measurement and for the
 * ceiling read a player can ask for.
 *
 * This is the curve in the header comment, computed rather than quoted.
 */
export interface RecruitmentShape {
    ordinal: number;
    turnedAway: number;
    recruited: number;
    courted: number;
    deferredTo: number;
}

export function recruitmentShapeAt(ordinal: number): RecruitmentShape {
    const shape: RecruitmentShape = {
        ordinal: clampOrdinal(ordinal),
        turnedAway: 0,
        recruited: 0,
        courted: 0,
        deferredTo: 0
    };
    for (const house of SECTS) {
        switch (houseStanding(house.id, ordinal)) {
            case 'turned_away': shape.turnedAway += 1; break;
            case 'recruited': shape.recruited += 1; break;
            case 'courted': shape.courted += 1; break;
            case 'deferred_to': shape.deferredTo += 1; break;
        }
    }
    return shape;
}
