/** Close people choose their own company; neither a house nor a shared title is required. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { LocationRecord } from './locations.js';
import { isTheWorldsToMove } from './npc-state.js';
import { freeForPrivateBusiness, undertakePrivateVenture } from './private-ventures.js';
import { privatePeopleCanSpeak, putPrivateRequest } from './private-requests.js';
import { forStream } from '../cultivation/rng.js';
import { createObligation } from '../social/grudges.js';
import { createLineageRecord, addLineageEdge } from './lineage.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { drawBackgroundIncidents, isPlayerInvolved, playerAtTheContact } from './background-incident-draw.js';
import { invitePlayerToPrivateParty } from './a-private-party-invites-the-player.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from './what-one-of-the-worlds-own-people-knows.js';
import { isAtLeast } from '../social/discovery.js';
import { sendHouseMission } from './capital-missions-and-calendar.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { HUNTING_DAYS } from './hunting-a-spirit-beast.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';

/** The actual lateral lineage edges are the bond; there is no parallel sibling flag. */
export function swornSiblingsOf(state: WorldState, personId: string): Set<string> {
    const siblings = new Set<string>();
    for (const line of state.lineages) for (const edge of line.edges) {
        if (edge.relation !== 'sworn_sibling') continue;
        if (edge.parentId === personId) siblings.add(edge.childId);
        if (edge.childId === personId) siblings.add(edge.parentId);
    }
    return siblings;
}

/** A reached NPC gives its own answer. Mutual words and lateral kin edges are written together. */
export function swearBrotherhood(state: WorldState, actorId: string, subjectId: string, day: number): boolean {
    const actor = state.npcs.find(person => person.id === actorId), subject = state.npcs.find(person => person.id === subjectId);
    if (!actor || !subject || actor.id === subject.id || !isTheWorldsToMove(actor) || !isTheWorldsToMove(subject)
        || swornSiblingsOf(state, actor.id).has(subject.id)
        || !putPrivateRequest(state, actor, subject, day, `${actor.name} asked ${subject.name} to swear brotherhood.`,
            'sworn-brotherhood-answer')) return false;
    recordSwornBrotherhood(state, actor, subject, day);
    return true;
}

/** Call only after both real people consented, including an explicit human answer. */
export function recordSwornBrotherhood(state: WorldState, actor: NpcRecord, subject: NpcRecord, day: number): void {
    if (actor.id === subject.id || swornSiblingsOf(state, actor.id).has(subject.id)) return;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'public', locationId: actor.locationId,
        actors: [{ id: actor.id, name: actor.name, role: 'swore' }, { id: subject.id, name: subject.name, role: 'swore' }],
        summary: `${actor.name} and ${subject.name} swore brotherhood.`, data: { swornBrotherhood: true } }), { recur: false });
    const words = [actor, subject].map((person, at) => createObligation({ kind: 'oath', holderId: person.id,
        subjectId: [subject, actor][at].id, cause: 'sworn_brotherhood', severity: 'serious', onDay: day,
        triggeringEventId: fact.id, participants: [actor.id, subject.id], tags: ['sworn', 'private', 'cause:sworn_brotherhood', 'unwitnessed'],
        description: fact.summary, terms: 'Stand as sworn siblings and answer one another before other company.' }));
    state.obligations.push(...words);
    let at = state.lineages.findIndex(line => line.memberIds.includes(actor.id));
    if (at < 0) {
        state.lineages.push(createLineageRecord({ id: `lin-sworn:${fact.id}`, surname: actor.name,
            founderId: actor.id, foundedOnDay: day, tags: ['sworn-brotherhood'] }));
        at = state.lineages.length - 1;
    }
    let line = state.lineages[at];
    for (const [first, second] of [[actor, subject], [subject, actor]]) line = addLineageEdge(line,
        { parentId: first.id, childId: second.id, relation: 'sworn_sibling', onDay: day, note: fact.summary });
    state.lineages[at] = { ...line, obligationIds: line.obligationIds.concat(words.map(word => word.id)) };
}

/** Any tie can be close. A sworn sibling is called first, then actual mutual standing. */
export function privateCompanyCandidates(state: WorldState, leader: NpcRecord, day: number): NpcRecord[] {
    const siblings = swornSiblingsOf(state, leader.id);
    const standing = (person: NpcRecord) => Math.max(
        leader.relationships.find(tie => tie.targetId === person.id)?.standing ?? 0,
        person.relationships.find(tie => tie.targetId === leader.id)?.standing ?? 0);
    return state.npcs.filter(person => person.id !== leader.id && freeForPrivateBusiness(person, day)
        && privatePeopleCanSpeak(state, leader, person, day) && (siblings.has(person.id) || standing(person) > 0))
        .sort((a, b) => Number(siblings.has(b.id)) - Number(siblings.has(a.id)) || standing(b) - standing(a) || a.id.localeCompare(b.id));
}

/** Ordinary persuasion can include somebody outside the close circle; all seats precede the quote. */
export function formPrivateParty(state: WorldState, leaderId: string, destination: LocationRecord,
    invitedIds: readonly string[], day: number, onDue?: (id: string, day: number) => void,
    venture: 'journey' | 'hunt' = 'journey') {
    const leader = state.npcs.find(person => person.id === leaderId);
    if (!leader || !freeForPrivateBusiness(leader, day) || new Set(invitedIds).size !== invitedIds.length
        || invitedIds.includes(leaderId)) return null;
    const members: NpcRecord[] = [];
    let attentionDays = 0;
    for (const id of invitedIds) {
        const subject = state.npcs.find(person => person.id === id);
        if (!subject || !freeForPrivateBusiness(subject, day)) continue;
        const before = state.history.facts.length;
        if (putPrivateRequest(state, leader, subject, day, `${leader.name} invited ${subject.name} to a private party for ${destination.name}.`,
            'private-company-answer')) members.push(state.npcs.find(person => person.id === id)!);
        attentionDays += state.history.facts.slice(before).reduce((days, fact) => days + Number(fact.data.attentionDays ?? 0), 0);
    }
    if (!members.length) return null;
    const departure = day + attentionDays;
    if (venture !== 'hunt' && (destination.kind === 'ruin' || destination.kind === 'forbidden_zone'))
        return undertakePrivateVenture(state, leader.id, destination, members, departure, undefined, onDue, false);
    return sendHouseMission(state, null, destination, [state.npcs.find(person => person.id === leaderId)!, ...members],
        venture === 'hunt' ? 'a private hunt with company' : 'a private journey with company', departure,
        { days: venture === 'hunt' ? HUNTING_DAYS : LOCAL_WALK_DAYS }, onDue, undefined, undefined,
        { leaderId: leaderId, privateVenture: false, privateHunt: venture === 'hunt' }, state.npcs.find(person => person.id === leaderId)!);
}

/** Rates select distant starts; consent and physical admission remain exact for every selected party. */
export function closePeopleThisYear(state: WorldState, year: number, day: number,
    onDue?: (id: string, day: number) => void): string[] {
    const pool = state.npcs.filter(person => freeForPrivateBusiness(person, day)
        && person.relationships.some(tie => tie.standing > 0));
    const rate = (person: NpcRecord) => 0.06 * Math.max(0, ...person.relationships.map(tie => tie.standing));
    const chosen = [...pool.filter(person => isPlayerInvolved(state, person)
        && forStream(state.seed, 'close-company-exact', person.id, year).chance(rate(person))),
        ...drawBackgroundIncidents(pool.filter(person => !isPlayerInvolved(state, person)).map(value => ({ value, rate: rate(value) })),
            forStream(state.seed, 'close-company-background', year), 4)];
    const known = whatOneOfTheWorldsOwnPeopleKnows({ ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 });
    const departures: string[] = [];
    for (const original of chosen) {
        const leader = state.npcs.find(person => person.id === original.id)!;
        if (!freeForPrivateBusiness(leader, day)) continue;
        let candidates = privateCompanyCandidates(state, leader, day);
        const contact = playerAtTheContact(state);
        const player = contact && state.npcs.find(person => person.id === contact.id);
        const contactPlace = contact && state.locations.find(place => place.id === contact.placeId);
        const closePlayer = player && contactPlace && contact?.placeId === leader.locationId
            && theAreasOf(state, contactPlace, undefined, { id: player.id, sectId: player.factionId,
                standingIn: contact.areaId }).whereIs.get(leader.id) === contact.areaId
            && (swornSiblingsOf(state, leader.id).has(player.id)
            || leader.relationships.some(tie => tie.targetId === player.id && tie.standing > 0));
        if (!candidates.length && !closePlayer) continue;
        const closest = candidates[0] ?? player!, mutual = Math.min(
            leader.relationships.find(tie => tie.targetId === closest.id)?.standing ?? 0,
            closest.relationships.find(tie => tie.targetId === leader.id)?.standing ?? 0);
        const beforeBond = state.history.facts.length;
        if (isTheWorldsToMove(closest) && !swornSiblingsOf(state, leader.id).has(closest.id)
            && forStream(state.seed, 'close-company-bond', leader.id, year).chance(Math.max(0, mutual)))
            swearBrotherhood(state, leader.id, closest.id, day);
        const afterBond = day + state.history.facts.slice(beforeBond).reduce((days, fact) => days + Number(fact.data.attentionDays ?? 0), 0);
        candidates = privateCompanyCandidates(state, state.npcs.find(person => person.id === leader.id)!, afterBond);
        const venues = state.locations.filter(place => place.id !== leader.locationId
            && (place.kind === 'ruin' || place.kind === 'forbidden_zone' || place.kind === 'wilds')
            && isAtLeast(known(leader.id, 'place', place.id), 'placed'));
        if (!venues.length) continue;
        const venue = forStream(state.seed, 'close-company-venture', leader.id, year).pick(venues);
        if (closePlayer) {
            const before = state.history.facts.length;
            const willing = candidates.filter(person => putPrivateRequest(state, leader, person, afterBond,
                `${leader.name} invited ${person.name} to the private party for ${venue.name}.`, 'private-company-answer'));
            const attention = state.history.facts.slice(before).reduce((sum, fact) => sum + Number(fact.data.attentionDays ?? 0), 0);
            if (invitePlayerToPrivateParty(state, leader, player!.id, venue.id, afterBond,
                venue.kind === 'wilds' ? 'hunt' : 'equals', willing.map(person => person.id), undefined, onDue, attention)) continue;
        }
        const party = formPrivateParty(state, leader.id, venue, candidates.map(person => person.id), afterBond, onDue,
            venue.kind === 'wilds' ? 'hunt' : 'journey');
        if (party) departures.push(party.id);
    }
    return departures;
}
