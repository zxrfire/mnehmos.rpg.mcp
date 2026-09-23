/**
 * Giving in, said with no fight around it.
 *
 * `I surrender`, `I yield`, `I give up`, `I kneel`, `I beg for mercy`. Inside a
 * fight every one of these already resolves: `THE_ANSWER_IS_TO_YIELD` has read
 * them since `fight-answers.ts` was written, and `whatTheySaidInTheFight` is
 * asked before the pattern table ever sees the sentence. Outside one they
 * reached nothing, which is the same shape of gap as restraint with nothing to
 * restrain - and it is answered the same way, by naming the situation.
 *
 * ── AND THERE IS A SITUATION, WHICH IS WHY THIS IS NOT ONLY A REFUSAL ────
 *
 * Somebody already working a patch of ground tells an arrival to get off it.
 * That is a demand with a person behind it and no fight yet, and it is exactly
 * where the genre puts a surrender. What submission to it IS, is going - the
 * ordinary walk, with the slight the engine already prices
 * ({@link whatGoingCosts}) written when the player leaves.
 *
 * NOTHING NEW IS RESOLVED HERE. The three answers to that demand are the
 * scene's own and they already work; this says which of them a surrender is,
 * and what it costs, so that the word a player actually typed reaches the
 * thing it means. No day passes, nothing is written, and the walk is still the
 * player's to make.
 */

import { whatGoingCosts } from '../engine/encounters/being-told-to-get-off-this-ground.js';
import type { Cultivator } from '../schema/cultivation.js';
import { factsForRefusal } from './facts.js';
import { theDemandOnThisGround } from './somebody-tells-you-to-get-off-this-ground.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/**
 * What a submission means where this cultivator is standing.
 *
 * Refused in both branches, and in neither case for want of understanding: what
 * is refused is the idea that saying the word settles anything by itself. The
 * facts come with it.
 */
export function theyGiveInWithNoFightStanding(
    game: GameService,
    cultivator: Cultivator
): Execution {
    const standing = theDemandOnThisGround(game, cultivator);
    if (standing !== null) {
        const said = standing.demand.saidBy;
        const cost = whatGoingCosts();
        return refused('engine.giveIn', 'attack', factsForRefusal(
            `${said.name} wants this ground, and nothing else.`,
            `Giving in to ${said.name} means getting off ${standing.place.name}: that is what `
            + `was demanded of you and there is nothing else on the table. Going leaves a slight `
            + `against ${said.name} at ${cost.standing} and costs you nothing else. You can also `
            + `put something to ${said.name}, or tell them no. ${standing.refusing.line}`,
            'A submission with no fight standing, read against the demand on this ground. '
            + `Going prices at ${cost.standing} in standing; refusing opens the ordinary `
            + 'confrontation. Nothing was resolved, nothing was written and no day passed.'
        ));
    }

    return refused('engine.giveIn', 'attack', factsForRefusal(
        'Nobody is pressing you.',
        'Nobody here is swinging at you and nobody is demanding anything of you, so there is '
        + 'nobody to give in to. A surrender ends a fight you are in, or answers somebody who '
        + 'has told you to do something.',
        'A submission with no fight standing and no demand on this ground: nothing in state '
        + 'holds anybody pressing this cultivator. Nothing was written and no day passed.'
    ));
}
