/** A computed effect on an actual body; social decisions never store a second binding. */
import type { GameService } from './turn-engine.js';
import { holdsASlaveSeal } from '../engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';

export function compelledByTheAsker(game: GameService, subjectId: string, askerId: string): string | undefined {
    const subject = actualPersonFor(game, subjectId);
    return game.atHand && subject && holdsASlaveSeal(subject.cultivation.seal, askerId, routineTime(game.atHand))
        ? askerId : undefined;
}
