/** Schedules told by somebody present, from their ground and their house. */
import type { WorldState } from '../engine/world/world-state.js';
import { assessCapability, makeSubject } from '../engine/world/capability.js';
import { queryOpportunities, revealTo, upcoming } from '../engine/world/opportunities.js';

export function opportunitiesTheyCanTell(
    world: WorldState, speakerId: string, listenerId: string
): string[] {
    const speaker = world.npcs.find(n => n.id === speakerId);
    if (!speaker || speaker.status !== 'alive') return [];
    const ground = new Set<string>();
    let place = world.locations.find(l => l.id === speaker.locationId);
    while (place && !ground.has(place.id)) {
        ground.add(place.id);
        place = world.locations.find(l => l.id === place!.parentId);
    }
    const known = queryOpportunities(world.opportunities).filter(opportunity => {
        if (opportunity.knownToIds.includes(speakerId)) return true;
        const withinReach = (opportunity.locationId !== null && ground.has(opportunity.locationId))
            || (speaker.factionId !== null && opportunity.factionIds.includes(speaker.factionId));
        return withinReach && assessCapability({
            id: speaker.id, realmOrdinal: speaker.cultivation.realmOrdinal,
            attributes: speaker.cultivation.attributes
        }, makeSubject({
            kind: 'action', id: opportunity.id, name: opportunity.name,
            requirements: opportunity.requirements, tags: opportunity.tags
        })).understand.holds;
    });
    return upcoming(known, world.currentDay, known.length).map(({ opportunity, window }) => {
        const at = world.opportunities.findIndex(o => o.id === opportunity.id);
        world.opportunities[at] = revealTo(revealTo(opportunity, speakerId), listenerId);
        const waits = window.opensOnDay - world.currentDay;
        const when = waits === 0 ? 'Open now' : `Opens in ${waits} days`;
        return `${opportunity.summary} ${when}; closes in ${window.closesOnDay - world.currentDay} days.`;
    });
}
