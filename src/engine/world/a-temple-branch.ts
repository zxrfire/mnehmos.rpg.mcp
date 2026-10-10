/**
 * The Immovable Mountain Temple's branches (下院, lower cloisters).
 *
 * The owner: of the Dao houses only the Temple has branches - "a mini branch of the sect, with some
 * of the temples teachings", with "middle management/leadership overseeing". Every other house treats
 * its own ground as the place its people return to (see `docs/world/houses/dao-houses.md`).
 *
 * A branch is a walled ground of the Temple's own inside a city that matters, nearest the head temple
 * first: a gate, a forecourt and a notice board, like any house's ground. Its people are the Temple's
 * own, sent there by the ordinary posting pass and relieved the way any standing post is. Nobody is
 * appointed to head it in a stored field: whoever on post there stands highest on the Temple's roll
 * heads it, which is the same reading every house uses for who answers at its gate.
 */
import { isACityThatMatters } from './a-dao-house-shopfront.js';
import { linkLocations, makeLocation, routeQueriesFor, type LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

export const THE_TEMPLE_ID = 'house-immovable-mountain';
/** How many lower cloisters the Temple keeps. "Several cities." */
export const HOW_MANY_BRANCHES = 3;
/** People on post at one lower cloister: its head, a deputy, and the disciples under them. */
export const A_BRANCH_HOLDS = 6;

export function isATempleBranch(place: Pick<LocationRecord, 'data'>): boolean {
    return typeof place.data.branchOf === 'string';
}

/** The lower cloisters, made once at seeding, in the cities that matter nearest the head temple. */
export function seedTheTempleBranches(state: WorldState, onDay: number): LocationRecord[] {
    const temple = state.factions.find(h => h.id === THE_TEMPLE_ID && h.dissolvedOnDay === null);
    if (!temple?.seatLocationId || state.locations.some(isATempleBranch)) return [];
    const days = routeQueriesFor(state.locations).treeFrom(temple.seatLocationId).days;
    const cities = state.locations.filter(place => isACityThatMatters(place) && days.has(place.id))
        .sort((a, b) => days.get(a.id)! - days.get(b.id)! || a.id.localeCompare(b.id))
        .slice(0, HOW_MANY_BRANCHES);
    const made: LocationRecord[] = [];
    for (const city of cities) {
        const branch = makeLocation({
            id: `loc-branch-${THE_TEMPLE_ID}-${city.id}`,
            name: `${temple.name}: the lower cloister at ${city.name}`,
            kind: 'sect_seat', parentId: city.id, layer: city.layer,
            qiDensity: city.qiDensity, ambient: city.ambient,
            description: `A walled lower cloister of the ${temple.name} inside ${city.name}: a gate, a forecourt where `
                + 'the head temple\'s teachings are read out, and the cells of those posted here.',
            controllingFactionId: THE_TEMPLE_ID, discovered: false,
            tags: ['sect_ground', 'branch', 'closed'],
            data: { factionId: THE_TEMPLE_ID, branchOf: temple.seatLocationId, populationWeight: 0,
                catalogRegionId: String(city.data.catalogRegionId ?? '') }
        });
        branch.origin.fromDay = onDay;
        state.locations.push(branch);
        linkLocations(city, branch, 'road', 0.1);
        made.push(branch);
    }
    return made;
}

/** The Temple's lower cloisters still standing, in a stable order. */
export function templeBranchesOf(state: Pick<WorldState, 'locations' | 'factions'>, houseId: string): LocationRecord[] {
    if (houseId !== THE_TEMPLE_ID || !state.factions.some(h => h.id === houseId && h.dissolvedOnDay === null)) return [];
    return state.locations.filter(place => isATempleBranch(place) && place.controllingFactionId === houseId)
        .sort((a, b) => a.id.localeCompare(b.id));
}

/** Who heads a lower cloister: the highest on the Temple's roll on post there now. */
export function whoHeadsTheBranch(state: Pick<WorldState, 'npcs'>, branch: Pick<LocationRecord, 'id' | 'controllingFactionId'>): NpcRecord | null {
    return state.npcs.filter(n => n.status === 'alive' && n.factionId === branch.controllingFactionId
        && n.activity?.kind === 'stationed' && n.locationId === branch.id)
        .sort((a, b) => b.factionRankIndex - a.factionRankIndex || a.id.localeCompare(b.id))[0] ?? null;
}
