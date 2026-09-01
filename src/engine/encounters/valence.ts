/**
 * Which direction an encounter points.
 *
 * The catalog does not carry a good/bad column and should not: an entry is
 * written as a situation, and whether it was a windfall or a disaster is
 * frequently the player's own doing. What it does carry is enough to answer
 * the coarse question - is there something hostile in it, what SimEvent kind
 * does it emit, and what did the author tag it - and that is what is read here.
 *
 * The classification exists for one reason. A draw that respects only the
 * catalog's own weights is dominated by hostile and ruin entries, because the
 * table was authored for the time-skip digest where that emphasis is correct.
 * A table that only hurts you is exactly as monotonous as one that never
 * touches you, so the play draw picks a DIRECTION first and an entry second.
 * See `select.ts`.
 *
 * Nothing here is a second combat system or a reward table. It reads columns
 * that already exist and returns one of three words.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type { EncounterValence } from './types.js';

/** Tags that make an entry good regardless of what else is on it. */
const GOOD_TAGS = new Set([
    'loot',
    'reward',
    'herb',
    'materials',
    'technique',
    'inheritance',
    'recipe',
    'joinable',
    'cultivation-rate',
    'untouched-qi',
    'high-value',
    'trade'
]);

/** Tags that make an entry bad regardless of what else is on it. */
const BAD_TAGS = new Set([
    'hostile',
    'injury',
    'loss',
    'lethal',
    'atrocity',
    'betrayal',
    'stagnation',
    'ceiling',
    'deviation',
    'deviation-risk',
    'expulsion',
    'tribulation',
    'permanently-thin',
    'feud',
    'feud-seed'
]);

/**
 * SimEvent kinds that settle the question on their own. A resource running out
 * or a wound arriving is not open to interpretation.
 */
const BAD_EVENT_KINDS = new Set([
    'qi_deviation',
    'injury_sustained',
    'resource_depleted',
    'lifespan_warning',
    'starvation_warning',
    'bleeding_warning',
    'death'
]);

/**
 * How an entry points, before anybody acts on it.
 *
 * Order matters and is deliberate: an entry can be both an opportunity and a
 * fight - a guarded spirit herb, a tomb with rivals camped outside it - and
 * those are counted as GOOD, because the thing on offer is why the player is
 * there. What makes an entry bad is that the encounter itself is the loss.
 */
export function valenceOf(entry: EncounterEntry): EncounterValence {
    if (BAD_EVENT_KINDS.has(entry.simEventKind)) return 'bad';

    const tags = new Set(entry.tags);
    const good = countIn(tags, GOOD_TAGS);
    const bad = countIn(tags, BAD_TAGS);

    // An opportunity with a beast sitting on it is still an opportunity. The
    // hostile tag loses to the reason anybody would go.
    if (entry.simEventKind === 'opportunity' && good > 0) return 'good';

    if (good > bad) return 'good';
    if (bad > good) return 'bad';

    // Nothing tagged either way. A fight is a fight.
    if (entry.threatOrdinal !== null) return 'bad';
    if (entry.simEventKind === 'opportunity') return 'good';
    return 'neutral';
}

function countIn(tags: ReadonlySet<string>, set: ReadonlySet<string>): number {
    let n = 0;
    for (const tag of tags) if (set.has(tag)) n++;
    return n;
}

/** Total draw weight per direction across a pool. Used by the design guards. */
export function valenceWeights(
    pool: readonly EncounterEntry[]
): Record<EncounterValence, number> {
    const out: Record<EncounterValence, number> = { good: 0, neutral: 0, bad: 0 };
    for (const entry of pool) out[valenceOf(entry)] += entry.weight;
    return out;
}
