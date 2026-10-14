/** A house's actual factor buys finite medicine and finished gear and carries them home. */
import { getPill } from '../../data/cultivation/pills.js';
import { pillStorageModel } from '../cultivation/buying-and-bartering-pills.js';
import { onTheShelf } from './house-wound-medicine.js';
import { makeFact } from './history.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { isRuined, isSomethingYouWouldSwing, transferPossession, type ObjectRecord } from './possessions.js';
import { housesWithACraftHall } from './where-a-house-does-its-work.js';
import { pillStockKey, theHeightAHouseWorksAt, theShelfAHouseKeeps } from './where-the-pills-actually-are.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { roomForHouseWork } from './where-a-house-does-its-work.js';
import { isAVesselOf } from './the-vessel-somebody-works-at.js';

/** The actual assignment, shared by every kind of supply the factor purchases. */
function houseThisFactorBuysFor(state: WorldState, buyer: NpcRecord, day: number): FactionRecord | null {
    if (!isTheWorldsToMove(buyer) || buyer.status !== 'alive' || !buyer.activity
        || buyer.activity.sinceDay > day || (buyer.activity.untilDay ?? Infinity) <= day) return null;
    const house = state.factions.find(row => row.id === buyer.factionId);
    if (!house || house.dissolvedOnDay !== null || !house.seatLocationId) return null;
    const posted = buyer.activity.kind === 'stationed' && buyer.activity.returnTo === house.seatLocationId;
    const mission = buyer.activity.capitalMissionId
        ? witnessIndexFor(state).byId.get(buyer.activity.capitalMissionId) : undefined;
    const purchasing = buyer.activity.kind === 'out_with_a_party' && mission?.data.capitalMission === true
        && mission.data.reason === 'trade and purchases' && mission.factionIds.includes(house.id)
        && mission.actors.some(actor => actor.id === buyer.id) && mission.data.destinationId === buyer.locationId;
    return posted || purchasing ? house : null;
}

/** An exchange post or assigned purchasing errand supplies a nonmaker's finite shelf. */
export function houseWhoseMedicineThisFactorBuys(state: WorldState, buyer: NpcRecord,
    object: ObjectRecord, day: number, makers = housesWithACraftHall(state.locations, 'alchemy_hall')) {
    const house = houseThisFactorBuysFor(state, buyer, day);
    if (!house || makers.has(house.id)) return null;
    const thing = whatThisThingIs(object);
    const pill = object.kind === 'pill' && thing ? getPill(thing.kindId) : null;
    if (!pill || pillStorageModel(pill) !== 'count' || isRuined(object)) return null;
    const carried = state.objects.filter(row => row.ownerId === house.id && row.tags.includes('house-medicine-purchase')
        && !isRuined(row) && whatThisThingIs(row)?.kindId === pill.id)
        .reduce((sum, row) => sum + whatThisThingIs(row)!.quantity, 0);
    const need = theShelfAHouseKeeps(theHeightAHouseWorksAt(house), pill) - onTheShelf(house, pill.id) - carried;
    return need >= thing!.quantity ? house : null;
}

/** Ordinary gear for the real roll, including gear already carried home by a factor. */
export function houseWhoseArtifactThisFactorBuys(state: WorldState, buyer: NpcRecord,
    object: ObjectRecord, day: number, makers = housesWithACraftHall(state.locations, 'artifact_refining_hall')) {
    const house = houseThisFactorBuysFor(state, buyer, day);
    if (!house || makers.has(house.id) || object.kind !== 'artifact' || !object.tags.includes('made')
        || isRuined(object) || !isSomethingYouWouldSwing(object)
        || isAVesselOf(object, 'cauldron') || isAVesselOf(object, 'refining_furnace')) return null;
    const thing = whatThisThingIs(object);
    if (!thing || thing.marketStones === null || object.power === null) return null;
    const defensive = object.tags.includes('defensive');
    const members = new Set(state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id).map(n => n.id));
    const home = new Set(state.locations.filter(room => room.data.factionId === house.id).map(room => room.id));
    if (house.seatLocationId) home.add(house.seatLocationId);
    const equipped = state.objects.filter(row => row.kind === 'artifact' && !isRuined(row)
        && (row.ownerId === house.id || row.ownerId !== null && members.has(row.ownerId))
        && (row.possessorId !== null && members.has(row.possessorId)
            || (row.possessorId === null || row.possessorId === house.id) && row.locationId !== null && home.has(row.locationId))
        && row.tags.includes('defensive') === defensive && row.power !== null && row.power >= object.power!
        && isSomethingYouWouldSwing(row)
        && !isAVesselOf(row, 'cauldron') && !isAVesselOf(row, 'refining_furnace'))
        .reduce((sum, row) => sum + (whatThisThingIs(row)?.quantity ?? 1), 0);
    return members.size - equipped >= thing.quantity ? house : null;
}

/** A tracked purchase stays with its carrier until that person is physically home. */
export function putBoughtHouseArtifactsInTheStore(state: WorldState, factor: NpcRecord, day: number,
    carried?: readonly ObjectRecord[]): void {
    if (!isTheWorldsToMove(factor) || factor.status !== 'alive') return;
    const house = state.factions.find(row => row.id === factor.factionId && row.dissolvedOnDay === null);
    if (!house) return;
    const ground = locationOfNpcOnItsJourney(state, factor, day);
    if (!ground || !(ground === house.seatLocationId
        || state.locations.some(row => row.id === ground && row.data.factionId === house.id))) return;
    const store = roomForHouseWork(state.locations, house.id, 'treasury');
    if (!store) return;
    for (const object of carried ?? state.objects) {
        if (object.ownerId !== house.id || object.possessorId !== factor.id || isRuined(object)
            || !object.tags.includes('house-artifact-purchase')) continue;
        // A counted delivery may have removed rows since this cargo was read.
        const at = state.objects.findIndex(row => row.id === object.id);
        if (at < 0) continue;
        const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction',
            locationId: store.id, factionIds: [house.id],
            actors: [{ id: factor.id, name: factor.name, role: 'factor' }],
            summary: `${factor.name} brought ${object.name} to ${house.name}.`,
            data: { exchangeReturn: true, houseArtifactDelivery: true, buyerId: factor.id,
                houseId: house.id, objectId: object.id } }), { recur: false });
        state.objects[at] = { ...transferPossession(object, { onDay: day, toHolderId: null,
            toHolderName: house.name, how: 'lent', transfersOwnership: false,
            factId: fact.id, note: 'Bought gear delivered to the house stores.' }), locationId: store.id };
    }
}

/** Only a factor physically home can put the carried counted doses on the shelf. */
export function putBoughtHouseMedicineOnTheShelf(state: WorldState, factor: NpcRecord, day: number,
    carried?: readonly ObjectRecord[]): void {
    if (!isTheWorldsToMove(factor) || factor.status !== 'alive') return;
    const house = state.factions.find(row => row.id === factor.factionId);
    if (!house || house.dissolvedOnDay !== null) return;
    const ground = locationOfNpcOnItsJourney(state, factor, day);
    if (!ground || !(ground === house.seatLocationId
        || state.locations.some(row => row.id === ground && row.data.factionId === house.id))) return;
    const unloaded = new Set<string>();
    for (const object of carried ?? state.objects) {
        if (object.ownerId !== house.id || object.possessorId !== factor.id || isRuined(object)
            || !object.tags.includes('house-medicine-purchase')) continue;
        const thing = whatThisThingIs(object);
        const pill = thing && object.kind === 'pill' ? getPill(thing.kindId) : null;
        if (!pill || pillStorageModel(pill) !== 'count') continue;
        house.resources[pillStockKey(pill.id)] = onTheShelf(house, pill.id) + thing!.quantity;
        appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction', locationId: ground,
            factionIds: [house.id], actors: [{ id: factor.id, name: factor.name, role: 'factor' }],
            summary: `${factor.name} brought ${thing!.quantity} ${pill.name} to ${house.name}.`,
            data: { exchangeReturn: true, houseMedicineDelivery: true, buyerId: factor.id,
                houseId: house.id, pillId: pill.id, quantity: thing!.quantity } }), { recur: false });
        unloaded.add(object.id);
    }
    if (unloaded.size) state.objects = state.objects.filter(row => !unloaded.has(row.id));
}
