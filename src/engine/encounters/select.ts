/**
 * Choosing which row of the catalog happens.
 *
 * Three filters and two draws, in that order, and no step of it knows what any
 * particular entry is:
 *
 *   1. RANK      `narrowToOffered` - drop what this cultivator has outgrown and
 *                what is not put in front of them at all. This is `regard.ts`
 *                doing the work every other catalog draw already gives it, so
 *                a Nascent Soul cultivator stops being offered roadside bandits
 *                without a single line about roadside bandits being written.
 *   2. THREAT    the SECOND gate, and the one that was missing. See below.
 *   3. REACH     what can get to somebody doing this, here (`activity.ts`).
 *   4. DIRECTION good, bad or neither, drawn BEFORE the entry (`valence.ts`).
 *
 * ── Why there are two gates ──────────────────────────────────────────────
 *
 * `encounters.ts` says it outright: an entry answers two different questions,
 * and they have different gate columns.
 *
 *     "is this entry pitched at me"    -> gate is `minOrdinal`
 *     "what does the thing in it cost" -> gate is `threatOrdinal`
 *
 * Filtering on the first alone is what the first version of this file did, and
 * it was wrong in a way that only showed up in play: the two columns are not
 * correlated. `enc-beast-hunting-cultivators` is pitched at `minOrdinal` 4 and
 * has a threat at rung 13. `enc-culling-notice-mispriced` is pitched at 2 with
 * a threat at 9 - that IS the entry, a notice written off an old survey. So a
 * rung-2 cultivator was being routinely handed fights nine rungs up, and per
 * AGENTS.md a four-rank gap is not a hard fight, it is a death.
 *
 * Measured before the fix: at the bottom of the ladder, 15-18% of the entire
 * draw was a fight at `overmatched` (damage x3), and from rung 4 up another
 * 6-7% was `unreachable` (x6). In a 60-life soak that made the encounter
 * system the leading cause of death and capped the ladder five realms below
 * where it had been.
 *
 * The fix is not a cut. Those entries are the catalog's own statement that
 * nothing is ever fully outgrown and that the world contains things far above
 * you, and deleting them would delete the texture `docs/world/discovery.md`
 * asks for. They are re-WEIGHTED, on the same band table everything else
 * reads, so that meeting something that would kill you stays possible, stays
 * survivable by leaving, and stops being the median Tuesday.
 *
 * ── Why direction is drawn first ─────────────────────────────────────────
 *
 * The catalog's weights are authored for the time-skip digest, where ruins are
 * correctly the heaviest block in the table and hostility is the genre's
 * thesis. Run straight, that produces a life in which the world only ever
 * arrives as a problem. Drawing the direction first and the row second keeps
 * every one of the author's relative weights intact WITHIN a direction while
 * refusing to let one direction eat the world. The mix is a property of what
 * the cultivator is doing, not of the entry, which is why it lives in
 * `activity.ts` and not here.
 *
 * A direction with nothing eligible in it does not force anything: its weight
 * redistributes across the directions that do have entries, and a pool with
 * only bad news in it produces bad news. The floor is on the DRAW, never on
 * the world.
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
 * Not damage - `regard.damageMultiplier` already prices that and this must
 * never double-count it. This is FREQUENCY: how often the world puts a given
 * mismatch in front of somebody. A fight you would lose should be a thing that
 * happens sometimes and is meant to be walked away from.
 *
 * `beneath` and `dismissed` are also damped, for the opposite reason and with
 * the same honesty: the world mostly stops bothering you with things you would
 * not notice. It does not stop entirely, because being bothered by something
 * trivial is a real experience and one of the ways rank is legible.
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
 * Everything that could happen to this cultivator, here, doing this.
 *
 * Returned rather than drawn from, so a design guard can assert the shape of
 * the pool without asserting the outcome of a roll - the difference between
 * testing a system and testing a seed.
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
 *
 * Two samples: the direction, then the row. Both from the caller's stream, in
 * that fixed order, so adding an entry to the catalog cannot shift which
 * direction a given day produced.
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
