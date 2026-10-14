/** Native allocation leaves custody on the real object; counted goods enter SQL once. */
import type { GameService } from './turn-engine.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { isRuined } from '../engine/world/possessions.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { addToPouch } from '../storage/cultivator-pouch.js';
import { removeFromPouch } from '../storage/cultivator-pouch.js';
import type { Cultivator } from '../schema/cultivation.js';
import { followedParty } from './the-party-you-actually-follow.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { allocatePrivatePartyFind } from '../engine/world/private-party-finds.js';
import { manualIdOf } from '../engine/world/manuals.js';
import { recordACopyHeld } from '../server/consolidated/technique-manage.js';
import { pouchQuantity } from '../storage/cultivator-pouch.js';

/** Only the successful physical pickup writer calls this, at its actual world date. */
export function recordPlayerPrivatePartyPickup(game: GameService, body: Cultivator, objectId: string,
    alreadyCounted = false, countedQuantity?: number): void {
    const world = game.atHand, party = world && followedParty(game.db, world, body.id);
    const object = world?.objects.find(object => object.id === objectId && object.possessorId === body.id);
    if (!world || !party || !object || typeof party.itinerary.data.privateSponsorId !== 'string') return;
    if (factsWithDataValue(world, 'privatePlayerFind', object.id).some(fact => fact.data.itineraryFactId === party.itinerary.id)) return;
    const thing = whatThisThingIs(object), manual = manualIdOf(object);
    let added = countedQuantity ?? (alreadyCounted ? thing?.quantity ?? 0 : 0);
    if (!alreadyCounted) {
        if (thing && (object.kind === 'pill' || object.kind === 'material')) {
            addToPouch(game.db, body.id, thing.kindId, object.kind === 'pill' ? 'pill' : 'herb', thing.quantity);
            added = thing.quantity;
        } else if (manual) {
            const before = pouchQuantity(game.db, body.id, manual);
            recordACopyHeld(game.db, body.id, manual);
            added = pouchQuantity(game.db, body.id, manual) - before;
        }
    }
    const pickup = appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
        locationId: game.worldPlaceOf(body), causes: [party.itinerary.id], actors: [{ id: body.id, name: body.name, role: 'finder' }],
        summary: `${body.name} picked up ${object.name} on the private venture.`,
        data: { privatePlayerFind: object.id, itineraryFactId: party.itinerary.id, elderId: party.leader.id,
            elderExpedition: party.itinerary.data.privateElderExpedition === true, countedQuantity: added } }), { bystanders: false, recur: false });
    appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
        locationId: game.worldPlaceOf(body), causes: [pickup.id], actors: [{ id: body.id, name: body.name, role: 'received' }],
        summary: 'The private pickup entered the actual possession.',
        data: { privatePartyFindReceived: object.id } }), { bystanders: false, recur: false });
}

export function thePlayerReceivesPrivatePartyFinds(game: GameService): string[] {
    const world = game.atHand, body = game.state().cultivator;
    if (!world || !body.alive) return [];
    const lines: string[] = [];
    let changed = false;
    const seen = new Set(game.present(body).map(person => person.id));
    const records = witnessIndexFor(world).factsByPerson.get(body.id) ?? [];
    for (const pickup of records.filter(fact => typeof fact.data.privatePlayerFind === 'string'
        && fact.actors.some(actor => actor.id === body.id && actor.role === 'finder'))) {
        const object = world.objects.find(object => object.id === pickup.data.privatePlayerFind && object.possessorId === body.id);
        const elder = typeof pickup.data.elderId === 'string' ? actualPersonFor(game, pickup.data.elderId) : null;
        if (!object || !elder || !seen.has(elder.id) || world.history.facts.some(fact =>
            fact.data.privatePartyFind === pickup.data.itineraryFactId && fact.data.objectId === object.id)) continue;
        const before = world.history.facts.length;
        allocatePrivatePartyFind(world, object, actualPersonFor(game, body.id)!, [actualPersonFor(game, body.id)!, elder],
            elder.id, game.worldPlaceOf(body)!, routineTime(world), String(pickup.data.itineraryFactId), pickup.data.elderExpedition === true);
        changed ||= world.history.facts.length > before;
        const holder = world.objects.find(row => row.id === object.id)!;
        const thing = whatThisThingIs(object);
        const manual = manualIdOf(object), added = Number(pickup.data.countedQuantity ?? 0);
        if (holder.possessorId !== body.id && added > 0) {
            if (thing) removeFromPouch(game.db, body.id, thing.kindId, Math.min(added, thing.quantity));
            else if (manual) removeFromPouch(game.db, body.id, manual, added);
        }
        lines.push(...world.history.facts.slice(before).filter(fact => fact.data.privateFindAllocation).map(fact => fact.summary));
    }
    const receivedObjects = new Set((witnessIndexFor(world).factsByPerson.get(body.id) ?? []).filter(fact =>
        fact.data.privatePartyFind || fact.data.privateFindAllocation).map(fact => fact.data.objectId));
    for (const object of world.objects.filter(object => receivedObjects.has(object.id))) {
        if (isRuined(object) || object.ownerId !== body.id || object.possessorId !== body.id) continue;
        const find = world.history.facts.find(fact => fact.data.objectId === object.id
            && (fact.data.privatePartyFind || fact.data.privateFindAllocation) && fact.day <= routineTime(world));
        if (!find || factsWithDataValue(world, 'privatePartyFindReceived', object.id).some(fact =>
            fact.actors.some(actor => actor.id === body.id))) continue;
        const thing = whatThisThingIs(object);
        game.db.transaction(() => {
            if (thing && (object.kind === 'pill' || object.kind === 'material'))
                addToPouch(game.db, body.id, thing.kindId, object.kind === 'pill' ? 'pill' : 'herb', thing.quantity);
            const manual = manualIdOf(object);
            if (manual) recordACopyHeld(game.db, body.id, manual);
            appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
                locationId: game.worldPlaceOf(body), causes: [find.id], actors: [{ id: body.id, name: body.name, role: 'received' }],
                summary: `${body.name} holds ${object.name} from the private party.`,
                data: { privatePartyFindReceived: object.id } }), { recur: false, bystanders: false });
        })();
        lines.push(`You hold ${object.name} from the private party.`);
    }
    if (changed || lines.length) game.theWorldMoved();
    return lines;
}
