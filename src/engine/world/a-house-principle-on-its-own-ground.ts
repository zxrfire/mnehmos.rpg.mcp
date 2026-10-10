/**
 * A Dao house's principle, open on its own ground.
 *
 * `understanding.ts` has always had the slot - "the principle of a Dao house the cultivator is INSIDE"
 * - and nothing filled it, so no member of a Dao house could ever comprehend the thing their house is
 * for. A house's principle is open to whoever stands on its ground and is let in to it: its own people.
 * The owner, 2026-10-09, on the Ninefold Karma Palace: it is "a house people visit to learn about karma",
 * so its ground is open to anybody who comes.
 */
import { getSect } from '../../data/cultivation/sects.js';
import type { ExposureInput } from '../cultivation/understanding.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';

/** The Dao houses whose ground teaches its principle to a visitor as well as a member. */
export const A_HOUSE_PEOPLE_VISIT_TO_LEARN: ReadonlySet<string> = new Set(['house-ninefold-karma']);

/** The house whose ground this is, walking up from a room to its seat. */
function whoseGround(state: Pick<WorldState, 'locations'>, here: LocationRecord): string | null {
    const byId = new Map(state.locations.map(l => [l.id, l] as const));
    for (let at: LocationRecord | undefined = here, depth = 0; at && depth < 8; at = at.parentId ? byId.get(at.parentId) : undefined, depth++) {
        if (at.kind === 'sect_seat') {
            const id = at.data.factionId;
            return typeof id === 'string' && id.length > 0 ? id : at.controllingFactionId;
        }
    }
    return null;
}

export function aHousePrincipleOpenHere(state: Pick<WorldState, 'locations' | 'factions'>, here: LocationRecord,
    memberOf: string | null): ExposureInput | null {
    const houseId = whoseGround(state, here);
    if (!houseId || !state.factions.some(h => h.id === houseId && h.dissolvedOnDay === null)) return null;
    const entry = getSect(houseId) as { principle?: string; name: string } | undefined;
    if (!entry?.principle) return null;
    if (memberOf !== houseId && !A_HOUSE_PEOPLE_VISIT_TO_LEARN.has(houseId)) return null;
    return { subject: entry.principle, label: `the ${entry.name}'s understanding of ${entry.principle}`, id: houseId };
}
