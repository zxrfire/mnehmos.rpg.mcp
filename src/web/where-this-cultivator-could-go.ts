/**
 * WHERE SOMEBODY WHO HAS RUN OUT OF GROUND CAN ACTUALLY GO.
 *
 * The answer to being stuck is to leave, so a player who cannot find out where
 * has pressure with no outlet. Measured over the real endpoint by
 * `scripts/playtest-the-drive.mjs`: "what places do I know of" answered,
 * "where can I go", "what is nearby" and "where is there better spiritual
 * energy" all refused. The capability was mostly there and the sentences were
 * not, which is the cheapest kind of defect and the easiest to leave in place.
 *
 * ── WHAT THIS ADDS OVER `recall` ─────────────────────────────────────────
 *
 * `recall` already lists what the player has heard of, and that is a genuinely
 * different question: it reads their own knowledge rows and says what they
 * hold. It answers "what have I heard of". It cannot answer "where can I go",
 * because a list of names carries no cost and no reason to prefer one.
 *
 * Three facts turn a name into a destination, and the catalog holds all three:
 *
 *   `travelDays`   on `RegionConnection`. What getting there costs.
 *   `ambient`      on `RegionPlace`. Whether the qi there is better than here,
 *                  which is the whole of why a stalled cultivator moves.
 *   `localCeilingOrdinal`  on the region. How far that province carries
 *                  anybody at all - the number that decides whether the move
 *                  is worth making or is the same wall one week's walk away.
 *
 * ── THE DISCOVERY CONSTRAINT ─────────────────────────────────────────────
 *
 * `REACHABLE_FROM` is `placed` - "they know where, or who, or when" - and it
 * is the predicate a travel verb wants. A cultivator who heard "Kettle"
 * through a wall holds the word and does not know it is a town, which
 * direction it lies or whether it is a person, so they cannot set out for it.
 * Below `placed` a name is a sound.
 *
 * So this read has two tiers and they are not the same list:
 *
 *   SOMEWHERE TO GO   `canPointAt` passes. Name it, price it, say what the qi
 *                     is like and how far that province carries anybody.
 *   A NAME AND NOTHING ELSE   they hold the word and cannot use it. Counted,
 *                     never listed, because listing them would quietly promote
 *                     a whisper into a destination and spend a discovery the
 *                     player was supposed to earn.
 *
 * The count is the honest middle: "and four names you cannot place" tells a
 * player their map has holes in it without filling one of them in.
 */

import { rankName } from '../engine/cultivation/realms.js';
import type { AmbientQi } from '../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/**
 * One place the player could set out for, as the catalog holds it.
 *
 * A name in the knowledge table can be either scale, and both are real
 * destinations. This was found by playing: the first build of this read looked
 * up settlements only, so "The Low Fall" and "The Drowned Reach" - PROVINCES,
 * and the only names in the world with a stated `travelDays` next to them -
 * were silently dropped. The read listed five settlements in the player's own
 * province, all of them zero days away, and the travel-cost half of it was
 * dead code that never ran.
 */
export interface Destination {
    name: string;
    /** Hamlet, market town, sect town, city, waystation, site - or 'province'. */
    kind: string;
    /**
     * The band a surveyor would write down. Never a multiplier.
     *
     * Null for a province, and that is the honest answer rather than an
     * average: a region's `ambientProfile` is a distribution over its
     * settlements, and collapsing it to one band would invent a fact about
     * ground the player has not stood on.
     */
    ambient: AmbientQi | null;
    regionName: string;
    /**
     * Days, from the region's own `connections`. Null when the catalog states
     * no road - which includes every settlement inside the player's own
     * province, because nothing anywhere prices those.
     *
     * Never zero as a stand-in for "near". A fabricated zero is a number a
     * player will plan around.
     */
    travelDays: number | null;
    /** How far this province carries anybody, from its own `localCeilingOrdinal`. */
    localCeilingOrdinal: number;
    /** True when this is where they are standing right now. */
    hereNow: boolean;
    /** True when it lies in the province they are already in. */
    sameProvince: boolean;
}

export interface DestinationsInput {
    ordinal: number;
    placeName: string;
    regionName: string;
    /**
     * How far the province they are STANDING IN carries anybody.
     *
     * Passed rather than picked out of `reachable`, because the player's own
     * settlement is not guaranteed to be in that list and the first build
     * fell back to the first row when it was missing - which reported another
     * province's ceiling as though it were this one's.
     */
    localCeilingOrdinal: number;
    /** Already filtered to `canPointAt`. This module applies no gate of its own. */
    reachable: readonly Destination[];
    /**
     * How many names they hold and cannot place.
     *
     * A count, deliberately. See the banner: the names themselves must not
     * cross into this read.
     */
    unplaceable: number;
}

export interface DestinationsRead {
    headline: string;
    lines: string[];
    structure: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

/** How a band reads to somebody deciding whether the walk is worth it. */
const QI: Record<AmbientQi, string> = {
    thin: 'thin qi, half rate',
    normal: 'ordinary qi',
    dense: 'dense qi, double rate',
    spirit_tide: 'a spirit tide, triple rate, and temporary',
    sealed_vein: 'a sealed vein, quadruple rate'
};

/**
 * What the journey costs, or the honest admission that nothing prices it.
 *
 * Never invents a zero. The catalog states `travelDays` between PROVINCES and
 * states nothing at all between settlements inside one, so a settlement two
 * valleys over and the market town the player is standing in are equally
 * unpriced - and printing "0 days away" against both, which the first build
 * did, is a number a player would plan around and the engine never said.
 */
function distance(place: Destination): string {
    if (place.hereNow) return 'where you are standing';
    // The player's own province is a name in their knowledge table like any
    // other, so it turns up in this list - and "in this province, and nothing
    // states how far" is a true sentence and a ridiculous one to read about
    // the ground under your feet.
    if (place.kind === 'province' && place.sameProvince) return 'the province you are in';
    if (place.travelDays !== null) {
        return `${place.travelDays} day${place.travelDays === 1 ? '' : 's'} away`;
    }
    return place.sameProvince
        ? 'in this province, and nothing states how far'
        : 'no road stated from here';
}

/**
 * Everywhere they could set out for, priced, with the qi and the ceiling.
 *
 * Sorted by what a stalled cultivator is actually choosing on: the ground that
 * carries them furthest first, and nearer before further where two provinces
 * carry the same distance. Not by name, and not by discovery order - both of
 * those are orderings about the record rather than about the decision.
 */
export function whereCouldTheyGo(input: DestinationsInput): DestinationsRead {
    const lines: string[] = [];
    const structure: string[] = [];
    const standing = rankName(input.ordinal);

    structure.push(
        `reachable=${input.reachable.length}, unplaceable=${input.unplaceable}, `
        + `ordinal=${input.ordinal}, from=${input.regionName}`
    );

    if (input.reachable.length === 0) {
        lines.push(
            `You are in ${input.placeName}, in ${input.regionName}, and you cannot place `
            + `anywhere else well enough to set out for it. A name heard through a wall is `
            + `not a direction.`
        );
        if (input.unplaceable > 0) {
            lines.push(
                `${input.unplaceable} name${input.unplaceable === 1 ? '' : 's'} you are `
                + `carrying, and not one of them is a place you could walk to yet. Somebody `
                + `would have to tell you where.`
            );
        }
        return {
            headline: `Nowhere ${input.placeName} connects to that you could find.`,
            lines,
            structure
        };
    }

    // Ground that is not this ground first, because leaving is what the
    // question was about; then the province that carries furthest; then the
    // nearest of those. Sorting by name would be an ordering about the record
    // rather than about the decision.
    const sorted = [...input.reachable].sort((a, b) =>
        Number(a.sameProvince) - Number(b.sameProvince)
        || b.localCeilingOrdinal - a.localCeilingOrdinal
        || (a.travelDays ?? Number.MAX_SAFE_INTEGER) - (b.travelDays ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name));

    lines.push(
        `You are in ${input.placeName}, ${input.regionName}, standing at ${standing}. `
        + `${input.regionName} carries nobody past ${rankName(input.localCeilingOrdinal)}.`
    );

    for (const place of sorted) {
        // The ceiling is only worth saying where it DIFFERS from the one just
        // stated. Repeating it against five settlements in the player's own
        // province is noise that buries the two lines that are not.
        const ceiling = place.localCeilingOrdinal === input.localCeilingOrdinal
            ? ''
            : ` Carries nobody past ${rankName(place.localCeilingOrdinal)}.`;
        lines.push(
            `${place.name}${place.hereNow ? ' (where you are)' : ''}: ${place.kind}`
            + `${place.sameProvince ? '' : `, ${place.regionName}`}, `
            + `${distance(place)}.`
            + `${place.ambient ? ` ${QI[place.ambient]}.` : ''}`
            + ceiling
        );
        structure.push(
            `${place.name}: region=${place.regionName}, `
            + `travelDays=${place.travelDays ?? 'unstated'}, `
            + `ambient=${place.ambient ?? 'unstated'}, `
            + `localCeilingOrdinal=${place.localCeilingOrdinal}`
        );
    }

    if (input.unplaceable > 0) {
        lines.push(
            `There are ${input.unplaceable} further name${input.unplaceable === 1 ? '' : 's'} `
            + `you are carrying that you cannot place. You know the word and not the road.`
        );
    }

    return {
        headline: `${sorted.length} place${sorted.length === 1 ? '' : 's'} `
            + `${input.placeName} could be left for.`,
        lines,
        structure
    };
}
