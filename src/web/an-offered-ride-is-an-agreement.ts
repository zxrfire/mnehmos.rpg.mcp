import { rideOfferSaid } from './ride-offer-phrasings.js';
/** Accepted rider terms live on the ordinary obligation, never a passenger roster.
 * The request resolver owns consent; this adapter owns the binding and exchange.
 * A promise does not board a body. Explicit boarding selects accepted, actual
 * available riders; native individual landfall proves the same completed course. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { ObligationRecord } from '../engine/social/grudges.js';
import { createOath, settleObligation } from '../engine/social/grudges.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import { routineOf, routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';
import { actualBodiesArrivedTogether } from '../engine/world/a-body-that-actually-arrived.js';
import { peopleUnavailableForOwnedBoarding } from './an-owned-passage.js';
import { whatIsWithinReachOf, whichThingTheyMeant } from './object-theft.js';
import { transferPossession, isTracked, isRuined, hadAs } from '../engine/world/possessions.js';
import { isAVehicle, takeItAlong, whoItIsWith } from '../engine/world/a-vehicle.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { howManyHeld, together, whatTheirThingsTake, whereItWouldGo } from '../engine/world/what-somebody-is-carrying-takes.js';
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
import { actualSpiritStones, transferActualSpiritStones } from './transferring-actual-spirit-stones.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';

const TERMS = 'agreed_passage:';
export type RidePayment = { kind: 'free' } | { kind: 'stones'; stones: number }
    | { kind: 'goods'; objectId: string; name: string };
export interface AgreedRideTerms {
    driverId: string; riderId: string; fromId: string; toId: string;
    acceptedWorldDay: number; payment: RidePayment;
}
export { rideOfferSaid } from './ride-offer-phrasings.js';

export function agreedRideOn(oath: ObligationRecord): AgreedRideTerms | null {
    const tag = oath.tags.find(value => value.startsWith(TERMS));
    return tag ? JSON.parse(tag.slice(TERMS.length)) as AgreedRideTerms : null;
}
export function prepareRideOffer(game: GameService, body: Cultivator,
    rider: { id: string; name: string }, raw: string) {
    const world = game.atHand, said = rideOfferSaid(raw);
    const origin = world && worldLocationFor(world, body.location);
    const destination = world && said && worldLocationFor(world, said.destination);
    const no = (line: string) => refused('world.agreeToPassage', 'request', factsForRefusal(
        'No ride was agreed.', line, 'No rider boarded, no payment moved, no new party agreement was written.'));
    if (!world || !body.alive || !origin || !destination || destination.id === origin.id || !said)
        return no('The offer needs an actual living driver, present rider and different real destination.');
    if (!world.npcs.some(person => person.id === rider.id && person.status === 'alive')
        || !game.present(body).some(person => person.id === rider.id)
        || peopleUnavailableForOwnedBoarding(world, [rider.id], origin.id, routineTime(world)).length > 0)
        return no(`${rider.name} is not physically available to agree and board here.`);
    if (!game.whatTheyCouldRide(body).some(row => !!row.rowId && world.objects.some(object =>
        object.id === row.rowId && object.ownerId === body.id && whoItIsWith(object) === body.id)))
        return no('You have no actual available conveyance to offer here.');
    if (said.free && said.payment !== null) return no('The offer names both free passage and a payment. The actual exchange still needs agreement.');
    let payment: RidePayment;
    if (said.free && said.payment === null) payment = { kind: 'free' };
    else if (said.payment !== null && /^(\d+)\s+spirit\s+stones?$/i.test(said.payment)) {
        const stones = Number(/^(\d+)/.exec(said.payment)![1]);
        const available = actualSpiritStones(game, rider.id) ?? 0;
        if (!Number.isSafeInteger(stones) || stones <= 0)
            return no('Payment must name the actual whole number of spirit stones to exchange.');
        if (available < stones) return no(`${rider.name} has ${available} spirit stones; ${stones} are asked, leaving ${stones - available} short.`);
        payment = { kind: 'stones', stones };
    } else if (said.payment !== null) {
        const named = whichThingTheyMeant(whatIsWithinReachOf(world, rider.id, body.location), said.payment)?.object;
        if (!named || !isTracked(named) || named.ownerId !== rider.id || named.possessorId !== rider.id || isRuined(named))
            return no(`${rider.name} does not actually own and carry the named goods here: ${said.payment}.`);
        payment = { kind: 'goods', objectId: named.id, name: named.name };
    } else return no('Whether the ride is free or what is being exchanged has not been agreed.');
    return { terms: { driverId: body.id, riderId: rider.id, fromId: origin.id, toId: destination.id,
        acceptedWorldDay: routineTime(world), payment } satisfies AgreedRideTerms, destinationName: destination.name };
}
export function bindAgreedRide(game: GameService, body: Cultivator, rider: { id: string; name: string },
    terms: AgreedRideTerms, destinationName: string) {
    const price = terms.payment.kind === 'free' ? 'free passage'
        : terms.payment.kind === 'stones' ? `${terms.payment.stones} spirit stones` : terms.payment.name;
    const prior = ledgerAbout(game.db, body.id).find(oath => {
        const kept = agreedRideOn(oath);
        return oath.status === 'open' && kept?.driverId === body.id && kept.riderId === rider.id
            && kept.toId === terms.toId && JSON.stringify(kept.payment) === JSON.stringify(terms.payment);
    });
    const oath = prior ?? createOath({ holderId: body.id, subjectId: rider.id, cause: 'service_term', severity: 'slight',
        onDay: terms.acceptedWorldDay, triggeringEventId: 'passage:' + terms.toId,
        description: `${body.name} offered ${rider.name} passage to ${destinationName}.`, participants: [rider.id],
        terms: `Passage to ${destinationName} for ${price}; exchange on actual arrival together.`,
        tags: ['passage_agreement', TERMS + JSON.stringify(terms)] });
    if (!prior) writeOneObligation(game.db, oath);
    return { lines: [`${rider.name} agreed to passage to ${destinationName} for ${price}, exchanged on actual arrival together.`,
        'Nobody boarded during this exchange. Their existing party agreement is unchanged.'],
        span: null,
        calls: [{ name: 'world.agreeToPassage', action: 'request' as const, ok: true,
            summary: `Actual consent bound passage oath ${oath.id}; explicit boarding and actual shared landfall still owed.` }] };
}
/** Physical boarding selection changes no canonical party agreement. */
export function companySelectedForBoarding<T extends { id: string; name: string }>(party: readonly T[], raw: string): readonly T[] {
    if (/\b(?:alone|by myself)\b/i.test(raw)) return [];
    const withClause = /\bwith\s+(.+?)[.!]?$/i.exec(raw)?.[1];
    if (!withClause || /\b(?:party|passengers)\b/i.test(withClause)) return party;
    return party.filter(person => withClause.toLowerCase().includes(person.name.toLowerCase()));
}
/** Accepted terms select only explicitly requested riders, not everybody promised a place. */
export function acceptedRidersForBoarding(game: GameService, body: Cultivator, destinationId: string, raw: string) {
    const world = game.atHand;
    if (!world || /\b(?:alone|by myself)\b/i.test(raw) || !/\bwith\b/i.test(raw)) return { riders: [], missing: [] as string[] };
    const requested = raw.replace(/^.*?\bwith\s+/i, '').replace(/[.!]$/, '').trim();
    if (/^(?:my|our|the) party$/i.test(requested)) return { riders: [], missing: [] as string[] };
    const available = ledgerAbout(game.db, body.id).flatMap(oath => {
        const terms = agreedRideOn(oath);
        return oath.status === 'open' && terms?.driverId === body.id && terms.toId === destinationId
            ? [{ terms, person: world.npcs.find(npc => npc.id === terms.riderId) }] : [];
    });
    const all = /^(?:(?:my|our|the|agreed)\s+)?passengers(?:\s+and\s+(?:my|our|the)\s+party)?$|^(?:my|our|the)\s+party\s+and\s+(?:(?:my|our|the|agreed)\s+)?passengers$/i.test(requested);
    const picked = available.filter(row => all || row.person && requested.toLowerCase().includes(row.person.name.toLowerCase()));
    const ids = [...new Set(picked.map(row => row.terms.riderId))];
    const from = worldLocationFor(world, body.location);
    const unavailable = from ? peopleUnavailableForOwnedBoarding(world, ids, from.id, routineTime(world)) : ids;
    const missing = unavailable.map(id => world.npcs.find(person => person.id === id)?.name ?? 'the agreed rider');
    const namedCompany = companySelectedForBoarding(game.whoIsWithYouOnTheRoad(body), raw);
    if (picked.length === 0 && (all || namedCompany.length === 0)) missing.push(all ? 'No rider has accepted passage to this destination' : 'No accepted ride agreement names ' + requested);
    return { riders: picked.flatMap(row => row.person && !unavailable.includes(row.person.id) ? [row.person] : []), missing };
}
/** Exchange reads current real custody and funds after individual native landfall. */
export function settleAgreedRides(game: GameService, body: Cultivator): { lines: string[]; structure: string[] } | null {
    const world = game.atHand, here = world && worldLocationFor(world, body.location);
    if (!world || !body.alive || !here) return null;
    const lines: string[] = [], structure: string[] = [];
    for (const oath of ledgerAbout(game.db, body.id)) {
        const terms = agreedRideOn(oath), rider = terms && world.npcs.find(person => person.id === terms.riderId);
        if (!terms || oath.status !== 'open' || terms.driverId !== body.id || !rider) continue;
        if (!actualBodiesArrivedTogether(world, [
            { id: body.id, name: body.name, alive: body.alive, locationId: here.id },
            { id: rider.id, name: rider.name, alive: rider.status === 'alive', locationId: routineOf(world, rider).locationId }
        ], terms.toId, terms.acceptedWorldDay)) continue;
        const closed = settleObligation(oath, { resolution: 'oath_fulfilled', onDay: routineTime(world),
            byId: body.id, note: 'Actual individual shared-course arrival and agreed exchange completed.' });
        if (terms.payment.kind === 'stones') {
            const moved = transferActualSpiritStones(game, rider.id, body.id, terms.payment.stones,
                () => { writeOneObligation(game.db, closed); });
            if (!moved.ok) {
                lines.push(`${rider.name} has ${moved.available} spirit stones; ${terms.payment.stones} remain owed, ${moved.short} short. Nothing exchanged.`);
                continue;
            }
            lines.push(`${rider.name} paid the agreed ${terms.payment.stones} spirit stones after actual arrival.`);
        } else if (terms.payment.kind === 'goods') {
            const objectId = terms.payment.objectId;
            const index = world.objects.findIndex(object => object.id === objectId), object = world.objects[index];
            if (!object || object.ownerId !== rider.id || object.possessorId !== rider.id || isRuined(object)) {
                lines.push(`${rider.name} no longer owns and carries ${terms.payment.name}. The agreed exchange remains open.`);
                continue;
            }
            let moved = transferPossession(object, { onDay: routineTime(world), toHolderId: body.id,
                toHolderName: body.name, how: 'bought', transfersOwnership: true,
                source: oath.id, note: 'Agreed passage payment after actual shared landfall.' });
            const landed = whereItWouldGo(together(whatAllOfThatTakes(everythingInThePouch(game.db, body.id)),
                whatTheirThingsTake(world.objects, body.id)), moved, whatABodyCanCarry(body.realmOrdinal),
                howManyHeld(world.objects, body.id));
            moved = isAVehicle(moved) ? moved : landed === 'held' ? hadAs(moved, 'held')
                : landed === 'inventory' ? moved : { ...moved, possessorId: null, locationId: here.id };
            game.db.transaction(() => { writeOneObligation(game.db, closed); })();
            world.objects[index] = moved;
            if (isAVehicle(moved)) takeItAlong(world.objects, moved, body.id);
            game.theWorldMoved();
            lines.push(`${rider.name} exchanged the actual ${object.name} after arrival; it ${landed === 'inventory' || landed === 'held' ? 'is in your custody' : 'lies here'}.`);
        } else {
            writeOneObligation(game.db, closed);
            lines.push(`${rider.name}'s agreed free passage ended on actual arrival. No payment moved.`);
        }
        structure.push(`Actual passage oath ${oath.id} settled once; individual live landfall and actual exchange, no gift favour or theft.`);
    }
    return lines.length ? { lines, structure } : null;
}
