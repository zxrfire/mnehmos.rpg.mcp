/** Actual party voices use the same person odds as an ordinary request. */
import { oddsOf, type AskWeight, type Party } from '../social-leverage/an-attempt-to-move-somebody.js';
import { forStream } from '../cultivation/rng.js';
import { bodyStandingOn, maxBodyOf, setLocation, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { journeyTimeHasReached, locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { theGroundUnderYou } from '../social-leverage/ground-trust.js';
import { roadPositionOfNpc } from './places-on-the-way.js';
import { groundWhereAPartyStopped } from './where-a-carriage-stopped.js';
import { whoHoldsTheGround } from './ground-holder.js';

export type PartyCourseChoice = 'continue' | 'rest' | 'turn_back';
const CHOICES: readonly PartyCourseChoice[] = ['continue', 'rest', 'turn_back'];
export interface PartyVoice { personId: string; choice: PartyCourseChoice }

function asParty(state: WorldState, person: NpcRecord): Party {
    const house = state.factions.find(house => house.id === person.factionId && house.dissolvedOnDay === null);
    return { id: person.id, name: person.name, ordinal: person.cultivation.realmOrdinal,
        charm: person.cultivation.attributes.charm, factionId: house?.id ?? null,
        alignment: house?.alignment ?? null, ranked: house != null };
}

function unfinishedWork(state: WorldState, person: NpcRecord, day: number): boolean {
    const activity = person.activity;
    const mission = activity?.capitalMissionId && witnessIndexFor(state).byId.get(activity.capitalMissionId);
    if (!mission || typeof mission.data.publicRoute !== 'string') return false;
    const route: unknown = JSON.parse(mission.data.publicRoute);
    if (!Array.isArray(route)) return false;
    const phase = activity!.capitalMissionLeg ?? 0;
    if (phase < route.length) return true;
    const question = activity!.partyQuestionId ? witnessIndexFor(state).byId.get(activity!.partyQuestionId) : undefined;
    const workedUntil = question?.data.partyRouteQuestion === true ? question.day : day;
    return phase === route.length && activity!.untilDay != null
        && !journeyTimeHasReached(workedUntil, activity!.untilDay);
}

function costOfAnswer(state: WorldState, person: NpcRecord, choice: PartyCourseChoice, day: number): AskWeight {
    const hurt = bodyStandingOn(person, day) < maxBodyOf(person);
    if (choice === 'continue') return hurt ? 'against_their_interest' : 'a_real_favour';
    if (choice === 'rest') return hurt ? 'a_courtesy' : 'a_real_favour';
    return unfinishedWork(state, person, day) ? 'against_their_interest' : 'a_courtesy';
}

function chanceOfListening(state: WorldState, actor: Party, subject: NpcRecord,
    choice: PartyCourseChoice, day: number, locationId: string): number {
    const tie = subject.relationships.find(tie => tie.targetId === actor.id);
    const actorRow = state.npcs.find(person => person.id === actor.id);
    const reverse = actorRow?.relationships.find(tie => tie.targetId === subject.id);
    return oddsOf({ actor, subject: asParty(state, subject), onDay: day,
        rng: forStream(state.seed, 'party-route-listening', actor.id, subject.id, choice, String(day)),
        ask: costOfAnswer(state, subject, choice, day), approach: { leverage: 'name', audience: 'few' },
        ledger: state.obligations, actorsRecord: state.obligations,
        theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
        yourTie: reverse ? { active: true, strength: Math.max(0, reverse.standing) } : null,
        where: theGroundUnderYou(whoHoldsTheGround(state.locations, locationId)) }).odds;
}

export function pendingPartyQuestion(state: WorldState, memberId: string): HistoricalFact | null {
    const person = state.npcs.find(person => person.id === memberId);
    const id = person?.activity?.partyQuestionId;
    const question = id && witnessIndexFor(state).byId.get(id);
    return question && question.data.partyRouteQuestion === true
        && !factsWithDataValue(state, 'partyQuestionDecided', question.id).length ? question : null;
}

/** The caller supplies an actual stop or fight; there is no random question override. */
export function putTheRouteToTheParty(state: WorldState, leaderId: string, playerId: string,
    day: number, eventKey: string, reason: string): HistoricalFact | null {
    const leader = state.npcs.find(person => person.id === leaderId && person.status === 'alive');
    if (!leader?.activity || !leader.activity.withIds.includes(playerId)) return null;
    // Passengers cannot stop the captain's actual hull by discussing their own route.
    if ((leader.activity.vesselId || leader.activity.airCourseLocationId)
        && leader.activity.untilDay != null && !journeyTimeHasReached(day, leader.activity.untilDay)) return null;
    let locationId = locationOfNpcOnItsJourney(state, leader, day);
    if (!locationId) return null;
    const prior = factsWithDataValue(state, 'partyQuestionEvent', eventKey)
        .find(fact => fact.data.leaderId === leaderId);
    if (prior) return prior;
    const members = new Set([leaderId, ...leader.activity.withIds]);
    const people = state.npcs.filter(person => members.has(person.id) && person.status === 'alive');
    if (people.some(person => person.id !== playerId && locationOfNpcOnItsJourney(state, person, day) !== locationId)) return null;
    const point = roadPositionOfNpc(state.locations, leader, day);
    if (point?.kind === 'edge') locationId = groundWhereAPartyStopped(state, leader.id,
        leader.activity.sinceDay, day, point, locationId);
    const question = appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId, visibility: 'secret',
        summary: 'The party leader put continuing, resting or turning back to the party.',
        actors: [{ id: leader.id, name: leader.name, role: 'party_leader' },
            ...people.filter(person => person.id !== leaderId).map(person => ({ id: person.id, name: person.name, role: 'party_member' }))],
        witnessIds: [playerId, ...people.map(person => person.id)], data: { partyRouteQuestion: true, partyQuestionEvent: eventKey,
            leaderId, playerId, reason, itineraryFactId: leader.activity.capitalMissionId ?? null,
            phase: leader.activity.capitalMissionLeg ?? null } }), { bystanders: false, recur: false });
    for (let at = 0; at < state.npcs.length; at++) {
        const person = state.npcs[at]!;
        if (members.has(person.id) && person.status === 'alive' && person.activity)
            state.npcs[at] = { ...(person.id === playerId ? person : setLocation(person, locationId, day)), activity: {
                ...person.activity, partyQuestionId: question.id } };
    }
    return question;
}

/** One reply per actual member, then the leader hears each voice through ordinary odds. */
export function thePartyAnswers(state: WorldState, question: HistoricalFact,
    player: Party | null, choice: PartyCourseChoice | null, day: number):
    { decision: HistoricalFact; voices: PartyVoice[]; chosen: PartyCourseChoice } | null {
    if (question.data.partyRouteQuestion !== true || (player && (!choice || !CHOICES.includes(choice)
        || question.data.playerId !== player.id)))
        return null;
    const leader = state.npcs.find(person => person.id === question.data.leaderId && person.status === 'alive');
    if (!leader?.activity || (player && !leader.activity.withIds.includes(player.id)) || leader.activity.partyQuestionId !== question.id
        || locationOfNpcOnItsJourney(state, leader, day) !== question.locationId) return null;
    const already = factsWithDataValue(state, 'partyQuestionDecided', question.id)[0];
    if (already && typeof already.data.partyVoices === 'string' && CHOICES.includes(already.data.choice as PartyCourseChoice))
        return { decision: already, voices: JSON.parse(already.data.partyVoices) as PartyVoice[],
            chosen: already.data.choice as PartyCourseChoice };
    const members = new Set([leader.id, ...leader.activity.withIds]);
    const people = state.npcs.filter(person => person.status === 'alive' && members.has(person.id) && person.id !== question.data.playerId);
    if (people.some(person => locationOfNpcOnItsJourney(state, person, day) !== question.locationId)) return null;
    const voices: PartyVoice[] = player ? [{ personId: player.id, choice: choice! }] : [];
    for (const person of people) {
        const weights = Object.fromEntries(CHOICES.map(option => [option,
            chanceOfListening(state, asParty(state, leader), person, option, day, question.locationId!)])) as Record<PartyCourseChoice, number>;
        voices.push({ personId: person.id, choice: forStream(state.seed, 'party-route-voice', question.id, person.id).weighted(weights) });
    }
    const weights: Record<PartyCourseChoice, number> = { continue: 0, rest: 0, turn_back: 0 };
    for (const voice of voices) {
        const actor = voice.personId === player?.id ? player! : asParty(state, people.find(person => person.id === voice.personId)!);
        weights[voice.choice] += voice.personId === leader.id ? 1
            : chanceOfListening(state, actor, leader, voice.choice, day, question.locationId!);
    }
    const chosen = forStream(state.seed, 'party-route-decision', question.id, leader.id).weighted(weights);
    const decision = appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: question.locationId,
        visibility: 'secret', causes: [question.id], witnessIds: [...(player ? [player.id] : []), ...people.map(person => person.id)],
        actors: [...(player ? [{ id: player.id, name: player.name, role: 'answered' }] : []),
            ...people.map(person => ({ id: person.id, name: person.name, role: person.id === leader.id ? 'party_leader' : 'answered' }))],
        summary: chosen === 'continue' ? 'The party leader decided to continue.'
            : chosen === 'rest' ? 'The party leader decided to rest.' : 'The party leader decided to turn back.',
        data: { partyQuestionDecided: question.id, leaderId: leader.id, playerId: question.data.playerId,
            choice: chosen, playerChoice: choice,
            ...(chosen === 'rest' ? { resumeOnDay: Math.floor(day - 6 / 24) + 1 + 6 / 24 } : {}), partyVoices: JSON.stringify(voices),
            itineraryFactId: question.data.itineraryFactId ?? null, phase: question.data.phase ?? null } }),
        { bystanders: false, recur: false });
    return { decision, voices, chosen };
}
