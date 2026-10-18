/** Leaving ends the appointment, returns house property, and preserves unpaid accounts. */
import { createObligation, settleObligation, type ObligationRecord } from '../social/grudges.js';
import { handBackTheirQuarters } from './what-somebody-keeps-in-their-quarters.js';
import { handBackTheirSlips } from './a-communication-talisman-carries-word-home.js';
import { theHouseStopsExpecting } from './a-house-expects-somebody-it-took-on.js';
import { isRuined, transferPossession } from './possessions.js';
import { canReachInto, isAStorageRing, takeOutOfTheRing, whatIsInTheRing } from './a-storage-ring.js';
import { isInsideTheCompound } from './a-recruit-is-given-their-lamp-at-the-house.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { howBadlyThisIsMissed } from './what-a-change-of-hands-leaves.js';
import { whereAHouseLetsYouKeepThings } from './the-room-a-house-gives-you.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

export function settleLeavingHouse(state: WorldState, person: Pick<NpcRecord, 'id' | 'name'> & { atLocationId?: string | null },
    houseId: string, day: number, ledger = {
        rows: state.obligations as readonly ObligationRecord[],
        put: (row: ObligationRecord): void => {
            const at = state.obligations.findIndex(old => old.id === row.id);
            if (at < 0) state.obligations.push(row);
            else state.obligations[at] = row;
        }
    }): { returned: string[]; stillOwed: string[] } {
    const result = { returned: [] as string[], stillOwed: [] as string[] };
    const house = state.factions.find(row => row.id === houseId);
    const body = state.npcs.find(row => row.id === person.id);
    const here = person.atLocationId !== undefined ? person.atLocationId
        : body ? locationOfNpcOnItsJourney(state, body, day) : null;
    const atHouse = !!house?.seatLocationId && isInsideTheCompound(
        new Map(state.locations.map(place => [place.id, place])), here, house.seatLocationId);
    if (state.objects.some(object => object.possessorId === whereAHouseLetsYouKeepThings(houseId, person.id))) {
        handBackTheirQuarters(state, person.id, houseId);
    }
    theHouseStopsExpecting(state, houseId, person.id);
    handBackTheirSlips(state.objects, id => id === person.id ? null : undefined, day);

    const reachable = new Set([person.id]);
    for (const ring of state.objects) {
        if (!canReachInto(ring, person.id)) continue;
        reachable.add(ring.id);
        // Returning a borrowed container must not surrender the person's own contents.
        if (atHouse && ring.ownerId === houseId) {
            for (const thing of whatIsInTheRing(state.objects, ring.id)) {
                takeOutOfTheRing(state.objects, person.id, ring, thing);
            }
        }
    }

    for (let at = 0; at < state.objects.length; at++) {
        const object = state.objects[at]!;
        if (object.ownerId !== houseId) continue;
        const issued = object.tags.includes('issued') && object.data.memberId === person.id;
        const lastReceipt = [...object.provenance].reverse().find(link => link.holderId === person.id);
        const lent = lastReceipt?.how === 'lent';
        if (!issued && !lent) continue;
        const accessible = object.possessorId !== null && reachable.has(object.possessorId)
            && (!isAStorageRing(object) || whatIsInTheRing(state.objects, object.id).length === 0);
        if (atHouse && accessible && !isRuined(object)) {
            state.objects[at] = { ...transferPossession(object, {
                onDay: day, toHolderId: null, toHolderName: house?.name ?? object.ownerName,
                how: 'returned', transfersOwnership: false, source: person.name,
                note: 'Returned house property on leaving its roll.'
            }), locationId: house?.seatLocationId ?? null };
            result.returned.push(object.name);
        }
        // Cancellation is an act on the issued token, including one in another person's hands.
        if (issued && object.tags.includes('identity')) {
            const returned = state.objects[at]!;
            state.objects[at] = { ...returned, tags: returned.tags.filter(tag => tag !== 'identity') };
        }
        const tag = `house-property:${houseId}:${object.id}:${lent ? lastReceipt.onDay : object.data.issuedOnDay}`;
        const debt = ledger.rows.find(row => row.holderId === person.id && row.tags.includes(tag));
        const returned = !isRuined(state.objects[at]!) && state.objects[at]!.possessorId === null
            && state.objects[at]!.locationId === house?.seatLocationId;
        if (!returned) result.stillOwed.push(object.name);
        if (returned && debt?.status === 'open') {
            ledger.put(settleObligation(debt, {
                resolution: 'repaid', onDay: day, note: `${object.name} returned to the house.`
            }));
        } else if (!returned && !debt) {
            ledger.put(createObligation({
                id: `debt:${person.id}:${tag}`,
                kind: 'debt', holderId: person.id, subjectId: houseId, cause: 'lent_resource',
                severity: howBadlyThisIsMissed(object), onDay: day, tags: [tag, 'sect_business'],
                description: `${person.name} still owes ${object.name} to ${house?.name ?? object.ownerName}.`,
                terms: `Return ${object.name} to its owner.`
            }));
        }
    }
    const at = state.npcs.findIndex(row => row.id === person.id && row.factionId === houseId);
    if (at >= 0) state.npcs[at] = { ...state.npcs[at]!, factionId: null, factionRankIndex: -1,
        activity: null, tags: Array.from(new Set([...state.npcs[at]!.tags, `rogue:left:${houseId}`])),
        updatedOnDay: day };
    return result;
}
