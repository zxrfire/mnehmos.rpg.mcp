/** Private requests use the ordinary person resolver and its existing favour ledger. */
import { resolveAttempt, attemptWasAccepted, type AskWeight, type Party } from '../social-leverage/an-attempt-to-move-somebody.js';
import { createObligation, settleObligation } from '../social/grudges.js';
import { forStream } from '../cultivation/rng.js';
import { upsertRelationship, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { theGroundUnderYou } from '../social-leverage/ground-trust.js';
import { whoHoldsTheGround } from './ground-holder.js';
import { routineLocationOf } from './npc-routines.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { inClosedDoorCultivation } from './closed-door-cultivation.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';
import { theSealStillHolds } from '../cultivation/a-qi-seal-is-put-on-a-person.js';
import { routineTime } from './npc-routines.js';

export function privatePartyOf(state: WorldState, person: NpcRecord, day = routineTime(state)): Party {
    return { id: person.id, name: person.name, ordinal: person.cultivation.realmOrdinal,
        ...(person.cultivation.seal?.kind === 'slave' && person.cultivation.seal.byId
            && theSealStillHolds(person.cultivation.seal, day) ? { compelledById: person.cultivation.seal.byId } : {}),
        charm: person.cultivation.attributes.charm, factionId: person.factionId,
        alignment: state.factions.find(house => house.id === person.factionId)?.alignment ?? null,
        ranked: person.factionId !== null };
}

/** A private word needs the actual area; knowing a name supplies no access. */
export function privatePeopleCanSpeak(state: WorldState, actor: NpcRecord, subject: NpcRecord, day: number): boolean {
    const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
    const placeId = routineLocationOf(clock, actor);
    const place = state.locations.find(row => row.id === placeId);
    if (actor.status !== 'alive' || subject.status !== 'alive' || inClosedDoorCultivation(actor, day)
        || inClosedDoorCultivation(subject, day) || !place || placeId !== routineLocationOf(clock, subject)) return false;
    const areas = theAreasOf(clock, place).whereIs;
    const actorArea = areas.get(actor.id);
    return actorArea !== undefined && actorArea === areas.get(subject.id);
}

/** A reached person can refuse. A player receives an offer, never an automatic answer. */
export function putPrivateRequest(state: WorldState, actor: NpcRecord, subject: NpcRecord,
    day: number, description: string, stream: string, ask: AskWeight = 'a_real_favour',
    reached: (actor: NpcRecord, subject: NpcRecord, day: number) => boolean = (actor, subject, day) => privatePeopleCanSpeak(state, actor, subject, day),
    localExchangeDays?: number): boolean {
    if (!isTheWorldsToMove(subject) || !reached(actor, subject, day)) return false;
    const placeId = routineLocationOf({ ...state, currentDay: day, currentHour: 0 }, actor);
    const tie = (person: NpcRecord, id: string) => {
        const row = person.relationships.find(held => held.targetId === id);
        return row ? { active: true, strength: Math.max(0, row.standing) } : null;
    };
    const held = state.obligations.find(term => term.status === 'open' && term.kind === 'favor'
        && term.holderId === actor.id && term.subjectId === subject.id);
    const result = resolveAttempt({ actor: privatePartyOf(state, actor, day), subject: privatePartyOf(state, subject, day),
        ask, onDay: day, approach: { leverage: held ? 'favour' : 'name', audience: 'alone' },
        theirTie: tie(subject, actor.id), yourTie: tie(actor, subject.id), ledger: state.obligations,
        where: theGroundUnderYou(whoHoldsTheGround(state.locations, placeId)),
        rng: forStream(state.seed, stream, actor.id, subject.id, day) });
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
        locationId: placeId, actors: [{ id: actor.id, name: actor.name, role: 'asked' },
            { id: subject.id, name: subject.name, role: 'answered' }], summary: description + ' ' + result.line,
        data: { privateRequest: true, accepted: attemptWasAccepted(result.outcome), attentionDays: localExchangeDays ?? result.days } }), { bystanders: false });
    for (const input of [result.marks.obligation, result.marks.counterObligation])
        if (input) state.obligations.push(createObligation({ ...input, triggeringEventId: fact.id }));
    if (held && attemptWasAccepted(result.outcome)) {
        const at = state.obligations.findIndex(term => term.id === held.id);
        state.obligations[at] = settleObligation(held, { resolution: 'repaid', onDay: day,
            byId: subject.id, note: description });
    }
    if (result.marks.tie) for (const [person, other, move] of [
        [actor, subject, result.marks.tie.yours], [subject, actor, result.marks.tie.theirs]
    ] as const) {
        const at = state.npcs.findIndex(row => row.id === person.id);
        if (at >= 0 && isTheWorldsToMove(person)) state.npcs[at] = upsertRelationship(state.npcs[at], { targetId: other.id,
            targetName: other.name, kind: person.relationships.find(row => row.targetId === other.id)?.kind ?? 'acquaintance',
            standing: move.strength, factIds: [fact.id] }, day);
    }
    return attemptWasAccepted(result.outcome);
}
