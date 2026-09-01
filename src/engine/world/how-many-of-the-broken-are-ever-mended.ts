/**
 * The measurement the repair medicine has to survive.
 *
 * One question: of everybody in this world who arrives at a rung with the
 * structure broken, what fraction is ever mended? The design target is ALMOST
 * NONE - rare to a degree where most people simply live with it, and for a great
 * many of them living with it means dying at that wall, because the road is shut
 * and the span the rung granted them runs out at that rung with no further
 * crossing to buy more.
 *
 * This lives in `src/engine` rather than in `scripts/` for one reason: the
 * probe and the test both need it, and AGENTS.md's list of ways a measurement
 * goes wrong starts with somebody keeping a second copy of the loop. There is
 * one loop, it is here, and both callers run it.
 *
 * ── THE TWO SCARCITIES, MEASURED SEPARATELY ──────────────────────────────
 *
 * They are independent, and reporting one number hides which is doing the work:
 *
 *   THE DOSES     `STRUCTURAL_REPAIR_HOLDINGS` is the whole opening stock, and
 *                 `refinedPerCentury` is what the world adds - a rate taken off
 *                 the dated record rather than chosen. The sent-down grade adds
 *                 nothing ever.
 *   THE STANDING  a house spends on its own. `HOUSEHOLD_ORIGINS` is the set of
 *                 births that put somebody inside a body that could hold one at
 *                 all, and it is three rows out of eight in the world's own
 *                 birth table, carrying 400 weight out of ten million.
 *
 * ── WHAT IS DERIVED AND WHAT IS ASSUMED ──────────────────────────────────
 *
 * Derived from the engine: the lives (`deriveLife`), the crossings that landed
 * (`onAttempt`), whether each landing broke somebody (`rollArrivesBroken`), the
 * break each wall leaves (`brokenStatusFor`), and what reaches it
 * (`cheapestMedicineFor`).
 *
 * Assumed, and each stated where it can be argued with: the rate at which the
 * world produces new cultivators ({@link NEW_CULTIVATORS_PER_YEAR}, measured off
 * a seeded world rather than picked), a flat `stable` foundation for everybody,
 * and a generous rescue rule that hands any connected broken cultivator a dose
 * if one still exists anywhere. The last of these makes the result an UPPER
 * BOUND on how many get mended, which is the right direction for a rarity
 * claim: the true figure is lower than what this prints.
 */

import { forStream } from '../cultivation/rng.js';
import { rollSpiritRoot, rollAttributes } from '../cultivation/spirit-roots.js';
import { rollOrigin, type OriginTierKey } from '../cultivation/origin.js';
import { deriveLife } from './seeding.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import {
    rollArrivesBroken,
    brokenStatusFor
} from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import {
    cheapestMedicineFor,
    ordinalCarrying
} from '../cultivation/what-structural-repair-medicine-can-reach.js';
import {
    STRUCTURAL_REPAIR_HOLDINGS,
    STRUCTURAL_REPAIR_MEDICINES
} from '../../data/cultivation/structural-repair-medicine.js';

/**
 * New cultivators the two provinces produce in a year.
 *
 * MEASURED, not chosen. A world seeded with 565 NPCs and advanced 1,500 years
 * through `advanceWorldYears` ends holding 8,328 NPC records, living and dead,
 * which is 5.2 new bodies a year. Rounded down to five, because rounding down
 * makes the doses go further per head and therefore overstates rescue.
 *
 * This is the only thing converting a cohort of lives into a span of years, and
 * the span is what decides how much refining happens alongside it.
 */
export const NEW_CULTIVATORS_PER_YEAR = 5;

/**
 * The births that put somebody inside a body that might hold a dose.
 *
 * Three of the eight origin tiers, and they are the top three: a Dao house's own
 * blood, an apex member's child, and a child placed at a house on somebody's
 * word. Together they carry 400 of the birth table's ten million weight.
 *
 * Everything below them - a thin county, a market town, a minor clan, a sect
 * retainer, an established clan - is a life with nobody at that height who has
 * any reason to spend on them. That is not a hard-luck story; it is the
 * standard in `who-a-house-will-spend-a-repair-dose-on.ts` applied to where
 * people are actually born.
 */
export const HOUSEHOLD_ORIGINS: readonly OriginTierKey[] = [
    'dao_house_bloodline',
    'apex_sect_members_child',
    'fostered_on_a_word'
];

export interface BreakRow {
    woundKey: string;
    atOrdinal: number;
    /**
     * How many of the cohort cleared this wall at all.
     *
     * The denominator that matters, and the one that makes the break rate read
     * correctly: the ladder is savage long before a structure is at risk, so
     * most of the reason nobody is mended is that almost nobody gets to a wall
     * where breaking is possible.
     */
    crossings: number;
    /** How many of the cohort arrived carrying this. */
    broken: number;
    /** How many of those were born inside a body that could hold a dose. */
    connected: number;
    /** Doses that reach this break, over the cohort's span. Null where none. */
    dosesAvailable: number | null;
    /** How many were actually mended, after the pool ran out. */
    mended: number;
    medicineId: string | null;
}

export interface MendedMeasurement {
    sample: number;
    years: number;
    /** Lives that cleared at least one REALM boundary, not merely a rung. */
    reachedAWall: number;
    broken: number;
    connected: number;
    connectedShare: number;
    dosesInPlay: number;
    mended: number;
    mendedShare: number;
    byBreak: BreakRow[];
}

export interface MendedMeasurementOptions {
    sample?: number;
    seed?: string;
    /** Province ceiling handed to `deriveLife`. The full ladder by default. */
    ceiling?: number;
}

/**
 * Walk the cohort and count.
 *
 * Deterministic from the seed. Three RNG streams per life so that adding a roll
 * to one of them cannot silently reshuffle the others - the discipline the rest
 * of the engine keeps.
 */
export function measureWhoGetsMended(
    options: MendedMeasurementOptions = {}
): MendedMeasurement {
    const sample = options.sample ?? 20_000;
    const seed = options.seed ?? 'who-gets-mended';
    const ceiling = options.ceiling ?? MAX_ORDINAL;
    const years = sample / NEW_CULTIVATORS_PER_YEAR;

    // ── the walk ──────────────────────────────────────────────────────
    const brokenByKey = new Map<string, { broken: number; connected: number }>();
    // Crossings of each REALM boundary, which is where a structure can fail.
    // A rung inside a realm is not a wall and cannot break anybody.
    const wallCrossings = new Map<string, number>();
    let reachedAWall = 0;
    let broken = 0;
    let connected = 0;

    for (let i = 0; i < sample; i++) {
        const draw = forStream(seed, 'life', i);
        const root = rollSpiritRoot(draw.next());
        const attributes = rollAttributes([draw.next(), draw.next(), draw.next(), draw.next()]);
        const origin = rollOrigin(draw.next());
        const breaks = forStream(seed, 'break', i);

        let landed = 0;
        let first: string | null = null;

        deriveLife(
            root.key,
            attributes,
            // A span long enough that the realm lifespan and the settling
            // clock are what stop this life, rather than the harness.
            200_000,
            1,
            ceiling,
            forStream(seed, 'walk', i),
            {
                origin: origin.key,
                onAttempt: attempt => {
                    if (!attempt.crossed) return;
                    // Once a structure is broken the climb is over - the block
                    // is `structuralBlockOn`. `deriveLife` does not know that,
                    // so the harness stops recording rather than pretending
                    // later walls were reached.
                    if (first !== null) return;
                    const wall = brokenStatusFor(attempt.ordinal);
                    if (wall === null) return;
                    landed++;
                    wallCrossings.set(wall, (wallCrossings.get(wall) ?? 0) + 1);
                    const status = rollArrivesBroken(attempt.ordinal, breaks, 'stable');
                    if (status) first = status;
                }
            }
        );

        if (landed > 0) reachedAWall++;
        if (first === null) continue;

        broken++;
        const inAHouse = HOUSEHOLD_ORIGINS.includes(origin.key);
        if (inAHouse) connected++;
        const row = brokenByKey.get(first) ?? { broken: 0, connected: 0 };
        row.broken++;
        if (inAHouse) row.connected++;
        brokenByKey.set(first, row);
    }

    // ── the doses ─────────────────────────────────────────────────────
    // One pool per medicine, because two breaks can share a grade and the
    // Nascent Soul and Deity Transformation breaks do exactly that.
    const pool = new Map<string, number>();
    let dosesInPlay = 0;
    for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
        const opening = STRUCTURAL_REPAIR_HOLDINGS
            .filter(h => h.medicineId === medicine.id)
            .reduce((n, h) => n + h.count, 0);
        const refined = (medicine.refinedPerCentury ?? 0) * (years / 100);
        pool.set(medicine.id, opening + refined);
        dosesInPlay += opening + refined;
    }

    // ── the allocation ────────────────────────────────────────────────
    // Lowest break first, because that is the order a world spends them in: a
    // house mends a cracked core with the cheap thing long before anybody is
    // standing at the emptiness with a torn spirit sense.
    const everyWall = new Set<string>([...wallCrossings.keys(), ...brokenByKey.keys()]);
    const rows: BreakRow[] = [...everyWall]
        .map(woundKey => {
            const counts = brokenByKey.get(woundKey) ?? { broken: 0, connected: 0 };
            const atOrdinal = ordinalCarrying(woundKey);
            const medicine = cheapestMedicineFor(woundKey, atOrdinal);
            return {
                woundKey,
                atOrdinal,
                crossings: wallCrossings.get(woundKey) ?? 0,
                broken: counts.broken,
                connected: counts.connected,
                dosesAvailable: medicine ? (pool.get(medicine.id) ?? 0) : null,
                mended: 0,
                medicineId: medicine?.id ?? null
            };
        })
        .sort((a, b) => a.atOrdinal - b.atOrdinal);

    let mended = 0;
    for (const row of rows) {
        if (!row.medicineId) continue;
        const left = pool.get(row.medicineId) ?? 0;
        const take = Math.min(row.connected, Math.floor(left));
        row.mended = take;
        pool.set(row.medicineId, left - take);
        mended += take;
    }

    return {
        sample,
        years,
        reachedAWall,
        broken,
        connected,
        connectedShare: broken > 0 ? connected / broken : 0,
        dosesInPlay,
        mended,
        mendedShare: broken > 0 ? mended / broken : 0,
        byBreak: rows
    };
}
