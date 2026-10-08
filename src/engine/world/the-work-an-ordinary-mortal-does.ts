/** Ordinary adult residents take catalog work; a town's professions can outlive its opening workers. */
import { OCCUPATIONS, SETTLEMENTS, workExistingFor, type Occupation, type Settlement }
    from '../../data/cultivation/mortal-world.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { ageInYears, isAwayOnSomething, type NpcRecord } from './npc-state.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import { HOUSEHOLD_MIN_AGE } from './the-ties-an-ordinary-life-produces.js';
import { locationOnNpcJourney } from './places-on-the-way.js';

/** The world seeder's settlement tags, read through the existing settlement catalog. */
export function ordinarySettlementKind(place: Pick<LocationRecord, 'kind' | 'tags'>): Settlement['kind'] | null {
    if (place.kind !== 'settlement') return null;
    if (place.tags.includes('gate_town')) return 'sect_town';
    return SETTLEMENTS.find(settlement => place.tags.includes(settlement.kind))?.kind ?? null;
}

/** Identity is the only profession store; lookup tables are readings of the static catalog. */
const professionsByName = new Map(OCCUPATIONS.map(job => [job.name, job]));

export function ordinaryProfessionOf(npc: NpcRecord): Occupation | null {
    if (npc.cultivation.realmOrdinal !== 0 || npc.factionId !== null) return null;
    return professionsByName.get(npc.identity.occupation) ?? null;
}

/**
 * Demography replaced residents with unknown occupations, so opening physicians,
 * innkeepers and other workers left no successors. Only actual grown mortals
 * without a profession take work here. An underrepresented catalog occupation
 * weighs more, never guarantees a replacement or creates a new person. Existing
 * work, purses, cultivation and concrete activities are not reissued or rerolled.
 */
export function ordinaryAdultsTakeWork(state: WorldState, onDay: number): number {
    const places = new Map(state.locations.map(place => [place.id, place]));
    const jobs = new Map<string, readonly Occupation[]>();
    const counts = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const job = ordinaryProfessionOf(npc);
        if (!job) continue;
        const place = locationOnNpcJourney(state.locations, npc, onDay);
        if (place) {
            const key = `${place}\u0000${job.id}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    let assigned = 0;
    for (const npc of [...state.npcs].sort((a, b) => a.id.localeCompare(b.id))) {
        if (npc.status !== 'alive' || npc.cultivation.realmOrdinal !== 0 || npc.factionId !== null
            || npc.identity.occupation !== 'unknown' || ageInYears(npc, onDay) < HOUSEHOLD_MIN_AGE) continue;
        const activity = npc.activity;
        if (activity && (isAwayOnSomething(activity.kind) || activity.redirect || activity.thingId
            || activity.withIds.length > 0 || (activity.untilDay != null && activity.untilDay > onDay))) continue;
        const locationId = locationOnNpcJourney(state.locations, npc, onDay);
        const place = locationId ? places.get(locationId) : undefined;
        const kind = place ? ordinarySettlementKind(place) : null;
        if (!place || !kind) continue;
        let available = jobs.get(kind);
        if (!available) { available = workExistingFor(0, kind); jobs.set(kind, available); }
        if (available.length === 0) continue;
        const weights = Object.fromEntries(available.map(job =>
            [job.id, 1 / (1 + (counts.get(`${place.id}\u0000${job.id}`) ?? 0))]));
        const chosen = forStream(state.seed, 'ordinary-profession', npc.id, Math.floor(onDay / DAYS_PER_YEAR)).weighted(weights);
        const job = available.find(job => job.id === chosen)!;
        npc.identity = { ...npc.identity, occupation: job.name };
        npc.activity = { kind: 'the_work_of_their_rank', note: `Working as ${job.name}.`,
            withIds: [], sinceDay: onDay, untilDay: null };
        npc.updatedOnDay = onDay;
        const key = `${place.id}\u0000${job.id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        assigned++;
    }
    return assigned;
}
