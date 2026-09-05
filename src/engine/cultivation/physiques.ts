/**
 * Physiques - the body somebody is born as, as against what they can cultivate.
 *
 * Weights are per ten thousand births, so a weight read aloud is its own rate: 40
 * is four births in ten thousand. Two hundred of every ten thousand people are
 * born with something.
 *
 * Measured: `scripts/probe-a-body-somebody-was-born-as.ts` carries the figures -
 * over 200 years, one person in a province is standing with a body worth taking
 * and thirty-nine were born with one. If a content pass moves these weights, RUN
 * IT AGAIN: the birth rate and the standing rate are different numbers and only
 * the first is in this file.
 */

import { UNBOUNDED_LIFESPAN_YEARS } from './realms.js';

export type PhysiqueKey = 'profound_yin' | 'pure_yang' | 'hollow_marrow';

export interface Physique {
    key: PhysiqueKey;
    name: string;
    /** Selection weight out of {@link PHYSIQUE_WEIGHT_TOTAL}, per ten thousand births. */
    weight: number;
    /**
     * Multiplier on cultivation progress per day. Same units and the same array
     * position class as `SpiritRoot.cultivationSpeed`, and read in the same place.
     */
    cultivationSpeed: number;
    /**
     * Multiplier on the lifespan the current rung gives. Below 1 is a body that
     * does not last; above 1 is one that does.
     */
    lifespan: number;
    /**
     * Multiplier on what an art that runs on the others takes out of this body.
     */
    drawnOff: number;
    /**
     * The condition of the body, as anybody standing next to them would put it.
     */
    tell: string;
    description: string;
}

export const PHYSIQUES: readonly Physique[] = [
    {
        key: 'profound_yin',
        name: 'Profound Yin Body',
        weight: 40,
        cultivationSpeed: 1.6,
        lifespan: 0.35,
        drawnOff: 3.0,
        tell: 'cold to the touch, in any weather, and always has been',
        description:
            'A body that takes qi in faster than it can hold and is worn through by doing it. '
            + 'It is the best furnace anybody will ever find, and it does not last.'
    },
    {
        // The same three numbers as the row above, deliberately and permanently.
        // See the header: the pair is where "nothing branches on the name" is
        // asserted, and the day these two stop being equal is the day something
        // has learned which is which.
        key: 'pure_yang',
        name: 'Pure Yang Body',
        weight: 40,
        cultivationSpeed: 1.6,
        lifespan: 0.35,
        drawnOff: 3.0,
        tell: 'hot to the touch, in any weather, and always has been',
        description:
            'A body that takes qi in faster than it can hold and is worn through by doing it. '
            + 'It is the best furnace anybody will ever find, and it does not last.'
    },
    {
        key: 'hollow_marrow',
        name: 'Hollow Marrow Body',
        weight: 120,
        cultivationSpeed: 0.6,
        lifespan: 1.8,
        drawnOff: 0.5,
        tell: 'unusually light for their size, and slow to bruise',
        description:
            'A body that will not be hurried and will not be worn out. Cultivation crawls, the '
            + 'years do not, and there is very little in it for anybody who wanted to take it.'
    }
] as const;

/**
 * Births per ten thousand. The catalog's weights do NOT sum to this: the
 * remainder is everybody else, and it is the overwhelming majority.
 */
export const PHYSIQUE_WEIGHT_TOTAL = 10_000;

/** Births in ten thousand that carry anything at all. */
export const PHYSIQUE_WEIGHT_CARRIED = PHYSIQUES.reduce((sum, p) => sum + p.weight, 0);

export function getPhysique(key: PhysiqueKey): Physique {
    const found = PHYSIQUES.find(p => p.key === key);
    if (!found) throw new Error(`Unknown physique: ${key}`);
    return found;
}

/** Null for a key that is not in the catalog, and for null. For loading saves. */
export function physiqueOrNull(key: string | null | undefined): Physique | null {
    if (!key) return null;
    return PHYSIQUES.find(p => p.key === key) ?? null;
}

/**
 * Roll a physique from a uniform [0,1) sample. Null is the ordinary case.
 */
export function rollPhysique(sample: number): Physique | null {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * PHYSIQUE_WEIGHT_TOTAL;
    for (const physique of PHYSIQUES) {
        cursor -= physique.weight;
        if (cursor < 0) return physique;
    }
    return null;
}

/** Probability of being born with this one, as a fraction of 1. */
export function physiqueProbability(key: PhysiqueKey): number {
    return getPhysique(key).weight / PHYSIQUE_WEIGHT_TOTAL;
}

// WHAT THE THREE MODIFIERS ARE WORTH, WHEREVER THEY ARE READ
//
// One function each, so a consumer folds the term in rather than restating the
// arithmetic. The alternative is three copies of `x * (physique?.f ?? 1)` in
// files that have no other reason to know a physique exists.

/** The rate multiplier, and 1 for an ordinary body. */
export function cultivationSpeedOf(physique: Physique | null): number {
    return physique?.cultivationSpeed ?? 1;
}

/**
 * The lifespan a body of this kind actually gets, given the ceiling its rung
 * grants.
 */
export function lifespanWithPhysique(baseYears: number, physique: Physique | null): number {
    if (!physique) return baseYears;
    if (!Number.isFinite(baseYears) || baseYears >= UNBOUNDED_LIFESPAN_YEARS) return baseYears;
    return baseYears * physique.lifespan;
}

/** The multiplier on what a rite that runs on the others takes. 1 ordinarily. */
export function drawnOffMultiplierOf(physique: Physique | null): number {
    return physique?.drawnOff ?? 1;
}

/**
 * One engine sentence about what somebody's body is, for a surface that has decided
 * the reader is entitled to it. Never narration.
 */
export function describePhysique(physique: Physique): string {
    return `${physique.name}: ${physique.tell}. ${physique.description}`;
}
