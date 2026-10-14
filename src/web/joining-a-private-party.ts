/** Explicit human consent joins the native quote and its existing follower binding. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { bindFollowingParty, partyFollowerClaim } from './following-the-party-leader.js';
import { freeForPrivateBusiness, undertakePrivateVenture } from '../engine/world/private-ventures.js';
import { invitePlayerToPrivateParty } from '../engine/world/a-private-party-invites-the-player.js';
import { putPrivateRequest } from '../engine/world/private-requests.js';
import { capitalCalendar, sendHouseMission } from '../engine/world/capital-missions-and-calendar.js';
import { resolveWithPlayerPresent } from '../engine/world/background-incident-draw.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import { HUNTING_DAYS } from '../engine/world/hunting-a-spirit-beast.js';
import { LOCAL_WALK_DAYS } from '../engine/world/local-walking-cost.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { passHours } from './routine-invitations.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../engine/world/what-one-of-the-worlds-own-people-knows.js';
import { isAtLeast } from '../engine/social/discovery.js';
import { executionWithItsSpentSpan } from './an-execution-with-its-spent-span.js';
import { readPrivateWordsAtTheActualBody, writePrivateWordsAtTheActualBody } from './private-words-on-the-actual-ledger.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';

export function withPrivatePlayerContact<T>(game: GameService, body: Cultivator, resolve: () => T): T {
    const world = game.atHand!, person = actualPersonFor(game, body.id)!;
    return resolveWithPlayerPresent(world, { placeId: game.worldPlaceOf(body)!,
        areaId: body.standingIn ?? '', person }, resolve, routineTime(world));
}

export function pendingPrivatePartyInvitations(game: GameService, body: Cultivator) {
    const world = game.atHand;
    if (!world || !body.alive || partyFollowerClaim(game.db, body.id)) return [];
    const present = new Set(game.present(body).map(person => person.id));
    return factsWithDataValue(world, 'privatePartyInvitation', true).filter(fact => fact.day <= routineTime(world)
        && Number(fact.data.respondByDay) > routineTime(world)
        && fact.actors.some(actor => actor.id === body.id && actor.role === 'asked')
        && typeof fact.data.leaderId === 'string' && present.has(fact.data.leaderId)
        && !world.history.facts.some(reply => reply.data.privatePartyReply === fact.id || reply.data.privatePartyDeparture === fact.id)
        && world.npcs.some(person => person.id === fact.data.leaderId && freeForPrivateBusiness(person, routineTime(world))));
}

export function privatePartyInvitationLines(game: GameService, body: Cultivator): string[] {
    return pendingPrivatePartyInvitations(game, body).map(fact => {
        const leader = game.atHand!.npcs.find(person => person.id === fact.data.leaderId)!;
        game.theyGaveTheirName(body, game.currentRun().run, leader);
        const place = game.atHand!.locations.find(place => place.id === fact.data.destinationId);
        return `${leader.name} asks you to join the private ${fact.data.auctionOnDay != null ? 'auction visit' : fact.data.partyKind === 'elder'
            ? 'expedition to broaden your horizons' : 'party'} to ${place?.name ?? 'the agreed ground'}. Do you accept?`;
    });
}

export async function joiningAPrivateParty(game: GameService, run: Run, body: Cultivator,
    action: PlannedAction, raw: string) {
    let world = game.atHand;
    if (!world || !body.alive) return null;
    let proposalSpan: Awaited<ReturnType<typeof passHours>> | null = null;
    const reply = /\b(?:accept|agree|decline|refuse|join|go with|come along)\b/i.test(raw)
        && !/\b(?:brotherhood|sworn|paid work|paid job)\b/i.test(raw)
        && /\b(?:invitation|private party|expedition|auction visit|join them|go with them)\b/i.test(raw);
    const pending = reply ? pendingPrivatePartyInvitations(game, body) : [];
    let offer = pending.length === 1 ? pending[0] : pending.find(fact => {
        const leader = world!.npcs.find(person => person.id === fact.data.leaderId);
        return !action.target || leader?.id === game.somebodyAtHand(action.target, body)?.id;
    });
    // A disciple can put the same private request to their actual master.
    const proposeCompany = /\b(?:ask|invite)\b.*\b(?:lead|organise|organize)\b/i.test(raw) && /\bprivate party\b/i.test(raw);
    const playerForms = !proposeCompany && /\b(?:form|lead|organise|organize)\b.*\bprivate party\b/i.test(raw);
    const namedPerson = (action.target && game.somebodyAtHand(action.target, body))
        || game.present(body).find(person => raw.toLowerCase().includes(person.name.toLowerCase()));
    if (playerForms) return game.request(run, body, game.ambientFor(body, run), namedPerson?.name ?? action.target,
        'company', world.locations.find(place => raw.toLowerCase().includes(place.name.toLowerCase()))?.name,
        undefined, raw + ' join my party', action.days);
    if (!reply && (proposeCompany || /\b(?:take me|bring me|go with you)\b/i.test(raw) && /\b(?:expedition|auction|horizons)\b/i.test(raw))) {
        readPrivateWordsAtTheActualBody(game, body.id);
        const named = namedPerson;
        const pupil = actualPersonFor(game, body.id);
        const leader = named && actualPersonFor(game, named.id);
        const venue = world.locations.find(place => raw.toLowerCase().includes(place.name.toLowerCase())
            && (proposeCompany || place.kind === 'ruin' || place.kind === 'forbidden_zone' || place.tags.includes('city')));
        if (!pupil || !leader || !venue || !proposeCompany && !pupil.relationships.some(tie => tie.targetId === leader.id && tie.kind === 'master')
            || !freeForPrivateBusiness(leader, routineTime(world))) return refused('world.privateDisciple', 'request',
                factsForRefusal('No private party was agreed.', 'Reach the actual leader and name the real destination. An elder expedition requires the personal bond. Nothing spent.'));
        const knows = whatOneOfTheWorldsOwnPeopleKnows(world);
        if (!isAtLeast(knows(leader.id, 'place', venue.id), 'placed')) return refused('world.privatePartyRoute', 'request',
            factsForRefusal('The leader does not know that road.', `${leader.name} cannot lead you to ${venue.name} without its actual route. Nothing spent.`));
        const before = world.history.facts.length;
        const accepted = putPrivateRequest(world, pupil, leader, routineTime(world),
            `${body.name} asked to accompany ${leader.name} on a private venture.`, 'player-private-disciple', 'a_real_favour',
            () => game.present(body).some(person => person.id === leader.id), LESSER_ACTION_DAYS.request);
        writePrivateWordsAtTheActualBody(game, body.id);
        const days = world.history.facts.slice(before).reduce((sum, fact) => sum + Number(fact.data.attentionDays ?? 0), 0);
        game.theWorldMoved();
        const spent = await passHours(game, run, body, days * 24);
        proposalSpan = spent;
        if (!spent.finished) return spent.spent;
        if (!accepted) {
            const done = game.freeAction(game.currentRun().run, 'request',
                factsForToolResult('The private venture was refused.', [`${leader.name} did not agree to take you.`]), !spent.spent);
            return spent.spent ? executionWithItsSpentSpan(spent.spent, done, done) : done;
        }
        const current = game.currentRun();
        world = game.atHand!;
        const auction = /\bauction\b/i.test(raw) ? capitalCalendar(world, Math.floor(routineTime(world) / 365))
            .find(occasion => occasion.venueId === venue.id && occasion.kind === 'auction' && occasion.onDay > routineTime(world!)) : undefined;
        if (/\bauction\b/i.test(raw) && !auction) return refused('world.privateAuction', 'request',
            factsForRefusal('There is no reachable upcoming auction there.', 'No auction itinerary or fare was written.'));
        offer = withPrivatePlayerContact(game, current.cultivator, () => invitePlayerToPrivateParty(game.atHand!,
            game.atHand!.npcs.find(person => person.id === leader.id)!, body.id, venue.id, routineTime(game.atHand!),
            proposeCompany ? venue.kind === 'wilds' ? 'hunt' : 'equals' : 'elder', [], auction?.onDay)) ?? undefined;
        run = current.run; body = current.cultivator;
    }
    if (!reply && !offer) return null;
    if (!offer) return refused('world.privateParty', 'request', factsForRefusal('No invitation is open here.',
        'The actual leader must still be here and free to undertake that private journey. Nothing spent.'));
    const accepted = !/\b(?:decline|refuse)\b/i.test(raw);
    const leader = world.npcs.find(person => person.id === offer!.data.leaderId)!;
    const venue = world.locations.find(place => place.id === offer!.data.destinationId);
    if (!accepted) {
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
            locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'answered' }],
            causes: [offer.id], summary: `${body.name} declined the private party.`,
            data: { privatePartyReply: offer.id, accepted: false } }), { bystanders: false, recur: false });
        game.theWorldMoved();
        return game.freeAction(run, 'request', factsForToolResult('You declined the private party.', ['You declined the private party.', 'No fare was paid and no journey began.']));
    }
    if (!venue || !freeForPrivateBusiness(leader, routineTime(world))) return refused('world.privateParty', 'request',
        factsForRefusal('The private party cannot depart.', 'Its actual leader or destination is no longer available. Nothing spent.'));
    const ids = JSON.parse(String(offer.data.memberIds)) as string[];
    const preparation = Math.max(0, offer.day + Number(offer.data.preparationDays ?? 0) - routineTime(world));
    const members = world.npcs.filter(person => ids.includes(person.id) && freeForPrivateBusiness(person, routineTime(world)));
    const pupil = actualPersonFor(game, body.id)!;
    const pupilAt = world.npcs.findIndex(person => person.id === body.id);
    world.npcs[pupilAt] = { ...pupil, locationId: null };
    const auction = typeof offer.data.auctionOnDay === 'number' ? capitalCalendar(world, Math.floor(offer.data.auctionOnDay / 365))
        .find(occasion => occasion.onDay === offer!.data.auctionOnDay && occasion.venueId === venue.id) : undefined;
    if (offer.data.auctionOnDay != null && !auction) return refused('world.privateParty', 'request',
        factsForRefusal('That auction is no longer available.', 'No journey began and nothing was paid.'));
    const itinerary = withPrivatePlayerContact(game, body, () => venue.kind === 'ruin' || venue.kind === 'forbidden_zone' || auction
        ? undertakePrivateVenture(world, leader.id, venue, [...members, world.npcs[pupilAt]], routineTime(world) + preparation, auction,
            undefined, offer!.data.partyKind === 'elder', new Set([body.id]))
        : sendHouseMission(world, null, venue, [leader, ...members, world.npcs[pupilAt]], 'a private journey with company',
            routineTime(world) + preparation, { days: offer!.data.partyKind === 'hunt' ? HUNTING_DAYS : LOCAL_WALK_DAYS }, undefined,
            undefined, undefined, { leaderId: leader.id, privateHunt: offer!.data.partyKind === 'hunt' }, leader));
    if (!itinerary) return refused('world.privateParty', 'request', factsForRefusal('The private party cannot depart.',
        'The actual route, access, bodies and sponsor purse cannot admit this company. Nothing paid.'));
    world.npcs[pupilAt] = { ...world.npcs[pupilAt], locationId: null };
    const binding = bindFollowingParty(game, run, body, leader.id, itinerary.id);
    if (!binding.ok) throw new Error(binding.reason);
    appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
        locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'answered' }],
        causes: [offer.id, itinerary.id], summary: `${body.name} accepted ${leader.name}'s private party.`,
        data: { privatePartyReply: offer.id, accepted: true } }), { recur: false, bystanders: false });
    game.theWorldMoved();
    const done = game.freeAction(run, 'request', factsForToolResult('You joined the private party.', [
        'You joined the private party.',
        `${leader.name} leads the actual journey to ${venue.name}. The sponsoring arrangement covers your fare.`,
        'The party answers the leader together; you can be overruled, follow the decision or leave.' ]), !proposalSpan?.spent);
    done.timeDisposition = 'no_op';
    return proposalSpan?.spent ? executionWithItsSpentSpan(proposalSpan.spent, done, done) : done;
}
