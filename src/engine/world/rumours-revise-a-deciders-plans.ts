/** Deciders can act on a report while its claim remains unverified. */
import { addGoal, isTheWorldsToMove } from './npc-state.js';
import { circulating, circulationLookup, whereThisPersonIsStanding } from './what-people-are-saying.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';
import { forStream } from '../cultivation/rng.js';

export function rumoursRevisePlans(state: WorldState, day: number): void {
    const places = new Map(state.locations.map(place => [place.id, place]));
    const candidates = [...witnessIndexFor(state).rumoured].filter(f => f.day <= day
        && f.locationId !== null && ['ruin', 'secret_realm', 'cave', 'wilds'].includes(places.get(f.locationId)?.kind ?? ''));
    if (candidates.length === 0) return;
    const lookup = { ...circulationLookup(state, day), candidates };
    const houses = drawBackgroundIncidents(state.factions.filter(h => h.dissolvedOnDay === null)
        .map(value => ({ value, rate: 0.25 })), forStream(state.seed, 'background-rumour-plans', Math.floor(day / 365)), 8);
    const exactHouses = state.factions.filter(h => h.dissolvedOnDay === null
        && state.npcs.some(n => n.factionId === h.id && isPlayerInvolved(state, n)));
    const selected = new Map([...exactHouses, ...houses].map(h => [h.id, h]));
    for (const house of selected.values()) {
        if (house.dissolvedOnDay !== null) continue;
        const decider = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive' && n.factionId === house.id)
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
        if (!decider) continue;
        const heard = circulating(state, whereThisPersonIsStanding(state, decider), day, 24, lookup)
            .find(f => (f.consequences?.rumours.length ?? 0) > 0 && f.locationId !== null
                && !decider.goals.some(g => g.note === `rumour-plan:${f.id}`)
                && state.locations.some(l => l.id === f.locationId && ['ruin', 'secret_realm', 'cave', 'wilds'].includes(l.kind)));
        if (!heard) continue;
        const claim = heard.consequences!.rumours[0]!;
        const at = state.npcs.findIndex(n => n.id === decider.id);
        state.npcs[at] = addGoal(state.npcs[at]!, { kind: 'discovery', targetId: heard.locationId,
            text: `Verify the report: ${claim}`, priority: heard.magnitude,
            note: `rumour-plan:${heard.id}`, obstacles: ['The report has not been verified.'] }, day);
        appendWorldFact(state, makeFact({ day, kind: 'said_in_public', visibility: 'faction',
            summary: `${decider.name} intends to send a party to verify a report about ${state.locations.find(l => l.id === heard.locationId)!.name}.`,
            actors: [{ id: decider.id, name: decider.name, role: 'decider' }], factionIds: [house.id],
            locationId: house.seatLocationId, causes: [heard.id],
            data: { rumourPlan: true, targetId: heard.locationId, sourceFactId: heard.id } }));
    }
}

export function theReportTheDeciderWantsChecked(state: WorldState, houseId: string): string | null {
    const goal = state.npcs.filter(n => n.status === 'alive' && n.factionId === houseId)
        .flatMap(n => n.goals).filter(g => g.status === 'active' && g.note.startsWith('rumour-plan:'))
        .sort((a, b) => b.priority - a.priority)[0];
    if (!goal?.targetId) return null;
    const place = state.locations.find(l => l.id === goal.targetId);
    return place && place.discovered && !place.sealed && !place.tags.includes('forbidden') ? place.id : null;
}
