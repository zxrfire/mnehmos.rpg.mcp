/** New direct questions interrupt a span; an already unanswered offer can be ignored. */
import type { GameService } from './turn-engine.js';
import { pendingPrivatePartyInvitations } from './joining-a-private-party.js';
import { privateWorkTerms } from '../engine/world/private-paid-work.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { swornSiblingsOf } from '../engine/world/close-people-go-together.js';

export function privateQuestionIdsAtTheActualBody(game: GameService): string[] {
    const world = game.atHand, body = game.state().cultivator;
    if (!world || !body.alive || game.fight) return [];
    const present = new Set(game.present(body).map(person => person.id));
    const rows = witnessIndexFor(world).factsByPerson.get(body.id) ?? [];
    const ids = pendingPrivatePartyInvitations(game, body).map(fact => fact.id);
    for (const fact of rows) {
        if (fact.data.privateWorkOffer === true && fact.actors.some(actor => actor.id === body.id && actor.role === 'asked')
            && fact.actors.some(actor => actor.role === 'offered' && present.has(actor.id))
            && (privateWorkTerms(fact)?.dueOnDay ?? 0) > routineTime(world)
            && !world.obligations.some(word => word.tags.includes('private-paid-work') && word.triggeringEventId === fact.id)
            && !rows.some(reply => reply.data.privateWorkDeclined === fact.id)) ids.push(fact.id);
        if (fact.data.swornBrotherhoodInvitation === true && fact.data.toId === body.id
            && present.has(String(fact.data.fromId)) && !swornSiblingsOf(world, body.id).has(String(fact.data.fromId))
            && !rows.some(reply => reply.data.swornBrotherhoodReply === fact.id)) ids.push(fact.id);
    }
    return ids;
}
