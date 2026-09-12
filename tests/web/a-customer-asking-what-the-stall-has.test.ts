/**
 * "let me see what you have" is a customer at a counter, and it got the blank
 * look.
 *
 * Measured on the refusal probe, 28 turns, every one `engine.parseIntent/
 * unclear`. Reproduced engine-only against world seed `a-xianxia-run`, seed
 * factory `xianxia`.
 *
 * The board question was already answered in a dozen phrasings - `what is for
 * sale`, `what does he have`, `what has she got`, `who here is selling` - and
 * every one of them is in the third person. The list of pronouns
 * `SELLING_ASKED_AS_A_BOARD` and the market branch read was `they|he|she|people|
 * anybody|anyone|everybody|the <word>`, and the one word a customer actually
 * uses standing in front of a stallholder is `you`. Nothing else was missing:
 * the same sentence about the same stall in the third person already reached
 * the board.
 *
 * So this pins the second person as a way of asking the board question, and it
 * pins the third-person forms alongside it so a later narrowing of the pattern
 * cannot quietly take them away again.
 */

// The harness first, and it is load-bearing rather than tidy: `prompt.ts`
// reads `costsTheAskerNothing` at module scope, and reaching the pattern table
// before the turn engine has finished loading leaves that binding undefined.
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table';

const WORLD = 'a-xianxia-run';

const SAID_TO_A_STALLHOLDER = [
    'let me see what you have',
    'show me what you have',
    'what do you have',
    "let's see what you've got"
];

/** The third person, which already worked. Here so it keeps working. */
const SAID_ABOUT_ONE = [
    'what does he have',
    'what has she got',
    'what is for sale'
];

describe('the board question, asked to somebody rather than about them', () => {
    for (const said of [...SAID_TO_A_STALLHOLDER, ...SAID_ABOUT_ONE]) {
        it(`"${said}" reaches the counter`, () => {
            expect(parseIntent(said).action).toBe('market');
        });
    }

    it('does not eat a question about what somebody is carrying on them', () => {
        // `what are you carrying` is a person, not a stall. Kept apart so the
        // widening above does not swallow the pouch read one mechanic over.
        expect(parseIntent('what am I carrying').action).not.toBe('market');
    });
});

describe('played, standing in a square', () => {
    it('"let me see what you have" is answered rather than shrugged at', async () => {
        const harness = await makeGameInWorld({ seed: 'xianxia', worldSeed: WORLD });
        await harness.game.newRun('Prober');
        const turn = await harness.game.act('let me see what you have');

        expect(
            turn.toolCalls.some(call => call.name === 'engine.parseIntent' && !call.ok),
            'the blank look'
        ).toBe(false);
        expect(turn.toolCalls.some(call => call.action === 'market')).toBe(true);
    });
});
