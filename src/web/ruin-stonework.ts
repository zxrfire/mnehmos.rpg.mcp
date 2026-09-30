/**
 * Reading a ruin by how it was built, against the houses the reader knows.
 *
 * A fallen seat keeps the style its house stamped on it (`data.styleTags`), and
 * age takes the facets off in the order `survivingTags` states. What is left is
 * held against the building style of every house the reader already knows by
 * name; the reader's own knowledge is the whole candidate list, so a house
 * nobody told them about is never the answer. A name comes out only when one
 * known house matches everything that is left and no other does as well.
 */

import {
    attributionField,
    houseStyleFromTags,
    matchHouseStyle,
    styleTagsOf,
    survivingTags,
    whatIsLeftToSeeOf,
    type HouseStyle
} from '../engine/world/architecture.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { ageOf, readProvenance } from '../engine/world/provenance.js';
import type { WorldState } from '../engine/world/world-state.js';

export interface RuinStonework {
    lines: string[];
    structure: string;
}

/**
 * What the stonework of this ruin says to somebody who knows the houses
 * `knowsHouse` answers yes for. Null where the ruin carries no style at all,
 * which is every ruin that was never a house's seat.
 */
export function whatTheStoneworkOfARuinSays(
    world: WorldState,
    site: LocationRecord,
    knowsHouse: (factionId: string) => boolean
): RuinStonework | null {
    const stamped = styleTagsOf(site);
    if (stamped.length === 0) return null;
    const age = ageOf(site, Math.floor(world.currentDay));
    const surviving = survivingTags(stamped, age);

    // The builder's own style is what was stamped here; every other known house
    // is read off its own seat.
    const candidates = new Map<string, { style: HouseStyle; name: string }>();
    const builder = readProvenance(site);
    const asBuilt = houseStyleFromTags(site);
    if (asBuilt && builder.builderId && knowsHouse(builder.builderId)) {
        candidates.set(builder.builderId, {
            style: { ...asBuilt, factionId: builder.builderId },
            name: world.factions.find(row => row.id === builder.builderId)?.name
                ?? builder.builderName ?? ''
        });
    }
    for (const house of world.factions) {
        if (candidates.has(house.id) || !knowsHouse(house.id) || house.seatLocationId === null) continue;
        const seat = world.locations.find(row => row.id === house.seatLocationId);
        const style = seat && seat.id !== site.id ? houseStyleFromTags(seat) : null;
        if (style) candidates.set(house.id, { style: { ...style, factionId: house.id }, name: house.name });
    }

    const styles = [...candidates.values()].map(row => row.style);
    const field = attributionField(surviving, styles);
    const named = field.field === 1 && field.best === 1
        ? candidates.get(matchHouseStyle(surviving, styles)[0].factionId) ?? null
        : null;

    const lines = whatIsLeftToSeeOf(surviving);
    if (candidates.size === 0) {
        lines.push('You know no house\'s way of building to hold it against.');
    } else if (named !== null) {
        lines.push(`It is cut the way ${named.name} builds.`);
    } else if (field.best === 1) {
        lines.push(`${field.field} houses you know build this way, and what is left does not say which.`);
    } else {
        lines.push('It is not the way any house you know builds.');
    }

    return {
        lines,
        structure: `whatTheStoneworkOfARuinSays(${site.id}): age ${age}, ${surviving.length} of `
            + `${stamped.length} facets left, held against ${candidates.size} known house(s); `
            + `best ${field.best}, matched by ${field.field}. Read only, nothing spent.`
    };
}
