/**
 * The words somebody who has never read this setting would type.
 *
 * The design owner, on why this is the whole of the interface problem:
 *
 *   > i don't type "i touch the crosswalk button" i just type "i cross the road
 *   > safely" it has to be able to handle that
 *
 * Every phrasing in the pattern table is written from inside the setting -
 * `cultivate`, `fold space`, `seclusion`, `provision`. A player arrives with the
 * words their last game used, and `unclear` costs them the turn.
 *
 * ── WHY THIS IS A RATCHET AND NOT A TARGET ───────────────────────────────
 *
 * Some of these SHOULD not route where the naive answer says. "I wait" is a
 * wait and not a month of seclusion; "I run away" is `move/flee` and flee is
 * not a separate verb; "I study the manual" is learning an art and not
 * training one already known. Those rows carry the destination the engine
 * actually holds, and the count below is what is left over.
 *
 * ONLY SHRINK IT. A sentence that starts routing is a sentence somebody can
 * type, and a number that goes up is a turn somebody just lost.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

/** The word a player who has never read this setting would reach for. */
const OUTSIDER: Array<[string, string]> = [
    ['I teleport to Cold Peak', 'fold'],
    ['I meditate for a year', 'cultivate'],
    ['I train for ten years', 'cultivate'],
    ['I level up', 'breakthrough'],
    ['I power up', 'breakthrough'],
    ['I rest and recover', 'wait'],
    ['I heal my wounds', 'treat'],
    ['I see a doctor', 'treat'],
    // `eat`, and it is pinned there. The provision row's own comment argues
    // the other way - somebody who meant a month and got one meal starves -
    // but that is a live disagreement between two rows and not something to
    // settle in passing while adding vocabulary.
    ['I buy food', 'eat'],
    ['I go shopping', 'provision'],
    ['I stock up', 'provision'],
    ['I loot the body', 'interact'],
    ['I search the corpse', 'interact'],
    ['I pickpocket him', 'interact'],
    ['I mug him', 'interact'],
    ['I ambush him', 'attack'],
    ['I backstab him', 'attack'],
    ['I run away', 'move'],
    ['I retreat', 'move'],
    ['I make camp', 'cultivate'],
    ['I go to sleep', 'cultivate'],
    ['I chat with him', 'interact'],
    ['I make small talk', 'interact'],
    ['I haggle with the merchant', 'interact'],
    // Nobody can be taken on in this engine yet - `A_YARD_IS_NOT_HIREABLE_YET`
    // is the same gap said out loud in `craft-verbs.ts`. `buy` is the nearest
    // reading it has, and it is recorded here rather than left to be discovered
    // again the next time somebody types it.
    ['I hire him', 'buy'],
    ['I recruit him', 'interact'],
    ['I read the book', 'investigate'],
    ['I study the manual', 'learn_technique'],
    ['I go hunting', 'hunt'],
    ['I look for herbs', 'gather'],
    ['I pick herbs', 'gather'],
    ['I explore the ruins', 'investigate'],
    ['I go into the tomb', 'site'],
    ['I check my inventory', 'inventory'],
    ['I check my stats', 'status'],
    ['I look at myself', 'status'],
    ['where am I', 'look'],
    ['I follow him', 'interact'],
    ['I wait', 'wait'],
    ['I scream for help', 'interact'],
    ['I bribe the guard', 'interact'],
    ['I poison him', 'attack'],
    ['I kidnap her', 'coerce'],
    ['I tie him up', 'coerce'],
    ['I take him prisoner', 'coerce']
];

/**
 * Sentences the engine holds no capability for.
 *
 * Not a parse failure, and it must not be reported as one: what is missing is
 * an ability, not a reading. `craft` is a YARD and a yard makes carriages and
 * boats; nothing in the engine burns; and "I sneak up on him" is left alone
 * deliberately, because the table's own rule is that an uncertain sentence
 * takes the CHEAPEST action available and reading it as a killing is the most
 * expensive one there is.
 *
 * Listed so that the day one of them grows an answer, it moves up into the
 * corpus above instead of being noticed by nobody.
 */
const NO_ANSWER_YET: readonly string[] = [
    'I forge a sword',
    'I make a sword',
    'I set fire to the village',
    'I sneak up on him',
    'I practise my sword'
];

describe('the words an outsider uses', () => {
    const missed = OUTSIDER.filter(([said, want]) => {
        const got = parseIntent(said);
        return got.action !== want;
    });

    it('routes all but a known handful of them', () => {
        expect(
            missed.map(([said, want]) =>
                `"${said}" wanted ${want}, got ${parseIntent(said).action}`),
            'ONLY SHRINK THIS. A sentence that stops routing is a turn somebody lost.'
        ).toEqual([]);
    });

    /** And none of them is the worst answer, which is no answer. */
    it('leaves none of them unreadable', () => {
        const unread = OUTSIDER
            .filter(([said]) => parseIntent(said).action === 'unclear')
            .map(([said]) => said);
        expect(unread).toEqual([]);
    });
});
