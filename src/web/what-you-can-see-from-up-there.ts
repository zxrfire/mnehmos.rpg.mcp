/**
 * WHAT SOMEBODY WHO CAN LEAVE THE GROUND SEES WITHOUT BEING TOLD ANY OF IT.
 */

import type { AmbientQi } from '../schema/cultivation.js';
import type { Bearing } from '../data/cultivation/regions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ordinal at which a cultivator can get off the ground at all.
 *
 * `gale-riding-sword-flight.requiredOrdinal`. Below it this read is silent.
 */
export const LEAVES_THE_GROUND = 15;

/**
 * Ordinal at which flight is sustained and high rather than a slow cold hop.
 */
export const ABOVE_THE_WEATHER = 22;

/**
 * How far the first flight sees, in the catalog's own travel days.
 */
export const HORIZON_AT_FIRST_FLIGHT = 2;

/**
 * What one more rung is worth, multiplicatively.
 */
export const HORIZON_GROWTH_PER_RUNG = 1.3;

/**
 * How far this height can make anything out, in travel days.
 *
 * The whole of what a realm buys here. Zero below the floor, and there is no
 * other threshold anywhere in this file.
 */
export function horizonInDays(ordinal: number): number {
    if (ordinal < LEAVES_THE_GROUND) return 0;
    return HORIZON_AT_FIRST_FLIGHT * HORIZON_GROWTH_PER_RUNG ** (ordinal - LEAVES_THE_GROUND);
}

/**
 * Whether a thing that far off is inside this horizon.
 */
export function withinSight(horizonDays: number, days: number | null): boolean {
    if (horizonDays <= 0) return false;
    if (days === null) return true;
    return days <= horizonDays;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A SIGHTING IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing on the ground, as it looks from above it.
 */
export interface Sighting {
    /**
     * What kind of thing it is, physically. A `LocationKind`, which the caller
     * has already taken off the row - this module turns it into what it looks
     * like from up there, and a kind it does not recognise is reported as
     * something on the ground rather than guessed at.
     */
    kind: string;
    /** Where it lies in the world, off the region's own `bearing`. */
    bearing: Bearing;
    /** Days of travel, from the region catalog. Null inside your own province. */
    days: number | null;
    /**
     * The band the ground itself carries.
     */
    ambient: AmbientQi | null;
    /**
     * Whether anything is standing on it.
     */
    inhabited: boolean | null;
}

export interface OverlookInput {
    ordinal: number;
    /** Where the viewer is, so a bearing can be stated relative to them. */
    from: Bearing;
    /**
     * Everything the world holds that this cultivator cannot already point at,
     * stripped to physical facts by the caller.
     */
    onTheGround: readonly Sighting[];
}

export interface OverlookRead {
    headline: string;
    lines: string[];
    structure: string[];
    /** How many were inside the horizon. Zero is a real and common answer. */
    seen: number;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A THING LOOKS LIKE FROM ABOVE IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The outside of a place, with everything social taken off it.
 */
const FROM_ABOVE: Record<string, string> = {
    hamlet: 'a scatter of roofs with smoke coming off them',
    village: 'a scatter of roofs with smoke coming off them',
    settlement: 'a scatter of roofs with smoke coming off them',
    market_town: 'a town laid out around an open square',
    city: 'a town big enough that the shape of its streets is legible',
    sect_town: 'a town that has grown up hard against a walled compound',
    sect_seat: 'a compound somebody built to be defended, and has kept up',
    waystation: 'a walled yard on a road, with stabling',
    province: 'the far edge of somebody else\'s country',
    region: 'the far edge of somebody else\'s country',
    vein: 'ground where nothing grows and the air over it stands wrong',
    wilds: 'open country with nothing standing on it',
    cave: 'an opening in a rock face, with a path worn to it or without one',
    ruin: 'walls nobody has kept up',
    grave: 'a raised place with cut stone on it',
    scar: 'a bald patch the country has not closed over',
    forbidden_zone: 'a bald patch the country has not closed over',
    secret_realm: 'a seam in the air that does not agree with the light around it',
    sealed_domain: 'a seam in the air that does not agree with the light around it',
    portal: 'a seam in the air that does not agree with the light around it',
    site: 'something built, a long time ago, that is still standing'
};

function fromAbove(kind: string): string {
    return FROM_ABOVE[kind] ?? 'something on the ground that somebody made';
}

/** The band, said as an eye at height would read it and never as a multiplier. */
const AIR_OVER_IT: Record<AmbientQi, string> = {
    thin: 'the air over it is poor',
    normal: 'the air over it is ordinary',
    dense: 'the air over it is heavy',
    spirit_tide: 'the air over it is running, and running will stop',
    sealed_vein: 'the air over it is wrong in the way a closed vein is wrong'
};

// ─────────────────────────────────────────────────────────────────────────
// WHERE IT LIES
// ─────────────────────────────────────────────────────────────────────────

const OPPOSITE: Record<string, string> = {
    north: 'south', south: 'north', east: 'west', west: 'east'
};

/**
 * Which way to look, honestly, given the shape of this world.
 */
export function whichWay(from: Bearing, seen: Bearing): string {
    if (from === seen) return 'below you';
    if (seen === 'interior') return 'inland, in the wedge the roads leave between them';
    if (from === 'interior') return `out towards the ${seen === 'centre' ? 'gorge' : seen}`;
    if (from === 'centre') return `to the ${seen}`;
    if (seen === 'centre') return `back down the road, to the ${OPPOSITE[from] ?? seen}`;
    return `to the ${seen}, across the centre`;
}

/** How far, in the units the catalog prices roads in. */
function howFar(days: number | null): string {
    if (days === null) return 'inside this province';
    return `about ${days} day${days === 1 ? '' : 's'} of road away`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * One sighting, as the cultivator would put it to themselves.
 */
function sightingLine(sighting: Sighting, from: Bearing): string {
    const air = sighting.ambient ? `, and ${AIR_OVER_IT[sighting.ambient]}` : '';
    const standing = sighting.inhabited === null
        ? ''
        : sighting.inhabited
            ? ' Something is living on it.'
            : ' Nothing is living on it.';
    return `${capitalise(fromAbove(sighting.kind))}, ${whichWay(from, sighting.bearing)}, `
        + `${howFar(sighting.days)}${air}.${standing}`;
}

function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a cultivator who goes up and looks around actually comes back with.
 */
export function whatCanBeSeenFromUpThere(input: OverlookInput): OverlookRead {
    const horizon = horizonInDays(input.ordinal);
    const structure: string[] = [
        `Horizon ${horizon.toFixed(1)} travel days at ordinal ${input.ordinal} `
        + `(floor ${LEAVES_THE_GROUND}, ${HORIZON_AT_FIRST_FLIGHT} days growing `
        + `x${HORIZON_GROWTH_PER_RUNG} per rung). `
        + `${input.onTheGround.length} piece(s) of ground offered.`
    ];

    if (horizon <= 0) {
        return {
            headline: 'You cannot get above it.',
            lines: [
                'You look at as much of the world as a person standing on the world can look at, '
                + 'which is the next ridge and then the sky behind it.',
                'Getting high enough to see over it is a thing cultivators do, and not yet a thing '
                + 'you do. It comes in somewhere around a made foundation, on a sword or on '
                + 'anything else that will hold you up, and it is slow and cold when it comes.',
                'Until then the world reaches you the way it reaches everybody: somebody says a '
                + 'name where you can hear it. Ask, and keep asking.'
            ],
            structure: [
                ...structure,
                `Refused: ordinal ${input.ordinal} is below ${LEAVES_THE_GROUND}, the rung the `
                + 'catalog puts first flight at. Nothing was masked, because nothing was read - '
                + 'the horizon is zero and the whole read is skipped.'
            ],
            seen: 0
        };
    }

    const seen = input.onTheGround
        .filter(row => withinSight(horizon, row.days))
        .sort((a, b) => (a.days ?? -1) - (b.days ?? -1));

    structure.push(
        `${seen.length} inside the horizon, ${input.onTheGround.length - seen.length} beyond it. `
        + 'Physical facts only: kind, bearing, distance, the ground\'s own band, whether anything '
        + 'is standing on it. No name, no holder, no ceiling - those stay with the knowledge gate.'
    );

    if (seen.length === 0) {
        return {
            headline: 'Nothing you have not already got a name for.',
            lines: [
                'You go up, and there is nothing inside the circle you can hold that you could not '
                + 'have pointed at from the ground.',
                'Further out the country keeps going and stops resolving. Height is what buys the '
                + 'rest of it.'
            ],
            structure,
            seen: 0
        };
    }

    // THINGS THAT LOOK THE SAME ARE ONE SENTENCE
    const grouped = new Map<string, number>();
    for (const row of seen) {
        const line = sightingLine(row, input.from);
        grouped.set(line, (grouped.get(line) ?? 0) + 1);
    }
    structure.push(
        `${grouped.size} distinct sighting(s) out of ${seen.length}. Identical silhouettes are `
        + 'counted, not repeated: from that height there is nothing to tell two of them apart '
        + 'with, and printing one line each would imply a distinction only a name carries.'
    );

    return {
        headline: seen.length === 1
            ? 'One thing down there you have never been told about.'
            : `${seen.length} things down there nobody has told you about.`,
        lines: [
            ...[...grouped].map(([line, count]) => count === 1 ? line : `${line} ${andAgain(count)}`),
            'You can see them. That is the whole of what you have: what they are called, whose '
            + 'they are and what is inside them are things somebody has to say out loud.'
        ],
        structure,
        seen: seen.length
    };
}

/**
 * That there are more of the same, said as somebody counting from the air.
 */
function andAgain(count: number): string {
    return count === 2
        ? 'And another like it, near enough that you would not tell them apart from here.'
        : `And ${count - 1} more like it, near enough that you would not tell them apart `
          + 'from here.';
}
