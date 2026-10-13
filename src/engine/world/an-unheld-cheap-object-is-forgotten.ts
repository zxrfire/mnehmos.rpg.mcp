/** A year-old unheld cheap object disappears silently only when nothing still points at it. */
import type { WorldState } from './world-state.js';
import { getLocation } from './world-state.js';
import { HERBS } from '../../data/cultivation/herbs.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { isTheWorldsToMove } from './npc-state.js';
import { playerAtTheContact } from './background-incident-draw.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { whoHoldsThisPlace } from './somewhere-that-is-theirs.js';

/** The catalog's cheapest positive herb value, in spirit stones; larger stacks are valued in full. */
export const CHEAP_UNHELD_VALUE = Math.min(...HERBS.filter(herb => herb.value > 0).map(herb => herb.value));

export function collectUnheldCheapObjects(state: WorldState, protectedObjects?: ReadonlySet<string>): number {
    const cutoff = state.currentDay - DAYS_PER_YEAR;
    const cheap = state.objects.filter(object => {
        if (object.possessorId !== null || object.claims.length || protectedObjects?.has(object.id)) return false;
        const thing = whatThisThingIs(object);
        return thing?.marketStones != null && thing.marketStones * thing.quantity <= CHEAP_UNHELD_VALUE;
    });
    if (!cheap.length) return 0;
    const players = new Set([...state.npcs.filter(person => !isTheWorldsToMove(person)).map(person => person.id),
        ...state.runs.map(run => run.cultivatorId)]);
    const places = new Set(state.npcs.filter(person => players.has(person.id) && person.locationId).map(person => person.locationId!));
    const contact = playerAtTheContact(state);
    if (contact) { players.add(contact.id); places.add(contact.placeId); }
    const index = witnessIndexFor(state);
    const candidates = new Map(cheap.filter(object => !players.has(object.ownerId ?? '')
        && !index.references.get(object.id)?.size).map(object => [object.id, object]));
    if (!candidates.size) return 0;
    const protectedIds = new Set<string>();
    const hold = (value: unknown): void => {
        if (typeof value === 'string') {
            if (candidates.has(value)) protectedIds.add(value);
            else if (value[0] === '{' || value[0] === '[') {
                try { hold(JSON.parse(value)); } catch { /* Ordinary words are not structured references. */ }
            }
        } else if (Array.isArray(value)) for (const part of value) hold(part);
        else if (value && typeof value === 'object') for (const [key, part] of Object.entries(value)) {
            if (candidates.has(key)) protectedIds.add(key);
            hold(part);
        }
    };
    // Includes jobs, searches, deliveries, estates, lots and ledger values, even serialized terms.
    hold(state.npcs); hold(state.factions); hold(state.obligations); hold(state.memories.records);
    hold(state.schedule); hold(state.opportunities); hold(state.runs); hold(state.lineages); hold(state.pendingSendings);
    hold(state.absences); hold(state.statuses); hold(state.ascensions); hold(state.locations); hold(state.history);
    for (const object of state.objects) hold({ data: object.data, tags: object.tags, claims: object.claims,
        ownerId: object.ownerId, possessorId: object.possessorId, provenance: object.provenance });
    const stored = (locationId: string | null): boolean => {
        const visited = new Set<string>();
        let place = locationId ? getLocation(state, locationId) : null;
        while (place && !visited.has(place.id)) {
            visited.add(place.id);
            if (places.has(place.id) || place.kind === 'grave' || place.kind === 'vault'
                || place.kind === 'hall' || place.kind === 'chamber' || whoHoldsThisPlace(place) !== null) return true;
            place = place.parentId ? getLocation(state, place.parentId) : null;
        }
        return false;
    };
    const gone = new Set<string>();
    for (const object of candidates.values()) {
        if (protectedIds.has(object.id) || stored(object.locationId)) continue;
        const last = object.provenance.at(-1)?.onDay;
        const observed = Number(object.data.unheldObservedOnDay);
        if (last === undefined && !Number.isFinite(observed)) {
            // Unknown creation dates acquire an observation date, never an invented past.
            object.data = { ...object.data, unheldObservedOnDay: state.currentDay };
            continue;
        }
        const since = Math.max(last ?? -Infinity, Number.isFinite(observed) ? observed : -Infinity);
        if (since <= cutoff) gone.add(object.id);
    }
    if (gone.size) state.objects = state.objects.filter(object => !gone.has(object.id));
    return gone.size;
}
