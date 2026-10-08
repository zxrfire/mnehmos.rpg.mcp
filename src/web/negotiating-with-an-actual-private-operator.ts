/** Personal service terms, not a discount to a public tariff or fuel quote.
 * The ordinary request resolver owns consent. This read moves nothing. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { AgreedRideTerms, RidePayment } from './an-offered-ride-is-an-agreement.js';
import { actualSpiritStones } from './transferring-actual-spirit-stones.js';
import { whatIsWithinReachOf, whichThingTheyMeant } from './object-theft.js';
import { isTracked, isRuined } from '../engine/world/possessions.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { actualCarrierScene } from './the-actual-carrier-scene.js';
import { ownedPassageClaim } from './an-owned-passage.js';
export function captainPaymentSaid(text: string) {
    const match = /^(.*?)\s+(?:for|in exchange for)\s+(.+?)[.!?]*$/i.exec(text.trim());
    return match ? { destination: match[1]!.trim(), payment: match[2]!.trim() } : null;
}
export function preparePrivateOperatorTerms(game: GameService, body: Cultivator,
    operatorId: string, toId: string, paymentSaid: string): { terms: AgreedRideTerms } | { reason: string } {
    const fresh = game.repos.cultivators.getById(body.id);
    if (!fresh?.alive) return { reason: 'The actual living rider is unavailable to agree to those terms.' };
    body = fresh;
    const world = game.atHand, actual = world && actualCarrierScene(game.repos, body, world, routineTime(world));
    const operator = world?.npcs.find(npc => npc.id === operatorId && npc.status === 'alive');
    const hull = world?.objects.find(object => object.id === actual?.vesselId && !isRuined(object));
    if (!world || !body.alive || !operator || !actual || actual.operatorId !== operatorId
        || !game.present(body).some(person => person.id === operatorId) || !hull
        || (hull.ownerId !== body.id && hull.ownerId !== operatorId))
        return { reason: 'The actual private operator, hull owner or present rider is unavailable to agree to those terms.' };
    // A public fare is supplied by the public service, not this personal offer.
    if (!ownedPassageClaim(game.db, body.id) || !world.locations.some(place => place.id === toId))
        return { reason: 'The public quoted passage and its fare remain required; no personal offer alters them.' };
    let payment: RidePayment;
    if (/^(?:free|no payment|no charge)$/i.test(paymentSaid)) payment = { kind: 'free' };
    else if (/^\d+\s+spirit\s+stones?$/i.test(paymentSaid)) {
        const stones = Number(/^\d+/.exec(paymentSaid)![0]), available = actualSpiritStones(game, body.id) ?? 0;
        if (!Number.isSafeInteger(stones) || stones <= 0 || stones > available)
            return { reason: 'The actual offered spirit stones are unavailable in the rider’s current purse.' };
        payment = { kind: 'stones', stones };
    } else {
        const object = whichThingTheyMeant(whatIsWithinReachOf(world, body.id, body.location), paymentSaid)?.object;
        if (!object || !isTracked(object) || isRuined(object) || object.ownerId !== body.id || object.possessorId !== body.id)
            return { reason: 'The rider does not actually own and carry the offered goods.' };
        payment = { kind: 'goods', objectId: object.id, name: object.name };
    }
    return { terms: { driverId: operatorId, riderId: body.id, fromId: actual.locationId,
        toId, acceptedWorldDay: routineTime(world), payment } };
}
