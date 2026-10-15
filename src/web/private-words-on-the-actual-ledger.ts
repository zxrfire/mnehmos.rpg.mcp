/** Private native decisions read the player's existing words and publish their actual changes. */
import type { GameService } from './turn-engine.js';
import { ledgerAbout, writeObligations } from '../storage/repos/obligation.repo.js';
import type { ObligationRecord } from '../engine/social/grudges.js';
import type { PrivateRequestLedger } from '../engine/world/private-requests.js';
import { removeWorldObligations } from '../storage/repos/world-state.repo.js';
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
    retireNativePlayerFavours(game, playerId);
    let changed = false;
    for (const word of ledgerAbout(game.db, playerId).filter(word => word.kind !== 'favor' && isPrivateWord(game, word))) {
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
    retireNativePlayerFavours(game, playerId);
    writeObligations(game.db, game.atHand.obligations.filter(word =>
        (word.holderId === playerId || word.subjectId === playerId) && isPrivateWord(game, word)));
}

/** Upgrade old duplicate favours without allowing a closed SQL word to reopen. */
function retireNativePlayerFavours(game: GameService, playerId: string): void {
    const world = game.atHand!;
    const native = world.obligations.filter(word => word.kind === 'favor'
        && (word.holderId === playerId || word.subjectId === playerId));
    if (!native.length) return;
    const sql = new Map(ledgerAbout(game.db, playerId).map(word => [word.id, word]));
    const transferred = native.map(word => {
        const held = sql.get(word.id);
        return held && (held.status !== 'open' || word.status === 'open') ? held : word;
    });
    game.db.transaction(() => {
        writeObligations(game.db, transferred);
        removeWorldObligations(game.db, world.id, native.map(word => word.id));
    })();
    const ids = new Set(native.map(word => word.id));
    world.obligations = world.obligations.filter(word => !ids.has(word.id));
}

/** SQL favours are derived for a decision, never installed on a world mirror. */
export function privateRequestLedgerFor(game: GameService, playerId: string): PrivateRequestLedger {
    return {
        read: () => {
            const sql = ledgerAbout(game.db, playerId).filter(word => word.kind === 'favor');
            const ids = new Set(sql.map(word => word.id));
            return [...game.atHand!.obligations.filter(word => !ids.has(word.id)), ...sql];
        },
        write: word => {
            if (word.kind === 'favor' && (word.holderId === playerId || word.subjectId === playerId))
                writeObligations(game.db, [word]);
            else {
                const world = game.atHand!, at = world.obligations.findIndex(row => row.id === word.id);
                if (at < 0) world.obligations.push(word);
                else world.obligations[at] = word;
            }
        }
    };
}
