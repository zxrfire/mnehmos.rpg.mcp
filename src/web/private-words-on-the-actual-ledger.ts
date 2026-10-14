/** Private native decisions read the player's existing words and publish their actual changes. */
import type { GameService } from './turn-engine.js';
import { ledgerAbout, writeObligations } from '../storage/repos/obligation.repo.js';
import type { ObligationRecord } from '../engine/social/grudges.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';

function isPrivateWord(game: GameService, word: ObligationRecord): boolean {
    return word.kind === 'favor' || word.cause === 'sworn_brotherhood'
        || word.tags.some(tag => tag.startsWith('private-'))
        || !!word.triggeringEventId && witnessIndexFor(game.atHand!).byId.get(word.triggeringEventId)?.data.privateRequest === true;
}

/** A word released on the ordinary ledger cannot remain open in a private resolver. */
export function readPrivateWordsAtTheActualBody(game: GameService, playerId: string): void {
    const world = game.atHand;
    if (!world) return;
    let changed = false;
    for (const word of ledgerAbout(game.db, playerId).filter(word => isPrivateWord(game, word))) {
        const at = world.obligations.findIndex(record => record.id === word.id), native = world.obligations[at];
        if (!native) { world.obligations.push(word); changed = true; }
        else if (native.status === 'open' && word.status !== 'open'
            || (word.settlement?.onDay ?? -Infinity) > (native.settlement?.onDay ?? -Infinity)) {
            world.obligations[at] = word; changed = true;
        }
    }
    if (changed) game.theWorldMoved();
}

export function writePrivateWordsAtTheActualBody(game: GameService, playerId: string): void {
    if (!game.atHand) return;
    writeObligations(game.db, game.atHand.obligations.filter(word =>
        (word.holderId === playerId || word.subjectId === playerId) && isPrivateWord(game, word)));
}
