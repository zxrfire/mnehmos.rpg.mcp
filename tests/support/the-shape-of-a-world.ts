/**
 * A compact shape of a world, for asking whether one era is recognisably
 * descended from another, and what the layer above the Lid has become.
 *
 * Reporting only. Nothing in the simulation reads either shape, so they live
 * beside the tests and the audit scripts that compare them rather than in
 * `src/`.
 */

import type { NpcStatus } from '../../src/engine/world/npc-state.js';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { eraForDay, yearOfDay } from '../../src/engine/world/history.js';
import { MORTAL_LAYER, isAboveTheLid, layerOf } from '../../src/engine/world/layers.js';
import { ascensionsOf, residentsAbove } from '../../src/engine/world/immortal-world.js';

export interface WorldShape {
    day: number;
    year: number;
    livingNpcs: number;
    liveFactions: number;
    dissolvedFactions: number;
    /** Faction ids alive right now. */
    factionIds: string[];
    /** Locations whose current kind differs from what they started as. */
    changedLocations: number;
    locationChanges: number;
    facts: number;
    unresolvedFacts: number;
    /** Relationship rows carrying an inherited account. */
    inheritedGrudges: number;
    /**
     * Inherited accounts on the other side of zero.
     *
     * Counted separately and beside the grudges on purpose. For a long time
     * this number was structurally zero - `settleNpcDeath` inherited only the
     * enemies - and a single figure would have hidden that, because grudges
     * alone look like inheritance working. Two numbers make the asymmetry
     * visible the moment it comes back.
     */
    inheritedFriendships: number;
    /** Goals that have outlived at least one holder. */
    inheritedGoals: number;
    /** Living NPCs by realm tier, lowest first. */
    realmHistogram: number[];
    /**
     * Highest ordinal the ENGINE knows is out there, counting people the
     * world cannot currently account for. See `EXTANT_STATES`.
     */
    strongestOrdinal: number;
    /** Extant but not `alive`: missing, sealed, between bodies. */
    unaccountedFor: number;
}

/**
 * States in which the ENGINE knows somebody still exists, whatever the world
 * believes about it.
 *
 * `missing` is the load-bearing one and it is why this predicate exists at all.
 * At the top of the ladder almost nobody is seen from one century to the next,
 * so being unaccounted for is the ORDINARY condition of a Tribulation
 * Transcendence figure rather than a loss - `ExistenceState` says as much in
 * its own comment: whereabouts unknown, aliveness genuinely unresolved.
 *
 * Counting only `alive` conflated two different questions and made the
 * instrument unable to see the state the world is supposed to produce: a
 * perfectly ordinary disappearance read as the ceiling dropping, so a drift
 * audit reported collapse where the setting was working correctly. The engine
 * is allowed to know things the world cannot - that is the same licence
 * `afterCrossing` takes when it records `still_above` about somebody no house
 * can confirm - and the ceiling is an engine fact.
 */
const EXTANT_STATES = new Set<NpcStatus>([
    'alive',
    'missing',
    'sealed',
    'soul_preserved',
    'possessing',
    'reconstructed'
]);

/**
 * A compact shape of the world, for asking whether it is recognisably
 * descended from an earlier one.
 *
 * The acceptance test compares two of these across five centuries. It is
 * reporting only - nothing in the simulation reads it.
 */
export function worldShape(state: WorldState): WorldShape {
    const tiers = [0, 13, 17, 21, 25, 29, 33, 37, 41, 45];
    const histogram = new Array(tiers.length - 1).fill(0);
    let living = 0;
    let strongest = 0;
    let unaccountedFor = 0;
    let inheritedGoals = 0;
    let inheritedGrudges = 0;
    let inheritedFriendships = 0;

    for (const npc of state.npcs) {
        for (const goal of npc.goals) if (goal.generation > 0) inheritedGoals++;
        for (const rel of npc.relationships) {
            if (rel.inheritedFromId === null) continue;
            if (rel.standing < 0) inheritedGrudges++;
            else if (rel.standing > 0) inheritedFriendships++;
        }
        // The ceiling is what the engine knows is out there. The headcount is
        // what the world can see. They are different questions and were being
        // answered by one filter.
        if (EXTANT_STATES.has(npc.status)) {
            const reach = npc.cultivation.realmOrdinal;
            if (reach > strongest) strongest = reach;
            if (npc.status !== 'alive') unaccountedFor++;
        }
        if (npc.status !== 'alive') continue;
        living++;
        const o = npc.cultivation.realmOrdinal;
        for (let i = 0; i < histogram.length; i++) {
            if (o >= tiers[i] && o < tiers[i + 1]) {
                histogram[i]++;
                break;
            }
        }
    }

    let changedLocations = 0;
    let locationChanges = 0;
    for (const loc of state.locations) {
        locationChanges += loc.changes.length;
        if (loc.kind !== loc.origin.kind) changedLocations++;
    }

    const live = state.factions.filter(f => f.dissolvedOnDay === null);

    return {
        day: state.currentDay,
        year: Math.floor(state.currentDay / DAYS_PER_YEAR),
        livingNpcs: living,
        liveFactions: live.length,
        dissolvedFactions: state.factions.length - live.length,
        factionIds: live.map(f => f.id).sort(),
        changedLocations,
        locationChanges,
        facts: state.history.facts.length,
        unresolvedFacts: state.history.facts.filter(f => f.truth === 'unresolved').length,
        inheritedGrudges,
        inheritedFriendships,
        inheritedGoals,
        realmHistogram: histogram,
        strongestOrdinal: strongest,
        unaccountedFor
    };
}

export interface ImmortalWorldShape {
    exists: boolean;
    day: number;
    year: number;
    residents: number;
    natives: number;
    arrivals: number;
    houses: number;
    /** Ascensions the engine knows ended badly. Never rendered below the Lid. */
    diedAbove: number;
    stillAbove: number;
    /** Lowest qi density anywhere above. It is also the highest: the layer is flat. */
    minQiDensityAbove: number;
    maxQiDensityBelow: number;
    /** The lower world's own age. It only ever falls, and it is late. */
    eraQiDensityBelow: number;
    /**
     * Share of places below that reach the immortal floor.
     */
    shareBelowAtImmortalDensity: number;
}

export function immortalWorldShape(state: WorldState): ImmortalWorldShape {
    const above = state.locations.filter(l => isAboveTheLid(l));
    const below = state.locations.filter(l => layerOf(l) === MORTAL_LAYER);
    const residents = residentsAbove(state);
    const records = ascensionsOf(state);
    const floorAbove = above.length === 0 ? 0 : Math.min(...above.map(l => l.qiDensity));
    return {
        exists: above.length > 0,
        day: state.currentDay,
        year: yearOfDay(state.currentDay),
        residents: residents.length,
        natives: residents.filter(n => n.tags.includes('native')).length,
        arrivals: residents.filter(n => n.tags.includes('ascended')).length,
        houses: state.factions.filter(f => isAboveTheLid(f)).length,
        diedAbove: records.filter(r => r.afterCrossing === 'died_above').length,
        stillAbove: records.filter(r => r.afterCrossing === 'still_above').length,
        minQiDensityAbove: floorAbove,
        maxQiDensityBelow: Math.max(0, ...below.map(l => l.qiDensity)),
        eraQiDensityBelow: eraForDay(state.history, state.currentDay)?.qiDensity ?? 1,
        shareBelowAtImmortalDensity: below.length === 0
            ? 0
            : Number((below.filter(l => l.qiDensity >= floorAbove).length / below.length).toFixed(4))
    };
}
