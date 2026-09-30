/** A missing library book becomes news when somebody goes to use it. */
import { getTechnique } from '../../data/cultivation/techniques.js';
import { forStream } from '../cultivation/rng.js';
import { whatTheHouseLearns } from '../social-leverage/a-thing-is-missed-when-somebody-goes-looking-for-it.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';

/** Ownership and provenance supply the loss; a shelf supplies no thief's name. */
export function housesFindEmptyShelves(state: WorldState, fromDay: number, toDay: number): void {
    for (const object of state.objects) {
        if (!object.tags.includes('library') || !object.ownerId
            || object.possessorId === object.ownerId) continue;
        const taken = [...object.provenance].reverse().find(link =>
            link.previousHolderId === object.ownerId && link.holderId !== object.ownerId);
        if (!taken || (taken.how !== 'stolen' && taken.how !== 'looted') || taken.onDay >= toDay) continue;
        if (state.history.facts.some(fact => fact.data.missingShelfObject === object.id
            && fact.data.takenOnDay === taken.onDay)) continue;
        const house = state.factions.find(row => row.id === object.ownerId && row.dissolvedOnDay === null);
        const art = getTechnique(String(object.data.techniqueId ?? ''));
        if (!house || !art) continue;
        const members = state.npcs.filter(npc => npc.status === 'alive' && npc.factionId === house.id);
        const learned = whatTheHouseLearns({
            book: { requiredOrdinal: art.requiredOrdinal, cap: art.cap ?? Infinity },
            memberOrdinals: members.map(npc => npc.cultivation.realmOrdinal),
            couldHaveReachedIt: [],
            daysElapsed: toDay - Math.max(fromDay, taken.onDay), onDay: toDay,
            rng: forStream(state.seed, 'missing-shelf', object.id, fromDay, toDay)
        });
        if (!learned.missed) continue;
        appendWorldFact(state, makeFact({
            day: toDay, kind: 'resource_contested', scale: 'local',
            summary: `${house.name}'s readers found ${object.name} missing from its shelf.`,
            locationId: house.seatLocationId, factionIds: [house.id], visibility: 'faction',
            actors: [], magnitude: 0.2,
            data: { missingShelfObject: object.id, takenOnDay: taken.onDay,
                unattributed: `${object.name} is missing from ${house.name}'s library.` }
        }));
    }
}
