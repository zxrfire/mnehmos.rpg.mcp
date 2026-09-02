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

import { MAX_ORDINAL, rankName } from '../engine/cultivation/realms.js';
import { rungAndOrdinal } from './facts.js';
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
    /**
     * How many are drawing on that ground, and what it carries - null where the
     * world holds no record of the place and the honest answer is nothing.
     *
     * The band alone is HALF the answer and it is the smaller half. Measured:
     * occupancy moves the rate 4.5x between the emptiest and busiest ground,
     * wider than the whole thin-to-normal band range, and `thin` ground with
     * nobody on it beat `normal` ground with a crowd by 2.7x. A player choosing
     * where to spend forty years off the band alone is choosing on the wrong
     * number.
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
/**
 * What a place is, in words somebody would use.
 *
 * `LocationKind` is an engine enum and it was being printed raw, so the player
 * was told a place was a `sect_town`. That is the same failure as naming a ruin
 * "the sealed compound at X": the type system leaking into the fiction. Nobody
 * in this world says sect_town.
 *
 * Unknown kinds fall through to the raw value rather than to a guess, so a kind
 * added later reads oddly instead of reading wrongly.
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
 *
 * Sorted by what a stalled cultivator is actually choosing on: the ground that
 * carries them furthest first, and nearer before further where two provinces
 * carry the same distance. Not by name, and not by discovery order - both of
 * those are orderings about the record rather than about the decision.
 */
/**
 * Who else is on that ground, in the half-sentence a chooser needs.
 *
 * Silent where the world holds no record, because "nobody is there" and
 * "nobody has looked" are different facts and only one of them is measured.
 * Deliberately not a multiplier: this read prices roads, and a number that
 * looked like a rate here would be a second opinion about one the sheet already
 * states. What it says is empty, comfortable, or over - which is the shape of
 * the decision.
 */
function crowd(place: Destination): string {
    if (place.occupants === null || place.supportedDraw === null) return '';
    if (place.occupants === 0) return ' Nobody is drawing on it.';
    const over = place.occupants > place.supportedDraw;
    return over
        ? ` ${place.occupants} are drawing on ground that comfortably carries `
          + `${place.supportedDraw}, and every one of them is slowing the rest.`
        : ` ${place.occupants} drawing on it, which it carries comfortably.`;
}

/**
 * The engine channel for one destination, written as a sentence.
 *
 * Every figure the field dump carried is still here - the province, the days,
 * the band, the head count against what the ground carries, the ceiling - and
 * `travelDays` is the one that leaves, because it was `unstated` on every row
 * in an ordinary read and a null repeated eight times is not a measurement.
 * {@link unpricedRoads} says it once instead, and says why.
 *
 * This channel is read by the player, not only by an operator: the log is where
 * the promise that the engine's arithmetic is visible is actually kept. So the
 * standard it is written to is the breakthrough line - exact, checkable,
 * unhedged, and a sentence.
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
    clauses.push(occupants === null || supported === null
        ? 'no occupancy on record'
        : occupants > supported
            ? `${occupants} drawing on ground that comfortably carries ${supported}, `
              + 'which is over it'
            : `${occupants} drawing on ground that comfortably carries ${supported}`);

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
 *
 * The catalog prices roads BETWEEN provinces and prices nothing between two
 * settlements of one, so a settlement two valleys over is genuinely unpriced.
 * That is a real state and worth stating; stating it eight times as
 * `travelDays=unstated` buried the rows that did carry a figure.
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
 * What this cultivator's map holds, and the shape of the holes in it.
 *
 * Two counts rather than one, because they answer different questions and
 * printing only `reachable=9` next to a headline reading "3 places" is a
 * contradiction a player has to resolve for themselves. What can be POINTED AT
 * includes the ground under their feet and the province they are already in;
 * what can be LEFT FOR does not.
 *
 * `unplaceable` was a bare integer, which said that something was missing and
 * not what. It is the count of names held below `placed` - a word without a
 * direction - and what it means for the player is that the road has to come
 * from somebody else. Naming which ones is exactly the discovery this read
 * refuses to spend, so the count says what kind of thing it is counting
 * instead.
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

    // Ground that is not this ground first, because leaving is what the
    // question was about; then the province that carries furthest; then the
    // nearest of those. Sorting by name would be an ordering about the record
    // rather than about the decision.
    // The province you are standing in is not somewhere you can set out for.
    // It arrives in this list because it is a name in the player's knowledge
    // table like any other, and it rendered as "The Low Fall: a province, the
    // province you are in" - which is true, tautological, and sits above real
    // destinations. The header already says where they are.
    const elsewhere = input.reachable.filter(
        p => !(p.kind === 'province' && p.sameProvince) && !p.hereNow
    );

    const sorted = [...elsewhere].sort((a, b) =>
        Number(a.sameProvince) - Number(b.sameProvince)
        || b.localCeilingOrdinal - a.localCeilingOrdinal
        || (a.travelDays ?? Number.MAX_SAFE_INTEGER) - (b.travelDays ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name));

    structure.push(theNamesHeldAndUnplaceable(input.reachable.length, sorted.length, input));

    // "You are in Low Fall, The Low Fall" - a settlement and the province it
    // sits in often share a name, and printing both reads as a stutter. Say the
    // place, and only add the province when it is telling you something new.
    const bare = (s: string) => s.replace(/^[Tt]he\s+/, '').toLowerCase();
    const where = bare(input.placeName) === bare(input.regionName)
        ? input.regionName
        : `${input.placeName}, ${input.regionName}`;

    // And a province with no ceiling must not be described as if it had one.
    // "The Low Fall carries nobody past True Immortal" is true, absurd, and
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

    for (const place of sorted) {
        // The ceiling is only worth saying where it DIFFERS from the one just
        // stated. Repeating it against five settlements in the player's own
        // province is noise that buries the two lines that are not.
        const ceiling = place.localCeilingOrdinal === input.localCeilingOrdinal
            ? ''
            : ` Carries nobody past ${rankName(place.localCeilingOrdinal)}.`;
        lines.push(
            `${place.name}${place.hereNow ? ' (where you are)' : ''}: ${kindLabel(place.kind)}`
            + `${place.sameProvince ? '' : `, ${place.regionName}`}, `
            + `${distance(place)}.`
            + `${place.ambient ? ` ${QI[place.ambient]}.` : ''}`
            + crowd(place)
            + ceiling
        );
        structure.push(mechanicalRow(place, input.localCeilingOrdinal));
    }

    const unpriced = unpricedRoads(sorted);
    if (unpriced) structure.push(unpriced);

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
