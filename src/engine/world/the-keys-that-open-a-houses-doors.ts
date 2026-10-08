/** Opening custody, not a key replacement or office-succession mechanism. */
import { purposeOf } from './architecture.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { rankIndexOnAHousesRoll } from './where-somebody-stands-on-a-houses-roll.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/** Called only while opening a new world. Existing keys are never repaired or recovered here. */
export function seedTheKeysThatOpenAHouse(state: WorldState): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const seen = new Set<string>();
    const people = new Map(state.npcs.map(n => [n.id, n]));
    const rolls = { world: state, rollRowFor: () => null };
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
            .map(n => ({ id: n.id, rankIndex: rankIndexOnAHousesRoll(rolls, n.id, house.ranks.length) }))
            .filter(n => n.rankIndex >= 0);
        const offices = portfoliosIn({ locations: state.locations, sectId: house.id, roll,
            rankCount: house.ranks.length });
        for (const room of state.locations) {
            if (room.controllingFactionId !== house.id || typeof room.data.keyId !== 'string') continue;
            const keyId = room.data.keyId;
            if (seen.has(keyId)) continue;
            seen.add(keyId);
            const purpose = purposeOf(room);
            // holderId already names the acting cover when a chair is vacant.
            const custodian = people.get(offices.find(p => p.purpose === purpose)?.holderId ?? '');
            const key = makeObject({ id: `obj-${keyId}`, name: `Key to ${room.name}`, kind: 'key',
                description: `The name ${room.name} is engraved on the key. It bears ${house.name}'s mark.`,
                significance: 'notable', ownerId: house.id, ownerName: house.name,
                possessorId: custodian?.id ?? null, locationId: custodian?.locationId ?? room.id,
                tags: [`house:${house.id}`], data: { keyId } });
            key.provenance.push({ onDay: state.currentDay, how: 'found', holderId: key.possessorId,
                holderName: custodian?.name ?? house.name, source: house.name,
                previousHolderId: null, previousHolderName: null, factId: null,
                note: 'Opening custody of the existing house door key.' });
            out.push(key);
        }
    }
    return out;
}
