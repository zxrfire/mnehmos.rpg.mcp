/** Death consumes the disciple's identity, lamp and keyed slips before the estate is read. */
import { A_LIFE_LAMP, lampIdFor, tokenIdFor } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { isAStackOfCommunicationTalismans, whatTheSlipsAre, whoseSlipsTheyAre } from './a-communication-talisman-carries-word-home.js';
import { madeTokensGoToDust, theTokenWentToDust } from './a-made-token-goes-to-dust.js';
import { playerAtTheContact } from './background-incident-draw.js';
import { makeFact } from './history.js';
import { whereCompoundsAre, whereTheyAreStanding } from './where-inside-a-house-somebody-is-standing.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import type { ObjectRecord } from './possessions.js';

export function theirIdentityGoesToDust(state: WorldState, memberId: string, onDay: number,
    keyed: readonly ObjectRecord[] = state.objects): ObjectRecord[] {
    const ids = new Set([tokenIdFor(memberId), lampIdFor(memberId)]);
    for (const object of keyed) {
        const keyedSlip = isAStackOfCommunicationTalismans(object) && whatTheSlipsAre(object) !== 'blanks'
            && whoseSlipsTheyAre(object) === memberId;
        const keyedLongRange = (object.tags.includes('long-range-communication')
            || object.tags.includes('long-range-communication-twin')) && object.data.keyedTo === memberId;
        if (keyedSlip || keyedLongRange) ids.add(object.id);
    }
    const dust = madeTokensGoToDust(state.objects, ids);
    if (dust.length === 0) return dust;
    const clock = { seed: state.seed, locations: state.locations, npcs: state.npcs, factions: state.factions,
        currentDay: onDay, currentHour: (onDay % 1) * 24 };
    const contact = playerAtTheContact(state);
    const compounds = dust.some(object => object.tags.includes(A_LIFE_LAMP)) ? whereCompoundsAre(state) : null;
    const people = new Set(state.npcs.filter(person => person.status === 'alive').map(person => person.id));
    for (const object of dust) {
        const lamp = object.tags.includes(A_LIFE_LAMP);
        const seat = object.locationId ? compounds?.seatOf.get(object.locationId) ?? object.locationId : null;
        const witnesses = state.npcs.filter(person => person.status === 'alive' && person.id !== memberId
            && (person.id === object.possessorId || lamp && object.locationId !== null
                && person.locationId !== null && (person.locationId === seat
                    || person.locationId === object.locationId || compounds?.seatOf.get(person.locationId) === seat)
                && whereTheyAreStanding(clock, compounds!, person, people) === object.locationId)).map(person => person.id);
        if (contact && contact.id !== memberId && (object.possessorId === contact.id
            || lamp && (object.locationId === contact.placeId || object.locationId === contact.areaId))) {
            witnesses.push(contact.id);
        }
        // An empty hall needs no notification record. Its next reader compares the roll with the lamps.
        if (witnesses.length === 0) continue;
        appendWorldFact(state, makeFact({ day: onDay, kind: 'object_destroyed', visibility: 'secret',
            summary: theTokenWentToDust(object.name), locationId: object.locationId,
            actors: [], witnessIds: [...new Set(witnesses)],
            factionIds: object.ownerId ? [object.ownerId] : [],
            data: { madeTokenDust: true, tokenId: object.id, tokenName: object.name, memberId,
                lifeLamp: lamp, carriedById: object.possessorId } }), { bystanders: false, recur: false });
    }
    return dust;
}
