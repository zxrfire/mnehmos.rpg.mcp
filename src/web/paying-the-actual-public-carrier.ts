/** A public fare reaches the actual service owner through the ordinary cash
 * transfer. A receipt supplies boarding authority and its accepted fare; this
 * payment cannot create a carrier, board a passenger or change a destination.
 */
import type { GameService } from './turn-engine.js';
import { transferActualSpiritStones } from './transferring-actual-spirit-stones.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { isRuined } from '../engine/world/possessions.js';

export function payForAcceptedPublicPassage(game: GameService, receiptId: string,
    payer: { id: string; name: string }, stones: number): boolean {
    const world = game.atHand;
    if (!world || !Number.isSafeInteger(stones) || stones < 0) return false;
    const receipt = witnessIndexFor(world).byId.get(receiptId);
    if (!receipt || receipt.data.publicPassage !== true || receipt.data.fareStones !== stones
        || !receipt.actors.some(actor => actor.id === payer.id
            && (actor.role === 'passenger' || actor.role === 'aboard'))
        || (receipt.data.service !== 'carriage' && receipt.data.actualBoarding !== true)) return false;
    const prior = factsWithDataValue(world, 'publicPassagePayment', receiptId)
        .find(fact => fact.data.payerId === payer.id);
    if (prior) return prior.data.stones === stones;
    const vessel = world.objects.find(object => object.id === receipt.data.vesselId);
    const owner = vessel && world.npcs.find(person => person.id === vessel.ownerId && person.status === 'alive');
    if (!vessel || isRuined(vessel) || !owner || owner.id === payer.id) return false;
    const moved = transferActualSpiritStones(game, payer.id, owner.id, stones, () => {
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering',
            locationId: typeof receipt.data.fromLocationId === 'string' ? receipt.data.fromLocationId : null,
            visibility: 'secret', causes: [receipt.id],
            actors: [{ id: payer.id, name: payer.name, role: 'payer' },
                { id: owner.id, name: owner.name, role: 'service owner' }],
            summary: `The accepted public passage fare of ${stones} spirit stones was paid.`,
            data: { publicPassagePayment: receipt.id, vesselId: vessel.id,
                payerId: payer.id, receiverId: owner.id, stones } }), { bystanders: false, recur: false });
    });
    return moved.ok;
}
