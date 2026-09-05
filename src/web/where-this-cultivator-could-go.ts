/**
 * WHERE SOMEBODY WHO HAS RUN OUT OF GROUND CAN ACTUALLY GO.
 */

import { MAX_ORDINAL, rankName } from '../engine/cultivation/realms.js';
import { rungAndOrdinal } from './facts.js';
import type { AmbientQi } from '../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/**
 * One place the player could set out for, as the catalog holds it.
 */
export interface Destination {
    name: string;
    /** Hamlet, market town, sect town, city, waystation, site - or 'province'. */
    kind: string;
    /**
     * The band a surveyor would write down. Never a multiplier.
     */
    ambient: AmbientQi | null;
    regionName: string;
    /**
     * Days, from the region's own `connections`. Null when the catalog states no
     * road - which includes every settlement inside the player's own province,
     * because nothing anywhere prices those.
     */
    travelDays: number | null;
    /** How far this province carries anybody, from its own `localCeilingOrdinal`. */
    localCeilingOrdinal: number;
    /** True when this is where they are standing right now. */
    hereNow: boolean;
    /** True when it lies in the province they are already in. */
    sameProvince: boolean;
    /**
     * How many are drawing on that ground, and what it carries - null where the
     * world holds no record of the place and the honest answer is nothing.
     */
    occupants: number | null;
    /** Mortal-equivalent draw the ground carries comfortably. */
    supportedDraw: number | null;
}

export interface DestinationsInput {
    ordinal: number;
    placeName: string;
    regionName: string;
    /**
     * How far the province they are STANDING IN carries anybody.
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
 */
/**
 * What a place is, in words somebody would use.
 */
const KIND_LABEL: Record<string, string> = {
    settlement: 'a town',
    sect_town: 'a town grown up around a sect',
    market_town: 'a market town',
    city: 'a city',
    hamlet: 'a hamlet',
    village: 'a village',
    waystation: 'a waystation',
    sect_seat: 'ground a sect holds',
    province: 'a province',
    region: 'a province',
    vein: 'a spirit vein',
    wilds: 'open country',
    ruin: 'a ruin',
    grave: 'a grave',
    scar: 'dead ground',
    forbidden_zone: 'ground nobody goes into',
    secret_realm: 'a sealed realm',
    sealed_domain: 'a sealed domain',
    cave: 'a cave',
    portal: 'a portal'
};

function kindLabel(kind: string): string {
    return KIND_LABEL[kind] ?? kind;
}

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
 */
/**
 * Who else is on that ground, in the half-sentence a chooser needs.
 */
function crowd(place: Destination): string {
    if (place.occupants === null || place.supportedDraw === null) return '';
    if (place.occupants === 0) return ' Nobody is said to draw on it at all.';
    const over = place.occupants > place.supportedDraw;
    return over
        ? ` It is spoken of as over the draw of ${place.supportedDraw} it comfortably `
          + `carries, with everybody on it slowing the rest.`
        : ` It comfortably carries a draw of ${place.supportedDraw}, and nobody speaks of `
          + `it as crowded.`;
}

/**
 * The engine channel for one destination, written as a sentence.
 */
function mechanicalRow(place: Destination, standingCeiling: number): string {
    const occupants = place.occupants ?? null;
    const supported = place.supportedDraw ?? null;
    const where = place.regionName === place.name
        ? `${place.name}, a province`
        : `${place.name}, in ${place.regionName}`;

    const clauses: string[] = [];
    if (place.travelDays !== null) {
        clauses.push(`${place.travelDays} day${place.travelDays === 1 ? '' : 's'} out`);
    }
    // A province has no band on purpose: `ambientProfile` is a distribution
    // across its settlements and flattening it would state a fact about ground
    // nobody has stood on. Saying so beats printing `ambient=unstated`.
    clauses.push(place.ambient
        ? QI[place.ambient]
        : 'no band stated, a province being a distribution rather than one ground');
    // The count is deliberately absent. See `crowd` above: `occupants` is a live
    // headcount of somewhere this cultivator has never been, and this channel is
    // read by the player. What the engine acted on is the shape and the capacity,
    // and that is what is shown - the channel's promise is that the arithmetic
    // behind what you were told is visible, not that every field the world holds
    // is.
    clauses.push(occupants === null || supported === null
        ? 'no occupancy on record'
        // Empty is its own band in `crowd`, so it has to be its own band here.
        // Without this the prose said "Nobody is said to draw on it at all" and
        // this channel said "occupancy said to sit inside the draw of 47" about
        // the same spirit vein in the same answer - two surfaces disagreeing
        // about one fact, which is the drift the engine channel exists to make
        // impossible rather than to demonstrate.
        : occupants === 0
        ? 'nothing said to be drawing on it'
        : occupants > supported
            // Capitalised because the clauses are joined with '. ' and this one
            // is never first - the band clause is always pushed ahead of it.
            ? `Occupancy said to run over the draw of ${supported} it comfortably carries, `
              + 'which is over it'
            : `Occupancy said to sit inside the draw of ${supported} it comfortably carries`);

    // The ceiling only earns a clause where it DIFFERS from the one the header
    // just stated for the ground they are standing on. Repeating "no ceiling -
    // ordinal 46" against three settlements of one province is the same defect
    // as `travelDays=unstated` on every row: a true figure, said so often it
    // buries the row where it is not true.
    const ceiling = place.localCeilingOrdinal === standingCeiling
        ? ''
        : place.localCeilingOrdinal >= MAX_ORDINAL
            ? ` No ceiling: ${rungAndOrdinal(MAX_ORDINAL)} is the top of the ladder and that `
              + 'province stops nobody.'
            : ` Carries nobody past ${rungAndOrdinal(place.localCeilingOrdinal)}.`;

    return `${where}: ${clauses.join('. ')}.${ceiling}`;
}

/**
 * Why most rows above carry no number of days, said once rather than per row.
 */
function unpricedRoads(sorted: readonly Destination[]): string | null {
    const unpriced = sorted.filter(place => place.travelDays === null).length;
    if (unpriced === 0) return null;
    return (unpriced === sorted.length
        ? `None of these ${sorted.length} carry a stated travel time. `
        : `${unpriced} of these ${sorted.length} carry no stated travel time. `)
        + 'The catalog prices roads between provinces and prices nothing between two '
        + 'settlements of one, so those are unpriced rather than near: no distance was '
        + 'assumed for them.';
}

/**
 * Why no row states a headcount, said once for the whole read.
 */
function occupancyIsReported(sorted: readonly Destination[]): string | null {
    const measured = sorted.filter(
        place => place.occupants !== null && place.supportedDraw !== null
    ).length;
    if (measured === 0) return null;
    const which = measured === sorted.length
        ? (measured === 1 ? 'The one row' : 'Every row')
        : `${measured} of these ${sorted.length} rows`;
    const verb = measured === 1 || measured === sorted.length ? 'gives' : 'give';
    return `${which} ${verb} occupancy as its shape - empty, inside what the ground `
        + 'carries, or over it - and never as a count. These are places this cultivator '
        + 'has not been to, so a count would be a headcount of somewhere unseen. The shape '
        + 'is what survives being passed along: measured over 5 seeds and 90 settlements '
        + 'across 40 years, the count moved at 60% of five-year steps and the shape at 5%.';
}

/**
 * What this cultivator's map holds, and the shape of the holes in it.
 */
function theNamesHeldAndUnplaceable(
    pointable: number,
    leavable: number,
    input: DestinationsInput
): string {
    const held = input.unplaceable;
    const where = `${input.placeName}, in ${input.regionName}, standing at `
        + rungAndOrdinal(input.ordinal);
    return (pointable === 0
        ? `Nothing at all can be pointed at from ${where}.`
        : `${pointable} place${pointable === 1 ? '' : 's'} can be pointed at from ${where}; `
          + `${leavable} of ${pointable === 1 ? 'it' : 'them'} `
          + `${leavable === 1 ? 'is' : 'are'} somewhere other than the ground underfoot and `
          + `so can be set out for.`)
        + (input.localCeilingOrdinal >= MAX_ORDINAL
            ? ` ${input.regionName} has no ceiling: ${rungAndOrdinal(MAX_ORDINAL)} is the top `
              + 'of the ladder and this province stops nobody. Every row below shares that '
              + 'unless it says otherwise.'
            : ` ${input.regionName} carries nobody past `
              + `${rungAndOrdinal(input.localCeilingOrdinal)}, and every row below shares that `
              + 'ceiling unless it says otherwise.')
        + (held > 0
            ? ` ${held} further name${held === 1 ? ' is' : 's are'} held at a stage below `
              + `placed - the word without a direction - so ${held === 1 ? 'it' : 'they'} `
              + `cannot be walked to and somebody would have to say where. `
              + `${held === 1 ? 'It is' : 'They are'} counted and never listed: naming one `
              + `would hand over a discovery that was meant to be earned.`
            : '');
}

export function whereCouldTheyGo(input: DestinationsInput): DestinationsRead {
    const lines: string[] = [];
    const structure: string[] = [];
    const standing = rankName(input.ordinal);

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
        structure.push(theNamesHeldAndUnplaceable(0, 0, input));
        return {
            headline: `Nowhere ${input.placeName} connects to that you could find.`,
            lines,
            structure
        };
    }

    // Ground that is not this ground first, because leaving is what the question
    // was about; then the province that carries furthest; then the nearest of
    // those. Sorting by name would be an ordering about the record rather than
    // about the decision. The province you are standing in is not somewhere you can
    // set out for. It arrives in this list because it is a name in the player's
    // knowledge table like any other, and it rendered as "The Jade Gorge: a
    // province, the province you are in" - which is true, tautological, and sits
    // above real destinations. The header already says where they are.
    const elsewhere = input.reachable.filter(
        p => !(p.kind === 'province' && p.sameProvince) && !p.hereNow
    );

    const sorted = [...elsewhere].sort((a, b) =>
        Number(a.sameProvince) - Number(b.sameProvince)
        || b.localCeilingOrdinal - a.localCeilingOrdinal
        || (a.travelDays ?? Number.MAX_SAFE_INTEGER) - (b.travelDays ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name));

    structure.push(theNamesHeldAndUnplaceable(input.reachable.length, sorted.length, input));

    // "You are in Green Water City, The Jade Gorge" - a settlement and the province it
    // sits in often share a name, and printing both reads as a stutter. Say the
    // place, and only add the province when it is telling you something new.
    const bare = (s: string) => s.replace(/^[Tt]he\s+/, '').toLowerCase();
    const where = bare(input.placeName) === bare(input.regionName)
        ? input.regionName
        : `${input.placeName}, ${input.regionName}`;

    // And a province with no ceiling must not be described as if it had one.
    // "The Jade Gorge carries nobody past True Immortal" is true, absurd, and
    // exactly backwards: this is the one province in the world that stops
    // nobody, which is the single most important thing about it.
    const uncapped = input.localCeilingOrdinal >= MAX_ORDINAL;
    lines.push(
        `You are in ${where}, standing at ${standing}. `
        + (uncapped
            ? `${input.regionName} has no ceiling: the ground here carries anybody `
              + 'as far as they can go.'
            : `${input.regionName} carries nobody past ${rankName(input.localCeilingOrdinal)}.`)
    );

    // The crowding clause, said once where it is the same everywhere.
    const uncrowded = sorted.filter(place =>
        place.occupants !== null && place.supportedDraw !== null
        && place.occupants > 0 && place.occupants <= place.supportedDraw);
    const shared = uncrowded.length >= 3;

    // The ceiling clause gets exactly the same treatment, and has to: fixing
    // the absurd sentence without this only traded one repetition for another,
    // and "No ceiling: it carries anybody as far as they can go" four times
    // running is the same wall the crowding was.
    const ceilingFor = (place: Destination): string =>
        place.localCeilingOrdinal === input.localCeilingOrdinal
            ? ''
            : place.localCeilingOrdinal >= MAX_ORDINAL
                ? ' No ceiling: it carries anybody as far as they can go.'
                : ` Carries nobody past ${rankName(place.localCeilingOrdinal)}.`;

    const ceilingTally = new Map<string, number>();
    for (const place of sorted) {
        const said = ceilingFor(place);
        if (said) ceilingTally.set(said, (ceilingTally.get(said) ?? 0) + 1);
    }
    let sharedCeiling = '';
    for (const [said, count] of ceilingTally) {
        if (count >= 3 && count > (ceilingTally.get(sharedCeiling) ?? 0)) sharedCeiling = said;
    }

    const preamble: string[] = [];
    if (shared) preamble.push('none of these is spoken of as crowded');
    if (sharedCeiling) {
        preamble.push(
            sharedCeiling.includes('No ceiling')
                ? 'none of them has a ceiling, and each carries anybody as far as they can go'
                : sharedCeiling.trim().replace(/^Carries nobody/, 'none carries anybody')
                    .replace(/\.$/, '')
        );
    }
    if (preamble.length) {
        lines.push(`Unless said otherwise below, ${preamble.join('; and ')}.`);
    }

    for (const place of sorted) {
        // The ceiling is only worth saying where it DIFFERS from the one just
        // stated. Repeating it against five settlements in the player's own
        // province is noise that buries the two lines that are not.
        const ceilingSaid = ceilingFor(place);
        const ceiling = ceilingSaid === sharedCeiling ? '' : ceilingSaid;
        // Uncrowded rows keep the figure and lose the verdict once it has been
        // said above. Over-drawn and unworked ground always say their own
        // sentence: those are the exceptions the list exists to surface.
        const uncrowdedHere = shared && uncrowded.includes(place);
        const said = uncrowdedHere
            ? ` It comfortably carries a draw of ${place.supportedDraw}.`
            : crowd(place);
        // "The Jade Gorge: a province, The Jade Gorge, 11 days away" - a province
        // row carries itself as its own region, so naming both stutters. The
        // header line above already guards exactly this for where the player is
        // standing; the destination rows did not.
        const saysItsOwnName = bare(place.name) === bare(place.regionName);
        lines.push(
            `${place.name}${place.hereNow ? ' (where you are)' : ''}: ${kindLabel(place.kind)}`
            + `${place.sameProvince || saysItsOwnName ? '' : `, ${place.regionName}`}, `
            + `${distance(place)}.`
            + `${place.ambient ? ` ${QI[place.ambient]}.` : ''}`
            + said
            + ceiling
        );
        structure.push(mechanicalRow(place, input.localCeilingOrdinal));
    }

    const unpriced = unpricedRoads(sorted);
    if (unpriced) structure.push(unpriced);

    const occupancyNote = occupancyIsReported(sorted);
    if (occupancyNote) structure.push(occupancyNote);

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
