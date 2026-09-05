/**
 * "the purchase a physician's visit" is not English.
 *
 * Played, when the splitter asked which act came first:
 *
 *   Which comes first? "the purchase a physician's visit" or "I find a doctor"
 *
 * `PLAINLY` holds two kinds of name and the code glued the target onto both.
 * The object-taking ones read correctly - "the journey to Halfwater", "the
 * approach to Bai Xuping" - and the self-contained ones did not. "the sale a
 * manual", "the hunt a boar" and "the gathering herbs" were all one played turn
 * away.
 *
 * WORTH FIXING INDEPENDENTLY OF THE SPLITTING, because it reads badly on every
 * turn this question fires - including the turns where the split is correct.
 */

import {
    everyVerbTheQuestionCouldName,
    whatThisStepIsCalled
} from '../../src/web/a-sentence-can-be-more-than-one-call';

const named = (action: string, target?: string) => whatThisStepIsCalled(
    { action: { action, ...(target ? { target } : {}) } } as never
);

describe('naming an act with something to point at', () => {
    it('joins the object to the name instead of butting them together', () => {
        expect(named('buy', "a physician's visit")).toBe("the purchase of a physician's visit");
        expect(named('sell', 'a manual')).toBe('the sale of a manual');
        expect(named('hunt', 'a boar')).toBe('the hunt for a boar');
        expect(named('gather', 'herbs')).toBe('the gathering of herbs');
    });

    it('leaves the names that were already written to take one', () => {
        expect(named('move', 'Halfwater')).toBe('the journey to Halfwater');
        expect(named('interact', 'Bai Xuping')).toBe('the approach to Bai Xuping');
        expect(named('attack', 'the bandit')).toBe('the fight with the bandit');
    });

    it('uses the bare name when there is nothing to point at', () => {
        expect(named('treat')).toBe('having the wound seen to');
        expect(named('cultivate')).toBe('sitting down to cultivate');
    });

    /** The player's own words still beat all of it. */
    it('prefers what the player actually said', () => {
        expect(whatThisStepIsCalled(
            { said: 'I find a doctor', action: { action: 'buy', target: 'a visit' } } as never
        )).toBe('I find a doctor');
    });
});

/**
 * AND NO VERB THIS QUESTION CAN NAME PRODUCES BROKEN ENGLISH.
 *
 * The guard that matters, because the failure was one verb nobody had said out
 * loud with an object. Every verb that can cost the player is asked for its name
 * both ways, and neither may end up with a noun butted onto a complete phrase.
 */
describe('every verb the question could name', () => {
    it('joins or stands alone, and never butts two phrases together', () => {
        for (const verb of everyVerbTheQuestionCouldName()) {
            const withObject = named(verb, 'the thing');
            // Either the object was joined on, or the name stood alone. What
            // must not happen is the name ending in a noun with `the thing`
            // stuck straight after it.
            const joined = withObject.endsWith('the thing');
            const stoodAlone = withObject === named(verb);
            expect(joined || stoodAlone, `${verb}: "${withObject}"`).toBe(true);
            if (joined) {
                const lead = withObject.slice(0, -'the thing'.length).trim();
                expect(lead, `${verb}: "${withObject}"`)
                    .toMatch(/\b(?:to|with|at|on|for|of|into|from|under|up|taking|going)$/i);
            }
        }
    });

    it('never leaves an underscore in front of a player', () => {
        for (const verb of everyVerbTheQuestionCouldName()) {
            expect(named(verb), verb).not.toMatch(/_/);
            expect(named(verb, 'the thing'), verb).not.toMatch(/_/);
        }
    });
});
