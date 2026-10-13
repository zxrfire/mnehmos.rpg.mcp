/** An actual operator reads a noticed danger through the ordinary person decision authority. */
import type { WorldState } from './world-state.js';
import { addGoal, woundsCarriedBy, isTheWorldsToMove, bodyStandingOn, maxBodyOf, type NpcRecord } from './npc-state.js';
import { privatePartyOf } from './private-requests.js';
import { oddsOf } from '../social-leverage/an-attempt-to-move-somebody.js';
import { forStream } from '../cultivation/rng.js';
import { activePlague } from '../cultivation/plague.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { isCrippledByInjuries } from '../cultivation/injuries.js';

export interface TroubleNoticedAboard {
    key: string;
    person: NpcRecord;
    reason: string;
}

export function captainHasAnswered(world: WorldState, operatorId: string, trouble: TroubleNoticedAboard): boolean {
    return factsWithDataValue(world, 'captainTrouble', `${operatorId}:${trouble.key}`).length > 0;
}

export function captainCanAct(operator: NpcRecord): boolean {
    return isTheWorldsToMove(operator)&&operator.status==='alive'
        &&!(operator.activity&&'partyFightId' in operator.activity&&typeof operator.activity.partyFightId==='string');
}

/** A visible serious wound or active plague is trouble; future fatal dates are not testimony. */
export function bodilyTroubleAboard(person: NpcRecord & {actualBodyHealth?:{hp:number;maxHp:number}}, day: number): TroubleNoticedAboard | null {
    if (person.status !== 'alive') return null;
    const plague = activePlague({ ...person.cultivation, injuries: woundsCarriedBy(person) }, day);
    if (plague) return { key: `plague:${person.id}:${plague.outbreakId}:${plague.contractedOnDay}`,
        person, reason: `${person.name} is weakened by plague aboard.` };
    const wounds = woundsCarriedBy(person).filter(wound => !wound.treated && wound.severity !== 'minor');
    const health = person.actualBodyHealth ?? {hp:bodyStandingOn(person,day),maxHp:maxBodyOf(person)};
    return wounds.length && (health.hp < health.maxHp || isCrippledByInjuries({injuries:woundsCarriedBy(person)}))
        ? { key: `wounds:${person.id}:${wounds.map(wound => wound.id).sort().join(',')}`,
        person, reason: `${person.name} has untreated serious wounds aboard.` } : null;
}

/** Returns no second decision for the same noticed incident and actual operator. */
export function captainAnswersTrouble(world: WorldState, operator: NpcRecord, trouble: TroubleNoticedAboard,
    sourceId: string, locationId: string, day: number, proposed: string,
    carryOut: () => boolean): HistoricalFact | null {
    const key = `${operator.id}:${trouble.key}`;
    if (!captainCanAct(operator)||captainHasAnswered(world, operator.id, trouble)) return null;
    const at = world.npcs.findIndex(person => person.id === operator.id);
    if (at < 0) return null;
    const note = `Protect ${trouble.person.name}: ${trouble.reason}`;
    const existing = operator.goals.find(goal => goal.status === 'active' && goal.kind === 'protection'
        && goal.targetId === trouble.person.id);
    if (!existing) world.npcs[at] = addGoal(operator, { kind: 'protection', targetId: trouble.person.id, text: note }, day);
    const captain = world.npcs[at];
    const tie = (one: NpcRecord, other: string) => ({ active: true,
        strength: Math.max(0, Math.min(1, one.relationships.find(tie => tie.targetId === other)?.standing ?? 0)) });
    const rng = forStream(world.seed, 'captain-duty-decision', operator.id, trouble.key);
    const reading = oddsOf({ actor: privatePartyOf(world, trouble.person), subject: privatePartyOf(world, captain),
        ask: 'a_real_favour', onDay: day, approach: { leverage: 'debt', audience: 'few' },
        theirTie: tie(captain, trouble.person.id), yourTie: tie(trouble.person, captain.id),
        ledger: world.obligations, theyWantSomethingFromYou: captain.goals.some(goal => goal.status === 'active'
            && goal.kind === 'protection' && goal.targetId === trouble.person.id), rng });
    const chose = rng.chance(reading.odds), changed = chose && carryOut();
    const summary = changed ? `${operator.name} decided to ${proposed} ${trouble.reason}`
        : `${operator.name} continued the accepted course. ${trouble.reason}`;
    return appendWorldFact(world, makeFact({ day, kind: 'gathering', visibility: 'public', locationId,
        actors: [{ id: operator.id, name: operator.name, role: 'operator' },
            { id: trouble.person.id, name: trouble.person.name, role: 'affected' }],
        causes: [sourceId], summary, data: { captainTrouble: key, accepted: chose, responseCarriedOut: changed,
            vesselId: witnessIndexFor(world).byId.get(sourceId)?.data.vesselId ?? operator.activity?.vesselId ?? '' } }),
        { recur: false, bystanders: false });
}
