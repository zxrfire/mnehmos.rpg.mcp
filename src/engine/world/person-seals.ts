/** Both person-seal kinds use the same hand, term, laying gate and breaking authority. */
import { whatLayingASealTakes, whatBreakingASealTakes, type HowASealComesOff } from '../social/what-laying-a-qi-seal-takes.js';
import { holdsASlaveSeal, theSealStillHolds, type AQiSeal } from '../cultivation/a-qi-seal-is-put-on-a-person.js';
import { createObligation } from '../social/grudges.js';
import { forStream } from '../cultivation/rng.js';
import { maxQiOf, sealLaidOn, type NpcRecord } from './npc-state.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import { whatTheConfrontationDidToThem } from './what-a-confrontation-does-to-somebody-the-world-holds.js';
import { isTheWorldsToMove } from './npc-state.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { whatItWasWorth } from '../social-leverage/what-a-deed-leaves.js';
import { routineLocationOf } from './npc-routines.js';

/** A released person retains the command records and can hold their own account. */
export function rememberForcedService(state: WorldState, subjectId: string, seal: AQiSeal, day: number, broken = false): void {
    if (seal.kind !== 'slave' || !seal.byId) return;
    const orders = factsWithDataValue(state, 'slaveOrder', true).filter(fact =>
        fact.data.slaveId === subjectId && fact.data.holderId === seal.byId
        && fact.day >= seal.sinceDay);
    if (!orders.length) return;
    const key = `released-slave:${subjectId}:${seal.byId}:${seal.sinceDay}`;
    if (state.obligations.some(word => word.tags.includes(key))) return;
    const irreversible = broken || state.history.facts.some(fact => fact.kind === 'death'
        && fact.data.commandedBy === seal.byId && fact.causes.some(id => orders.some(order => order.id === id)));
    state.obligations.push(createObligation({ kind: 'grudge', holderId: subjectId, subjectId: seal.byId,
        cause: 'violated', severity: whatItWasWorth({ cause: 'violated', paidBy: 'subject', cost: 1,
            irreversible, onDay: day, description: 'All choice was taken during the compelled acts.' }), onDay: day, triggeringEventId: orders[0].id,
        description: `Forced service under a slave seal: ${orders.map(fact => fact.summary).join(' ')}`,
        tags: [key], participants: [seal.byId] }));
}

export function releasePersonSeal(state: WorldState, subjectId: string, day: number, broken = false): boolean {
    const at = state.npcs.findIndex(person => person.id === subjectId);
    const person = state.npcs[at], seal = person?.cultivation.seal;
    if (!person || !seal) return false;
    rememberForcedService(state, subjectId, seal, day, broken);
    state.npcs[at] = { ...person, cultivation: { ...person.cultivation, seal: null },
        ...(person.activity?.slaveOrderId ? { activity: null } : {}),
        ...(broken && seal.kind === 'slave' ? { soulState: 'fragmented' as const } : {}), updatedOnDay: day };
    return true;
}

/** Called only after consent/submission. A successful replacement frees the prior slave. */
export function layPersonSeal(state: WorldState, holder: NpcRecord, subject: NpcRecord, input: {
    kind: 'qi' | 'slave'; day: number; consentOrSubmission: boolean; days?: number | null; note: string;
}) {
    const laid = whatLayingASealTakes({ kind: input.kind, sealerId: holder.id,
        sealerOrdinal: holder.cultivation.realmOrdinal, subjectOrdinal: subject.cultivation.realmOrdinal,
        subjectConsentsOrSubmitted: input.consentOrSubmission, subjectIsThere: subject.status === 'alive',
        subjectAlreadySealed: theSealStillHolds(subject.cultivation.seal, input.day), onDay: input.day,
        subjectMaxQi: maxQiOf(subject), forDays: input.days ?? null, note: input.note });
    if (!laid.went) return laid;
    if (input.kind === 'slave') for (const old of state.npcs) {
        if (old.id !== subject.id && old.status === 'alive' && holdsASlaveSeal(old.cultivation.seal, holder.id, input.day))
            releasePersonSeal(state, old.id, input.day);
    }
    const at = state.npcs.findIndex(person => person.id === subject.id);
    if (at >= 0) state.npcs[at] = sealLaidOn(state.npcs[at], laid.seal!, input.day);
    appendWorldFact(state, makeFact({ day: input.day, kind: 'opportunity', visibility: 'secret',
        locationId: subject.locationId, actors: [{ id: holder.id, name: holder.name, role: 'sealed' },
            { id: subject.id, name: subject.name, role: 'subject' }],
        summary: `${holder.name} laid a ${input.kind} seal on ${subject.name}.`,
        data: { personSeal: input.kind, holderId: holder.id, subjectId: subject.id } }), { recur: false, bystanders: false });
    return laid;
}

/** Force uses the original seal odds. No roll is made against a wall or a certainty. */
export function liftPersonSeal(state: WorldState, breaker: NpcRecord, subjectId: string, day: number,
    how: HowASealComesOff) {
    const subject = state.npcs.find(person => person.id === subjectId);
    const seal = subject?.cultivation.seal;
    const caster = state.npcs.find(person => person.id === seal?.byId);
    if (!subject || !seal || !caster || !theSealStillHolds(seal, day)) return null;
    const result = whatBreakingASealTakes({ how, breakerOrdinal: breaker.cultivation.realmOrdinal,
        casterOrdinal: seal.atOrdinal ?? caster.cultivation.realmOrdinal, isTheCaster: breaker.id === seal.byId });
    const lifted = result.odds === 1 || result.odds > 0
        && forStream(state.seed, 'person-seal-breaking', subjectId, breaker.id, day).chance(result.odds);
    if (lifted) {
        releasePersonSeal(state, subjectId, day, how === 'force_of_arms');
        appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
            locationId: subject.locationId, witnessIds: [caster.id, subjectId, breaker.id],
            actors: [{ id: breaker.id, name: breaker.name, role: 'lifted' },
                { id: subject.id, name: subject.name, role: 'subject' }],
            summary: `${breaker.name} ${how === 'force_of_arms' ? 'broke' : 'released'} the seal on ${subject.name}.`,
            data: { personSealLifted: subjectId, casterId: caster.id, broken: how === 'force_of_arms' } }),
        { recur: false, bystanders: false });
    }
    return { ...result, lifted, theCasterKnows: lifted && how === 'force_of_arms' };
}

/** The effect ends a real Native life, with the same estate and accounts as any named killing. */
export function endSlaveThroughSeal(state: WorldState, holder: NpcRecord, subjectId: string, day: number): boolean {
    const slave = state.npcs.find(person => person.id === subjectId);
    if (holder.status !== 'alive' || !slave || slave.status !== 'alive' || !isTheWorldsToMove(slave)
        || !holdsASlaveSeal(slave.cultivation.seal, holder.id, day)) return false;
    const result = whatTheConfrontationDidToThem(state, { npcId: slave.id, byId: holder.id, byName: holder.name,
        byPresent: routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 }, holder)
            === routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 }, slave),
        day, wounds: [], outcome: 'lethal', lost: true, finished: true });
    state.obligations.push(...result.opens.map(createObligation));
    return result.died;
}
