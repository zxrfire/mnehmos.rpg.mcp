/** Retrieval-active hourly waits use the SAME native shortSkip waiting authority.
 * Frozen7 transport context omitted native hostility and encounter handling.
 * No recursion: shortSkip uses the held ordinary-body helper, never passHours.
 */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { WAITING_FOCUS } from './turn-constants.js';
export async function spendWhileAStoreRetrievalRuns(game: GameService, run: Run,
    body: Cultivator, days: number): Promise<Execution | null> {
    if (!game.worldEnabled || !(game.atHand ??= await game.loadWorld())?.npcs.some(n => n.activity?.retrievalRequestId)) return null;
    return game.shortSkip(run, body, game.ambientFor(body, run), WAITING_FOCUS, 'Waiting', days);
}
