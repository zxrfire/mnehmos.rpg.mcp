/** SQL bodies and Native bodies keep their seal in their existing sole body row. */
import type { GameService } from './turn-engine.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { holdsASlaveSeal, theSealStillHolds, type AQiSeal } from '../engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { whatLayingASealTakes } from '../engine/social/what-laying-a-qi-seal-takes.js';
import { rememberForcedService, releasePersonSeal } from '../engine/world/person-seals.js';
import { maxQiOf, sealLaidOn, isTheWorldsToMove } from '../engine/world/npc-state.js';
import { unfinishedSlaveOrders, finishSlaveOrder } from '../engine/world/slave-orders.js';
import { writeObligations } from '../storage/repos/obligation.repo.js';

export function releaseActualPersonSeal(game: GameService, id: string, day: number, broken = false): boolean {
    const world = game.atHand, body = game.repos.cultivators.getById(id);
    if (!world) return false;
    if (!body) return releasePersonSeal(world, id, day, broken);
    if (!body.qiSeal) return false;
    const before = world.obligations.length;
    rememberForcedService(world, id, body.qiSeal, day, broken);
    writeObligations(game.db, world.obligations.splice(before));
    game.repos.cultivators.update(id, { qiSeal: null,
        ...(broken && body.qiSeal.kind === 'slave' ? { soulState: 'fragmented' as const } : {}) });
    for (const order of unfinishedSlaveOrders(world)) if (order.data.slaveId === id)
        finishSlaveOrder(world, order, day, 'The seal was released. The order no longer compels.');
    return true;
}

/** Successful laying is the only moment replacement releases another slave. */
export function applyActualPersonSeal(game: GameService, holderId: string, subjectId: string, input: {
    kind: 'qi' | 'slave'; day: number; consentOrSubmission: boolean; days?: number; note: string;
}) {
    const holder = actualPersonFor(game, holderId), subject = actualPersonFor(game, subjectId);
    if (!holder || !subject) return null;
    const laid = whatLayingASealTakes({ kind: input.kind, sealerId: holder.id,
        sealerOrdinal: holder.cultivation.realmOrdinal, subjectOrdinal: subject.cultivation.realmOrdinal,
        subjectIsThere: subject.status === 'alive', subjectConsentsOrSubmitted: input.consentOrSubmission,
        subjectAlreadySealed: theSealStillHolds(subject.cultivation.seal, input.day),
        onDay: input.day, subjectMaxQi: maxQiOf(subject), forDays: input.days ?? null, note: input.note });
    if (!laid.went) return laid;
    writeActualPersonSeal(game, subjectId, laid.seal!, input.day, laid.poolCutTo);
    return laid;
}

export function writeActualPersonSeal(game: GameService, id: string, seal: AQiSeal, day: number, poolCutTo: number | null = null): void {
    const world = game.atHand!;
    if (seal.kind === 'slave' && seal.byId) {
        const others = new Set([...game.repos.cultivators.list().filter(body => body.id !== id && body.alive
            && holdsASlaveSeal(body.qiSeal, seal.byId!, day)).map(body => body.id),
        ...world.npcs.filter(person => person.id !== id && person.status === 'alive' && isTheWorldsToMove(person)
            && holdsASlaveSeal(person.cultivation.seal, seal.byId!, day)).map(person => person.id)]);
        for (const old of others) releaseActualPersonSeal(game, old, day);
    }
    const body = game.repos.cultivators.getById(id);
    if (body) game.repos.cultivators.update(id, { qiSeal: seal,
        ...(poolCutTo === null ? {} : { qi: Math.min(body.qi, poolCutTo) }) });
    else {
        const at = world.npcs.findIndex(person => person.id === id);
        world.npcs[at] = sealLaidOn(world.npcs[at], seal, day);
    }
}
