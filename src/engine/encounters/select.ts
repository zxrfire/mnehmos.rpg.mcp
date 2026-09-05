/**
 * Choosing which row of the catalog happens.
 */

import {
    ENCOUNTERS,
    type EncounterEntry,
    type EncounterKind
} from '../../data/cultivation/encounters.js';
import { narrowToOffered, regardOf } from '../cultivation/regard.js';
import { encounterThreatRegard } from '../../data/cultivation/encounters.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import {
    activityProfile,
    biasFor,
    locatabilityApplies,
    needsToFindYou,
    reaches,
    socialReach
} from './activity.js';
import { valenceOf } from './valence.js';
import type {
    EncounterActivity,
    EncounterPlace,
    EncounterValence,
    Locatability
} from './types.js';

/**
 * Draw weight multiplier by how the THREAT stands to the cultivator.
 *
 * Not damage - `regard.damageMultiplier` prices that and this must never
 * double-count it. This is FREQUENCY: how often the world puts a given mismatch
 * in front of somebody.
 *
 * Filtering on `minOrdinal` alone was wrong in a way that only showed in play,
 * because the two columns are not correlated: `enc-beast-hunting-cultivators` is
 * pitched at 4 with a threat at rung 13, and `enc-culling-notice-mispriced` at 2
 * with a threat at 9 - that IS the entry. Measured before the fix, at the bottom
 * of the ladder 15-18% of the whole draw was a fight at `overmatched` (damage
 * x3) and from rung 4 up another 6-7% was `unreachable` (x6). In a 60-life soak
 * that made the encounter system the leading cause of death and capped the
 * ladder five realms below where it had been.
 */
export const THREAT_BAND_WEIGHT: Readonly<Record<string, number>> = {
    unreachable: 0.12,
    overmatched: 0.35,
    stretch: 1,
    matched: 1,
    assured: 1,
    beneath: 0.5,
    dismissed: 0.25
};

export interface WeightedEntry {
    entry: EncounterEntry;
    valence: EncounterValence;
    /** Catalog weight times activity and place bias. Always positive. */
    weight: number;
    /** The band the threat stands in, or null when the entry is not a fight. */
    threatBand: string | null;
}

export interface PoolInput {
    ordinal: number;
    activity: EncounterActivity;
    place: EncounterPlace;
    /** Whether anybody could find them. Defaults to `private`. */
    locatability?: Locatability;
    /** Restrict to entries of these kinds. Diagnostics and tests only. */
    kinds?: readonly EncounterKind[];
}

/**
 * Everything that could happen to this cultivator, here, doing this. A direction
 * with nothing eligible in it does not force anything: its weight redistributes
 * across the directions that do have entries. The floor is on the DRAW, never on
 * the world.
 */
export function encounterPool(input: PoolInput): WeightedEntry[] {
    const { ordinal, activity, place } = input;
    if (activityProfile(activity).exposure <= 0) return [];

    const byRank = narrowToOffered(ENCOUNTERS, ordinal);
    const out: WeightedEntry[] = [];

    for (const entry of byRank) {
        if (input.kinds && !input.kinds.includes(entry.kind)) continue;
        if (!reaches(entry, activity, place)) continue;

        // Above the Lid the entries stop being about the world below, and the
        // reverse: a rung-45 entry has no business finding a Qi Condensation
        // cultivator even though `offered` would allow the reach. The catalog
        // already states its own window; honour it exactly.
        if (ordinal < entry.minOrdinal || ordinal > entry.maxOrdinal) continue;

        // The second gate. Reads `threatOrdinal` through the same band table
        // the first gate reads `minOrdinal` through, so there is one rule about
        // rung in this file and it is applied twice because the catalog carries
        // two rungs.
        const threat = encounterThreatRegard(entry, ordinal);
        const threatBand = threat?.band ?? null;
        const threatWeight = threatBand === null ? 1 : (THREAT_BAND_WEIGHT[threatBand] ?? 1);

        // Somebody has to know where you are to come and find you. A
        // landslide does not. This is why a seclusion on sect ground and a
        // seclusion in a cave nobody has a name for are different acts.
        const findable = locatabilityApplies(activity) && needsToFindYou(entry)
            ? socialReach(input.locatability ?? 'private')
            : 1;

        const weight =
            entry.weight * biasFor(entry, activity, place) * threatWeight * findable;
        if (weight <= 0) continue;
        out.push({ entry, valence: valenceOf(entry), weight, threatBand });
    }

    // Stable order regardless of how the catalog was walked, so the same pool
    // draws the same row on the same sample forever.
    out.sort((a, b) => (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    return out;
}

/** Draw weight per direction across a built pool. For the design guards. */
export function poolDirections(pool: readonly WeightedEntry[]): Record<EncounterValence, number> {
    const out: Record<EncounterValence, number> = { good: 0, neutral: 0, bad: 0 };
    for (const row of pool) out[row.valence] += row.weight;
    return out;
}

/**
 * Pick one.
 */
export function drawEncounter(
    pool: readonly WeightedEntry[],
    activity: EncounterActivity,
    rng: CultivationRNG
): EncounterEntry | null {
    if (pool.length === 0) return null;

    const lean = activityProfile(activity).lean;
    const present = poolDirections(pool);

    // A direction with nothing in it contributes nothing, and its share goes to
    // whatever is left. Never a fallback that quietly re-enables an empty band.
    const directionWeights: Record<EncounterValence, number> = {
        good: present.good > 0 ? lean.good : 0,
        neutral: present.neutral > 0 ? lean.neutral : 0,
        bad: present.bad > 0 ? lean.bad : 0
    };
    const totalDirection =
        directionWeights.good + directionWeights.neutral + directionWeights.bad;
    if (totalDirection <= 0) return null;

    const direction = pickDirection(directionWeights, totalDirection, rng.next());
    const within = pool.filter(row => row.valence === direction);
    return pickWeighted(within, rng.next());
}

function pickDirection(
    weights: Record<EncounterValence, number>,
    total: number,
    sample: number
): EncounterValence {
    const order: EncounterValence[] = ['good', 'neutral', 'bad'];
    let cursor = clampSample(sample) * total;
    for (const key of order) {
        cursor -= weights[key];
        if (cursor < 0) return key;
    }
    return order[order.length - 1];
}

function pickWeighted(rows: readonly WeightedEntry[], sample: number): EncounterEntry | null {
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    if (total <= 0) return null;
    let cursor = clampSample(sample) * total;
    for (const row of rows) {
        cursor -= row.weight;
        if (cursor < 0) return row.entry;
    }
    return rows[rows.length - 1].entry;
}

function clampSample(sample: number): number {
    if (!Number.isFinite(sample)) return 0;
    return Math.max(0, Math.min(0.999999999, sample));
}

/**
 * Whether this entry is even pitched at this cultivator any more.
 *
 * Exposed because a caller sometimes wants the reason rather than the silence -
 * "nothing is offered here" is a legitimate and reportable state of the world.
 */
export function outgrown(entry: EncounterEntry, ordinal: number): boolean {
    return !regardOf(entry, ordinal).offered;
}
